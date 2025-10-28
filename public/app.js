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
        
        // 监听Jenkins任务选择变化
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
    const radios = document.querySelectorAll('input[name="execution_type"]');
    const executeTimeGroup = document.getElementById('execute-time-group');
    const cronExpressionGroup = document.getElementById('cron-expression-group');
    
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'once') {
                executeTimeGroup.style.display = 'block';
                cronExpressionGroup.style.display = 'none';
            } else {
                executeTimeGroup.style.display = 'none';
                cronExpressionGroup.style.display = 'block';
            }
        });
    });
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
        
        jobTableBody.innerHTML = jobs.map(job => `
            <tr>
                <td>${job.name}</td>
                <td>${job.jenkins_config_name || '未知'}</td>
                <td>${job.jenkins_job_name}</td>
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
        `).join('');
        
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
    // Jenkins配置表单
    document.getElementById('jenkins-config-form').addEventListener('submit', async (e) => {
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
    document.getElementById('jenkins-job-select-modal').innerHTML = '<option value="">请先选择Jenkins配置</option>';
    
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
}

// 关闭创建任务弹窗
function closeCreateJobModal() {
    document.getElementById('create-job-modal').style.display = 'none';
}

// 关闭编辑任务弹窗
function closeEditJobModal() {
    document.getElementById('edit-job-modal').style.display = 'none';
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
    const jobSelectModal = document.getElementById('jenkins-job-select-modal');
    const editJobSelect = document.getElementById('edit-jenkins-job-select');
    
    if (!configId) {
        if (event.target.closest('#create-job-modal') && jobSelectModal) {
            jobSelectModal.innerHTML = '<option value="">请先选择Jenkins配置</option>';
        } else if (event.target.closest('#edit-job-form') && editJobSelect) {
            editJobSelect.innerHTML = '<option value="">请先选择Jenkins配置</option>';
        }
        return;
    }
    
    try {
        // 显示加载状态
        if (event.target.closest('#create-job-modal') && jobSelectModal) {
            jobSelectModal.innerHTML = '<option value="">加载中...</option>';
        } else if (event.target.closest('#edit-job-form') && editJobSelect) {
            editJobSelect.innerHTML = '<option value="">加载中...</option>';
        }
        
        const jobs = await API.get(`/api/jenkins/${configId}/jobs`);
        
        if (jobs.length === 0) {
            const options = '<option value="">该Jenkins实例没有任务</option>';
            if (event.target.closest('#create-job-modal') && jobSelectModal) {
                jobSelectModal.innerHTML = options;
            } else if (event.target.closest('#edit-job-form') && editJobSelect) {
                editJobSelect.innerHTML = options;
            }
            showNotification('该Jenkins实例没有找到任何任务', 'warning');
            return;
        }
        
        const options = jobs.map(job =>
            `<option value="${job.fullName}">${job.displayName}</option>`
        ).join('');
        
        if (event.target.closest('#create-job-modal') && jobSelectModal) {
            jobSelectModal.innerHTML = `<option value="">请选择Jenkins任务</option>${options}`;
        } else if (event.target.closest('#edit-job-form') && editJobSelect) {
            editJobSelect.innerHTML = `<option value="">请选择Jenkins任务</option>${options}`;
        }
        
        console.log(`成功加载 ${jobs.length} 个Jenkins任务`);
    } catch (error) {
        console.error('加载Jenkins任务失败:', error);
        const errorMessage = `加载Jenkins任务失败: ${error.message}`;
        showNotification(errorMessage, 'error');
        
        // 设置错误状态
        if (event.target.closest('#create-job-modal') && jobSelectModal) {
            jobSelectModal.innerHTML = '<option value="">加载失败</option>';
        } else if (event.target.closest('#edit-job-form') && editJobSelect) {
            editJobSelect.innerHTML = '<option value="">加载失败</option>';
        }
    }
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
        let inputHtml = '';
        
        switch (param.type) {
            case 'StringParameterDefinition':
                inputHtml = `
                    <input type="text" 
                           id="param_${param.name}" 
                           name="param_${param.name}" 
                           value="${param.defaultParameterValue ? param.defaultParameterValue.value : ''}"
                           placeholder="请输入${param.name}">
                `;
                break;
                
            case 'ChoiceParameterDefinition':
                const options = param.choices.map(choice => 
                    `<option value="${choice}" ${choice === (param.defaultParameterValue ? param.defaultParameterValue.value : '') ? 'selected' : ''}>${choice}</option>`
                ).join('');
                inputHtml = `<select id="param_${param.name}" name="param_${param.name}">${options}</select>`;
                break;
                
            case 'BooleanParameterDefinition':
                const checked = param.defaultParameterValue && 
                               (param.defaultParameterValue.value === 'true' || param.defaultParameterValue.value === true) ? 'checked' : '';
                inputHtml = `
                    <label class="checkbox-label">
                        <input type="checkbox" 
                               id="param_${param.name}" 
                               name="param_${param.name}" 
                               ${checked}>
                        ${param.description || '启用选项'}
                    </label>
                `;
                break;
                
            case 'TextParameterDefinition':
                inputHtml = `
                    <textarea id="param_${param.name}" 
                              name="param_${param.name}" 
                              placeholder="请输入${param.name}">${param.defaultParameterValue ? param.defaultParameterValue.value : ''}</textarea>
                `;
                break;
                
            default:
                inputHtml = `
                    <input type="text" 
                           id="param_${param.name}" 
                           name="param_${param.name}" 
                           value="${param.defaultParameterValue ? param.defaultParameterValue.value : ''}"
                           placeholder="请输入${param.name}">
                `;
        }
        
        return `
            <div class="parameter-item">
                <h4>${param.name}</h4>
                ${param.description ? `<div class="parameter-description">${param.description}</div>` : ''}
                <div class="parameter-input">
                    ${inputHtml}
                </div>
            </div>
        `;
    }).join('');
}

