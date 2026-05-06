import { execSync } from 'child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

const registry = process.env.NPM_REGISTRY ?? 'https://registry.npmjs.org/';
const cache = process.env.NPM_CACHE ? ` --cache ${process.env.NPM_CACHE}` : '';
const dryRun = process.env.NPM_PUBLISH_DRY_RUN === '1';
const token = process.env.NODE_AUTH_TOKEN;

if (!dryRun && !token) {
  throw new Error('NODE_AUTH_TOKEN is required when NPM_PUBLISH_DRY_RUN is not 1');
}

const npmConfigDir = dryRun ? null : mkdtempSync(path.join(os.tmpdir(), 'tap-npm-'));
const npmConfig = npmConfigDir ? path.join(npmConfigDir, '.npmrc') : null;
const authArgs = npmConfig ? ` --userconfig ${npmConfig}` : '';
const publishArgs = `${cache}${authArgs} publish --access public --registry ${registry}`;
const packArgs = `${cache} pack --dry-run`;

if (npmConfig) {
  const registryUrl = new URL(registry);
  const registryAuthPath = `${registryUrl.host}${registryUrl.pathname}`.replace(/\/?$/, '/');
  writeFileSync(npmConfig, `//${registryAuthPath}:_authToken=${token}\n`, { mode: 0o600 });
  chmodSync(npmConfig, 0o600);
}

function packageMeta(packageDir) {
  return JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
}

function isPublished(name, version) {
  if (dryRun) return false;

  try {
    execSync(`npm${cache}${authArgs} view ${name}@${version} version --registry ${registry}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function publishPackage(packageDir) {
  const meta = packageMeta(packageDir);
  if (isPublished(meta.name, meta.version)) {
    console.log(`skip ${meta.name}@${meta.version}: already published`);
    return;
  }

  const command = dryRun ? `npm${packArgs}` : `npm${publishArgs}`;
  execSync(command, { cwd: packageDir, stdio: 'inherit' });
}

try {
  execSync('bun run scripts/build-npm.js', { stdio: 'inherit' });

  for (const dir of readdirSync('npm/platforms')) {
    const packageDir = path.join('npm/platforms', dir);
    if (existsSync(path.join(packageDir, 'package.json'))) publishPackage(packageDir);
  }

  publishPackage('npm');
} finally {
  if (npmConfigDir) rmSync(npmConfigDir, { recursive: true, force: true });
}
