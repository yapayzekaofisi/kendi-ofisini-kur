// Herkese açık depoda kişisel ya da özel bilgi kalmasın: e-posta, kişisel yol, sunucu adresi,
// başka projelerin ve kişilerin adları. Yeni dosya eklendikçe kendiliğinden taranır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATLA = new Set(['.git', '.superpowers', 'node_modules', 'vendor', 'veri', 'raporlar']);
const METIN = /\.(m?js|cjs|json|md|html|css|txt|ya?ml|gitignore|gitattributes)$|^LICENSE$/i;

function dosyalar(klasor) {
  const sonuc = [];
  for (const g of fs.readdirSync(klasor, { withFileTypes: true })) {
    if (ATLA.has(g.name)) continue;
    const y = path.join(klasor, g.name);
    if (g.isDirectory()) sonuc.push(...dosyalar(y));
    else if (METIN.test(g.name)) sonuc.push(y);
  }
  return sonuc;
}

const GENEL = [
  ['e-posta', /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, m => /noreply@anthropic\.com|users\.noreply\.github\.com/.test(m)],
  ['Windows kullanıcı yolu', /[A-Z]:[\\/]+Users[\\/]+/i],
  ['Linux ev klasörü', /\/home\/(?!kullanici\b)[a-z]/i],
  ['IP adresi', /\b(?:\d{1,3}\.){3}\d{1,3}\b/, m => ['127.0.0.1', '0.0.0.0'].includes(m)],
  ['başka proje adı', /snack|ahşap ?rehber|ahsap ?rehber|balonbot|hafız/i],
  ['kişi adı', /ensar|eyüp|eyup|pyrz|poyraz/i],
  ['sunucu bilgisi', /bluehost|tailnet|\.ts\.net/i],
];
const KOD_ICIN = [['marka adı (kodda olmaz)', /ko[çc] ?deco|kocdeco/i]];

test('depoda kişisel ya da özel bilgi yok', () => {
  const bulunan = [];
  for (const d of dosyalar(KOK)) {
    const goreli = path.relative(KOK, d).replaceAll('\\', '/');
    if (goreli === 'test/gizlilik.test.mjs') continue;
    const metin = fs.readFileSync(d, 'utf8');
    const kurallar = goreli.startsWith('baslangic-ofisi/') ? [...GENEL, ...KOD_ICIN] : GENEL;
    for (const [ad, desen, izin] of kurallar) {
      const g = new RegExp(desen.source, desen.flags.includes('g') ? desen.flags : desen.flags + 'g');
      for (const m of metin.matchAll(g)) {
        if (izin?.(m[0])) continue;
        bulunan.push(`${goreli}: ${ad}: "${m[0]}"`);
      }
    }
  }
  assert.deepEqual(bulunan, []);
});
