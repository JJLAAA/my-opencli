# 记录 TAP 长期定位修正

## Goal

把会议中形成的新判断记录到 TAP 长期规划中：真实业务中的核心数据通常会由数据持有方建设和维护专有 CLI/API，TAP 不应把自己定位成企业业务数据的终局统一入口，也不应长期包装单个系统的核心能力，而应更清晰地定位为面向 Agent 的业务工具编排层。桥接和 wrapper 是过渡/补位手段，长期主线应收敛到跨工具 orchestration。

## What I Already Know

* 当前长期规划文档是 `docs/readonly-data-access-roadmap.md`。
* 现有表述强调 TAP 从 Web/HTTP adapter 演进为只读业务数据接入层。
* 用户补充的会议判断是：真实业务数据多数会由数据持有方通过专有 CLI 获取，因为这符合 ownership、KPI、安全、优化和领域语义沉淀的动机。
* 新定位应避免和数据持有方的官方 CLI/API 发生 ownership 冲突。
* 进一步讨论后的判断是：单纯 wrapper 也不是稳固终局，因为被 wrap 的系统 owner 有动力建设自己的 Agent-friendly CLI/API。
* TAP 更长期的价值应放在跨系统验收、诊断、发布验证、证据收集和长尾补位这些 orchestration 场景。

## Requirements

* 在长期规划中记录这次定位修正。
* 明确 TAP 不应替代数据持有方的专有 CLI/API。
* 说明 TAP 更适合长尾、临时、非正式、尚未 Agent-friendly 的数据入口。
* 说明成熟高频能力应该迁移或沉淀为数据持有方维护的正式 CLI/API。
* 保留 TAP 对 Web/HTTP 和只读结构化访问的价值，但弱化“统一接入所有业务数据”的叙事。
* 明确 TAP 的长期主线应收敛到 orchestration：组合已有 CLI/API/MCP、日志、指标、浏览器只读入口、测试 runner 和长尾 adapter。
* 明确 E2E 验收是 orchestration 的强场景，但不是唯一场景。
* 明确生产默认只读，测试/预发 acceptance mode 可在强约束下执行白名单动作，避免滑向 RPA。

## Acceptance Criteria

* [x] `docs/readonly-data-access-roadmap.md` 包含组织现实和数据 ownership 的讨论。
* [x] 文档明确区分 TAP、专有 CLI/API、正式 MCP/OpenAPI/SDK 的边界。
* [x] 文档的一句话总结反映 TAP 的 orchestration 定位。
* [x] 不修改运行时代码。
* [x] 文档记录 wrapper 的局限和 orchestration 的长期收敛方向。

## Out of Scope

* 不实现新的 CLI 功能。
* 不修改 README 的主叙事，除非长期规划文档需要引用调整。
* 不设计具体 provider 实现。

## Technical Notes

* 目标文件：`docs/readonly-data-access-roadmap.md`
* 这是文档定位修正任务，不需要外部技术调研。
* Spec update judgment: this task changes product positioning documentation only. It does not introduce executable contracts, command/API signatures, runtime behavior, or implementation conventions, so `.trellis/spec/` does not need an update.
