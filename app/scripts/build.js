// Production build of the main process: esbuild bundles src/ + tweaks/ into one minified file, bytenode compiles it to
// V8 bytecode (out/main.jsc) and a 3-line loader becomes the entry point. The renderer is minified too.
// Usage: node scripts/build.js   (electron-builder's beforePack hook runs this as well)
const path = require('node:path'), fs = require('node:fs');
const esbuild = require('esbuild');
const bytenode = require('bytenode');
const root = path.join(__dirname, '..'), out = path.join(root, 'out'), electronVersion = require(path.join(root, 'node_modules/electron/package.json')).version;
const electronBin = require(path.join(root, 'node_modules/electron'));   // the local (host-OS) Electron: same V8 as the Windows build of the same version

async function main() {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
  const common = { bundle: true, minify: true, platform: 'node', target: 'node20', format: 'cjs', legalComments: 'none', external: ['electron'], logLevel: 'warning' };
  await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/main.js')], outfile: path.join(out, 'main.bundle.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/preload.js')], outfile: path.join(out, 'preload.js') });
  // bytecode: compiled by the host Electron of the exact same version (V8 bytecode is tied to the V8 version, not the OS)
  const r = await bytenode.compileFile({ filename: path.join(out, 'main.bundle.js'), output: path.join(out, 'main.jsc'), electron: true, electronPath: electronBin, compileAsModule: true });
  fs.unlinkSync(path.join(out, 'main.bundle.js'));
  fs.writeFileSync(path.join(out, 'main.js'), `require('bytenode');require('./main.jsc');\n`);
  // renderer: minified copies (markup untouched)
  const rdr = path.join(out, 'renderer'); fs.mkdirSync(path.join(rdr, 'games'), { recursive: true });
  for (const f of ['app.js', 'i18n.js']) await esbuild.build({ entryPoints: [path.join(root, 'renderer', f)], outfile: path.join(rdr, f), minify: true, legalComments: 'none', logLevel: 'warning' });
  await esbuild.build({ entryPoints: [path.join(root, 'renderer/styles.css')], outfile: path.join(rdr, 'styles.css'), minify: true, legalComments: 'none', logLevel: 'warning' });
  for (const f of ['index.html', 'logo.png']) fs.copyFileSync(path.join(root, 'renderer', f), path.join(rdr, f));
  for (const f of fs.readdirSync(path.join(root, 'renderer/games'))) fs.copyFileSync(path.join(root, 'renderer/games', f), path.join(rdr, 'games', f));
  const size = (p) => (fs.statSync(p).size / 1024).toFixed(1) + ' KB';
  console.log(`built with Electron ${electronVersion}: main.jsc ${size(path.join(out, 'main.jsc'))}, preload ${size(path.join(out, 'preload.js'))}, renderer app.js ${size(path.join(rdr, 'app.js'))}, styles ${size(path.join(rdr, 'styles.css'))}`);
}
main().catch(e => { console.error(e); process.exit(1); });
