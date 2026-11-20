import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { idUret, ayarDenetle, ayarOku, GENEL_MUDUR } from '../lib/ayar.mjs';
import { kur } from '../kur.mjs';

const c = (ad, ek = {}) => ({ ad, rol: ad, is: `${ad} işi`, ...ek });
const ornek = (ek = {}) => ({ ofisAdi: 'Deneme Ofisi', patron: 'Ali', calisanlar: [c('Yazar')], ...ek });

test('idUret Türkçe harfleri sadeleştirir', () => {
  assert.equal(idUret('Ayşe Hanım'), 'ayse-hanim');
  assert.equal(idUret('  Çağrı Öğüt '), 'cagri-ogut');
  assert.equal(idUret('İçerik Üreticisi'), 'icerik-ureticisi');
  assert.equal(idUret('***'), 'calisan');
});

test("aynı id'ye düşen adlar benzersiz olur", () => {
  const { ayar, hatalar } = ayarDenetle(ornek({ calisanlar: [c('Ayşe'), c('Ayse'), c('AYŞE')] }));
  assert.deepEqual(hatalar, []);
  assert.deepEqual(ayar.calisanlar.map(x => x.id), ['ayse', 'ayse-2', 'ayse-3']);
});

test('varsayılanlar doldurulur', () => {
  const { ayar, hatalar } = ayarDenetle(ornek({ calisanlar: [{ ad: 'Araştırmacı', is: 'araştırır' }] }));
  assert.deepEqual(hatalar, []);
  assert.equal(ayar.port, 4800);
  assert.equal(ayar.host, '127.0.0.1');
  assert.equal(ayar.model, 'sonnet');
  assert.equal(ayar.mesai, null);
  assert.deepEqual(ayar.calisanlar[0], { id: 'arastirmaci', ad: 'Araştırmacı', rol: 'Araştırmacı', is: 'araştırır', web: false, motor: 'claude', ekip: '' });
});

test('eksik ve hatalı alanlar tek tek yazılır', () => {
  const { hatalar } = ayarDenetle({ ofisAdi: '', calisanlar: [{ ad: '', is: '' }], port: 80 });
  assert.ok(hatalar.some(h => /ofisAdi/.test(h)), hatalar.join('\n'));
  assert.ok(hatalar.some(h => /1\. çalışan.*ad/.test(h)), hatalar.join('\n'));
  assert.ok(hatalar.some(h => /1\. çalışan.*iş/.test(h)), hatalar.join('\n'));
  assert.ok(hatalar.some(h => /port/.test(h)), hatalar.join('\n'));
});

test('1-15 çalışan sınırı', () => {
  assert.ok(ayarDenetle(ornek({ calisanlar: [] })).hatalar.some(h => /en az 1/.test(h)));
  const on6 = Array.from({ length: 16 }, (_, i) => c(`Ajan ${i + 1}`));
  assert.ok(ayarDenetle(ornek({ calisanlar: on6 })).hatalar.some(h => /en çok 15/.test(h)));
  assert.deepEqual(ayarDenetle(ornek({ calisanlar: on6.slice(0, 15) })).hatalar, []);
});

test("genel-mudur id'si ayrılmıştır", () => {
  const { hatalar } = ayarDenetle(ornek({ calisanlar: [c('Genel Müdür')] }));
  assert.ok(hatalar.some(h => /genel-mudur/.test(h)), hatalar.join('\n'));
  assert.equal(GENEL_MUDUR.id, 'genel-mudur');
});

test('codex motoru codexYolu ister', () => {
  assert.ok(ayarDenetle(ornek({ calisanlar: [c('Kodcu', { motor: 'codex' })] })).hatalar.some(h => /codexYolu/.test(h)));
  assert.deepEqual(ayarDenetle(ornek({ codexYolu: '/bin/codex', calisanlar: [c('Kodcu', { motor: 'codex' })] })).hatalar, []);
  assert.ok(ayarDenetle(ornek({ calisanlar: [c('X', { motor: 'gpt' })] })).hatalar.some(h => /motor/.test(h)));
});

test('mesai biçimi HH:MM ya da null', () => {
  assert.ok(ayarDenetle(ornek({ mesai: { baslangic: '9', bitis: '18:00' } })).hatalar.some(h => /mesai/.test(h)));
  assert.deepEqual(ayarDenetle(ornek({ mesai: { baslangic: '09:00', bitis: '18:00' } })).ayar.mesai, { baslangic: '09:00', bitis: '18:00' });
});

test('ayarOku hataları listeleyen bir Error atar', () => {
  const k = fs.mkdtempSync(path.join(os.tmpdir(), 'ofis-ayar-'));
  const d = path.join(k, 'ofis.ayar.json');
  fs.writeFileSync(d, JSON.stringify({ ofisAdi: '', calisanlar: [] }));
  assert.throws(() => ayarOku(d), /ofisAdi[\s\S]*en az 1/);
  fs.writeFileSync(d, '{ bozuk');
  assert.throws(() => ayarOku(d), /JSON/);
});

test('kur klasörleri ve CLAUDE.md üretir, var olanı ezmez', () => {
  const k = fs.mkdtempSync(path.join(os.tmpdir(), 'ofis-kur-'));
  fs.writeFileSync(path.join(k, 'ofis.ayar.json'), JSON.stringify(ornek({ calisanlar: [c('Yazar', { rol: 'Metin Yazarı', is: 'Kısa tanıtım metinleri yazar' })] })));
  const ilk = kur(k);
  const md = path.join(k, 'calisanlar', 'yazar', 'CLAUDE.md');
  assert.ok(fs.existsSync(md));
  const metin = fs.readFileSync(md, 'utf8');
  for (const p of ['Yazar', 'Metin Yazarı', 'Kısa tanıtım metinleri yazar', 'YASAK']) assert.ok(metin.includes(p), p);
  assert.deepEqual(ilk.olusan, ['yazar']);
  assert.ok(fs.existsSync(path.join(k, 'veri')));
  fs.writeFileSync(md, metin + '\nELLE EKLENDİ\n');
  const ikinci = kur(k);
  assert.deepEqual(ikinci.korunan, ['yazar']);
  assert.ok(fs.readFileSync(md, 'utf8').includes('ELLE EKLENDİ'));
});
