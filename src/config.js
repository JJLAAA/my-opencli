import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_CDP_ENDPOINT = 'http://localhost:9222';
export const DEFAULT_CHROME_PROFILE = '~/.chrome-automation-profile';

export function expandHome(path) {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

export function tapDir() {
  return join(homedir(), '.tap');
}

export function userAdaptersDir() {
  return join(tapDir(), 'adapters');
}

export function logsDir() {
  return join(tapDir(), 'logs');
}

export function configPath() {
  return join(tapDir(), 'config.json');
}

export function defaultConfig() {
  return {
    cdpEndpoint: DEFAULT_CDP_ENDPOINT,
    chromeProfile: DEFAULT_CHROME_PROFILE,
  };
}

export function readConfig() {
  if (!existsSync(configPath())) return defaultConfig();

  const raw = readFileSync(configPath(), 'utf8');
  return { ...defaultConfig(), ...JSON.parse(raw) };
}

export function writeDefaultConfig({ force = false } = {}) {
  mkdirSync(tapDir(), { recursive: true });
  if (existsSync(configPath()) && !force) return { path: configPath(), written: false };

  writeFileSync(`${configPath()}`, `${JSON.stringify(defaultConfig(), null, 2)}\n`);
  return { path: configPath(), written: true };
}

export function configuredCdpEndpoint() {
  return (process.env.TAP_CDP_ENDPOINT ?? readConfig().cdpEndpoint ?? DEFAULT_CDP_ENDPOINT).replace(/\/$/, '');
}

export function configuredChromeProfile() {
  return resolvePath(expandHome(readConfig().chromeProfile ?? DEFAULT_CHROME_PROFILE));
}
