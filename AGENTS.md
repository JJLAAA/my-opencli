# Repository Guidelines

## Project Structure & Module Organization

`bin/cli.js` is the Bun entrypoint for the `tap` CLI. Core runtime modules live in `src/` (`cdp.js`, `executor.js`, `output.js`). Site-specific commands live in `adapters/<site>/<command>.js`; current examples include `adapters/linuxdo/news.js` and `adapters/bilibili/hot.js`. Design notes and diagrams live in `docs/`. Trellis workflow state, specs, and task history live under `.trellis/`; treat those files as part of the contributor workflow, not application runtime.

## Build, Test, and Development Commands

Use Bun for local work:

```bash
bun run build
```

Builds a standalone `tap` executable from `bin/cli.js`.

```bash
bun run bin/cli.js linuxdo news --limit 3
```

Runs the CLI directly during development. If you want adapters from a custom location, set `TAP_ADAPTERS_DIR=/path/to/adapters`.

There is no dedicated `test`, `lint`, or `format` script in `package.json` yet. If you add one, update this guide in the same change.

## Coding Style & Naming Conventions

This repo uses ESM JavaScript with explicit `import`/`export`, semicolons, and concise top-level modules. Follow the existing 2-space indentation style. Keep filenames lowercase and descriptive: runtime modules use single-purpose names like `executor.js`; adapters follow `adapters/<site>/<command>.js`. Prefer small pipeline-oriented objects over deeply nested imperative logic when extending adapters.

## Testing Guidelines

No automated test suite is committed yet. For now, validate changes by running the affected command locally and checking both table and JSON output when relevant. For adapter work, include a concrete manual example in your PR, such as `bun run bin/cli.js linuxdo news --limit 5 --format json`.

## Commit & Pull Request Guidelines

Match the existing commit style: scoped Conventional Commit prefixes such as `feat:`, `chore:`, `docs(spec):`, and `chore(task):`. Keep each commit focused on one change. PRs should include a short summary, manual verification steps, and terminal output or screenshots when CLI behavior changes. If you modify workflow or specs under `.trellis/`, mention that explicitly in the PR description.

## response style
remember,always answer my question in chinese
