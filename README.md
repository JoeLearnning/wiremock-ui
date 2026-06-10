# WireMock UI

一个基于 Vue 3 的 [WireMock](https://wiremock.org/) 可视化管理界面，提供 Mock 规则创建、分组管理、请求测试和请求记录查看等功能。

## 功能

- **Mock 规则管理** — 左侧列表+右侧编辑的分栏布局，支持 JSON/Text/Proxy/Fault 四种响应模式
- **业务分组管理** — 嵌套文件夹结构，支持拖拽式分组
- **请求匹配筛选** — URL、Method、Headers、Query 参数、Cookie、Body 等多种匹配条件
- **请求测试** — 内置请求调试器，支持发送请求验证 Mock 命中
- **请求记录** — 实时查看 WireMock 接收到的请求详情
- **代理转发** — 全局代理或低优先级 Stub 代理配置
- **暗黑模式** — GitHub 风格暗色主题，支持系统偏好检测

## 截图

```
┌─ 🐙 WireMock UI  │ Mock 管理  请求测试  请求记录 │ ☀ ─┐
├────────────────────────────────────────────────────────┤
│  📁 分组  │  方法  │  规则名/URL  │  状态  │  优先级  │
│  ├─test   │  GET   │  用户查询     │  200   │  5       │
│  │ └─xxx  │  POST  │  -           │  FAULT  │  5       │
│           │        │  /api/login  │         │          │
└────────────────────────────────────────────────────────┘
```

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

### 运行

```bash
docker run -d \
  --name wiremock-ui \
  -p 8081:80 \
  wiremock-ui
```

> **说明**：容器内 Nginx 通过 `host.docker.internal` 反向代理到宿主机上的 WireMock（端口 8080）。如需修改 WireMock 地址，可编辑 `nginx.conf` 中的 `proxy_pass` 目标。

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
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

```bash
docker compose up -d
```

访问 `http://localhost:8081` 即可。

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
│   │   ├── mappings.ts  # Stub CRUD
│   │   ├── settings.ts  # 全局设置 + 分组持久化
│   │   └── types.ts     # 类型定义
│   ├── components/      # UI 组件
│   │   ├── GroupList.vue     # 左侧分组树
│   │   ├── GroupDialog.vue   # 新建/编辑分组弹窗
│   │   ├── StubList.vue      # Mock 规则列表
│   │   ├── StubEditor.vue    # Mock 规则编辑器
│   │   ├── StubForm.vue      # 编辑表单（共用）
│   │   ├── RequestHistory.vue# 请求记录
│   │   ├── ProxySettings.vue # 代理转发设置
│   │   └── JsonEditor.vue    # JSON 编辑器
│   ├── stores/          # Pinia 状态管理
│   │   ├── groups.ts    # 分组状态
│   │   └── mappings.ts  # Mock 规则状态
│   ├── views/           # 页面
│   │   ├── Dashboard.vue     # 主页面
│   │   └── Playground.vue    # 请求测试弹窗
│   ├── styles/          # 全局样式
│   ├── router/          # 路由配置
│   ├── App.vue          # 根组件
│   └── main.ts          # 入口
├── vite.config.ts       # Vite 配置
├── tsconfig.json
└── package.json
```

## 相关链接

- [WireMock 官方文档](https://wiremock.org/docs/)
- [TDesign Vue Next](https://tdesign.tencent.com/vue-next/)
- [Vue 3 文档](https://vuejs.org/)
