# 记录 TAP 长期定位修正

## Goal

把会议中形成的新判断记录到 TAP 长期规划中：真实业务中的核心数据通常会由数据持有方建设和维护专有 CLI/API，TAP 不应把自己定位成企业业务数据的终局统一入口，而应更清晰地定位为面向 Agent 的轻量适配、桥接和长尾补位工具。

## What I Already Know

* 当前长期规划文档是 `docs/readonly-data-access-roadmap.md`。
* 现有表述强调 TAP 从 Web/HTTP adapter 演进为只读业务数据接入层。
* 用户补充的会议判断是：真实业务数据多数会由数据持有方通过专有 CLI 获取，因为这符合 ownership、KPI、安全、优化和领域语义沉淀的动机。
* 新定位应避免和数据持有方的官方 CLI/API 发生 ownership 冲突。

## Requirements

* 在长期规划中记录这次定位修正。
* 明确 TAP 不应替代数据持有方的专有 CLI/API。
* 说明 TAP 更适合长尾、临时、非正式、尚未 Agent-friendly 的数据入口。
* 说明成熟高频能力应该迁移或沉淀为数据持有方维护的正式 CLI/API。
* 保留 TAP 对 Web/HTTP 和只读结构化访问的价值，但弱化“统一接入所有业务数据”的叙事。

## Acceptance Criteria

* [x] `docs/readonly-data-access-roadmap.md` 包含组织现实和数据 ownership 的讨论。
* [x] 文档明确区分 TAP、专有 CLI/API、正式 MCP/OpenAPI/SDK 的边界。
* [x] 文档的一句话总结反映 TAP 的桥接/补位定位。
* [x] 不修改运行时代码。

## Out of Scope

* 不实现新的 CLI 功能。
* 不修改 README 的主叙事，除非长期规划文档需要引用调整。
* 不设计具体 provider 实现。

## Technical Notes

* 目标文件：`docs/readonly-data-access-roadmap.md`
* 这是文档定位修正任务，不需要外部技术调研。
* Spec update judgment: this task changes product positioning documentation only. It does not introduce executable contracts, command/API signatures, runtime behavior, or implementation conventions, so `.trellis/spec/` does not need an update.
