# 工作台 Agent 采集器 1.6.0

需要 Node.js 22.13+。无需额外 npm 依赖。采集器只处理明确加入允许列表的项目；不会读取完整历史对话、文件正文或工具命令全文。任务描述、最终回复、工具名称、文件名和可取得的退出码会经过基础脱敏后同步。脱敏不能保证识别所有业务秘密，请只选择允许上传的工作目录。

## Windows 安装

1. 在在线工作台 → Agent 工作日志 → 连接电脑，下载采集器和连接配置。
2. 解压采集器到固定目录，运行 `setup-agent.cmd`。配置路径和项目路径均支持空格、中文及外层引号。项目目录不会上传，只上传你设置的项目名。
3. 在 Codex 的 `/hooks` 中检查并信任新回调；Claude Code 检查新配置后重新开启会话。未支持所列 Hook 事件的旧版本应更新后使用。
4. 双击 `start-agent.cmd` 并保留窗口。每 15 秒处理最多 20 个事件，按 500,000 字节上限拆批上传；网络错误留在本地等待补传。`status-agent.cmd` 显示待上传数量、已同步数量、最近成功时间和同步错误。
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

完成初始化和项目配置后，在解压的采集器目录运行：

```sh
node collector.mjs install-mcp
```

安装器会合并用户级 `~/.workbuddy/mcp.json`，写入当前 Node、MCP 脚本和采集目录的绝对路径；保留其他服务器，修改前备份原文件。重复执行不重复添加。不把上传凭据复制进 MCP 配置。若文件损坏或同名条目不是本工具，会保留原文件并提示处理。移动采集器目录或更换 Node 后重新运行此命令。

然后在 WorkBuddy「插件 → MCP 服务器」重新连接 `workdk-journal`，确认连接成功。项目级 `.workbuddy/mcp.json` 若有同名配置，需检查是否遮盖用户级配置。也可参考包内 `mcp.example.json` 手动填写。卸载只需从对应文件的 `mcpServers` 删除 `workdk-journal` 条目，不要覆盖整个文件。

提供 `record_work` 工具：必填 `project`（允许列表中的名称，最多 200 字符）、`session`（稳定任务编号，最多 200 字符）、`summary`（非空，最多 12000 字符）；可选 `evidence`（最多 8000 字符）和 `kind`（stop/error/tool，默认 stop）。未知字段、空摘要和超长内容会明确报错，不会悄悄截断或接受伪造来源。

调用示例：请使用 `record_work`，项目为安装时填写的项目名，会话为当前任务的稳定编号，记录本轮实际完成的修改、验证结果和未完成事项。不要包含完整对话、文件正文或凭据。

MCP 无需加载 SQLite，记录先脱敏并持久写入 outbox；`start-agent.cmd` / `collector.mjs run` 会转入队列并上传。工具成功仅表示本地已保存，服务器是否收到请用 `status-agent.cmd` 查看。网络重传使用同一事件 ID；重新调用 MCP 会生成新记录，响应丢失后重复调用可能产生重复摘要。

MCP 自动调用依赖 Agent，不能保证每轮都会调用。尚未适配 WorkBuddy 桌面版原生完成回调；CodeBuddy CLI 的 Hooks 文档不能直接当作桌面版接口使用。真实 WorkBuddy 应用会话仍需在本机验收。

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


## Windows hook 启动修复（1.4.3）

旧版命令由两个带引号的路径开头，部分 `cmd /C <整条命令>` 启动方式会在 Node 启动前失败；此时采集器应用日志不会生成。

升级后运行 `node collector.mjs install-hooks` 更新已有回调，再重启上传进程，并在 Agent 中重新检查/信任回调。无需重新初始化连接配置或更改工作项目目录。

- Windows 无空格/命令字符的采集器路径：在原目录创建 `node.exe` 硬链接，跨卷或不支持时退回复制，生成不含引号的命令。复制会实际占用磁盘空间。安装器校验运行时哈希，不覆盖不属于采集器的 `node.exe`。
- 含空格或 CMD 特殊字符的路径：使用 `workdk-hook.cmd` 包装，外层是 PowerShell UTF-16LE 编码的路径/标准输入桥接，以兼容 `cmd /C` 和按空格拆分后 spawn 的调用方。编码内容仅含文件路径和标准输入转发，没有凭据，也不修改执行策略。源码见 `hook-launcher.mjs`。
- 重装会迁移带/不带引号、含参数和包装脚本形式的 Workdk 回调；不删除无关的 `collector.mjs` 任务。
- Hook 运行后异常会尽力写入 `~/.workdk-agent/hook-error.log`（自定义 WORKDK_AGENT_HOME 时位于该目录），以退出码 0 结束。外层进程被杀死、操作系统无法启动程序等情况不属于应用可捕获异常。
- Hook 不加载 SQLite。事件先通过 fsync 和原子重命名写入本地 `outbox`；状态/上传进程再转入原 SQLite 队列。先提交数据库，再删除文件，重放按事件 ID 去重。坏文件保留为 `.invalid` 并记录日志。
- 升级后需要重启上传进程，旧上传器不会读取新的 outbox。`status` 额外显示 outboxPending 与 hookErrorLog 路径。

## 可靠性修复（1.4.4）

- 长中文摘要按 UTF-8 字节数分批；网关返回 413 时继续拆批，已确认保存的子批次不重复排队。
- 引号中的完整密码、转义引号和 URL 用户信息会被过滤；旧队列事件在上传前重新应用当前过滤规则。过滤仍不能代替项目级上传授权。
- 本机 HTTP 接收端按原始字节累计请求，完整接收后统一解码，避免中文和 emoji 跨网络分块时损坏。
- 更新原采集器目录中的文件并重启上传器即可使用修复；配置与 SQLite 队列继续沿用。备份原目录后再替换文件，勿删除用户配置目录。


## 独立设备凭据（1.5.0）

新配置携带服务器签发的设备编号和独立上传凭据。每台电脑、Windows / WSL 环境分别生成，勿共用配置。设备凭据只能上传自己设备的事件，不能读取或修改其他工作记录。

已有电脑先清空旧版队列，再停止上传器；在设备列表为原设备「升级连接配置」或「重新签发配置」，替换为 1.5.0 采集器并运行 `node collector.mjs init 新配置路径`，最后重启上传器。同设备重新导入会保留已选择的项目目录；不同设备的配置不会覆盖现有配置。不要删除 SQLite / outbox，错误鉴权后待上传记录仍保留。

在网页停用设备会停止其后续上传，历史记录不删除。重新签发会立即使该设备旧凭据失效；导入新配置并重启后可继续补传同设备队列。下载中断时可在设备列表找到刚生成的连接，再次签发。独立设备停用不等于平台私有服务令牌的吊销；怀疑整个配置泄露时，还应轮换平台服务凭据，并为其他设备重新签发。

服务端升级、旧共享凭据迁移和本机管理员凭据轮换见仓库 `docs/DEVICE-CREDENTIALS.md`。WorkBuddy 当前仍通过 MCP 接入，尚未增加原生完成回调。
