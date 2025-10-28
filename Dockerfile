# 使用官方Node.js运行时作为基础镜像
FROM opsdy.cdou.edu.cn:32399/public/node:22-alpine

# 设置工作目录
WORKDIR /usr/src/app

# 配置国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装编译依赖（sqlite3需要）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 配置npm使用国内镜像源
RUN npm config set registry https://registry.npmmirror.com/
RUN npm config set sqlite3_binary_host_mirror https://npmmirror.com/mirrors/sqlite3/

# 安装依赖
RUN npm ci --only=production

# 清理构建依赖以减小镜像大小
RUN apk del make g++ python3

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