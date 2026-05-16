# TAP 长期规划：面向 Agent 的业务工具编排层

## 定位

TAP 的长期定位不是替代正式 API，也不是通用自动化脚本框架，更不是企业业务数据的终局统一入口，而是面向 Agent 的业务工具编排层。

它把已有 CLI、API、日志、指标、浏览器只读入口、测试 runner 和长尾数据源，编排成稳定、结构化、可组合的业务语义命令：

```bash
tap <domain> <command> [--key value] [--format json]
```

对 Agent 来说，TAP 提供的是业务语义明确的 workflow 入口，而不是要求 Agent 临时理解网页路径、内部接口、登录态、字段结构、筛选逻辑，以及多个工具之间的调用顺序和结果拼接方式。

但 TAP 不应试图长期拥有核心业务数据入口，也不应长期包装单个系统的核心能力。真实组织中，核心数据和核心动作通常会由数据持有方建设和维护专有 CLI、API、SDK、OpenAPI schema 或 MCP server。TAP 更适合站在这些工具之上，做跨工具编排、结果归一化、断言、证据收集和 Agent-friendly 输出；当官方工具缺位时，TAP 可以临时桥接长尾、非正式、尚未 Agent-friendly 的数据入口。

## 核心判断

当前 TAP 以 HTTP、浏览器登录态和页面数据提取为主要能力。这覆盖了大量后台系统场景，但真实业务数据并不总是通过 HTTP 服务完整暴露。广告投放、风控、审核、预算、报表、日志和指标等系统通常还分布在数据库、数仓、日志平台、指标平台、内部 RPC 或专用 CLI 中。

因此，TAP 的长期方向应从“Web/HTTP 适配器”演进为“业务工具编排层”。HTTP/Web 仍是一等数据源，但只是 workflow 的一个 source；官方 CLI/API、日志、指标、测试 runner 和内部工具同样可以成为 source。

同时，这个“编排层”应被理解为 workflow 层，而不是替代数据持有方官方工具的平台层。对于高频、核心、强治理的单系统能力，TAP 可以用于原型验证、临时接入或迁移过渡；当能力成熟后，应该沉淀为数据持有方长期维护的专有 CLI/API。TAP 的长期价值应保留在跨系统验收、诊断、发布验证、证据收集和长尾补位上。

## 组织现实：数据持有方会建设自己的工具

真实业务中的核心数据入口通常不会自然流向一个横向通用工具。数据持有方有充分动机建设自己的专有 CLI/API：

- ownership 清晰，权限、安全、审计和稳定性责任可以留在数据团队内部
- KPI 和影响力会驱动数据团队把高频查询能力产品化
- 数据团队最理解字段含义、口径、异常解释、缓存策略和诊断路径
- 专有工具能针对具体业务流程优化命令设计和输出结构
- 官方入口更容易获得组织内的信任、权限审批和长期维护承诺

因此，TAP 的合理位置不是和这些官方工具竞争，而是在它们不存在、尚未 Agent-friendly、建设成本暂时不值得、或数据源属于长尾/边缘/第三方场景时提供补位能力。

一个数据入口的自然演进路径可以是：

```text
一次性人工查询
  → TAP 临时/长尾 adapter
  → TAP 验证稳定工作流
  → 数据持有方专有 CLI/API/MCP
  → TAP 只保留桥接、兼容或边缘补位角色
```

这意味着 TAP 的成功标准不应是“所有业务数据都接入 TAP”，而应是“让 Agent 能尽快、低成本、可控地接触那些暂时没有正式 Agent 工具的数据源”。当某个 TAP adapter 证明了高频价值，它反而应该推动数据持有方把能力正式产品化。

## 核心收敛：从 wrapper 到 orchestration

单纯做 wrapper 也不是稳固终局。被包装的一方一旦有动力建设自己的 Agent-friendly CLI/API，就会天然倾向自己提供 schema、JSON 输出、错误码、诊断建议和权限治理。TAP 长期包装单个核心系统，仍然会和系统 owner 发生 ownership 冲突。

