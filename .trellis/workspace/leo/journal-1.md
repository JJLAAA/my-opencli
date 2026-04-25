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
