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

At runtime, adapters are loaded from `~/.tap/adapters/<site>/<command>.js`.  
The `adapters/` directory in the repo is the source; install to `~/.tap/adapters/` to use.

---

## Naming Conventions

- Site directory: lowercase, no hyphens (e.g., `bilibili`, `linuxdo`, `hackernews`)
- Command file: lowercase, no hyphens (e.g., `hot.js`, `news.js`, `top.js`)
- Path pattern: `adapters/<site>/<command>.js`

---

## Examples

- `adapters/bilibili/hot.js` — CDP-based adapter (navigate + evaluate)
- `adapters/linuxdo/news.js` — CDP-based adapter (navigate + evaluate using browser fetch)
