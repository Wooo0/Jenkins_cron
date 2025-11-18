const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const cron = require('node-cron');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const querystring = require('querystring');

const app = express();
const PORT = process.env.PORT || 3000;

// 配置管理
const config = require('./config');

// 检查是否已通过环境变量配置了管理员账户（不是默认值）
const hasAdminConfig = process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD &&
                      (process.env.ADMIN_USERNAME !== 'admin' || process.env.ADMIN_PASSWORD !== 'admin123');

// 数据库管理器
class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbType = config.database.type;
        this.isConnected = false;
    }

    /**
     * 根据数据库类型格式化时间
     * @param {Date} date - 日期对象，默认为当前时间
     * @returns {string} 格式化后的时间字符串
     */
    formatDateTime(date = new Date()) {
        if (this.dbType === 'mysql') {
            // MySQL 使用 YYYY-MM-DD HH:MM:SS 格式
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } else {
            // SQLite 和其他数据库使用 ISO 格式
            return date.toISOString();
        }
    }

    async connect() {
        try {
            console.log(`正在连接数据库 - 类型: ${this.dbType}`);
            
            switch (this.dbType) {
                case 'sqlite':
                    console.log(`SQLite数据库路径: ${config.database.sqlite.path}`);
                    this.db = new sqlite3.Database(config.database.sqlite.path);
                    console.log('SQLite数据库连接成功');
                    break;
                case 'mysql':
                    console.log(`MySQL连接参数 - 主机: ${config.database.mysql.host}, 端口: ${config.database.mysql.port}, 数据库: ${config.database.mysql.database}, 用户: ${config.database.mysql.username}`);
                    this.db = await mysql.createConnection({
                        host: config.database.mysql.host,
                        port: config.database.mysql.port,
                        database: config.database.mysql.database,
                        user: config.database.mysql.username,
                        password: config.database.mysql.password,
                        charset: config.database.mysql.charset,
                        // 添加连接池和超时设置
                        connectTimeout: 60000, // 连接超时60秒
                        acquireTimeout: 60000, // 获取连接超时60秒
                        timeout: 60000, // 查询超时60秒
                        reconnect: true, // 启用自动重连
                        // 连接池设置
                        connectionLimit: 10,
                        queueLimit: 0
                    });
                    console.log('MySQL数据库连接成功');
                    this.isConnected = true;
                    break;
                default:
                    throw new Error(`不支持的数据库类型: ${this.dbType}`);
            }
        } catch (error) {
            console.error('数据库连接失败:', error.message);
            console.error('连接错误详情:', error.stack);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * 检查连接状态并在需要时重连
     */
    async ensureConnection() {
        try {
            if (!this.isConnected || !this.db) {
                console.log('数据库连接已断开，正在重新连接...');
                await this.connect();
                return;
            }

            // 对于MySQL，检查连接是否仍然有效
            if (this.dbType === 'mysql') {
                try {
                    // 检查连接是否处于关闭状态
                    if (this.db._closing || this.db._closed) {
                        console.log('MySQL连接已关闭，正在重新连接...');
                        await this.connect();
                        return;
                    }
                    
                    // 执行简单查询测试连接
                    await this.db.execute('SELECT 1');
                } catch (error) {
                    console.log(`MySQL连接测试失败: ${error.message}，正在重新连接...`);
                    await this.connect();
                }
            }
        } catch (error) {
            console.error('确保数据库连接失败:', error.message);
            throw error;
        }
    }

    async query(sql, params = []) {
        try {
            // 确保数据库连接有效
            await this.ensureConnection();
            
            if (this.dbType === 'sqlite') {
                return new Promise((resolve, reject) => {
                    this.db.all(sql, params, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
            } else if (this.dbType === 'mysql') {
                const [rows] = await this.db.execute(sql, params);
                return rows;
            }
        } catch (error) {
            console.error('数据库查询失败:', error.message);
            throw error;
        }
    }

    async run(sql, params = []) {
        try {
            // 确保数据库连接有效
            await this.ensureConnection();
            
            if (this.dbType === 'sqlite') {
                return new Promise((resolve, reject) => {
                    this.db.run(sql, params, function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID, changes: this.changes });
                    });
                });
            } else if (this.dbType === 'mysql') {
                const [result] = await this.db.execute(sql, params);
                return { id: result.insertId, changes: result.affectedRows };
            }
        } catch (error) {
            console.error('数据库执行失败:', error.message);
            throw error;
        }
    }

    async get(sql, params = []) {
        try {
            // 确保数据库连接有效
            await this.ensureConnection();
            
            if (this.dbType === 'sqlite') {
                return new Promise((resolve, reject) => {
                    this.db.get(sql, params, (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
            } else if (this.dbType === 'mysql') {
                const [rows] = await this.db.execute(sql, params);
                return rows[0] || null;
            }
        } catch (error) {
            console.error('数据库查询失败:', error.message);
            throw error;
        }
    }

    async isDatabaseInitialized() {
        try {
            console.log(`检查数据库初始化状态 - 数据库类型: ${this.dbType}`);
            
            if (this.dbType === 'sqlite') {
                const row = await this.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
                console.log(`SQLite初始化检查结果: ${!!row}`);
                return !!row;
            } else if (this.dbType === 'mysql') {
                const rows = await this.query("SHOW TABLES LIKE 'users'");
                console.log(`MySQL初始化检查结果: ${rows.length > 0}, 找到表数量: ${rows.length}`);
                return rows.length > 0;
            }
            return false;
        } catch (error) {
            console.error('检查数据库初始化状态失败:', error.message);
            console.error('错误详情:', error.stack);
            return false;
        }
    }

    /**
     * 检查表是否存在特定字段
     */
    async hasColumn(tableName, columnName) {
        try {
            if (this.dbType === 'sqlite') {
                const sql = `PRAGMA table_info(${tableName})`;
                const columns = await this.query(sql);
                return columns.some(col => col.name === columnName);
            } else if (this.dbType === 'mysql') {
                const sql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME = ?`;
                const rows = await this.query(sql, [tableName, columnName]);
                return rows.length > 0;
            }
            return false;
        } catch (error) {
            console.error(`检查字段 ${columnName} 失败:`, error);
            return false;
        }
    }

    /**
     * 添加字段到表
     */
    async addColumn(tableName, columnName, columnType) {
        try {
            const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
            await this.run(sql);
            console.log(`成功添加字段 ${columnName} 到表 ${tableName}`);
            return true;
        } catch (error) {
            console.error(`添加字段 ${columnName} 失败:`, error);
            return false;
        }
    }

    async initializeDatabase() {
        try {
            console.log(`开始初始化${this.dbType.toUpperCase()}数据库...`);
            
            // 根据数据库类型生成不同的SQL语句
            let createTablesSQL;
            if (this.dbType === 'sqlite') {
                createTablesSQL = [
                    // Jenkins配置表
                    `CREATE TABLE IF NOT EXISTS jenkins_config (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT UNIQUE NOT NULL,
                        url TEXT NOT NULL,
                        username TEXT,
                        token TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    
                    // 定时任务表
                    `CREATE TABLE IF NOT EXISTS scheduled_jobs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        jenkins_config_id INTEGER,
                        jenkins_jobs TEXT NOT NULL, -- 存储任务JSON数组，单任务: ["任务名"], 多任务: ["任务1", "任务2"]
                        cron_expression TEXT,
                        execute_once BOOLEAN DEFAULT 0,
                        execute_time DATETIME,
                        parameters TEXT,
                        status TEXT DEFAULT 'pending',
                        last_execution DATETIME,
                        next_execution DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (jenkins_config_id) REFERENCES jenkins_config (id)
                    )`,
                    
                    // 执行历史表
                    `CREATE TABLE IF NOT EXISTS execution_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        job_id INTEGER,
                        jenkins_build_number INTEGER,
                        status TEXT,
                        start_time DATETIME,
                        end_time DATETIME,
                        log_output TEXT,
                        FOREIGN KEY (job_id) REFERENCES scheduled_jobs (id)
                    )`,
                    
                    // 用户表
                    `CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        email TEXT,
                        role TEXT DEFAULT 'user',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`
                ];
            } else if (this.dbType === 'mysql') {
                createTablesSQL = [
                    // Jenkins配置表
                    `CREATE TABLE IF NOT EXISTS jenkins_config (
                        id INTEGER PRIMARY KEY AUTO_INCREMENT,
                        name VARCHAR(255) UNIQUE NOT NULL,
                        url TEXT NOT NULL,
                        username VARCHAR(255),
                        token TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    
                    // 定时任务表
                    `CREATE TABLE IF NOT EXISTS scheduled_jobs (
                        id INTEGER PRIMARY KEY AUTO_INCREMENT,
                        name VARCHAR(255) NOT NULL,
                        jenkins_config_id INTEGER,
                        jenkins_job_name VARCHAR(255) NOT NULL,
                        jenkins_jobs TEXT, -- 存储多任务JSON数组
                        cron_expression VARCHAR(255),
                        execute_once BOOLEAN DEFAULT 0,
                        execute_time DATETIME,
                        parameters TEXT,
                        status VARCHAR(50) DEFAULT 'pending',
                        last_execution DATETIME,
                        next_execution DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (jenkins_config_id) REFERENCES jenkins_config (id)
                    )`,
                    
                    // 执行历史表
                    `CREATE TABLE IF NOT EXISTS execution_history (
                        id int(11) NOT NULL AUTO_INCREMENT,
                        job_id int(11) NULL DEFAULT NULL,
                        jenkins_build_number int(11) NULL DEFAULT NULL,
                        status varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
                        start_time datetime NULL DEFAULT NULL,
                        end_time datetime NULL DEFAULT NULL,
                        log_output text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
                        PRIMARY KEY (id) USING BTREE,
                        INDEX job_id(job_id) USING BTREE,
                        FOREIGN KEY (job_id) REFERENCES scheduled_jobs (id) ON DELETE RESTRICT ON UPDATE RESTRICT
                    ) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Dynamic`,
                    
                    // 用户表
                    `CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTO_INCREMENT,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        email VARCHAR(255),
                        role VARCHAR(50) DEFAULT 'user',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`
                ];
            }

            for (const sql of createTablesSQL) {
                await this.run(sql);
            }

            // 创建默认管理员用户
            const defaultPassword = bcrypt.hashSync(config.admin.password, 10);
            await this.run(
                `INSERT IGNORE INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)`,
                [config.admin.username, defaultPassword, config.admin.email, 'admin']
            );

            console.log('数据库初始化完成');
            
            // 检查并添加缺失的字段
            await this.migrateDatabase();
            
            return true;
        } catch (error) {
            console.error('数据库初始化失败:', error.message);
            throw error;
        }
    }

    /**
     * 数据库迁移 - 添加新字段和数据迁移
     */
    async migrateDatabase() {
        try {
            console.log('开始数据库迁移检查...');
            
            // 检查 scheduled_jobs 表是否包含 jenkins_jobs 字段
            const hasJenkinsJobsField = await this.hasColumn('scheduled_jobs', 'jenkins_jobs');
            
            if (!hasJenkinsJobsField) {
                console.log('检测到缺少 jenkins_jobs 字段，正在添加...');
                await this.addColumn('scheduled_jobs', 'jenkins_jobs', 'TEXT');
                console.log('成功添加 jenkins_jobs 字段到 scheduled_jobs 表');
                
                // 迁移现有数据：将 jenkins_job_name 迁移到 jenkins_jobs
                console.log('开始迁移现有任务数据...');
                const jobs = await this.query("SELECT id, jenkins_job_name FROM scheduled_jobs WHERE jenkins_jobs IS NULL OR jenkins_jobs = ''");
                for (const job of jobs) {
                    if (job.jenkins_job_name) {
                        const jenkinsJobsJson = JSON.stringify([job.jenkins_job_name]);
                        await this.run("UPDATE scheduled_jobs SET jenkins_jobs = ? WHERE id = ?", [jenkinsJobsJson, job.id]);
                        console.log(`迁移任务 ${job.id}: ${job.jenkins_job_name}`);
                    }
                }
                console.log('现有任务数据迁移完成');
            } else {
                console.log('jenkins_jobs 字段已存在');
            }
            
            console.log('数据库迁移检查完成');
        } catch (error) {
            console.error('数据库迁移失败:', error);
            // 迁移失败不应该阻止应用启动
        }
    }
}

const dbManager = new DatabaseManager();

// 应用启动初始化
async function initializeApp() {
    try {
        console.log('开始应用初始化...');
        
        // 连接数据库
        await dbManager.connect();
        
        // 检查数据库是否已初始化
        const isInitialized = await dbManager.isDatabaseInitialized();
        console.log(`数据库初始化状态: ${isInitialized}`);
        
        if (!isInitialized) {
            console.log('检测到数据库未初始化，开始初始化...');
            await dbManager.initializeDatabase();
            console.log('数据库初始化完成');
        } else {
            console.log('数据库已初始化，跳过初始化步骤');
            // 对于已初始化的数据库，仍然需要执行迁移检查
            await dbManager.migrateDatabase();
        }
        
        // 创建定时任务管理器
        cronManager = new CronJobManager();
        console.log('定时任务管理器创建完成');
        
        console.log('应用初始化完成');
        return true;
    } catch (error) {
        console.error('应用初始化失败:', error.message);
        console.error('初始化错误详情:', error.stack);
        throw error;
    }
}

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// JWT密钥
const JWT_SECRET = config.app.jwtSecret;

// 认证中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: '访问令牌缺失' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '令牌无效' });
        }
        req.user = user;
        next();
    });
};

// Jenkins API 工具类
class JenkinsAPI {
    constructor(config) {
        this.baseURL = config.url;
        this.auth = {
            username: config.username,
            password: config.token
        };
    }

    async getJobConfig(jobName) {
        try {
            // 处理文件夹路径的任务名
            let jobPath;
            if (jobName.includes('/job/')) {
                // 如果已经包含/job/，直接使用
                jobPath = jobName.split('/job/').map(part => encodeURIComponent(part)).join('/job/');
            } else if (jobName.includes('/')) {
                // 如果包含斜杠但没有/job/，需要在每个路径段前添加job/
                const parts = jobName.split('/');
                jobPath = parts.map(part => encodeURIComponent(part)).join('/job/');
            } else {
                // 单个任务名
                jobPath = `${encodeURIComponent(jobName)}`;
            }
            
            // 确保baseURL不以斜杠结尾
            const baseURL = this.baseURL.replace(/\/+$/g, '');
            const fullUrl = `${baseURL}/job/${jobPath}/api/json`;
            console.log(`尝试访问Jenkins URL: ${fullUrl}`);
            console.log(`原始jobName: ${jobName}`);
            console.log(`处理后jobPath: ${jobPath}`);
            
            const config = {};
            if (this.auth.username && this.auth.password) {
                const authHeader = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64');
                config.headers = { 'Authorization': `Basic ${authHeader}` };
            }
            
            const response = await axios.get(fullUrl, config);
            return response.data;
        } catch (error) {
            console.error(`Jenkins API错误: ${error.message}`);
            if (error.response) {
                console.error(`响应状态: ${error.response.status}`);
                console.error(`响应数据: ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`获取Jenkins任务配置失败: ${error.message}`);
        }
    }

    async getGitBranches(jobName) {
        try {
            const jobConfig = await this.getJobConfig(jobName);
            if (jobConfig && jobConfig.scm && jobConfig.scm.branches) {
                return jobConfig.scm.branches.map(branch => branch.name);
            }
            return [];
        } catch (error) {
            console.error(`获取Git分支数据失败: ${error.message}`);
            throw new Error(`获取Git分支数据失败: ${error.message}`);
        }
    }

    async getJobParameters(jobName) {
        try {
            const jobConfig = await this.getJobConfig(jobName);
            const parameters = [];
            
            if (jobConfig.property) {
                for (const prop of jobConfig.property) {
                    if (prop._class === 'hudson.model.ParametersDefinitionProperty') {
                        parameters.push(...prop.parameterDefinitions);
                    }
                }
            }
            
            return parameters;
        } catch (error) {
            throw new Error(`获取Jenkins任务参数失败: ${error.message}`);
        }
    }

    async triggerBuild(jobName, parameters = {}) {
        try {
            // 处理文件夹路径的任务名 - 与getJobConfig保持一致
            let jobPath;
            if (jobName.includes('/job/')) {
                // 如果已经包含/job/，直接使用
                jobPath = jobName.split('/job/').map(part => encodeURIComponent(part)).join('/job/');
            } else if (jobName.includes('/')) {
                // 如果包含斜杠但没有/job/，需要在每个路径段前添加job/
                const parts = jobName.split('/');
                jobPath = parts.map(part => encodeURIComponent(part)).join('/job/');
            } else {
                // 单个任务名
                jobPath = `${encodeURIComponent(jobName)}`;
            }
            
            console.log(`原始jobName: ${jobName}, 处理后jobPath: ${jobPath}`);
            
            // 确保baseURL不以斜杠结尾
            const baseURL = this.baseURL.replace(/\/+$/g, '');
            
            // 确保参数是对象
            const params = typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
            
            // 根据是否有参数决定使用哪个URL
            let url;
            if (Object.keys(params).length > 0) {
                url = `${baseURL}/job/${jobPath}/buildWithParameters`;
            } else {
                url = `${baseURL}/job/${jobPath}/build`;
            }
            
            console.log('Jenkins构建请求URL:', url);
            console.log(`触发Jenkins构建请求: URL=${url}, 参数=${JSON.stringify(params)}`);
            
            // 使用表单格式传递参数
            const config = {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            };
            
            // 添加认证信息 - 使用Basic Auth
            if (this.auth.username && this.auth.password) {
                const authHeader = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64');
                config.headers['Authorization'] = `Basic ${authHeader}`;
            }
            
            // 对于Jenkins CSRF保护，可能需要添加crumb
            try {
                const crumbResponse = await axios.get(`${baseURL}/crumbIssuer/api/json`, {
                    auth: this.auth
                });
                if (crumbResponse.data && crumbResponse.data.crumb) {
                    config.headers[crumbResponse.data.crumbRequestField] = crumbResponse.data.crumb;
                }
            } catch (crumbError) {
                console.log('CSRF crumb不可用，继续执行:', crumbError.message);
            }
            
            // 构建表单数据
            const formData = querystring.stringify(params);
            
            const response = await axios.post(url, formData, config);
            
            // console.log(`Jenkins构建响应: 状态=${response.status}, 位置=${response.headers.location}`);
            
            return response.headers.location;
        } catch (error) {
            console.error(`Jenkins构建失败: ${error.message}`);
            if (error.response) {
                console.error(`响应状态: ${error.response.status}`);
                console.error(`响应头: ${JSON.stringify(error.response.headers)}`);
                console.error(`响应数据: ${JSON.stringify(error.response.data)}`);
                
                // 提供更详细的错误信息
                if (error.response.status === 403) {
                    throw new Error(`Jenkins认证失败(403): 请检查用户名和API Token是否正确，以及用户是否有执行该任务的权限`);
                } else if (error.response.status === 404) {
                    throw new Error(`Jenkins任务不存在(404): 请检查任务名称是否正确`);
                } else if (error.response.status === 401) {
                    throw new Error(`Jenkins认证失败(401): 用户名或密码/API Token不正确`);
                }
            }
            throw error;
        }
    }

    async getAllJobs() {
        return await this.getJobsRecursive('');
    }

    async getJobsRecursive(path = '') {
        try {
            // 确保baseURL不以斜杠结尾
            const baseURL = this.baseURL.replace(/\/+$/g, '');
            const url = path ? `${baseURL}/job/${path}/api/json` : `${baseURL}/api/json`;
            
            const config = {};
            if (this.auth.username && this.auth.password) {
                const authHeader = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64');
                config.headers = { 'Authorization': `Basic ${authHeader}` };
            }
            
            const response = await axios.get(url, config);
            
            let allJobs = [];
            
            for (const item of response.data.jobs) {
                if (item._class === 'com.cloudbees.hudson.plugins.folder.Folder') {
                    // 这是一个文件夹，递归获取其中的任务
                    const folderPath = path ? `${path}/job/${item.name}` : item.name;
                    const subJobs = await this.getJobsRecursive(folderPath);
                    // 为子任务添加文件夹路径信息
                    subJobs.forEach(job => {
                        // job.fullName 已经在递归调用中正确设置，不需要修改
                        job.displayName = folderPath + '/' + job.name;
                        job.folderPath = folderPath;
                    });
                    allJobs = allJobs.concat(subJobs);
                } else {
                    // 这是一个普通任务
                    item.fullName = path ? `${path}/job/${item.name}` : item.name;
                    item.displayName = path ? `${path}/${item.name}` : item.name;
                    item.folderPath = path || '';
                    allJobs.push(item);
                }
            }
            
            return allJobs;
        } catch (error) {
            throw new Error(`获取Jenkins任务列表失败: ${error.message}`);
        }
    }
}

// 定时任务管理器
class CronJobManager {
    constructor() {
        this.jobs = new Map();
        this.loadScheduledJobs();
    }

    async loadScheduledJobs() {
        try {
            let sql;
            if (dbManager.dbType === 'sqlite') {
                sql = "SELECT * FROM scheduled_jobs WHERE status = 'active' AND (execute_once = 0 OR execute_time > datetime('now'))";
            } else if (dbManager.dbType === 'mysql') {
                sql = "SELECT * FROM scheduled_jobs WHERE status = 'active' AND (execute_once = 0 OR execute_time > NOW())";
            }
            
            const rows = await dbManager.query(sql);
            
            rows.forEach(job => {
                if (job.execute_once) {
                    this.scheduleOneTimeJob(job);
                } else if (job.cron_expression) {
                    this.scheduleCronJob(job);
                }
            });
        } catch (err) {
            console.error('加载定时任务失败:', err);
        }
    }

    async scheduleOneTimeJob(job) {
        const executeTime = new Date(job.execute_time);
        const now = new Date();
        
        if (executeTime <= now) {
            // console.log(`任务 ${job.name} 的执行时间已过期 (执行时间: ${executeTime}, 当前时间: ${now})`);
            // 更新任务状态为过期
            await dbManager.run("UPDATE scheduled_jobs SET status = 'expired' WHERE id = ?", [job.id]);
            return;
        }

        const delay = executeTime.getTime() - now.getTime();
        
        const timeoutId = setTimeout(async () => {
            await this.executeJob(job);
            this.jobs.delete(job.id);
        }, delay);

        this.jobs.set(job.id, { type: 'timeout', id: timeoutId });
        // console.log(`已安排一次性任务: ${job.name}, 执行时间: ${executeTime}`);
    }

    scheduleCronJob(job) {
        const cronJob = cron.schedule(job.cron_expression, async () => {
            await this.executeJob(job);
        }, {
            scheduled: false
        });

        cronJob.start();
        this.jobs.set(job.id, { type: 'cron', job: cronJob });
        // console.log(`已安排周期性任务: ${job.name}, Cron表达式: ${job.cron_expression}`);
    }

    async executeJob(job) {
        // console.log(`开始执行任务: ${job.name}`);
        
        try {
            // 获取Jenkins配置
            const jenkinsConfig = await dbManager.get("SELECT * FROM jenkins_config WHERE id = ?", [job.jenkins_config_id]);

            if (!jenkinsConfig) {
                throw new Error('Jenkins配置不存在');
            }

            const jenkins = new JenkinsAPI(jenkinsConfig);
            
            // 执行任务构建
            const buildResults = await this.executeJobBuild(job, jenkins);
            
            // 记录执行历史 - 开始执行
            console.log(`正在记录执行历史 - 任务ID: ${job.id}, 状态: started`);
            const historyResult = await dbManager.run(`INSERT INTO execution_history (job_id, status, start_time) VALUES (?, ?, ?)`,
                [job.id, 'started', dbManager.formatDateTime()]);
            console.log(`执行历史记录插入结果:`, historyResult);

            // 更新任务状态
            await dbManager.run("UPDATE scheduled_jobs SET last_execution = ? WHERE id = ?",
                [dbManager.formatDateTime(), job.id]);
            
            // 统计执行结果
            const successCount = buildResults.filter(r => r.status === 'success').length;
            const failedCount = buildResults.filter(r => r.status === 'failed').length;
            const totalJobs = buildResults.length;
            
            // 记录执行完成状态
            let finalStatus = 'success';
            let logOutput = '';
            
            if (successCount === totalJobs) {
                finalStatus = 'success';
                logOutput = `任务 ${job.name} 所有${totalJobs}个子任务执行成功`;
                console.log(logOutput);
            } else if (successCount > 0) {
                finalStatus = 'partial_success';
                logOutput = `任务 ${job.name} 执行结果: ${successCount}个成功, ${failedCount}个失败`;
                console.log(logOutput);
            } else {
                finalStatus = 'failed';
                logOutput = `任务 ${job.name} 所有${totalJobs}个子任务执行失败`;
                console.log(logOutput);
            }
            
            // 更新执行历史记录为完成状态
            await dbManager.run(`UPDATE execution_history SET status = ?, end_time = ?, log_output = ? WHERE job_id = ? AND status = 'started'`,
                [finalStatus, dbManager.formatDateTime(), logOutput, job.id]);
            
        } catch (error) {
            console.error(`任务 ${job.name} 执行失败:`, error.message);
            console.error(`失败详情: ${error.stack}`);
            
            // 记录执行失败
            await dbManager.run(`INSERT INTO execution_history (job_id, status, start_time, log_output) VALUES (?, ?, ?, ?)`,
                [job.id, 'failed', dbManager.formatDateTime(), `错误详情: ${error.message}\n堆栈: ${error.stack}`]);
        }
    }

    // 统一的执行任务构建逻辑
    async executeJobBuild(job, jenkins) {
        let parameters = {};
        if (job.parameters) {
            try {
                // 先检查parameters是否已经是对象
                if (typeof job.parameters === 'object' && !Array.isArray(job.parameters) && job.parameters !== null) {
                    parameters = job.parameters;
                } else if (typeof job.parameters === 'string') {
                    // 只有当parameters是字符串时才尝试解析
                    parameters = JSON.parse(job.parameters);
                }
                // 如果parameters是其他类型（如数组等），保持parameters为{}
            } catch (error) {
                console.error(`任务 ${job.name} 的参数解析失败: ${error.message}`);
                parameters = {};
            }
        }
        
        console.log(`任务 ${job.name} 的Jenkins配置: ${JSON.stringify(jenkins)}`);
        console.log(`任务 ${job.name} 的参数: ${JSON.stringify(parameters)}`);
        
        // 检查是否是多任务
        let jobNames = [];
        let jobParameters = {};
        
        if (job.parameters) {
            try {
                jobParameters = typeof job.parameters === 'string' ? JSON.parse(job.parameters) : job.parameters;
            } catch (error) {
                console.error(`任务 ${job.name} 的参数解析失败: ${error.message}`);
                jobParameters = {};
            }
        }
        
        // 从 parameters 字段获取完整任务路径（键就是完整路径）
        if (jobParameters && typeof jobParameters === 'object' && Object.keys(jobParameters).length > 0) {
            jobNames = Object.keys(jobParameters);
        } else {
            // 回退到从 jenkins_jobs 字段获取（兼容旧数据）
            if (job.jenkins_jobs) {
                try {
                    jobNames = typeof job.jenkins_jobs === 'string' ? JSON.parse(job.jenkins_jobs) : job.jenkins_jobs;
                } catch (error) {
                    console.error(`任务 ${job.name} 的任务列表解析失败: ${error.message}`);
                    jobNames = [];
                }
            }
        }
        
        if (jobNames.length === 0) {
            throw new Error('任务列表为空');
        }
        
        const buildResults = [];
        
        // 为每个任务触发Jenkins构建
        for (const jobName of jobNames) {
            try {
                // 获取该任务的独立参数
                let taskParameters = {};
                if (typeof jobParameters === 'object' && jobParameters[jobName]) {
                    // 新的 job_configs 格式
                    taskParameters = jobParameters[jobName];
                } else if (typeof jobParameters === 'object' && !Array.isArray(jobParameters)) {
                    // 旧的 job_parameters 格式或单任务参数
                    taskParameters = jobParameters;
                } else {
                    // 使用通用参数
                    taskParameters = parameters;
                }
                
                const buildLocation = await jenkins.triggerBuild(jobName, taskParameters);
                buildResults.push({
                    jobName: jobName,
                    buildLocation: buildLocation,
                    status: 'success'
                });
                console.log(`任务执行成功: ${jobName}`);
            } catch (error) {
                console.error(`任务执行失败: ${jobName}`, error);
                buildResults.push({
                    jobName: jobName,
                    error: error.message,
                    status: 'failed'
                });
            }
        }
        
        return buildResults;
    }

    stopJob(jobId) {
        const job = this.jobs.get(jobId);
        if (job) {
            if (job.type === 'timeout') {
                clearTimeout(job.id);
            } else if (job.type === 'cron') {
                job.job.stop();
            }
            this.jobs.delete(jobId);
        }
    }
}

let cronManager;

// 初始化API路由
app.get('/api/init/status', async (req, res) => {
    try {
        const isInitialized = await dbManager.isDatabaseInitialized();
        res.json({
            initialized: isInitialized,
            hasAdminConfig: hasAdminConfig,
            adminUsername: hasAdminConfig ? config.admin.username : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/init/setup', async (req, res) => {
    try {
        const { adminUsername, adminPassword, adminEmail } = req.body;
        
        // 如果通过环境变量配置了管理员账户，则使用环境变量的配置
        if (hasAdminConfig) {
            console.log('使用环境变量配置的管理员账户进行初始化');
        } else {
            // 否则使用用户输入的配置
            if (!adminUsername || !adminPassword) {
                return res.status(400).json({ error: '管理员用户名和密码不能为空' });
            }
            config.admin.username = adminUsername;
            config.admin.password = adminPassword;
            config.admin.email = adminEmail || config.admin.email;
        }
        
        // 使用DatabaseManager进行数据库初始化
        await dbManager.initializeDatabase();
        
        res.json({ success: true, message: '系统初始化完成' });
    } catch (error) {
        console.error('初始化失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 自动初始化API（用于环境变量配置的情况）
app.post('/api/init/auto-setup', async (req, res) => {
    try {
        if (!hasAdminConfig) {
            return res.status(400).json({ error: '未配置环境变量，无法自动初始化' });
        }
        
        // 使用DatabaseManager进行数据库初始化
        await dbManager.initializeDatabase();
        
        res.json({ success: true, message: '系统自动初始化完成' });
    } catch (error) {
        console.error('自动初始化失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// API 路由

// 用户登录
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        const user = await dbManager.get("SELECT * FROM users WHERE username = ?", [username]);
        
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 验证密码
        const isValidPassword = bcrypt.compareSync(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 生成JWT令牌
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取当前用户信息
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await dbManager.get("SELECT id, username, email, role FROM users WHERE id = ?", [req.user.id]);
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

// 获取所有Jenkins配置
app.get('/api/jenkins-configs', authenticateToken, async (req, res) => {
    try {
        const rows = await dbManager.query("SELECT id, name, url, username FROM jenkins_config");
        res.json(rows);
    } catch (error) {
        console.error('获取Jenkins配置失败:', error);
        res.status(500).json({ error: '获取Jenkins配置失败' });
    }
});

// 添加Jenkins配置
app.post('/api/jenkins-configs', authenticateToken, async (req, res) => {
    try {
        const { name, url, username, token } = req.body;
        
        const result = await dbManager.run("INSERT INTO jenkins_config (name, url, username, token) VALUES (?, ?, ?, ?)",
            [name, url, username, token]);
        
        res.json({ id: result.id, message: 'Jenkins配置添加成功' });
    } catch (error) {
        console.error('添加Jenkins配置失败:', error);
        res.status(500).json({ error: '添加Jenkins配置失败' });
    }
});

// 删除Jenkins配置
app.delete('/api/jenkins-configs/:id', authenticateToken, async (req, res) => {
    try {
        const configId = req.params.id;
        
        // 检查是否有任务使用此配置
        const row = await dbManager.get("SELECT COUNT(*) as count FROM scheduled_jobs WHERE jenkins_config_id = ?", [configId]);
        
        if (row.count > 0) {
            return res.status(400).json({ error: '无法删除配置，有任务正在使用此配置' });
        }
        
        const result = await dbManager.run("DELETE FROM jenkins_config WHERE id = ?", [configId]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: '配置不存在' });
        }
        
        res.json({ message: 'Jenkins配置删除成功' });
    } catch (error) {
        console.error('删除Jenkins配置失败:', error);
        res.status(500).json({ error: '删除Jenkins配置失败' });
    }
});

// 编辑定时任务
app.put('/api/scheduled-jobs/:id', authenticateToken, async (req, res) => {
    try {
        const jobId = req.params.id;
        const { name, jenkins_config_id, cron_expression, execute_once, execute_time, job_configs } = req.body;
        
        console.log('编辑任务请求数据:', req.body);
        
        // 处理多任务和单任务的参数存储
        let serializedParameters;
        let jenkins_jobs_json;
        
        if (job_configs && typeof job_configs === 'object' && Object.keys(job_configs).length > 0) {
            // 多任务模式 - 使用统一的任务配置对象（单任务也是只有一个任务的多任务）
            const jobNames = Object.keys(job_configs);
            
            // 从完整路径中提取项目名存储到jenkins_jobs字段
            const projectNames = jobNames.map(fullPath => {
                if (fullPath.includes('/job/')) {
                    // 提取 /job/ 后面的项目名
                    return fullPath.split('/job/').pop();
                }
                return fullPath;
            });
            jenkins_jobs_json = JSON.stringify(projectNames);
            
            // job_configs 直接就是参数对象，不需要再提取
            serializedParameters = JSON.stringify(job_configs);
        } else {
            return res.status(400).json({ error: '请选择至少一个Jenkins任务' });
        }
        
        await dbManager.run("UPDATE scheduled_jobs SET name = ?, jenkins_config_id = ?, jenkins_jobs = ?, cron_expression = ?, execute_once = ?, execute_time = ?, parameters = ?, status = 'active' WHERE id = ?",
            [name, jenkins_config_id, jenkins_jobs_json, cron_expression, execute_once, execute_time, serializedParameters, jobId]);
        
        // 重新加载任务
        cronManager.stopJob(jobId);
        const job = await dbManager.get("SELECT * FROM scheduled_jobs WHERE id = ?", [jobId]);
        
        if (!job) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        if (job.execute_once) {
            cronManager.scheduleOneTimeJob(job);
        } else if (job.cron_expression) {
            cronManager.scheduleCronJob(job);
        }
        
        res.json({ message: '任务更新成功' });
    } catch (error) {
        console.error('编辑定时任务失败:', error);
        res.status(500).json({ error: '编辑定时任务失败' });
    }
});

// 获取Jenkins任务列表
app.get('/api/jenkins/:configId/jobs', authenticateToken, async (req, res) => {
    try {
        const configId = req.params.configId;
        
        const config = await dbManager.get("SELECT * FROM jenkins_config WHERE id = ?", [configId]);

        if (!config) {
            return res.status(404).json({ error: 'Jenkins配置不存在' });
        }

        console.log(`获取Jenkins任务列表，配置ID: ${configId}, URL: ${config.url}`);
        
        const jenkins = new JenkinsAPI(config);
        const jobs = await jenkins.getAllJobs();
        
        console.log(`成功获取 ${jobs.length} 个Jenkins任务`);
        res.json(jobs);
    } catch (error) {
        console.error(`获取Jenkins任务列表失败: ${error.message}`);
        console.error(`错误详情: ${error.stack}`);
        res.status(500).json({ error: `获取Jenkins任务列表失败: ${error.message}` });
    }
});

// 获取Jenkins任务参数 - 使用通配符路由处理文件夹路径
app.get('/api/jenkins/:configId/jobs/*', authenticateToken, async (req, res) => {
    try {
        const configId = req.params.configId;
        const jobPath = req.params[0]; // 获取通配符匹配的部分
        
        // 检查是否是参数请求
        if (!jobPath.endsWith('/parameters')) {
            return res.status(404).json({ error: '不支持的API路径' });
        }
        
        // 移除末尾的 /parameters 获取真正的任务路径
        const jobName = decodeURIComponent(jobPath.replace('/parameters', ''));
        
        const config = await dbManager.get("SELECT * FROM jenkins_config WHERE id = ?", [configId]);

        if (!config) {
            return res.status(404).json({ error: 'Jenkins配置不存在' });
        }

        const jenkins = new JenkinsAPI(config);
        const parameters = await jenkins.getJobParameters(jobName);
        
        res.json(parameters);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建定时任务
app.post('/api/scheduled-jobs', authenticateToken, async (req, res) => {
    try {
        const { name, jenkins_config_id, cron_expression, execute_once, execute_time, job_configs } = req.body;
        
        // 处理任务数据
        let jenkins_jobs_json = null;
        let serializedParameters;
        
        if (job_configs && typeof job_configs === 'object' && Object.keys(job_configs).length > 0) {
            // 多任务模式 - 使用统一的任务配置对象
            const jobNames = Object.keys(job_configs);
            
            // 从完整路径中提取项目名存储到jenkins_jobs字段
            const projectNames = jobNames.map(fullPath => {
                if (fullPath.includes('/job/')) {
                    // 提取 /job/ 后面的项目名
                    return fullPath.split('/job/').pop();
                }
                return fullPath;
            });
            jenkins_jobs_json = JSON.stringify(projectNames);
            
            // job_configs 直接就是参数对象，不需要再提取
            serializedParameters = JSON.stringify(job_configs);
        } else {
            return res.status(400).json({ error: '请选择至少一个Jenkins任务' });
        }
        
        const sql = `INSERT INTO scheduled_jobs
            (name, jenkins_config_id, jenkins_jobs, cron_expression, execute_once, execute_time, parameters, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`;
        
        const result = await dbManager.run(sql, [
            name, jenkins_config_id, jenkins_jobs_json,
            cron_expression, execute_once, execute_time, serializedParameters
        ]);
        
        // 重新加载定时任务
        const jobId = result.id;
        const job = await dbManager.get("SELECT * FROM scheduled_jobs WHERE id = ?", [jobId]);
        
        if (job) {
            if (job.execute_once) {
                cronManager.scheduleOneTimeJob(job);
            } else if (job.cron_expression) {
                cronManager.scheduleCronJob(job);
            }
        }
        
        res.json({ id: jobId, message: '定时任务创建成功' });
    } catch (error) {
        console.error('创建定时任务失败:', error);
        res.status(500).json({ error: '创建定时任务失败' });
    }
});

// 获取所有定时任务
app.get('/api/scheduled-jobs', authenticateToken, async (req, res) => {
    try {
        const sql = `SELECT sj.*, jc.name as jenkins_config_name
                     FROM scheduled_jobs sj
                     LEFT JOIN jenkins_config jc ON sj.jenkins_config_id = jc.id
                     ORDER BY sj.created_at DESC`;
        
        const rows = await dbManager.query(sql);
        
        // 处理多任务数据
        const processedRows = rows.map(row => {
            let jenkins_jobs = [];
            let parameters = row.parameters;
            try {
                if (row.jenkins_jobs) {
                    // 先尝试直接解析
                    jenkins_jobs = JSON.parse(row.jenkins_jobs);
                }
                if (row.parameters) {
                    parameters = typeof row.parameters === 'string' ? row.parameters.replace(/\\\"/g, '"') : row.parameters;
                }
            } catch (error) {
                console.error('解析多任务数据失败:', error);
                // 如果直接解析失败，尝试清理转义符后再解析
                try {
                    if (row.jenkins_jobs) {
                        const cleanedJobs = row.jenkins_jobs.replace(/\\\"/g, '"').replace(/\\\\/g, '\\');
                        jenkins_jobs = JSON.parse(cleanedJobs);
                    }
                } catch (secondError) {
                    console.error('二次解析多任务数据失败:', secondError);
                    jenkins_jobs = [];
                }
            }
            
            return {
                ...row,
                jenkins_jobs: jenkins_jobs
            };
        });
        
        res.json(processedRows);
    } catch (error) {
        console.error('获取定时任务失败:', error);
        res.status(500).json({ error: '获取定时任务失败' });
    }
});

// 获取单个定时任务详情
app.get('/api/scheduled-jobs/:id', authenticateToken, async (req, res) => {
    try {
        const jobId = req.params.id;
        
        const sql = `SELECT sj.*, jc.name as jenkins_config_name
                     FROM scheduled_jobs sj
                     LEFT JOIN jenkins_config jc ON sj.jenkins_config_id = jc.id
                     WHERE sj.id = ?`;
        
        const row = await dbManager.get(sql, [jobId]);
        
        if (!row) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        // 处理多任务数据
        let jenkins_jobs = [];
        try {
            if (row.jenkins_jobs) {
                // 先尝试直接解析
                jenkins_jobs = JSON.parse(row.jenkins_jobs);
            }
        } catch (error) {
            console.error('解析多任务数据失败:', error);
            // 如果直接解析失败，尝试清理转义符后再解析
            try {
                if (row.jenkins_jobs) {
                    const cleanedJobs = row.jenkins_jobs.replace(/\\\"/g, '"').replace(/\\\\/g, '\\');
                    jenkins_jobs = JSON.parse(cleanedJobs);
                }
            } catch (secondError) {
                console.error('二次解析多任务数据失败:', secondError);
                jenkins_jobs = [];
            }
        }
        
        // 解析参数
        if (row.parameters) {
            try {
                // 确保参数是对象格式
                if (typeof row.parameters === 'string') {
                    row.parameters = JSON.parse(row.parameters);
                }
            } catch (parseError) {
                console.error('参数解析错误:', parseError);
                row.parameters = {};
            }
        } else {
            row.parameters = {};
        }
        
        const processedRow = {
            ...row,
            jenkins_jobs: jenkins_jobs
        };
        
        res.json(processedRow);
    } catch (error) {
        console.error('获取定时任务详情失败:', error);
        res.status(500).json({ error: '获取定时任务详情失败' });
    }
});

// 切换任务状态
app.put('/api/scheduled-jobs/:id/status', authenticateToken, async (req, res) => {
    try {
        const jobId = req.params.id;
        const { status } = req.body;
        
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ error: '状态必须是 active 或 inactive' });
        }
        
        const result = await dbManager.run("UPDATE scheduled_jobs SET status = ? WHERE id = ?", [status, jobId]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        res.json({ message: '状态更新成功' });
    } catch (error) {
        console.error('切换任务状态失败:', error);
        res.status(500).json({ error: '切换任务状态失败' });
    }
});

// 删除定时任务
app.delete('/api/scheduled-jobs/:id', authenticateToken, async (req, res) => {
    try {
        const jobId = req.params.id;
    
    // 停止定时任务
    cronManager.stopJob(parseInt(jobId));
    
    // 从数据库删除
        await dbManager.run("DELETE FROM scheduled_jobs WHERE id = ?", [jobId]);
        res.json({ message: '定时任务删除成功' });
    } catch (error) {
        console.error('删除定时任务失败:', error);
        res.status(500).json({ error: '删除定时任务失败' });
    }
});

// 立即执行任务
app.post('/api/scheduled-jobs/:id/execute', authenticateToken, async (req, res) => {
    const jobId = req.params.id;
    
    try {
        // 获取任务信息
        const job = await dbManager.get(`
            SELECT sj.*, jc.url as jenkins_url, jc.username as jenkins_username, jc.token as jenkins_token
            FROM scheduled_jobs sj
            JOIN jenkins_config jc ON sj.jenkins_config_id = jc.id
            WHERE sj.id = ?
        `, [jobId]);
        
        if (!job) {
            return res.status(404).json({ error: '任务不存在' });
        }
        
        try {
            // 创建Jenkins API实例
            const jenkinsConfig = {
                url: job.jenkins_url,
                username: job.jenkins_username,
                token: job.jenkins_token
            };
            
            const jenkins = new JenkinsAPI(jenkinsConfig);
            
            // 使用统一的执行函数
            const buildResults = await cronManager.executeJobBuild(job, jenkins);
            
            // 记录执行历史 - 开始执行
            console.log(`立即执行任务 - 正在记录执行历史 - 任务ID: ${job.id}, 状态: started`);
            const historyResult = await dbManager.run(`INSERT INTO execution_history (job_id, status, start_time) VALUES (?, ?, ?)`,
                [job.id, 'started', dbManager.formatDateTime()]);
            console.log(`立即执行任务 - 执行历史记录插入结果:`, historyResult);

            // 更新任务状态
            await dbManager.run("UPDATE scheduled_jobs SET last_execution = ? WHERE id = ?",
                [dbManager.formatDateTime(), job.id]);
            
            // 统计执行结果
            const successCount = buildResults.filter(r => r.status === 'success').length;
            const failedCount = buildResults.filter(r => r.status === 'failed').length;
            const totalJobs = buildResults.length;
            
            // 记录执行完成状态
            let finalStatus = 'success';
            let logOutput = '';
            let message = '';
            
            if (successCount === totalJobs) {
                finalStatus = 'success';
                logOutput = `任务 ${job.name} 所有${totalJobs}个子任务执行成功`;
                message = `所有${totalJobs}个任务已成功提交执行`;
                console.log(logOutput);
            } else if (successCount > 0) {
                finalStatus = 'partial_success';
                logOutput = `任务 ${job.name} 执行结果: ${successCount}个成功, ${failedCount}个失败`;
                message = `${successCount}个任务成功执行，${failedCount}个任务执行失败`;
                console.log(logOutput);
            } else {
                finalStatus = 'failed';
                logOutput = `任务 ${job.name} 所有${totalJobs}个子任务执行失败`;
                message = `所有${totalJobs}个任务执行失败`;
                console.log(logOutput);
            }
            
            // 更新执行历史记录为完成状态
            await dbManager.run(`UPDATE execution_history SET status = ?, end_time = ?, log_output = ? WHERE job_id = ? AND status = 'started'`,
                [finalStatus, dbManager.formatDateTime(), logOutput, job.id]);
            
            res.json({
                message: message,
                buildResults: buildResults,
                totalJobs: totalJobs,
                successCount: successCount,
                failedCount: failedCount
            });
        } catch (error) {
            console.error(`立即执行任务 ${job.name} 执行失败:`, error.message);
            console.error(`失败详情: ${error.stack}`);
            
            // 记录执行失败
            await dbManager.run(`INSERT INTO execution_history (job_id, status, start_time, log_output) VALUES (?, ?, ?, ?)`,
                [job.id, 'failed', dbManager.formatDateTime(), `错误详情: ${error.message}\n堆栈: ${error.stack}`]);
            
            res.status(500).json({ error: '任务执行失败: ' + error.message });
        }
    } catch (error) {
        console.error('获取任务信息失败:', error);
        res.status(500).json({ error: '获取任务信息失败' });
    }
});

// 获取执行历史
app.get('/api/execution-history', authenticateToken, async (req, res) => {
    try {
        const sql = `SELECT eh.*, sj.name as job_name
                     FROM execution_history eh
                     LEFT JOIN scheduled_jobs sj ON eh.job_id = sj.id
                     ORDER BY eh.start_time DESC
                     LIMIT 10`;
        
        const rows = await dbManager.query(sql);
        res.json(rows);
    } catch (error) {
        console.error('获取执行历史失败:', error);
        res.status(500).json({ error: '获取执行历史失败' });
    }
});

// 获取执行历史（按任务ID）
app.get('/api/execution-history/:jobId', authenticateToken, async (req, res) => {
    try {
        const jobId = req.params.jobId;
        
        const rows = await dbManager.query("SELECT * FROM execution_history WHERE job_id = ? ORDER BY start_time DESC", [jobId]);
        res.json(rows);
    } catch (error) {
        console.error('获取任务执行历史失败:', error);
        res.status(500).json({ error: '获取任务执行历史失败' });
    }
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
async function startServer() {
    try {
        // 初始化应用
        await initializeApp();
        
        // 启动服务器
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`服务器运行在端口 ${PORT}`);
            cronManager.loadScheduledJobs();
        });
    } catch (error) {
        console.error('服务器启动失败:', error.message);
        process.exit(1);
    }
}

startServer();

// 优雅关闭
process.on('SIGINT', () => {
    // console.log('正在关闭服务器...');
    if (dbManager.db) {
        dbManager.db.close();
    }
    process.exit(0);
});