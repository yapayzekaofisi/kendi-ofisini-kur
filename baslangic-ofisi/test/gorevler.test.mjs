import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ayarDenetle } from '../lib/ayar.mjs';
import { kurallar } from '../lib/kurallar.mjs';
import { GorevKutusu } from '../lib/gorevler.mjs';

const burada = path.dirname(fileURLToPath(import.meta.url));
const SAHTE_CLAUDE = path.join(burada, '..', 'test-sahte', 'sahte-claude.mjs');
const SAHTE_CODEX = path.join(burada, '..', 'test-sahte', 'sahte-codex.mjs');
const gecici = ad => fs.mkdtempSync(path.join(os.tmpdir(), ad));
const BITMIS = ['bitti', 'hata', 'durduruldu'];

async function ortamla(degisken, fn) {
  const eski = {};
  for (const [k, v] of Object.entries(degisken)) { eski[k] = process.env[k]; process.env[k] = v; }
  try { return await fn(); } finally {
    for (const k of Object.keys(degisken)) { if (eski[k] === undefined) delete process.env[k]; else process.env[k] = eski[k]; }
  }
}

function ofis(ek = {}) {
  const kok = gecici('ofis-gorev-');
  const { ayar } = ayarDenetle({
    ofisAdi: 'Deneme Ofisi', patron: 'Ali', codexYolu: SAHTE_CODEX,
    calisanlar: [{ ad: 'Yazar', is: 'metin yazar' }, { ad: 'Araştırmacı', is: 'araştırır', web: true }, { ad: 'Kodcu', is: 'kod yazar', motor: 'codex' }],
  });
  const veriDosyasi = path.join(kok, 'veri', 'gorevler.json');
  fs.mkdirSync(path.dirname(veriDosyasi), { recursive: true });
  const kutu = new GorevKutusu({ kok, ayar, claudeYolu: SAHTE_CLAUDE, codexYolu: SAHTE_CODEX, veriDosyasi, ...ek });
  return { kok, ayar, kutu, veriDosyasi };
}

// Görev bitene (bitti, hata ya da durduruldu) kadar bekler.
const sonDurum = (kutu, id, ms = 10000) => new Promise((ok, red) => {
  const t = setTimeout(() => red(new Error(`görev ${id} ${ms} ms içinde bitmedi: ${kutu.bul(id)?.durum}`)), ms);
  const bak = g => { if (g?.id === id && BITMIS.includes(g.durum)) { clearTimeout(t); kutu.off('gorev', bak); ok(structuredClone(g)); } };
  kutu.on('gorev', bak);
  bak(kutu.bul(id));
});
const durumaGelince = (kutu, id, durum, ms = 10000) => new Promise((ok, red) => {
  const t = setTimeout(() => red(new Error(`görev ${id} ${durum} olmadı`)), ms);
  const bak = g => { if (g?.id === id && g.durum === durum) { clearTimeout(t); kutu.off('gorev', bak); ok(g); } };
  kutu.on('gorev', bak);
  bak(kutu.bul(id));
});
const raporOku = (kok, a) => fs.readFileSync(path.join(kok, a.raporDosyasi), 'utf8');

test('kurallar ofisi, rolü, rapor klasörünü ve yasakları söyler', () => {
  const { ayar } = ofis();
  const k = kurallar(ayar.calisanlar[0], ayar, 'raporlar/2026-11-20-gorev-1');
  for (const p of ['Deneme Ofisi', 'Yazar', 'Ali', 'raporlar/2026-11-20-gorev-1', 'CLAUDE.md', 'YASAK', 'onay gerekiyor']) assert.ok(k.includes(p), p);
});

test('kurallar rapor klasörünün çalışanın kendi klasöründe olduğunu açıkça söyler', () => {
  // Gerçek denemede ajan "raporlar/" klasörünü ortak bir klasör sanıp raporda "taşıyabilirsiniz" yazdı.
  const { ayar } = ofis();
  const k = kurallar(ayar.calisanlar[0], ayar, 'raporlar/2026-11-20-gorev-1');
  assert.ok(k.includes(`calisanlar/${ayar.calisanlar[0].id}/raporlar/2026-11-20-gorev-1`), 'ofis köküne göre tam yol');
  assert.match(k, /ortak bir klasör yok/i);
});

