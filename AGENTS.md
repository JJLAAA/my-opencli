# Repository Guidelines

## Project Structure & Module Organization

`bin/cli.js` is the Bun entrypoint for the `tap` CLI. Core runtime modules live in `src/` (`cdp.js`, `executor.js`, `output.js`). Site-specific commands live in `adapters/<site>/<command>.js` or user-owned adapter directories; adapters intended for JSON output must declare `output.fields`. Design notes and diagrams live in `docs/`. Trellis workflow state, specs, and task history live under `.trellis/`; treat those files as part of the contributor workflow, not application runtime.

## Build, Test, and Development Commands

Use Bun for local work:

```bash
bun run build
```

Builds a standalone `tap` executable from `bin/cli.js`.

```bash
bun run bin/cli.js <site> <command> --limit 3
```

Runs the CLI directly during development. If you want adapters from a custom location, set `TAP_ADAPTERS_DIR=/path/to/adapters`.

There is no dedicated `test`, `lint`, or `format` script in `package.json` yet. If you add one, update this guide in the same change.

## Coding Style & Naming Conventions

This repo uses ESM JavaScript with explicit `import`/`export`, semicolons, and concise top-level modules. Follow the existing 2-space indentation style. Keep filenames lowercase and descriptive: runtime modules use single-purpose names like `executor.js`; adapters follow `adapters/<site>/<command>.js`. Prefer small pipeline-oriented objects over deeply nested imperative logic when extending adapters.

## Testing Guidelines

No automated test suite is committed yet. For now, validate changes by running the affected command locally and checking both table and JSON output when relevant. For adapter work, include a concrete manual example in your PR, such as `bun run bin/cli.js <site> <command> --limit 5 --format json`, and confirm the JSON envelope includes `meta`, `schema`, and `items`.

## Commit & Pull Request Guidelines

Match the existing commit style: scoped Conventional Commit prefixes such as `feat:`, `chore:`, `docs(spec):`, and `chore(task):`. Keep each commit focused on one change. PRs should include a short summary, manual verification steps, and terminal output or screenshots when CLI behavior changes. If you modify workflow or specs under `.trellis/`, mention that explicitly in the PR description.

When changing CLI capabilities, update the README documentation in the same change. This includes new or changed commands, flags, output envelopes, schemas, exit codes, structured errors, browser behavior, adapter contracts, setup flows, and environment variables. Keep `README.md` and `README.zh.md` aligned when the change affects user-facing behavior.

## response style
remember,always answer my question in chinese

<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

## Subagents

- ALWAYS wait for every spawned subagent to reach a terminal status before yielding, acting on partial results, or spawning followups.
  - On Codex, this means calling the `wait` tool with the subagent's thread id (requires `multi_agent_v2`). Do NOT infer completion from elapsed time.
  - On Claude Code / OpenCode, this means awaiting the Task/agent tool result before continuing.
- NEVER cancel or re-spawn a subagent that hasn't finished. If a subagent appears stuck, raise the wait timeout (Codex default 30s, max 1h) before judging it broken.
- Spawn subagents automatically when:
  - Parallelizable work (e.g., install + verify, npm test + typecheck, multiple tasks from plan)
  - Long-running or blocking tasks where a worker can run independently
  - Isolation for risky changes or checks

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
