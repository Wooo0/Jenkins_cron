# Jenkins定时任务管理系统

一个基于Node.js的Jenkins定时任务管理应用，支持多种数据库和安全的用户认证。

## 功能特性

- ✅ Jenkins定时任务管理
- ✅ 多种数据库支持 (SQLite, MySQL, PostgreSQL, OceanBase)
- ✅ JWT用户认证系统
- ✅ 安全的初始化流程
- ✅ Docker容器化部署
- ✅ Kubernetes部署支持
- ✅ 响应式Web界面

## 快速开始

### 环境要求

- Node.js 18+
- 数据库 (SQLite/MySQL/PostgreSQL/OceanBase)

### 安装运行

1. 安装依赖
```bash
npm install
```

2. 配置环境变量 (可选)
```bash
# 复制示例配置
cp .env.example .env
# 编辑配置
vim .env
```

3. 启动应用
```bash
npm start
```

4. 访问应用
打开浏览器访问 `http://localhost:3000`

## 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 3000 | 应用端口 |
| DB_TYPE | sqlite | 数据库类型 (sqlite/mysql/postgresql/oceanbase) |
| DB_PATH | ./cron_jenkins.db | SQLite数据库文件路径 |
| DB_HOST | localhost | 数据库主机 (MySQL/PostgreSQL/OceanBase) |
| DB_PORT | 3306/5432/2881 | 数据库端口 |
| DB_NAME | cron_jenkins | 数据库名称 |
| DB_USERNAME | root/postgres | 数据库用户名 |
| DB_PASSWORD | | 数据库密码 |
| JWT_SECRET | your-secret-key-change-in-production | JWT密钥 |
| ADMIN_USERNAME | admin | 管理员用户名 |
| ADMIN_PASSWORD | admin123 | 管理员密码 |
| ADMIN_EMAIL | admin@example.com | 管理员邮箱 |

### 数据库配置示例

#### SQLite (默认)
```bash
DB_TYPE=sqlite
DB_PATH=./cron_jenkins.db
```

#### MySQL
```bash
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cron_jenkins
DB_USERNAME=root
DB_PASSWORD=your_password
```

#### PostgreSQL
```bash
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cron_jenkins
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

#### OceanBase
```bash
DB_TYPE=oceanbase
DB_HOST=localhost
DB_PORT=2881
DB_NAME=cron_jenkins
DB_USERNAME=root
DB_PASSWORD=your_password
```

## 初始化流程

首次启动应用时，系统会检测数据库状态和配置：

### 场景1: 已配置环境变量 (推荐用于生产环境)
- 系统检测到 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 环境变量
- 自动执行数据库初始化
- 使用环境变量中的管理员账户创建用户
- 初始化完成后显示登录界面

### 场景2: 未配置环境变量 (推荐用于开发环境)
- 系统检测到未配置管理员环境变量
- 显示初始化界面，要求设置管理员账户
- 用户输入管理员用户名、密码和邮箱
- 系统创建数据库表结构和管理员用户
- 初始化完成后自动登录

### 场景3: 数据库已初始化
- 系统检测到数据库已存在用户表
- 直接显示登录界面
- 使用现有管理员账户登录

### 初始化界面
- 仅在未配置环境变量时显示
- 设置管理员用户名、密码和邮箱
- 系统会自动创建数据库表结构
- 初始化完成后自动登录

### 登录界面
- 使用管理员账户登录
- 支持JWT令牌认证
- 会话持久化

## Docker部署

### 构建镜像
```bash
docker build -t cron-jenkins .
```

### 运行容器
```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/data:/data \
  -e JWT_SECRET=your-secret-key \
  -e ADMIN_PASSWORD=your-admin-password \
  cron-jenkins
```

### Docker Compose
```yaml
version: '3.8'
services:
  cron-jenkins:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - JWT_SECRET=your-secret-key
      - ADMIN_PASSWORD=your-admin-password
    restart: unless-stopped
```

## Kubernetes部署

### 部署应用
```bash
kubectl apply -f k8s-deployment.yaml
```

### 创建Secret (可选)
```bash
# 创建JWT密钥
kubectl create secret generic cron-jenkins-secrets \
  --from-literal=jwt-secret=your-secret-key \
  --from-literal=admin-password=your-admin-password
```

## 安全建议

1. **生产环境必须修改的配置**:
   - `JWT_SECRET`: 使用强随机字符串
   - `ADMIN_PASSWORD`: 使用强密码
   - `DB_PASSWORD`: 使用强密码

2. **数据库安全**:
   - 定期备份数据库
   - 使用网络隔离保护数据库
   - 定期更新数据库密码

3. **网络安全**:
   - 使用HTTPS
   - 配置防火墙规则
   - 限制访问IP范围

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库服务状态
   - 验证连接参数
   - 检查网络连通性

2. **初始化失败**
   - 检查数据库权限
   - 验证配置文件
   - 查看应用日志

3. **认证失败**
   - 检查JWT密钥配置
   - 验证用户凭据
   - 检查令牌有效期

### 日志查看
```bash
# 查看应用日志
npm run dev  # 开发模式
# 或查看容器日志
docker logs <container_id>
```

## 开发指南

### 项目结构
```
├── config.js          # 配置文件
├── server.js          # 主服务器文件
├── public/            # 前端静态文件
│   ├── index.html     # 主页面
│   ├── app.js         # 前端JavaScript
│   └── styles.css     # 样式文件
├── package.json       # 项目配置
└── README.md          # 项目文档
```

### API文档
应用提供RESTful API接口，所有API都需要JWT认证（初始化API除外）。

主要API端点：
- `GET /api/init/status` - 检查初始化状态
- `POST /api/init/setup` - 系统初始化
- `POST /api/login` - 用户登录
- `GET /api/user` - 获取用户信息
- `GET /api/jenkins-configs` - Jenkins配置管理
- `GET /api/scheduled-jobs` - 定时任务管理

## 许可证

MIT License