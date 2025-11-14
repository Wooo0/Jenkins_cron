// 全局状态管理
const AppState = {
    currentTab: 'dashboard',
    jenkinsConfigs: [],
    scheduledJobs: [],
    selectedJenkinsConfig: null,
    selectedJenkinsJob: null,
    jobParameters: [],
    editingJobId: null,
    isEditMode: false,
    user: null,
    token: localStorage.getItem('token')
};

// 参数状态管理 - 新增全局状态对象
const JobParametersState = {
    // 按模态框类型存储参数状态
    create: {
        parameters: [],
        currentValues: {}
    },
    edit: {
        parameters: [],
        currentValues: {}
    }
};

// API 工具类
class API {
    static async request(url, options = {}) {
        try {
            // 添加认证头
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            if (AppState.token) {
                headers['Authorization'] = `Bearer ${AppState.token}`;
            }
            
            const response = await fetch(url, {
                headers,
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            showNotification(error.message, 'error');
            throw error;
        }
    }

    static async get(url) {
        return this.request(url);
    }

    static async post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
static async delete(url) {
    return this.request(url, {
        method: 'DELETE'
    });
}

// 认证相关方法
static async login(username, password) {
    const response = await this.request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    return response;
}

static async getUserInfo() {
    return this.request('/api/user');
}
}

// 初始化管理
class InitManager {
    static async checkInitStatus() {
        try {
            const response = await fetch('/api/init/status');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('检查初始化状态失败:', error);
            return { initialized: false, hasAdminConfig: false };
        }
    }
    
    static async setupSystem(adminUsername, adminPassword, adminEmail) {
        try {
            const response = await fetch('/api/init/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    adminUsername,
                    adminPassword,
                    adminEmail
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            showNotification('系统初始化成功', 'success');
            return data;
        } catch (error) {
            showNotification('系统初始化失败: ' + error.message, 'error');
            throw error;
        }
    }
    
    static showInit() {
        document.getElementById('init-container').style.display = 'flex';
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'none';
    }
    
    static hideInit() {
        document.getElementById('init-container').style.display = 'none';
    }
    
    static async autoSetup() {
        try {
            const response = await fetch('/api/init/auto-setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            showNotification('系统自动初始化成功', 'success');
            return data;
        } catch (error) {
            showNotification('系统自动初始化失败: ' + error.message, 'error');
            throw error;
        }
    }
}

// 认证管理
class AuthManager {
    static async login(username, password) {
        try {
            const response = await API.login(username, password);
            
            // 保存token和用户信息
            AppState.token = response.token;
            AppState.user = response.user;
            localStorage.setItem('token', response.token);
            
            // 显示成功消息
            showNotification('登录成功', 'success');
            
            // 切换到主应用界面
            this.showApp();
            
            return true;
        } catch (error) {
            showNotification('登录失败: ' + error.message, 'error');
            return false;
        }
    }
    
    static async logout() {
        AppState.token = null;
        AppState.user = null;
        localStorage.removeItem('token');
        
        // 切换到登录界面
        this.showLogin();
        
        showNotification('已退出登录', 'info');
    }
    
    static async checkAuth() {
        // 首先检查系统是否已初始化
        const initStatus = await InitManager.checkInitStatus();
        
        if (!initStatus.initialized) {
            // 如果已通过环境变量配置了管理员账户，尝试自动初始化
            if (initStatus.hasAdminConfig) {
                try {
                    await InitManager.autoSetup();
                    // 自动初始化成功后，显示登录界面
                    this.showLogin();
                    return false;
                } catch (error) {
                    console.error('自动初始化失败:', error);
                    // 自动初始化失败，显示初始化界面
                    InitManager.showInit();
                    return false;
                }
            } else {
                // 未配置环境变量，显示初始化界面
                InitManager.showInit();
                return false;
            }
        }
        
        if (!AppState.token) {
            this.showLogin();
            return false;
        }
        
        try {
            const userInfo = await API.getUserInfo();
            AppState.user = userInfo;
            this.showApp();
            return true;
        } catch (error) {
            console.error('认证检查失败:', error);
            this.logout();
            return false;
        }
    }
    
    static showLogin() {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
    }
    
    static showApp() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        
        // 更新用户显示
        if (AppState.user) {
            document.getElementById('user-display').textContent = `欢迎, ${AppState.user.username}`;
        }
        
        // 初始化应用数据
        initApp();
    }
}

// 通知系统
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// 标签页切换
function initTabs() {
    // 使用正确的类名 tab-btn
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // 更新按钮状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 显示目标标签页
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });
            
            AppState.currentTab = targetTab;
            
            // 根据标签页加载相应数据
            switch(targetTab) {
                case 'dashboard':
                    loadDashboardData();
                    break;
                case 'jenkins-config':
                    loadJenkinsConfigs();
                    break;
                case 'job-list':
                    loadJobList();
                    break;
            }
        });
    });
    
    // 默认激活第一个标签页
    if (tabButtons.length > 0) {
        tabButtons[0].click();
    }
}

// 加载控制台数据
async function loadDashboardData() {
    try {
        // 加载统计信息
        const jobs = await API.get('/api/scheduled-jobs');
        const configs = await API.get('/api/jenkins-configs');
        
        const totalJobs = jobs.length;
        const activeJobs = jobs.filter(job => job.status === 'active').length;
        const totalConfigs = configs.length;
        
        const totalJobsElement = document.getElementById('total-jobs');
        const activeJobsElement = document.getElementById('active-jobs');
        const jenkinsConfigsElement = document.getElementById('jenkins-configs');
        
        if (totalJobsElement) totalJobsElement.textContent = totalJobs;
        if (activeJobsElement) activeJobsElement.textContent = activeJobs;
        if (jenkinsConfigsElement) jenkinsConfigsElement.textContent = totalConfigs;
        
        // 加载最近执行记录
        loadRecentActivity();
        
    } catch (error) {
        console.error('加载控制台数据失败:', error);
    }
}

