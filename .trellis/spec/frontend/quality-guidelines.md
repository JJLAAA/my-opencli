# Quality Guidelines

> Code quality standards for adapters.

---

## Overview

Adapters are simple data files. The bar is: correct shape, correct pipeline ops, predictable output.

---

## Required Patterns

- **Single default export** — `export default { args, columns, pipeline }`
- **`args` has defaults** — every arg must have a `default` value; CLI does not prompt
- **`columns` matches `map` output keys** — column names must exactly match the keys produced by the final `map` step
- **`limit` is last** — if a `limit` step is present, it goes after `map`
- **`credentials: 'include'`** — always include in `evaluate` fetch calls that need cookies
- **Simple multi-request DSL** — use `as`, `from`, and `foreach` for list-detail or enrichment pipelines instead of hiding request orchestration in one large `evaluate` string

---

## Forbidden Patterns

- **No `export const` / named exports** — must be `export default`
- **No side effects at module load** — adapter file is `import()`-ed; all logic must be in `pipeline`
- **No external npm imports** — adapters run in Bun's ESM context; only standard APIs and browser globals (in `evaluate`) are available
- **No hyphens in site or command names** — use `linuxdo` not `linux-do`, `hot` not `hot-videos`

---

## Testing an Adapter

```bash
# Install adapter
mkdir -p ~/.tap/adapters/example
cp /path/to/example/list.js ~/.tap/adapters/example/list.js

# Test output
./tap example list --limit 5

# Test JSON output
./tap example list --format json
```

Verify:
- [ ] Returns expected number of rows
- [ ] All columns populated (no empty cells)
- [ ] JSON output is valid
- [ ] Browser tab is closed after run (check Chrome task manager)

---

## Common Mistakes

- **Column name mismatch** — `columns: ['play_count']` but `map` produces `play` → empty column
- **Missing `await` in `evaluate`** — async evaluate string must be `(async () => { ... })()`
- **Wrong CDP endpoint** — set `TAP_CDP_ENDPOINT` if Chrome isn't on default port 9222
- **Overcomplicated multi-request adapters** — prefer named state and `foreach`; keep `evaluate` for DOM extraction or page-specific logic that cannot be represented declaratively
