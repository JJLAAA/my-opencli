# TAP

A lightweight CLI tool for executing declarative data pipelines that fetch and transform data from web sources.

> TAP is a simplified version of [opencli](https://github.com/jackwener/opencli). For a more complete implementation with richer features, see the original project.

---

*[中文文档](README.zh.md)*

```
tap <site> <command> [--key value] [--format json|table]
```

## How It Works

TAP separates **what to fetch** from **how to fetch it**:

- **Adapters** (`~/.tap/adapters/<site>/<command>.js`) declare the pipeline — a sequence of steps describing where to get data and how to shape it.
- **Core engine** executes those steps, handles browser sessions, and formats output.

### Execution Flow

```
CLI Args
  └─ Load Adapter from ~/.tap/adapters/<site>/<command>.js
       └─ executePipeline(steps, args, cdpSession?)
            └─ printOutput(data, format, columns)
```

The pipeline runs steps sequentially. Each step receives the output of the previous step as `data` and produces a new `data` for the next.

---

## Installation

**Prerequisites:** [Bun](https://bun.sh) runtime.

```bash
git clone <repo>
cd tap
bun install
bun run build        # produces ./tap binary
```

Move the binary somewhere on your `$PATH`:

```bash
mv tap /usr/local/bin/tap
```

---

## Usage

```bash
# List available sites and commands
tap help

# List commands for a site
tap help bilibili

# Show command options
tap help bilibili hot
# or:
tap bilibili hot --help

# Run a command
tap bilibili hot
tap bilibili hot --limit 10
tap bilibili hot --format table
tap linuxdo news --limit 5
```

### Output Formats

| Flag | Description |
|------|-------------|
| _(default)_ / `--format json` | JSON array for agent-friendly parsing |
| `--format table` | ASCII table for human-readable output |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAP_CDP_ENDPOINT` | `http://localhost:9222` | Chrome DevTools Protocol endpoint for browser-based adapters |
| `TAP_ADAPTERS_DIR` | _(none)_ | Additional directory to search for adapters (takes priority over built-ins and `~/.tap/adapters`) |

### Adapter Search Order

When `TAP_ADAPTERS_DIR` is set:

1. `$TAP_ADAPTERS_DIR/<site>/<command>.js`
2. `<repo>/adapters/<site>/<command>.js` (built-ins)
3. `~/.tap/adapters/<site>/<command>.js`

Without `TAP_ADAPTERS_DIR`:

1. `<repo>/adapters/<site>/<command>.js` (built-ins)
2. `~/.tap/adapters/<site>/<command>.js`

The first match wins.

---

## Adapter Reference

### File Structure

```js
// ~/.tap/adapters/<site>/<command>.js
export default {
  description: 'Short description shown in help.',
  args: [
    { name: 'limit', default: 20, description: 'Max items to return.' },
    { name: 'keyword', required: true, description: 'Search term.' },
  ],
  columns: ['rank', 'title', 'author', 'play'],
  pipeline: [ /* steps */ ],
};
```

| Field | Required | Description |
|-------|----------|-------------|
| `description` | No | Shown in `tap help <site> <command>` |
| `args` | No | CLI params with defaults and descriptions |
| `columns` | No | Table column order; must match map output keys |
| `pipeline` | Yes | Ordered array of steps |

### Pipeline Steps

Each step is an object with a single key naming the operation.

#### `fetch` — HTTP GET

```js
{ fetch: 'https://api.example.com/data' }
// or with template:
{ fetch: { url: 'https://api.example.com/search?q=${{ args.keyword }}' } }
```

Returns parsed JSON. No browser required.

#### `navigate` — Open URL in browser

```js
{ navigate: 'https://example.com' }
```

Waits for `Page.loadEventFired` + 800ms for SPA initialization. Requires Chrome with remote debugging.

#### `evaluate` — Run JS in browser context

```js
{ evaluate: `document.title` }
// or async:
{ evaluate: `(async () => {
  const res = await fetch('/api/data');
  return res.json();
})()` }
```

Replaces `data` with the return value. Runs with full page context (cookies, session).

#### `intercept` — Capture XHR/fetch requests

```js
{ intercept: {
  capture: 'api/timeline',       // URL substring to match
  trigger: 'navigate:https://example.com/feed',  // what action causes the request
  timeout: 8,                    // seconds to wait (default: 8)
  select: 'data.items',         // selector path to sub-select from captured response
}}
```

Patches `window.fetch` and `XMLHttpRequest` in the page to intercept matching requests.

**Trigger prefixes:**

| Prefix | Example |
|--------|---------|
| `navigate:` | `navigate:https://example.com` |
| `evaluate:` | `evaluate:document.querySelector('.load-more').click()` |
| `click:` | `click:.load-more-btn` |
| `scroll` | `scroll` or `scroll:down` / `scroll:up` |

#### `select` — Extract nested values

```js
{ select: 'data.list' }
{ select: 'result.0.items' }
{ select: 'data.items[0].title' }
{ select: 'data["hot-list"][*].title' }
{ select: 'groups[*].items[*]' }
```

Supported selector syntax:

| Syntax | Description |
|--------|-------------|
| `data.items.0.title` | Legacy dot path with numeric array segments |
| `data.items[0].title` | Bracket array index |
| `data["hot-list"]` | Quoted key for names with punctuation or dots |
| `data.items[*].title` | Project one field from every array item |
| `groups[*].items[*]` | Flatten nested arrays by one level per wildcard |

Missing paths return `null`.

#### `map` — Transform array items

```js
{ map: {
  rank:   '${{ index + 1 }}',
  title:  '${{ item.title }}',
  author: '${{ item.owner.name }}',
  play:   '${{ item.stat.view }}',
}}
```

Supports inline `select` to sub-select before mapping:

```js
{ map: {
  select: 'data.list',          // sub-select first
  title: '${{ item.title }}',
}}
```

#### `filter` — Retain items by expression

```js
{ filter: 'item.play > 10000' }
{ filter: 'index < 5' }
```

#### `sort` — Sort array

```js
{ sort: { by: 'play', order: 'desc' } }
{ sort: 'title' }
```

#### `limit` — Slice to N items

```js
{ limit: 20 }
{ limit: '${{ args.limit }}' }
```

### Template Expressions

Templates use `${{ expression }}` syntax. Available context variables:

| Variable | Availability | Description |
|----------|-------------|-------------|
| `item` | `map`, `filter` | Current array element |
| `index` | `map`, `filter` | Zero-based position |
| `args` | All | Parsed CLI args (after applying defaults) |
| `data` | All | Current pipeline data |
| `root` | `map` | Original data before inline select |

---

## Adapter Patterns

### Pattern A — Public JSON API

No browser needed. Direct HTTP fetch.

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['title', 'score'],
  pipeline: [
    { fetch: 'https://api.example.com/top' },
    { select: 'data.list' },
    { map: { title: '${{ item.title }}', score: '${{ item.score }}' } },
    { limit: '${{ args.limit }}' },
  ],
};
```

### Pattern B — Login-gated API (browser cookies)

Navigate first to establish session, then fetch inside browser context.

```js
pipeline: [
  { navigate: 'https://example.com' },
  { evaluate: `(async () => {
    const res = await fetch('/api/feed', { credentials: 'include' });
    return res.json();
  })()` },
  { select: 'data.items' },
  { map: { title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

### Pattern C — Intercepted XHR/fetch

Capture API calls triggered by page interaction.

```js
pipeline: [
  { intercept: {
    capture: '/api/timeline',
    trigger: 'navigate:https://example.com/home',
    timeout: 10,
    select: 'data',
  }},
  { map: { title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

### Pattern D — DOM extraction

Scrape data directly from rendered HTML.

```js
pipeline: [
  { navigate: 'https://example.com/ranking' },
  { evaluate: `
    [...document.querySelectorAll('.item')].map(el => ({
      title: el.querySelector('.title')?.textContent?.trim(),
      link:  el.querySelector('a')?.href,
    }))
  ` },
  { map: { rank: '${{ index + 1 }}', title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

---

## Browser-Based Adapters

Adapters using `navigate`, `evaluate`, or `intercept` require a running Chrome instance with remote debugging enabled:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=~/.chrome-automation-profile \
  --no-first-run \
  --no-default-browser-check

# Linux
google-chrome --remote-debugging-port=9222

# Headless
google-chrome --headless --remote-debugging-port=9222
```

TAP auto-detects whether an adapter needs the browser by scanning its pipeline steps. A new tab is opened per run and closed when done.

---

## Building Adapters with AI

TAP ships with a Claude Code skill (`tap-adapter-author`) that guides you through the full adapter authoring loop — from site reconnaissance to a working `tap <site> <command>` output.

### Setup

Install [Claude Code](https://claude.ai/code), then in this repo:

```bash
# The skill is at: .claude/skills/tap-adapter-author/
# It's automatically available in Claude Code sessions
```

The skill depends on the **chrome-devtools MCP** for automated reconnaissance (network monitoring and DOM inspection). Two manual steps are required before using it:

1. **Configure chrome-devtools MCP** in your Claude Code settings.

2. **Launch Chrome with remote debugging and log in** to any sites you plan to scrape:

   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir=~/.chrome-automation-profile \
     --no-first-run \
     --no-default-browser-check
   ```

   The skill reuses your existing browser session — it does not handle authentication itself.

> **Planned**: automate both steps so no manual setup is needed.

### Workflow

Invoke the skill and describe what you want:

```
/tap-adapter-author

I want to fetch the top posts from Hacker News.
```

The skill will:

1. **Identify the fetch pattern** — public API, login-gated, intercepted XHR, or DOM scraping
2. **Validate the endpoint** — confirm the API returns the expected data
3. **Decode the field structure** — map response fields to output columns
4. **Assemble the pipeline** — produce a complete adapter file
5. **Install it** — write to `~/.tap/adapters/<site>/<command>.js`
6. **Verify** — run `tap <site> <command>` and confirm output

### Decision Tree

```
What data do you want?
  │
  ├─ Public JSON API (curl works)          → Pattern A: direct fetch
  ├─ Needs browser login/session           → Pattern B: navigate + evaluate(fetch)
  ├─ XHR hidden behind page interaction    → Pattern C: intercept
  └─ Data only in DOM                      → Pattern D: navigate + evaluate(DOM)
```

If stuck, the skill has a fallback path for each failure mode (403, empty array, missing fields, etc).

---

## Examples

### Built-in: Bilibili Hot Videos

```bash
tap bilibili hot
tap bilibili hot --limit 5
tap bilibili hot --format table
```

```json
[
  {
    "rank": "1",
    "title": "...",
    "author": "...",
    "play": "1234567"
  }
]
```

### Built-in: Linux.do News

```bash
tap linuxdo news
tap linuxdo news --limit 10
```

---

## Project Structure

```
tap/
├── bin/cli.js              # Entry point — delegates to src/cli.js
├── src/
│   ├── cli.js              # Arg parsing, help routing, pipeline orchestration
│   ├── executor.js         # Pipeline execution engine
│   ├── cdp.js              # Chrome DevTools Protocol session
│   ├── adapters.js         # Adapter discovery and loading
│   ├── help.js             # Help text generation
│   └── output.js           # Table / JSON formatter
└── adapters/               # Built-in adapters
    ├── bilibili/hot.js
    └── linuxdo/news.js
```

User adapters live in `~/.tap/adapters/` and take precedence over built-ins when `TAP_ADAPTERS_DIR` is not set.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `ws` ^8.0.0 | WebSocket client for CDP communication |

Runtime: [Bun](https://bun.sh) (build + execution). The compiled binary is self-contained and does not require Bun at runtime.
