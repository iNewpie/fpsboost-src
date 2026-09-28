// Production build of the main process: esbuild bundles src/ + tweaks/ into one minified file, bytenode compiles it to
// V8 bytecode (out/main.jsc) and a 3-line loader becomes the entry point. The renderer is minified too.
// Usage: node scripts/build.js   (electron-builder's beforePack hook runs this as well)
const path = require('node:path'), fs = require('node:fs');
const esbuild = require('esbuild');
const bytenode = require('bytenode');
const root = path.join(__dirname, '..'), out = path.join(root, 'out'), electronVersion = require(path.join(root, 'node_modules/electron/package.json')).version;
// V8 rejects bytecode made by a different binary ("Invalid or incompatible cached data") — the Linux Electron's output
// crashes the Windows app at start. So on a non-Windows build box the compile runs in the stock Windows Electron of the
// same version under Wine (its zip is already in electron-builder's cache); on Windows the local Electron is the right one.
function compilerElectron() {
  if (process.platform === 'win32') return require(path.join(root, 'node_modules/electron'));
  const os = require('node:os'), { execFileSync } = require('node:child_process');
  const cache = path.join(os.homedir(), '.cache/electron'), zipName = `electron-v${electronVersion}-win32-x64.zip`;
  const zip = [cache, ...fs.readdirSync(cache).map(d => path.join(cache, d))].map(d => path.join(d, zipName)).find(f => fs.existsSync(f));
  if (!zip) throw new Error(`${zipName} not in ${cache} — run npm run dist once (electron-builder downloads it) and retry`);
  const dir = path.join(cache, `win-${electronVersion}`), exe = path.join(dir, 'electron.exe');
  if (!fs.existsSync(exe)) { fs.mkdirSync(dir, { recursive: true }); execFileSync('unzip', ['-q', '-o', zip, '-d', dir]); }
  // bytenode spawns electronPath with Linux paths; Wine maps a cwd-relative "/tmp/…" to Z:\\tmp\\… = the same files.
  // Electron under Wine needs an X display even without a window (xvfb-run when there is none), and its GPU child
  // outlives the main process and holds bytenode's pipes open — so the wrapper stops Wine once the compile exits.
  const wrap = path.join(dir, 'electron-wine.sh');
  fs.writeFileSync(wrap, [
    '#!/bin/sh', 'export WINEDEBUG=-all',
    '[ -z "$DISPLAY" ] && exec xvfb-run -a "$0" "$@"',
    `wine "${exe}" --disable-gpu "$@" </dev/null; rc=$?`, 'wineserver -k 2>/dev/null', 'exit $rc', ''
  ].join('\n'), { mode: 0o755 });
  return wrap;
}

async function main() {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
  const common = { bundle: true, minify: true, platform: 'node', target: 'node20', format: 'cjs', legalComments: 'none', external: ['electron'], logLevel: 'warning' };
  await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/main.js')], outfile: path.join(out, 'main.bundle.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/preload.js')], outfile: path.join(out, 'preload.js') });
  // bytecode: compiled in an Electron *main* process of the Windows build (electronMain — run-as-node output carries a
  // different snapshot checksum and is rejected by the main process on Electron ≥ 42)
  await bytenode.compileFile({ filename: path.join(out, 'main.bundle.js'), output: path.join(out, 'main.jsc'), electronMain: true, electronPath: compilerElectron(), compileAsModule: true });
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
