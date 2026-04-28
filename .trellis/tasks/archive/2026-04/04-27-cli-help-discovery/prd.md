# Improve CLI Help And Command Discovery

## Goal
Make `tap` behave like a usable CLI by supporting help output, adapter/command discovery, and command-specific usage guidance.

## Requirements
- Support global help via `tap help`, `tap --help`, and `tap -h`
- Show available sites and commands in help output
- Support site-level help to list commands for one site
- Support command-level help to show usage, options, and defaults
- Keep adapter execution behavior unchanged for valid commands
- Keep user-facing argument failures as stderr output plus exit code `1`

## Acceptance Criteria
- [x] Running `bun run bin/cli.js --help` prints global usage and available commands
- [x] Running `bun run bin/cli.js help <site>` prints the commands under that site
- [x] Running `bun run bin/cli.js help <site> <command>` prints concrete usage for that adapter command
- [x] Running `bun run bin/cli.js <site> <command>` still executes the adapter pipeline

## Technical Notes
- Introduce a dedicated module for adapter discovery/loading instead of keeping this logic in `bin/cli.js`
- Allow discovery from repo-local built-in adapters in addition to configured adapter directories
- Extend adapter metadata shape with optional descriptions for better help text

## Validation Notes
- Verified help flows with `bun run bin/cli.js --help`, `bun run bin/cli.js help linuxdo`, and `bun run bin/cli.js help linuxdo news`
- Verified user-facing failures and exit codes with unknown site and unknown command invocations
- Verified end-to-end command execution path using a temporary `fetch` adapter mounted through `TAP_ADAPTERS_DIR`
- `bun run build` succeeds
