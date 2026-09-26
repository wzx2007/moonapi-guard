# MoonAPI Guard

参赛者：魏泽瑄（北京邮电大学）｜团队：w1tness｜GitHub：wzx2007。

项目由参赛者确定目标并指导，AI 代理完成主要编码、测试、文档和工程验证。

[下载 v0.2.0 可运行发布包](https://github.com/wzx2007/moonapi-guard/releases/tag/v0.2.0) · [GitHub Actions](https://github.com/wzx2007/moonapi-guard/actions)

**用 MoonBit 检查 OpenAPI 3.0 接口升级的兼容性风险。**

输入旧版、新版 JSON 描述，得到可定位、可解释的变更报告。核心判断、引用解析、输入检查和报告模型均由 MoonBit 实现；Node.js 仅负责文件读写、命令行和报告展示。浏览器与 CLI 运行同一份 MoonBit 编译产物。

> v0.2.0 是明确限定范围的契约分析器，不是完整的 OpenAPI 验证器，也不证明服务端实际行为。无法可靠判断的已知结构会输出 warning，并将 `complete` 标为 `false`；默认 CI 策略会阻止这类结果。

## 直接运行交付包

要求 Node.js 20 或更高版本。交付 ZIP 包含已编译引擎，不需要 npm install，也不需要 API 密钥。

在项目目录打开终端：

```sh
node bin/moonapi-guard.mjs examples/old.json examples/breaking.json
node scripts/serve.mjs
```

第二条命令启动本地演示，打开 <http://127.0.0.1:4173>。演示提供四个场景：破坏性变更、兼容性变更、鉴权收紧、人工复核；也可以导入或粘贴自己的 JSON。页面计算在浏览器内完成，不上传描述文件。

Windows 可双击 `start-demo.cmd` 启动服务，随后打开上面的地址。终端按 Ctrl+C 停止。端口被占用时设置 `PORT` 环境变量。

## 从源码构建

安装 [MoonBit 官方工具链](https://www.moonbitlang.com/download)，确保 `moon`、`node` 在 PATH 中：

```sh
moon check --deny-warn
moon test --target wasm-gc
moon test --target js
node scripts/build.mjs
node scripts/test.mjs
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

默认格式为 text；支持 text / json / markdown / html / sarif / csv。

使用 `--format csv --output report.csv` 可将报告导入电子表格。CSV 保留总体状态、错误和风险项；引号与多行内容会转义，可能被表格软件视为公式的值加单引号前缀。需要原始精确文本时使用 JSON 报告。

文件名以 `-` 开头时，将所有选项放在 `--` 前，例如：
`node bin/moonapi-guard.mjs --format json -- -old.json -new.json`。
分隔符之后的 `--help`、`--version` 也会作为文件名处理。

| 退出码 | 含义 |
|---|---|
| 0 | 满足当前策略；不等于实际服务一定兼容 |
| 1 | 发现破坏性风险 |
| 2 | 输入、参数、文件读写错误或分析超时 |
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
- 鉴权全局继承、操作覆盖、OR/AND 组合和 OAuth scopes 包含关系检查；凭据定义变化要求复核。
- 外部引用、组合类型、读写可见性、循环引用等明确标记分析不完整。
- 对输入长度、解析深度和 Schema 遍历次数设置上限。
- CLI、中文浏览器演示、HTML / SARIF 报告、GitHub Actions 验证流程。
- 独立 Worker 后台分析、10 秒超时、网页取消、旧结果丢弃、搜索和分批显示。
- 报告原子写入及输入文件防覆盖（包括硬链接）、UTF-8 严格校验。

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
| `examples/` | 四类变化及基准描述 |
| `tests/` | 行为规范、方向性生成测试、CLI 集成测试 |
| `scripts/` | 构建、验证、示例和测试生成、本地服务 |
| `docs/` | 规则说明、设计、验收记录、参赛申报草案和演示脚本 |

## 开源与来源

Apache-2.0。这是 AI 辅助开发的原创实现，依据 OpenAPI 3.0 / JSON Pointer 规范设计；没有移植 oasdiff 的源码或测试。`THIRD_PARTY_NOTICES.md` 说明工具链及标准库来源。参赛前请如实保留 AI 使用说明，并用实际账号建立公开仓库。


## v0.2 新增用法

```sh
node bin/moonapi-guard.mjs OLD.json NEW.json --format sarif --output report.sarif
node bin/moonapi-guard.mjs OLD.json NEW.json --timeout-ms 30000
```

SARIF 2.1.0 使用逻辑路径，不伪造源文件行号。兼容 SARIF 的消费端可读取；本版本尚未验证 GitHub Code Scanning 上传，不能将该输出等同于已完成平台集成。

CLI 超时默认 10 秒，可设 1–120000 毫秒；超时返回 2，不生成兼容性结论。网页分析可取消，编辑输入也会取消正在运行的分析。结果先显示 200 项，可搜索或继续加载。输出路径若指向任一输入文件（含硬链接）会被拒绝。

Node.js 程序可复用隔离分析接口，并使用 `AbortSignal` 取消单个任务：

```js
import {runEngine} from './lib/run-engine.mjs';
const controller = new AbortController();
const pending = runEngine([oldText, newText], 10000, {signal: controller.signal});
// 需要取消时调用 controller.abort()；pending 会以 AbortError 拒绝。
const report = await pending;
```

完成、超时或取消都会终止该工作线程并清理监听器；取消不会生成兼容性结论，也不影响其他任务。
