# Windows hook 命令修复 · 1.4.3

用户提供了由 Node 复刻 `cmd /C <整条命令>` 的失败证据：旧回调以带引号的 Node 路径和采集器路径开头，命令在 Node 启动前被破坏并返回 1。因此原队列没有事件、采集器日志没有产生，不能据此认定是采集器内部异常。

## 修改

- Windows 的普通目录：在采集器原目录创建 `node.exe` 硬链接，失败时复制。生成无引号的 `node.exe --no-warnings collector.mjs hook source` 命令，兼容整条命令交给 CMD 和按空格拆分后 spawn。
- 带空格或 CMD 命令字符的目录：单纯把 `.cmd` 路径直接拼接仍会拆坏。使用静态 `workdk-hook.cmd`，外层由 PowerShell `-EncodedCommand` 传递路径和 UTF-8 标准输入。生成的命令只有固定程序名、开关和一个 Base64 参数，不将路径交给外层空格解析。不更改 PowerShell 执行策略，编码内容不含凭据，可在 `hook-launcher.mjs` 查看。
- 已有 Node 运行时按哈希验证；不覆盖其他程序放置的 `node.exe`。运行时及元数据不进入 Git 或发布 ZIP。
- 旧回调清理覆盖 quoted/unquoted、Node 参数、批处理包装和新桥接形式。保留没有 Workdk hook 协议的其他 `collector.mjs` 命令，不采用会删除所有同名脚本任务的宽泛正则。
- Hook 入口内部异常同步记录至本地 `hook-error.log`，然后退出 0。日志失败也不会再次抛错；不记录完整任务载荷。程序尚未启动或进程被外部终止的情况仍不属于应用异常捕获范围。
- Hook 完全不导入 `queue.mjs` / `node:sqlite`：事件先以 fsync + 原子重命名写入 outbox，上传器再提交至原 SQLite 队列。数据库提交后才移除文件，重复导入按事件 ID 去重；不合法的文件保留并隔离。升级后需重启上传器。

## 验证范围

`test:agent` 增加启动命令、旧回调迁移、禁止 SQLite 导入、缺失模块 / 无效 JSON / 日志不可写仍退出 0，以及 outbox 重放测试。

Windows CI 从实际 ZIP 测试以下矩阵：Codex / Claude 两种来源；`cmd /C` / 按空格拆分 spawn 两种方式；普通 / 空格 / `&` 目录。运行测试用 Node 的路径也刻意包含空格。检查退出码、真实事件文件、中文载荷、重装去重和错误日志；只检查 exit 0 不算成功。

这验证的是 Hook 启动协议及采集流程，未把合成回调测试当作真实模型会话验证。

## 升级

下载新版采集器，使用原连接配置。在采集器目录执行：

```powershell
node .\collector.mjs install-hooks
```

然后重启上传进程，并在 Codex / Claude 中检查、重新信任回调。项目目录和工作台连接配置无需迁移或重新初始化。
