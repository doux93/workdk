# 工作台 Agent 采集器 1.4.1

需要 Node.js 22.13+。无需额外 npm 依赖。采集器只处理明确加入允许列表的项目；不会读取完整历史对话、文件正文或工具命令全文。任务描述、最终回复、工具名称、文件名和可取得的退出码会经过基础脱敏后同步。脱敏不能保证识别所有业务秘密，请只选择允许上传的工作目录。

## Windows 安装

1. 在在线工作台 → Agent 工作日志 → 连接电脑，下载采集器和连接配置。
2. 解压采集器到固定目录，运行 `setup-agent.cmd`。配置路径和项目路径均支持空格、中文及外层引号。项目目录不会上传，只上传你设置的项目名。
3. 在 Codex 的 `/hooks` 中检查并信任新回调；Claude Code 检查新配置后重新开启会话。未支持所列 Hook 事件的旧版本应更新后使用。
4. 双击 `start-agent.cmd` 并保留窗口。每 15 秒最多上传一批 20 个事件；网络错误留在本地等待补传。`status-agent.cmd` 显示待上传数量、已同步数量、最近成功时间和同步错误。
5. 如需登录 Windows 后自动启动，在采集器目录运行 `powershell -ExecutionPolicy Bypass -File .\install-startup.ps1`。它只创建当前用户的计划任务 `WorkdkAgentCollector`，无固定结束时间。卸载：`Unregister-ScheduledTask -TaskName WorkdkAgentCollector`。

连接配置含私有访问凭据，只保存在自己的用户目录，不提交 Git、不发给他人。网页下载的原始配置在初始化成功后可删除；实际配置保存在 `~/.workdk-agent/config.json`，SQLite 队列保存在同目录。移动采集器目录后需重新安装回调。已有 Hook 配置会先备份，安装器合并自身回调；同名重复安装不会重复追加。

## macOS / Linux / WSL / 从源码使用

以下在采集器目录执行（从仓库根目录执行时为每个脚本补上 `agent/`）：

```sh
node collector.mjs init /path/to/workdk-agent.config.json
node collector.mjs add-project /path/to/project 项目名
node collector.mjs install-hooks
node collector.mjs run
```

添加更多项目，重复 `add-project` 即可。Windows 和 WSL 的路径、Node、用户目录相互独立，应分别配置。Windows 的 `setup-agent.cmd` 不会修改 WSL 的配置。Hook 默认从当前用户目录读取配置；高级用法可设置 `WORKDK_AGENT_HOME`，需要同时让 Agent 和上传进程继承此变量。

Hooks 配置位置为 `~/.codex/hooks.json`、`~/.claude/settings.json`。卸载自动采集时，在这两个文件中只删除命令包含本采集器 `collector.mjs ... hook` 的处理器，保留其他已有回调；也可以谨慎参考安装前的 `.workdk-backup-时间戳` 文件。

## WorkBuddy MCP

在 WorkBuddy 中添加本地 stdio MCP，命令设为 Node 的完整路径，参数为 `mcp.mjs` 的完整路径。包内 `mcp.example.json` 为示例。该入口提供 `record_work` 工具，需传 `project`（允许列表中的项目名）、`session`（稳定任务编号）、`summary`，可选 `evidence` 和 `kind`（stop/error/tool）。让 WorkBuddy 在任务结束时调用它，采集器运行后即可上传。MCP 工具调用本身依赖 Agent，不能保证所有任务都会自动调用；第一版尚未适配 WorkBuddy 原生完成回调。

## 行为与限制

- 每轮结束表示“本轮结束 · 待验证”，不是任务已完成。失败、中断各有独立状态。
- 原始事件只追加；摘要修正单独保存，不覆盖原始依据。
- 有工具事件编号的重复回调可本地去重；无稳定编号时可能产生多条事件，但归在同一个会话。网络重传始终使用已入队事件编号，服务端幂等处理。
- 基于事件时间排序。电脑时钟应正常；超过服务端时间五分钟的事件会被拒绝，并留在队列中供排查。
- SQLite 已同步事件暂不自动清理。数量增加时可在停止采集器后备份数据库。
- 崩溃、电脑关机、工具未触发回调时，未结束的会话会保留“执行中”，不能据此推算真实人工工时。可在工作台修正说明。
- 第一版复用 Agent 现有最终回复，不额外调用模型。没有自动跨会话合并、跨工具任务识别、人工工时计算或主动派发任务。
- 配置含两层私有凭据。工作台所有者重新配置服务凭据后需重新下载并初始化。不要上传旧事件数据库到 GitHub。

官方接入参考：[Codex Hooks](https://learn.chatgpt.com/docs/hooks)、[Claude Code Hooks](https://code.claude.com/docs/en/hooks)、[WorkBuddy MCP](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)。实际兼容性以安装的工具版本和回调测试为准。

## Windows 安装脚本兼容性修复（1.4.1）

如果旧包出现 `22.13`、`ector.mjs` 不是命令或乱码，请重新下载 1.4.1 采集器并解压到新文件夹。`.cmd` 现为纯 ASCII / CRLF 的启动入口，中文提示与参数处理由 `setup.mjs` 执行。PowerShell 中也可直接运行 `node .\setup.mjs`。需要 Node.js 22.13+；在 Windows CMD 上的专用检查为 `npm run test:windows`，GitHub Actions 会对发布 ZIP 中的脚本运行该检查。
