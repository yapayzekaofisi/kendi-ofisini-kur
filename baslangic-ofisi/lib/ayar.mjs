// ofis.ayar.json'u okur ve denetler. Hataları Türkçe ve tek tek yazar ki kurulumda ne düzelteceğin belli olsun.
import fs from 'node:fs';

export const GENEL_MUDUR = Object.freeze({ id: 'genel-mudur', ad: 'Genel Müdür', rol: 'Genel Müdür' });
export const EN_COK_CALISAN = 15;
export const MOTORLAR = ['claude', 'codex'];

const TR = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', I: 'i', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/;

// "Ayşe Hanım" -> "ayse-hanim". Klasör adı ve adreslerde güvenle kullanılır.
export function idUret(ad) {
  const sade = String(ad ?? '')
    .replace(/[çğıiöşüÇĞIİÖŞÜ]/g, h => TR[h])
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return sade || 'calisan';
}

const metin = v => (typeof v === 'string' ? v.trim() : '');

export function ayarDenetle(ham) {
  const hatalar = [];
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return { ayar: null, hatalar: ['Ayar bir JSON nesnesi olmalı.'] };

  const ofisAdi = metin(ham.ofisAdi);
  if (!ofisAdi || ofisAdi.length > 40) hatalar.push('ofisAdi boş olamaz (en çok 40 harf).');

  const port = ham.port ?? 4800;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) hatalar.push('port 1024 ile 65535 arasında bir sayı olmalı.');

  const host = metin(ham.host) || '127.0.0.1';
  const model = metin(ham.model) || 'sonnet';
  const codexYolu = metin(ham.codexYolu);
  const claudeYolu = metin(ham.claudeYolu);

  let mesai = null;
  if (ham.mesai != null) {
    const m = ham.mesai;
    if (typeof m === 'object' && SAAT.test(metin(m.baslangic)) && SAAT.test(metin(m.bitis))) mesai = { baslangic: metin(m.baslangic), bitis: metin(m.bitis) };
    else hatalar.push('mesai {"baslangic":"09:00","bitis":"18:00"} biçiminde olmalı ya da null.');
  }

  const liste = Array.isArray(ham.calisanlar) ? ham.calisanlar : [];
  if (!liste.length) hatalar.push('calisanlar listesinde en az 1 çalışan olmalı.');
  if (liste.length > EN_COK_CALISAN) hatalar.push(`calisanlar listesinde en çok ${EN_COK_CALISAN} çalışan olabilir.`);

  const kullanilan = new Set();
  const calisanlar = liste.map((c, i) => {
    const n = i + 1;
    const x = c && typeof c === 'object' ? c : {};
    const ad = metin(x.ad);
    const is = metin(x.is);
    if (!ad) hatalar.push(`${n}. çalışan: ad boş olamaz.`);
    if (!is) hatalar.push(`${n}. çalışan: iş tanımı (is) boş olamaz.`);
    const kok = idUret(metin(x.id) || ad);
    if (kok === GENEL_MUDUR.id) hatalar.push(`${n}. çalışan: "${GENEL_MUDUR.id}" genel müdüre ayrılmış, başka bir ad seç.`);
    let id = kok;
    for (let k = 2; kullanilan.has(id); k++) id = `${kok}-${k}`;
    kullanilan.add(id);
    const motor = metin(x.motor) || 'claude';
    if (!MOTORLAR.includes(motor)) hatalar.push(`${n}. çalışan: motor "claude" ya da "codex" olmalı.`);
    if (motor === 'codex' && !codexYolu) hatalar.push(`${n}. çalışan Codex ile çalışacaksa ayarda codexYolu gerekli.`);
    return { id, ad, rol: metin(x.rol) || ad, is, web: x.web === true, motor, ekip: metin(x.ekip) };
  });

  return {
    ayar: { ofisAdi, patron: metin(ham.patron) || 'Patron', port, host, model, mesai, codexYolu, claudeYolu, calisanlar },
    hatalar,
  };
}

export function ayarOku(dosya) {
  let ham;
  try {
    ham = JSON.parse(fs.readFileSync(dosya, 'utf8'));
  } catch (e) {
    throw new Error(`ofis.ayar.json okunamadı (JSON hatası olabilir): ${e.message}`);
  }
  const { ayar, hatalar } = ayarDenetle(ham);
  if (hatalar.length) throw new Error('ofis.ayar.json hatalı:\n- ' + hatalar.join('\n- '));
  return ayar;
}
