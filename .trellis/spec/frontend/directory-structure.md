# Directory Structure

> How adapters are organized in this project.

---

## Overview

"Frontend" in TAP refers to **adapters** — the user-facing DSL files that define what to fetch and how to transform it. Adapters are the extension point; the core engine is backend.

---

## Directory Layout

```
~/.tap/adapters/
└── <site>/
    └── <command>.js
```

At runtime, adapters are searched in this order:

1. `$TAP_ADAPTERS_DIR/<site>/<command>.js` when `TAP_ADAPTERS_DIR` is set
2. `~/.tap/adapters/<site>/<command>.js`

The first matching file wins. TAP does not load adapters from the source repo or bundled package assets by default.

---

## Adapter Resolution Contract

### 1. Scope / Trigger

Use this contract when changing adapter discovery, adding an adapter source, or documenting adapter installation.

### 2. Signatures

- Runtime function: `getAdapterDirectories()` returns existing directories in search order.
- Runtime function: `resolveAdapterPath(site, command)` returns the first matching `<site>/<command>.js` path or `null`.
- Environment key: `TAP_ADAPTERS_DIR` optionally adds a highest-priority adapter root.

### 3. Contracts

- With `TAP_ADAPTERS_DIR`: search `$TAP_ADAPTERS_DIR`, then `~/.tap/adapters`.
- Without `TAP_ADAPTERS_DIR`: search `~/.tap/adapters`.
- Duplicate directory paths are de-duplicated before filtering.
- Missing directories are ignored.
- The first existing adapter file wins; later directories do not override it.

### 4. Validation & Error Matrix

| Case | Expected Behavior |
|------|-------------------|
| `TAP_ADAPTERS_DIR` and user both provide the same command | `TAP_ADAPTERS_DIR` path wins |
| Adapter exists only under repo `adapters/` | Not discovered unless `TAP_ADAPTERS_DIR` points there |
| No directory provides the command | `resolveAdapterPath()` returns `null` |

### 5. Good/Base/Bad Cases

- Good: installing `~/.tap/adapters/example/list.js` makes `tap example list` discoverable.
- Base: `TAP_ADAPTERS_DIR=/repo/adapters tap example list` uses a workflow-owned adapter directory before user adapters.
- Bad: relying on repo-root `adapters/` without setting `TAP_ADAPTERS_DIR`.

### 6. Tests Required

- Assert `resolveAdapterPath('example', 'list')` returns the home adapter when it exists.
- Assert `TAP_ADAPTERS_DIR` returns before the home adapter.
- Assert unknown commands return `null`.

### 7. Wrong vs Correct

#### Wrong

```js
[join(rootDir, 'adapters'), join(homedir(), '.tap', 'adapters')]
```

#### Correct

```js
[join(homedir(), '.tap', 'adapters')]
```

---

## Naming Conventions

- Site directory: lowercase, no hyphens (e.g., `bilibili`, `linuxdo`, `hackernews`)
- Command file: lowercase, no hyphens (e.g., `hot.js`, `news.js`, `top.js`)
- Path pattern: `~/.tap/adapters/<site>/<command>.js`

---

## Examples

- `~/.tap/adapters/example/list.js` — user-installed adapter path
