// 配置文件
const config = {
    // 数据库配置
    database: {
        type: process.env.DB_TYPE || 'sqlite', // sqlite, mysql, postgresql, oceanbase
        sqlite: {
            path: process.env.DB_PATH || './cron_jenkins.db'
        },
        mysql: {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            database: process.env.DB_NAME || 'cron_jenkins',
            username: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || '',
            charset: 'utf8mb4'
        },
        postgresql: {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'cron_jenkins',
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || '',
            ssl: process.env.DB_SSL === 'true'
        },
        oceanbase: {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 2881,
            database: process.env.DB_NAME || 'cron_jenkins',
            username: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || '',
            charset: 'utf8mb4'
        }
    },
    
    // 应用配置
    app: {
        port: process.env.PORT || 3000,
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        corsOrigin: process.env.CORS_ORIGIN || '*'
    },
    
    // 管理员配置
    admin: {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        email: process.env.ADMIN_EMAIL || 'admin@example.com'
    },
    
    // Jenkins配置
    jenkins: {
        timeout: parseInt(process.env.JENKINS_TIMEOUT) || 30000,
        retryCount: parseInt(process.env.JENKINS_RETRY_COUNT) || 3
    }
};

module.exports = config;