// 加载最近执行记录
async function loadRecentActivity() {
    try {
        const history = await API.get('/api/execution-history');
        
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;
        
        if (history.length === 0) {
            activityList.innerHTML = '<p>暂无执行记录</p>';
            return;
        }
        
        // 按时间倒序排列，取最近5条
        const recentHistory = history
            .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
            .slice(0, 5);
        
        activityList.innerHTML = recentHistory.map(item => `
            <div class="recent-activity-item">
                <div class="activity-header">
                    <strong>任务 #${item.job_id}</strong>
                    <span class="status-badge status-${item.status}">${getStatusText(item.status)}</span>
                </div>
                <div class="time">${formatDateTime(item.start_time)}</div>
                ${item.log_output ? `<div class="log">${item.log_output.substring(0, 100)}${item.log_output.length > 100 ? '...' : ''}</div>` : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('加载执行历史失败:', error);
    }
}

// 获取执行历史记录
async function getExecutionHistory() {
    try {
        const history = await API.get('/api/execution-history');
        return history;
    } catch (error) {
        console.error('获取执行历史失败:', error);
        return [];
    }
}

// Jenkins配置管理
async function loadJenkinsConfigs() {
    try {
        const configs = await API.get('/api/jenkins-configs');
        AppState.jenkinsConfigs = configs;
        
        const configTableBody = document.getElementById('config-table-body');
        if (!configTableBody) return;
        
        if (configs.length === 0) {
            configTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">暂无配置</td></tr>';
            return;
        }
        
        configTableBody.innerHTML = configs.map(config => `
            <tr>
                <td>${config.name}</td>
                <td>${config.url}</td>
                <td>${config.username}</td>
                <td>${formatDateTime(config.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary test-connection-btn" onclick="testJenkinsConnection(${config.id})">测试连接</button>
                        <button class="btn btn-danger" onclick="deleteJenkinsConfig(${config.id})">删除</button>
                    </div>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('加载Jenkins配置失败:', error);
        showNotification('加载Jenkins配置失败: ' + error.message, 'error');
    }
}

function renderJenkinsConfigs(configs) {
    const configList = document.getElementById('jenkins-config-list');
    
    if (configs.length === 0) {
        configList.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <h3>暂无Jenkins配置</h3>
                <p>点击上方"添加Jenkins配置"按钮开始配置</p>
            </div>
        `;
        return;
    }
    
    configList.innerHTML = configs.map(config => `
        <div class="config-item">
            <h3>${config.name}</h3>
            <p><strong>URL:</strong> ${config.url}</p>
            <p><strong>用户名:</strong> ${config.username}</p>
            <div class="config-actions">
                <button class="btn btn-secondary" onclick="testJenkinsConnection(${config.id})">测试连接</button>
                <button class="btn btn-danger" onclick="deleteJenkinsConfig(${config.id})">删除</button>
            </div>
        </div>
    `).join('');
}

// Jenkins配置模态框
function openJenkinsModal() {
    document.getElementById('jenkins-config-form').reset();
    document.getElementById('jenkins-modal').style.display = 'block';
}

function closeJenkinsModal() {
    document.getElementById('jenkins-modal').style.display = 'none';
}

async function testJenkinsConnection(configId) {
    const button = document.querySelector(`button[onclick="testJenkinsConnection(${configId})"]`);
    
    try {
        // 更新按钮状态为测试中
        if (button) {
            button.classList.add('testing');
            button.innerHTML = '<span class="btn-spinner"></span> 测试中...';
        }
        
        // 调用API测试连接
        const jobs = await API.get(`/api/jenkins/${configId}/jobs`);
        
        // 更新按钮状态为成功
        if (button) {
            button.classList.remove('testing');
            button.classList.add('success');
            button.innerHTML = '✓ 连接成功';
            
            // 3秒后恢复原始状态
            setTimeout(() => {
                button.classList.remove('success');
                button.innerHTML = '测试连接';
            }, 3000);
        }
        
        showNotification('Jenkins连接成功', 'success');
    } catch (error) {
        console.error('Jenkins连接测试失败:', error);
        
        // 更新按钮状态为失败
        if (button) {
            button.classList.remove('testing');
            button.classList.add('failed');
            button.innerHTML = '✗ 连接失败';
            
            // 3秒后恢复原始状态
            setTimeout(() => {
                button.classList.remove('failed');
                button.innerHTML = '测试连接';
            }, 3000);
        }
        
        showNotification('Jenkins连接失败: ' + error.message, 'error');
    }
}

async function deleteJenkinsConfig(configId) {
    if (!confirm('确定要删除这个Jenkins配置吗？')) return;
    
    try {
        await API.delete(`/api/jenkins-configs/${configId}`);
        showNotification('Jenkins配置删除成功', 'success');
        loadJenkinsConfigs();
    } catch (error) {
        showNotification('删除失败: ' + error.message, 'error');
    }
}

// 创建任务表单
async function loadCreateJobForm() {
    // 如果不是编辑模式，才重置表单状态
    if (!AppState.isEditMode) {
        await loadJenkinsConfigsForSelect();
        setupExecutionTypeToggle();
        updateFormMode();
    }
}

async function loadJenkinsConfigsForSelect() {
    try {
        const configs = await API.get('/api/jenkins-configs');
        const select = document.getElementById('jenkins-config-select');
        
        select.innerHTML = '<option value="">请选择Jenkins配置</option>' +
            configs.map(config => `<option value="${config.id}">${config.name}</option>`).join('');
        
        // 监听Jenkins配置选择变化
        select.addEventListener('change', onJenkinsConfigChange);
    } catch (error) {
        console.error('加载Jenkins配置失败:', error);
    }
}

async function onJenkinsConfigChange(event) {
    const configId = event.target.value;
    const jobSelect = document.getElementById('jenkins-job-select');
    
    if (!configId) {
        jobSelect.innerHTML = '<option value="">请先选择Jenkins配置</option>';
        return;
    }
    
    try {
        jobSelect.innerHTML = '<option value="">加载中...</option>';
        const jobs = await API.get(`/api/jenkins/${configId}/jobs`);
        
        jobSelect.innerHTML = '<option value="">请选择Jenkins任务</option>' +
            jobs.map(job => `<option value="${job.fullName || job.name}">${job.displayName || job.name}</option>`).join('');
        
        // 移除旧的监听器，避免重复绑定
        jobSelect.removeEventListener('change', onJenkinsJobChange);
        // 重新绑定监听器
        jobSelect.addEventListener('change', onJenkinsJobChange);
        
    } catch (error) {
        jobSelect.innerHTML = '<option value="">加载失败</option>';
        showNotification('加载Jenkins任务失败: ' + error.message, 'error');
    }
}

async function onJenkinsJobChange(event) {
    const jobName = event.target.value;
    const configId = document.getElementById('jenkins-config-select').value;
    
    if (!jobName || !configId) {
        document.getElementById('parameters-container').innerHTML = '';
        return;
    }
    
    try {
        const parameters = await API.get(`/api/jenkins/${configId}/jobs/${jobName}/parameters`);
        AppState.jobParameters = parameters;
        renderJobParameters(parameters);
    } catch (error) {
        console.error('加载任务参数失败:', error);
        showNotification('加载任务参数失败: ' + error.message, 'error');
    }
}

function renderJobParameters(parameters) {
    const container = document.getElementById('parameters-container');
    
    if (parameters.length === 0) {
        container.innerHTML = '<p style="color: #666;">此任务无需参数</p>';
        return;
    }
    
    container.innerHTML = parameters.map(param => {
        switch (param._class) {
            case 'hudson.model.StringParameterDefinition':
                return renderStringParameter(param);
            case 'hudson.model.ChoiceParameterDefinition':
                return renderChoiceParameter(param);
            case 'hudson.model.BooleanParameterDefinition':
                return renderBooleanParameter(param);
            case 'net.uaznia.lukanus.hudson.plugins.gitparameter.GitParameterDefinition':
                return renderGitParameter(param);
            default:
                return renderGenericParameter(param);
        }
    }).join('');
}

function renderStringParameter(param) {
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <input type="text" name="param_${param.name}" value="${param.defaultParameterValue?.value || ''}" 
                   placeholder="请输入${param.name}">
        </div>
    `;
}

function renderChoiceParameter(param) {
    const choices = param.choices || [];
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <select name="param_${param.name}">
                ${choices.map(choice => `
                    <option value="${choice}" ${choice === param.defaultParameterValue?.value ? 'selected' : ''}>
                        ${choice}
                    </option>
                `).join('')}
            </select>
        </div>
    `;
}

function renderBooleanParameter(param) {
    const defaultValue = param.defaultParameterValue?.value || false;
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <label class="radio-label">
                <input type="checkbox" name="param_${param.name}" ${defaultValue ? 'checked' : ''}>
                启用
            </label>
        </div>
    `;
}

function renderGitParameter(param) {
    const branches = param.allValueItems?.values || [];
    return `
        <div class="parameter-item">
            <h4>${param.name} (Git分支)</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <select name="param_${param.name}">
                ${branches.map(branch => `
                    <option value="${branch.value}" ${branch.value === param.defaultParameterValue?.value ? 'selected' : ''}>
                        ${branch.name}
                    </option>
                `).join('')}
            </select>
            <small class="form-help">支持分支过滤: ${param.branchFilter || 'origin/(.*)'}</small>
        </div>
    `;
}

function renderGenericParameter(param) {
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <input type="text" name="param_${param.name}" value="${param.defaultParameterValue?.value || ''}" 
                   placeholder="请输入${param.name}">
            <small class="form-help">参数类型: ${param._class}</small>
        </div>
    `;
}

function setupExecutionTypeToggle() {
    // 为创建任务模态框设置执行类型切换
    const createRadios = document.querySelectorAll('#create-job-modal input[name="execution_type"]');
    const createExecuteTimeGroup = document.getElementById('execute-time-group-modal');
    const createCronExpressionGroup = document.getElementById('cron-expression-group-modal');

    if (createExecuteTimeGroup && createCronExpressionGroup) {
        createRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'once') {
                    createExecuteTimeGroup.style.display = 'block';
                    createCronExpressionGroup.style.display = 'none';
                } else if (this.value === 'recurring') {
                    createExecuteTimeGroup.style.display = 'none';
                    createCronExpressionGroup.style.display = 'block';
                }
            });
        });
    }

    // 为编辑任务模态框设置执行类型切换
    const editRadios = document.querySelectorAll('#edit-job-modal input[name="execution_type"]');
    const editExecuteTimeGroup = document.getElementById('edit-execute-time-group');
    const editCronExpressionGroup = document.getElementById('edit-cron-expression-group');

    if (editExecuteTimeGroup && editCronExpressionGroup) {
        editRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'once') {
                    editExecuteTimeGroup.style.display = 'block';
                    editCronExpressionGroup.style.display = 'none';
                } else if (this.value === 'recurring') {
                    editExecuteTimeGroup.style.display = 'none';
                    editCronExpressionGroup.style.display = 'block';
                }
            });
        });
    }
}

// 任务列表管理
async function loadJobList() {
    try {
        const jobs = await API.get('/api/scheduled-jobs');
        const jobTableBody = document.getElementById('job-table-body');
        
        if (!jobTableBody) return;
        
        if (jobs.length === 0) {
            jobTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">暂无任务</td></tr>';
            return;
        }
        
        // 预处理 jobs 数据，确保 jenkins_jobs 是一个解析后的数组
        const processedJobs = jobs.map(job => {
            // 如果 jenkins_jobs 不是数组，尝试处理
            if (!Array.isArray(job.jenkins_jobs)) {
                if (typeof job.jenkins_jobs === 'string') {
                    try {
                        // 后端已经处理过转义符，直接解析即可
                        job.jenkins_jobs = JSON.parse(job.jenkins_jobs);
                    } catch (e) {
                        console.error('解析 jenkins_jobs 失败:', e);
                        job.jenkins_jobs = []; // 解析失败则设置为空数组
                    }
                } else {
                    job.jenkins_jobs = []; // 不是字符串也不是数组，设置为空数组
                }
            }
            return job;
        });

        jobTableBody.innerHTML = processedJobs.map(job => {
            // 处理多任务显示 - 使用jenkins_jobs中的项目名直接显示
            let jobDisplay = '';
            if (job.jenkins_jobs && Array.isArray(job.jenkins_jobs)) {
                if (job.jenkins_jobs.length === 1) {
                    // 单任务显示
                    jobDisplay = `<span class="job-label">${job.jenkins_jobs[0]}</span>`;
                } else {
                    // 多任务显示 - 最多显示4个标签（2行），超出时鼠标悬浮显示
                    const maxDisplay = 4;
                    const displayJobs = job.jenkins_jobs.slice(0, maxDisplay);
                    const remainingJobs = job.jenkins_jobs.slice(maxDisplay);
                    
                    const labels = displayJobs.map(name =>
                        `<span class="job-label">${name}</span>`
                    ).join('');
                    
                    let tooltipHtml = '';
                    if (remainingJobs.length > 0) {
                        tooltipHtml = `
                            <div class="job-tooltip">
                                ${remainingJobs.map(name => `<div>${name}</div>`).join('')}
                            </div>
                        `;
                    }
                    
                    jobDisplay = `
                        <div class="job-labels-container" ${remainingJobs.length > 0 ? 'data-tooltip="true"' : ''}>
                            ${labels}
                            ${remainingJobs.length > 0 ? `<span class="job-more-badge">+${remainingJobs.length}</span>` : ''}
                            <span class="job-count-badge">${job.jenkins_jobs.length}</span>
                            ${tooltipHtml}
                        </div>
                    `;
                }
            } else {
                // 回退到旧格式显示
                jobDisplay = job.jenkins_job_name || '未知任务';
            }
            
            return `
            <tr>
                <td>${job.name}</td>
                <td>${job.jenkins_config_name || '未知'}</td>
                <td>
                    <div class="job-names-display">
                        ${jobDisplay}
                    </div>
                </td>
                <td>${job.execute_once ? '一次性' : '周期性'}</td>
                <td>${job.execute_once ? formatDateTime(job.execute_time) : job.cron_expression}</td>
                <td>
                    <span class="status-badge status-${job.status}">${getStatusText(job.status)}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-info" onclick="executeJobNow(${job.id})">执行</button>
                        <button class="btn btn-secondary" onclick="openEditJobModal(${job.id})">编辑</button>
                        <button class="btn btn-danger" onclick="deleteJob(${job.id})">删除</button>
                        ${job.status === 'active' ?
                            `<button class="btn btn-warning" onclick="toggleJobStatus(${job.id}, 'inactive')">暂停</button>` :
                            `<button class="btn btn-success" onclick="toggleJobStatus(${job.id}, 'active')">启动</button>`}
                    </div>
                </td>
            </tr>
        `}).join('');
        
    } catch (error) {
        console.error('加载任务列表失败:', error);
        showNotification('加载任务列表失败: ' + error.message, 'error');
    }
}

function formatNextExecution(job) {
    if (job.execute_once && job.execute_time) {
        return formatDateTime(job.execute_time);
    } else if (job.cron_expression) {
        return job.cron_expression;
    }
    return '未设置';
}

function getStatusText(status) {
    const statusMap = {
        'active': '活跃',
        'inactive': '已暂停',
        'pending': '等待中',
        'completed': '已完成',
        'failed': '失败',
        'started': '已开始',
        'running': '运行中',
        'success': '成功',
        'error': '错误',
        'expired': '已过期'
    };
    return statusMap[status] || status;
}

async function deleteJob(jobId) {
    if (!confirm('确定要删除这个定时任务吗？')) return;
    
    try {
        await API.delete(`/api/scheduled-jobs/${jobId}`);
        showNotification('定时任务删除成功', 'success');
        loadJobList();
    } catch (error) {
        showNotification('删除失败: ' + error.message, 'error');
    }
}

function showJobDetail(jobId) {
    // 这里可以实现任务详情显示
    showNotification('任务详情功能开发中...', 'warning');
}

// 编辑任务功能（已废弃，使用模态框版本）
async function editJob(jobId) {
    openEditJobModal(jobId);
}

function refreshJobList() {
    loadJobList();
}

// 表单提交处理
function initForms() {
    // Jenkins配置表单（仅在元素存在时添加）
    const jenkinsConfigForm = document.getElementById('jenkins-config-form');
    if (jenkinsConfigForm) {
        jenkinsConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                await API.post('/api/jenkins-configs', data);
                showNotification('Jenkins配置添加成功', 'success');
                closeJenkinsModal();
                loadJenkinsConfigs();
            } catch (error) {
                showNotification('添加失败: ' + error.message, 'error');
            }
        });
    }
    
    // 设置执行类型切换功能
    setupExecutionTypeToggle();
    
    // Jenkins配置选择事件（仅在元素存在时添加）
    const jenkinsConfigSelect = document.getElementById('jenkins-config-select');
    const jenkinsJobSelect = document.getElementById('jenkins-job-select');
    
    if (jenkinsConfigSelect) {
        jenkinsConfigSelect.addEventListener('change', onJenkinsConfigChange);
    }
    if (jenkinsJobSelect) {
        jenkinsJobSelect.addEventListener('change', onJenkinsJobChange);
    }
    
    // Jenkins配置选择事件（模态框）
    const jenkinsConfigSelectModal = document.getElementById('jenkins-config-select-modal');
    const jenkinsJobSelectModal = document.getElementById('jenkins-job-select-modal');
    const editJenkinsConfigSelect = document.getElementById('edit-jenkins-config-select');
    const editJenkinsJobSelect = document.getElementById('edit-jenkins-job-select');
    
    if (jenkinsConfigSelectModal) {
        jenkinsConfigSelectModal.addEventListener('change', onJenkinsConfigChangeModal);
    }
    if (jenkinsJobSelectModal) {
        jenkinsJobSelectModal.addEventListener('change', onJenkinsJobChangeModal);
    }
    if (editJenkinsConfigSelect) {
        editJenkinsConfigSelect.addEventListener('change', onJenkinsConfigChangeModal);
    }
    if (editJenkinsJobSelect) {
        editJenkinsJobSelect.addEventListener('change', onJenkinsJobChangeModal);
    }
}

function resetForm() {
    document.getElementById('create-job-form').reset();
    document.getElementById('parameters-container').innerHTML = '';
    document.getElementById('jenkins-job-select').innerHTML = '<option value="">请先选择Jenkins配置</option>';
    
    // 重置编辑状态
    AppState.isEditMode = false;
    AppState.editingJobId = null;
    updateFormMode();
}



// 填充任务参数
function fillJobParameters(parameters) {
    Object.keys(parameters).forEach(key => {
        const input = document.querySelector(`[name="param_${key}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = parameters[key] === 'true' || parameters[key] === true;
            } else {
                input.value = parameters[key];
            }
        }
    });
}

// 填充任务参数（模态框）
function fillJobParametersModal(parameters) {
    Object.keys(parameters).forEach(key => {
        const input = document.querySelector(`#edit-job-form [name="param_${key}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = parameters[key] === 'true' || parameters[key] === true;
            } else {
                input.value = parameters[key];
            }
        }
    });
}

// 填充多任务独立参数（模态框）
function fillMultiJobParametersModal(jobParameters) {
    console.log('填充多任务独立参数:', jobParameters);
    
    // 遍历每个任务的参数
    Object.keys(jobParameters).forEach(jobName => {
        const parameters = jobParameters[jobName];
        if (parameters && typeof parameters === 'object') {
            Object.keys(parameters).forEach(paramKey => {
                // 查找对应任务的参数输入框 - 同时检查创建和编辑模态框
                const input = document.querySelector(`#edit-job-form [name="param_${paramKey}"][data-job-name="${jobName}"]`) ||
                              document.querySelector(`#create-job-form [name="param_${paramKey}"][data-job-name="${jobName}"]`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = parameters[paramKey] === 'true' || parameters[paramKey] === true;
                    } else {
                        input.value = parameters[paramKey];
                    }
                } else {
                    // 如果没有找到带任务名的输入框，尝试查找通用的输入框（向后兼容）
                    const genericInput = document.querySelector(`#edit-job-form [name="param_${paramKey}"]`) ||
                                         document.querySelector(`#create-job-form [name="param_${paramKey}"]`);
                    if (genericInput && !genericInput.hasAttribute('data-job-name')) {
                        if (genericInput.type === 'checkbox') {
                            genericInput.checked = parameters[paramKey] === 'true' || parameters[paramKey] === true;
                        } else {
                            genericInput.value = parameters[paramKey];
                        }
                    }
                }
            });
        }
    });
}

