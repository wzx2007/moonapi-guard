# MoonAPI Guard

**用 MoonBit 检查 OpenAPI 3.0 接口升级的兼容性风险。**

输入旧版、新版 JSON 描述，得到可定位、可解释的变更报告。核心判断、引用解析、输入检查和报告模型均由 MoonBit 实现；Node.js 仅负责文件读写、命令行和报告展示。浏览器与 CLI 运行同一份 MoonBit 编译产物。

> v0.1.0 是明确限定范围的契约分析器，不是完整的 OpenAPI 验证器，也不证明服务端实际行为。无法可靠判断的已知结构会输出 warning，并将 `complete` 标为 `false`；默认 CI 策略会阻止这类结果。

## 直接运行交付包

要求 Node.js 20 或更高版本。交付 ZIP 包含已编译引擎，不需要 npm install，也不需要 API 密钥。

在项目目录打开终端：

```sh
node bin/moonapi-guard.mjs examples/old.json examples/breaking.json
node scripts/serve.mjs
```

第二条命令启动本地演示，打开 <http://127.0.0.1:4173>。演示提供三个场景：破坏性变更、兼容性变更、人工复核；也可以导入或粘贴自己的 JSON。页面计算在浏览器内完成，不上传描述文件。

Windows 可双击 `start-demo.cmd` 启动服务，随后打开上面的地址。终端按 Ctrl+C 停止。端口被占用时设置 `PORT` 环境变量。

## 从源码构建

安装 [MoonBit 官方工具链](https://www.moonbitlang.com/download)，确保 `moon`、`node` 在 PATH 中：

```sh
moon check --deny-warn
moon test --target wasm-gc
moon test --target js
node scripts/build.mjs
node --test tests/engine.test.mjs tests/cli.test.mjs
```

或者运行 `npm run verify`，一次完成上述检查。运行 `npm run build` 可以重建 CLI 和网页共用的引擎。源码仓库忽略生成产物；**从 Git 获取源码后必须先构建**。交付包已包含生成产物。

测试工具链版本见 `TOOLCHAIN.md`。没有第三方 Mooncakes 依赖，Node 层也没有 npm 依赖。

## 命令行

```sh
node bin/moonapi-guard.mjs OLD.json NEW.json --format json
node bin/moonapi-guard.mjs OLD.json NEW.json --format html --output report.html
node bin/moonapi-guard.mjs OLD.json NEW.json --format markdown --output report.md
node bin/moonapi-guard.mjs OLD.json NEW.json --fail-on breaking
```

默认格式为 text；支持 text / json / markdown / html。

| 退出码 | 含义 |
|---|---|
| 0 | 满足当前策略；不等于实际服务一定兼容 |
| 1 | 发现破坏性风险 |
| 2 | 输入、参数或文件读写错误 |
| 3 | 分析不完整，默认策略要求人工复核 |

`--fail-on warning` 为默认策略，阻止 breaking 和 warning。`--fail-on breaking` 只阻止 breaking；`--fail-on none` 仅生成报告，但无效输入仍退出 2。报告写到文件后退出码仍按风险返回。

## 为什么请求和响应要分开

请求检查 **旧客户端可能发出的值 ⊆ 新服务端接受的值**。
响应检查 **新服务端可能发出的值 ⊆ 旧客户端接受的值**。

例如，将枚举从 `pending | shipped` 扩展为 `pending | shipped | cancelled`：放在请求里通常兼容，放在响应里可能让旧客户端收到不认识的状态。工具按不同方向处理。

另一个容易忽略的细节：对象默认允许额外属性。如果旧请求对象允许任意额外属性，新版给其中一个可选字段增加类型限制，这也可能缩小旧请求的合法集合。MoonAPI Guard 会体现这种严格契约语义，而不直接将“新增可选字段”视为兼容。

## 第一版功能

- 删除路径/HTTP 操作；路径级参数继承、操作级覆盖、请求参数大小写规则。
- 参数或请求体从可选变必填；参数序列化变化的复核提示。
- 类型、integer/number、nullable、枚举、必填字段、数组元素、额外属性。
- 数值/长度/数量边界和数组唯一性；正则、format、multipleOf 变化交给复核。
- 请求媒体类型丢失、响应类型变化；响应状态码或协商格式变化提示。
- 文档内部对象引用、JSON Pointer 的 `~0` / `~1` 转义。
- 外部引用、组合类型、读写可见性、鉴权、循环引用等明确标记分析不完整。
- 对输入长度、解析深度和 Schema 遍历次数设置上限。
- CLI、中文浏览器演示、独立 HTML 报告、GitHub Actions 验证流程。

完整规则、保守判断和限制见 [docs/SUPPORT.md](docs/SUPPORT.md)，架构见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 作为 MoonBit 库使用

本地模块名暂为 `moonapi/guard`。**它是构建标识，尚未发布到 Mooncakes。** 发布前需改为参赛者实际拥有的命名空间，并同步 `bridge/moon.pkg` 的导入。

```moonbit
// 在使用方 moon.pkg 中导入 "moonapi/guard"
let report = @guard.compare_text(old_json_text, new_json_text)
// report.status: compatible / breaking / incomplete / invalid
// report.findings: severity, rule, operation, location, message
```

报告 `location` 是逻辑路径：采用 JSON Pointer 转义；参数用 `in:name` 标识而不是数组下标，引用后的 Schema 展示在使用位置。它不是可直接对原文执行的 JSON Pointer。

## 项目文件

| 位置 | 内容 |
|---|---|
| `*.mbt` | MoonBit 核心、报告模型、输入检查、测试 |
| `bridge/` | 将 MoonBit API 导出为 JavaScript 模块 |
| `bin/`、`lib/` | 命令行外壳和报告渲染 |
| `web/` | 无框架、无外部资源的浏览器演示 |
| `examples/` | 三类变化及基准描述 |
| `tests/` | 行为规范、方向性生成测试、CLI 集成测试 |
| `scripts/` | 构建、验证、示例和测试生成、本地服务 |
| `docs/` | 规则说明、设计、验收记录、参赛申报草案和演示脚本 |

## 开源与来源

Apache-2.0。这是 AI 辅助开发的原创实现，依据 OpenAPI 3.0 / JSON Pointer 规范设计；没有移植 oasdiff 的源码或测试。`THIRD_PARTY_NOTICES.md` 说明工具链及标准库来源。参赛前请如实保留 AI 使用说明，并用实际账号建立公开仓库。
