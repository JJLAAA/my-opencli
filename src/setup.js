import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findBuiltinAdaptersDir } from './adapters.js';
import { logsDir, tapDir, userAdaptersDir, writeDefaultConfig } from './config.js';

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function copyDir(src, dest, { force, root = src, installed = [], skipped = [] }) {
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, { force, root, installed, skipped });
    } else if (force || !existsSync(destPath)) {
      copyFileSync(srcPath, destPath);
      installed.push(relative(root, srcPath));
    } else {
      skipped.push(relative(root, srcPath));
    }
  }

  return { installed, skipped };
}

export function setupHelp() {
  return [
    'Usage: tap setup [--force]',
    '',
    'Initializes local TAP files explicitly.',
    '',
    'Options:',
    '  --force            Overwrite config and bundled adapters',
    '',
    'Creates:',
    '  ~/.tap/',
    '  ~/.tap/adapters/',
    '  ~/.tap/logs/',
    '  ~/.tap/config.json',
  ].join('\n');
}

export function runSetup(options = {}) {
  const force = Boolean(options.force);
  const adaptersSource = findBuiltinAdaptersDir();
  if (!adaptersSource || !isDirectory(adaptersSource)) {
    throw new Error('Bundled adapters not found.');
  }

  mkdirSync(tapDir(), { recursive: true });
  mkdirSync(userAdaptersDir(), { recursive: true });
  mkdirSync(logsDir(), { recursive: true });

  const config = writeDefaultConfig({ force });
  const adapters = copyDir(adaptersSource, userAdaptersDir(), { force });

  return {
    directories: [tapDir(), userAdaptersDir(), logsDir()],
    config,
    adaptersSource,
    adaptersTarget: userAdaptersDir(),
    installed: adapters.installed,
    skipped: adapters.skipped,
  };
}

export function formatSetupResult(result) {
  const lines = [
    'TAP setup complete.',
    '',
    'Directories:',
    ...result.directories.map(path => `  ${path}`),
    '',
    `Config: ${result.config.path} (${result.config.written ? 'written' : 'kept existing'})`,
    `Adapters: ${result.adaptersTarget}`,
  ];

  if (result.installed.length) {
    lines.push('', 'Installed adapters:');
    for (const file of result.installed) lines.push(`  ${file}`);
  }

  if (result.skipped.length) {
    lines.push('', 'Skipped existing adapters:');
    for (const file of result.skipped) lines.push(`  ${file}`);
  }

  lines.push('', 'Next:', '  tap doctor', '  tap browser start');
  return lines.join('\n');
}
