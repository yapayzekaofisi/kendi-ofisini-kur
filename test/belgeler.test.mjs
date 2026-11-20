import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ayarDenetle } from '../baslangic-ofisi/lib/ayar.mjs';

const kok = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const oku = d => fs.readFileSync(path.join(kok, d), 'utf8');
const REHBER = ['1-buluta-tasima.md', '2-telefondan-erisim.md', '3-codex-ve-gemini.md', '4-token-ve-limitler.md', '5-guvenlik.md'].map(d => `rehber/${d}`);
const BELGELER = ['README.md', 'KURULUM-TALIMATI.md', ...REHBER];
const HAM_TALIMAT = 'https://raw.githubusercontent.com/yapayzekaofisi/kendi-ofisini-kur/main/KURULUM-TALIMATI.md';

test('her belgedeki göreli bağlantı var olan bir dosyaya gider', () => {
  for (const d of BELGELER) {
    const metin = oku(d);
    for (const m of metin.matchAll(/\]\(([^)\s]+)\)/g)) {
      const hedef = m[1];
      if (/^(https?:|mailto:|#)/.test(hedef)) continue;
      const yol = path.join(kok, path.dirname(d), decodeURI(hedef.split('#')[0]));
      assert.ok(fs.existsSync(yol), `${d}: kırık bağlantı ${hedef}`);
    }
  }
});

test('README rehberin hepsine, talimata ve videoya bağlanır', () => {
  const r = oku('README.md');
  for (const d of REHBER) assert.ok(r.includes(`](${d})`), d);
  assert.ok(r.includes('](KURULUM-TALIMATI.md)'));
  assert.ok(r.includes(HAM_TALIMAT), 'Claude Code a yapıştırılacak kutu ham adresi verir');
  assert.ok(r.includes('youtube.com/@yapayzekaofisi'));
  assert.match(r, /mobilyacı/i);
  assert.match(r, /MIT/);
});

test('talimat izleyiciye seçimin onda olduğunu söyletir', () => {
  const t = oku('KURULUM-TALIMATI.md');
  for (const p of ['1-15', '3D', 'kendin belirlersin', 'git clone https://github.com/yapayzekaofisi/kendi-ofisini-kur', 'npm test', 'npm start', 'http://127.0.0.1:4800']) assert.ok(t.includes(p), p);
  for (const p of [/API anahtar/i, /Bash/, /YASAK/]) assert.match(t, p);
});

test('talimattaki örnek ayar denetimden hatasız geçer', () => {
  const t = oku('KURULUM-TALIMATI.md');
  const blok = [...t.matchAll(/```json\n([\s\S]*?)```/g)].map(m => m[1]).find(b => b.includes('"ofisAdi"'));
  assert.ok(blok, 'talimatta ofis.ayar.json örneği var');
  const { hatalar, ayar } = ayarDenetle(JSON.parse(blok));
  assert.deepEqual(hatalar, []);
  assert.ok(ayar.calisanlar.length >= 2);
});

test('rehber/3 Gemini konusunda dürüst, Codex bağlamayı anlatır', () => {
  const r = oku('rehber/3-codex-ve-gemini.md');
  assert.match(r, /"motor":\s*"codex"/);
  assert.match(r, /codexYolu/);
  assert.match(r, /codex login/);
  assert.match(r, /Gemini/);
  assert.match(r, /otomatik[^.]*(yönlendirmez|göndermez)/i);
});
