import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findBuiltinAdaptersDir } from './adapters.js';
import { findChrome } from './browser.js';
import { browserStatus } from './browser.js';
import { configPath, logsDir, readConfig, tapDir, userAdaptersDir } from './config.js';

function listFiles(root, base = root, files = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) listFiles(path, base, files);
    else files.push(relative(base, path));
  }
  return files;
}

function check(label, ok, detail = '') {
  return { label, ok, detail };
}

function adapterInstallCheck() {
  const source = findBuiltinAdaptersDir();
  if (!source) return check('Bundled adapters available', false, 'No bundled adapters directory found.');

  const files = listFiles(source).filter(file => file.endsWith('.js'));
  const missing = files.filter(file => !existsSync(join(userAdaptersDir(), file)));
  if (missing.length) {
    return check(
      'Bundled adapters installed',
      false,
      `Missing ${missing.length} adapter file(s). Run: tap setup`
    );
  }

  return check('Bundled adapters installed', true, `${files.length} file(s) present.`);
}

export function doctorHelp() {
  return [
    'Usage: tap doctor',
    '',
    'Checks local TAP setup, adapter files, Chrome, and CDP connectivity.',
  ].join('\n');
}

export async function runDoctor() {
  const checks = [
    check('TAP directory', existsSync(tapDir()), tapDir()),
    check('Adapter directory', existsSync(userAdaptersDir()), userAdaptersDir()),
    check('Logs directory', existsSync(logsDir()), logsDir()),
    check('Config file', existsSync(configPath()), configPath()),
  ];

  try {
    const config = readConfig();
    checks.push(check('Config parse', true, `cdpEndpoint=${config.cdpEndpoint}`));
  } catch (error) {
    checks.push(check('Config parse', false, error.message));
  }

  checks.push(adapterInstallCheck());

  const chrome = findChrome();
  checks.push(check('Chrome executable', Boolean(chrome), chrome ?? 'Set TAP_CHROME_PATH.'));

  const cdp = await browserStatus();
  checks.push(check(
    'CDP endpoint',
    cdp.ok,
    cdp.ok ? `${cdp.endpoint} (${cdp.browser})` : `${cdp.endpoint}: ${cdp.error}`
  ));

  return {
    ok: checks.every(item => item.ok),
    checks,
  };
}

export function formatDoctorResult(result) {
  const lines = result.checks.map(item => {
    const mark = item.ok ? 'OK' : 'FAIL';
    return `[${mark}] ${item.label}${item.detail ? ` - ${item.detail}` : ''}`;
  });

  if (!result.ok) {
    lines.push('', 'Suggested next steps:', '  tap setup', '  tap browser start');
  }

  return lines.join('\n');
}