test('otomatik görev: genel müdür planlar, ajan çalışır, rapor yazılır', async () => {
  const { kok, kutu, veriDosyasi } = ofis();
  const son = await ortamla({ SAHTE_PLAN: '{"ozet":"tek adım","adimlar":[{"birim":"yazar","gorev":"Kısa metin yaz"}]}', SAHTE_RAPOR: 'Bitti raporu' }, async () => {
    const g = kutu.olustur({ metin: 'Bir metin yaz' });
    assert.equal(g.durum, 'sirada');
    return sonDurum(kutu, g.id);
  });
  assert.equal(son.durum, 'bitti', son.hata);
  assert.equal(son.plan.ozet, 'tek adım');
  assert.equal(son.adimlar.length, 1);
  assert.equal(son.adimlar[0].durum, 'bitti');
  assert.match(son.adimlar[0].raporDosyasi, /^calisanlar\/yazar\/raporlar\/\d{4}-\d\d-\d\d-gorev-1\/rapor\.md$/);
  assert.ok(raporOku(kok, son.adimlar[0]).includes('Bitti raporu'));
  assert.equal(JSON.parse(fs.readFileSync(veriDosyasi, 'utf8')).gorevler[0].durum, 'bitti');
  assert.equal(kutu.durumlar().yazar.durum, 'bitti');
  assert.equal(kutu.durumlar()['genel-mudur'].durum, 'bosta');
});

test('doğrudan görev genel müdürü atlar', async () => {
  const { kutu } = ofis();
  // Genel müdür çalışsaydı bu bozuk plan görevi hataya düşürürdü.
  const son = await ortamla({ SAHTE_PLAN: 'plan değil', SAHTE_RAPOR: 'tamamdır' }, () => sonDurum(kutu, kutu.olustur({ metin: 'Yaz', hedef: 'yazar' }).id));
  assert.equal(son.durum, 'bitti', son.hata);
  assert.equal(son.plan, undefined);
  assert.deepEqual(son.adimlar.map(a => a.birim), ['yazar']);
});

test('ajan kendi klasöründe, Bash olmadan, anahtarsız çalışır', async () => {
  const { kok, kutu } = ofis();
  const son = await ortamla({ ARGS_YAZ: '1', ORTAM_YAZ: '1', ANTHROPIC_API_KEY: 'gizli' }, () => sonDurum(kutu, kutu.olustur({ metin: 'Yaz', hedef: 'yazar' }).id));
  assert.equal(son.durum, 'bitti', son.hata);
  const rapor = raporOku(kok, son.adimlar[0]);
  const satir = rapor.split('\n').find(s => s.startsWith('{"args"'));
  const { args, cwd, girdi } = JSON.parse(satir);
  assert.equal(fs.realpathSync(cwd), fs.realpathSync(path.join(kok, 'calisanlar', 'yazar')));
  assert.equal(args[args.indexOf('--tools') + 1], 'Read,Write,Edit,Glob,Grep');
  assert.ok(!args.join(' ').includes('Bash'));
  assert.ok(girdi.includes('Yaz'));
  assert.ok(rapor.includes('ANAHTAR_YOK'));
  assert.ok(fs.existsSync(path.join(kok, 'calisanlar', 'yazar', 'CLAUDE.md')), 'kur unutulduysa iş tanımı yazılır');
});

test('çok adımlı planda önceki rapor sonraki adıma geçer', async () => {
  const { kok, kutu } = ofis();
  const plan = { ozet: 'iki adım', adimlar: [{ birim: 'Araştırmacı', gorev: 'Araştır' }, { birim: 'yazar', gorev: 'Yaz' }, { birim: 'olmayan', gorev: 'x' }] };
  const son = await ortamla({ SAHTE_PLAN: JSON.stringify(plan), SAHTE_RAPOR: 'ADIM RAPORU', GIRDI_YAZ: '1' }, () => sonDurum(kutu, kutu.olustur({ metin: 'Araştır ve yaz' }).id));
  assert.equal(son.durum, 'bitti', son.hata);
  assert.deepEqual(son.adimlar.map(a => a.birim), ['arastirmaci', 'yazar'], 'bilinmeyen birim ayıklanır, ad id ye çevrilir');
  assert.match(son.adimlar[1].raporDosyasi, /-gorev-1-2\/rapor\.md$/);
  const ikinci = raporOku(kok, son.adimlar[1]);
  assert.ok(ikinci.includes('Önceki adımın raporu') && ikinci.includes('ADIM RAPORU'), ikinci);
});

