#!/usr/bin/env bun
import { openSession, closeTab } from '../src/cdp.js';
import { executePipeline } from '../src/executor.js';
import { printOutput } from '../src/output.js';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const [site, command, ...rest] = process.argv.slice(2);

if (!site || !command) {
  console.error('Usage: tap <site> <command> [--key value] [--format table|json]');
  process.exit(1);
}

const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const key = rest[i].slice(2);
    const val = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
    args[key] = isNaN(Number(val)) || val === true ? val : Number(val);
  }
}

const format = args.format ?? 'table';
delete args.format;

const adaptersDir = process.env.TAP_ADAPTERS_DIR ?? join(homedir(), '.tap', 'adapters');
const adapterPath = join(adaptersDir, site, `${command}.js`);
if (!existsSync(adapterPath)) {
  console.error(`Adapter not found: ${adapterPath}`);
  process.exit(1);
}

const { default: adapter } = await import(pathToFileURL(adapterPath).href);

for (const def of adapter.args ?? [])
  if (args[def.name] === undefined) args[def.name] = def.default;

const needsBrowser = adapter.pipeline.some(s => 'navigate' in s || 'evaluate' in s || 'intercept' in s);

let session = null, targetId = null, base = null;
try {
  if (needsBrowser) ({ session, targetId, base } = await openSession());
  const result = await executePipeline(adapter.pipeline, args, session);
  printOutput(result, format, adapter.columns);
} finally {
  session?.close();
  if (targetId) await closeTab(base, targetId);
}
