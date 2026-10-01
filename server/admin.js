/* ============================================================
   fpsboost.ir/admin — the owner console. Its own shell (no marketing nav / footer), English only.
     adminAuthPage(ctx, step, opts)   step = 'login' (username + password) | 'setup' (one-time 2FA enrolment, QR + secret) | 'code' (6-digit code)
     adminDash(ctx, data)             overview KPIs, users (search, status filter, actions), payments
   Routing, sessions and TOTP live in worker.js.
   ============================================================ */
import qrcode from './qrcode.js';
import { esc, fmtNum } from './pages.js';

const I = {
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.7 3.2-5.8 6.5-5.8s5.9 2.1 6.5 5.8M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5c2 .7 3.2 2.6 3.5 5.5"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  coin: '<ellipse cx="12" cy="6.5" rx="8" ry="3.5"/><path d="M4 6.5v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-5M4 11.5v5c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5v-5"/>',
  shield: '<path d="M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
  out: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  crown: '<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
};
const ic = (k, cls = '') => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const MARK = '<span class="mark" aria-hidden="true"></span>';

const CSS = `
:root{color-scheme:dark;--bg:#07070b;--side:#0a0a11;--card:#0e0e16;--card2:#13131d;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);
--text:#f4f2fb;--muted:#9a96ad;--dim:#6a667e;--accent:#8b5cf6;--accent2:#a78bfa;--accent3:#c4b5fd;--ok:#4ade80;--bad:#fb7185;--warn:#fbbf24;--gold:#f5c451}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{background:var(--bg);color:var(--text);font:14px/1.55 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(900px 500px at 85% -10%,rgba(139,92,246,.13),transparent 60%),radial-gradient(700px 420px at -10% 110%,rgba(99,102,241,.08),transparent 60%);z-index:0}
a{color:var(--accent2);text-decoration:none}
.i{width:18px;height:18px;flex:none}
.mark{display:inline-block;width:32px;height:21px;background:linear-gradient(90deg,#fff,#c4b5fd);-webkit-mask:url(/logo.png) center/contain no-repeat;mask:url(/logo.png) center/contain no-repeat;flex:none}
input,button{font:inherit;color:inherit}
input{width:100%;background:rgba(255,255,255,.035);border:1px solid var(--line2);border-radius:11px;padding:10px 13px;outline:none;transition:border-color .2s,box-shadow .2s,background .2s}
input:focus{border-color:var(--accent2);box-shadow:0 0 0 4px rgba(139,92,246,.18);background:rgba(255,255,255,.05)}
input::placeholder{color:var(--dim)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;border-radius:11px;padding:10px 16px;font-weight:600;background:linear-gradient(135deg,#8b5cf6,#6d3ff0);color:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.1) inset,0 10px 26px -12px rgba(139,92,246,.9);transition:transform .15s,box-shadow .2s,background .2s;white-space:nowrap}
.btn:hover{box-shadow:0 0 0 1px rgba(255,255,255,.16) inset,0 14px 32px -12px rgba(139,92,246,1)}.btn:active{transform:translateY(1px)}
.btn.ghost{background:rgba(255,255,255,.04);box-shadow:0 0 0 1px var(--line2) inset;color:var(--text)}.btn.ghost:hover{background:rgba(255,255,255,.08)}
.btn.sm{padding:6px 11px;font-size:12.5px;border-radius:9px}.btn.full{width:100%;padding:12px}
.btn.danger{background:rgba(251,113,133,.1);color:var(--bad);box-shadow:0 0 0 1px rgba(251,113,133,.3) inset}.btn.danger:hover{background:rgba(251,113,133,.18)}
.muted{color:var(--muted)}.dim{color:var(--dim)}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;background:rgba(255,255,255,.05);color:var(--muted);box-shadow:0 0 0 1px var(--line) inset}
.pill:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.pill.on{color:var(--ok);background:rgba(74,222,128,.08);box-shadow:0 0 0 1px rgba(74,222,128,.22) inset}
.pill.warn{color:var(--warn);background:rgba(251,191,36,.08);box-shadow:0 0 0 1px rgba(251,191,36,.22) inset}
.pill.off{color:var(--bad);background:rgba(251,113,133,.08);box-shadow:0 0 0 1px rgba(251,113,133,.22) inset}
.owner{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:6px;font-size:10.5px;font-weight:800;letter-spacing:.09em;color:#1a1300;background:linear-gradient(135deg,#ffe08a,#f5b83d);box-shadow:0 4px 14px -6px rgba(245,196,81,.8)}
.owner .i{width:12px;height:12px}

/* ---- sign-in ---- */
.auth{position:relative;z-index:1;min-height:100vh;display:grid;place-items:center;padding:24px 16px}
.acard{width:100%;max-width:420px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015));border:1px solid var(--line2);border-radius:22px;padding:30px 28px;box-shadow:0 40px 90px -40px rgba(0,0,0,.9),0 0 0 1px rgba(139,92,246,.06);animation:rise .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
.abrand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;margin-bottom:22px}
.abrand small{margin-inline-start:auto;font-weight:500;color:var(--dim);font-size:12px}
.acard h1{font-size:22px;margin:0 0 4px;letter-spacing:-.01em}.acard p.sub{margin:0 0 20px;color:var(--muted)}
.steps{display:flex;gap:8px;margin:0 0 22px}.steps span{flex:1;height:4px;border-radius:4px;background:var(--line2)}.steps span.on{background:linear-gradient(90deg,#8b5cf6,#c4b5fd)}
.fld{display:block;margin:0 0 12px}.fld b{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:0 0 6px}
.err{color:var(--bad);min-height:20px;margin:2px 0 10px;font-size:13px}
.code{font:600 26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.5em;text-align:center;padding:14px 0 14px .5em}
.qr{display:grid;place-items:center;background:#fff;border-radius:16px;padding:14px;width:196px;margin:0 auto 14px;box-shadow:0 18px 40px -18px rgba(139,92,246,.7)}
.qr svg{width:168px;height:168px}
.secret{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.03);border:1px dashed var(--line2);border-radius:11px;padding:9px 10px 9px 13px;margin:0 0 16px}
.secret code{flex:1;font:600 13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;word-break:break-all;color:var(--accent3)}
.note{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:var(--muted);background:rgba(139,92,246,.07);border:1px solid rgba(139,92,246,.18);border-radius:12px;padding:10px 12px;margin:16px 0 0}
.note .i{color:var(--accent2);margin-top:1px}
ol.how{margin:0 0 16px;padding-inline-start:18px;color:var(--muted);font-size:13px}ol.how li{margin:2px 0}ol.how b{color:var(--text);font-weight:600}

/* ---- console ---- */
.app{position:relative;z-index:1;display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh}
.side{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:6px;padding:22px 16px;background:linear-gradient(180deg,rgba(14,14,22,.92),rgba(10,10,17,.92));border-inline-end:1px solid var(--line);backdrop-filter:blur(10px)}
.side .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;color:var(--text);padding:0 8px 18px}
.side .brand small{display:block;font-size:11px;font-weight:500;color:var(--dim)}
.side nav a{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;color:var(--muted);font-weight:500;transition:background .2s,color .2s}
.side nav a:hover{background:rgba(255,255,255,.04);color:var(--text)}
.side nav a.on{background:rgba(139,92,246,.12);color:var(--text);box-shadow:0 0 0 1px rgba(139,92,246,.25) inset}.side nav a.on .i{color:var(--accent2)}
.side nav a .n{margin-inline-start:auto;font-size:11.5px;color:var(--dim);font-variant-numeric:tabular-nums}
.side .grow{flex:1}
.me{border:1px solid var(--line2);border-radius:16px;padding:14px;background:linear-gradient(160deg,rgba(245,196,81,.07),rgba(139,92,246,.05) 60%,transparent)}
.me .row{display:flex;align-items:center;gap:11px}
.av{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none;color:#fff;background:linear-gradient(135deg,hsl(var(--h,262) 70% 58%),hsl(calc(var(--h,262) + 40) 70% 45%))}
.me .av{background:linear-gradient(135deg,#ffd76e,#e8a02c);color:#1a1300;border-radius:12px}
.me b{display:block;font-size:14px}.me .sec{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ok);margin:10px 0 12px}.me .sec .i{width:14px;height:14px}
.main{padding:26px 32px 60px;min-width:0}
.top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 0 22px}
.top h1{margin:0;font-size:24px;letter-spacing:-.015em}.top p{margin:3px 0 0;color:var(--muted)}
.top .r{display:flex;gap:8px;align-items:center}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin:0 0 22px}
.kpi{position:relative;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 16px 14px;animation:rise .5s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--d,0) * 60ms)}
.kpi:after{content:"";position:absolute;inset:auto -30% -60% auto;width:140px;height:140px;border-radius:50%;background:radial-gradient(closest-side,var(--g,rgba(139,92,246,.18)),transparent);pointer-events:none}
.kpi .h{display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:12.5px;font-weight:500}
.kpi .h span.ico{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.04);color:var(--c,var(--accent2));box-shadow:0 0 0 1px var(--line) inset}
.kpi .h .i{width:16px;height:16px}
.kpi b{display:block;font-size:26px;font-weight:700;letter-spacing:-.02em;margin:10px 0 2px;font-variant-numeric:tabular-nums}
.kpi small{color:var(--dim);font-size:12px}
.bar{height:5px;border-radius:5px;background:rgba(255,255,255,.06);margin-top:8px;overflow:hidden}.bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#4ade80,#a3e635)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:18px;margin:0 0 22px;scroll-margin-top:20px;animation:rise .5s .15s cubic-bezier(.2,.7,.2,1) both}
.ph{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 18px;border-bottom:1px solid var(--line)}
.ph h2{margin:0;font-size:16px;display:flex;align-items:center;gap:9px}.ph h2 .c{font-size:12px;color:var(--dim);font-weight:500}
.ph .sp{flex:1}
.srch{position:relative;width:240px}.srch .i{position:absolute;inset-inline-start:11px;top:50%;transform:translateY(-50%);color:var(--dim);width:16px;height:16px}.srch input{padding-inline-start:34px;padding-block:8px}
.seg{display:inline-flex;background:rgba(255,255,255,.035);border:1px solid var(--line);border-radius:10px;padding:3px}
.seg button{background:none;border:0;border-radius:7px;padding:5px 10px;font-size:12.5px;color:var(--muted);cursor:pointer;font-weight:500}
.seg button.on{background:rgba(139,92,246,.18);color:var(--text)}
.tbl{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{position:sticky;top:0;text-align:start;font-weight:600;font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);padding:10px 18px;background:var(--card2);white-space:nowrap}
td{padding:12px 18px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap}
tr.u:hover td,tr.p:hover td{background:rgba(255,255,255,.018)}
.who{display:flex;align-items:center;gap:11px}.who .av{width:34px;height:34px;border-radius:10px;font-size:13.5px}
.who b{display:block;font-weight:600}.who small{display:block;color:var(--dim);font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis}
.num{font-variant-numeric:tabular-nums}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:var(--muted)}
.acts{display:flex;align-items:center;gap:6px;justify-content:flex-end}
.acts form{display:contents}.acts form.quick{display:inline-flex}
.quick{display:inline-flex;border-radius:9px;box-shadow:0 0 0 1px var(--line2) inset;overflow:hidden}
.quick button{background:none;border:0;padding:6px 10px;font-size:12.5px;font-weight:600;color:var(--accent3);cursor:pointer}
.quick button+button{border-inline-start:1px solid var(--line2)}.quick button:hover{background:rgba(139,92,246,.14);color:#fff}
details.more{position:relative}
details.more summary{list-style:none;cursor:pointer;width:32px;height:30px;display:grid;place-items:center;border-radius:9px;color:var(--muted);box-shadow:0 0 0 1px var(--line2) inset}
details.more summary::-webkit-details-marker{display:none}
details.more[open] summary,details.more summary:hover{background:rgba(255,255,255,.06);color:var(--text)}
.menu{position:absolute;inset-inline-end:0;top:36px;z-index:20;width:280px;background:#15151f;border:1px solid var(--line2);border-radius:14px;padding:8px;box-shadow:0 24px 60px -18px rgba(0,0,0,.9);white-space:normal}
.menu .mi{display:flex;gap:6px;padding:4px}
.menu .mi input{padding:7px 10px;font-size:12.5px;border-radius:9px}
.menu .mi .btn{flex:none}
.menu .row2{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px}
.menu .row2 .btn{width:100%}
.menu hr{border:0;border-top:1px solid var(--line);margin:6px 4px}
.menu h6{margin:4px 6px 2px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
@media (min-width:901px){.tbl{overflow:visible}}
#ub tr:nth-last-child(-n+2):not(:nth-child(-n+2)) .menu{top:auto;bottom:36px}
.empty{padding:34px 18px;text-align:center;color:var(--dim)}
.toast{position:fixed;inset-block-end:22px;inset-inline-end:22px;z-index:50;display:flex;align-items:center;gap:10px;background:#141420;border:1px solid rgba(74,222,128,.3);color:var(--text);padding:11px 16px;border-radius:12px;box-shadow:0 20px 50px -20px rgba(0,0,0,.9);animation:rise .35s both,gone .4s 3.2s forwards}
.toast .i{color:var(--ok)}@keyframes gone{to{opacity:0;transform:translateY(8px);visibility:hidden}}
.mtop{display:none}
@media (max-width:1180px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:900px){
  .app{grid-template-columns:minmax(0,1fr)}.app>div{min-width:0}.side{display:none}
  .mtop{display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:30;padding:12px 16px;background:rgba(10,10,17,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .mtop .brand{display:flex;align-items:center;gap:9px;font-weight:700;color:var(--text)}.mtop .sp{flex:1}
  .mtop nav{display:flex;gap:2px;overflow-x:auto;min-width:0}.mtop nav a{display:flex;align-items:center;gap:6px;color:var(--muted);padding:6px 9px;border-radius:8px;font-size:13px;white-space:nowrap}.mtop nav .i{width:15px;height:15px}.mtop nav .n{display:none}.mtop .owner{display:none}.mtop nav a.on{background:rgba(139,92,246,.14);color:var(--text)}
  .main{padding:18px 16px 50px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kpi:last-child{grid-column:1/-1}
  .srch{width:100%}.ph .sp{display:none}.seg{max-width:100%;overflow-x:auto}.seg button{white-space:nowrap}
  .panel{animation:none}  .menu{position:fixed;inset:auto 12px 12px 12px;width:auto}
  #ub tr .menu{top:auto;bottom:12px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

function shell(ctx, title, body, script = '') {
  const { nonce } = ctx;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · FPS Boost admin</title><meta name="theme-color" content="#07070b"><link rel="icon" href="/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style nonce="${nonce}">${CSS}</style></head><body>${body}${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`;
}

