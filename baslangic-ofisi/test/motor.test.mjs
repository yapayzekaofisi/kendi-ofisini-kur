import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { temizOrtam, claudeBul, komutCoz, surecBaslat, planArgs, ajanArgs, codexArgs, akisOku, girisIpucu } from '../lib/motor.mjs';

const burada = path.dirname(fileURLToPath(import.meta.url));
const SAHTE_CLAUDE = path.join(burada, '..', 'test-sahte', 'sahte-claude.mjs');
const SAHTE_CODEX = path.join(burada, '..', 'test-sahte', 'sahte-codex.mjs');
const gecici = ad => fs.mkdtempSync(path.join(os.tmpdir(), ad));
const dosya = (yol, icerik = '') => { fs.mkdirSync(path.dirname(yol), { recursive: true }); fs.writeFileSync(yol, icerik); return yol; };

// Sahte süreçlere ayarı process.env üzerinden veriyoruz; çünkü surecBaslat ortamı her zaman temizOrtam() ile kurar.
async function ortamla(degisken, fn) {
  const eski = {};
  for (const [k, v] of Object.entries(degisken)) { eski[k] = process.env[k]; process.env[k] = v; }
  try { return await fn(); } finally {
    for (const k of Object.keys(degisken)) { if (eski[k] === undefined) delete process.env[k]; else process.env[k] = eski[k]; }
  }
}

test('temizOrtam API anahtarını ve iç oturum değişkenlerini siler', () => {
  const e = temizOrtam({ ANTHROPIC_API_KEY: 'x', anthropic_auth_token: 'y', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'z', CLAUDE_CODE_OAUTH_TOKEN: 't', PATH: 'p' });
  assert.deepEqual(Object.keys(e).sort(), ['CLAUDE_CODE_OAUTH_TOKEN', 'PATH']);
  const f = temizOrtam({ ANTHROPIC_BASE_URL: 'u', CLAUDE_PID: '9', CLAUDE_AGENT_SDK_VERSION: '1', CLAUDE_CODE_GIT_BASH_PATH: 'b' });
  assert.deepEqual(Object.keys(f), ['CLAUDE_CODE_GIT_BASH_PATH']);
});