// 更新表单模式（创建/编辑）
function updateFormMode() {
    // 因为移除了创建任务标签页，这个函数可以简化或移除
    // 保留空函数以避免JavaScript错误
}

// 取消编辑
function cancelEdit() {
    // 因为移除了创建任务标签页，这个函数可以简化
    AppState.isEditMode = false;
    AppState.editingJobId = null;
    resetForm();
}

// 切换标签页
function switchToTab(tabName) {
    // 使用新的标签页切换机制
    const tabButton = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (tabButton) {
        tabButton.click();
    }
}

// 格式化日期时间为input[type="datetime-local"]格式
function formatDateTimeForInput(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// 工具函数
function formatDateTime(dateString) {
    if (!dateString) return '未设置';
    
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 模态框事件处理
function closeJobDetailModal() {
    document.getElementById('job-detail-modal').style.display = 'none';
}

// 点击模态框外部关闭
window.addEventListener('click', (event) => {
    const jenkinsModal = document.getElementById('jenkins-modal');
    const jobDetailModal = document.getElementById('job-detail-modal');
    
    if (event.target === jenkinsModal) {
        closeJenkinsModal();
    }
    if (event.target === jobDetailModal) {
        closeJobDetailModal();
    }
});

// 将需要在HTML中调用的函数添加到全局作用域
window.editJob = editJob;
window.cancelEdit = cancelEdit;
window.refreshJobList = refreshJobList;
window.resetForm = resetForm;
window.openJenkinsModal = openJenkinsModal;
window.closeJenkinsModal = closeJenkinsModal;
window.closeJobDetailModal = closeJobDetailModal;
window.showJobDetail = showJobDetail;
window.deleteJob = deleteJob;
window.testJenkinsConnection = testJenkinsConnection;
window.toggleJobStatus = toggleJobStatus;
window.executeJobNow = executeJobNow;

// 应用初始化
document.addEventListener('DOMContentLoaded', async function() {
    // console.log('Jenkins定时任务管理应用已启动');
    
    try {
        // 初始化表单
        initLoginForm();
        initInitForm();
        
        // 检查认证状态
        await AuthManager.checkAuth();
        
    } catch (error) {
        console.error('应用初始化失败:', error);
        showNotification('应用初始化失败: ' + error.message, 'error');
    }
});

// 初始化初始化表单
function initInitForm() {
    const initForm = document.getElementById('init-form');
    
    if (initForm) {
        initForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('init-username').value;
            const password = document.getElementById('init-password').value;
            const email = document.getElementById('init-email').value;
            
            // 禁用表单
            const submitBtn = initForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '初始化中...';
            
            try {
                await InitManager.setupSystem(username, password, email);
                // 初始化成功后自动登录
                await AuthManager.login(username, password);
            } catch (error) {
                // 重新启用表单
                submitBtn.disabled = false;
                submitBtn.textContent = '初始化系统';
            }
        });
    }
}

// 初始化登录表单
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // 禁用表单
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = '登录中...';
            
            await AuthManager.login(username, password);
            
            // 重新启用表单
            submitBtn.disabled = false;
            submitBtn.textContent = '登录';
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            AuthManager.logout();
        });
    }
}

// 初始化应用数据
async function initApp() {
    try {
        initTabs();
        initForms();
        initModalForms();
        
        // 初始化加载数据
        await Promise.all([
            loadDashboardData(),
            loadJenkinsConfigs(),
            loadJobList()
        ]);
        
        // console.log('应用初始化完成');
    } catch (error) {
        console.error('应用初始化失败:', error);
        showNotification('应用初始化失败: ' + error.message, 'error');
    }
}

async function init() {
    try {
        // 初始化表单 - 只调用initForms，initModalForms已经在initApp中调用
        initForms();
        
        // 初始化标签页
        initTabs();
        
        // 加载初始数据（控制台数据）
        await loadDashboardData();
        
        // 设置定时刷新
        setInterval(loadDashboardData, 30000); // 每30秒刷新一次控制台数据
        
        console.log('应用初始化完成');
    } catch (error) {
        console.error('应用初始化失败:', error);
        showNotification('应用初始化失败: ' + error.message, 'error');
    }
}

