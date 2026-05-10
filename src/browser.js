import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { closeBrowser, cdpVersion } from './cdp.js';
import { DEFAULT_CDP_ENDPOINT, configuredCdpEndpoint, configuredChromeProfile, readConfig } from './config.js';

function chromeCandidates() {
  return [
    process.env.TAP_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    join(homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
  ].filter(Boolean);
}

export function findChrome() {
  return chromeCandidates().find(path => existsSync(path)) ?? null;
}

export function browserHelp(command) {
  if (command === 'start') {
    return [
      'Usage: tap browser start [--headless] [--foreground]',
      '',
      'Starts an agent Chrome with remote debugging enabled.',
      'Headed Chrome starts minimized by default to reduce focus stealing.',
      '',
      'Options:',
      '  --headless     Run Chrome without a visible window',
      '  --foreground   Start headed Chrome normally instead of minimized',
    ].join('\n');
  }

  if (command === 'status') {
    return [
      'Usage: tap browser status',
      '',
      'Checks whether the configured CDP endpoint is reachable.',
    ].join('\n');
  }

  if (command === 'stop') {
    return [
      'Usage: tap browser stop',
      '',
      'Asks the agent Chrome to close through CDP.',
    ].join('\n');
  }

  if (command === 'restart') {
    return [
      'Usage: tap browser restart [--headless] [--foreground]',
      '',
      'Restarts the agent Chrome with remote debugging enabled.',
      'Useful when the agent Chrome starts receiving normal system links.',
      '',
      'Options:',
      '  --headless     Run Chrome without a visible window after restart',
      '  --foreground   Start headed Chrome normally instead of minimized',
    ].join('\n');
  }

  return [
    'Usage: tap browser <command>',
    '',
    'Commands:',
    '  start             Start agent Chrome',
    '  status            Check CDP connectivity',
    '  stop              Close agent Chrome through CDP',
    '  restart           Restart agent Chrome',
  ].join('\n');
}

export async function browserStatus() {
  let endpoint = DEFAULT_CDP_ENDPOINT;
  try {
    endpoint = configuredCdpEndpoint();
    const version = await cdpVersion(endpoint);
    return {
      ok: true,
      endpoint,
      browser: version?.Browser ?? 'unknown',
      webSocketDebuggerUrl: version?.webSocketDebuggerUrl ?? null,
    };
  } catch (error) {
    return { ok: false, endpoint, error: error.message };
  }
}

function portFromEndpoint(endpoint) {
  return new URL(endpoint).port || '9222';
}

export async function startBrowser(options = {}) {
  const current = await browserStatus();
  if (current.ok) return { alreadyRunning: true, ...current };

  const chrome = findChrome();
  if (!chrome) {
    throw new Error('Chrome not found. Set TAP_CHROME_PATH to the Chrome executable path.');
  }

  const config = readConfig();
  const endpoint = configuredCdpEndpoint();
  const profile = configuredChromeProfile();
  mkdirSync(profile, { recursive: true });

  const args = [
    `--remote-debugging-port=${portFromEndpoint(endpoint)}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];

  if (options.headless) {
    args.push('--headless=new');
  } else if (!options.foreground) {
    args.push('--start-minimized');
  }

  const child = spawn(chrome, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  return {
    alreadyRunning: false,
    endpoint,
    chrome,
    profile,
    minimized: !options.headless && !options.foreground,
    headless: Boolean(options.headless),
    configuredProfile: config.chromeProfile,
  };
}

export async function stopBrowser() {
  const status = await browserStatus();
  if (!status.ok) return { stopped: false, endpoint: status.endpoint, reason: 'not running' };

  await closeBrowser(status.endpoint);
  return { stopped: true, endpoint: status.endpoint };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBrowserStopped(endpoint, { attempts = 20, delayMs = 250 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = await browserStatus();
    if (!status.ok) return { stopped: true, endpoint, attempts: attempt + 1 };
    await wait(delayMs);
  }

  return { stopped: false, endpoint, attempts };
}

export async function restartBrowser(options = {}) {
  const stopped = await stopBrowser();
  const waitResult = stopped.stopped
    ? await waitForBrowserStopped(stopped.endpoint)
    : { stopped: true, endpoint: stopped.endpoint, attempts: 0 };

  if (!waitResult.stopped) {
    throw new Error(`Timed out waiting for agent Chrome to stop: ${waitResult.endpoint}`);
  }

  const started = await startBrowser(options);
  return { stopped, started };
}

export function formatBrowserStatus(status) {
  if (status.ok) {
    return [
      'Agent Chrome is running.',
      `Endpoint: ${status.endpoint}`,
      `Browser: ${status.browser}`,
    ].join('\n');
  }

  return [
    'Agent Chrome is not reachable.',
    `Endpoint: ${status.endpoint}`,
    `Error: ${status.error}`,
    '',
    'Try:',
    '  tap browser start',
  ].join('\n');
}

export function formatBrowserStart(result) {
  if (result.alreadyRunning) return formatBrowserStatus(result);

  return [
    'Agent Chrome started.',
    `Endpoint: ${result.endpoint}`,
    `Chrome: ${result.chrome}`,
    `Profile: ${result.profile}`,
    `Mode: ${result.headless ? 'headless' : result.minimized ? 'headed minimized' : 'headed foreground'}`,
  ].join('\n');
}

export function formatBrowserStop(result) {
  if (result.stopped) return `Agent Chrome stop requested: ${result.endpoint}`;
  return `Agent Chrome was not running: ${result.endpoint}`;
}
