# 构建阶段
FROM opsdy.cdou.edu.cn:32399/public/node:22-alpine AS builder

# 设置工作目录
WORKDIR /usr/src/app

# 安装编译依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    libc6-compat

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装所有依赖（包括devDependencies用于构建）
RUN npm ci

# 运行时阶段
FROM opsdy.cdou.edu.cn:32399/public/node:22-alpine

# 设置工作目录
WORKDIR /usr/src/app

# 安装运行时依赖
RUN apk add --no-cache \
    sqlite \
    libc6-compat

# 从构建阶段复制node_modules
COPY --from=builder /usr/src/app/node_modules ./node_modules

# 复制package.json（运行时需要）
COPY package*.json ./

# 复制应用源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 创建数据目录
RUN mkdir -p /data

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 更改文件所有权
RUN chown -R nextjs:nodejs /usr/src/app /data
USER nextjs

# 环境变量默认值
ENV PORT=3000
ENV DB_TYPE=sqlite
ENV DB_PATH=/data/cron_jenkins.db
ENV JWT_SECRET=your-secret-key-change-in-production
ENV ADMIN_USERNAME=admin
ENV ADMIN_PASSWORD=admin123
ENV ADMIN_EMAIL=admin@example.com

# 启动应用
CMD ["node", "server.js"]