因此，TAP 的长期主线应收敛到 orchestration：

```text
系统 owner 的官方 CLI/API/MCP
日志平台 / 指标平台 / BI / 浏览器只读入口 / 测试 runner / 长尾 adapter
        ↓
TAP orchestration：组合、归一化、断言、报告、artifacts
        ↓
Agent / CI / 人类开发者
```

TAP 负责的是把多个已有能力组织成一个业务语义 workflow：

```bash
tap diagnose order --id O123
tap acceptance order-smoke --env staging
tap release verify --service payment --version 1.2.3
tap incident collect --trace-id abc123
tap report campaign-health --account 888
```

这些命令的共同点是：单个系统 owner 很难独立负责完整链路，但 Agent/CI 需要一个稳定入口来执行、判断和收集证据。TAP 的护城河不应是“能访问某个数据源”，而应是“知道一个跨系统业务问题应该查哪些工具、按什么顺序查、如何判断、如何输出给 Agent”。

在这个定位下：

- wrapper 是临时或兼容手段，不是核心终局
- 长尾数据桥接是 orchestration 的 source，不是主叙事
- E2E 验收是 orchestration 的强场景，不是唯一场景
- 官方 Agent-friendly CLI/API 出现后，TAP 应优先复用它，而不是重复封装单点能力
- TAP 的核心产物是 workflow contract：schema、参数、执行计划、结构化结果、错误分类、artifacts 和审计记录

## 生产默认约束：只读

TAP 在生产环境中只服务查询、诊断、汇总、巡检、报表和证据收集类场景，不承载写入动作。

禁止的能力包括：

- 创建、修改、删除业务对象
- 提交表单或触发审批、投放、下线等状态变更
- 执行 `POST`、`PUT`、`PATCH`、`DELETE` 这类写接口
- 执行 `insert`、`update`、`delete`、`drop`、`alter`、`truncate` 等 SQL
- 运行未白名单的 shell 命令或内部 CLI
- 通过浏览器点击触发不可逆业务动作

只读边界不能只依赖 adapter 作者自觉，必须在运行时和基础设施两层同时约束。

测试、预发和沙箱环境可以有受控的 acceptance mode，用于端到端验收。这个模式必须显式启用，并且写动作只能通过白名单 action、fixture、官方测试 API 或专用测试 CLI 执行；每个动作都必须有 schema、幂等键、超时、审计、清理策略和环境隔离。UI 点击、表单填写和模拟人工操作只能作为最后兜底，不应成为 TAP 的主能力。

## 目标场景

TAP 应优先服务跨系统、跨工具、需要结构化判断的业务 workflow：

- 端到端验收：准备测试数据、触发流程、等待异步状态、跨系统检查结果、收集 artifacts、输出 pass/fail
- 业务诊断：围绕订单、广告计划、账户、traceId 等对象，串联业务系统、日志、指标、配置和队列状态
- 发布/变更验证：发布后检查版本、流量、错误率、核心链路、关键业务指标和回滚信号
- 事故证据收集：按 traceId、业务 ID、时间窗口聚合日志、指标、接口返回和相关对象状态
- 长尾数据补位：当某个 workflow 环节没有官方工具时，临时接入 HTTP/Web/浏览器态/第三方 SaaS 数据
- Agent 上下文补全：把分散工具输出整理成稳定 JSON，供 Agent 继续分析、判断和生成下一步动作

如果上述能力已经是高频、核心、强治理场景，并且数据持有方已经提供了专有 CLI/API/MCP，TAP 应优先复用或桥接官方入口，而不是重新实现一套平行数据通道。

## 命令设计原则

默认优先设计业务 workflow 命令，而不是围绕单个数据源堆积查询命令：

