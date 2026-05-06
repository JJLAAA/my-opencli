import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

const registry = process.env.NPM_REGISTRY ?? 'https://registry.npmjs.org/';
const cache = process.env.NPM_CACHE ? ` --cache ${process.env.NPM_CACHE}` : '';
const dryRun = process.env.NPM_PUBLISH_DRY_RUN === '1';
const publishArgs = `${cache} publish --access public --registry ${registry}`;
const packArgs = `${cache} pack --dry-run`;

function packageMeta(packageDir) {
  return JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
}

function isPublished(name, version) {
  if (dryRun) return false;

  try {
    execSync(`npm${cache} view ${name}@${version} version --registry ${registry}`, { stdio: 'ignore' });
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

execSync('bun run scripts/build-npm.js', { stdio: 'inherit' });

for (const dir of readdirSync('npm/platforms')) {
  const packageDir = path.join('npm/platforms', dir);
  if (existsSync(path.join(packageDir, 'package.json'))) publishPackage(packageDir);
}

publishPackage('npm');
