import { execSync } from 'child_process';
import { mkdirSync, cpSync, rmSync } from 'fs';

const targets = [
  ['bun-darwin-arm64', 'tap-darwin-arm64'],
  ['bun-darwin-x64',   'tap-darwin-x64'],
  ['bun-linux-x64',    'tap-linux-x64'],
];

mkdirSync('npm/binaries', { recursive: true });

for (const [target, out] of targets) {
  console.log(`building ${out}...`);
  execSync(
    `bun build --compile --target=${target} bin/cli.js --outfile npm/binaries/${out}`,
    { stdio: 'inherit' }
  );
}

// copy skill into npm package
console.log('copying skill...');
rmSync('npm/skills/tap-adapter-author', { recursive: true, force: true });
cpSync('skills/tap-adapter-author', 'npm/skills/tap-adapter-author', { recursive: true });

console.log('done.');