test('genel müdür en çok 5 adım planlar', async () => {
  const { kutu } = ofis();
  const plan = { ozet: 'uzun', adimlar: Array.from({ length: 8 }, () => ({ birim: 'yazar', gorev: 'Yaz' })) };
  const son = await ortamla({ SAHTE_PLAN: 'İşte plan:\n```json\n' + JSON.stringify(plan) + '\n```', SAHTE_RAPOR: 'ok' }, () => sonDurum(kutu, kutu.olustur({ metin: 'Çok iş' }).id));
  assert.equal(son.durum, 'bitti', son.hata);
  assert.equal(son.adimlar.length, 5);
});

test('bozuk plan ya da bilinmeyen çalışan: görev hata, neden görünür', async () => {
  const { kutu } = ofis();
  const a = await ortamla({ SAHTE_PLAN: '{"ozet":"kimse yok","adimlar":[{"birim":"olmayan","gorev":"x"}]}' }, () => sonDurum(kutu, kutu.olustur({ metin: 'x' }).id));
  assert.equal(a.durum, 'hata');
  assert.match(a.hata, /uygun çalışan bulamadı: kimse yok/);
  const b = await ortamla({ SAHTE_PLAN: 'plan değil' }, () => sonDurum(kutu, kutu.olustur({ metin: 'y' }).id));
  assert.equal(b.durum, 'hata');
  assert.match(b.hata, /plan okunamadı/);
  assert.equal(kutu.durumlar()['genel-mudur'].durum, 'hata');
});

test('giriş yoksa görev hata ve ipucu', async () => {
  const { kutu } = ofis();
  const son = await ortamla({ SAHTE_HATA: 'giris' }, () => sonDurum(kutu, kutu.olustur({ metin: 'Yaz', hedef: 'yazar' }).id));
  assert.equal(son.durum, 'hata');
  assert.equal(son.adimlar[0].durum, 'hata');
  assert.match(son.adimlar[0].hata, /claude.*giriş/i);
  assert.match(son.hata, /claude.*giriş/i);
  assert.equal(kutu.durumlar().yazar.durum, 'hata');
});

test('claude bulunamazsa görev hata, sunucu çökmez', async () => {
  for (const claudeYolu of [null, path.join(os.tmpdir(), 'olmayan-claude.exe')]) {
    const { kutu } = ofis({ claudeYolu });
    const son = await sonDurum(kutu, kutu.olustur({ metin: 'Yaz', hedef: 'yazar' }).id);
    assert.equal(son.durum, 'hata');
    assert.match(son.hata, /Claude Code bulunamadı/);
  }
});

test('codex motorlu çalışan codex ile çalışır, iş tanımı girdiye eklenir', async () => {
  const { kok, kutu } = ofis();
  const son = await ortamla({ ARGS_YAZ: '1' }, () => sonDurum(kutu, kutu.olustur({ metin: 'Bir betik yaz', hedef: 'kodcu' }).id));
  assert.equal(son.durum, 'bitti', son.hata);
  const satir = raporOku(kok, son.adimlar[0]).split('\n').find(s => s.startsWith('{"args"'));
  const { args, girdi } = JSON.parse(satir);
  assert.equal(args[0], 'exec');
  assert.ok(girdi.includes('Kodcu: iş tanımı') && girdi.includes('YASAK') && girdi.includes('Bir betik yaz'), girdi);
});

test('görevler sırayla yürür, aynı anda tek süreç', async () => {
  const { kutu } = ofis();
  await ortamla({ SAHTE_RAPOR: 'ok', SAHTE_BEKLE: '0.3' }, async () => {
    const g1 = kutu.olustur({ metin: 'bir', hedef: 'yazar' });
    const g2 = kutu.olustur({ metin: 'iki', hedef: 'yazar' });
    await durumaGelince(kutu, g1.id, 'calisiyor');
    assert.equal(kutu.bul(g2.id).durum, 'sirada');
    assert.equal((await sonDurum(kutu, g1.id)).durum, 'bitti');
    assert.equal((await sonDurum(kutu, g2.id)).durum, 'bitti');
  });
});

