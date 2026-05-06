import { execSync } from 'child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';

const targets = [
  {
    bunTarget: 'bun-darwin-arm64',
    packageName: '@leolee812/tap-darwin-arm64',
    packageDir: 'tap-darwin-arm64',
    os: 'darwin',
    cpu: 'arm64',
  },
  {
    bunTarget: 'bun-darwin-x64',
    packageName: '@leolee812/tap-darwin-x64',
    packageDir: 'tap-darwin-x64',
    os: 'darwin',
    cpu: 'x64',
  },
  {
    bunTarget: 'bun-linux-x64',
    packageName: '@leolee812/tap-linux-x64',
    packageDir: 'tap-linux-x64',
    os: 'linux',
    cpu: 'x64',
  },
];

const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));
const version = rootPackage.version;
const platformsRoot = 'npm/platforms';
const mainPackagePath = 'npm/package.json';
const mainPackage = JSON.parse(readFileSync(mainPackagePath, 'utf8'));
mainPackage.version = version;
mainPackage.optionalDependencies = Object.fromEntries(
  targets.map(target => [target.packageName, version])
);
writeFileSync(mainPackagePath, JSON.stringify(mainPackage, null, 2) + '\n');

rmSync('npm/binaries', { recursive: true, force: true });
rmSync(platformsRoot, { recursive: true, force: true });

for (const target of targets) {
  const packageRoot = path.join(platformsRoot, target.packageDir);
  const binDir = path.join(packageRoot, 'bin');
  const binaryPath = path.join(binDir, 'tap');

  mkdirSync(binDir, { recursive: true });
  console.log(`building ${target.packageName}...`);
  execSync(
    `bun build --compile --target=${target.bunTarget} bin/cli.js --outfile ${binaryPath}`,
    { stdio: 'inherit' }
  );

  writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({
    name: target.packageName,
    version,
    description: `Platform binary for @leolee812/tap on ${target.os}-${target.cpu}`,
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/JJLAAA/tap.git',
    },
    os: [target.os],
    cpu: [target.cpu],
    files: ['bin/'],
  }, null, 2) + '\n');
}

// copy skill into npm package
console.log('copying skill...');
rmSync('npm/skills/tap-adapter-author', { recursive: true, force: true });
cpSync('skills/tap-adapter-author', 'npm/skills/tap-adapter-author', { recursive: true });

console.log('done.');