// 打开创建任务弹窗
function openCreateJobModal() {
    // 重置表单
    document.getElementById('create-job-form').reset();
    document.getElementById('parameters-container-modal').innerHTML = '';
    
    // 清空多任务选择
    selectedJobs.create.clear();
    updateSelectedJobsPreview();
    clearJobsList();
    
    // 重置参数状态
    AppState.jobParameters = [];
    JobParametersState.create.parameters = [];
    JobParametersState.create.currentValues = {};
    
    // 重置提交按钮状态
    const submitBtn = document.querySelector('#create-job-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '创建任务';
    }
    
    // 设置执行类型切换功能
    setupExecutionTypeToggleModal();
    
    // 加载Jenkins配置选项
    loadJenkinsConfigsForSelectModal();
    
    // 显示模态框
    document.getElementById('create-job-modal').style.display = 'block';
    
    console.log('创建任务模态框已打开，参数状态已重置');
}

// 关闭创建任务弹窗
function closeCreateJobModal() {
    document.getElementById('create-job-modal').style.display = 'none';
    
    // 清理创建任务模态框的状态
    selectedJobs.create.clear();
    AppState.jobParameters = [];
    JobParametersState.create.parameters = [];
    JobParametersState.create.currentValues = {};
    document.getElementById('parameters-container-modal').innerHTML = '';
    document.getElementById('create-job-form').reset();
    
    console.log('创建任务模态框已关闭，状态已清理');
}

// 关闭编辑任务弹窗
function closeEditJobModal() {
    document.getElementById('edit-job-modal').style.display = 'none';
    
    // 清理编辑任务模态框的状态
    selectedJobs.edit.clear();
    AppState.jobParameters = [];
    JobParametersState.edit.parameters = [];
    JobParametersState.edit.currentValues = {};
    document.getElementById('edit-parameters-container').innerHTML = '';
    document.getElementById('edit-job-form').reset();
    
    console.log('编辑任务模态框已关闭，状态已清理');
}

// 设置模态框中的执行类型切换功能
function setupExecutionTypeToggleModal() {
    const radios = document.querySelectorAll('#create-job-modal input[name="execution_type"], #edit-job-form input[name="execution_type"]');
    
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.closest('#create-job-modal')) {
                // 创建任务模态框
                const executeTimeGroupModal = document.getElementById('execute-time-group-modal');
                const cronExpressionGroupModal = document.getElementById('cron-expression-group-modal');
                
                if (radio.value === 'once') {
                    if (executeTimeGroupModal) executeTimeGroupModal.style.display = 'block';
                    if (cronExpressionGroupModal) cronExpressionGroupModal.style.display = 'none';
                } else {
                    if (executeTimeGroupModal) executeTimeGroupModal.style.display = 'none';
                    if (cronExpressionGroupModal) cronExpressionGroupModal.style.display = 'block';
                }
            } else if (radio.closest('#edit-job-form')) {
                // 编辑任务模态框
                const editExecuteTimeGroup = document.getElementById('edit-execute-time-group');
                const editCronExpressionGroup = document.getElementById('edit-cron-expression-group');
                
                if (radio.value === 'once') {
                    if (editExecuteTimeGroup) editExecuteTimeGroup.style.display = 'block';
                    if (editCronExpressionGroup) editCronExpressionGroup.style.display = 'none';
                } else {
                    if (editExecuteTimeGroup) editExecuteTimeGroup.style.display = 'none';
                    if (editCronExpressionGroup) editCronExpressionGroup.style.display = 'block';
                }
            }
        });
    });
}

// 为模态框加载Jenkins配置选项
async function loadJenkinsConfigsForSelectModal() {
    try {
        const configs = await API.get('/api/jenkins-configs');
        AppState.jenkinsConfigs = configs;
        
        const configSelectModal = document.getElementById('jenkins-config-select-modal');
        const editConfigSelect = document.getElementById('edit-jenkins-config-select');
        
        const options = configs.map(config => 
            `<option value="${config.id}">${config.name}</option>`
        ).join('');
        
        const defaultOption = '<option value="">请选择Jenkins配置</option>';
        
        if (configSelectModal) {
            configSelectModal.innerHTML = defaultOption + options;
        }
        
        if (editConfigSelect) {
            editConfigSelect.innerHTML = defaultOption + options;
        }
    } catch (error) {
        console.error('加载Jenkins配置失败:', error);
        showNotification('加载Jenkins配置失败: ' + error.message, 'error');
    }
}

// 模态框中Jenkins配置变化处理
async function onJenkinsConfigChangeModal(event) {
    const configId = event.target.value;
    
    if (!configId) {
        if (event.target.closest('#create-job-modal')) {
            clearJobsList();
        } else if (event.target.closest('#edit-job-form')) {
            // 编辑模式的处理保持不变
            const editJobsContainer = document.getElementById('edit-jobs-list-container');
            if (editJobsContainer) {
                editJobsContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📋</div>
                        <p>请先选择Jenkins配置</p>
                    </div>
                `;
            }
        }
        return;
    }
    
    try {
        let jobs = [];
        
        if (event.target.closest('#create-job-modal')) {
            // 创建任务模态框 - 加载多任务列表
            showJobsLoading();
            jobs = await API.get(`/api/jenkins/${configId}/jobs`);
            renderJobsList(jobs);
            // 绑定搜索功能
            bindSearchFunctionality(jobs);
        } else if (event.target.closest('#edit-job-form')) {
            // 编辑任务模态框 - 使用多任务选择器
            const editJobsContainer = document.getElementById('edit-jobs-list-container');
            if (editJobsContainer) {
                editJobsContainer.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <span>加载任务中...</span>
                    </div>
                `;
            }
            
            jobs = await API.get(`/api/jenkins/${configId}/jobs`);
            
            if (jobs.length === 0) {
                if (editJobsContainer) {
                    editJobsContainer.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">📭</div>
                            <p>该Jenkins实例没有任务</p>
                        </div>
                    `;
                }
                showNotification('该Jenkins实例没有找到任何任务', 'warning');
                return;
            }
            
            // 渲染任务列表到编辑模态框
            renderEditJobsList(jobs);
            // 绑定搜索功能
            bindEditSearchFunctionality(jobs);
        }
        
        console.log(`成功加载 ${jobs.length} 个Jenkins任务`);
    } catch (error) {
        console.error('加载Jenkins任务失败:', error);
        const errorMessage = `加载Jenkins任务失败: ${error.message}`;
        showNotification(errorMessage, 'error');
        
        if (event.target.closest('#create-job-modal')) {
            showJobsError();
        } else if (event.target.closest('#edit-job-form')) {
            const editJobSelect = document.getElementById('edit-jenkins-job-select');
            if (editJobSelect) {
                editJobSelect.innerHTML = '<option value="">加载失败</option>';
            }
        }
    }
}

// 多任务选择相关函数 - 为不同模态框分别存储
const selectedJobs = {
    create: new Set(),
    edit: new Set()
};

function showJobsLoading() {
    const container = document.getElementById('jobs-list-container');
    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <span>加载任务中...</span>
            </div>
        `;
    }
}

function showJobsError() {
    const container = document.getElementById('jobs-list-container');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <p>加载任务失败</p>
            </div>
        `;
    }
}

function clearJobsList() {
    const container = document.getElementById('jobs-list-container');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>请先选择Jenkins配置</p>
            </div>
        `;
    }
    selectedJobs.create.clear();
    updateSelectedJobsPreview('create');
}

function renderEditJobsList(jobs) {
    const container = document.getElementById('edit-jobs-list-container');
    if (!container) return;

    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>该Jenkins实例没有任务</p>
            </div>
        `;
        return;
    }

    const jobsHtml = jobs.map(job => {
        const isSelected = selectedJobs.edit.has(job.fullName);
        return `
            <div class="job-item ${isSelected ? 'selected' : ''}" data-job-name="${job.fullName}">
                <div class="job-checkbox" onclick="toggleJobSelection('${job.fullName}')"></div>
                <div class="job-info">
                    <div class="job-name">${job.displayName}</div>
                    <div class="job-details">
                        <span class="job-type">${job.type || '自由风格'}</span>
                        ${job.lastBuild ? `
                            <span class="last-build-status status-${job.lastBuild.status}">
                                ${getStatusText(job.lastBuild.status)}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = jobsHtml;
}

function bindEditSearchFunctionality(allJobs) {
    const searchInput = document.getElementById('edit-job-search-input');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.toLowerCase();
            if (!searchTerm) {
                renderEditJobsList(allJobs);
                return;
            }
            
            const filteredJobs = allJobs.filter(job =>
                job.displayName.toLowerCase().includes(searchTerm) ||
                job.fullName.toLowerCase().includes(searchTerm)
            );
            renderEditJobsList(filteredJobs);
        }, 300);
    });
}

function renderJobsList(jobs) {
    const container = document.getElementById('jobs-list-container');
    if (!container) return;

    if (jobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>该Jenkins实例没有任务</p>
            </div>
        `;
        return;
    }

    const jobsHtml = jobs.map(job => {
        const isSelected = selectedJobs.create.has(job.fullName);
        return `
            <div class="job-item ${isSelected ? 'selected' : ''}" data-job-name="${job.fullName}">
                <div class="job-checkbox" onclick="toggleJobSelection('${job.fullName}')"></div>
                <div class="job-info">
                    <div class="job-name">${job.displayName}</div>
                    <div class="job-details">
                        <span class="job-type">${job.type || '自由风格'}</span>
                        ${job.lastBuild ? `
                            <span class="last-build-status status-${job.lastBuild.status}">
                                ${getStatusText(job.lastBuild.status)}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = jobsHtml;
}

function bindSearchFunctionality(allJobs) {
    const searchInput = document.getElementById('job-search-input');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = e.target.value.toLowerCase();
            if (!searchTerm) {
                renderJobsList(allJobs);
                return;
            }
            
            const filteredJobs = allJobs.filter(job =>
                job.displayName.toLowerCase().includes(searchTerm) ||
                job.fullName.toLowerCase().includes(searchTerm)
            );
            renderJobsList(filteredJobs);
        }, 300);
    });
}

function toggleJobSelection(jobName) {
    // 确定当前模态框类型
    const modalType = document.getElementById('create-job-modal')?.style.display === 'block' ? 'create' : 'edit';
    
    if (selectedJobs[modalType].has(jobName)) {
        selectedJobs[modalType].delete(jobName);
    } else {
        selectedJobs[modalType].add(jobName);
    }
    
    updateSelectedJobsPreview(modalType);
    
    // 更新UI状态
    const jobItem = document.querySelector(`[data-job-name="${jobName}"]`);
    if (jobItem) {
        jobItem.classList.toggle('selected');
    }
    
    // 加载并显示选中任务的参数
    loadSelectedJobsParameters();
}

