#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const platform = os.platform();
const arch = os.arch();

const platformPackages = {
  'darwin-arm64': '@leolee812/tap-darwin-arm64',
  'darwin-x64':   '@leolee812/tap-darwin-x64',
  'linux-x64':    '@leolee812/tap-linux-x64',
};

const packageName = platformPackages[`${platform}-${arch}`];
if (!packageName) {
  console.error(`tap: unsupported platform ${platform}-${arch}`);
  process.exit(1);
}

function resolveBinary() {
  const localPath = path.join(__dirname, 'platforms', packageName.split('/').pop(), 'bin', 'tap');
  try {
    require('fs').accessSync(localPath);
    return localPath;
  } catch {}

  try {
    return require.resolve(`${packageName}/bin/tap`);
  } catch {
    console.error(`tap: platform package ${packageName} is not installed`);
    console.error('Reinstall @leolee812/tap so npm can install the matching optional dependency.');
    process.exit(1);
  }
}

const result = spawnSync(resolveBinary(), process.argv.slice(2), {
  stdio: 'inherit',
  env: {
    ...process.env,
    TAP_PACKAGE_ROOT: __dirname,
  },
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