```bash
tap diagnose order --id O123
tap acceptance order-smoke --env staging
tap release verify --service payment --version 1.2.3
tap incident collect --trace-id abc123
tap report campaign-health --account 888
```

workflow 命令负责一个明确的业务问题，输出稳定、可判断、可审计。底层可以组合多个原子 source：

```text
order-cli get
payment-cli status
inventory-cli reservation
log query
metric query
browser read-only fetch
```

避免把所有能力塞进类似 `tap ads query --type ... --include ...` 的万能命令。短期看灵活，长期会让输入、输出、权限和失败边界变得不可维护。

## Source 与 provider 扩展方向

### 第一阶段：巩固 HTTP/Web

继续完善当前已有能力：

- 公开 JSON API：`fetch`
- 登录态 API：`navigate` + `evaluate(fetch)`
- 页面 XHR/fetch 捕获：`intercept`
- DOM 数据提取：`evaluate`
- 结构化整理：`select`、`map`、`filter`、`sort`、`limit`

这一阶段的重点是让网页和 HTTP 后台能力稳定变成 JSON source，供 workflow 使用。

### 第二阶段：增加只读数据源 provider

新增 source 不应让 adapter 直接执行任意代码，而应通过受控 provider 暴露查询语义：

```js
{ sql: { datasource: 'ads_readonly', query: 'select ...', params: {} } }
{ log: { source: 'sls', query: 'traceId=...', limit: 100 } }
{ metric: { name: 'ad_cost_qps', tags: { env: 'prod' } } }
```

优先级建议：

| 数据源 | 优先级 | 原因 |
| --- | --- | --- |
| SQL / 数仓 | 高 | 高频查询场景多，天然适合结构化输出 |
| 日志系统 | 高 | 排障价值高，通常已有只读查询权限 |
| 指标系统 | 高 | 巡检和诊断依赖强，查询语义清晰 |
| BI / 报表平台 | 中 | 有 API 时容易接入，只能网页导出时复杂度较高 |
| 内部 RPC | 中 | 依赖协议、鉴权、IDL 和客户端生态 |
| Redis / HBase / Elasticsearch | 中 | 技术可行，但需要更严格的数据和查询限制 |
| Shell / 内部 CLI | 低 | 最通用，也最容易突破只读边界，必须白名单化 |

### 第三阶段：受控 RPC 和内部工具接入

RPC 和内部 CLI 只能以 allowlist 方式接入：

- 明确允许的服务、方法和参数 schema
- 方法名倾向 `get`、`query`、`list`、`search`、`describe`
- 禁止 `create`、`update`、`delete`、`submit`、`approve`、`publish` 等动作语义
- 所有调用带超时、结果大小限制和审计日志

这一阶段适合承载跨系统诊断和验收 workflow，例如同时查询投放状态、预算服务、审核系统、实时指标和错误日志。

### 第四阶段：workflow adapter

在 source 能力稳定后，TAP 应把 adapter 从 data adapter 推进到 workflow adapter：

```js
export default {
  kind: 'workflow',
  goal: 'diagnose_order',
  args: { orderId: { type: 'string', required: true } },
  steps: [
    { run: 'order-cli get', as: 'order' },
    { run: 'payment-cli status', from: 'order.paymentId', as: 'payment' },
    { queryLog: { traceId: '$order.traceId' }, as: 'logs' },
    { queryMetric: { name: 'payment_error_rate' }, as: 'metrics' },
    { check: 'order_payment_consistency' },
    { summarize: 'diagnosis' }
  ],
  output: {
    fields: ['status', 'rootCauseHint', 'evidence', 'nextActions']
  }
}
```

workflow adapter 的重点不是“抓到更多数据”，而是把执行计划、状态等待、检查断言、证据收集、失败提示和输出契约沉淀下来。

## 只读安全模型

TAP 的只读安全模型应包含三层。

第一层是 adapter 静态校验：

- pipeline 只允许白名单 step
- HTTP 默认只允许 GET
- SQL 必须是 SELECT 类查询
- browser trigger 禁止提交类操作
- shell/exec 默认禁用

