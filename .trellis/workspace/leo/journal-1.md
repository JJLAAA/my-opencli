# Journal - leo (Part 1)

> AI development session journal
> Started: 2026-04-23

---



## Session 1: Migrate to Bun single executable with external adapters

**Date**: 2026-04-25
**Task**: Migrate to Bun single executable with external adapters
**Branch**: `main`

### Summary

把 CLI 从 Node.js 迁移为 Bun 编译的单一可执行文件。更新 shebang 为 bun，适配器路径改为 ~/.tap/adapters/（支持 TAP_ADAPTERS_DIR 覆盖），添加 build 脚本，新增 linuxdo/news.js 适配器，排除编译产物出 git。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4f98106` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Add intercept and transform pipeline steps

**Date**: 2026-04-25
**Task**: Add intercept and transform pipeline steps
**Branch**: `main`

### Summary

(Add summary)

### Main Changes

| 变更 | 说明 |
|------|------|
| `intercept` step | 注入 fetch/XHR 拦截器，支持 navigate/evaluate/click/scroll 触发，捕获匹配 URL 的网络响应 |
| `select` step | dot-path 深层取值，支持数字索引访问数组 |
| `sort` step | 按字段排序，asc/desc，localeCompare 自然排序 |
| `map` 改进 | 支持 inline select 子键，新增 data/root 模板上下文变量 |
| `filter` 改进 | 表达式上下文新增 data 变量 |
| CDPSession 扩展 | 新增 installInterceptor、waitForCapture、getInterceptedRequests、click、scroll 方法 |
| env var 重命名 | OPENCLI_CDP_ENDPOINT → TAP_CDP_ENDPOINT |
| spec 更新 | quality-guidelines.md 支持操作列表加入新 step |

**测试验证**：navigate to `about:blank` + evaluate trigger fetch → intercept 成功捕获 jsonplaceholder API 响应并输出表格。

**Updated Files**:
- `src/cdp.js`
- `src/executor.js`
- `bin/cli.js`
- `.trellis/spec/backend/quality-guidelines.md`（及其他 spec 填写）


### Git Commits

| Hash | Message |
|------|---------|
| `edd2692` | (see git log) |
| `79847db` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: CLI help & command discovery

**Date**: 2026-04-28
**Task**: CLI help & command discovery
**Branch**: `main`

### Summary

Extracted CLI logic into src modules (cli.js, adapters.js, help.js), implemented global/site/command help, added README, npm packaging scripts

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `40b7c2e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Close CLI help discovery task

**Date**: 2026-04-28
**Task**: Close CLI help discovery task
**Branch**: `main`

### Summary

(Add summary)

### Main Changes

| Area | Description |
|------|-------------|
| Task closure | Marked `04-27-cli-help-discovery` complete and archived it under `.trellis/tasks/archive/2026-04/` |
| Validation | Re-verified global help, site help, command help, user-facing error exits, and `bun run build` |
| Execution path | Confirmed the CLI still executes adapter pipelines via a temporary adapter mounted through `TAP_ADAPTERS_DIR` |

**Updated Files**:
- `.trellis/tasks/archive/2026-04/04-27-cli-help-discovery/task.json`
- `.trellis/tasks/archive/2026-04/04-27-cli-help-discovery/prd.md`
- `.trellis/tasks/archive/2026-04/04-27-cli-help-discovery/check.jsonl`
- `.trellis/tasks/archive/2026-04/04-27-cli-help-discovery/debug.jsonl`
- `.trellis/tasks/archive/2026-04/04-27-cli-help-discovery/implement.jsonl`
- `.trellis/tasks/archive/2026-04/04-27-cli-help-discovery/tap-config-help-flow.drawio`
- `.trellis/tasks/archive/2026-04/04-27-cli-help-discovery/tap-config-help-flow.png`


### Git Commits

| Hash | Message |
|------|---------|
| `7f60f72` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Default TAP output to JSON

**Date**: 2026-04-29
**Task**: Default TAP output to JSON
**Branch**: `main`

### Summary

(Add summary)

### Main Changes

| Area | Description |
|------|-------------|
| CLI behavior | Changed omitted `--format` from table to JSON so command output is agent-friendly by default |
| Help text | Updated global, site, and command help to show `--format json|table` and explain JSON default behavior |
| Documentation | Updated English and Chinese README examples and output format tables to document JSON as default and table as opt-in |
| Task tracking | Added and archived `04-28-agent-friendly-json-default` with PRD, acceptance criteria, context files, and validation notes |

**Verification**:
- `bun run build`
- `python3 ./.trellis/scripts/task.py validate .trellis/tasks/04-28-agent-friendly-json-default`
- `TAP_ADAPTERS_DIR=/tmp/tap-agent-output bun run bin/cli.js demo items`
- `TAP_ADAPTERS_DIR=/tmp/tap-agent-output bun run bin/cli.js demo items --format table`
- `TAP_ADAPTERS_DIR=/tmp/tap-agent-output bun run bin/cli.js --help`
- Unknown command path returned exit code `1`

**Updated Files**:
- `src/cli.js`
- `src/help.js`
- `README.md`
- `README.zh.md`
- `.trellis/tasks/archive/2026-04/04-28-agent-friendly-json-default/`


### Git Commits

| Hash | Message |
|------|---------|
| `85c69b6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: Extend select path syntax

**Date**: 2026-04-29
**Task**: Extend select path syntax
**Branch**: `main`

### Summary

Extended TAP selector paths with bracket indexes, quoted keys, wildcard projection, nested wildcard flattening, deterministic null for missing paths, and README documentation updates.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9795d42` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Prioritize user adapters

**Date**: 2026-04-29
**Task**: Prioritize user adapters
**Branch**: `main`

### Summary

Changed adapter resolution so user-installed adapters override built-in adapters by default, while `TAP_ADAPTERS_DIR` remains the highest-priority override path.

### Main Changes

- Updated `src/adapters.js` search order to `$TAP_ADAPTERS_DIR`, then `~/.tap/adapters`, then built-in `adapters`.
- Synchronized `README.md` and `README.zh.md` with the new adapter search order.
- Added an executable adapter resolution contract to `.trellis/spec/frontend/directory-structure.md`, including priority rules, validation cases, and required test points.

### Git Commits

| Hash | Message |
|------|---------|
| `d9eee02` | (see git log) |

### Testing

- [OK] `bun run build`
- [OK] Manual `resolveAdapterPath()` checks for user-over-built-in priority, `TAP_ADAPTERS_DIR` priority, and missing-command `null`
- [OK] `git diff --check`

### Status

[OK] **Completed**

### Next Steps

- None - task complete
