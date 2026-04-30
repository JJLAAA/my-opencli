const fs = require('fs');
const path = require('path');

// set executable permissions on binaries
const binDir = path.join(__dirname, 'binaries');
for (const f of fs.readdirSync(binDir)) {
  fs.chmodSync(path.join(binDir, f), 0o755);
}
