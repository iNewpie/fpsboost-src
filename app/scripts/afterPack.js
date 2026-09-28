// electron-builder afterPack: drop what the app never uses from the packaged Electron so the installer stays small.
//   LICENSES.chromium.html  ~20 MB  license text (kept in the source repo instead: node_modules/electron/dist)
//   dxcompiler.dll / dxil.dll ~27 MB  WebGPU shader compiler — the app has no WebGPU (webgl is off too)
// Locales are trimmed by electronLanguages in package.json.
const fs = require('node:fs'), path = require('node:path');
exports.default = async function afterPack(ctx) {
  let freed = 0;
  for (const f of ['LICENSES.chromium.html', 'dxcompiler.dll', 'dxil.dll']) {
    const p = path.join(ctx.appOutDir, f);
    if (fs.existsSync(p)) { freed += fs.statSync(p).size; fs.unlinkSync(p); }
  }
  console.log(`  • afterPack: removed ${(freed / 1048576).toFixed(0)} MB of unused Electron files`);
};
