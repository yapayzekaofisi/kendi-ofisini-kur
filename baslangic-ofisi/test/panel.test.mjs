import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sahneCalisanlari, sahneEkipleri } from '../public/panel.js';
import { STATIK } from '../sunucu.mjs';

const burada = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(burada, '..', 'public');
const oku = d => fs.readFileSync(path.join(pub, d), 'utf8');

const durum = (calisanlar, ek = {}) => ({
  ofisAdi: 'Deneme Ofisi',
  calisanlar: [{ id: 'genel-mudur', ad: 'Genel Müdür', rol: 'Genel Müdür' }, ...calisanlar],
  ...ek,
});

test('sahneCalisanlari genel müdürü ve ajanları motor biçimine çevirir', () => {
  const d = durum([
    { id: 'yazar', ad: 'Yazar', rol: 'Metin Yazarı', ekip: 'Pazarlama' },
    { id: 'arastirmaci', ad: 'Araştırmacı', rol: 'Araştırmacı', ekip: '' },
  ]);
  assert.deepEqual(sahneCalisanlari(d), [
    { id: 'genel-mudur', rol: 'Genel Müdür', kisa: 'Genel Müdür', ekip: '' },
    { id: 'yazar', rol: 'Yazar (Metin Yazarı)', kisa: 'Yazar', ekip: 'Pazarlama' },
    { id: 'arastirmaci', rol: 'Araştırmacı', kisa: 'Araştırmacı', ekip: '' },
  ]);
});

test('sahneEkipleri ekip adlarını bir kez listeler, ekip yoksa boş', () => {
  assert.deepEqual(sahneEkipleri(durum([{ id: 'a', ad: 'A', rol: 'A' }, { id: 'b', ad: 'B', rol: 'B', ekip: '' }])), []);
  const d = durum([{ id: 'a', ad: 'A', rol: 'A', ekip: 'Satış' }, { id: 'b', ad: 'B', rol: 'B', ekip: 'Destek' }, { id: 'c', ad: 'C', rol: 'C', ekip: 'Satış' }]);
  assert.deepEqual(sahneEkipleri(d), [{ id: 'Satış', ad: 'Satış' }, { id: 'Destek', ad: 'Destek' }]);
});

test('index.html yalnız sunucunun verdiği dosyaları ister', () => {
  const istenen = new Set();
  const html = oku('index.html');
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) istenen.add(m[1]);
  const harita = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(harita, 'three için importmap var');
  for (const v of Object.values(JSON.parse(harita[1]).imports)) istenen.add(v);
  for (const d of ['panel.js', 'ofis3d.js']) {
    for (const m of oku(d).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g)) istenen.add(m[1]);
  }
  const yerel = [...istenen].filter(y => !y.startsWith('data:') && !y.startsWith('#') && y !== 'three');
  assert.ok(yerel.length >= 5, yerel.join(', '));
  for (const y of yerel) {
    assert.ok(!/^[a-z]+:\/\//i.test(y), `dış adres yok (çevrimdışı çalışır): ${y}`);
    assert.ok(Object.hasOwn(STATIK, y), `sunucu listesinde yok: ${y}`);
    assert.ok(fs.existsSync(path.join(pub, STATIK[y][0])), `dosya yok: ${y}`);
  }
});

// Kişisel ad ve marka taraması depo kökündeki test/gizlilik.test.mjs'te; burada yalnız logonun isteğe bağlı olduğuna bakılır.
test('3D kopyası temiz: logo isteğe bağlı, eski logo dosyası istenmez', () => {
  const motor = oku('ofis3d.js');
  assert.ok(motor.includes('if (!this.ayar.logo)'));
  assert.doesNotMatch(motor, /logo-kc|\.png/i);
});

test('panel metinleri kaçışlı yazar (innerHTML ile kullanıcı metni basmaz)', () => {
  const panel = oku('panel.js');
  for (const m of panel.matchAll(/innerHTML\s*=\s*([^;]+);/g)) {
    assert.ok(!/\$\{(?!esc\()/.test(m[1]), `kaçışsız şablon: ${m[1].slice(0, 80)}`);
  }
});
