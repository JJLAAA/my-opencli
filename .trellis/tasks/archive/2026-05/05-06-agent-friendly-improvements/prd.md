# Agent-Friendly Improvements: Help Examples & Fields Mask

## Goal

两个针对 agent 使用场景的 CLI 改进，提升 P10（Help 质量）和 P14（Context Budget）友好性：
1. 每个 adapter command 的 `--help` 输出中增加 Examples 段
2. 支持 `--fields` 参数，允许调用方按需筛选输出字段，减少 agent context 消耗

## Requirements

### 1. Help Examples（P10）

- Adapter 定义中新增可选 `examples` 字段（数组），每个元素是一个 `{ description?, args }` 对象
- `commandHelp()` 在 Options 段之前渲染 Examples 段
- 格式：`tap <site> <command> --arg1 val1 --arg2 val2`，附可选说明行
- 全局/site level help 不变

### 2. Fields Mask（P14）

- 全局保留参数 `--fields`，接受逗号分隔的字段名列表（如 `--fields title,url,date`）
- 在 `printOutput` / `formatJsonEnvelope` 中，若提供 `--fields`，则仅输出指定字段（字段必须是 adapter `output.fields` 中已声明的）
- 未知字段名给出警告（放入 `meta.warnings`），不报错
- `--fields` 不影响 adapter 内部 pipeline 执行，仅在最终输出投影时生效
- `tap schema <site> <command>` 输出的 args 中不包含 `--fields`（它是运行时参数，不是 adapter 定义的一部分）

## Acceptance Criteria

- [ ] adapter 可声明 `examples`，`tap <site> <command> --help` 显示 Examples 段
- [ ] 无 examples 声明的 adapter help 不变（不出现空的 Examples 段）
- [ ] `tap <site> <command> --fields title,url` 仅返回 title、url 两列
- [ ] 指定不存在的字段时，输出 `meta.warnings` 提示，items 数据不受影响
- [ ] `--fields` 与 `--format json` 组合正常工作
- [ ] 现有 adapter 无需修改即可正常运行（向后兼容）

## Technical Notes

- `--fields` 作为全局保留参数，在 `parseArgs()` 中与 `--format` 同级处理
- `formatJsonEnvelope` 接收 `fields` 选项，在 `projectRows` 之后做二次投影
- examples 渲染在 `help.js#commandHelp()` 中处理
