# Minimal Adapter Distribution Install

## Goal

Add the smallest useful adapter distribution workflow so a TAP user can install an adapter pack produced by another person and immediately reuse it through the existing `~/.tap/adapters/<site>/<command>.js` discovery path.

This task is intentionally limited to install-time distribution. Do not expand runtime adapter discovery, do not add pack search paths, and do not make TAP core depend on bundled site-specific adapters.

## Background

TAP currently does not ship site-specific adapters by default. Users either author adapters with `tap-adapter-author` or place adapter files manually under:

```text
~/.tap/adapters/<site>/<command>.js
```

That model is good for local authoring but weak for reuse: if one person publishes a useful adapter set, another user has no TAP-native way to install it. The minimum viable distribution model is to fetch a remote adapter pack, copy its `adapters/` tree into the existing user adapter directory, and record which files were installed.

Because `listAdapters()` and `resolveAdapterPath()` already read `~/.tap/adapters`, installed adapters should become available through existing commands with no runtime discovery changes:

```bash
tap schema
tap schema <site>
tap <site> <command>
```

## Requirements

- Add an adapter management command namespace under `tap adapter`.
- Support installing an adapter pack from a public GitHub repository source.
- Support installing an adapter pack from a generic archive URL so company-internal sources can distribute adapters without depending on GitHub.
- Support installing an adapter pack from a generic Git repository source so company-internal private Git servers can reuse the user's existing local Git credentials.
- Installing a pack must copy files from the pack's `adapters/` directory into `~/.tap/adapters/`.
- The adapter pack source layout must be:

```text
<repo>/
├── tap-adapter.json
└── adapters/
    └── <site>/
        └── <command>.js
```

- `tap-adapter.json` must be required for install and must include at least:

```json
{
  "name": "tap-adapters-example",
  "version": "0.1.0",
  "description": "Example TAP adapters"
}
```

- Installation must write a local manifest so TAP can later list and remove installed packs.
- Use this manifest path:

```text
~/.tap/installed-adapters.json
```

- The manifest must record:
  - pack name
  - pack version
  - source string
  - installed file paths relative to `~/.tap/adapters`
  - installed timestamp
- The manifest is the source tracking record. It must be used to explain file ownership in conflict errors and overwrite results.

- Installation must create `~/.tap/` and `~/.tap/adapters/` if they do not exist.
- Existing adapter files must not be overwritten by default.
- If a target file already exists, installation must fail with a structured error and suggest `--force`.
- `--force` may overwrite files installed by the same pack or existing local files.
- When `--force` overwrites files, the manifest entry for the installing pack must record the overwritten paths as belonging to that pack after the install completes.
- If `--force` overwrites a file that was previously recorded under another installed pack, remove that file path from the previous pack's manifest entry.
- If removing overwritten paths leaves a previous pack with no files, keep the previous pack entry unless the user explicitly removes it. This avoids silently uninstalling a pack because one command was replaced.
- Conflicts and forced overwrites must never be silent. CLI output must identify which files conflict or were overwritten and, when known from the manifest, which installed pack and source previously owned each file.
- Successful install output must be JSON.
- Adapter management errors must use the existing structured JSON error style.
- README documentation must be updated in both `README.md` and `README.zh.md` because this adds user-facing CLI capabilities.

## Commands

### `tap adapter install <source>`

Install a remote adapter pack into the existing user adapter directory.

Supported source formats for the first implementation:

```bash
tap adapter install github:<owner>/<repo>
tap adapter install url:<https-url-to-zip-or-tarball>
tap adapter install git:<git-url>
```

Optional flags:

```bash
tap adapter install github:<owner>/<repo> --force
tap adapter install url:<https-url-to-zip-or-tarball> --force
tap adapter install git:<git-url> --force
```

`github:<owner>/<repo>` is a convenience source for public GitHub repositories. It should resolve to the repository's default branch archive.

`url:<https-url-to-zip-or-tarball>` is the generic distribution path for private/internal adapter packs. The archive must unpack to a directory containing `tap-adapter.json` and `adapters/` at its root or under a single top-level wrapper directory.

`git:<git-url>` is the generic distribution path for private/internal Git servers. TAP must not implement Git authentication itself. Instead, it should invoke the local `git` executable against a temporary directory and rely on the user's existing Git environment and credentials.

Examples:

```bash
tap adapter install git:https://git.company.com/team/tap-adapters.git
tap adapter install git:ssh://git@git.company.com/team/tap-adapters.git
tap adapter install git:git@git.company.com:team/tap-adapters.git
```

For `git:` sources, TAP should perform a shallow clone when practical:

```bash
git clone --depth 1 <git-url> <temporary-directory>
```

Then it should validate and install from the cloned repository's `tap-adapter.json` and `adapters/` directory.

Expected successful output:

