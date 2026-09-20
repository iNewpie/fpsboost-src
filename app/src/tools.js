// One-shot tools (no state to revert): ping test, flush DNS, Winsock reset, temp cleanup, system info, admin check.
const ACTIONS = {
  restore_point: {
    title: { en: 'Create a System Restore point', fa: 'ساخت نقطهٔ بازیابی ویندوز (System Restore)' },
    desc: { en: 'A Windows snapshot you can roll back to from Settings → Recovery, independent of this app. Made automatically before "Apply recommended".', fa: 'یک عکس فوری از ویندوز که از Settings → Recovery می‌توانید به آن برگردید، مستقل از این برنامه. قبل از «اعمال پیشنهادی» خودکار ساخته می‌شود.' },
    async run(ctx) { const r = await restorePoint(ctx.runner); if (!r) throw new Error('System Restore is not available on this PC'); return r.skipped ? { en: 'A restore point from the last 24 h already exists', fa: 'نقطهٔ بازیابی ۲۴ ساعت اخیر از قبل وجود دارد' } : { en: 'Restore point created', fa: 'نقطهٔ بازیابی ساخته شد' }; },
  },
  flush_dns: {
    title: { en: 'Flush DNS cache', fa: 'پاک کردن کش DNS' }, desc: { en: 'Forget cached name lookups — fixes sites that resolve to a dead or slow address.', fa: 'رکوردهای کش‌شده را فراموش می‌کند — سایت‌هایی که به آدرس مرده یا کند می‌روند درست می‌شوند.' },
    async run(ctx) { await ctx.must('ipconfig', ['/flushdns']); return { en: 'DNS cache flushed', fa: 'کش DNS پاک شد' }; },
  },
  winsock_reset: {
    title: { en: 'Reset Winsock + TCP/IP stack', fa: 'ریست Winsock و TCP/IP' }, reboot: true,
    desc: { en: 'Rebuilds the network stack config. The fix for "connected but nothing loads" after VPNs or antivirus leftovers. Needs a restart.', fa: 'پیکربندی شبکه را از نو می‌سازد. درمان «وصل است ولی چیزی باز نمی‌شود» بعد از VPN یا آنتی‌ویروس. نیاز به ریستارت.' },
    async run(ctx) { await ctx.must('netsh', ['winsock', 'reset']); await ctx.run('netsh', ['int', 'ip', 'reset']); return { en: 'Network stack reset — restart Windows', fa: 'شبکه ریست شد — ویندوز را ریستارت کنید' }; },
  },
  clean_temp: {
    title: { en: 'Clean temporary files', fa: 'پاک‌سازی فایل‌های موقت' },
    desc: { en: 'Deletes files in your Temp and Windows\\Temp folders (files in use are skipped).', fa: 'فایل‌های پوشهٔ Temp شما و Windows\\Temp را حذف می‌کند (فایل‌های در حال استفاده رد می‌شوند).' },
    async run(ctx) {
      const out = await ctx.ps(`$freed = 0; foreach ($d in @($env:TEMP, "$env:SystemRoot\\Temp")) { Get-ChildItem -Path $d -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | ForEach-Object { try { $s = $_.Length; Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop; $freed += $s } catch {} } }; Write-Output $freed`, { timeout: 180000 });
      const mb = (Number(out.trim()) || 0) / 1048576;
      return { en: `Freed ${mb.toFixed(0)} MB`, fa: `${mb.toFixed(0)} مگابایت آزاد شد` };
    },
  },
};

const { makeCtx } = require('./engine');

/* System Restore: enable protection on the system drive if it is off, then checkpoint. Windows makes at most one
   restore point per 24 h through this API (it silently skips otherwise) — we report that as "skipped". null = unavailable. */
async function restorePoint(runner) {
  if (process.platform !== 'win32') return null;
  const script = `try { Enable-ComputerRestore -Drive "$env:SystemDrive\\" -ErrorAction SilentlyContinue; $before = (Get-ComputerRestorePoint | Measure-Object).Count; Checkpoint-Computer -Description "FPS Boost" -RestorePointCreationType MODIFY_SETTINGS -ErrorAction Stop; $after = (Get-ComputerRestorePoint | Measure-Object).Count; if ($after -gt $before) { 'created' } else { 'skipped' } } catch { 'unavailable: ' + $_.Exception.Message }`;
  const r = await runner.run('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: 180000 });
  const out = (r.out || '').trim();
  if (r.code !== 0 || out.startsWith('unavailable')) return null;
  return { skipped: out === 'skipped' };
}

async function action(runner, id) {
  const a = ACTIONS[id]; if (!a) throw new Error('unknown action ' + id);
  const ctx = makeCtx(runner, null); ctx.runner = runner;
  const msg = await a.run(ctx);
  return { id, message: msg, reboot: !!a.reboot };
}
const actionList = () => Object.entries(ACTIONS).map(([id, a]) => ({ id, title: a.title, desc: a.desc, reboot: !!a.reboot }));

/* ping: average of the replies; works on any Windows language (parses "time=23ms" / "time<1ms" / "زمان=23ms" by the digits before "ms") */
async function ping(runner, hosts) {
  const results = [];
  for (const host of hosts) {
    const r = await runner.run('ping', ['-n', '4', '-w', '1500', host], { timeout: 15000 });
    const times = [...r.out.matchAll(/[=<](\d+)\s*ms/gi)].map(m => Number(m[1]));
    results.push({ host, avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, loss: Math.max(0, 4 - times.length) });
  }
  return results;
}

async function isAdmin(runner) { if (process.platform !== 'win32') return false; const r = await runner.run('net', ['session'], { timeout: 10000 }); return r.code === 0; }

async function systemInfo(runner, os) {
  const info = { os: `${os.type()} ${os.release()}`, cpu: (os.cpus()[0] || {}).model || '?', cores: os.cpus().length, ramGb: Math.round(os.totalmem() / 1073741824), gpu: '?' };
  if (process.platform === 'win32') {
    try { const r = await runner.run('powershell', ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ", "'], { timeout: 20000 }); if (r.code === 0 && r.out.trim()) info.gpu = r.out.trim(); } catch (e) {}
  }
  return info;
}

module.exports = { ACTIONS, action, actionList, ping, isAdmin, systemInfo, restorePoint };
