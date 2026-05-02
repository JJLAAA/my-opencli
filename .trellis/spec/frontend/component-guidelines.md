# Adapter Guidelines

> How adapters are structured in this project.

---

## Overview

Each adapter is a `.js` file with a single default export containing three fields: `args`, `columns`, `pipeline`.

---

## Adapter Structure

```js
export default {
  args: [{ name: 'limit', default: 20 }],
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

### `args`
Array of argument definitions. Each entry: `{ name, default }`.  
`default` is required. String args stay strings; numeric args use number defaults.

```js
args: [
  { name: 'limit', default: 20 },
  { name: 'page', default: 1 },
]
```

### `columns`
Array of column names for table output. Order determines display order.  
Must match keys produced by the final `map` step.

```js
columns: ['rank', 'title', 'author', 'play']
```

### `pipeline`
Array of steps. Each step is a single-key object: `{ op: params }`.

Supported ops:

| Op | Params | Description |
|----|--------|-------------|
| `navigate` | URL string | Open URL in Chrome tab (establishes cookie context) |
| `evaluate` | JS expression string | Run JS in browser page, returns value |
| `fetch` | URL string or `{ url }` | HTTP GET, returns parsed JSON |
| `browserFetch` | `{ url, as? }` | Run browser-context `fetch()` with cookies |
| `foreach` | `{ from, as, concurrency?, steps }` | Run nested steps for each item in an array |
| `mapOne` | object of `{ field: template }` | Transform the current value into one object |
| `map` | object of `{ field: template }` | Transform each item |
| `filter` | JS expression string | Keep items where expression is truthy |
| `limit` | number or template | Slice data to N items |

---

## Template Syntax

Use `${{ expr }}` in string values within `map` and `navigate`/`fetch` params.

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
- **Column names not matching `map` keys** — rows will show empty cells
- **Using hyphens in site/command names** — path convention is no hyphens