// 渲染模态框中的字符串参数
function renderStringParameterModal(param) {
    return `
        <div class="parameter-item">
            <h4>${param.name}</h4>
            <div class="parameter-description">${param.description || ''}</div>
            <input type="text" name="param_${param.name}" value="${param.defaultParameterValue?.value || ''}" 
                   placeholder="请输入${param.name}">
        </div>
    `;
}

// 渲染模态框中的选择参数
function renderChoiceParameterModal(param) {
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

// 渲染模态框中的布尔参数
function renderBooleanParameterModal(param) {
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

// 渲染模态框中的Git参数
function renderGitParameterModal(param) {
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

// 渲染模态框中的通用参数
function renderGenericParameterModal(param) {
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

// 初始化模态框表单事件
function initModalForms() {
    // 创建任务表单
    document.getElementById('create-job-form').addEventListener('submit', async (e) => {
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
        
        if (!data.jenkins_job_name) {
            showNotification('请选择Jenkins任务', 'error');
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
        
        // 收集任务参数
        const parameters = {};
        AppState.jobParameters.forEach(param => {
            const paramName = `param_${param.name}`;
            if (formData.has(paramName)) {
                let value = formData.get(paramName);
                
                // 处理布尔参数
                if (param._class === 'hudson.model.BooleanParameterDefinition') {
                    value = formData.has(paramName);
                }
                
                parameters[param.name] = value;
            }
        });
        
        data.parameters = parameters;
        
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
    
    // 编辑任务表单
    document.getElementById('edit-job-form').addEventListener('submit', async (e) => {
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
        
        if (!data.jenkins_job_name) {
            showNotification('请选择Jenkins任务', 'error');
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
        
        // 收集任务参数
        const parameters = {};
        AppState.jobParameters.forEach(param => {
            const paramName = `param_${param.name}`;
            if (formData.has(paramName)) {
                let value = formData.get(paramName);
                
                // 处理布尔参数
                if (param._class === 'hudson.model.BooleanParameterDefinition') {
                    value = formData.has(paramName);
                }
                
                parameters[param.name] = value;
            }
        });
        
        data.parameters = parameters;
        
        try {
            await API.put(`/api/scheduled-jobs/${jobId}`, data);
            showNotification('定时任务更新成功', 'success');
            closeEditJobModal();
            loadJobList(); // 刷新任务列表
        } catch (error) {
            showNotification('更新失败: ' + error.message, 'error');
        } finally {
            // 无论成功或失败，都重新启用提交按钮
            submitBtn.disabled = false;
            submitBtn.textContent = '更新任务';
        }
    });
    
    // 为模态框中的选择器添加事件监听器
    document.getElementById('jenkins-config-select-modal').addEventListener('change', onJenkinsConfigChangeModal);
    document.getElementById('jenkins-job-select-modal').addEventListener('change', onJenkinsJobChangeModal);
    document.getElementById('edit-jenkins-config-select').addEventListener('change', onJenkinsConfigChangeModal);
    document.getElementById('edit-jenkins-job-select').addEventListener('change', onJenkinsJobChangeModal);
}

// 打开编辑任务弹窗
async function openEditJobModal(jobId) {
    try {
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
        
        // 设置Jenkins任务
        setTimeout(async () => {
            const jobSelect = document.getElementById('edit-jenkins-job-select');
            if (jobSelect) {
                jobSelect.value = job.jenkins_job_name;
                
                // 触发任务变化事件以加载参数
                await onJenkinsJobChangeModal({ target: jobSelect });
                
                // 填充任务参数
                if (job.parameters) {
                    try {
                        // 确保参数是对象格式
                        const parameters = typeof job.parameters === 'string' ? JSON.parse(job.parameters) : job.parameters;
                        setTimeout(() => {
                            fillJobParametersModal(parameters);
                        }, 100);
                    } catch (error) {
                        console.error('参数解析失败:', error);
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
        
        showNotification(response.message || '任务已成功提交执行', 'success');
        
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
