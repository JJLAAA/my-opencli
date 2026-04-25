# Error Handling

> How errors are handled in this project.

---

## Overview

Errors fall into two categories:
1. **User errors** (bad args, missing adapter) — print to stderr + `process.exit(1)`
2. **Runtime errors** (CDP failure, network, evaluate exception) — propagate naturally, cleaned up in `finally`

---

## Error Handling Patterns

### User errors — fail fast with a message

```js
// bin/cli.js
if (!site || !command) {
  console.error('Usage: tap <site> <command> [--key value] [--format table|json]');
  process.exit(1);
}

if (!existsSync(adapterPath)) {
  console.error(`Adapter not found: ${adapterPath}`);
  process.exit(1);
}
```

### Runtime errors — try/finally for cleanup, let errors bubble

```js
// bin/cli.js
try {
  if (needsBrowser) ({ session, targetId, base } = await openSession());
  const result = await executePipeline(adapter.pipeline, args, session);
  printOutput(result, format, adapter.columns);
} finally {
  session?.close();
  if (targetId) await closeTab(base, targetId);
}
```

### CDP evaluate errors — throw with description

```js
// src/cdp.js
if (result.exceptionDetails) {
  throw new Error(result.exceptionDetails.exception?.description ?? 'Evaluation failed');
}
```

### Unknown pipeline ops — throw immediately

```js
// src/executor.js
throw new Error(`Unknown pipeline step: "${op}"`);
```

---

## closeTab is fire-and-forget

`closeTab` swallows its own errors — tab cleanup should never crash the process:

```js
export async function closeTab(base, targetId) {
  try { await httpRequest(`${base}/json/close/${targetId}`, 'GET'); } catch {}
}
```

---

## Common Mistakes

- **Don't catch errors in executor/cdp** unless you can recover. Let them propagate to the `finally` in `bin/cli.js` so cleanup always runs.
- **Don't throw from `closeTab`** — it's a best-effort cleanup.
- **Don't add fallback data** (empty arrays, null returns) when a step genuinely failed. Fail loudly.
