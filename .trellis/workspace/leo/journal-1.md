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

Completed and committed setup/browser/doctor CLI work in `99f7788`. The session added explicit local TAP initialization, agent Chrome lifecycle commands, diagnostics, npm package behavior cleanup, and matching README/spec documentation.

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

- [OK] `bun run build`
- [OK] `bun run build:npm`
- [OK] `git diff --check`
- [OK] `tap setup` first run, repeated run, and `--force` with temporary HOME directories
- [OK] `tap doctor` setup diagnostics with expected CDP failure while Chrome is not running
- [OK] `tap browser status` expected failure path when CDP is unavailable
- [OK] `node npm/run.js setup` against npm package layout
- [OK] `node npm/install.js` did not create user TAP state
- [WARN] `pnpm lint`, `pnpm type-check`, and `pnpm test` unavailable because `pnpm` is not installed and repo scripts are not defined
- [WARN] Real `tap browser start/stop` not exercised to avoid launching GUI Chrome during finish checks

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


## Session 8: Explicit skill installation

**Date**: 2026-04-30
**Task**: Explicit skill installation
**Branch**: `main`

### Summary

Made tap-adapter-author skill installation explicit via tap skill install for claude-code and codex, removed automatic assistant-directory writes from npm postinstall, updated publishing/user docs, and captured the new CLI contract in backend specs.

### Main Changes

- Added `src/skills.js` with explicit `tap skill install <claude-code|codex> [--target dir] [--force]` support.
- Routed `tap skill` and `tap help skill install` before adapter execution in `src/cli.js`.
- Removed automatic `~/.claude/skills/` writes from `npm/install.js`; npm packages still bundle `skills/tap-adapter-author/`.
- Updated `README.md`, `README.zh.md`, and `docs/publishing.md` with explicit installation instructions.
- Updated backend specs with the side-command contract and the no assistant-specific postinstall rule.

### Git Commits

| Hash | Message |
|------|---------|
| `08345b5` | (see git log) |

### Testing

- [OK] `bun run build`
- [OK] `bun run build:npm`
- [OK] `bun run bin/cli.js skill install --help`
- [OK] `bun run bin/cli.js skill install codex --target /tmp/tap-finish-skill --force`
- [OK] `npm/binaries/tap-darwin-arm64 skill install codex --target /tmp/tap-finish-npm-skill --force`
- [OK] Invalid target and missing `--target` value return clean CLI errors
- [OK] `git diff --check`

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: Add setup browser doctor commands

**Date**: 2026-04-30
**Task**: Add setup browser doctor commands
**Branch**: `main`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| CLI setup | Added explicit `tap setup` to create `~/.tap`, config, logs, and install bundled adapters without overwriting by default. |
| Browser runtime | Added `tap browser start/status/stop` using a dedicated automation Chrome profile and CDP endpoint checks. |
| Diagnostics | Added `tap doctor` with actionable pass/fail checks for local state, config, bundled adapters, Chrome, and CDP. |
| npm install | Removed implicit `~/.tap` writes from npm `postinstall`; npm package wrapper now preserves child exit status. |
| Docs/spec | Updated English/Chinese README docs and backend code-spec contracts for setup/browser/doctor commands. |

**Verification**:
- `bun run build` passed
- `bun run build:npm` passed
- `git diff --check` passed
- `tap setup` first run, repeated run, and `--force` behavior verified with temporary HOME directories
- `tap doctor` verified to pass local setup checks and fail CDP when agent Chrome is not running
- `tap browser status` verified to fail cleanly when CDP is unavailable
- `node npm/run.js setup` verified against npm package layout
- `node npm/install.js` verified not to create user TAP state

**Notes**:
- `pnpm lint`, `pnpm type-check`, and `pnpm test` could not run because `pnpm` is unavailable in the environment and the repo does not define those scripts.
- Real `tap browser start/stop` lifecycle was not exercised to avoid launching a GUI Chrome process during finish checks.


### Git Commits

| Hash | Message |
|------|---------|
| `99f7788` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Unify bundled skill asset layout

**Date**: 2026-04-30
**Task**: Unify bundled skill asset layout
**Branch**: `main`

### Summary

Moved bundled tap-adapter-author skill into TAP-owned skills/ layout, updated skill resolution to use TAP_PACKAGE_ROOT/package roots, adjusted npm wrapper/build copy path, and verified source, standalone binary, and npm wrapper installs for Codex and Claude Code.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `312e3f3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: Schema-aware JSON output

**Date**: 2026-05-01
**Task**: Schema-aware JSON output
**Branch**: `main`

### Summary

Implemented schema-aware JSON envelopes for TAP output, required explicit adapter output.fields, removed old built-in adapters, updated tap-adapter-author schema confirmation workflow, and synchronized docs/specs.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `db6fa38` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 12: JSON-only output and argument validation

**Date**: 2026-05-02
**Task**: JSON-only output and argument validation
**Branch**: `main`

### Summary

Removed public table output support, made JSON the only CLI output format, added required adapter argument validation, and updated TAP docs/help text.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cd5fef4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 13: Use IPv4 loopback for default CDP endpoint

**Date**: 2026-05-02
**Task**: Use IPv4 loopback for default CDP endpoint
**Branch**: `main`

### Summary

Changed TAP's default CDP endpoint from localhost to 127.0.0.1, synchronized README/docs/spec references, verified setup output and build, then pushed the commit.

### Main Changes

- Updated `DEFAULT_CDP_ENDPOINT` in `src/config.js` from `http://localhost:9222` to `http://127.0.0.1:9222`.
- Synchronized the default endpoint in English/Chinese README files, `CLAUDE.md`, architecture infographic HTML/SVG, and backend spec documentation.
- Confirmed no `localhost:9222` references remain in the relevant runtime/docs/spec files.

### Git Commits

| Hash | Message |
|------|---------|
| `e69b6f0` | (see git log) |

### Testing

- [OK] `HOME=/private/tmp/tap-verify-cdp-default bun run bin/cli.js setup --force`
- [OK] Verified generated config contains `"cdpEndpoint": "http://127.0.0.1:9222"`
- [OK] `bun run build`
- [OK] `git diff --check`

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 14: Add multi-request adapter pipeline primitives

**Date**: 2026-05-02
**Task**: Add multi-request adapter pipeline primitives
**Branch**: `main`

### Summary

Implemented named state, foreach fan-out, mapOne, and browserFetch for multi-request TAP adapters; updated README, adapter-author skill docs, specs, and task PRD; verified old pipeline compatibility, new list-detail pipeline, CLI JSON envelope, build, and diff check.

### Main Changes

- Added named pipeline state with `as` and source selection with `from`.
- Added `foreach` with bounded concurrency for list-detail and enrichment pipelines.
- Added `mapOne` for transforming a single nested result and `browserFetch` for cookie-backed API requests in browser context.
- Updated recursive browser-session detection for nested `foreach` steps.
- Updated README, Chinese README, adapter-author skill references, Trellis specs, and the task PRD.

### Git Commits

| Hash | Message |
|------|---------|
| `f07f83b` | (see git log) |

### Testing

- [OK] Existing linear pipeline smoke test via direct `executePipeline`
- [OK] New `as` / `from` / `foreach` smoke test via direct `executePipeline`
- [OK] CLI JSON envelope test with temporary adapter in `/private/tmp/tap-multi-http-adapters`
- [OK] `bun run build`
- [OK] `git diff --check`

### Status

[OK] **Completed**

### Next Steps

- None - task complete
