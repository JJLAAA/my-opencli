import { mkdirSync } from 'node:fs';
import { logsDir, tapDir, userAdaptersDir, writeDefaultConfig } from './config.js';

export function setupHelp() {
  return [
    'Usage: tap setup [--force]',
    '',
    'Initializes local TAP files explicitly.',
    '',
    'Options:',
    '  --force            Overwrite config when present',
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

  mkdirSync(tapDir(), { recursive: true });
  mkdirSync(userAdaptersDir(), { recursive: true });
  mkdirSync(logsDir(), { recursive: true });

  const config = writeDefaultConfig({ force });

  return {
    directories: [tapDir(), userAdaptersDir(), logsDir()],
    config,
    adaptersTarget: userAdaptersDir(),
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

  lines.push('', 'Next:', '  tap doctor', '  tap browser start');
  return lines.join('\n');
}
