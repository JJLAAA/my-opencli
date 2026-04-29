# Extend Select Path Syntax

## Goal
Extend TAP's existing `select` path support so adapters can extract useful values from moderately complex nested JSON responses without introducing a full JSONPath/JMESPath dependency.

## Requirements
- Preserve existing dot-path behavior such as `data.items.0.title`.
- Support bracket array index syntax such as `data.items[0].title`.
- Support quoted bracket keys such as `data["hot-list"]` and `data["user.name"]`.
- Support array wildcard projection with `[*]`, such as `data.items[*].title`.
- Support wildcard flattening across nested arrays, such as `groups[*].items[*]`.
- Apply the same selector behavior to standalone `select`, `intercept.select`, and inline `map.select`.
- Keep missing paths deterministic by returning `null`.
- Do not add npm dependencies.

## Acceptance Criteria
- [x] `select: 'data.items.0.title'` still works.
- [x] `select: 'data.items[0].title'` returns the same value as the legacy numeric segment form.
- [x] `select: 'data["hot-list"][*].title'` handles quoted keys and wildcard projection.
- [x] `select: 'groups[*].items[*]'` returns a flattened array of item objects.
- [x] `map: { select: 'data.items[*]', title: '${{ item.title }}' }` maps projected rows.
- [x] Missing paths return `null` instead of the original root data.
- [x] README and README.zh document the enhanced select syntax.
- [x] `bun run build` succeeds.

## Technical Notes
- Current implementation lives in `src/executor.js` as `selectByPath`.
- Implement a small selector tokenizer/evaluator in-place unless extraction becomes necessary for clarity.
- Supported tokens: dot field, bracket index, bracket quoted key, bracket wildcard.
- Wildcard should project over arrays and flatten projected array results by one level.
- Conditions, recursive descent, regex extraction, and full JSONPath/JMESPath expressions are intentionally out of scope.

## Validation Notes
- `TAP_ADAPTERS_DIR=/tmp/tap-select-smoke bun run bin/cli.js demo legacy`
- `TAP_ADAPTERS_DIR=/tmp/tap-select-smoke bun run bin/cli.js demo bracket`
- `TAP_ADAPTERS_DIR=/tmp/tap-select-smoke bun run bin/cli.js demo quoted`
- `TAP_ADAPTERS_DIR=/tmp/tap-select-smoke bun run bin/cli.js demo flatten`
- `TAP_ADAPTERS_DIR=/tmp/tap-select-smoke bun run bin/cli.js demo inline`
- `TAP_ADAPTERS_DIR=/tmp/tap-select-smoke bun run bin/cli.js demo missing-raw`
- `bun run build`
- `TAP_ADAPTERS_DIR=/tmp/tap-select-smoke ./tap demo quoted`
- `TAP_ADAPTERS_DIR=/tmp/tap-select-smoke ./tap demo flatten`