test('yeniden açılışta yarım kalan görev yarida-kaldi olur', () => {
  const { kok, ayar, veriDosyasi } = ofis();
  fs.writeFileSync(veriDosyasi, JSON.stringify({ sonId: 3, gorevler: [
    { id: 3, metin: 'c', hedef: 'yazar', durum: 'sirada', adimlar: [] },
    { id: 2, metin: 'b', hedef: 'yazar', durum: 'bitti', adimlar: [] },
    { id: 1, metin: 'a', hedef: 'yazar', durum: 'calisiyor', adimlar: [{ birim: 'yazar', gorev: 'a', durum: 'calisiyor' }] },
  ] }));
  const kutu = new GorevKutusu({ kok, ayar, claudeYolu: SAHTE_CLAUDE, veriDosyasi });
  assert.equal(kutu.bul(1).durum, 'yarida-kaldi');
  assert.equal(kutu.bul(1).adimlar[0].durum, 'yarida-kaldi');
  assert.equal(kutu.bul(2).durum, 'bitti');
  assert.equal(kutu.bul(3).durum, 'yarida-kaldi');
  assert.deepEqual(kutu.liste().map(g => g.id), [3, 2, 1], 'en yeni önce');
  assert.equal(JSON.parse(fs.readFileSync(veriDosyasi, 'utf8')).gorevler.find(g => g.id === 1).durum, 'yarida-kaldi');
});

test('bozuk veri dosyası açılışı durdurmaz', () => {
  const { kok, ayar, veriDosyasi } = ofis();
  fs.writeFileSync(veriDosyasi, '{ bozuk');
  const kutu = new GorevKutusu({ kok, ayar, claudeYolu: SAHTE_CLAUDE, veriDosyasi });
  assert.deepEqual(kutu.liste(), []);
});

test('durdur çalışan görevi durdurur', async () => {
  const { kutu } = ofis();
  await ortamla({ SAHTE_BEKLE: '60' }, async () => {
    const g = kutu.olustur({ metin: 'uzun iş', hedef: 'yazar' });
    await durumaGelince(kutu, g.id, 'calisiyor');
    const t0 = Date.now();
    assert.equal(kutu.durdur(g.id), true);
    const son = await sonDurum(kutu, g.id);
    assert.equal(son.durum, 'durduruldu');
    assert.ok(Date.now() - t0 < 5000);
  });
  assert.equal(kutu.durdur(999), false);
});

test('sıradaki görev durdurulunca hiç çalışmaz', async () => {
  const { kutu } = ofis();
  await ortamla({ SAHTE_BEKLE: '0.3', SAHTE_RAPOR: 'ok' }, async () => {
    const g1 = kutu.olustur({ metin: 'bir', hedef: 'yazar' });
    const g2 = kutu.olustur({ metin: 'iki', hedef: 'yazar' });
    assert.equal(kutu.durdur(g2.id), true);
    assert.equal(kutu.bul(g2.id).durum, 'durduruldu');
    await sonDurum(kutu, g1.id);
    assert.equal(kutu.bul(g2.id).adimlar.length, 0);
  });
});

test('metin boş ya da hedef bilinmiyorsa olustur hata atar', () => {
  const { kutu } = ofis();
  assert.throws(() => kutu.olustur({ metin: '   ' }), /boş/);
  assert.throws(() => kutu.olustur({ metin: 'x'.repeat(20001) }), /20000/);
  assert.throws(() => kutu.olustur({ metin: 'x', hedef: 'olmayan' }), /hedef/);
  assert.deepEqual(kutu.liste(), []);
});

test('liste en çok 200 görev saklar', async () => {
  const { kok, ayar, veriDosyasi } = ofis();
  const gorevler = Array.from({ length: 205 }, (_, i) => ({ id: 205 - i, metin: 'x', hedef: 'yazar', durum: 'bitti', adimlar: [] }));
  fs.writeFileSync(veriDosyasi, JSON.stringify({ sonId: 205, gorevler }));
  const kutu = new GorevKutusu({ kok, ayar, claudeYolu: SAHTE_CLAUDE, veriDosyasi });
  await ortamla({ SAHTE_RAPOR: 'ok' }, () => sonDurum(kutu, kutu.olustur({ metin: 'yeni', hedef: 'yazar' }).id));
  const liste = kutu.liste();
  assert.equal(liste.length, 200);
  assert.equal(liste[0].id, 206);
});