```json
{
  "ok": true,
  "action": "install",
  "pack": {
    "name": "tap-adapters-example",
    "version": "0.1.0",
    "source": "github:owner/repo"
  },
  "installed": [
    "example/list.js"
  ],
  "overwritten": [],
  "target": "~/.tap/adapters"
}
```

### `tap adapter list`

List packs recorded in `~/.tap/installed-adapters.json`.

Expected output:

```json
{
  "packs": [
    {
      "name": "tap-adapters-example",
      "version": "0.1.0",
      "source": "github:owner/repo",
      "files": [
        "example/list.js"
      ],
      "installedAt": "2026-05-04T00:00:00.000Z"
    }
  ]
}
```

If no manifest exists, return:

```json
{
  "packs": []
}
```

### `tap adapter remove <name>`

Remove files previously installed by a recorded pack and remove that pack entry from the manifest.

Expected output:

```json
{
  "ok": true,
  "action": "remove",
  "pack": "tap-adapters-example",
  "removed": [
    "example/list.js"
  ]
}
```

Remove should not delete unrelated files. It should only delete paths recorded for the named pack.

## Conflict and Overwrite Behavior

Installation compares every source adapter file against its target path under `~/.tap/adapters`.

Default behavior:

- If no target path exists, copy the file and record it in the installing pack's manifest entry.
- If any target path already exists, fail the whole install before copying files.
- The error must include all conflicting relative paths when practical.
- For each conflict, the error details must include source tracking when known:
  - `path`: adapter file path relative to `~/.tap/adapters`
  - `owner`: installed pack name from the manifest, or `"local"` if the file is unmanaged/user-created
  - `source`: installed pack source from the manifest, or `"~/.tap/adapters"` if unmanaged/user-created
- The suggestion must tell the user to rerun with `--force` if they intentionally want to replace those files.

Forced behavior with `--force`:

- Copy all source adapter files into `~/.tap/adapters`, replacing target files when paths conflict.
- Record all copied files under the installing pack's manifest entry.
- If a replaced file path was recorded under another pack, remove only that path from the other pack's `files` list.
- Do not remove files from disk that are not part of the current source pack.
- Do not delete another pack's manifest entry automatically, even if all of its files were displaced.
- Successful forced install output must include an `overwritten` array. Each entry must include `path`, `previousOwner`, and `previousSource`, using `"local"` and `"~/.tap/adapters"` for unmanaged/user-created files.

This means adapter command path ownership is last-writer-wins only when the user passes `--force`; otherwise TAP is fail-fast and non-destructive.

Example conflict error details:

```json
{
  "error": {
    "code": "adapter_file_conflict",
    "message": "Adapter install would overwrite existing files.",
    "suggestion": "Rerun with --force only if you want this source to replace the listed adapter files.",
    "retryable": false,
    "details": {
      "conflicts": [
        {
          "path": "reddit/hot.js",
          "owner": "tap-adapters-reddit",
          "source": "github:tap-adapters/reddit"
        },
        {
          "path": "reddit/search.js",
          "owner": "local",
          "source": "~/.tap/adapters"
        }
      ]
    }
  }
}
```

Example forced install overwrite output:

```json
{
  "ok": true,
  "action": "install",
  "pack": {
    "name": "tap-adapters-reddit-plus",
    "version": "0.2.0",
    "source": "url:https://internal.example.com/tap/reddit-plus.zip"
  },
  "installed": [
    "reddit/hot.js",
    "reddit/search.js"
  ],
  "overwritten": [
    {
      "path": "reddit/hot.js",
      "previousOwner": "tap-adapters-reddit",
      "previousSource": "github:tap-adapters/reddit"
    },
    {
      "path": "reddit/search.js",
      "previousOwner": "local",
      "previousSource": "~/.tap/adapters"
    }
  ],
  "target": "~/.tap/adapters"
}
```

## Non-Goals

- Do not add `~/.tap/adapters.d/*/adapters` or any new runtime search directory.
- Do not implement a central registry or `tap adapter search`.
- Do not support npm packages in the first implementation.
- Do not support private GitHub authentication in the first implementation.
- Do not implement source-specific integrations for GitLab, Gitea, Bitbucket, S3, or internal registries in the first implementation. Use `url:<archive-url>` for those systems.
- Do not implement interactive authentication in the first implementation.
- Do not accept, parse, store, or print access tokens/passwords in TAP.
- Do not implement custom SSH, OAuth, SSO, credential-helper, or certificate handling. For private Git repositories, use `git:` and let the local Git installation handle credentials, SSH keys, credential helpers, enterprise CA config, and SSO side effects.
- Do not add bundled site-specific adapters to TAP core.
- Do not change the adapter module contract.
- Do not change `listAdapters()` or `resolveAdapterPath()` unless unavoidable.
- Do not add semantic version resolution beyond reading and storing the pack version string.

