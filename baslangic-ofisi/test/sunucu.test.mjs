import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ayarDenetle } from '../lib/ayar.mjs';
import { GorevKutusu } from '../lib/gorevler.mjs';
import { ofisSunucusu } from '../sunucu.mjs';

const burada = path.dirname(fileURLToPath(import.meta.url));
const SAHTE_CLAUDE = path.join(burada, '..', 'test-sahte', 'sahte-claude.mjs');
const SUNUCU = path.join(burada, '..', 'sunucu.mjs');
const gecici = ad => fs.mkdtempSync(path.join(os.tmpdir(), ad));

async function ortamla(degisken, fn) {
  const eski = {};
  for (const [k, v] of Object.entries(degisken)) { eski[k] = process.env[k]; process.env[k] = v; }
  try { return await fn(); } finally {
    for (const k of Object.keys(degisken)) { if (eski[k] === undefined) delete process.env[k]; else process.env[k] = eski[k]; }
  }
}

let kok, kutu, sunucu, u;
before(async () => {
  kok = gecici('ofis-sunucu-');
  const pub = path.join(kok, 'public');
  fs.mkdirSync(path.join(pub, 'vendor'), { recursive: true });
  fs.writeFileSync(path.join(pub, 'index.html'), '<!doctype html><title>ofis</title>');
  fs.writeFileSync(path.join(pub, 'panel.js'), 'export {};');
  const { ayar } = ayarDenetle({ ofisAdi: 'Deneme Ofisi', patron: 'Ali', calisanlar: [{ ad: 'Yazar', is: 'yazar' }] });
  kutu = new GorevKutusu({ kok, ayar, claudeYolu: SAHTE_CLAUDE, veriDosyasi: path.join(kok, 'veri', 'gorevler.json') });
  sunucu = ofisSunucusu({ kok, ayar, kutu, publicKlasoru: pub });
  await new Promise(ok => sunucu.listen(0, '127.0.0.1', ok));
  u = `http://127.0.0.1:${sunucu.address().port}`;
});
after(() => { sunucu.closeAllConnections?.(); sunucu.close(); });

const postJson = (yol, govde, ek = {}) => fetch(u + yol, { method: 'POST', headers: { 'content-type': 'application/json', ...ek }, body: typeof govde === 'string' ? govde : JSON.stringify(govde) });
const sonDurum = id => new Promise(ok => {
  const bak = g => { if (g?.id === id && ['bitti', 'hata', 'durduruldu'].includes(g.durum)) { kutu.off('gorev', bak); ok(g); } };
  kutu.on('gorev', bak);
  bak(kutu.bul(id));
});

// Ham http isteği: fetch Host başlığını değiştirmeye izin vermez.
const hamIstek = (yol, basliklar) => new Promise((ok, red) => {
  const { port } = sunucu.address();
  http.get({ host: '127.0.0.1', port, path: yol, headers: basliklar }, r => { r.resume(); r.on('end', () => ok(r.statusCode)); }).on('error', red);
});

test('GET /api/durum genel müdür + ajanları ve claude durumunu verir', async () => {
  const r = await fetch(u + '/api/durum');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ofisAdi, 'Deneme Ofisi');
  assert.equal(d.patron, 'Ali');
  assert.deepEqual(d.calisanlar.map(c => c.id), ['genel-mudur', 'yazar']);
  assert.equal(d.durumlar.yazar.durum, 'bosta');
  assert.deepEqual(d.claude, { bulundu: true });
  assert.ok(Array.isArray(d.gorevler));
});

test('POST /api/gorev boş metinde 400 ve Türkçe hata', async () => {
  const r = await postJson('/api/gorev', { metin: '  ' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).hata, /boş/);
  const b = await postJson('/api/gorev', '{ bozuk');
  assert.equal(b.status, 400);
  assert.match((await b.json()).hata, /JSON/);
});

test('POST /api/gorev bilinmeyen hedefte 400', async () => {
  const r = await postJson('/api/gorev', { metin: 'x', hedef: 'olmayan' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).hata, /hedef/);
});

test('POST /api/gorev 201 döner, akışta gorev olayı gelir', async () => {
  const durdur = new AbortController();
  const akis = await fetch(u + '/api/akis', { signal: durdur.signal });
  assert.equal(akis.status, 200);
  assert.match(akis.headers.get('content-type'), /text\/event-stream/);
  const okuyucu = akis.body.getReader();
  const cozucu = new TextDecoder();
  await ortamla({ SAHTE_RAPOR: 'Bitti raporu' }, async () => {
    const r = await postJson('/api/gorev', { metin: 'Kısa metin yaz', hedef: 'yazar' });
    assert.equal(r.status, 201);
    const g = await r.json();
    assert.equal(g.durum, 'sirada');
    let metin = '';
    const sinir = Date.now() + 8000;
    while (!/event: gorev\ndata: [^\n]*"durum":"bitti"/.test(metin) && Date.now() < sinir) {
      const { value, done } = await okuyucu.read();
      if (done) break;
      metin += cozucu.decode(value);
    }
    assert.match(metin, /event: gorev\ndata: /);
    assert.match(metin, /event: durum\ndata: /);
    assert.match(metin, /"durum":"bitti"/);
    await sonDurum(g.id);
    const tek = await fetch(`${u}/api/gorev/${g.id}`);
    assert.equal((await tek.json()).durum, 'bitti');
  });
  durdur.abort();
});

