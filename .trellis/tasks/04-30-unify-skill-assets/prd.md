# Unify Bundled Skill Asset Layout

## Goal

Make `tap skill install <provider>` resolve the bundled `tap-adapter-author` skill from a single TAP-owned asset layout:

```text
<assetsRoot>/skills/tap-adapter-author
```

## Requirements

- Move the source bundled skill out of `.claude/skills/` into `skills/`.
- Keep `tap skill install claude-code` and `tap skill install codex` target behavior unchanged.
- Let npm wrapper pass an explicit package root to the binary.
- Keep npm package contents under `npm/skills/tap-adapter-author`.
- Avoid assistant-specific writes during npm `postinstall`.
- Preserve useful diagnostics when the bundled skill is missing.

## Verification

- `bun run bin/cli.js skill install codex --target /tmp/tap-skill-install-check --force`
- `./tap skill install codex --target /tmp/tap-skill-install-check-bin --force`
- `node npm/run.js skill install codex --target /tmp/tap-skill-install-check-npm --force`
- `bun run build`
- `bun run build:npm`
