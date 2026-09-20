// Engine tests with a fake Windows: an in-memory registry behind `reg`, canned powercfg / powershell / netsh answers.
// Run: npm test  (node --test) — no Windows needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Engine, MemoryBackup, regTweak, parseRegValue } = require('../src/engine');
const TWEAKS = require('../tweaks/manifest');
const tools = require('../src/tools');

function fakeWindows(initial = {}) {
  const reg = new Map(Object.entries(initial));   // "KEY\\name" → { type, value }
  const calls = [];
  let scheme = '381b4222-f694-41f0-9685-ff5bb260df2e';
  const tcp = { AutoTuningLevelLocal: 'Disabled', EcnCapability: 'Enabled', Timestamps: 'Enabled' };
  let dns = [{ idx: 5, alias: 'Ethernet', static: '', servers: ['192.168.1.1'] }];
  // real `reg` accepts HKLM/HKCU and prints subkeys as HKEY_LOCAL_MACHINE\... — the fake does the same
  const short = (k) => k.replace(/^HKEY_LOCAL_MACHINE/i, 'HKLM').replace(/^HKEY_CURRENT_USER/i, 'HKCU');
  const long = (k) => k.replace(/^HKLM/, 'HKEY_LOCAL_MACHINE').replace(/^HKCU/, 'HKEY_CURRENT_USER');
  const runner = { async run(cmd, args) {
    calls.push([cmd, ...args]);
    if (cmd === 'reg') {
      const [op, rawKey, flag, name, , type, , value] = args; const key = short(rawKey);
      if (op === 'query' && flag === '/v') { const e = reg.get(key + '\\' + name); return e ? { code: 0, out: `\r\n${key}\r\n    ${name}    ${e.type}    ${e.type === 'REG_DWORD' ? '0x' + (e.value >>> 0).toString(16) : e.value}\r\n` } : { code: 1, out: '', err: 'ERROR: The system was unable to find the specified registry key or value.' }; }
      if (op === 'query') { const subs = [...new Set([...reg.keys()].filter(k => k.startsWith(key + '\\')).map(k => key + '\\' + k.slice(key.length + 1).split('\\')[0]))]; return { code: 0, out: subs.map(long).join('\r\n') + '\r\n' }; }
      if (op === 'add') { reg.set(key + '\\' + name, { type, value: type === 'REG_DWORD' ? Number(value) : value }); return { code: 0, out: 'The operation completed successfully.' }; }
      if (op === 'delete') { reg.delete(key + '\\' + name); return { code: 0, out: '' }; }
    }
    if (cmd === 'powercfg') {
      if (args[0] === '/getactivescheme') return { code: 0, out: `Power Scheme GUID: ${scheme}  (Balanced)` };
      if (args[0] === '/list') return { code: 0, out: `Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)\nPower Scheme GUID: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (High performance)\nPower Scheme GUID: e9a42b02-d5df-448d-aa00-03f14749eb61  (Ultimate Performance)` };
      if (args[0] === '/setactive') { scheme = args[1]; return { code: 0, out: '' }; }
      return { code: 0, out: '' };
    }
    if (cmd === 'powershell') {
      const s = args[args.length - 1];
      if (s.includes('Get-NetTCPSetting')) return { code: 0, out: JSON.stringify(tcp) };
      if (s.includes('Set-NetTCPSetting')) { const m = s.match(/-AutoTuningLevelLocal (\w+) -EcnCapability (\w+) -Timestamps (\w+)/); Object.assign(tcp, { AutoTuningLevelLocal: m[1], EcnCapability: m[2], Timestamps: m[3] }); return { code: 0, out: '' }; }
      if (s.includes('Get-NetAdapter')) return { code: 0, out: JSON.stringify(dns.length === 1 ? dns[0] : dns) };
      if (s.includes('Set-DnsClientServerAddress')) { const idx = Number(s.match(/-InterfaceIndex (\d+)/)[1]), a = dns.find(d => d.idx === idx); if (s.includes('-ResetServerAddresses')) a.servers = ['192.168.1.1']; else a.servers = s.match(/-ServerAddresses (\S+)/)[1].split(','); return { code: 0, out: '' }; }
      return { code: 0, out: '0' };
    }
    if (cmd === 'ping') return { code: 0, out: `Reply from 1.1.1.1: bytes=32 time=20ms TTL=57\r\nReply from 1.1.1.1: bytes=32 time=24ms TTL=57\r\nReply from 1.1.1.1: bytes=32 time<1ms TTL=57\r\nRequest timed out.\r\n` };
    return { code: 0, out: '' };
  } };
  return { runner, reg, calls, dns: () => dns, tcp: () => tcp, scheme: () => scheme };
}

test('parseRegValue', () => { assert.equal(parseRegValue('REG_DWORD', '0x14'), 20); assert.equal(parseRegValue('REG_DWORD', '0xffffffff'), 4294967295); assert.equal(parseRegValue('REG_SZ', 'High'), 'High'); });

