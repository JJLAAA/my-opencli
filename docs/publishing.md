# Publishing tap to Internal npm Registry

## Prerequisites

- [Bun](https://bun.sh) installed (for cross-platform compilation)
- npm registry access: `https://npm.company.com`
- Logged in to the registry: `npm login --registry https://npm.company.com`

## First-Time Setup

**1. Set package name**

Edit `npm/package.json` and replace `@company/tap` with your actual scope:

```json
"name": "@yourscope/tap"
```

**2. Configure registry**

Update the registry URL in `npm/package.json`:

```json
"publishConfig": {
  "registry": "https://npm.your-company.com"
}
```

Or add to `~/.npmrc` to avoid repeating it:

```
@yourscope:registry=https://npm.your-company.com
```

## Publishing a New Version

```bash
# 1. bump version (patch / minor / major)
cd npm && npm version patch && cd ..

# 2. build all platform binaries and publish
bun run publish:npm
```

Or step by step:

```bash
bun run build:npm        # builds binaries into npm/binaries/
cd npm && npm publish    # publishes to registry
```

## What Gets Published

```
npm/
├── package.json          # package metadata
├── run.js                # platform selector (bin entry)
├── install.js            # postinstall: sets executable permissions
├── skills/
│   └── tap-adapter-author/
└── binaries/
    ├── tap-darwin-arm64  # macOS Apple Silicon
    ├── tap-darwin-x64    # macOS Intel
    └── tap-linux-x64     # Linux x64
```

`binaries/` is excluded from git (see `.gitignore`) — binaries are built fresh on each publish.

## Employee Installation

```bash
npm install -g @yourscope/tap
```

If the registry is not globally configured, specify it:

```bash
npm install -g @yourscope/tap --registry https://npm.your-company.com
```

After installation, `tap` is available directly:

```bash
tap --help
tap bilibili hot
```

AI assistant skills are bundled but not installed automatically. Install them explicitly:

```bash
tap skill install claude-code
tap skill install codex
```

## Updating

```bash
npm update -g @yourscope/tap
```

## Troubleshooting

**`tap: unsupported platform`**  
The binary for the user's platform is missing. Add the target to `scripts/build-npm.js` and republish.

**`tap: command not found` after install**  
npm global bin directory is not in PATH. Check:
```bash
npm bin -g        # shows the bin directory
echo $PATH        # confirm it's included
```

**Permission denied on binary**  
The `postinstall` script sets permissions automatically. If it failed, run manually:
```bash
chmod +x $(npm root -g)/@yourscope/tap/binaries/tap-*
```

## Supported Platforms

| Platform | Architecture | Binary |
|----------|-------------|--------|
| macOS | Apple Silicon (arm64) | `tap-darwin-arm64` |
| macOS | Intel (x64) | `tap-darwin-x64` |
| Linux | x64 | `tap-linux-x64` |

To add a new platform, add an entry to `scripts/build-npm.js` and `npm/run.js`.
