/* The page: login screen → main screen with FPS / Network / Tools tabs. Everything goes through window.api (preload). */
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
let lang = localStorage.getItem('lang') || (navigator.language.startsWith('fa') ? 'fa' : 'en');
let info = {}, status = {}, tweaks = [], actions = [];
const t = (k, vars = {}) => Object.entries(vars).reduce((s, [a, b]) => s.replace('{' + a + '}', b), (I18N[lang] || I18N.en)[k] || I18N.en[k] || k);
const L = (obj) => (obj && (obj[lang] || obj.en)) || '';
const fmtDate = (ms) => new Date(ms).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toastTimer; const toast = (m) => { const el = $('#toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3500); };
const call = async (fn, ...args) => { const r = await fn(...args); if (!r.ok) throw new Error(r.error); return r.data; };

function applyLang() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('.lang').forEach(el => { el.textContent = t('lang'); });
  renderAll();
}
$$('.lang').forEach(el => el.onclick = (e) => { e.preventDefault(); lang = lang === 'fa' ? 'en' : 'fa'; localStorage.setItem('lang', lang); applyLang(); });

/* ---- login ---- */
$('#loginform').onsubmit = async (e) => {
  e.preventDefault(); const btn = $('#lbtn'); btn.disabled = true; $('#lerr').textContent = '';
  try { status = await call(api.login, $('#lu').value.trim(), $('#lp').value); await showMain(); } catch (err) { $('#lerr').textContent = err.message; }
  btn.disabled = false;
};
$('#lreg').onclick = (e) => { e.preventDefault(); api.open(info.serverUrl + '/register'); };
$('#site').onclick = (e) => { e.preventDefault(); api.open(info.serverUrl + '/account'); };
$('#logout').onclick = async () => { await api.logout(); status = {}; $('#main').hidden = true; $('#login').hidden = false; };

/* ---- main ---- */
async function showMain() {
  $('#login').hidden = true; $('#main').hidden = false;
  renderHeader();
  api.systemInfo().then(r => { if (r.ok) { const s = r.data; $('#sysinfo').textContent = `${s.os} · ${s.cpu} (${s.cores}) · ${s.ramGb} GB RAM · GPU: ${s.gpu}`; $('#sysline').textContent = `${s.cpu.split(' ').slice(0, 4).join(' ')} · ${s.gpu.split(',')[0]}`; } });
  await refresh();
}
function renderHeader() {
  $('#userpill').textContent = status.username || '';
  const sp = $('#subpill');
  if (status.active) { sp.className = 'pill on'; sp.textContent = t('sub_active', { d: fmtDate(status.expires) }) + (status.offline ? ' · ' + t('sub_offline', { d: fmtDate(status.checked) }) : ''); }
  else { sp.className = 'pill off'; sp.textContent = t('sub_none'); }
  const b = $('#banner'); b.hidden = true; b.className = 'banner';
  if (info.platform !== 'win32') { b.hidden = false; b.textContent = t('not_windows'); }
  else if (!status.active) { b.hidden = false; b.textContent = t('need_sub') + (status.error ? ' (' + status.error + ')' : ''); }
  else if (!info.isAdmin) { b.hidden = false; b.classList.add('warn'); b.textContent = t('need_admin'); }
}
async function refresh() {
  try { tweaks = await call(api.state); } catch (e) { toast(t('error') + ': ' + e.message); }
  renderAll();
}
function renderAll() {
  if ($('#main').hidden) return;
  renderHeader();
  for (const cat of ['fps', 'network']) {
    const items = tweaks.filter(x => x.category === cat), on = items.filter(x => x.applied).length;
    $(`#${cat}-count`).textContent = t('count', { a: on, n: items.length });
    $(`#list-${cat}`).innerHTML = items.map(tw => `<div class="tweak ${tw.applied ? 'on' : ''}" data-id="${tw.id}"><div><h3>${esc(L(tw.title))} ${tw.recommended ? `<span class="tag rec">${t('rec')}</span>` : `<span class="tag adv">${t('adv')}</span>`}${tw.reboot ? `<span class="tag reboot">${t('reboot')}</span>` : ''}</h3><p>${esc(L(tw.desc))}</p></div>
<div class="ctl">${tw.options ? `<select data-opt="${tw.id}">${Object.entries(tw.options).map(([k, l]) => `<option value="${k}" ${k === tw.defaultOption ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}<span class="state ${tw.error ? 'err' : tw.applied ? 'on' : 'off'}">${tw.error ? t('unknown') : tw.applied ? t('applied') : t('not_applied')}</span><button class="${tw.applied ? 'ghost ' : ''}sm" data-act="${tw.applied ? 'revert' : 'apply'}" ${status.active ? '' : 'disabled'}>${t(tw.applied ? 'revert' : 'apply')}</button></div></div>`).join('');
  }
  $('#list-actions').innerHTML = actions.map(a => `<div class="tweak" data-action="${a.id}"><div><h3>${esc(L(a.title))} ${a.reboot ? `<span class="tag reboot">${t('reboot')}</span>` : ''}</h3><p>${esc(L(a.desc))}</p></div><div class="ctl"><span class="state off" data-res="${a.id}"></span><button class="sm" ${status.active ? '' : 'disabled'}>${t('run')}</button></div></div>`).join('');
  $$('.bar button').forEach(b => b.disabled = !status.active);
}
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const tweakEl = btn.closest('.tweak');
  if (tweakEl && btn.dataset.act) {
    const id = tweakEl.dataset.id, sel = tweakEl.querySelector('select'); btn.disabled = true;
    try { const r = await call(btn.dataset.act === 'apply' ? api.apply : api.revert, id, sel ? sel.value : undefined); toast(t('done') + (r.reboot ? ' — ' + t('reboot_hint') : '')); } catch (err) { toast(t('error') + ': ' + err.message); }
    await refresh(); return;
  }
  if (tweakEl && tweakEl.dataset.action) {
    btn.disabled = true; const res = tweakEl.querySelector('[data-res]'); res.textContent = '…';
    try { const r = await call(api.action, tweakEl.dataset.action); res.textContent = L(r.message); res.className = 'state on'; if (r.reboot) toast(t('reboot_hint')); } catch (err) { res.textContent = err.message; res.className = 'state err'; }
    btn.disabled = false; return;
  }
  if (btn.classList.contains('tab')) { $$('.tab').forEach(x => x.classList.toggle('active', x === btn)); $$('.tabpane').forEach(p => p.hidden = p.id !== 'tab-' + btn.dataset.tab); return; }
  const m = btn.id.match(/^(fps|network)-(rec|revert)$/);
  if (m) {
    btn.disabled = true;
    try { const rs = await call(m[2] === 'rec' ? api.applyRecommended : api.revertAll, m[1]); const ok = rs.filter(r => !r.error).length, bad = rs.filter(r => r.error);
      toast(t(m[2] === 'rec' ? 'applied_n' : 'reverted_n', { n: ok }) + (bad.length ? ' · ' + t('error') + ': ' + bad.map(b => b.id).join(', ') : '') + (rs.some(r => r.reboot) ? ' — ' + t('reboot_hint') : '')); } catch (err) { toast(t('error') + ': ' + err.message); }
    await refresh(); return;
  }
  if (btn.id === 'pingbtn') {
    btn.disabled = true; const hosts = $('#pinghosts').value.trim().split(/\s+/).filter(Boolean); $('#pingt').innerHTML = hosts.map(h => `<tr><td>${esc(h)}</td><td>…</td></tr>`).join('');
    try { const rs = await call(api.ping, hosts); $('#pingt').innerHTML = rs.map(r => `<tr><td>${esc(r.host)}</td><td>${r.avg == null ? t('ping_timeout') : r.avg + ' ' + t('ping_ms') + (r.loss ? ` (${r.loss} ${t('ping_loss')})` : '')}</td></tr>`).join(''); } catch (err) { toast(err.message); }
    btn.disabled = false;
  }
});

/* ---- start ---- */
(async () => {
  info = (await api.info()).data || {};
  $('#appname1').textContent = $('#appname2').textContent = info.name || 'Optimizer'; $('#logo1').textContent = $('#logo2').textContent = (info.name || 'O')[0];
  $('#version').textContent = 'v' + (info.version || ''); $('#pinghosts').value = (info.pingHosts || []).join(' ');
  actions = [{ id: 'flush_dns' }, { id: 'winsock_reset', reboot: true }, { id: 'clean_temp' }].map(a => ({ ...a, ...ACTION_TEXT[a.id] }));
  applyLang();
  status = (await api.status()).data || {};
  if (status.loggedIn) await showMain(); else $('#login').hidden = false;
})();
const ACTION_TEXT = {
  flush_dns: { title: { en: 'Flush DNS cache', fa: 'پاک کردن کش DNS' }, desc: { en: 'Forget cached name lookups — fixes sites that resolve to a dead or slow address.', fa: 'رکوردهای کش‌شده را فراموش می‌کند — سایت‌هایی که به آدرس مرده یا کند می‌روند درست می‌شوند.' } },
  winsock_reset: { title: { en: 'Reset Winsock + TCP/IP stack', fa: 'ریست Winsock و TCP/IP' }, desc: { en: 'Rebuilds the network stack config. The fix for "connected but nothing loads" after VPNs or antivirus leftovers. Needs a restart.', fa: 'پیکربندی شبکه را از نو می‌سازد. درمان «وصل است ولی چیزی باز نمی‌شود» بعد از VPN یا آنتی‌ویروس. نیاز به ریستارت.' } },
  clean_temp: { title: { en: 'Clean temporary files', fa: 'پاک‌سازی فایل‌های موقت' }, desc: { en: 'Deletes files in your Temp and Windows\\Temp folders (files in use are skipped).', fa: 'فایل‌های پوشهٔ Temp شما و Windows\\Temp را حذف می‌کند (فایل‌های در حال استفاده رد می‌شوند).' } },
};
