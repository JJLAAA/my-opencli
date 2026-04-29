# Directory Structure

> How adapters are organized in this project.

---

## Overview

"Frontend" in TAP refers to **adapters** — the user-facing DSL files that define what to fetch and how to transform it. Adapters are the extension point; the core engine is backend.

---

## Directory Layout

```
adapters/
├── bilibili/
│   └── hot.js       # bilibili hot videos
└── linuxdo/
    └── news.js      # linux.do news feed
```

At runtime, adapters are searched in this order:

1. `$TAP_ADAPTERS_DIR/<site>/<command>.js` when `TAP_ADAPTERS_DIR` is set
2. `~/.tap/adapters/<site>/<command>.js`
3. `<repo>/adapters/<site>/<command>.js` for built-in adapters

The first matching file wins, so user adapters override built-ins by default.

---

## Adapter Resolution Contract

### 1. Scope / Trigger

Use this contract when changing adapter discovery, adding an adapter source, or documenting adapter installation.

### 2. Signatures

- Runtime function: `getAdapterDirectories()` returns existing directories in search order.
- Runtime function: `resolveAdapterPath(site, command)` returns the first matching `<site>/<command>.js` path or `null`.
- Environment key: `TAP_ADAPTERS_DIR` optionally adds a highest-priority adapter root.

### 3. Contracts

- With `TAP_ADAPTERS_DIR`: search `$TAP_ADAPTERS_DIR`, then `~/.tap/adapters`, then built-ins.
- Without `TAP_ADAPTERS_DIR`: search `~/.tap/adapters`, then built-ins.
- Duplicate directory paths are de-duplicated before filtering.
- Missing directories are ignored.
- The first existing adapter file wins; later directories do not override it.

### 4. Validation & Error Matrix

| Case | Expected Behavior |
|------|-------------------|
| User and built-in both provide the same command | User adapter path wins |
| `TAP_ADAPTERS_DIR` and user both provide the same command | `TAP_ADAPTERS_DIR` path wins |
| Only built-in provides the command | Built-in path wins |
| No directory provides the command | `resolveAdapterPath()` returns `null` |

### 5. Good/Base/Bad Cases

- Good: installing `~/.tap/adapters/bilibili/hot.js` overrides built-in `adapters/bilibili/hot.js`.
- Base: using bundled adapters works when `~/.tap/adapters` is absent.
- Bad: placing a user adapter under `~/.tap/adapters` but resolving the built-in first.

### 6. Tests Required

- Assert `resolveAdapterPath('bilibili', 'hot')` returns the home adapter when both home and built-in files exist.
- Assert `TAP_ADAPTERS_DIR` returns before the home adapter.
- Assert unknown commands return `null`.

### 7. Wrong vs Correct

#### Wrong

```js
[BUILTIN_ADAPTERS_DIR, join(homedir(), '.tap', 'adapters')]
```

#### Correct

```js
[join(homedir(), '.tap', 'adapters'), BUILTIN_ADAPTERS_DIR]
```

---

## Naming Conventions

- Site directory: lowercase, no hyphens (e.g., `bilibili`, `linuxdo`, `hackernews`)
- Command file: lowercase, no hyphens (e.g., `hot.js`, `news.js`, `top.js`)
- Path pattern: `adapters/<site>/<command>.js`

---

## Examples

- `adapters/bilibili/hot.js` — CDP-based adapter (navigate + evaluate)
- `adapters/linuxdo/news.js` — CDP-based adapter (navigate + evaluate using browser fetch)
