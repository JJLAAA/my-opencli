const fs = require('fs');
const path = require('path');

// Local development builds keep platform packages under npm/platforms/.
// Published installs rely on the platform package's executable bit.
const platformsDir = path.join(__dirname, 'platforms');
if (fs.existsSync(platformsDir)) {
  for (const pkg of fs.readdirSync(platformsDir)) {
    const binary = path.join(platformsDir, pkg, 'bin', 'tap');
    if (fs.existsSync(binary)) fs.chmodSync(binary, 0o755);
  }
}
