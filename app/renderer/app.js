/* The page: login → app shell (Home / FPS / Network / Games / Tools / Settings). Everything goes through window.api. */
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
let lang = 'en', info = {}, status = {}, tweaks = [], actions = [], presets = [], settings = {}, sys = null;
const filters = { fps: 'all', network: 'all' }, logItems = [];
const t = (k, vars = {}) => Object.entries(vars).reduce((s, [a, b]) => s.replace('{' + a + '}', b), (I18N[lang] || I18N.en)[k] || I18N.en[k] || k);
const L = (obj) => (obj && (obj[lang] || obj.en)) || '';
const fmtDate = (ms) => new Date(ms).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
const fmtTime = (ms) => new Date(ms).toLocaleTimeString(lang === 'fa' ? 'fa-IR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
const num = (n) => lang === 'fa' ? String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]) : String(n);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toastTimer; const toast = (m) => { const el = $('#toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3500); };
const call = async (fn, ...args) => { const r = await fn(...args); if (!r.ok) throw new Error(r.error); return r.data; };
const byId = (id) => tweaks.find(x => x.id === id);
const title = (id) => { const tw = byId(id); return tw ? L(tw.title) : id; };
const log = (msg, bad) => { logItems.unshift({ at: Date.now(), msg, bad }); if (logItems.length > 30) logItems.pop(); renderLog(); };

/* ---- language ---- */
function setLang(l, save = true) {
  lang = l === 'fa' ? 'fa' : 'en'; document.documentElement.lang = lang; document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('.lang').forEach(el => { el.textContent = t('lang'); });
  $('#s-lang').value = lang;
  if (save) api.saveSettings({ lang });
  renderAll();
}
$$('.lang').forEach(el => el.onclick = (e) => { e.preventDefault(); setLang(lang === 'fa' ? 'en' : 'fa'); });
$('#s-lang').onchange = (e) => setLang(e.target.value);

/* ---- login ---- */
$('#loginform').onsubmit = async (e) => {
  e.preventDefault(); const btn = $('#lbtn'); btn.disabled = true; btn.textContent = t('signing_in'); $('#lerr').textContent = '';
  try { status = await call(api.login, $('#lu').value.trim(), $('#lp').value); $('#lp').value = ''; await showMain(); } catch (err) { $('#lerr').textContent = err.message; }
  btn.disabled = false; btn.textContent = t('login');
};
$('#logout').onclick = async () => { await api.logout(); status = {}; $('#main').hidden = true; $('#tbuser').hidden = true; $('#login').hidden = false; $('#lu').focus(); };
document.addEventListener('click', (e) => { const a = e.target.closest('[data-open]'); if (a) { e.preventDefault(); api.open(info.serverUrl + a.dataset.open); } });

/* ---- shell ---- */
async function showMain() {
  $('#login').hidden = true; $('#main').hidden = false;
  $('#tbuser').hidden = false; $('#tbuser span').textContent = status.username || '';
  if (!sys) api.systemInfo().then(r => { if (r.ok) { sys = r.data; renderPc(); } });
  await refresh();
}
function go(page) { $$('.nav-i').forEach(b => b.classList.toggle('on', b.dataset.page === page)); $$('main > section').forEach(s => s.hidden = s.dataset.page !== page); $('.content').scrollTop = 0; }
async function refresh() {
  try { tweaks = await call(api.state); } catch (e) { toast(t('error') + ': ' + e.message); }
  try { status = await call(api.status); } catch (e) {}
  renderAll();
}
function renderAll() {
  if ($('#main').hidden) return;
  renderHeader(); renderHome(); renderLists(); renderGames(); renderActions(); renderSettings(); renderPc(); renderLog();
}
function renderHeader() {
  const sc = $('#subcard'), days = Math.max(0, Math.ceil(((status.expires || 0) - Date.now()) / 86400000));
  if (status.active) sc.className = 'subcard on', sc.innerHTML = `<small>${t('sub_plan')}</small><b>${t('sub_days', { n: num(days) })}</b><div class="subcard-s">${t('sub_active', { d: fmtDate(status.expires) })}${status.offline ? '<br>' + t('sub_offline', { d: fmtDate(status.checked) }) : ''}</div><button class="ghost" data-open="/account">${t('renew')}</button>`;
  else sc.className = 'subcard off', sc.innerHTML = `<small>${t('sub_plan')}</small><b>${t('sub_none')}</b><button class="pri" data-open="/account">${t('buy')}</button>`;
  const b = $('#banner'); b.hidden = true; b.className = 'banner';
  if (info.platform && info.platform !== 'win32') { b.hidden = false; b.lastElementChild.textContent = t('not_windows'); }
  else if (!status.active) { b.hidden = false; b.lastElementChild.textContent = t('need_sub') + (status.error ? ' (' + status.error + ')' : ''); }
  else if (!info.isAdmin) { b.hidden = false; b.classList.add('warn'); b.lastElementChild.textContent = t('need_admin'); }
  $$('.pri[data-rec],.ghost[data-revert],#boost,#unboost').forEach(x => x.disabled = !status.active);
}
function renderHome() {
  $('#hi').textContent = t('hi', { u: status.username || '' });
  const rec = tweaks.filter(x => x.recommended), on = tweaks.filter(x => x.applied).length, recOn = rec.filter(x => x.applied).length;
  $('#t-active').textContent = `${num(on)} / ${num(tweaks.length)}`; $('#t-active-s').textContent = t('count', { a: num(recOn), n: num(rec.length) }) + ' · ' + t('rec').toLowerCase();
  const lp = settings.lastPing, avg = lp && lp.avg && lp.avg.length ? Math.round(lp.avg.reduce((a, b) => a + b, 0) / lp.avg.length) : null;
  const pe = $('#t-ping'); pe.textContent = avg == null ? '–' : `${num(avg)} ${t('ping_ms')}`; pe.className = avg == null ? '' : avg < 60 ? 'ok' : avg < 120 ? 'warn' : 'bad';
  $('#t-ping-s').textContent = lp && lp.at ? fmtDate(lp.at) + ' ' + fmtTime(lp.at) : t('never');
  const se = $('#t-state'), st = rec.length && recOn === rec.length ? 'boosted' : recOn ? 'partly' : 'not_boosted';
  se.textContent = t(st); se.className = st === 'boosted' ? 'ok' : st === 'partly' ? 'warn' : 'bad';
  $('#t-state-s').textContent = t('count', { a: num(recOn), n: num(rec.length) });
  for (const cat of ['fps', 'network']) { const items = tweaks.filter(x => x.category === cat); $('#cnt-' + cat).textContent = `${num(items.filter(x => x.applied).length)}/${num(items.length)}`; }
}
const cpuName = (c) => String(c).replace(/\(R\)|\(TM\)|®|™/g, '').replace(/\s*(@.*|CPU.*|Processor.*)$/i, '').replace(/\s+/g, ' ').trim();
function renderPc() {
  if (!sys) return;
  const rows = [['os', sys.os], ['cpu', `${cpuName(sys.cpu)} · ${num(sys.cores)}C`], ['gpu', sys.gpu], ['ram', `${num(sys.ramGb)} GB`]];
  $('#pcinfo').innerHTML = rows.map(([k, v]) => `<dt>${t(k)}</dt><dd title="${esc(v)}">${esc(v)}</dd>`).join('');
  $('#sysline').textContent = `${cpuName(sys.cpu)} · ${String(sys.gpu).split(',')[0]} · ${num(sys.ramGb)} GB`;
}
function renderLog() { $('#log').innerHTML = logItems.length ? logItems.map(i => `<li class="${i.bad ? 'bad' : ''}"><time>${fmtTime(i.at)}</time><span>${esc(i.msg)}</span></li>`).join('') : `<li class="empty">${t('activity_empty')}</li>`; }
function twRow(tw) {
  const opts = tw.options ? `<select data-opt="${tw.id}" ${tw.applied ? 'disabled' : ''}>${Object.entries(tw.options).map(([k, l]) => `<option value="${k}" ${k === tw.defaultOption ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : '';
  return `<div class="tw ${tw.applied ? 'on' : ''}" data-id="${tw.id}"><div class="tw-ic"><svg><use href="#${tw.applied ? 'i-check' : 'i-bolt'}"/></svg></div>
<div><h4>${esc(L(tw.title))}<span class="tag ${tw.recommended ? 'rec' : 'adv'}">${t(tw.recommended ? 'rec' : 'adv')}</span>${tw.reboot ? `<span class="tag reboot">${t('reboot')}</span>` : ''}</h4><p>${esc(L(tw.desc))}</p></div>
<div class="tw-c">${opts}<span class="st ${tw.error ? 'err' : ''}">${tw.error ? t('unknown') : t(tw.applied ? 'applied' : 'not_applied')}</span><label class="sw"><input type="checkbox" data-tw="${tw.id}" ${tw.applied ? 'checked' : ''} ${status.active ? '' : 'disabled'}><i></i></label></div></div>`;
}
function renderLists() {
  for (const cat of ['fps', 'network']) {
    const items = tweaks.filter(x => x.category === cat), f = filters[cat];
    const shown = items.filter(x => f === 'all' || (f === 'rec' ? x.recommended : !x.recommended));
    $(`#${cat}-count`).textContent = t('count', { a: num(items.filter(x => x.applied).length), n: num(items.length) });
    $(`#list-${cat}`).innerHTML = shown.map(twRow).join('');
    $$(`[data-filter-for="${cat}"] .chip`).forEach(c => c.classList.toggle('on', c.dataset.f === f));
  }
}
function renderGames() {
  $('#games').innerHTML = presets.map(p => {
    const on = p.tweaks.filter(id => byId(id) && byId(id).applied).length, all = on === p.tweaks.length;
    return `<div class="g ${all ? 'on' : ''}" data-preset="${p.id}"><div class="g-h"><img src="games/${p.icon}" alt=""><div><h4>${esc(p.name)}</h4><small>${t('preset_n', { a: num(on), n: num(p.tweaks.length) })}</small></div></div>
<div class="bar"><i style="width:${Math.round(on / p.tweaks.length * 100)}%"></i></div>
<div class="g-a"><button class="pri" data-optimize="${p.id}" ${status.active && !all ? '' : 'disabled'}>${all ? `<svg><use href="#i-check"/></svg><span>${t('optimized')}</span>` : t('optimize')}</button></div>
<details><summary>${t('tips')}</summary><ul>${p.tips.map(x => `<li>${esc(L(x))}</li>`).join('')}</ul></details></div>`;
  }).join('');
}
function renderActions() {
  $('#list-actions').innerHTML = actions.map(a => `<div class="tw" data-action="${a.id}"><div class="tw-ic"><svg><use href="#i-tool"/></svg></div><div><h4>${esc(L(a.title))}${a.reboot ? `<span class="tag reboot">${t('reboot')}</span>` : ''}</h4><p>${esc(L(a.desc))}</p></div><div class="tw-c"><span class="res" data-res="${a.id}"></span><button class="run" ${status.active ? '' : 'disabled'}>${t('run')}</button></div></div>`).join('');
}
function renderSettings() {
  $('#s-user').textContent = status.username || ''; $('#s-sub').textContent = status.active ? t('sub_active', { d: fmtDate(status.expires) }) : t('sub_none');
  $('#s-lite').checked = !!settings.lite; $('#s-lite-hint').hidden = !!settings.lite === !!info.lite;
  $('#version1').textContent = $('#version2').textContent = 'v' + (info.version || '');
}

/* ---- actions ---- */
const report = (rs, kind) => {
  const ok = rs.filter(r => !r.error && !r.info).length, bad = rs.filter(r => r.error), rp = rs.find(r => r.info);
  let m = t(kind === 'rec' ? 'applied_n' : 'reverted_n', { n: num(ok) });
  if (rp) m += ' · ' + t(rp.info.skipped ? 'restore_point_skip' : 'restore_point_made');
  if (bad.length) m += ' · ' + t('error') + ': ' + bad.map(b => title(b.id)).join(', ');
  if (rs.some(r => r.reboot)) m += ' — ' + t('reboot_hint');
  toast(m); return ok;
};
document.addEventListener('change', async (e) => {
  const cb = e.target.closest('input[data-tw]');
  if (cb) {
    const id = cb.dataset.tw, row = cb.closest('.tw'), sel = row.querySelector('select'), on = cb.checked; row.classList.add('busy'); cb.disabled = true;
    try { const r = await call(on ? api.apply : api.revert, id, sel ? sel.value : undefined); log(t(on ? 'log_apply' : 'log_revert', { t: title(id) })); if (r.reboot) toast(t('reboot_hint')); }
    catch (err) { toast(t('error') + ': ' + err.message); log(t('error') + ': ' + title(id) + ' — ' + err.message, true); }
    await refresh(); return;
  }
  if (e.target.id === 's-lite') { settings = (await api.saveSettings({ lite: e.target.checked })).data || settings; renderSettings(); }
});
document.addEventListener('click', async (e) => {
  if (e.target.closest('#s-relaunch')) { e.preventDefault(); api.relaunch(); return; }
  const btn = e.target.closest('button'); if (!btn) return;
  if (btn.dataset.page) { go(btn.dataset.page); return; }
  if (btn.dataset.f) { const cat = btn.closest('.chips').dataset.filterFor; filters[cat] = btn.dataset.f; renderLists(); return; }
  const row = btn.closest('.tw');
  if (row && row.dataset.action) {
    const res = row.querySelector('[data-res]'); btn.disabled = true; btn.textContent = t('running'); res.className = 'res'; res.textContent = '';
    try { const r = await call(api.action, row.dataset.action); res.textContent = L(r.message); res.className = 'res ok'; log(t('log_tool', { t: L(actions.find(a => a.id === r.id).title), r: L(r.message) })); if (r.reboot) toast(t('reboot_hint')); }
    catch (err) { res.textContent = err.message; res.className = 'res err'; log(t('error') + ': ' + err.message, true); }
    btn.disabled = false; btn.textContent = t('run'); return;
  }
  if (btn.dataset.optimize) {
    const p = presets.find(x => x.id === btn.dataset.optimize); btn.disabled = true; btn.textContent = t('running');
    try { const rs = await call(api.applyPreset, p.id); const ok = report(rs, 'rec'); log(t('log_preset', { g: p.name, n: num(ok) })); } catch (err) { toast(t('error') + ': ' + err.message); }
    await refresh(); go('games'); return;
  }
  if (btn.dataset.rec || btn.dataset.revert || btn.id === 'boost' || btn.id === 'unboost') {
    const cat = btn.dataset.rec || btn.dataset.revert, rec = !!btn.dataset.rec || btn.id === 'boost';
    const lbl = btn.querySelector('span') || btn, was = lbl.textContent; btn.disabled = true; lbl.textContent = rec && btn.id === 'boost' ? t('boosting') : t('running');
    try { const rs = await call(rec ? api.applyRecommended : api.revertAll, cat); const ok = report(rs, rec ? 'rec' : 'rev'); log(t(rec ? 'log_boost' : 'log_restore', { n: num(ok) })); } catch (err) { toast(t('error') + ': ' + err.message); }
    lbl.textContent = was; await refresh(); return;
  }
  if (btn.id === 'pingbtn') {
    btn.disabled = true; btn.textContent = t('ping_running'); const hosts = $('#pinghosts').value.trim().split(/\s+/).filter(Boolean).slice(0, 8);
    $('#pingr').innerHTML = hosts.map(h => `<div class="pr"><span>${esc(h)}</span><b>…</b></div>`).join('');
    try { const rs = await call(api.ping, hosts); $('#pingr').innerHTML = rs.map(r => `<div class="pr"><span title="${esc(r.host)}">${esc(r.host)}</span><b class="${r.avg == null ? 'bad' : r.avg < 60 ? 'ok' : r.avg < 120 ? 'warn' : 'bad'}">${r.avg == null ? t('ping_timeout') : num(r.avg) + ' ' + t('ping_ms') + (r.loss ? ` · ${num(r.loss)} ${t('ping_loss')}` : '')}</b></div>`).join('');
      settings = (await api.settings()).data || settings; renderHome(); } catch (err) { toast(err.message); }
    btn.disabled = false; btn.textContent = t('ping_run');
  }
});

/* ---- start ---- */
(async () => {
  info = (await api.info()).data || {}; settings = (await api.settings()).data || {};
  $('#pinghosts').value = (info.pingHosts || []).join(' ');
  $('#version1').textContent = $('#version2').textContent = 'v' + (info.version || '');
  actions = (await api.actions()).data || []; presets = (await api.presets()).data || [];
  setLang(settings.lang || (navigator.language.startsWith('fa') ? 'fa' : 'en'), false);
  status = (await api.status()).data || {};
  if (status.loggedIn) await showMain(); else { $('#login').hidden = false; $('#lu').focus(); }
})();