function updateSelectedJobsPreview(modalType = 'create') {
    const currentSelectedJobs = selectedJobs[modalType];
    
    if (modalType === 'create') {
        // 更新创建任务模态框的预览
        const countElement = document.getElementById('selected-job-count');
        const previewElement = document.getElementById('selected-jobs-preview');
        const tagsElement = document.getElementById('selected-tags');
        const hiddenInput = document.getElementById('selected-jobs-data');
        
        if (countElement) {
            countElement.textContent = currentSelectedJobs.size;
        }
        
        if (previewElement) {
            previewElement.style.display = currentSelectedJobs.size > 0 ? 'block' : 'none';
        }
        
        if (tagsElement) {
            const tagsHtml = Array.from(currentSelectedJobs).map(jobName => {
                const jobDisplayName = jobName.split('/').pop() || jobName;
                return `
                    <div class="selected-tag">
                        <span class="tag-name">${jobDisplayName}</span>
                        <button type="button" class="tag-remove" onclick="removeSelectedJob('${jobName}', 'create')">×</button>
                    </div>
                `;
            }).join('');
            tagsElement.innerHTML = tagsHtml;
        }
        
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify(Array.from(currentSelectedJobs));
        }
    } else if (modalType === 'edit') {
        // 更新编辑任务模态框的预览
        const editCountElement = document.getElementById('edit-selected-job-count');
        const editPreviewElement = document.getElementById('edit-selected-jobs-preview');
        const editTagsElement = document.getElementById('edit-selected-tags');
        const editHiddenInput = document.getElementById('edit-selected-jobs-data');
        
        if (editCountElement) {
            editCountElement.textContent = currentSelectedJobs.size;
        }
        
        if (editPreviewElement) {
            editPreviewElement.style.display = currentSelectedJobs.size > 0 ? 'block' : 'none';
        }
        
        if (editTagsElement) {
            const tagsHtml = Array.from(currentSelectedJobs).map(jobName => {
                const jobDisplayName = jobName.split('/').pop() || jobName;
                return `
                    <div class="selected-tag">
                        <span class="tag-name">${jobDisplayName}</span>
                        <button type="button" class="tag-remove" onclick="removeSelectedJob('${jobName}', 'edit')">×</button>
                    </div>
                `;
            }).join('');
            editTagsElement.innerHTML = tagsHtml;
        }
        
        if (editHiddenInput) {
            editHiddenInput.value = JSON.stringify(Array.from(currentSelectedJobs));
        }
    }
}

function removeSelectedJob(jobName, modalType = 'create') {
    selectedJobs[modalType].delete(jobName);
    updateSelectedJobsPreview(modalType);
    
    // 更新任务列表中的选中状态
    const jobItem = document.querySelector(`[data-job-name="${jobName}"]`);
    if (jobItem) {
        jobItem.classList.remove('selected');
    }
    
    // 从参数状态中移除该任务的参数
    if (AppState.jobParameters) {
        AppState.jobParameters = AppState.jobParameters.filter(param => param._jobName !== jobName);
    }
    
    // 重新加载参数
    loadSelectedJobsParameters();
}

