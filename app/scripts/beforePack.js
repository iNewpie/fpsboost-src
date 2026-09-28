// electron-builder beforePack: always ship a fresh bytecode build of the sources.
const { execFileSync } = require('node:child_process'), path = require('node:path');
exports.default = async function beforePack() { execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' }); };
