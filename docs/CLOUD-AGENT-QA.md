# 云电脑采集链路验收 · 2026-11-11

本次从已发布工作台下载 `workdk-agent.zip`，核对包内 11 个文件与源码一致，在 Linux 云电脑运行真实采集器、SQLite 队列、HTTP 接收服务和 stdio MCP 进程。测试没有向生产工作日志添加记录。

## 已通过

- 再次运行 51 项自动测试：17 项数据、17 项 Agent、17 项 React 界面测试。
- 安装器在隔离的用户目录映射下合并配置，保留原有回调并创建备份；重复安装只保留一份自身回调。没有修改运行环境的全局 Agent 配置。
- 4 条模拟回调分别由独立采集进程写入本地 SQLite；接收服务关闭时上传失败，事件仍保留。
- 启动真实 HTTP 接收服务和后台上传进程后自动补传；通过 API 读取到摘要、工具退出结果和脱敏内容。
- 对同一批事件再次上传，服务器事件数保持不变；错误凭据返回 401。
- 启动下载包中的 MCP 进程，完成 JSON-RPC 初始化、工具列表和 `record_work` 调用，记录进入队列并上传。
- 最终得到 2 个测试会话、5 条事件，待上传 0 条。服务、采集进程和临时测试配置随后清理。

## 真实 Agent 验证边界

尝试运行云电脑自带 Codex CLI 0.167.0-alpha.4。它在模型任务启动前失败：

```text
failed to initialize in-process app-server client: Read-only file system (os error 30)
```

为该次进程单独指定可写的 `sqlite_home` 和 `log_dir` 后，仍在初始化阶段出现同样错误。未修改 HOME / CODEX_HOME、现有登录凭据或全局回调信任设置。OpenAI 官方仓库的同类问题 [#51293](https://github.com/openai/codex/issues/51293) 说明：临时会话仍需要向 Codex 主目录写入部分运行状态，仅迁移 SQLite / 日志目录不足以满足要求。

因此，本次多进程测试使用明确标注的 Hook 协议样本，**不能据此声明真实 Codex 模型会话已验收通过**。此云电脑也没有可用的 Claude / WorkBuddy 登录环境，未做这两者的真实应用会话测试。

## 复现

```sh
npm run test:integration
```

使用从工作台下载并解压的采集器：

```sh
node tests/agent-integration.mjs --collector-dir /absolute/path/workdk-agent
```

脚本需要 Node.js 22.13+，会在临时目录中创建一次性配置与数据库，只在 127.0.0.1:8788 启动测试服务；该端口需空闲。回调载荷固定为合成数据，没有外部模型调用。安装器的用户目录查找仅在该测试子进程中映射到临时目录。详细结果见 [cloud-agent-qa.json](../reports/cloud-agent-qa.json)。
