# TAP 长期规划：面向 Agent 的只读业务数据接入层

## 定位

TAP 的长期定位不是替代正式 API，也不是通用自动化脚本框架，而是面向 Agent 的业务数据适配层。

它把已有业务系统中的数据查询能力封装成稳定、结构化、可组合的 CLI 命令：

```bash
tap <domain> <command> [--key value] [--format json]
```

对 Agent 来说，TAP 提供的是业务语义明确的工具入口，而不是要求 Agent 临时理解网页路径、内部接口、登录态、字段结构和筛选逻辑。

## 核心判断

当前 TAP 以 HTTP、浏览器登录态和页面数据提取为主要能力。这覆盖了大量后台系统场景，但真实业务数据并不总是通过 HTTP 服务完整暴露。广告投放、风控、审核、预算、报表、日志和指标等系统通常还分布在数据库、数仓、日志平台、指标平台、内部 RPC 或专用 CLI 中。

因此，TAP 的长期方向应从“Web/HTTP 适配器”演进为“只读业务数据接入层”。HTTP/Web 仍是一等数据源，但不是唯一数据源。

## 不变约束：只读

TAP 只服务查询、诊断、汇总、巡检和报表类场景，不承载写入动作。

禁止的能力包括：

- 创建、修改、删除业务对象
- 提交表单或触发审批、投放、下线等状态变更
- 执行 `POST`、`PUT`、`PATCH`、`DELETE` 这类写接口
- 执行 `insert`、`update`、`delete`、`drop`、`alter`、`truncate` 等 SQL
- 运行未白名单的 shell 命令或内部 CLI
- 通过浏览器点击触发不可逆业务动作

只读边界不能只依赖 adapter 作者自觉，必须在运行时和基础设施两层同时约束。

## 目标场景

TAP 应优先服务高频、内部、半正式、长尾的数据查询能力：

- 业务对象查询：计划、单元、创意、账户、预算、审核记录
- 投放诊断：状态、消耗、预算、审核、召回、排序、定向、出价
- 运营巡检：异常账户、失败任务、积压队列、配置漂移
- 报表汇总：日报、周报、活动复盘、Top 问题原因
- 排障辅助：按 traceId、业务 ID、时间窗口聚合日志、指标和接口返回
- Agent 上下文补全：把分散数据整理成稳定 JSON 供 Agent 继续分析

## 命令设计原则

默认使用一组清晰的原子命令，而不是一个万能查询命令：

```bash
tap ads campaign --id 123
tap ads account --id 888
tap ads audit-list --status failed --limit 20
tap ads budget-check --account 888
tap ads delivery-diagnose --campaign 123
```

原子命令负责单一资源或单一问题，输出稳定、易组合、易测试。聚合命令只用于已经明确的工作流：

```bash
tap ads diagnose --campaign 123
tap ads account-overview --account 888
tap ads daily-report --date 2026-05-01
```

避免把所有能力塞进类似 `tap ads query --type ... --include ...` 的万能命令。短期看灵活，长期会让输入、输出、权限和失败边界变得不可维护。

## 数据源扩展方向

### 第一阶段：巩固 HTTP/Web

继续完善当前已有能力：

- 公开 JSON API：`fetch`
- 登录态 API：`navigate` + `evaluate(fetch)`
- 页面 XHR/fetch 捕获：`intercept`
- DOM 数据提取：`evaluate`
- 结构化整理：`select`、`map`、`filter`、`sort`、`limit`

这一阶段的重点是让网页和 HTTP 后台能力稳定变成 JSON 输出。

### 第二阶段：增加只读数据源 provider

新增数据源不应让 adapter 直接执行任意代码，而应通过受控 provider 暴露查询语义：

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

这一阶段适合承载跨系统诊断，例如同时查询投放状态、预算服务、审核系统、实时指标和错误日志。

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

因此，增加数据源的主要改造点是：

- 在 executor 中增加新的只读 step
- 把每类数据源实现为 provider
- 增加 pipeline 静态校验
- 增加 datasource 配置和凭证读取机制
- 增加超时、limit、审计和错误分类

整体技术风险中等，安全和治理风险高于代码实现风险。真正的工程重点不是“能不能查”，而是“如何确保只能查、查得有限、查得可审计”。

## 阶段路线

### 近期

- 明确 TAP 的只读定位
- 保持 HTTP/Web 能力稳定
- 建立 adapter 命令粒度规范
- 为高频查询沉淀一组原子命令
- 增加只读 pipeline 校验的设计

### 中期

- 引入 datasource 配置
- 实现 `sql`、`log`、`metric` 三类 provider
- 给 provider 增加 timeout、limit、审计和脱敏能力
- 建立常见业务诊断的聚合命令
- 形成 adapter authoring 的安全检查清单

### 长期

- 支持受控 RPC provider
- 支持内部 CLI allowlist provider
- 建立跨数据源诊断 pipeline
- 提供更强的 schema 描述和输出契约
- 与 Agent 工具生态集成，但继续保持 CLI 作为稳定底座

## 非目标

TAP 不应该变成：

- 正式业务 API 的替代品
- 通用低代码平台
- 任意脚本执行器
- 写操作自动化工具
- 面向外部合作方的强契约集成平台

对于强契约、强权限、强治理、跨团队依赖的核心能力，长期仍应建设正式 API、SDK、OpenAPI schema 或 MCP server。TAP 更适合承载内部只读查询、排障、巡检、报表和 Agent 上下文补全这类低成本工具化场景。

## 一句话总结

TAP 的长期方向是：把散落在 Web、HTTP、数据库、日志、指标和内部服务里的业务数据，以只读、受控、结构化的方式暴露给 Agent，成为 Agent 接触真实业务上下文的稳定 CLI 入口。
