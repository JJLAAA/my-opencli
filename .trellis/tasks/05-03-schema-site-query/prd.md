# Support Site-Level Schema Query

## Goal

Allow `tap schema <site>` to return useful schema discovery output for all adapter commands under a site, instead of failing with `Missing command. Usage: tap schema <site> <command>`.

This improves the CLI's agent-friendly discovery flow. A caller should be able to move from global discovery (`tap schema`) to site-level discovery (`tap schema reddit`) to command-level schema (`tap schema reddit hot`) without parsing error messages or guessing command names.

## Background

Current behavior:

- `tap schema` returns the global command index.
- `tap schema <site> <command>` returns one adapter command schema.
- `tap schema <management-command>` supports management commands such as `doctor`.
- `tap schema <management-parent> <management-subcommand>` supports management commands such as `browser start`.
- `tap schema <site>` currently exits with `usage_error`.

The current error is technically consistent with the existing implementation, but it is not ideal for command discovery. Since `tap schema` already exposes command metadata, `tap schema <site>` should provide a narrower discovery view for that site.

## Requirements

- `tap schema <site>` must be a valid command when `<site>` matches at least one adapter site.
- The command must return JSON on stdout and exit with code `0`.
- The output must include `meta.schemaVersion`.
- The output must identify the result as a site-level schema/discovery response.
- The output must include the queried `site`.
- The output must list all adapter commands available for that site.
- Each listed command must include enough metadata for an agent to request the command-level schema.
- If an adapter can be loaded, include its description when available.
- If an adapter cannot be loaded, include a structured `loadError` entry following the current global schema pattern.
- `tap schema <unknown-site>` must still fail with a structured usage error.
- README documentation must be updated in both `README.md` and `README.zh.md` because this changes CLI behavior.

## Proposed Output Shape

Use a new site-level response shape:

```json
{
  "meta": {
    "schemaVersion": 1,
    "kind": "site",
    "site": "reddit"
  },
  "commands": [
    {
      "kind": "adapter",
      "site": "reddit",
      "command": "hot",
      "name": "reddit hot",
      "description": "Fetch hot posts from a subreddit.",
      "schemaCommand": "tap schema reddit hot"
    }
  ]
}
```

For adapter load failures, mirror the current global schema behavior:

```json
{
  "kind": "adapter",
  "site": "reddit",
  "command": "hot",
  "name": "reddit hot",
  "description": null,
  "schemaCommand": "tap schema reddit hot",
  "loadError": {
    "code": "adapter_load_error",
    "message": "Failed to load adapter: ...",
    "suggestion": "Fix the adapter JavaScript syntax or module exports, then run the command again.",
    "details": {}
  }
}
```

## Error Behavior

For unknown sites:

```json
{
  "error": {
    "code": "unknown_site",
    "message": "Unknown site: <site>",
    "suggestion": "Run: tap schema",
    "retryable": false,
    "details": {
      "site": "<site>"
    }
  }
}
```

Exit code should be `2`, consistent with usage/discovery errors.

## Acceptance Criteria

- [ ] `bun run bin/cli.js schema reddit` exits `0` when `reddit` exists.
- [ ] `bun run bin/cli.js schema reddit` returns JSON with `meta.kind === "site"`.
- [ ] The response includes `commands[]` entries with `site`, `command`, `name`, and `schemaCommand`.
- [ ] Command entries include adapter `description` when the adapter loads successfully.
- [ ] Site-level output preserves adapter load diagnostics instead of failing the whole site query.
- [ ] `bun run bin/cli.js schema reddit hot` continues to return command-level schema unchanged.
- [ ] `bun run bin/cli.js schema` continues to return global schema unchanged.
- [ ] Management command schema queries continue to work, including `tap schema doctor` and `tap schema browser start`.
- [ ] `bun run bin/cli.js schema does-not-exist` exits `2` with structured `unknown_site`.
- [ ] README and README.zh document `tap schema <site>`.

## Technical Notes

- Likely add a `buildSiteSchema(site)` function in `src/schema.js`.
- Reuse `listAdapters()` to find commands for the requested site.
- Reuse `loadAdapter(site, command)` so site-level schema can include descriptions and load errors consistently with `buildGlobalSchema()`.
- Keep the management command matching in `runSchemaCommand()` ahead of adapter site matching, so `tap schema browser start` remains unambiguous.
- Add site-level handling after management command matching and before requiring `<site> <command>`.
- Consider using a shared helper for adapter command summary construction to avoid duplicating the global schema entry shape.
- No automated test suite exists yet; validate manually with Bun commands.

## Manual Verification

Run:

```bash
bun run bin/cli.js schema
bun run bin/cli.js schema reddit
bun run bin/cli.js schema reddit hot
bun run bin/cli.js schema doctor
bun run bin/cli.js schema browser start
bun run bin/cli.js schema does-not-exist
```

Check:

- Successful schema commands print JSON to stdout.
- Error cases print structured JSON to stderr.
- Exit codes match the documented behavior.
