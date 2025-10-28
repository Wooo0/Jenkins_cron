# 使用官方Node.js运行时作为基础镜像
FROM opsdy.cdou.edu.cn:32399/public/node:22-alpine

# 设置工作目录
WORKDIR /usr/src/app

# 配置国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 配置npm使用国内镜像源
RUN npm config set registry https://registry.npmmirror.com/

# 安装依赖
RUN npm ci --only=production

# 复制应用源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 更改文件所有权
RUN chown -R nextjs:nodejs /usr/src/app
USER nextjs

# 环境变量默认值
ENV PORT=3000
ENV DB_TYPE=mysql
ENV DB_HOST=localhost
ENV DB_PORT=3306
ENV DB_NAME=cron_jenkins
ENV DB_USERNAME=root
ENV DB_PASSWORD=
ENV JWT_SECRET=your-secret-key-change-in-production
ENV ADMIN_USERNAME=admin
ENV ADMIN_PASSWORD=admin123
ENV ADMIN_EMAIL=admin@example.com

# 启动应用
CMD ["node", "server.js"]