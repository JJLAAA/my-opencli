import { existsSync } from 'node:fs';
import { findChrome } from './browser.js';
import { browserStatus } from './browser.js';
import { configPath, logsDir, readConfig, tapDir, userAdaptersDir } from './config.js';

function check(label, ok, detail = '') {
  return { label, ok, detail };
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

  const chrome = findChrome();
  checks.push(check('Chrome executable', Boolean(chrome), chrome ?? 'Set TAP_CHROME_PATH.'));

  const cdp = await browserStatus();
  checks.push(check(
    'CDP endpoint',
    cdp.ok,
    cdp.ok ? `${cdp.endpoint} (${cdp.browser})` : `${cdp.endpoint}: ${cdp.error}`
  ));

  const ok = checks.every(item => item.ok);
  const suggestions = [];
  if (!ok) {
    const failed = checks.filter(c => !c.ok);
    if (failed.some(c => /directory|config|tap|adapter|bundled/i.test(c.label)))
      suggestions.push('tap setup');
    if (failed.some(c => /chrome|cdp/i.test(c.label)))
      suggestions.push('tap browser start');
  }

  return { ok, checks, suggestions };
}

export function formatDoctorResult(result) {
  const lines = result.checks.map(item => {
    const mark = item.ok ? 'OK' : 'FAIL';
    return `[${mark}] ${item.label}${item.detail ? ` - ${item.detail}` : ''}`;
  });

  if (!result.ok) {
    lines.push('', 'Suggested next steps:', ...result.suggestions.map(s => `  ${s}`));
  }

  return lines.join('\n');
}
