# Publishing tap to npm

## Prerequisites

- Bun installed for cross-platform compilation.
- npm registry access for the `@leolee812` scope.
- Logged in to the public registry:

```bash
npm login --registry https://registry.npmjs.org/
```

If the local npm cache has permission issues, use a temporary cache:

```bash
export NPM_CACHE=/private/tmp/tap-npm-cache
```

## Package Model

The main package is intentionally small:

```
@leolee812/tap
├── run.js
├── install.js
└── skills/tap-adapter-author/
```

Compiled Bun binaries live in platform-specific optional dependency packages:

| Package | Platform |
|---------|----------|
| `@leolee812/tap-darwin-arm64` | macOS Apple Silicon |
| `@leolee812/tap-darwin-x64` | macOS Intel |
| `@leolee812/tap-linux-x64` | Linux x64 |

The main package declares those packages in `optionalDependencies`. npm installs only the compatible optional package for the user's OS/CPU, so users no longer download every platform binary.

## Build

```bash
bun run build:npm
```

This generates:

```
npm/
├── package.json
├── run.js
├── install.js
├── skills/
└── platforms/
    ├── tap-darwin-arm64/
    │   ├── package.json
    │   └── bin/tap
    ├── tap-darwin-x64/
    │   ├── package.json
    │   └── bin/tap
    └── tap-linux-x64/
        ├── package.json
        └── bin/tap
```

`npm/platforms/` is excluded from git and rebuilt for every publish.

## Dry Run

Check the main package:

```bash
cd npm
npm --cache "$NPM_CACHE" pack --dry-run
```

Check at least one platform package:

```bash
cd platforms/tap-darwin-arm64
npm --cache "$NPM_CACHE" pack --dry-run
```

The main package should be small and must not include `platforms/` or old `binaries/` contents.

## Publish

### GitHub Actions

Preferred publishing path is the manual **Publish npm** workflow in GitHub Actions.

Repository secret required:

```text
NPM_TOKEN
```

The token must be allowed to create and publish all four packages:

```text
@leolee812/tap
@leolee812/tap-darwin-arm64
@leolee812/tap-darwin-x64
@leolee812/tap-linux-x64
```

Run the workflow once with `dry_run: true` to build packages and run `npm pack --dry-run` for each package. Run it again with `dry_run: false` to publish. The workflow publishes platform packages first, then the main package.

### Local Fallback

Local publishing uses the same package order:

```bash
NPM_CACHE=/private/tmp/tap-npm-cache bun run publish:npm
```

`scripts/publish-npm.js` runs `bun run build:npm`, publishes every package under `npm/platforms/`, then publishes `npm/`.

The script skips packages whose exact version is already published, which makes it safe to rerun after a partial publish failure.

When `NPM_PUBLISH_DRY_RUN=1` is set, the script runs `npm pack --dry-run` for each package instead of `npm publish --dry-run`; this avoids registry submission waits while still verifying package contents.

## Verify

Registry indexing can lag briefly. Wait and then check:

```bash
sleep 30
npm --cache "$NPM_CACHE" view @leolee812/tap@latest name version optionalDependencies --registry https://registry.npmjs.org/
npm --cache "$NPM_CACHE" view @leolee812/tap-darwin-arm64@latest name version os cpu --registry https://registry.npmjs.org/
```

## Troubleshooting

**`tap: unsupported platform`**

The user's OS/CPU is not mapped in `npm/run.js`. Add a target to both `scripts/build-npm.js` and `npm/run.js`.

**`tap: platform package ... is not installed`**

The optional dependency for the user's platform was not installed. Reinstall the main package, and confirm the platform package exists on npm.

**Permission denied on binary**

Published platform packages preserve the executable bit on `bin/tap`. Local development builds also run `npm/install.js`, which sets executable permissions under `npm/platforms/`.