test('registry tweak: apply, check, revert restores the original and deletes what did not exist', async () => {
  const fw = fakeWindows({ 'HKCU\\System\\GameConfigStore\\GameDVR_Enabled': { type: 'REG_DWORD', value: 1 } });
  const engine = new Engine({ tweaks: TWEAKS, runner: fw.runner, backup: new MemoryBackup() });
  const before = (await engine.state()).find(x => x.id === 'game_dvr_off'); assert.equal(before.applied, false);
  const r = await engine.apply('game_dvr_off'); assert.equal(r.applied, true);
  assert.equal(fw.reg.get('HKCU\\System\\GameConfigStore\\GameDVR_Enabled').value, 0);
  await engine.apply('game_dvr_off');   // twice: the backup must still hold the ORIGINAL value 1
  await engine.revert('game_dvr_off');
  assert.equal(fw.reg.get('HKCU\\System\\GameConfigStore\\GameDVR_Enabled').value, 1);
  assert.equal(fw.reg.has('HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR\\AllowGameDVR'), false, 'a value that did not exist is deleted on revert');
  assert.equal((await engine.state()).find(x => x.id === 'game_dvr_off').applied, false);
});

test('every tweak has both languages, a category and works against the fake', async () => {
  const fw = fakeWindows({ 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\{A}\\DhcpIPAddress': { type: 'REG_SZ', value: '10.0.0.2' }, 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\{B}\\DhcpIPAddress': { type: 'REG_SZ', value: '10.0.0.3' } });
  const engine = new Engine({ tweaks: TWEAKS, runner: fw.runner, backup: new MemoryBackup() });
  for (const tw of TWEAKS) {
    assert.ok(tw.title.en && tw.title.fa && tw.desc.en && tw.desc.fa, tw.id + ' needs en+fa text');
    assert.ok(['fps', 'network'].includes(tw.category), tw.id);
    const a = await engine.apply(tw.id, tw.defaultOption); assert.equal(a.applied, true, tw.id + ' should be applied');
    const r = await engine.revert(tw.id); assert.equal(r.applied, false, tw.id + ' should be reverted');
  }
});

test('nagle: sets both values on every interface and revert removes them', async () => {
  const IF = 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces';
  const fw = fakeWindows({ [`${IF}\\{A}\\DhcpIPAddress`]: { type: 'REG_SZ', value: '1' }, [`${IF}\\{B}\\TCPNoDelay`]: { type: 'REG_DWORD', value: 0 } });
  const engine = new Engine({ tweaks: TWEAKS, runner: fw.runner, backup: new MemoryBackup() });
  await engine.apply('nagle_off');
  assert.equal(fw.reg.get(`${IF}\\{A}\\TcpAckFrequency`).value, 1); assert.equal(fw.reg.get(`${IF}\\{B}\\TCPNoDelay`).value, 1);
  await engine.revert('nagle_off');
  assert.equal(fw.reg.has(`${IF}\\{A}\\TcpAckFrequency`), false); assert.equal(fw.reg.get(`${IF}\\{B}\\TCPNoDelay`).value, 0, 'pre-existing value restored');
});

test('dns: option picks the provider, revert goes back to DHCP or the old static servers', async () => {
  const fw = fakeWindows(); const engine = new Engine({ tweaks: TWEAKS, runner: fw.runner, backup: new MemoryBackup() });
  await engine.apply('dns_fast', 'shecan'); assert.deepEqual(fw.dns()[0].servers, ['178.22.122.100', '185.51.200.2']);
  assert.equal((await engine.state()).find(x => x.id === 'dns_fast').applied, true);
  await engine.revert('dns_fast'); assert.deepEqual(fw.dns()[0].servers, ['192.168.1.1']);
  fw.dns()[0].static = '9.9.9.9,149.112.112.112';
  await engine.apply('dns_fast', 'google'); await engine.revert('dns_fast'); assert.deepEqual(fw.dns()[0].servers, ['9.9.9.9', '149.112.112.112']);
});

test('power plan + tcp tuning back up and restore', async () => {
  const fw = fakeWindows(); const engine = new Engine({ tweaks: TWEAKS, runner: fw.runner, backup: new MemoryBackup() });
  await engine.apply('power_plan_high'); assert.equal(fw.scheme(), 'e9a42b02-d5df-448d-aa00-03f14749eb61');
  await engine.revert('power_plan_high'); assert.equal(fw.scheme(), '381b4222-f694-41f0-9685-ff5bb260df2e');
  await engine.apply('tcp_tuning'); assert.equal(fw.tcp().EcnCapability, 'Disabled');
  await engine.revert('tcp_tuning'); assert.deepEqual(fw.tcp(), { AutoTuningLevelLocal: 'Disabled', EcnCapability: 'Enabled', Timestamps: 'Enabled' });
});

test('applyRecommended / revertAll per category', async () => {
  const fw = fakeWindows(); const engine = new Engine({ tweaks: TWEAKS, runner: fw.runner, backup: new MemoryBackup() });
  const rs = await engine.applyRecommended('fps'); assert.ok(rs.length >= 5); assert.ok(rs.every(r => !r.error && r.applied));
  const st = await engine.state(); assert.ok(st.filter(x => x.category === 'fps' && x.recommended).every(x => x.applied)); assert.ok(st.filter(x => x.category === 'network').every(x => !x.applied));
  const rv = await engine.revertAll('fps'); assert.equal(rv.length, rs.length);
  assert.ok((await engine.state()).every(x => !x.applied));
});

test('ping parses replies on any locale and counts loss', async () => {
  const fw = fakeWindows(); const r = await tools.ping(fw.runner, ['1.1.1.1']);
  assert.deepEqual(r, [{ host: '1.1.1.1', avg: 15, loss: 1 }]);
});
