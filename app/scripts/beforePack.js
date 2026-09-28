// electron-builder beforePack: always ship a fresh bytecode build of the sources, and cap 7-Zip at level 7 — the NSIS
// payload is otherwise packed at level 9, whose 64 MB dictionary needs ~1.2 GB and gets OOM-killed on a 2 GB build box
// (level 7 costs about 2 % of size).
const { execFileSync } = require('node:child_process'), path = require('node:path');
exports.default = async function beforePack() {
  if (!process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL) process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL = '7';
  execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
};
