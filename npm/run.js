#!/usr/bin/env node
const { execFileSync } = require('child_process');
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

execFileSync(path.join(__dirname, 'binaries', name), process.argv.slice(2), { stdio: 'inherit' });
