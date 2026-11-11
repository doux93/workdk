# 在线端实现

这里保留现有 Vinext / Cloudflare Workers 站点新增的服务端源码、数据库定义和 Drizzle 迁移。核心接口逻辑来自仓库根目录 `agent/service.mjs`、`agent/core.mjs`；前端来自 `src/`，两端共用同一份领域逻辑。

本目录为现有托管工程的增量源码，不能单独 `npm start`。现有站点的 `.openai/hosting.json` 使用 `d1: "DB"`；Sites 在部署时配置数据库并执行提交的迁移。托管工程使用 `app/chatgpt-auth.ts` 检查站点登录身份，`lib/agent-api.ts` 再检查所有者邮箱或机器调用凭据。站点仍为所有者私有。

运行时配置（只在服务端设置，不进入源码或前端包）：

- `AGENT_OWNER_EMAIL`：允许读取和修正日志的站点所有者邮箱。
- `AGENT_INGEST_TOKEN`：应用层采集凭据，保护上传与查询接口。
- `AGENT_SERVICE_ACCESS_TOKEN`：现有站点的私有服务访问凭据，由平台验证。通过 `OAI-Sites-Authorization` 头发送，仅用于该站点。

所有者登录后可从 `/api/agent-setup` 下载采集器配置；机器凭据本身不能调用此接口取得连接配置。下载响应禁止缓存，不在页面正文展示凭据。机器配置是敏感文件，不提交仓库。

接口：

| 方法 | 地址 | 用途 |
|---|---|---|
| POST | `/api/agent-events` | 每批 1–20 事件，最多 500 KB；先完整验证再批量写入，事件主键去重 |
| GET | `/api/agent-sessions` | 日期、时区偏移、来源、项目筛选；每页 50 会话 |
| GET | `/api/agent-session?id=...` | 每页 100 来源事件，返回继续游标 |
| PATCH | `/api/agent-session` | 修正标题、摘要、项目；原始事件不变 |
| GET | `/api/agent-setup` | 仅已登录所有者下载连接配置 |

API 中使用 SQL 参数绑定；日期范围经格式与 Date 验证后生成 ISO 时间边界。机器凭据校验后也只能使用代码提供的接口；无通用 SQL、文件读取、命令执行或删除接口。第一版机器凭据为单一所有者级别，尚不支持每设备独立吊销或多人工作区。

## 从 GitHub 本机运行

仓库根目录提供独立 SQLite 服务，便于开发、测试及本机使用：

1. 复制 `.env.example` 为 `.env`，为 `WORKDK_INGEST_TOKEN` 设置随机长值。
2. 在一个终端运行 `npm run agent:server`，在另一个终端运行 `npm run dev`。
3. Vite 将 `/api/agent*` 请求代理到本机 8788 服务，并由服务端代理添加凭据。该变量不会作为 `VITE_*` 暴露给浏览器。
4. 打开开发地址，进入 Agent 工作日志，下载连接配置。采集器包位于 `public/workdk-agent.zip`。

本机服务只监听 127.0.0.1。不要将开发服务器或本机采集服务直接暴露到公网；生产部署使用现有托管端的身份与权限逻辑。
