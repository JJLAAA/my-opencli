const fs = require('fs');
const path = require('path');
const os = require('os');

// set executable permissions on binaries
const binDir = path.join(__dirname, 'binaries');
for (const f of fs.readdirSync(binDir)) {
  fs.chmodSync(path.join(binDir, f), 0o755);
}

// copy built-in adapters to ~/.tap/adapters/ (skip existing files)
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const builtinSrc = path.join(__dirname, 'adapters');
const adaptersDest = path.join(os.homedir(), '.tap', 'adapters');
if (fs.existsSync(builtinSrc)) copyDir(builtinSrc, adaptersDest);
