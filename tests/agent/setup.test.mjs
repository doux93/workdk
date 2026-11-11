import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  supportedNode,
  unquotePath,
  validateInputs,
  configure,
} from "../../agent/setup.mjs";
test("Windows 启动脚本仅含 ASCII，全部使用 CRLF，避开中文批处理解析问题", () => {
  for (const name of [
    "setup-agent.cmd",
    "start-agent.cmd",
    "status-agent.cmd",
  ]) {
    const bytes = readFileSync(new URL("../../agent/" + name, import.meta.url));
    assert.ok(
      bytes.every((b) => b < 128),
      name,
    );
    const text = bytes.toString("ascii");
    assert.ok(text.endsWith("\r\n"));
    assert.equal(text.replaceAll("\r\n", "").includes("\n"), false, name);
    assert.equal(text.replaceAll("\r\n", "").includes("\r"), false, name);
  }
  assert.ok(
    readFileSync(
      new URL("../../agent/setup-agent.cmd", import.meta.url),
      "ascii",
    ).includes("setup.mjs"),
  );
});
test("安装器检查最低版本并接受带引号的中文空格路径", () => {
  assert.equal(supportedNode("22.12.0"), false);
  assert.equal(supportedNode("22.13.0"), true);
  assert.equal(supportedNode("24.22.1"), true);
  assert.equal(supportedNode("20.19.0"), false);
  assert.equal(
    unquotePath(' "C:\\Users\\admin\\项目 空格" '),
    "C:\\Users\\admin\\项目 空格",
  );
  assert.equal(
    unquotePath("'C:\\Users\\admin\\项目'"),
    "C:\\Users\\admin\\项目",
  );
});
test("安装前验证所有路径，配置与项目类型不可混用", () => {
  const root = mkdtempSync(path.join(tmpdir(), "workdk-setup-"));
  try {
    const dir = path.join(root, "项目 空格"),
      file = path.join(root, "连接配置.json");
    mkdirSync(dir);
    writeFileSync(file, "{}");
    assert.deepEqual(validateInputs('"' + file + '"', "'" + dir + "'"), {
      config: file,
      project: dir,
    });
    assert.throws(() => validateInputs(dir, dir));
    assert.throws(() => validateInputs(file, file));
    assert.throws(() => validateInputs("", dir));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("安装参数不经过 shell，保留路径和项目名中的特殊字符", () => {
  const calls = [];
  const args = {
    config: "C:\\配置 文件.json",
    project: "C:\\项目 & 研发",
    name: "项目 & 测试",
  };
  configure(args, (argv) => {
    calls.push(argv);
    return { status: 0 };
  });
  assert.deepEqual(
    calls.map((c) => c.slice(1)),
    [
      ["init", args.config],
      ["add-project", args.project, args.name],
      ["install-hooks"],
    ],
  );
  const failed = [];
  assert.throws(() =>
    configure(args, (argv) => {
      failed.push(argv);
      return { status: 1 };
    }),
  );
  assert.equal(failed.length, 1);
});