## Error Behavior

Errors should follow the existing CLI JSON error envelope:

```json
{
  "error": {
    "code": "adapter_install_error",
    "message": "Human-readable message",
    "suggestion": "Actionable next step",
    "retryable": false,
    "details": {}
  }
}
```

Suggested error codes:

- `unknown_adapter_command`: unknown `tap adapter` subcommand.
- `missing_adapter_source`: `tap adapter install` called without a source.
- `unsupported_adapter_source`: source is not in a supported format.
- `adapter_pack_download_error`: source archive could not be fetched.
- `adapter_pack_clone_error`: Git source could not be cloned.
- `adapter_pack_contract_error`: missing or invalid `tap-adapter.json`, missing `adapters/`, or no adapter files found.
- `adapter_file_conflict`: install would overwrite an existing adapter file without `--force`.
- `adapter_pack_not_installed`: remove requested a pack name not present in the manifest.
- `adapter_manifest_error`: manifest could not be read or written.

Use exit code `2` for usage errors and exit code `6` for adapter distribution/install contract errors, matching the existing adapter failure category.

## Acceptance Criteria

- [ ] `tap adapter install github:<owner>/<repo>` installs adapter files from `<repo>/adapters/` into `~/.tap/adapters/`.
- [ ] `tap adapter install url:<https-url-to-zip-or-tarball>` installs adapter files from the archive's `adapters/` directory into `~/.tap/adapters/`.
- [ ] `tap adapter install git:<git-url>` clones the repository with local Git, reuses the user's existing Git credentials, and installs adapter files from the cloned repository's `adapters/` directory into `~/.tap/adapters/`.
- [ ] TAP does not prompt for or store Git credentials.
- [ ] Install requires `tap-adapter.json` and stores its `name`, `version`, and `description` where relevant.
- [ ] Install writes `~/.tap/installed-adapters.json`.
- [ ] Installed adapters are discoverable through the existing `tap schema` flow without changing runtime adapter discovery.
- [ ] Existing target files are not overwritten unless `--force` is provided.
- [ ] A conflict without `--force` fails before partially copying files.
- [ ] Conflict errors identify the conflicting paths and their tracked owner/source when known.
- [ ] `--force` overwrites conflicting files and updates manifest ownership for overwritten paths.
- [ ] Successful forced install output reports every overwritten path and its previous owner/source when known.
- [ ] `tap adapter list` returns installed packs from the manifest.
- [ ] `tap adapter list` returns an empty `packs` array when no manifest exists.
- [ ] `tap adapter remove <name>` removes only manifest-recorded files for that pack.
- [ ] Removing an unknown pack fails with a structured `adapter_pack_not_installed` error.
- [ ] Unknown `tap adapter` subcommands fail with a structured usage error.
- [ ] README and README.zh document the new adapter install/list/remove workflow.
- [ ] Existing adapter execution commands continue to work unchanged.
- [ ] Existing `TAP_ADAPTERS_DIR` behavior remains unchanged.

## Manual Verification

Use a small public fixture repository or temporary local test repository exposed through the supported GitHub source path.

Run:

```bash
tap adapter list
tap adapter install github:<owner>/<repo>
tap adapter install url:<https-url-to-zip-or-tarball>
tap adapter install git:<git-url>
tap adapter list
tap schema
tap schema <site>
tap <site> <command> --format json
tap adapter install github:<owner>/<repo>
tap adapter install github:<owner>/<repo> --force
tap adapter remove <pack-name>
tap adapter list
```

Check:

- Install creates or updates `~/.tap/installed-adapters.json`.
- Installed files appear under `~/.tap/adapters/<site>/<command>.js`.
- Existing schema and execution paths discover installed files naturally.
- Reinstall without `--force` fails on conflicts.
- Reinstall with `--force` succeeds.
- Remove deletes only files listed for the pack in the manifest.

## Implementation Notes

- Prefer a new focused module such as `src/adapter-manager.js` for install/list/remove operations.
- Keep CLI command parsing in `src/cli.js` consistent with existing management command style.
- Reuse `userAdaptersDir()` and `tapDir()` from `src/config.js` where possible.
- Preserve JSON-only output for management commands.
- Network-backed install may require using GitHub archive download, GitHub Contents API, direct archive download for `url:` sources, or local `git clone` for `git:` sources. Keep implementation simple and deterministic.
- For private/internal distribution, prefer `git:` when the company already manages Git credentials locally. This lets TAP reuse SSH keys, credential helpers, macOS Keychain, Git Credential Manager, `.netrc`, enterprise CA configuration, and SSO side effects without adding authentication code.
- If `git:` clone fails, return a structured `adapter_pack_clone_error` with an actionable suggestion such as `Verify this command works locally: git clone <git-url>`.
- Sanitize command output in errors so credentials embedded in URLs are not printed back to the user.
