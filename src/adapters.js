import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { userAdaptersDir } from './config.js';

export class AdapterLoadError extends Error {
  constructor(message, { adapterPath, site, command, suggestion, details, cause } = {}) {
    super(message, { cause });
    this.name = 'AdapterLoadError';
    this.adapterPath = adapterPath;
    this.site = site;
    this.command = command;
    this.suggestion = suggestion ?? null;
    this.details = details ?? {};
  }
}

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
  const userDir = userAdaptersDir();
  const candidates = configured ? [configured, userDir] : [userDir];

  return unique(candidates).filter(isDirectory);
}

export function resolveAdapterPath(site, command) {
  for (const dir of getAdapterDirectories()) {
    const candidate = join(dir, site, `${command}.js`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function lineColumn(source, offset) {
  const before = source.slice(0, offset);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function sourceLine(source, line) {
  return source.split('\n')[line - 1] ?? '';
}

function findUnescapedTapTemplateInTemplateLiteral(source) {
  let inTemplate = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '`') {
      inTemplate = !inTemplate;
      continue;
    }

    if (inTemplate && source.startsWith('${{', i)) {
      return i;
    }
  }

  return -1;
}

function diagnoseAdapterSource(adapterPath) {
  const source = readFileSync(adapterPath, 'utf8');
  const offset = findUnescapedTapTemplateInTemplateLiteral(source);
  if (offset === -1) return;

  const location = lineColumn(source, offset);
  throw new AdapterLoadError('Adapter contains an unescaped TAP template inside a JavaScript template literal.', {
    adapterPath,
    suggestion: 'Escape the dollar sign as \\${{ ... }} inside backtick strings, or move the TAP template into a single/double-quoted string.',
    details: {
      adapterPath,
      diagnostics: [{
        line: location.line,
        column: location.column,
        message: '`${{ ... }}` inside a backtick string is parsed by JavaScript before TAP can render it.',
        source: sourceLine(source, location.line).trim(),
      }],
    },
  });
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

  try {
    diagnoseAdapterSource(adapterPath);
    const mod = await import(pathToFileURL(adapterPath).href);
    return {
      path: adapterPath,
      adapter: mod.default,
    };
  } catch (error) {
    if (error instanceof AdapterLoadError) {
      error.site = site;
      error.command = command;
      error.details = { site, command, ...error.details };
      throw error;
    }

    throw new AdapterLoadError(`Failed to load adapter: ${adapterPath}`, {
      adapterPath,
      site,
      command,
      suggestion: 'Fix the adapter JavaScript syntax or module exports, then run the command again.',
      cause: error,
      details: {
        site,
        command,
        adapterPath,
        cause: {
          name: error.name,
          message: error.message,
          errors: (error.errors ?? []).map(item => ({
            name: item.name,
            message: item.message,
          })),
        },
      },
    });
  }
}
