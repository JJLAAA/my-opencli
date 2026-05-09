# Adapter Pack Management

> Contracts for installing, listing, and removing remote adapter packs.

---

## Scope / Trigger

Use this contract when changing `tap adapter install`, `tap adapter list`, `tap adapter remove`, adapter pack source parsing, pack manifests, file conflict behavior, or `--force` overwrite behavior.

---

## Signatures

```bash
tap adapter install github:<owner>/<repo>
tap adapter install url:<https-url-to-zip-or-tarball>
tap adapter install git:<git-url>
tap adapter install git:<git-url> --force
tap adapter list
tap adapter remove <pack-name>
```

Core module:

- `src/adapter-manager.js`: exports `installAdapter(source, options)`, `listInstalledAdapters()`, `removeAdapter(name)`, and `adapterHelp(subcommand)`

Side-command routing belongs in `src/cli.js` before adapter discovery.

---

## Source Formats

Supported install sources:

| Source | Behavior |
|--------|----------|
| `github:<owner>/<repo>` | Reads the repository default branch through the GitHub API, downloads the branch archive, and searches the extracted tree for `tap-adapter.json` |
| `url:<https-url>` | Downloads a `.zip`, `.tar.gz`, or `.tgz` archive from an HTTPS URL and searches it for `tap-adapter.json` |
| `git:<git-url>` | Runs a shallow `git clone --depth 1` and searches the clone for `tap-adapter.json` |

Unknown or malformed sources fail as usage errors. `url:` sources must use HTTPS.

---

## Pack Contract

An adapter pack must contain:

```text
tap-adapter.json
adapters/
```

`tap-adapter.json` must include:

```json
{
  "name": "example-pack",
  "version": "0.1.0",
  "description": "Optional description"
}
```

Runtime behavior:

- `name` is required.
- `version` defaults to `0.0.0` when absent.
- `description` defaults to an empty string when absent.
- `adapters/` must exist and contain at least one adapter file.
- Installed files are copied to `~/.tap/adapters/<site>/<command>.js` using paths relative to the pack's `adapters/` directory.

---

## Installed Manifest

Installed pack state is stored in `~/.tap/installed-adapters.json`.

Manifest shape:

```json
{
  "packs": [
    {
      "name": "example-pack",
      "version": "0.1.0",
      "description": "Optional description",
      "source": "github:example/tap-adapters",
      "files": ["example/list.js"],
      "installedAt": "2026-05-01T12:00:00.000Z"
    }
  ]
}
```

`tap adapter list` returns the manifest's pack entries. `tap adapter remove <pack-name>` removes files owned by that pack, cleans up empty site directories on a best-effort basis, removes the pack entry, and reports `missingFiles` when expected files were already gone.

---

## Conflict and Force Behavior

- Install detects conflicts when a target file already exists under `~/.tap/adapters`.
- Without `--force`, conflicts fail with `adapter_file_conflict` and include details for each path.
- Conflict details identify the owning pack from `installed-adapters.json`; files not owned by a pack are reported as `local`.
- With `--force`, conflicting files are overwritten and returned in `overwritten`.
- When reinstalling the same pack name, files from the previous pack version that are no longer present in the new pack are removed.
- When `--force` overwrites files owned by other packs, file ownership is removed from those other packs. Empty pack entries are kept until the user explicitly removes them.

---

## Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| Missing install source | Exit 2 with `missing_adapter_source` |
| Unsupported source format | Exit 2 with `unsupported_adapter_source` |
| Download or clone fails | Exit 5 with retryable adapter pack download/clone error |
| No `tap-adapter.json` found | Exit 6 with `adapter_pack_contract_error` |
| Manifest JSON invalid or missing `name` | Exit 6 with `adapter_pack_contract_error` |
| Pack has no `adapters/` directory or no files | Exit 6 with `adapter_pack_contract_error` |
| File conflict without `--force` | Exit 6 with `adapter_file_conflict` and conflict details |
| `tap adapter remove` missing name | Exit 2 with `missing_adapter_name` |
| Removing an unknown pack | Exit 6 with `adapter_pack_not_installed` |

---

## Manual Verification

Manual checks are required until this repo has a test suite:

```bash
bun run bin/cli.js adapter install github:example/tap-adapters
bun run bin/cli.js adapter list
bun run bin/cli.js adapter install github:example/tap-adapters --force
bun run bin/cli.js adapter remove <pack-name>
```

Assertion points:

- Install output includes `ok`, `action`, `pack`, `installed`, `overwritten`, and `target`.
- `tap adapter list` shows installed pack metadata and file ownership.
- Conflict errors include enough path and owner detail for an agent to decide whether `--force` is appropriate.
- Remove output includes `removed`, and the manifest no longer lists the removed pack.