test('claudeBul npm kurulumunda claude.exe yi bulur (win32)', () => {
  const k = gecici('claude-bul-');
  const npm = path.join(k, 'npm');
  dosya(path.join(npm, 'claude.cmd'));
  const exe = dosya(path.join(npm, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'));
  assert.equal(claudeBul({ path: [path.join(k, 'yok'), npm].join(';'), platform: 'win32', ev: k }), exe);
});

test('claudeBul önce ayardaki yolu, sonra PATH i, sonra ~/.local/bin i dener', () => {
  // Gerçek dosyalarla çalıştığı için makinenin kendi platformunu ve yol ayracını kullanır.
  const platform = process.platform;
  const ad = platform === 'win32' ? 'claude.exe' : 'claude';
  const k = gecici('claude-bul-');
  const ayardaki = dosya(path.join(k, 'ozel', ad));
  const pathteki = dosya(path.join(k, 'bin', ad));
  const yereldeki = dosya(path.join(k, '.local', 'bin', ad));
  const yol = [path.join(k, 'yok'), path.join(k, 'bin')].join(path.delimiter);
  assert.equal(claudeBul({ ayarYolu: ayardaki, path: yol, platform, ev: k }), ayardaki);
  assert.equal(claudeBul({ ayarYolu: path.join(k, 'olmayan'), path: yol, platform, ev: k }), pathteki);
  assert.equal(claudeBul({ path: path.join(k, 'yok'), platform, ev: k }), yereldeki);
});

test('claudeBul bulamazsa null', () => {
  const k = gecici('claude-bul-');
  assert.equal(claudeBul({ ayarYolu: path.join(k, 'yok.exe'), path: k, platform: 'win32', ev: k }), null);
  assert.equal(claudeBul({ path: '', platform: 'linux', ev: k }), null);
});

test('komutCoz Windows npm kısayolunu (.cmd) gerçek betiğe çevirir', () => {
  const k = gecici('komut-coz-');
  const js = dosya(path.join(k, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  const kisayol = '@ECHO off\r\nIF EXIST "%dp0%\\node.exe" (\r\n  SET "_prog=%dp0%\\node.exe"\r\n)\r\n"%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n';
  const cmd = dosya(path.join(k, 'codex.cmd'), kisayol);
  assert.equal(komutCoz(cmd, { platform: 'win32' }), js);
  assert.equal(komutCoz('codex', { platform: 'win32', path: k }), js, 'çıplak ad PATH te aranır');
  assert.equal(komutCoz(cmd, { platform: 'linux' }), cmd, 'Windows dışında dokunulmaz');
});

test('ajanArgs Bash vermez, web açıkken WebSearch ve WebFetch ekler', () => {
  const a = ajanArgs({ web: false }, 'K', 'sonnet');
  assert.ok(!a.join(' ').includes('Bash'));
  assert.equal(a[a.indexOf('--tools') + 1], 'Read,Write,Edit,Glob,Grep');
  assert.equal(a[a.indexOf('--append-system-prompt') + 1], 'K');
  assert.equal(a[a.indexOf('--model') + 1], 'sonnet');
  assert.ok(a.includes('--restricted') && a.includes('--strict-mcp-config'));
  const w = ajanArgs({ web: true }, 'K', 'opus');
  assert.ok(w.includes('WebFetch') && w.includes('WebSearch'));
  assert.equal(w[w.indexOf('--model') + 1], 'opus');
});

test('planArgs araçsız, oturumsuz, sistem talimatlı', () => {
  assert.deepEqual(planArgs('S'), ['-p', '--output-format', 'json', '--model', 'sonnet', '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--permission-prompts', 'none', '--system-prompt', 'S']);
  assert.equal(planArgs('S', 'haiku')[4], 'haiku');
});

test('codexArgs klasöre kilitli, son mesajı dosyaya yazar', () => {
  assert.deepEqual(codexArgs('/k', '/k/son.txt'), ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '--cd', '/k', '--json', '--output-last-message', '/k/son.txt', '-']);
});

test('surecBaslat sahte claude u temiz ortamla çalıştırır', async () => {
  const r = await ortamla({ ANTHROPIC_API_KEY: 'gizli', ORTAM_YAZ: '1' }, () => surecBaslat({ komut: SAHTE_CLAUDE, args: planArgs('S'), cwd: burada }).sonuc);
  assert.equal(r.kod, 0, r.stderr);
  assert.ok(r.stdout.includes('ANAHTAR_YOK'), r.stdout);
});

test('surecBaslat girdiyi stdin e verir, args ve cwd yi korur', async () => {
  const k = gecici('surec-');
  const r = await ortamla({ ARGS_YAZ: '1' }, () => surecBaslat({ komut: SAHTE_CLAUDE, args: planArgs('S'), cwd: k, girdi: 'merhaba' }).sonuc);
  const yaz = JSON.parse(JSON.parse(r.stdout.trim().split('\n').pop()).result);
  assert.deepEqual(yaz.args, planArgs('S'));
  assert.equal(fs.realpathSync(yaz.cwd), fs.realpathSync(k));
  assert.equal(yaz.girdi, 'merhaba');
});

test('surecBaslat satırları tek tek verir; akisOku init, araç, metin ve sonucu tanır', async () => {
  const satirlar = [];
  const r = await ortamla({ SAHTE_RAPOR: 'Bitti raporu' }, () => surecBaslat({ komut: SAHTE_CLAUDE, args: ajanArgs({}, 'K', 'sonnet'), cwd: burada, satirGeldi: s => satirlar.push(s) }).sonuc);
  assert.equal(r.kod, 0, r.stderr);
  const okunan = satirlar.map(akisOku);
  assert.deepEqual(okunan.map(o => o.tur), ['basla', 'arac', 'metin', 'sonuc']);
  assert.equal(okunan[1].ad, 'Write');
  assert.equal(okunan[3].metin, 'Bitti raporu');
  assert.equal(okunan[3].hata, false);
  assert.equal(akisOku('json değil').tur, null);
  assert.equal(akisOku('{"type":"user"}').tur, null);
});

test('sahte codex son mesajı dosyaya yazar, anahtarı görmez', async () => {
  const k = gecici('codex-');
  const son = path.join(k, 'son.txt');
  const r = await ortamla({ ANTHROPIC_API_KEY: 'gizli', ORTAM_YAZ: '1', SAHTE_RAPOR: 'codex raporu' }, () => surecBaslat({ komut: SAHTE_CODEX, args: codexArgs(k, son), cwd: k, girdi: 'iş' }).sonuc);
  assert.equal(r.kod, 0, r.stderr);
  const metin = fs.readFileSync(son, 'utf8');
  assert.ok(metin.includes('codex raporu') && metin.includes('ANAHTAR_YOK'), metin);
});

test('durdur süreci öldürür, sonuç döner', async () => {
  const t0 = Date.now();
  const { sonuc, durdur } = await ortamla({ SAHTE_BEKLE: '60' }, async () => surecBaslat({ komut: SAHTE_CLAUDE, args: planArgs('S'), cwd: burada }));
  setTimeout(durdur, 300);
  const r = await sonuc;
  assert.ok(Date.now() - t0 < 5000, 'beş saniyeden kısa');
  assert.equal(r.durduruldu, true);
  assert.notEqual(r.kod, 0);
});

test('zaman aşımında süreç öldürülür', async () => {
  const t0 = Date.now();
  const r = await ortamla({ SAHTE_BEKLE: '60' }, () => surecBaslat({ komut: SAHTE_CLAUDE, args: planArgs('S'), cwd: burada, zamanAsimiMs: 400 }).sonuc);
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(r.zamanAsimi, true);
});

test('olmayan program çökertmez, sonuç hata ile döner', async () => {
  const k = gecici('yok-');
  const r = await surecBaslat({ komut: path.join(k, 'olmayan-program.exe'), args: [], cwd: k }).sonuc;
  assert.notEqual(r.kod, 0);
  assert.match(r.stderr, /başlatılamadı/);
});

test('girisIpucu giriş hatasını tanır', () => {
  assert.match(girisIpucu('Not logged in · Please run /login'), /claude.*giriş/);
  assert.match(girisIpucu('Invalid API key'), /giriş/);
  assert.equal(girisIpucu('dosya bulunamadı'), '');
});
