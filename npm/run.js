#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const platform = os.platform();
const arch = os.arch();

const binaries = {
  'darwin-arm64': 'tap-darwin-arm64',
  'darwin-x64':   'tap-darwin-x64',
  'linux-x64':    'tap-linux-x64',
};

const name = binaries[`${platform}-${arch}`];
if (!name) {
  console.error(`tap: unsupported platform ${platform}-${arch}`);
  process.exit(1);
}

const result = spawnSync(path.join(__dirname, 'binaries', name), process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