/* ---- sign-in: password → (first time: scan + confirm) → 6-digit code ---- */
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code for your authenticator app"><path fill="#0b0b12" d="${d}"/></svg>`;
}
export function adminAuthPage(ctx, step, opts = {}) {
  const err = `<p class="err" role="alert">${esc(opts.error || '')}</p>`;
  const head = (h, sub, n) => `<div class="abrand">${MARK}<span>FPS Boost</span><small>Owner console</small></div><div class="steps">${[1, 2].map(i => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div><h1>${h}</h1><p class="sub">${sub}</p>`;
  const codeField = `<label class="fld"><b>6-digit code</b><input class="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus placeholder="000000"></label>`;
  let inner;
  if (step === 'login') inner = `${head('Sign in', 'Owner access to users, subscriptions and payments.', 1)}
<form method="post" action="/admin/login"><label class="fld"><b>Username</b><input name="username" autocomplete="username" required autofocus maxlength="64" value="${esc(opts.username || '')}"></label>
<label class="fld"><b>Password</b><input name="password" type="password" autocomplete="current-password" required maxlength="200"></label>${err}<button class="btn full">${ic('lock')}Continue</button></form>
<div class="note">${ic('shield')}<span>Protected by two-factor authentication. After the password you will be asked for a code from your authenticator app.</span></div>`;
  else if (step === 'setup') inner = `${head('Set up two-factor', 'One-time setup — this screen is shown only once.', 2)}
<ol class="how"><li>Open <b>Google Authenticator</b>, <b>Microsoft Authenticator</b>, Authy or 1Password.</li><li>Scan the code, or type the key below.</li><li>Enter the 6-digit code it shows.</li></ol>
<div class="qr">${qrSvg(opts.uri)}</div>
<div class="secret"><code id="sk">${esc(opts.secret.replace(/(.{4})/g, '$1 ').trim())}</code><button type="button" class="btn ghost sm" id="cp">${ic('copy')}Copy</button></div>
<form method="post" action="/admin/setup">${codeField}${err}<button class="btn full">${ic('shield')}Turn on 2FA and sign in</button></form>`;
  else inner = `${head('Two-factor code', 'Enter the code from your authenticator app.', 2)}
<form method="post" action="/admin/2fa">${codeField}${err}<button class="btn full">${ic('shield')}Verify</button></form>
<p class="muted" style="margin:14px 0 0;font-size:12.5px"><a href="/admin/logout">← Use another account</a></p>`;
  const js = step === 'setup' ? `var b=document.getElementById('cp');b&&b.addEventListener('click',function(){navigator.clipboard.writeText(document.getElementById('sk').textContent.replace(/\\s/g,'')).then(function(){b.lastChild.textContent='Copied'})});` : '';
  return shell(ctx, step === 'login' ? 'Sign in' : 'Two-factor', `<div class="auth"><div class="acard">${inner}</div></div>`, js);
}