function clearSelectedJobs(modalType = 'create') {
    selectedJobs[modalType].clear();
    updateSelectedJobsPreview(modalType);
    
    // 清除所有任务项的选中状态
    document.querySelectorAll('.job-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 清空参数状态
    AppState.jobParameters = [];
    JobParametersState[modalType].parameters = [];
    JobParametersState[modalType].currentValues = {};
    
    // 清除创建任务模态框的参数显示
    const parametersContainerModal = document.getElementById('parameters-container-modal');
    if (parametersContainerModal) {
        parametersContainerModal.innerHTML = '<p class="no-parameters">请选择至少一个Jenkins任务</p>';
    }
    
    // 清除编辑任务模态框的参数显示
    const editParametersContainer = document.getElementById('edit-parameters-container');
    if (editParametersContainer) {
        editParametersContainer.innerHTML = '<p class="no-parameters">请选择至少一个Jenkins任务</p>';
    }
}

// 加载并显示选中任务的参数 - 增量渲染版本
async function loadSelectedJobsParameters() {
    // 检查当前是创建任务模态框还是编辑任务模态框
    const createConfigSelect = document.getElementById('jenkins-config-select-modal');
    const createParametersContainer = document.getElementById('parameters-container-modal');
    const editConfigSelect = document.getElementById('edit-jenkins-config-select');
    const editParametersContainer = document.getElementById('edit-parameters-container');
    
    let configSelect, parametersContainer;
    let isEditMode = false;
    let modalType = 'create';
    
    // 优先检查当前活动的模态框
    const createModal = document.getElementById('create-job-modal');
    const editModal = document.getElementById('edit-job-modal');
    
    if (editModal && editModal.style.display === 'block' && editConfigSelect && editParametersContainer) {
        // 编辑任务模态框是活动的
        configSelect = editConfigSelect;
        parametersContainer = editParametersContainer;
        isEditMode = true;
        modalType = 'edit';
        console.log('检测到编辑任务模态框活动');
    } else if (createModal && createModal.style.display === 'block' && createConfigSelect && createParametersContainer) {
        // 创建任务模态框是活动的
        configSelect = createConfigSelect;
        parametersContainer = createParametersContainer;
        isEditMode = false;
        modalType = 'create';
        console.log('检测到创建任务模态框活动');
    } else {
        // 如果没有活动的模态框，默认使用创建任务模态框
        if (createConfigSelect && createParametersContainer) {
            configSelect = createConfigSelect;
            parametersContainer = createParametersContainer;
            isEditMode = false;
            modalType = 'create';
            console.log('默认使用创建任务模态框');
        } else if (editConfigSelect && editParametersContainer) {
            configSelect = editConfigSelect;
            parametersContainer = editParametersContainer;
            isEditMode = true;
            modalType = 'edit';
            console.log('默认使用编辑任务模态框');
        } else {
            console.log('没有找到可用的模态框元素');
            return;
        }
    }
    
    const configId = configSelect.value;
    if (!configId) {
        parametersContainer.innerHTML = '<p class="no-parameters">请先选择Jenkins配置</p>';
        return;
    }
    
    const currentSelectedJobs = selectedJobs[modalType];
    if (currentSelectedJobs.size === 0) {
        parametersContainer.innerHTML = '<p class="no-parameters">请选择至少一个Jenkins任务</p>';
        return;
    }
    
    console.log(`增量加载参数 - 模态框: ${isEditMode ? '编辑' : '创建'}, 配置ID: ${configId}, 选中任务数: ${currentSelectedJobs.size}`);
    
    try {
        // 保存当前用户填写的参数值
        const currentParameters = collectCurrentParameters();
        
        // 检测新增和删除的任务
        const stateKey = modalType;
        const existingJobNames = new Set(JobParametersState[stateKey].parameters.map(p => p._jobName));
        const currentJobNames = new Set(Array.from(currentSelectedJobs));
        
        const newJobs = Array.from(currentJobNames).filter(jobName => !existingJobNames.has(jobName));
        const removedJobs = Array.from(existingJobNames).filter(jobName => !currentJobNames.has(jobName));
        
        console.log(`增量检测 - 新增任务: ${newJobs.length}, 删除任务: ${removedJobs.length}`);
        
        // 处理删除的任务 - 从状态中移除
        if (removedJobs.length > 0) {
            JobParametersState[stateKey].parameters = JobParametersState[stateKey].parameters.filter(
                param => !removedJobs.includes(param._jobName)
            );
            // 从DOM中移除删除的任务参数
            removedJobs.forEach(jobName => {
                const jobGroup = parametersContainer.querySelector(`[data-job-group="${jobName}"]`);
                if (jobGroup) {
                    jobGroup.remove();
                }
            });
        }
        
        // 如果有新增任务，只加载新增任务的参数
        if (newJobs.length > 0) {
            // 显示增量加载状态
            const loadingHtml = `
                <div class="loading-state incremental">
                    <div class="spinner"></div>
                    <span>加载新增任务参数中... (${newJobs.length} 个任务)</span>
                </div>
            `;
            
            // 如果已有参数，追加加载状态；否则显示完整加载状态
            if (JobParametersState[stateKey].parameters.length > 0) {
                const existingLoading = parametersContainer.querySelector('.loading-state.incremental');
                if (!existingLoading) {
                    parametersContainer.insertAdjacentHTML('beforeend', loadingHtml);
                }
            } else {
                parametersContainer.innerHTML = loadingHtml;
            }
            
            // 为新增任务加载参数
            const newParameters = [];
            for (const jobName of newJobs) {
                try {
                    // 使用任务名称获取参数（后端会处理URL构建）
                    const parameters = await API.get(`/api/jenkins/${configId}/jobs/${encodeURIComponent(jobName)}/parameters`);
                    if (parameters && parameters.length > 0) {
                        // 为参数添加任务标识
                        const jobParameters = parameters.map(param => ({
                            ...param,
                            _jobName: jobName,
                            _jobDisplayName: jobName.split('/').pop() || jobName
                        }));
                        newParameters.push(...jobParameters);
                    }
                } catch (error) {
                    console.error(`加载任务 ${jobName} 的参数失败:`, error);
                    // 单个任务参数加载失败不影响其他任务
                    // 可以在这里添加错误提示，但不要阻止其他任务加载
                }
            }
            
            // 更新状态
            JobParametersState[stateKey].parameters = [...JobParametersState[stateKey].parameters, ...newParameters];
            
            // 移除加载状态
            const loadingElement = parametersContainer.querySelector('.loading-state.incremental');
            if (loadingElement) {
                loadingElement.remove();
            }
            
            // 渲染新增任务的参数
            if (newParameters.length > 0) {
                if (modalType === 'edit') {
                    renderIncrementalJobParametersEditModal(newParameters);
                } else {
                    renderIncrementalJobParametersModal(newParameters);
                }
            }
        }
        
        // 如果没有新增任务也没有删除任务，只是参数值变化，直接恢复参数值
        if (newJobs.length === 0 && removedJobs.length === 0) {
            restoreParameters(currentParameters);
        }
        
        console.log(`增量加载完成 - 总参数数: ${JobParametersState[stateKey].parameters.length}, 模态框: ${modalType}`);
        
        // 如果没有参数，显示提示
        if (JobParametersState[stateKey].parameters.length === 0) {
            parametersContainer.innerHTML = '<p class="no-parameters">选中的任务都没有参数</p>';
        }
        
    } catch (error) {
        console.error('增量加载任务参数失败:', error);
        parametersContainer.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <p>加载任务参数失败: ${error.message}</p>
                <small>请检查Jenkins配置和网络连接</small>
            </div>
        `;
    }
}

// 收集当前用户填写的参数值
function collectCurrentParameters() {
    const currentParams = {};
    
    // 检测当前活动的模态框
    const createModal = document.getElementById('create-job-modal');
    const editModal = document.getElementById('edit-job-modal');
    
    let paramsContainer;
    if (editModal && editModal.style.display === 'block') {
        paramsContainer = document.getElementById('edit-parameters-container');
    } else if (createModal && createModal.style.display === 'block') {
        paramsContainer = document.getElementById('parameters-container-modal');
    }
    
    if (paramsContainer) {
        const inputs = paramsContainer.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name && input.name.startsWith('param_')) {
                const paramName = input.name.replace('param_', '');
                if (input.type === 'checkbox') {
                    currentParams[paramName] = input.checked;
                } else {
                    currentParams[paramName] = input.value;
                }
            }
        });
    }
    
    return currentParams;
}

// 恢复用户填写的参数值
function restoreParameters(savedParameters) {
    // 检测当前活动的模态框
    const createModal = document.getElementById('create-job-modal');
    const editModal = document.getElementById('edit-job-modal');
    
    let paramsContainer;
    if (editModal && editModal.style.display === 'block') {
        paramsContainer = document.getElementById('edit-parameters-container');
    } else if (createModal && createModal.style.display === 'block') {
        paramsContainer = document.getElementById('parameters-container-modal');
    }
    
    if (paramsContainer) {
        const inputs = paramsContainer.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name && input.name.startsWith('param_')) {
                const paramName = input.name.replace('param_', '');
                if (savedParameters[paramName] !== undefined) {
                    if (input.type === 'checkbox') {
                        input.checked = savedParameters[paramName];
                    } else {
                        input.value = savedParameters[paramName];
                    }
                }
            }
        });
    }
}

// 渲染编辑任务模态框中的多任务参数
function renderMultiJobParametersEditModal(parameters) {
    const container = document.getElementById('edit-parameters-container');
    
    // 按任务分组参数
    const parametersByJob = {};
    parameters.forEach(param => {
        if (!parametersByJob[param._jobName]) {
            parametersByJob[param._jobName] = [];
        }
        parametersByJob[param._jobName].push(param);
    });
    
    const html = Object.entries(parametersByJob).map(([jobName, jobParams]) => {
        const jobDisplayName = jobName.split('/').pop() || jobName;
        const jobParamsHtml = jobParams.map(param => {
            switch (param._class) {
                case 'hudson.model.StringParameterDefinition':
                case 'hudson.model.TextParameterDefinition':
                    return renderStringParameterModal(param);
                case 'hudson.model.ChoiceParameterDefinition':
                    return renderChoiceParameterModal(param);
                case 'hudson.model.BooleanParameterDefinition':
                    return renderBooleanParameterModal(param);
                case 'net.uaznia.lukanus.hudson.plugins.gitparameter.GitParameterDefinition':
                    return renderGitParameterModal(param);
                default:
                    return renderStringParameterModal(param);
            }
        }).join('');
        
        return `
            <div class="job-parameters-group" data-job-group="${jobName}">
                <div class="job-parameters-header">
                    <h4>${jobDisplayName}</h4>
                </div>
                <div class="job-parameters-content">
                    ${jobParamsHtml}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="job-parameters-container">
            ${html}
        </div>
    `;
}

// 增量渲染编辑任务模态框中的参数
function renderIncrementalJobParametersEditModal(parameters) {
    const container = document.getElementById('edit-parameters-container');
    if (!container) return;
    
    // 按任务分组参数
    const parametersByJob = {};
    parameters.forEach(param => {
        if (!parametersByJob[param._jobName]) {
            parametersByJob[param._jobName] = [];
        }
        parametersByJob[param._jobName].push(param);
    });
    
    // 为每个新增任务创建参数组并追加到容器
    Object.entries(parametersByJob).forEach(([jobName, jobParams]) => {
        const jobDisplayName = jobName.split('/').pop() || jobName;
        const jobParamsHtml = jobParams.map(param => {
            switch (param._class) {
                case 'hudson.model.StringParameterDefinition':
                case 'hudson.model.TextParameterDefinition':
                    return renderStringParameterModal(param);
                case 'hudson.model.ChoiceParameterDefinition':
                    return renderChoiceParameterModal(param);
                case 'hudson.model.BooleanParameterDefinition':
                    return renderBooleanParameterModal(param);
                case 'net.uaznia.lukanus.hudson.plugins.gitparameter.GitParameterDefinition':
                    return renderGitParameterModal(param);
                default:
                    return renderStringParameterModal(param);
            }
        }).join('');
        
        const jobGroupHtml = `
            <div class="job-parameters-group" data-job-group="${jobName}">
                <div class="job-parameters-header">
                    <h4>${jobDisplayName}</h4>
                </div>
                <div class="job-parameters-content">
                    ${jobParamsHtml}
                </div>
            </div>
        `;
        
        // 追加到容器末尾
        container.insertAdjacentHTML('beforeend', jobGroupHtml);
    });
    
    console.log(`增量渲染完成 - 新增 ${parameters.length} 个参数`);
}

// 渲染多任务的参数
function renderMultiJobParametersModal(parameters) {
    const container = document.getElementById('parameters-container-modal');
    
    // 按任务分组参数
    const parametersByJob = {};
    parameters.forEach(param => {
        if (!parametersByJob[param._jobName]) {
            parametersByJob[param._jobName] = [];
        }
        parametersByJob[param._jobName].push(param);
    });
    
    const html = Object.entries(parametersByJob).map(([jobName, jobParams]) => {
        const jobDisplayName = jobName.split('/').pop() || jobName;
        const jobParamsHtml = jobParams.map(param => {
            switch (param._class) {
                case 'hudson.model.StringParameterDefinition':
                case 'hudson.model.TextParameterDefinition':
                    return renderStringParameterModal(param);
                case 'hudson.model.ChoiceParameterDefinition':
                    return renderChoiceParameterModal(param);
                case 'hudson.model.BooleanParameterDefinition':
                    return renderBooleanParameterModal(param);
                case 'net.uaznia.lukanus.hudson.plugins.gitparameter.GitParameterDefinition':
                    return renderGitParameterModal(param);
                default:
                    return renderStringParameterModal(param);
            }
        }).join('');
        
        return `
            <div class="job-parameters-group" data-job-group="${jobName}">
                <div class="job-parameters-header">
                    <h4>${jobDisplayName}</h4>
                </div>
                <div class="job-parameters-content">
                    ${jobParamsHtml}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="job-parameters-container">
            ${html}
        </div>
    `;
}

// 增量渲染多任务的参数
function renderIncrementalJobParametersModal(parameters) {
    const container = document.getElementById('parameters-container-modal');
    if (!container) return;
    
    // 按任务分组参数
    const parametersByJob = {};
    parameters.forEach(param => {
        if (!parametersByJob[param._jobName]) {
            parametersByJob[param._jobName] = [];
        }
        parametersByJob[param._jobName].push(param);
    });
    
    // 为每个新增任务创建参数组并追加到容器
    Object.entries(parametersByJob).forEach(([jobName, jobParams]) => {
        const jobDisplayName = jobName.split('/').pop() || jobName;
        const jobParamsHtml = jobParams.map(param => {
            switch (param._class) {
                case 'hudson.model.StringParameterDefinition':
                case 'hudson.model.TextParameterDefinition':
                    return renderStringParameterModal(param);
                case 'hudson.model.ChoiceParameterDefinition':
                    return renderChoiceParameterModal(param);
                case 'hudson.model.BooleanParameterDefinition':
                    return renderBooleanParameterModal(param);
                case 'net.uaznia.lukanus.hudson.plugins.gitparameter.GitParameterDefinition':
                    return renderGitParameterModal(param);
                default:
                    return renderStringParameterModal(param);
            }
        }).join('');
        
        const jobGroupHtml = `
            <div class="job-parameters-group" data-job-group="${jobName}">
                <div class="job-parameters-header">
                    <h4>${jobDisplayName}</h4>
                </div>
                <div class="job-parameters-content">
                    ${jobParamsHtml}
                </div>
            </div>
        `;
        
        // 追加到容器末尾
        container.insertAdjacentHTML('beforeend', jobGroupHtml);
    });
    
    console.log(`增量渲染完成 - 新增 ${parameters.length} 个参数`);
}

// 模态框中Jenkins任务变化处理
async function onJenkinsJobChangeModal(event) {
    const jobName = event.target.value;
    const configSelectModal = document.getElementById('jenkins-config-select-modal');
    const editConfigSelect = document.getElementById('edit-jenkins-config-select');
    const parametersContainerModal = document.getElementById('parameters-container-modal');
    const editParametersContainer = document.getElementById('edit-parameters-container');
    
    if (!jobName) {
        if (event.target.closest('#create-job-modal') && parametersContainerModal) {
            parametersContainerModal.innerHTML = '';
        } else if (event.target.closest('#edit-job-form') && editParametersContainer) {
            editParametersContainer.innerHTML = '';
        }
        return;
    }
    
    try {
        const configId = event.target.closest('#create-job-modal') ? 
            configSelectModal.value : editConfigSelect.value;
            
        // 验证配置ID是否存在
        if (!configId) {
            throw new Error('请先选择Jenkins配置');
        }
        
        const parameters = await API.get(`/api/jenkins/${configId}/jobs/${encodeURIComponent(jobName)}/parameters`);
        AppState.jobParameters = parameters;
        
        if (event.target.closest('#create-job-modal') && parametersContainerModal) {
            renderJobParametersModal(parameters);
        } else if (event.target.closest('#edit-job-form') && editParametersContainer) {
            renderJobParametersEditModal(parameters);
        }
    } catch (error) {
        console.error('加载任务参数失败:', error);
        showNotification('加载任务参数失败: ' + error.message, 'error');
    }
}

// 渲染模态框中的任务参数
function renderJobParametersModal(parameters) {
    const container = document.getElementById('parameters-container-modal');
    
    if (parameters.length === 0) {
        container.innerHTML = '<p class="no-parameters">该任务没有参数</p>';
        return;
    }
    
    container.innerHTML = parameters.map(param => {
        switch (param._class) {
            case 'hudson.model.StringParameterDefinition':
            case 'hudson.model.TextParameterDefinition':
                return renderStringParameterModal(param);
            case 'hudson.model.ChoiceParameterDefinition':
                return renderChoiceParameterModal(param);
            case 'hudson.model.BooleanParameterDefinition':
                return renderBooleanParameterModal(param);
            case 'net.uaznia.lukanus.hudson.plugins.gitparameter.GitParameterDefinition':
                return renderGitParameterModal(param);
            default:
                return renderGenericParameterModal(param);
        }
    }).join('');
}

// 渲染编辑任务模态框中的参数
function renderJobParametersEditModal(parameters) {
    const container = document.getElementById('edit-parameters-container');
    if (!container) return;
    
    if (!parameters || parameters.length === 0) {
        container.innerHTML = '<p class="no-parameters">该任务无需参数</p>';
        return;
    }
    
    container.innerHTML = parameters.map(param => {
        switch (param._class) {
            case 'hudson.model.StringParameterDefinition':
            case 'hudson.model.TextParameterDefinition':
                return renderStringParameterModal(param);
            case 'hudson.model.ChoiceParameterDefinition':
                return renderChoiceParameterModal(param);
            case 'hudson.model.BooleanParameterDefinition':
                return renderBooleanParameterModal(param);
            case 'net.uaznia.lukanus.hudson.plugins.gitparameter.GitParameterDefinition':
                return renderGitParameterModal(param);
            default:
                return renderGenericParameterModal(param);
        }
    }).join('');
}

// 渲染模态框中的字符串参数
function renderStringParameterModal(param) {
    const jobNameAttr = param._jobName ? `data-job-name="${param._jobName}"` : '';
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <input type="text" name="param_${param.name}" value="${param.defaultParameterValue?.value || ''}" 
                   placeholder="请输入${param.name}" ${jobNameAttr}>
        </div>
    `;
}

// 渲染模态框中的选择参数
function renderChoiceParameterModal(param) {
    const choices = param.choices || [];
    const jobNameAttr = param._jobName ? `data-job-name="${param._jobName}"` : '';
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <select name="param_${param.name}" ${jobNameAttr}>
                ${choices.map(choice => `
                    <option value="${choice}" ${choice === param.defaultParameterValue?.value ? 'selected' : ''}>
                        ${choice}
                    </option>
                `).join('')}
            </select>
        </div>
    `;
}

// 渲染模态框中的布尔参数
function renderBooleanParameterModal(param) {
    const defaultValue = param.defaultParameterValue?.value || false;
    const jobNameAttr = param._jobName ? `data-job-name="${param._jobName}"` : '';
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <label class="radio-label">
                <input type="checkbox" name="param_${param.name}" ${defaultValue ? 'checked' : ''} ${jobNameAttr}>
                启用
            </label>
        </div>
    `;
}

// 渲染模态框中的Git参数
function renderGitParameterModal(param) {
    const branches = param.allValueItems?.values || [];
    const jobNameAttr = param._jobName ? `data-job-name="${param._jobName}"` : '';
    return `
        <div class="parameter-item">
            <h4>${param.name} (Git分支)</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <select name="param_${param.name}" ${jobNameAttr}>
                ${branches.map(branch => `
                    <option value="${branch.value}" ${branch.value === param.defaultParameterValue?.value ? 'selected' : ''}>
                        ${branch.name}
                    </option>
                `).join('')}
            </select>
            <small class="form-help">支持分支过滤: ${param.branchFilter || 'origin/(.*)'}</small>
        </div>
    `;
}

// 渲染模态框中的通用参数
function renderGenericParameterModal(param) {
    const jobNameAttr = param._jobName ? `data-job-name="${param._jobName}"` : '';
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <input type="text" name="param_${param.name}" value="${param.defaultParameterValue?.value || ''}" 
                   placeholder="请输入${param.name}" ${jobNameAttr}>
            <small class="form-help">参数类型: ${param._class}</small>
        </div>
    `;
}

// 初始化模态框表单事件
function initModalForms() {
    // 创建任务表单（仅在元素存在时添加）
    const createJobForm = document.getElementById('create-job-form');
    if (createJobForm) {
        createJobForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            // 防抖机制：如果按钮已禁用，说明正在提交中，直接返回
            if (submitBtn.disabled) {
                return;
            }
            
            // 禁用提交按钮，防止重复提交
            submitBtn.disabled = true;
            submitBtn.textContent = '创建中...';
            
            const formData = new FormData(e.target);
            console.log('FormData:', Array.from(formData.entries()));
            const data = Object.fromEntries(formData);
            
            // 表单验证
            if (!data.name || !data.name.trim()) {
                showNotification('请输入任务名称', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '创建任务';
                return;
            }
        
        if (!data.jenkins_config_id) {
            showNotification('请选择Jenkins配置', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '创建任务';
            return;
        }
        
        // 验证多任务选择
        const selectedJobsData = document.getElementById('selected-jobs-data');
        if (!selectedJobsData || !selectedJobsData.value) {
            showNotification('请选择至少一个Jenkins任务', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '创建任务';
            return;
        }
        
        // 解析选中的任务
        try {
            const selectedJobs = JSON.parse(selectedJobsData.value);
            if (!Array.isArray(selectedJobs) || selectedJobs.length === 0) {
                showNotification('请选择至少一个Jenkins任务', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '创建任务';
                return;
            }
            data.jenkins_jobs = selectedJobs;
        } catch (error) {
            showNotification('任务数据格式错误', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '创建任务';
            return;
        }
        
        // 验证执行方式
        if (data.execution_type === 'once' && !data.execute_time) {
            showNotification('请设置执行时间', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '创建任务';
            return;
        }
        
        if (data.execution_type === 'recurring' && !data.cron_expression) {
            showNotification('请输入Cron表达式', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '创建任务';
            return;
        }
        
        // 处理执行方式
        data.execute_once = data.execution_type === 'once';
        delete data.execution_type;
        
        // 合并 jenkins_jobs 和 job_parameters - 创建统一的任务配置对象
        const jobConfigs = {};
        const jobParameters = {};
        const jobNames = [];
        
        data.jenkins_jobs.forEach(jobName => {
            jobNames.push(jobName);
            jobParameters[jobName] = {};
            
            // 收集该任务的参数 - 使用 data-job-name 属性来精确匹配
            const jobInputs = document.querySelectorAll(`[data-job-name="${jobName}"]`);
            jobInputs.forEach(input => {
                if (input.name && input.name.startsWith('param_')) {
                    const paramName = input.name.replace('param_', '');
                    let value;
                    
                    if (input.type === 'checkbox') {
                        value = input.checked;
                    } else if (input.type === 'select-one') {
                        value = input.value;
                    } else {
                        value = input.value;
                    }
                    
                    // 如果参数存在且不为空，才保存
                    if (value !== null && value !== undefined && value !== '') {
                        jobParameters[jobName][paramName] = value;
                    }
                }
            });
        });
        
        // 使用统一的任务配置对象
        data.job_configs = jobParameters;
        // 清空冗余的 jenkins_jobs 字段，因为任务名可以从 job_configs 中提取
        delete data.jenkins_jobs;
        // 对于多任务模式，清空单任务参数字段，避免冲突
        delete data.param_BRANCH;
        delete data.param_environment;
        delete data.param_Deploy_to;
        // 完全移除冗余的 parameters 字段，只使用 job_configs
        delete data.parameters;
        
        try {
            await API.post('/api/scheduled-jobs', data);
            showNotification('定时任务创建成功', 'success');
            closeCreateJobModal();
            loadJobList(); // 刷新任务列表
        } catch (error) {
            showNotification('创建失败: ' + error.message, 'error');
        } finally {
            // 无论成功或失败，都重新启用提交按钮
            submitBtn.disabled = false;
            submitBtn.textContent = '创建任务';
        }
        });
    }
    
    // 编辑任务表单（仅在元素存在时添加）
    const editJobForm = document.getElementById('edit-job-form');
    if (editJobForm) {
        editJobForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            // 防抖机制：如果按钮已禁用，说明正在提交中，直接返回
            if (submitBtn.disabled) {
                return;
            }
            
            // 禁用提交按钮，防止重复提交
            submitBtn.disabled = true;
            submitBtn.textContent = '更新中...';
            
            const formData = new FormData(e.target);
            const jobId = formData.get('id');
            const data = Object.fromEntries(formData);
            
            console.log('编辑任务表单数据:', data);
            console.log('选中的任务:', Array.from(selectedJobs.edit));
            
            // 表单验证
            if (!data.name || !data.name.trim()) {
                showNotification('请输入任务名称', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '更新任务';
                return;
            }
        
        if (!data.jenkins_config_id) {
            showNotification('请选择Jenkins配置', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '更新任务';
            return;
        }
        
        // 任务验证：统一使用多任务模式
        const isMultiJobMode = selectedJobs.edit.size > 0;
        
        // 检查是否有选中的任务
        if (!isMultiJobMode) {
            showNotification('请选择至少一个Jenkins任务', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '更新任务';
            return;
        }
        
        // 验证执行方式
        if (data.execution_type === 'once' && !data.execute_time) {
            showNotification('请设置执行时间', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '更新任务';
            return;
        }
        
        if (data.execution_type === 'recurring' && !data.cron_expression) {
            showNotification('请输入Cron表达式', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '更新任务';
            return;
        }
        
        // 处理执行方式
        data.execute_once = data.execution_type === 'once';
        delete data.execution_type;
        delete data.id;
        
        // 统一使用多任务模式处理（单任务就是只有一个任务的多任务）
        data.jenkins_jobs = Array.from(selectedJobs.edit);
        // 清空单任务字段，确保后端正确处理
        data.jenkins_job_name = '';
        
        // 合并 jenkins_jobs 和 job_parameters - 创建统一的任务配置对象
        const jobParameters = {};
        selectedJobs.edit.forEach(jobName => {
            jobParameters[jobName] = {};
            
            // 收集该任务的参数 - 使用 data-job-name 属性来精确匹配
            const jobInputs = document.querySelectorAll(`[data-job-name="${jobName}"]`);
            jobInputs.forEach(input => {
                if (input.name && input.name.startsWith('param_')) {
                    const paramName = input.name.replace('param_', '');
                    let value;
                    
                    if (input.type === 'checkbox') {
                        value = input.checked;
                    } else if (input.type === 'select-one') {
                        value = input.value;
                    } else {
                        value = input.value;
                    }
                    
                    // 如果参数存在且不为空，才保存
                    if (value !== null && value !== undefined && value !== '') {
                        jobParameters[jobName][paramName] = value;
                    }
                }
            });
        });
        
        // 使用统一的任务配置对象
        data.job_configs = jobParameters;
        // 清空冗余的 jenkins_jobs 字段，因为任务名可以从 job_configs 中提取
        delete data.jenkins_jobs;
        // 清空单任务参数字段，避免冲突
        delete data.param_BRANCH;
        delete data.param_environment;
        delete data.param_Deploy_to;
        // 完全移除冗余的 parameters 字段，只使用 job_configs
        delete data.parameters;
        
        try {
            console.log('发送更新请求:', data);
            const response = await API.put(`/api/scheduled-jobs/${jobId}`, data);
            console.log('更新响应:', response);
            showNotification('定时任务更新成功', 'success');
            closeEditJobModal();
            loadJobList(); // 刷新任务列表
        } catch (error) {
            console.error('更新任务失败:', error);
            showNotification('更新失败: ' + error.message, 'error');
        } finally {
            // 无论成功或失败，都重新启用提交按钮
            submitBtn.disabled = false;
            submitBtn.textContent = '更新任务';
        }
        });
    }
    
    // 为模态框中的选择器添加事件监听器（仅在元素存在时添加）
    const jenkinsConfigSelectModal = document.getElementById('jenkins-config-select-modal');
    const jenkinsJobSelectModal = document.getElementById('jenkins-job-select-modal');
    const editJenkinsConfigSelect = document.getElementById('edit-jenkins-config-select');
    const editJenkinsJobSelect = document.getElementById('edit-jenkins-job-select');
    
    if (jenkinsConfigSelectModal) {
        jenkinsConfigSelectModal.addEventListener('change', onJenkinsConfigChangeModal);
    }
    if (jenkinsJobSelectModal) {
        jenkinsJobSelectModal.addEventListener('change', onJenkinsJobChangeModal);
    }
    if (editJenkinsConfigSelect) {
        editJenkinsConfigSelect.addEventListener('change', onJenkinsConfigChangeModal);
    }
    if (editJenkinsJobSelect) {
        editJenkinsJobSelect.addEventListener('change', onJenkinsJobChangeModal);
    }
}

// 打开编辑任务弹窗
async function openEditJobModal(jobId) {
    try {
        // 重置编辑任务模态框的状态
        JobParametersState.edit.parameters = [];
        JobParametersState.edit.currentValues = {};
        selectedJobs.edit.clear();
        
        // 获取任务详情
        const job = await API.get(`/api/scheduled-jobs/${jobId}`);
        
        // 填充表单数据
        const editJobIdInput = document.getElementById('edit-job-id');
        const editJobNameInput = document.getElementById('edit-job-name');
        
        if (editJobIdInput) editJobIdInput.value = job.id;
        if (editJobNameInput) editJobNameInput.value = job.name;
        
        // 设置执行类型切换功能
        setupExecutionTypeToggleModal();
        
        // 加载Jenkins配置选项
        await loadJenkinsConfigsForSelectModal();
        
        // 设置Jenkins配置
        const configSelect = document.getElementById('edit-jenkins-config-select');
        if (configSelect) configSelect.value = job.jenkins_config_id;
        
        // 触发配置变化事件以加载任务列表
        if (configSelect) await onJenkinsConfigChangeModal({ target: configSelect });
        
        // 设置Jenkins任务 - 支持多任务回显
        setTimeout(async () => {
            // 检查是否是多任务
            if (job.jenkins_jobs && job.jenkins_jobs.length > 0) {
                // 多任务模式 - 后端已经处理过转义符，直接使用即可
                const jobNames = Array.isArray(job.jenkins_jobs) ? job.jenkins_jobs : [];
                
                // 清空并设置选中的任务
                selectedJobs.edit.clear();
                
                // 对于编辑模式，优先使用parameters字段中的完整路径
                if (job.parameters) {
                    try {
                        const parameters = typeof job.parameters === 'string' ? JSON.parse(job.parameters) : job.parameters;
                        const fullJobPaths = Object.keys(parameters);
                        
                        // 使用完整路径设置选中的任务
                        fullJobPaths.forEach(fullPath => {
                            selectedJobs.edit.add(fullPath);
                        });
                    } catch (error) {
                        console.error('解析现有任务参数失败:', error);
                        // 回退到使用项目名
                        jobNames.forEach(jobName => {
                            selectedJobs.edit.add(jobName);
                        });
                    }
                } else {
                    // 如果没有parameters，使用项目名
                    jobNames.forEach(jobName => {
                        selectedJobs.edit.add(jobName);
                    });
                }
                
                // 更新UI显示
                updateSelectedJobsPreview('edit');
                
                // 更新任务列表中的选中状态
                document.querySelectorAll('.job-item').forEach(item => {
                    const jobName = item.getAttribute('data-job-name');
                    if (selectedJobs.edit.has(jobName)) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
                
                // 加载多任务参数
                await loadSelectedJobsParameters();
                
                // 确保多任务参数正确回显
                if (job.parameters) {
                    try {
                        const parameters = typeof job.parameters === 'string' ? JSON.parse(job.parameters) : job.parameters;
                        setTimeout(() => {
                            // 检查是否是多任务参数格式（每个任务有独立参数）
                            // 使用selectedJobs.edit中的完整路径进行检查
                            const isMultiJobParams = typeof parameters === 'object' &&
                                Array.from(selectedJobs.edit).some(fullPath => parameters.hasOwnProperty(fullPath));
                            
                            if (isMultiJobParams) {
                                // 多任务独立参数回显
                                fillMultiJobParametersModal(parameters);
                            } else {
                                // 兼容旧格式的统一参数回显
                                fillJobParametersModal(parameters);
                            }
                        }, 1500);
                    } catch (error) {
                        console.error('多任务参数回显失败:', error);
                    }
                }
            }
        }, 500);
        
        // 设置执行方式
        const executionType = job.execute_once ? 'once' : 'recurring';
        const executionRadio = document.querySelector(`#edit-job-form input[name="execution_type"][value="${executionType}"]`);
        if (executionRadio) executionRadio.checked = true;
        
        // 触发执行方式变化事件
        if (executionRadio) {
            const changeEvent = new Event('change');
            executionRadio.dispatchEvent(changeEvent);
        }
        
        // 设置执行时间或Cron表达式
        if (job.execute_once && job.execute_time) {
            const executeTimeInput = document.getElementById('edit-execute-time');
            if (executeTimeInput) {
                executeTimeInput.value = formatDateTimeForInput(job.execute_time);
            }
        } else if (job.cron_expression) {
            const cronInput = document.getElementById('edit-cron-expression');
            if (cronInput) {
                cronInput.value = job.cron_expression;
            }
        }
        
        // 重置提交按钮状态
        const submitBtn = document.querySelector('#edit-job-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '更新任务';
        }
        
        // 显示模态框
        const editModal = document.getElementById('edit-job-modal');
        if (editModal) editModal.style.display = 'block';
        
    } catch (error) {
        console.error('加载任务数据失败:', error);
        showNotification('加载任务数据失败: ' + error.message, 'error');
    }
}

// 切换任务状态（启动/暂停）
async function toggleJobStatus(jobId, newStatus) {
    try {
        await API.put(`/api/scheduled-jobs/${jobId}/status`, { status: newStatus });
        
        // 更新成功后刷新任务列表
        await loadJobList();
        
        const statusText = newStatus === 'active' ? '启动' : '暂停';
        showNotification(`任务${statusText}成功`, 'success');
    } catch (error) {
        console.error('切换任务状态失败:', error);
        showNotification('切换任务状态失败: ' + error.message, 'error');
    }
}

// 立即执行任务
async function executeJobNow(jobId) {
    try {
        // 获取按钮元素并禁用
        const buttons = document.querySelectorAll(`button[onclick="executeJobNow(${jobId})"]`);
        buttons.forEach(button => {
            const originalText = button.textContent;
            button.disabled = true;
            button.innerHTML = '<span class="btn-spinner"></span> 执行中...';
            
            // 3秒后恢复按钮状态
            setTimeout(() => {
                button.disabled = false;
                button.textContent = originalText;
            }, 3000);
        });
        
        // 显示执行中提示
        showNotification('正在提交任务执行...', 'warning');
        
        // 调用API立即执行任务
        const response = await API.post(`/api/scheduled-jobs/${jobId}/execute`);
        
        // 显示多任务执行结果
        if (response.totalJobs && response.totalJobs > 1) {
            const successCount = response.successCount || 0;
            const failedCount = response.failedCount || 0;
            
            if (successCount === response.totalJobs) {
                showNotification(`${response.message} (${successCount}/${response.totalJobs} 成功)`, 'success');
            } else if (successCount > 0) {
                showNotification(`${response.message} (${successCount}/${response.totalJobs} 成功, ${failedCount} 失败)`, 'warning');
            } else {
                showNotification(`${response.message} (${failedCount}/${response.totalJobs} 失败)`, 'error');
            }
        } else {
            showNotification(response.message || '任务已成功提交执行', 'success');
        }
        
        // 刷新任务列表以更新最后执行时间
        setTimeout(() => {
            loadJobList();
        }, 1000);
        
    } catch (error) {
        console.error('执行任务失败:', error);
        showNotification('执行任务失败: ' + error.message, 'error');
        
        // 恢复按钮状态
        const buttons = document.querySelectorAll(`button[onclick="executeJobNow(${jobId})"]`);
        buttons.forEach(button => {
            button.disabled = false;
            button.textContent = '执行';
        });
    }
}

