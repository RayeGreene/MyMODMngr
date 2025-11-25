const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJson = require('../package.json');
const version = packageJson.version;

// Update Tauri config
const tauriConfigPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
tauriConfig.version = version;
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + '\n');

console.log(`✅ Synced version to ${version} in tauri.conf.json`);