/* ---- the console ---- */
const DAY = 86400000;
const d10 = (ms) => new Date(ms).toISOString().slice(0, 10);
const ago = (ms) => { const s = (Date.now() - ms) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : s < 86400 * 30 ? `${Math.floor(s / 86400)}d ago` : d10(ms); };
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 360; };
const FLASH = { extend: 'Subscription extended', expire: 'Subscription ended', toggle: 'Account status changed', devices: 'Devices reset', password: 'Password changed', short: 'Password must be at least 8 characters', note: 'Note saved', delete: 'User deleted' };

export function adminDash(ctx, { users, stats, payments, q, owner, flash }) {
  const now = Date.now();
  const state = (u) => u.disabled ? 'disabled' : (u.expires || 0) > now ? 'active' : u.expires ? 'expired' : 'none';
  const count = { all: users.length, active: 0, expired: 0, none: 0, disabled: 0 }; users.forEach(u => count[state(u)]++);
  const pct = stats.users ? Math.round(stats.active / stats.users * 100) : 0;
  const kpi = (i, k, label, val, sub, c, g, extra = '') => `<div class="kpi" style="--d:${i};--c:${c};--g:${g}"><div class="h">${label}<span class="ico">${ic(k)}</span></div><b>${val}</b><small>${sub}</small>${extra}</div>`;

  const row = (u) => {
    let m = []; try { m = JSON.parse(u.machines || '[]'); } catch (e) {}
    const st = state(u), left = Math.ceil(((u.expires || 0) - now) / DAY);
    const pill = st === 'active' ? `<span class="pill on">Active · ${left}d left</span>` : st === 'expired' ? `<span class="pill warn">Expired ${d10(u.expires)}</span>` : st === 'disabled' ? '<span class="pill off">Disabled</span>' : '<span class="pill">No plan</span>';
    const hid = (act) => `<input type="hidden" name="id" value="${esc(u.id)}"><input type="hidden" name="act" value="${act}">`;
    const f = (act, label, cls = 'ghost sm', extra = '', confirm = '') => `<form method="post"${confirm ? ` data-confirm="${esc(confirm)}"` : ''}>${hid(act)}${extra}<button class="btn ${cls}">${label}</button></form>`;
    return `<tr class="u" data-st="${st}"><td><div class="who"><span class="av" style="--h:${hue(u.username)}">${esc(u.username[0].toUpperCase())}</span><div><b>${esc(u.username)}</b><small>${esc(u.note || `joined ${d10(u.created)}`)}</small></div></div></td>
<td>${pill}${st === 'active' ? `<div class="dim" style="font-size:11.5px;margin-top:3px">until ${d10(u.expires)}</div>` : ''}</td><td class="muted">${u.last_seen ? ago(u.last_seen) : 'never'}</td><td class="num">${m.length} <span class="dim">/ ${Number(ctx.env.MAX_MACHINES) || 2}</span></td><td class="muted num">${d10(u.created)}</td>
<td><div class="acts"><form method="post" class="quick">${hid('extend')}<button name="months" value="1" title="Add 1 month">+1m</button><button name="months" value="3" title="Add 3 months">+3m</button><button name="months" value="12" title="Add 12 months">+12m</button></form>
<details class="more"><summary title="More">${ic('dots')}</summary><div class="menu"><h6>Account</h6><div class="row2">${f('expire', 'End plan now')}${f('toggle', u.disabled ? 'Enable' : 'Disable')}${f('devices', 'Reset devices')}${f('delete', 'Delete user', 'danger sm', '', `Delete ${u.username} and their payment history? This cannot be undone.`)}</div><hr>
<h6>Password</h6><form method="post" class="mi">${hid('password')}<input name="password" type="password" placeholder="New password (8+)" minlength="8" autocomplete="new-password"><button class="btn sm">Set</button></form>
<h6>Note</h6><form method="post" class="mi">${hid('note')}<input name="note" value="${esc(u.note || '')}" placeholder="Private note" maxlength="200"><button class="btn sm">Save</button></form></div></details></div></td></tr>`;
  };
  const payRow = (p) => `<tr class="p"><td class="muted num">${new Date(p.created).toISOString().slice(0, 16).replace('T', ' ')}</td><td><b>${esc(p.username || p.user_id)}</b></td><td>${p.months} mo</td><td class="num"><b>${fmtNum('en', p.amount)}</b> <span class="dim">T</span></td><td><span class="pill ${p.status === 'paid' ? 'on' : p.status === 'pending' ? 'warn' : 'off'}">${esc(p.status)}</span></td><td class="mono">${esc(p.ref_id || '—')}</td><td class="mono">${esc(p.card_pan || '—')}</td></tr>`;
  const nav = (cls) => `<a href="#overview" class="${cls}on">${ic('grid')}Overview</a><a href="#users">${ic('users')}Users<span class="n">${stats.users}</span></a><a href="#payments">${ic('card')}Payments<span class="n">${stats.payments}</span></a>`;
  const seg = ['all', 'active', 'expired', 'none', 'disabled'].map(k => `<button type="button" data-f="${k}" class="${k === 'all' ? 'on' : ''}">${k === 'none' ? 'No plan' : k[0].toUpperCase() + k.slice(1)} <span class="dim">${count[k]}</span></button>`).join('');

  const body = `<div class="app"><aside class="side"><a class="brand" href="/admin">${MARK}<span>FPS Boost<small>Owner console</small></span></a><nav>${nav('')}</nav><div class="grow"></div>
<a class="btn ghost sm" href="/" target="_blank" rel="noopener" style="justify-content:flex-start;margin:0 0 10px">${ic('ext')}View site</a>
<div class="me"><div class="row"><span class="av">${esc(owner[0].toUpperCase())}</span><div><b>${esc(owner)}</b><span class="owner">${ic('crown')}OWNER</span></div></div><div class="sec">${ic('shield')}Two-factor on</div><a class="btn ghost sm" href="/admin/logout" style="width:100%">${ic('out')}Sign out</a></div></aside>
<div><div class="mtop"><a class="brand" href="/admin">${MARK}</a><nav>${nav('')}</nav><span class="sp"></span><span class="owner">${ic('crown')}${esc(owner)}</span><a href="/admin/logout" title="Sign out" class="muted">${ic('out')}</a></div>
<main class="main"><div class="top" id="overview"><div><h1>Welcome back, ${esc(owner)}</h1><p>${new Date(now).toUTCString().slice(0, 16)} · fpsboost.ir</p></div><div class="r"><span class="pill on">Live</span></div></div>
<section class="kpis">${kpi(0, 'users', 'Users', fmtNum('en', stats.users), `${count.none} without a plan`, '#a78bfa', 'rgba(139,92,246,.18)')}
${kpi(1, 'bolt', 'Active plans', fmtNum('en', stats.active), `${pct}% of all users`, '#4ade80', 'rgba(74,222,128,.14)', `<div class="bar"><i style="width:${pct}%"></i></div>`)}
${kpi(2, 'eye', 'Seen in 24h', fmtNum('en', stats.seen24h), 'app check-ins', '#60a5fa', 'rgba(96,165,250,.14)')}
${kpi(3, 'card', 'Payments', fmtNum('en', stats.payments), 'verified by Zarinpal', '#f472b6', 'rgba(244,114,182,.14)')}
${kpi(4, 'coin', 'Revenue', fmtNum('en', stats.revenue), 'Toman, all time', '#f5c451', 'rgba(245,196,81,.14)')}</section>
<section class="panel" id="users"><div class="ph"><h2>${ic('users')}Users <span class="c">${users.length}${q ? ` matching “${esc(q)}”` : ''}</span></h2><span class="sp"></span><div class="seg" id="seg">${seg}</div>
<form method="get" action="/admin#users" class="srch">${ic('search')}<input name="q" value="${esc(q)}" placeholder="Search username" autocomplete="off"></form></div>
<div class="tbl"><table><thead><tr><th>User</th><th>Plan</th><th>Last seen</th><th>Devices</th><th>Joined</th><th></th></tr></thead><tbody id="ub">${users.map(row).join('')}</tbody></table>${users.length ? '<div class="empty" id="ue" hidden>No users in this group</div>' : `<div class="empty">${q ? 'No users match that search' : 'No users yet'}</div>`}</div></section>
<section class="panel" id="payments"><div class="ph"><h2>${ic('card')}Payments <span class="c">last ${payments.length}</span></h2></div>
<div class="tbl"><table><thead><tr><th>Date (UTC)</th><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Ref</th><th>Card</th></tr></thead><tbody>${payments.map(payRow).join('')}</tbody></table>${payments.length ? '' : '<div class="empty">No payments yet</div>'}</div></section>
</main></div></div>${FLASH[flash] ? `<div class="toast" role="status">${ic('shield')}${FLASH[flash]}</div>` : ''}`;

  const js = `document.querySelectorAll('form[data-confirm]').forEach(function(f){f.addEventListener('submit',function(e){if(!confirm(f.dataset.confirm))e.preventDefault()})});
var seg=document.getElementById('seg'),rows=[].slice.call(document.querySelectorAll('#ub tr')),ue=document.getElementById('ue');
seg&&seg.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;[].forEach.call(seg.children,function(x){x.classList.toggle('on',x===b)});var k=b.dataset.f,n=0;rows.forEach(function(r){var s=k==='all'||r.dataset.st===k;r.hidden=!s;if(s)n++});if(ue)ue.hidden=n>0});
document.addEventListener('click',function(e){document.querySelectorAll('details.more[open]').forEach(function(d){if(!d.contains(e.target))d.removeAttribute('open')})});
var links=[].slice.call(document.querySelectorAll('.side nav a,.mtop nav a')),secs=['overview','users','payments'].map(function(id){return document.getElementById(id)});
function spy(){var cur='overview';secs.forEach(function(s){if(s&&s.getBoundingClientRect().top<innerHeight*.35)cur=s.id});links.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+cur)})}
addEventListener('scroll',spy,{passive:true});spy();
if(location.search.indexOf('ok=')>=0)history.replaceState(null,'',location.pathname+location.search.replace(/[?&]ok=[^&]*/,'').replace(/^&/,'?')+location.hash);`;
  return shell(ctx, 'Console', body, js);
}
