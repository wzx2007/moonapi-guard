# 支持范围、判断语义与限制

## 输入约定

支持 OpenAPI 3.0.0–3.0.4 的 JSON，必需 info.title、info.version 和 paths。提供面向已支持结构的输入检查，**不是完整 OAS 合规验证器**；正式接入前应先通过独立的 OpenAPI linter。JSON 重复键遵循 MoonBit JSON 解析器的行为，项目不对重复键输入提供兼容性保证。v0.2 进一步校验响应状态码、响应描述类型、参数布尔字段及非空 content。

YAML、OpenAPI 2.0/3.1、远程文件加载不在第一版范围内。单份文本最多 2,000,000 个 UTF-16 代码单元（实际限制由 MoonBit String.length 决定）；Node 读文件前另外设置 8 MB 上限。JSON 解析深度 96；Schema 深度 48；一次比较共享 5,000 次 Schema 访问预算。超过 Schema 预算输出 warning；输入大小/JSON 深度错误输出 invalid。

## 状态与覆盖率

- invalid：输入错误优先级最高。
- breaking：至少一项保守的兼容性风险；同时也可能存在 warning。
- incomplete：没有检测到 breaking，但存在无法完整判断的结构或行为。
- compatible：已支持的检查没有发现风险和覆盖缺口。

`complete` 与 `status` 独立：breaking 的报告也可能覆盖完整。`complete=true` 只表示本次支持范围内的分析没有产生覆盖警告，**不表示完整 OAS 支持或数学证明**。

分析采用保守结构比较，不执行完整的 Schema 可满足性证明。相互作用的约束（如只有一个合法值的边界、枚举和 nullable 的组合、不可满足 Schema）可能产生保守误报。breaking 是需要处理的兼容性风险，不承诺每一项都有可执行的反例。枚举与边界交互的一些情况单独标 warning。

## 规则

| 规则 | 级别 | 含义 |
|---|---|---|
| OPERATION_REMOVED | breaking | 原有 HTTP 方法/路径不再声明 |
| PARAMETER_REQUIRED | breaking | 新增必填参数或可选变必填 |
| BODY_REQUIRED | breaking | 新增必填 body 或可选变必填 |
| TYPE_INCOMPATIBLE | breaking | 接收方不接受发送方类型；integer 是 number 子集 |
| NULLABILITY | breaking | 发送方允许 null 而接收方不允许 |
| ENUM_INCOMPATIBLE | breaking | 发送方枚举未被接收方覆盖 |
| REQUIRED_PROPERTY | breaking | 接收方要求的字段未获发送方保证 |
| SCHEMA_FORBIDDEN | breaking | 接收方禁止某属性或额外属性 |
| BOUND_INCOMPATIBLE | breaking | minimum/maximum、长度、数量约束不包含源范围 |
| EXCLUSIVE_BOUND | breaking | 同值边界由包含变为排除 |
| UNIQUE_ITEMS | breaking | 接收方要求数组唯一，但源不保证 |
| MEDIA_TYPE_INCOMPATIBLE | breaking | 旧请求格式被移除，或新响应格式未获旧契约覆盖 |
| RESPONSE_BODY_REMOVED | breaking | 原来声明的响应体完全消失 |
| PARAMETER_REMOVED / BODY_REMOVED | warning | 服务端可能忽略，也可能拒绝旧输入 |
| RESPONSE_STATUS_ADDED / REMOVED | warning | 状态码变化依赖实际客户端处理逻辑 |
| RESPONSE_MEDIA_REMOVED | warning | 旧客户端的 Accept 协商可能受到影响 |
| SERIALIZATION_CHANGED | warning | style / explode / allowReserved / allowEmptyValue 变化 |
| DEFAULT_CHANGED | warning | 参数默认值变化 |
| CONSTRAINT_REVIEW | warning | pattern / format / multipleOf 不能用文本比较证明包含关系 |
| ENUM_BOUND_REVIEW | warning | 有限枚举与边界交互需要进一步检查 |
| SERVERS_CHANGED / OPERATION_ID_CHANGED | warning | 部署地址或生成 SDK 方法名变化 |
| SECURITY_TIGHTENED | breaking | 原先可用的凭据/权限组合不再被接受 |
| SECURITY_SCHEME_CHANGED / SECURITY_SCHEME_REVIEW | warning | 凭据定义变化或非 basic/bearer 的 HTTP 鉴权 |
| UNSUPPORTED_SCHEMA / IMPLICIT_TYPE / CONSTRAINT_TYPE | warning | 组合、可见性、未知关键字或不常规类型约束 |
| UNSUPPORTED_REF / CYCLIC_REF / REF_LIMIT | warning | 引用超出支持范围 |
| SCHEMA_DEPTH / WORK_LIMIT | warning | 达到有界遍历上限 |
| PATH_ITEM_REF | warning | Path Item $ref 合并语义未实现 |
| PARAMETER_CONTENT / UNSUPPORTED_ENCODING | warning | 非 schema 参数或媒体编码未实现 |
| RESPONSE_RANGE / RESPONSE_HEADERS / RESPONSE_LINKS | warning | 范围状态、响应头和 links 未实现 |
| CALLBACK_REVIEW / MEDIA_WILDCARD | warning | 回调与媒体通配匹配未实现 |

