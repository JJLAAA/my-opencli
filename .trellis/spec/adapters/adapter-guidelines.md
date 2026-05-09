# Adapter Guidelines

> How adapters are structured in this project.

---

## Overview

Each adapter is a `.js` file with a single default export. The current command contract is `description?`, `args`, `output.fields`, optional `columns`, and `pipeline`.

---

## Adapter Structure

```js
export default {
  description: 'List hot videos.',
  args: [
    { name: 'limit', type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Max items to return.' },
  ],
  output: {
    type: 'list',
    itemName: 'video',
    fields: {
      rank: { type: 'integer', description: 'One-based rank in the result set.' },
      title: { type: 'string', description: 'Video title.' },
      author: { type: 'string', description: 'Video author.' },
      play: { type: 'integer', description: 'Play count.' },
    },
  },
  columns: ['rank', 'title', 'author', 'play'],
  pipeline: [
    { navigate: 'https://www.bilibili.com' },
    { evaluate: `(async () => {
      const res = await fetch('https://api.bilibili.com/...', { credentials: 'include' });
      const data = await res.json();
      return (data?.data?.list || []).map(v => ({ title: v.title, ... }));
    })()` },
    { map: {
      rank:   '${{ index + 1 }}',
      title:  '${{ item.title }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
```

---

## Field Conventions

### `description`
Optional short command description shown in help and schema output.

### `args`
Array of argument definitions. Declare enough metadata for an agent to call the command without guessing.

Common fields:

```js
args: [
  { name: 'limit', type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Max items to return.' },
  { name: 'sort', enum: ['hot', 'new'], default: 'hot', description: 'Sort order.' },
  { name: 'keyword', required: true, description: 'Search term.' },
]
```

Unknown flags, invalid types, enum mismatches, out-of-range numbers, and missing required args produce structured JSON usage errors before the adapter runs.

### JSON Output Contract
Required for JSON output. The runtime does not infer field meaning from row keys.

```js
output: {
  type: 'list',
  itemName: 'item',
  fields: {
    rank: { type: 'integer', description: 'One-based rank in the returned result set.' },
    title: { type: 'string', description: 'Item title.' },
  },
}
```

Each field entry must be an object with:

- `type`: non-empty string used in the JSON schema
- `description`: non-empty human/agent-facing description

JSON envelopes contain `meta`, `schema`, and `items`. `items` only includes declared `output.fields`; extra fields produced by the pipeline are dropped with a warning, and missing declared fields are returned as `null` with a warning.

### `columns`
Optional array of column names for display-oriented contexts. When present, order determines display order. Names must align with the keys produced by the final `map` step and with declared `output.fields`.

```js
columns: ['rank', 'title', 'author', 'play']
```

### `pipeline`
Array of steps. Each step is a single-key object: `{ op: params }`.

Supported ops:

| Op | Params | Description |
|----|--------|-------------|
| `navigate` | URL string | Open URL in Chrome tab (establishes cookie context) |
| `evaluate` | JS expression string or `{ code, as? }` | Run JS in browser page, returns value |
| `fetch` | URL string or `{ url }` | HTTP GET, returns parsed JSON |
| `browserFetch` | `{ url, as?, method?, headers?, body?, credentials? }` | Run browser-context `fetch()` with cookies |
| `intercept` | `{ capture, trigger?, timeout?, select?, as? }` | Capture matching XHR/fetch responses after a trigger |
| `select` | path string or `{ from?, path?, as? }` | Extract a nested value from current data or named state |
| `foreach` | `{ from, as, concurrency?, steps }` | Run nested steps for each item in an array |
| `mapOne` | object of `{ field: template }` | Transform the current value into one object |
| `map` | object of `{ field: template }` | Transform each item |
| `filter` | JS expression string | Keep items where expression is truthy |
| `sort` | field string or `{ by, order? }` | Sort an array; `order: 'desc'` reverses |
| `limit` | number or template | Slice data to N items |

---

## Template Syntax

Use `${{ expr }}` in string values within `map`, `mapOne`, and URL params.

Available variables:
- `item` — current array item (in `map`, `filter`)
- `index` — 0-based index (in `map`, `filter`)
- `args` — parsed CLI args object
- `data` — current pipeline data (in `navigate`, `fetch` params)
- `state` — named results saved by `as`

### Named State and Multi-Request Pipelines

Use only three concepts for multi-request adapters:

- `as` saves a step result under a name.
- `from` reads current data or a named state path.
- `foreach` iterates an array and collects nested step results.

```js
pipeline: [
  { fetch: { url: 'https://api.example.com/items', as: 'list' } },
  { select: { from: 'list', path: 'items', as: 'items' } },
  {
    foreach: {
      from: 'items',
      as: 'details',
      concurrency: 5,
      steps: [
        { fetch: { url: 'https://api.example.com/items/${{ item.id }}' } },
        { mapOne: {
          title: '${{ item.title }}',
          status: '${{ data.status }}',
        }},
      ],
    },
  },
  { select: { from: 'details' } },
]
```

Keep existing simple pipelines unchanged. Do not introduce custom helper functions in adapters for list-detail fetching; prefer `as` / `from` / `foreach`.

```js
{ map: {
  rank:  '${{ index + 1 }}',
  title: '${{ item.title }}',
  url:   '${{ args.baseUrl }}/item/${{ item.id }}',
}}
```

---

## CDP Adapters (navigate + evaluate)

When the adapter needs browser cookies (logged-in APIs), use `navigate` to establish context, then `evaluate` to call the API from within the page:

```js
{ navigate: 'https://site.com' },           // sets cookie context
{ evaluate: `(async () => {
  const res = await fetch('/api/...', { credentials: 'include' });
  return (await res.json()).items;
})()` },
```

The `evaluate` string must be a self-contained JS expression that returns a value (or a Promise).

For plain API requests that only need browser cookies, prefer `browserFetch` over an inline `evaluate` fetch:

```js
{ navigate: 'https://site.com' },
{ browserFetch: { url: '/api/items', as: 'itemsResponse' } },
{ select: { from: 'itemsResponse', path: 'items' } },
```

---

## Common Mistakes

- **Forgetting `credentials: 'include'`** in `evaluate` fetch calls — cookies won't be sent
- **Using `export const` instead of `export default`** — CLI expects `default`
- **Missing `output.fields`** — JSON output fails adapter contract validation
- **Field names not matching `map` keys** — JSON output returns `null` for missing declared fields or drops undeclared fields
- **`columns` not aligned with `output.fields`** — display order drifts from the machine-readable schema
- **Using hyphens in site/command names** — path convention is no hyphens
