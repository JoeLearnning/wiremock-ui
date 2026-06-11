# WireMock UI

一个基于 Vue 3 的 [WireMock](https://wiremock.org/) 可视化管理界面，提供 Mock 规则创建、分组管理、请求测试和请求记录查看等功能。

## 功能

- **Mock 规则管理** — 左侧列表+右侧编辑的分栏布局，支持 Direct / Fault / Proxy 三种响应模式
- **业务分组管理** — 嵌套文件夹结构，支持分组 URL 前缀设置
- **分组前缀** — 为分组设置 URL 前缀，Mock 编辑时自动填充，测试请求自动拼接完整路径
- **请求匹配筛选** — URL、Method、Headers、Query 参数、Cookie、Body 等多种匹配条件
- **请求测试** — 内置请求调试器，支持发送请求验证 Mock 命中
- **请求记录** — 实时查看 WireMock 接收到的请求详情
- **代理转发** — 全局代理或低优先级 Stub 代理，支持过滤前缀配置
- **Proxy 过滤前缀** — 代理转发时可配置 `proxyUrlPrefixToRemove` 去掉前缀后再转发
- **JSON 预览** — 保存前可预览完整 Mock JSON，支持编辑和 VueJsonPretty 美化展示
- **VS Code 风格 JSON 编辑器** — 响应体编辑支持深色主题、语法高亮（键名/字符串/数字/布尔值/括号着色）
- **自动持久化** — 修改 Mock 规则后延时 10 秒自动保存到磁盘
- **暗黑模式** — GitHub 风格暗色主题，支持系统偏好检测

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- 运行中的 [WireMock](https://wiremock.org/) 服务（默认端口 8080）

### 安装与启动

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/wiremock-ui.git
cd wiremock-ui

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

访问 `http://localhost:5173` 即可打开管理界面。

### 启动 WireMock

```bash
docker run -d \
  --name wiremock \
  -p 8080:8080 \
  -v $PWD/wiremock/mappings:/home/wiremock/mappings \
  -v $PWD/wiremock/__files:/home/wiremock/__files \
  wiremock/wiremock:latest \
  --global-response-templating \
  --enable-stub-cors \
  --verbose
```

### 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

## Docker 部署

### 构建镜像

```bash
docker build -t wiremock-ui .
```

### Docker Compose（推荐）

```yaml
# docker-compose.yml
services:
  wiremock:
    image: wiremock/wiremock:latest
    container_name: wiremock
    ports:
      - "8080:8080"
    volumes:
      - ./wiremock/mappings:/home/wiremock/mappings
      - ./wiremock/__files:/home/wiremock/__files
    command: ["--global-response-templating", "--enable-stub-cors", "--verbose"]

  wiremock-ui:
    build: .
    container_name: wiremock-ui
    ports:
      - "8081:80"
    depends_on:
      - wiremock
```

```bash
docker compose up -d
```

访问 `http://localhost:8081` 即可。

> **说明**：Nginx 使用 Docker 内置 DNS resolver（`127.0.0.11`）在运行时解析 `wiremock` 服务名，避免容器启动顺序导致的 DNS 解析失败。静态资源（`index.html`）不缓存，JS/CSS 带内容哈希的文件长期缓存。

## nginx.conf 核心配置

```
resolver 127.0.0.11 ipv6=off valid=10s;     # Docker 内置 DNS 运行时解析

location /__admin/        → proxy_pass → wiremock:8080
location /__wiremock-ui/  → proxy_pass → wiremock:8080
location /test-mock/      → 去掉 /test-mock 前缀 → proxy_pass → wiremock:8080
location /                → SPA 路由回退 + 静态资源缓存策略
```

## 技术栈

| 层 | 技术 |
|------|------|
| 框架 | Vue 3 (Composition API) |
| 语言 | TypeScript |
| 构建工具 | Vite 5 |
| UI 组件库 | TDesign Vue Next |
| HTTP 客户端 | Axios |
| JSON 查看器 | vue-json-pretty |
| 状态管理 | Pinia |
| 路由 | Vue Router |

## 项目结构

```
wiremock-ui/
├── public/              # 静态资源
├── src/
│   ├── api/             # API 客户端（Axios + WireMock Admin API）
│   │   ├── client.ts    # Axios 实例
│   │   ├── mappings.ts  # Stub CRUD + 批量操作 + 持久化
│   │   ├── settings.ts  # 全局设置 + 分组持久化（树形↔扁平转换）
│   │   └── types.ts     # 类型定义（GroupInfo、ProxyConfig 含 prefix/stripPrefix）
│   ├── components/      # UI 组件
│   │   ├── GroupList.vue     # 左侧分组树（含前缀显示）
│   │   ├── GroupDialog.vue   # 新建/编辑分组弹窗（含 URL 前缀输入）
│   │   ├── StubList.vue      # Mock 规则列表
│   │   ├── StubEditor.vue    # Mock 规则编辑器 + JSON 预览对话框
│   │   ├── StubForm.vue      # 编辑表单（URL 前缀 + 代理过滤前缀）
│   │   ├── RequestHistory.vue# 请求记录
│   │   ├── ProxySettings.vue # 代理转发设置（含去除前缀配置）
│   │   └── JsonEditor.vue    # VS Code 风格 JSON 编辑器（语法高亮+行号）
│   ├── stores/          # Pinia 状态管理
│   │   ├── groups.ts    # 分组状态
│   │   └── mappings.ts  # Mock 规则状态（含延时持久化 scheduleSave）
│   ├── utils/           # 工具函数
│   │   └── uuid.ts      # UUID 生成（兼容 HTTP 环境）
│   ├── views/           # 页面
│   │   ├── Dashboard.vue     # 主页面
│   │   └── Playground.vue    # 请求测试弹窗
│   ├── styles/          # 全局样式
│   ├── router/          # 路由配置
│   ├── App.vue          # 根组件
│   └── main.ts          # 入口
├── vite.config.ts       # Vite 配置（含 dev 代理到 WireMock 8080）
├── nginx.conf           # Docker Nginx 配置
├── tsconfig.json
├── Dockerfile           # 多阶段构建（Node 构建 + Nginx 运行）
└── package.json
```

## 相关链接

- [WireMock 官方文档](https://wiremock.org/docs/)
- [TDesign Vue Next](https://tdesign.tencent.com/vue-next/)
- [Vue 3 文档](https://vuejs.org/)