## 重要语义

1. 请求按 old ⊆ new；响应按 new ⊆ old。对象字段及额外属性递归比较。
2. 参数合并键为 `(in, name)`。header 名不区分大小写；query/path/cookie 区分。操作参数覆盖路径参数，同一层重复键拒绝。
3. `$ref` 只支持 `#/...` 的对象路径。处理 `~1` 和 `~0`；不处理百分号编码片段、数组索引、跨文件或网络引用。3.0 Reference Object 的其他同级字段按规范忽略。
4. `allOf` / `anyOf` / `oneOf` / `not` / `readOnly` / `writeOnly` / `discriminator` 标为不完整。不会把部分支持包装成完整实现。
5. 未被任何操作引用的 components 不属于比较对象。纯文档字段、examples、扩展字段 `x-*` 和 XML 展示信息不参与契约包含判断。
6. 默认值的一般行为变化、鉴权实际执行、流量路由、超时、限流、排序及业务语义不由 Schema 检查证明。仅参数 default 变化会自动提示。
7. Schema 数值使用 MoonBit Json 的 Double 表示；超出精确浮点范围的整数不应依赖本工具做精确差异判断。
8. 实际服务未遵守描述、客户端额外限制或 SDK 生成策略可能造成契约之外的不兼容。

## 规范来源

- [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3)：参数覆盖、Schema、Reference、nullable 等。
- [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)：JSON Pointer 转义。
- [MoonBit 文档](https://docs.moonbitlang.com/en/stable/)：语言、JSON 标准库和 JavaScript 导出。

规则为本项目自行实现；不是上述规范组织的认证产品。


## 鉴权支持（v0.2）

按 OpenAPI Security Requirement 的声明语义：数组项是 OR，同一对象内的 scheme 是 AND，每个 scheme 的 scopes 也必须全部满足。每个旧认证分支都需要有一个新分支接受其已保证的凭据和 scopes。操作级 security 覆盖根级配置，空数组表示取消继承。匿名分支 {} 被保留。

scheme 名称按身份标识比较，不推断重命名后的凭据等价性；相同名称的 type/in/name/scheme/flows/openIdConnectUrl 变化输出复核。HTTP basic/bearer、API key、OAuth2 和 OpenID Connect 的声明可参与比较；不验证真实令牌、授权服务器、flow 全部字段或可访问性。未知 HTTP scheme 提示复核。命名引用缺失和非 OAuth scheme 携带 scopes 判为无效。

资源限制：每个 security 数组最多 64 个替代分支，每个分支最多 16 个 scheme，每个 scheme 最多 64 个 scope。超限为 invalid。CLI/网页另使用隔离 Worker 和超时保护。
