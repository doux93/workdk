# Windows 安装启动修复 · 1.4.1

旧安装包的 `.cmd` 文件使用 LF 换行，其中 `setup-agent.cmd` 包含直接由 CMD 解析的 UTF-8 中文和内联 JavaScript。用户在 Windows PowerShell 中执行时出现命令被截断及乱码，例如 `22.13`、`ector.mjs` 被当作命令。此前 Linux 采集协议检查没有覆盖 Windows CMD 的解析过程。

本次修复：

- 三个 `.cmd` 改为纯 ASCII、CRLF 的薄启动入口。
- 新增 `setup.mjs`，由 Node 处理版本检查、中文提示、路径验证和安装步骤；传给子进程的参数不经过 shell。
- 配置文件、项目目录支持中文、空格和外层引号。所有路径检查通过后才开始写配置。
- 新增打包脚本和 `.gitattributes`，在 ZIP 中强制保留启动脚本的字节格式。
- 新增 Windows 专用检查及 GitHub Actions，对 ZIP 解压出的安装包运行真实 `cmd.exe`。安装器在临时目录中测试，已有用户回调配置不会被修改。

## 用户操作

重新下载 1.4.1 采集器，解压到新文件夹；保留之前下载的连接配置文件。在 PowerShell 中进入新文件夹后运行：

```powershell
node .\setup.mjs
```

或执行 `setup-agent.cmd`。输入连接配置路径、项目目录和项目名后，检查 Agent 回调，再运行 `start-agent.cmd`。

## 验证

- `npm run test:agent`：21 项采集/API/安装器检查。
- `node tests/windows-install.mjs --node-only`：在 Linux 验证 Node 安装入口的真实子进程、带引号的中文空格路径、重复安装和状态读取。
- `npm run test:windows`：必须在 Windows 运行，执行真实 `.cmd` 安装与状态脚本。
- `python scripts/package-agent.py`：生成不含凭据的 ZIP，并强制 `.cmd` 使用 ASCII / CRLF。

Windows CI 结果见 [Actions](https://github.com/doux93/workdk/actions/workflows/windows-agent.yml)。Linux 检查不能替代 Windows CMD 实测。