test('statik liste dışı ve /../ istekleri 404', async () => {
  for (const y of ['/sunucu.mjs', '/ofis.ayar.json', '/../package.json', '/%2e%2e/package.json', '/veri/gorevler.json', '/public/index.html', '/lib/ayar.mjs', '/api/yok']) {
    assert.equal((await fetch(u + y)).status, 404, y);
  }
  const ana = await fetch(u + '/');
  assert.equal(ana.status, 200);
  assert.match(ana.headers.get('content-type'), /text\/html/);
  assert.match((await fetch(u + '/panel.js')).headers.get('content-type'), /javascript/);
  assert.equal((await fetch(u + '/ofis3d.js')).status, 404, 'listede ama dosya yoksa 404');
});

test('rapor ucu sadece adımın rapor dosyasını verir', async () => {
  const g = await ortamla({ SAHTE_RAPOR: 'Rapor içeriği' }, () => sonDurum(kutu.olustur({ metin: 'Yaz', hedef: 'yazar' }).id));
  const r = await fetch(`${u}/api/gorev/${g.id}/rapor/0`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/plain; charset=utf-8/);
  assert.ok((await r.text()).includes('Rapor içeriği'));
  assert.equal((await fetch(`${u}/api/gorev/${g.id}/rapor/5`)).status, 404);
  assert.equal((await fetch(`${u}/api/gorev/999/rapor/0`)).status, 404);
  assert.equal((await fetch(`${u}/api/gorev/999`)).status, 404);
  const asil = g.adimlar[0].raporDosyasi;
  // Kökün dışında gerçekten var olan bir dosya: kontrol olmasa sunucu onu verirdi.
  const disari = path.join(gecici('ofis-disari-'), 'gizli.txt');
  fs.writeFileSync(disari, 'gizli');
  g.adimlar[0].raporDosyasi = path.relative(kok, disari);
  assert.ok(g.adimlar[0].raporDosyasi.startsWith('..'));
  assert.equal((await fetch(`${u}/api/gorev/${g.id}/rapor/0`)).status, 404, 'kök dışına çıkamaz');
  g.adimlar[0].raporDosyasi = 'veri/gorevler.json';
  assert.equal((await fetch(`${u}/api/gorev/${g.id}/rapor/0`)).status, 404, 'sadece calisanlar/ altı');
  g.adimlar[0].raporDosyasi = asil;
});

test('durdur ucu bitmiş görevde tamam:false, olmayanda 404', async () => {
  const g = kutu.liste().find(x => x.durum === 'bitti');
  const r = await postJson(`/api/gorev/${g.id}/durdur`, {});
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { tamam: false });
  assert.equal((await postJson('/api/gorev/999/durdur', {})).status, 404);
});

test('64 KB üstü gövde 413', async () => {
  const r = await postJson('/api/gorev', { metin: 'x'.repeat(70 * 1024) });
  assert.equal(r.status, 413);
});

test('başka sitelerden gelen istekler reddedilir', async () => {
  const duz = await fetch(u + '/api/gorev', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{"metin":"x","hedef":"yazar"}' });
  assert.equal(duz.status, 415, 'JSON olmayan POST');
  assert.equal((await postJson('/api/gorev', { metin: 'x', hedef: 'yazar' }, { origin: 'http://kotu.example' })).status, 403, 'yabancı Origin');
  assert.equal(await hamIstek('/api/durum', { host: 'kotu.example' }), 403, 'yabancı Host (DNS rebinding)');
  assert.equal(await hamIstek('/api/durum', { host: `localhost:${sunucu.address().port}` }), 200);
  kutu.ayar.izinliAdresler.push('ofis.local');
  assert.equal(await hamIstek('/api/durum', { host: `ofis.local:${sunucu.address().port}` }), 200, 'izinliAdresler');
});

test('port doluyken anlaşılır mesajla çıkar', async () => {
  const tutucu = net.createServer();
  await new Promise(ok => tutucu.listen(0, '127.0.0.1', ok));
  const port = tutucu.address().port;
  const ofisKoku = gecici('ofis-port-');
  fs.writeFileSync(path.join(ofisKoku, 'ofis.ayar.json'), JSON.stringify({ ofisAdi: 'Port Ofisi', calisanlar: [{ ad: 'Yazar', is: 'yazar' }] }));
  try {
    const { kod, stderr } = await new Promise((ok, red) => {
      const c = spawn(process.execPath, [SUNUCU], { env: { ...process.env, OFIS_PORT: String(port), OFIS_KOK: ofisKoku }, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      c.stderr.on('data', p => { stderr += p; });
      const t = setTimeout(() => { c.kill(); red(new Error('sunucu çıkmadı: ' + stderr)); }, 10000);
      c.on('close', kod => { clearTimeout(t); ok({ kod, stderr }); });
    });
    assert.equal(kod, 1);
    assert.match(stderr, new RegExp(`${port} portu dolu`));
  } finally {
    tutucu.close();
  }
});
