# Default Output To Agent-Friendly JSON

## Goal
Make `tap` prefer machine-readable output by default so AI agents and automation can parse command results without extra flags.

## Requirements
- Default command output must be JSON when `--format` is omitted.
- `--format table` must continue to produce the existing human-readable table output.
- Help text must make the default JSON behavior explicit.
- English and Chinese README examples must describe JSON as the default and table as the opt-in human-readable format.
- Existing adapter execution behavior must remain unchanged except for the default output format.

## Acceptance Criteria
- [x] Running `tap <site> <command>` outputs a JSON array by default.
- [x] Running `tap <site> <command> --format table` outputs the existing table format.
- [x] Running `tap --help` shows `--format json|table` and explains that JSON is the default.
- [x] README and README.zh document JSON as the default agent-friendly output.
- [x] `bun run build` succeeds.

## Technical Notes
- The default is controlled in `src/cli.js` when resolving `args.format`.
- `src/output.js` already supports both `json` and `table`; no formatter change is required.
- Verification used a temporary local adapter under `TAP_ADAPTERS_DIR` with a `data:` JSON URL to avoid network and browser dependencies.

## Validation Notes
- `TAP_ADAPTERS_DIR=/tmp/tap-agent-output bun run bin/cli.js demo items`
- `TAP_ADAPTERS_DIR=/tmp/tap-agent-output bun run bin/cli.js demo items --format table`
- `TAP_ADAPTERS_DIR=/tmp/tap-agent-output bun run bin/cli.js --help`
- `bun run build`
- `TAP_ADAPTERS_DIR=/tmp/tap-agent-output ./tap demo items`