第二层是 provider 运行时约束：

- 参数化查询，避免字符串拼接注入
- 查询超时
- 最大返回行数
- 最大响应体大小
- 输出字段脱敏
- 错误信息避免泄露凭证

第三层是基础设施权限兜底：

- 数据库使用只读账号
- 日志和指标 token 只有查询权限
- RPC 网关按方法做只读 allowlist
- 内部 CLI 使用专用只读身份
- 所有数据源记录审计日志

只读边界必须由基础设施最终兜底。TAP 的校验用于减少误用，不能成为唯一防线。

## 技术可行性评估

现有 TAP 的执行模型已经具备扩展基础：

- adapter 文件声明命令参数、`output.fields` 输出契约和 pipeline
- `executePipeline` 顺序执行 step
- step 之间通过 `data` 传递结构化结果
- 输出统一走 JSON
- 浏览器能力已经按需打开和关闭会话

因此，扩展 source 和 workflow 能力的主要改造点是：

- 在 executor 中增加新的只读 source step 和 workflow step
- 把每类数据源实现为 provider
- 增加 pipeline 静态校验
- 增加 datasource 配置和凭证读取机制
- 增加超时、limit、审计和错误分类
- 增加 check、waitFor、collect、artifact、summary 等 workflow 语义

整体技术风险中等，安全和治理风险高于代码实现风险。真正的工程重点不是“能不能查”，而是“如何确保只能查、查得有限、查得可审计”。

## 阶段路线

### 近期

- 明确 TAP 的 orchestration 定位
- 明确 TAP 是 workflow 层，不是核心业务数据的终局入口
- 保持 HTTP/Web 能力稳定
- 建立 workflow 命令粒度规范
- 为诊断、验收、发布验证沉淀一组代表性 workflow 命令
- 增加只读 pipeline 校验的设计

### 中期

- 引入 datasource 配置
- 实现 `sql`、`log`、`metric` 三类 provider
- 给 provider 增加 timeout、limit、审计和脱敏能力
- 建立常见业务诊断、验收和发布验证 workflow
- 形成 adapter authoring 的安全检查清单

### 长期

- 支持受控 RPC provider
- 支持内部 CLI allowlist provider
- 建立跨工具 workflow adapter
- 提供更强的 schema 描述和输出契约
- 与 Agent 工具生态集成，但继续保持 CLI 作为稳定底座
- 对已经证明高频价值的 adapter，推动迁移到数据持有方维护的专有 CLI/API/MCP，TAP 保留兼容、桥接和长尾补位能力

## 非目标

TAP 不应该变成：

- 正式业务 API 的替代品
- 通用低代码平台
- 任意脚本执行器
- 写操作自动化工具
- 面向外部合作方的强契约集成平台
- 企业核心业务数据的统一所有者或治理平台
- 替代 Playwright/Cypress 的 UI E2E 测试框架
- 长期包装单个系统核心能力的平行入口

对于强契约、强权限、强治理、跨团队依赖的单系统核心能力，长期仍应由数据持有方建设正式 API、专有 CLI、SDK、OpenAPI schema 或 MCP server。TAP 更适合承载跨工具诊断、端到端验收、发布验证、事故证据收集和 Agent 上下文补全这类 workflow 场景，尤其是那些需要组合多个系统、暂时没有正式工具、暂时不值得产品化、或需要快速验证 Agent workflow 的场景。

## 一句话总结

TAP 的长期方向是：作为 Agent 调用现实业务工具的 orchestration layer，把官方 CLI/API/MCP、日志、指标、浏览器只读入口、测试 runner 和长尾 adapter 组织成可发现、可执行、可判断、可审计的业务 workflow 命令；当某个单点能力成为高频核心能力时，应推动它沉淀为数据持有方维护的专有工具，TAP 保留跨系统编排、兼容迁移和长尾补位角色。
