# Quality Guidelines

> Code quality standards for adapters.

---

## Overview

Adapters are simple data files. The bar is: correct shape, correct pipeline ops, predictable output.

---

## Required Patterns

- **Single default export** — adapter modules must export the command object as `default`
- **Explicit `output.fields`** — every JSON-producing adapter must declare at least one field, and each field must include non-empty `type` and `description`
- **Args are self-describing** — declare defaults, required markers, descriptions, type/enum/range metadata where they affect invocation
- **Final `map` aligns with schema** — keys produced by the final mapping step should match declared `output.fields`
- **Optional `columns` aligns with schema** — when `columns` is present, names must match final row keys and declared `output.fields`
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
- [ ] JSON output has `meta`, `schema`, and `items`
- [ ] `schema.items.properties` matches declared `output.fields`
- [ ] `items` contain expected declared fields
- [ ] `meta.warnings` does not report missing declared fields or dropped undeclared fields unless intentional
- [ ] `columns`, when present, align with final `map` keys and `output.fields`
- [ ] Browser tab is closed after run (check Chrome task manager)

---

## Common Mistakes

- **Schema mismatch** — `output.fields.play_count` but `map` produces `play` -> JSON warns that `play_count` is missing and `play` was dropped
- **Missing `await` in `evaluate`** — async evaluate string must be `(async () => { ... })()`
- **Wrong CDP endpoint** — set `TAP_CDP_ENDPOINT` if Chrome isn't on default port 9222
- **Overcomplicated multi-request adapters** — prefer named state and `foreach`; keep `evaluate` for DOM extraction or page-specific logic that cannot be represented declaratively
