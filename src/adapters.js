import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const BUILTIN_ADAPTERS_DIR = join(ROOT_DIR, 'adapters');

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function unique(paths) {
  return [...new Set(paths)];
}

function compareNames(a, b) {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function getAdapterDirectories() {
  const configured = process.env.TAP_ADAPTERS_DIR;
  const candidates = configured
    ? [configured, BUILTIN_ADAPTERS_DIR, join(homedir(), '.tap', 'adapters')]
    : [BUILTIN_ADAPTERS_DIR, join(homedir(), '.tap', 'adapters')];

  return unique(candidates).filter(isDirectory);
}

export function resolveAdapterPath(site, command) {
  for (const dir of getAdapterDirectories()) {
    const candidate = join(dir, site, `${command}.js`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readCommandFiles(siteDir) {
  return readdirSync(siteDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name.slice(0, -3))
    .sort(compareNames);
}

export function listAdapters() {
  const sites = new Map();

  for (const dir of getAdapterDirectories()) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const commands = readCommandFiles(join(dir, entry.name));
      if (!sites.has(entry.name)) sites.set(entry.name, new Set());
      const bucket = sites.get(entry.name);
      for (const command of commands) bucket.add(command);
    }
  }

  return [...sites.entries()]
    .map(([site, commands]) => ({ site, commands: [...commands].sort(compareNames) }))
    .sort((a, b) => compareNames(a.site, b.site));
}

export async function loadAdapter(site, command) {
  const adapterPath = resolveAdapterPath(site, command);
  if (!adapterPath) return null;

  const mod = await import(pathToFileURL(adapterPath).href);
  return {
    path: adapterPath,
    adapter: mod.default,
  };
}
