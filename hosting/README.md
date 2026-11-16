# 在线端实现

这里保留现有 Vinext / Cloudflare Workers 站点新增的服务端源码、数据库定义和 Drizzle 迁移。核心接口逻辑来自仓库根目录 `agent/service.mjs`、`agent/core.mjs`、`server/workspace-service.mjs` 和 `shared/workspace-schema.mjs`；前端来自 `src/`，两端共用同一份领域逻辑。

本目录为现有托管工程的增量源码，不能单独 `npm start`。现有站点的 `.openai/hosting.json` 使用 `d1: "DB"`；Sites 在部署时配置数据库并执行提交的迁移。托管工程使用 `app/chatgpt-auth.ts` 检查站点登录身份，`lib/agent-api.ts` 再检查所有者邮箱或机器调用凭据。站点仍为所有者私有。

运行时配置（只在服务端设置，不进入源码或前端包）：

- `AGENT_OWNER_EMAIL`：允许读取和修正日志的站点所有者邮箱。
- `AGENT_INGEST_TOKEN`：仅用于迁移旧安装的共享上传凭据；新设备不再下载此值。
- `AGENT_ALLOW_LEGACY_INGEST`：仅明确设为 `true` 时接受上述旧凭据；默认关闭，迁移完成后移除。
- `AGENT_SERVICE_ACCESS_TOKEN`：现有站点的私有服务访问凭据，由平台验证。通过 `OAI-Sites-Authorization` 头发送，仅用于该站点。

所有者登录后通过 `POST /api/agent-setup` 为每台电脑生成独立配置；GET 只显示需手动提交的下载表单，不创建凭据。机器凭据本身不能调用此接口取得连接配置。下载响应禁止缓存，不在页面正文展示凭据。机器配置是敏感文件，不提交仓库。

接口：

| 方法 | 地址 | 用途 |
|---|---|---|
| POST | `/api/agent-events` | 每批 1–20 事件，最多 500 KB；先完整验证再批量写入，事件主键去重 |
| GET | `/api/agent-sessions` | 日期、时区偏移、来源、项目筛选；每页 50 会话 |
| GET | `/api/agent-session?id=...` | 每页 100 来源事件，返回继续游标 |
| PATCH | `/api/agent-session` | 修正标题、摘要、项目；原始事件不变 |
| GET | `/api/agent-setup` | 所有者下载表单，不生成凭据 |
| POST | `/api/agent-setup` | 所有者签发配置；JSON 或表单的 label 必填，device 可选，传已有编号则轮换该设备凭据 |
| GET | `/api/agent-devices` | 所有者查看设备授权状态；不返回凭据原文或哈希 |
| PATCH | `/api/agent-devices` | 所有者传入 device 停用该设备，保留日志 |

API 中使用 SQL 参数绑定；日期范围经格式与 Date 验证后生成 ISO 时间边界。机器凭据校验后也只能使用代码提供的接口；无通用 SQL、文件读取、命令执行或删除接口。1.5.0 起独立设备凭据只能上传自己的事件，可逐设备停用；历史共享凭据仅在显式迁移开关开启时兼容，只能上传，无法逐设备吊销。仍不支持多人工作区。

## 从 GitHub 本机运行

仓库根目录提供独立 SQLite 服务，便于开发、测试及本机使用：

1. 复制 `.env.example` 为 `.env`，为 `WORKDK_INGEST_TOKEN` 设置随机长值。
2. 在一个终端运行 `npm run agent:server`，在另一个终端运行 `npm run dev`。
3. Vite 将 `/api/agent*` 与 `/api/workspace-snapshot` 请求代理到本机 8788 服务，并由服务端代理添加凭据。该变量不会作为 `VITE_*` 暴露给浏览器。
4. 打开开发地址，进入 Agent 工作日志，下载连接配置。采集器包位于 `public/workdk-agent.zip`。

本机服务只监听 127.0.0.1。不要将开发服务器或本机采集服务直接暴露到公网；生产部署使用现有托管端的身份与权限逻辑。


## 1.5.0 部署顺序

1. 先执行新增 Drizzle 迁移 `0001_device_credentials.sql`，保留旧事件和摘要表。
2. 同步根目录 `agent/core.mjs`、`agent/service.mjs` 和新增 `agent/credentials.mjs` 到托管工程的 `agent/`，同步前端及本目录路由和身份适配代码。
3. 新设备只需要 `AGENT_OWNER_EMAIL`、`AGENT_SERVICE_ACCESS_TOKEN` 及 D1 绑定，不需要设置共享采集凭据。
4. 对已有安装按 [设备授权迁移](../docs/DEVICE-CREDENTIALS.md) 更新，迁移结束关闭旧凭据开关并轮换旧令牌。

仓库测试覆盖共享鉴权模块、SQLite 服务、迁移 SQL 和界面行为；本目录仍需在实际托管环境验证可信身份头、平台服务令牌和 D1 绑定。数据库迁移新增表和索引，不重建或清空历史表。

## 1.7.0 快照部署

1. 先执行 `0002_workspace_snapshots.sql`，保留所有原有表。
2. 同步仓库 `server/`、`shared/`、`agent/` 中的服务端代码，以及 `app/api/workspace-snapshot/route.ts`、数据库定义和前端。快照与备份校验共用同一份纯 JavaScript 规则。
3. GET / PUT `/api/workspace-snapshot` 仅允许可信所有者身份。设备或共享上传凭据无权读写。PUT 必须带已查看的 `baseRevision`，条件 INSERT 比较与写入在同一条 SQL 中完成；冲突返回 409。
4. GET 可带 `?revision=数字` 读取历史版本；默认取最新。最多保留最近 10 份，每份 UTF-8 内容最多 1,500,000 字节，为 D1 单行上限预留空间。无自动多端合并。
5. 在实际站点检查所有者、非所有者、设备凭据、未登录和跨站请求；确认平台只信任自己的身份头，并已执行迁移。仓库测试不代表这些平台条件已配置。
