// Yapay zeka ofisi: 3D ofis görünümü. Sadece görünüm, hiç token harcamaz.
// Çalışanlar ofis.ayar.json'dan gelir; ekip eklenince odalar kendiliğinden çoğalır.
// Odalar ekrana en büyük sığacak şekilde sıralara dizilir, kamera ofisi kendisi sığdırır.
import * as THREE from 'three';
import { OrbitControls } from '/vendor/OrbitControls.js';
import { mesaideMi, nobetciMi, mesgulMu, olmasiGerekenYer, yatakhaneSecenekleri } from '/ofis-mesai.js';

const POD_G = 3.0, POD_D = 3.1, PAD = 0.5, KORIDOR = 1.4, KENAR = 1.1, DINLENME_G = 4.4;
const DUVAR_Y = 2.8, CAM_Y = 1.1; // alçak cam bölme: arkadaki odayı kapatmaz
const KOLON_G = 0.34, KOLON_D = 0.2; // duvar kolonu: genişlik ve duvardan çıkıntı
// Modern gri ofis: AGT gri lambiri tonları (Açık Gri, Soft Yeni Gri, Yeni Gri, Çöl Gri, Derin Gri).
// Sıcaklığı şampanya altını tabela ve LED ışık verir.
const AGT = {
  acikGri: ['#cfcecb', '#c8c7c3', '#d5d4d0', '#c3c2be', '#d9d8d4', '#cbcac6'], acikDerz: '#8e8d89', // duvar lambirisi
  derinGri: ['#4e4f52', '#48494c', '#545558', '#444548', '#505154'], derinDerz: '#202123', // kolonlar
  citalar: ['#3d3e41', '#45464a', '#38393c', '#4a4b4f', '#414245'], // tabela duvarının çıtaları
  parke: ['#c4bfb6', '#bdb8ae', '#cac5bc', '#b7b1a7', '#cfcac1', '#c0bbb1'], // gri meşe oda zemini
  colGri: '#b9b1a5', // masa ve mobilya üstleri
  antrasit: '#36373a', // korniş, süpürgelik, duvar başlığı
};
const AZ = 0.42, POLAR = 0.92; // varsayılan bakış: önden, hafif sağdan, yukarıdan
const RENKLER = ['#8a5a2b', '#2f6f9f', '#3d7a46', '#9a4f7a', '#a8730b', '#4f5d9a', '#2f8a83'];
const ODA_RENK = ['#b08a4a', '#c8754b', '#4a7fb0', '#5b8c5a', '#7b6bb0', '#2f8a83', '#a35d7a'];
const DURUM_RENK = { calisiyor: '#4da3ff', dusunuyor: '#f2b33d', planlaniyor: '#f2b33d', bitti: '#4cc26a', hata: '#ef5b4c' };
const DURUM_YAZI = { calisiyor: 'Çalışıyor', dusunuyor: 'Düşünüyor', planlaniyor: 'Planlıyor', bitti: 'Bitti', hata: 'Hata', durduruldu: 'Durduruldu', bosta: '' };
const AKTIVITE_GOSTER = new Set(['calisiyor', 'dusunuyor', 'planlaniyor', 'hata']);
const AZ_HAREKET = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TENLER = ['#e9c6a1', '#dcb08a', '#cf9f76', '#e4bc95', '#d6a67c'];
const SACLAR = ['#2b1e17', '#3a2a20', '#1e1b1a', '#4a3527', '#2f2620'];
const PANTOLONLAR = ['#2f3542', '#3b3f4a', '#4b4338', '#283244'];
// Duruşlar: kalça yüksekliği (py), gövde eğimi, kalça/diz/omuz/dirsek açıları ve baş (radyan).
const POZ_OTUR = { py: 0.6, egil: 0.05, kL: -1.35, kR: -1.35, dL: 1.35, dR: 1.35, oLx: -0.45, oLz: 0.1, oRx: -0.45, oRz: -0.1, eL: -1.2, eR: -1.2, bx: 0, by: 0, bz: 0 };
const POZ_AYAKTA = { py: 0.9, egil: 0, kL: 0, kR: 0, dL: 0.03, dR: 0.03, oLx: 0.05, oLz: -0.07, oRx: 0.05, oRz: 0.07, eL: -0.15, eR: -0.15, bx: 0, by: 0, bz: 0 };
const POZ_UZAN = { ...POZ_AYAKTA, egil: 0.08, oRx: -1.2, oRz: -0.04, eR: -0.3, bx: 0.15 };
const YURUME_HIZI = 1.3, ADIM_DONGU = 1.2; // metre/saniye; bir tam adım döngüsü (iki adım), metre
const POZ_EGIL = { ...POZ_AYAKTA, py: 0.82, egil: 0.5, kL: -0.45, kR: -0.45, dL: 0.7, dR: 0.7, oLx: -0.5, eL: -0.3, oRx: -1.0, eR: -0.2, bx: 0.1 };
const POZ_KANEPE = { ...POZ_OTUR, py: 0.53, egil: -0.1, oLx: -0.35, oLz: 0.12, eL: -1.0, oRx: -0.45, oRz: -0.12, eR: -1.5 };
const POZ_FINCAN = { ...POZ_AYAKTA, oRx: -0.45, oRz: -0.1, eR: -1.35 };
const POZ_YUDUM = { oRx: -0.7, oRz: -0.32, eR: -2.3, bx: -0.12 };
const ARSIV_G = 3.6, ARSIV_Y = 2.1, KAPI_G = 0.95; // dosya-evrak odası: genişlik, cam duvar yüksekliği, kapı genişliği
const MOLA_ARALIK = [150, 420]; // boştaki çalışanın kahve molasına çıkma aralığı, saniye
const DUYGU_DURUM = { calisiyor: '💻', dusunuyor: '🤔', planlaniyor: '📝', bitti: '✅', hata: '😓' };
const KLASOR_RENK = ['#2b2c2f', '#2b2c2f', '#545556', '#cbaf8b', '#e6e1d8', '#1f2a36', '#6b4a31', '#8d8e91'];
// Yatakhane (yan bina): herkesin kendi odası. Mesai bitince işi olmayan gelip uyur, sabah ofise döner.
// ara: iki bina arasındaki bahçe; oda eni (z) ve boyu (x); koridor, giriş holü, alçak oda bölmesi.
const YAT = { ara: 2.6, odaEn: 2.3, odaBoy: 2.6, koridor: 1.2, hol: 1.4, bolmeY: 1.0 };
const YATIS_Y = 0.57; // yatan kişinin yerden yüksekliği: şilte üstü ve sırt kalınlığı
const POZ_YAT = { ...POZ_AYAKTA, dL: 0.06, dR: 0.06, oLx: 0.04, oLz: -0.12, oRx: 0.04, oRz: 0.12, eL: -0.25, eR: -0.25, bx: 0.3 };
const POZ_FENER = { ...POZ_AYAKTA, oRx: -0.5, eR: -1.1 }; // güvenlik feneri önüne tutar
const DEVRIYE_ARALIK = [240, 540]; // güvenliğin mesai dışı devriye aralığı, saniye
const yumusak = f => { const x = Math.min(1, Math.max(0, f)); return x * x * (3 - 2 * x); };
const karisim = (a, b, f) => { const p = {}; for (const k in a) p[k] = a[k] + (b[k] - a[k]) * f; return p; };

const malzeme = (renk, ek = {}) => new THREE.MeshStandardMaterial({ color: renk, roughness: 0.8, metalness: 0, ...ek });
function kutu(g, y, d, m, golge = true) {
  const k = new THREE.Mesh(new THREE.BoxGeometry(g, y, d), m);
  k.castShadow = golge;
  k.receiveShadow = true;
  return k;
}
function silindir(r1, r2, y, m, seg = 20) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, y, seg), m);
  s.castShadow = true;
  s.receiveShadow = true;
  return s;
}

// Gri meşe parke (AGT Yeni Gri tonu): oda zeminleri. Tuvalde çizilir, dışarıdan resim gerekmez.
function parkeDokusu() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const tonlar = AGT.parke;
  const sh = 64;
  for (let r = 0; r < 8; r++) {
    const kay = (r % 2) * 128;
    for (let s = -1; s < 3; s++) {
      const xx = s * 256 + kay;
      x.fillStyle = tonlar[(r * 3 + s + 7) % tonlar.length];
      x.fillRect(xx, r * sh, 256, sh);
      x.strokeStyle = 'rgba(60,58,55,.08)';
      x.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) {
        const yy = r * sh + 8 + k * 11 + Math.sin(s * 2 + k + r) * 3;
        x.beginPath();
        x.moveTo(xx, yy);
        x.bezierCurveTo(xx + 80, yy + 4, xx + 170, yy - 4, xx + 256, yy);
        x.stroke();
      }
      x.strokeStyle = 'rgba(50,48,45,.18)';
      x.lineWidth = 2;
      x.strokeRect(xx + 1, r * sh + 1, 254, sh - 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Açık gri mikro beton: koridor ve bina zemini.
function betonDokusu() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#e6e2dc';
  x.fillRect(0, 0, 512, 512);
  let tohum = 7;
  const rast = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
  for (let i = 0; i < 46; i++) {
    const px = rast() * 512, py = rast() * 512, r = 50 + rast() * 130;
    const ton = rast() < 0.5 ? '255,255,255' : '125,115,105';
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
      const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
      g.addColorStop(0, `rgba(${ton},.06)`);
      g.addColorStop(1, `rgba(${ton},0)`);
      x.fillStyle = g;
      x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
    }
  }
  const veri = x.getImageData(0, 0, 512, 512);
  for (let i = 0; i < veri.data.length; i += 4) {
    const n = (rast() - 0.5) * 9;
    veri.data[i] += n; veri.data[i + 1] += n; veri.data[i + 2] += n;
  }
  x.putImageData(veri, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Dikey çıtalı ahşap lambiri: çıtalar, aralarında koyu derz, ince damar. Kabartma (bump) dokusu çıtaları öne çıkarır.
// Bir doku 8 çıta, 0,8 metre genişlik.
const LAMBIRI_ADIM = 0.8;
function lambiriDokusu(tonlar, derz, tohum = 11) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const k = document.createElement('canvas');
  k.width = 512;
  k.height = 4;
  const kx = k.getContext('2d');
  const rast = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
  const n = 8, w = 512 / n, d = Math.round(w * 0.14);
  x.fillStyle = derz;
  x.fillRect(0, 0, 512, 512);
  kx.fillStyle = '#000';
  kx.fillRect(0, 0, 512, 4);
  for (let i = 0; i < n; i++) {
    const x0 = i * w + d / 2, gen = w - d;
    x.fillStyle = tonlar[i % tonlar.length];
    x.fillRect(x0, 0, gen, 512);
    x.lineWidth = 1.2;
    for (let j = 0; j < 7; j++) {
      const px = x0 + 3 + rast() * (gen - 6), dalga = 1 + rast() * 2.5, faz = rast() * 6;
      x.strokeStyle = `rgba(30,30,30,${(0.04 + rast() * 0.08).toFixed(3)})`;
      x.beginPath();
      for (let yy = 0; yy <= 512; yy += 16) {
        const xx = px + Math.sin(yy / 70 + faz) * dalga;
        if (yy) x.lineTo(xx, yy); else x.moveTo(xx, yy);
      }
      x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.12)';
    x.fillRect(x0, 0, 2, 512);
    x.fillStyle = 'rgba(0,0,0,.22)';
    x.fillRect(x0 + gen - 2, 0, 2, 512);
    const g = kx.createLinearGradient(x0, 0, x0 + gen, 0);
    g.addColorStop(0, '#8c8c8c');
    g.addColorStop(0.18, '#ffffff');
    g.addColorStop(0.82, '#ffffff');
    g.addColorStop(1, '#8c8c8c');
    kx.fillStyle = g;
    kx.fillRect(x0, 0, gen, 4);
  }
  const yap = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const renk = yap(c);
  renk.colorSpace = THREE.SRGBColorSpace;
  return { renk, kabartma: yap(k) };
}

// LED parıltıları için yumuşak geçişli dokular: "yikama" yukarıdan aşağı söner, "serit" ortadan yanlara, "hale" merkezden dışa.
// Kabin camı dokusu: bir cam modülü (yaklaşık 1,1 m genişlik, cam yüksekliği kadar boy).
// Hafif yeşilimsi berrak cam, kenarlarda cam kalınlığı, iki çapraz parlama, ortada kumlama
// (buzlu) bant ve bandın altında ince şampanya altını çizgi.
const CAM_MODUL = 1.1;
function camDokusu() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(214,232,236,.1)';
  x.fillRect(0, 0, 256, 256);
  const kenar = x.createLinearGradient(0, 0, 256, 0);
  kenar.addColorStop(0, 'rgba(140,186,180,.32)');
  kenar.addColorStop(0.05, 'rgba(140,186,180,0)');
  kenar.addColorStop(0.95, 'rgba(140,186,180,0)');
  kenar.addColorStop(1, 'rgba(140,186,180,.32)');
  x.fillStyle = kenar;
  x.fillRect(0, 0, 256, 256);
  x.save();
  x.beginPath();
  x.rect(0, 0, 256, 256);
  x.clip();
  x.translate(128, 128);
  x.rotate(-0.6);
  for (const [ox, gen, a] of [[-58, 46, 0.24], [-16, 14, 0.18], [70, 26, 0.12]]) {
    const g = x.createLinearGradient(ox - gen / 2, 0, ox + gen / 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(ox - gen / 2, -240, gen, 480);
  }
  x.restore();
  // Buzlu bant: yerden 0,56-0,84 m arası.
  const ust = Math.round(256 * (1 - 0.84 / CAM_Y)), alt = Math.round(256 * (1 - 0.56 / CAM_Y));
  x.fillStyle = 'rgba(236,239,240,.6)';
  x.fillRect(0, ust, 256, alt - ust);
  let tohum = 31;
  const rast = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = `rgba(255,255,255,${(0.1 + rast() * 0.25).toFixed(3)})`;
    x.fillRect(rast() * 256, ust + rast() * (alt - ust), 1, 1);
  }
  x.fillStyle = 'rgba(255,255,255,.75)';
  x.fillRect(0, ust, 256, 2);
  x.fillRect(0, alt - 2, 256, 2);
  x.fillStyle = 'rgba(203,175,139,1)';
  x.fillRect(0, alt + 7, 256, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Kapı levhası: antrasit zemin, şampanya altını harfler.
function levhaDokusu(yazi, gen = 512) {
  const c = document.createElement('canvas');
  c.width = gen;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#1c1c1e';
  x.fillRect(0, 0, gen, 128);
  x.strokeStyle = 'rgba(203,175,139,.55)';
  x.lineWidth = 3;
  x.strokeRect(10, 10, gen - 20, 108);
  x.fillStyle = '#cbaf8b';
  x.font = '600 62px "Cormorant Garamond", "Palatino Linotype", Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let kay = 0;
  if ('letterSpacing' in x) { x.letterSpacing = '14px'; kay = 7; }
  x.fillText(yazi, gen / 2 + kay, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Bahçe çimi: koyu ve açık yeşil kısa çizgiler.
function cimDokusu() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#7b8a66';
  x.fillRect(0, 0, 256, 256);
  let tohum = 3;
  const rast = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = rast() < 0.5 ? 'rgba(58,76,46,.35)' : 'rgba(164,180,130,.3)';
    x.fillRect(rast() * 256, rast() * 256, 1.5, 3 + rast() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Bahçe yolu: açık gri taş plakalar, koyu derz. Bir doku 1 x 1 metre.
function tasDokusu() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#8f8d88';
  x.fillRect(0, 0, 256, 256);
  const tonlar = ['#d8d5cf', '#d0cdc7', '#dcd9d3', '#cbc8c1'];
  for (let r = 0; r < 4; r++) {
    for (let s = -1; s < 3; s++) {
      x.fillStyle = tonlar[(r * 3 + s + 4) % 4];
      x.fillRect(s * 128 + (r % 2) * 64 + 3, r * 64 + 3, 122, 58);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function isikDokusu(tur) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  let g;
  if (tur === 'hale') {
    c.width = c.height = 128;
    g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  } else if (tur === 'serit') {
    c.width = 128;
    c.height = 4;
    g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    c.width = 4;
    c.height = 128;
    g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  }
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// LED kanal harf tabela yazısı (logodaki gibi serif). hale=true: arkadan aydınlatmanın duvara vuran bulanık ışığı.
// Döndürür: doku ve yazının tuval genişliğine oranı (logo harflerin hemen yanına konur).
const TABELA_G = 2048, TABELA_Y = 768, TABELA_ANA = 300, TABELA_ALT = 590;
function tabelaYazisi(ana, alt, hale) {
  const c = document.createElement('canvas');
  c.width = TABELA_G;
  c.height = TABELA_Y;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#ffffff';
  const yaz = (metin, y, boyut, aralik, agirlik) => {
    const font = () => `${agirlik} ${boyut}px "Cormorant Garamond", "Palatino Linotype", "Book Antiqua", Georgia, "Noto Serif", serif`;
    x.font = font();
    if ('letterSpacing' in x) x.letterSpacing = `${aralik}px`;
    while (x.measureText(metin).width > TABELA_G * 0.86 && boyut > 60) { boyut -= 8; x.font = font(); }
    const gen = x.measureText(metin).width;
    x.fillText(metin, TABELA_G / 2 + aralik / 2, y);
    return gen;
  };
  const ciz = () => {
    const anaG = yaz(ana, TABELA_ANA, 330, 34, 600);
    let altG = 0;
    if (alt) {
      altG = yaz(alt, TABELA_ALT, 104, 56, 600);
      const cizgi = Math.min(260, (anaG - altG) / 2 - 50);
      if (cizgi > 40) {
        x.fillRect(TABELA_G / 2 - altG / 2 - 50 - cizgi, TABELA_ALT - 3, cizgi, 6);
        x.fillRect(TABELA_G / 2 + altG / 2 + 50, TABELA_ALT - 3, cizgi, 6);
      }
    }
    return Math.max(anaG, altG);
  };
  let gen;
  if (hale) {
    x.shadowColor = '#ffffff';
    for (const b of [110, 55]) { x.shadowBlur = b; gen = ciz(); }
  } else {
    gen = ciz();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { doku: t, oran: gen / TABELA_G };
}

export class OfisSahnesi {
  constructor(kap, ayar) {
    this.kap = kap;
    this.ayar = ayar;
    this.calisanlar = ayar.calisanlar;
    this.ekipler = ayar.ekipler || [];
    this.masalar = new Map();
    this.odaEtiketleri = [];
    this.tiklanabilir = [];
    this.zarflar = [];
    this.acilirlar = []; // açılıp kapanan kapaklar, çekmeceler ve kapılar (_mekanizmalar)
    this.acilirKok = []; // tıklanınca açılıp kapananlar
    this.kapilar = []; // yaklaşınca kendiliğinden açılan kayar kapılar
    this.dosya = 0; // arşivdeki dosya sayısı (raflarda birikir)
    this.arsivYolda = 0; // arşive götürülmekte olan dosyalar
    this.odalar = []; // yatakhane odaları; sakini olan odada m bağlıdır
    this.yatakhane = null;
    this._dk = this._dakika(); // günün dakikası: mesai ve yatakhane kararları
    this._q = new THREE.Quaternion();
    this.gorulen = new Set();
    this.duraklat = false;
    this.saat = new THREE.Clock();
    this._sonGun = -1;
    this._v = new THREE.Vector3();
    this._fark = new THREE.Vector3();

    this.mese = malzeme(AGT.colGri, { roughness: 0.55 });
    this.ceviz = malzeme(AGT.antrasit, { roughness: 0.5 });
    this.siyah = malzeme('#1e1f22', { roughness: 0.45, metalness: 0.35 });
    this.beyaz = malzeme('#f3f1ed', { roughness: 0.6 });
    this.metal = malzeme('#2c2d31', { roughness: 0.35, metalness: 0.6 });
    this.aluM = malzeme('#313236', { roughness: 0.3, metalness: 0.65 });
    this._kulpM = malzeme('#cbaf8b', { metalness: 0.75, roughness: 0.3 });
    this.camM = new THREE.MeshStandardMaterial({ map: camDokusu(), transparent: true, roughness: 0.12, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    this.pencereM = new THREE.MeshStandardMaterial({ color: '#cfe7f5', emissive: '#bfe3fa', emissiveIntensity: 0.7, roughness: 0.2 });
    this.ledler = []; // gündüz ve akşam parlaklığı ayrı olan LED malzemeleri ve ışıkları (_ledAyarla)

    this._kur();
    this._yerlesim();
    this._isiklar();
    this._etiketKatmani();
    this._kameraSifirla();
    this._gunIsigi();
    this._dongu = this._dongu.bind(this);
    this._raf = requestAnimationFrame(this._dongu);
  }

  // ---------- Kurulum ----------

  _kur() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.domElement.setAttribute('aria-hidden', 'true');
    this.kap.appendChild(r.domElement);

    this.sahne = new THREE.Scene();
    this.dunya = new THREE.Group();
    this.sahne.add(this.dunya);
    // İzometrik görünüm: uzaktaki masalar küçülmez, ofisin tamamı düzenli görünür.
    this.kamera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 400);
    this.kontrol = new OrbitControls(this.kamera, r.domElement);
    Object.assign(this.kontrol, {
      enableDamping: true, dampingFactor: 0.08, screenSpacePanning: true,
      minPolarAngle: 0.5, maxPolarAngle: 1.18,
      minAzimuthAngle: AZ - 0.55, maxAzimuthAngle: AZ + 0.75,
      minZoom: 0.8, maxZoom: 4, rotateSpeed: 0.55, zoomSpeed: 0.9, panSpeed: 0.8,
    });

    this._boyut();
    this._ro = new ResizeObserver(() => this._boyut());
    this._ro.observe(this.kap);

    this.isin = new THREE.Raycaster();
    this.fare = new THREE.Vector2();
    const el = r.domElement;
    el.addEventListener('pointerdown', e => { this._basla = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', e => {
      if (!this._basla) return;
      const [x0, y0] = this._basla;
      this._basla = null;
      if (Math.hypot(e.clientX - x0, e.clientY - y0) > 5) return;
      const v = this._isabet(e);
      if (v?.acilir) { v.acilir.hedef = v.acilir.hedef > 0.5 ? 0 : 1; return; }
      if (v?.id) this.ayar.secildi?.(v.id);
    });
    el.addEventListener('pointermove', e => {
      if (e.buttons) return;
      el.style.cursor = this._isabet(e) ? 'pointer' : 'grab';
    });
    el.addEventListener('dblclick', () => this._kameraSifirla());
  }

  _boyut() {
    const g = this.kap.clientWidth || 1, y = this.kap.clientHeight || 1;
    this.renderer.setSize(g, y, false);
    if (this._kapsam) this._uydur();
  }

  _isabet(e) {
    const b = this.renderer.domElement.getBoundingClientRect();
    this.fare.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    this.isin.setFromCamera(this.fare, this.kamera);
    const vurus = this.isin.intersectObjects([...this.tiklanabilir, ...this.acilirKok], true)[0];
    if (!vurus) return null;
    for (let o = vurus.object; o; o = o.parent) if (o.userData.acilir) return { acilir: o.userData.acilir };
    return vurus.object.userData.id ? { id: vurus.object.userData.id } : null;
  }

  // ---------- Yerleşim ----------

  // Odaları sırayı bozmadan k sıraya böler; en uzun sırayı en kısa tutar.
  _bol(liste, k) {
    const gen = s => s.reduce((t, o) => t + o.g0, 0) + KORIDOR * (s.length - 1);
    let en = null;
    const dene = (bas, kalan, birikim) => {
      if (kalan === 1) {
        const s = [...birikim, liste.slice(bas)];
        const m = Math.max(...s.map(gen));
        if (!en || m < en.m) en = { m, s };
        return;
      }
      for (let i = bas + 1; i <= liste.length - (kalan - 1); i++) dene(i, kalan - 1, [...birikim, liste.slice(bas, i)]);
    };
    dene(0, k, []);
    return en.s;
  }

  _yerlesim() {
    const gm = this.calisanlar[0];
    const isciler = this.calisanlar.slice(1).filter(c => !c.yedek);
    const yedekler = this.calisanlar.filter(c => c.yedek);
    const odalar = [{ ad: 'Yönetim', uyeler: [gm], yonetim: true }];
    if (this.ekipler.length) {
      for (const e of this.ekipler) {
        const u = isciler.filter(c => c.ekip === e.id);
        if (u.length) odalar.push({ ad: e.ad, uyeler: u });
      }
      const digerleri = isciler.filter(c => !this.ekipler.some(e => e.id === c.ekip));
      if (digerleri.length) odalar.push({ ad: 'Diğer', uyeler: digerleri });
    } else if (isciler.length) {
      odalar.push({ ad: 'Ekip', uyeler: isciler });
    }
    // Claude'un kotası dolunca işleri devralan Yedek Eleman (GPT) kendi odasında durur.
    if (yedekler.length) odalar.push({ ad: 'Yedek', uyeler: yedekler });
    odalar.forEach((o, i) => {
      o.renk = ODA_RENK[i % ODA_RENK.length];
      const n = o.uyeler.length;
      o.sutun = o.yonetim ? 1 : Math.min(3, n);
      o.satir = Math.ceil(n / o.sutun);
      o.g0 = Math.max(o.yonetim ? 4.4 : 0, o.sutun * POD_G + PAD * 2);
      o.d0 = o.satir * POD_D + PAD * 2;
    });

    // Kaç sıra olsun? Ekranda insanları en büyük gösteren dizilişi seç. Yan bina (yatakhane) da ekrana sığmalı.
    const sakinler = this.calisanlar.filter(c => !nobetciMi(c));
    const W = this.kap.clientWidth || 1200, H = this.kap.clientHeight || 640;
    const sa = Math.sin(AZ), ca = Math.cos(AZ), sp = Math.sin(POLAR), cp = Math.cos(POLAR);
    const gen = s => s.reduce((t, o) => t + o.g0, 0) + KORIDOR * (s.length - 1);
    let en = null;
    for (let k = 1; k <= Math.min(4, odalar.length); k++) {
      const satirlar = this._bol(odalar, k).map(s => [...s]);
      let kisa = 0;
      satirlar.forEach((s, i) => { if (gen(s) < gen(satirlar[kisa])) kisa = i; });
      satirlar[kisa].push({ dinlenme: true, g0: DINLENME_G, d0: 0 });
      satirlar.forEach((s, i) => { if (gen(s) < gen(satirlar[kisa])) kisa = i; });
      satirlar[kisa].push({ arsiv: true, g0: ARSIV_G, d0: 0 });
      const icG = Math.max(...satirlar.map(gen));
      const derinlik = satirlar.map(s => Math.max(...s.map(o => o.d0)));
      const G = icG + KENAR * 2;
      const D = derinlik.reduce((a, b) => a + b, 0) + KORIDOR * (k - 1) + KENAR * 2;
      const secenek = yatakhaneSecenekleri(sakinler.length);
      for (const yd of secenek.length ? secenek : [{ sutun: 0, sira: 0 }]) {
        const yG = yd.sutun ? yd.sutun * YAT.odaBoy + YAT.koridor : 0;
        const yD = yd.sira * YAT.odaEn + YAT.hol;
        const TG = G + (yG ? YAT.ara + yG : 0), TD = Math.max(D, yG ? yD + 0.9 : 0);
        const ekranG = TG * ca + TD * sa;
        const ekranY = (TG * sa + TD * ca) * cp + DUVAR_Y * sp;
        const olcek = Math.min(W / ekranG, H / ekranY);
        if (!en || olcek > en.olcek * 1.03) en = { olcek, satirlar, icG, derinlik, G, D, yd, yG, yD, TG, TD };
      }
    }

    const { satirlar, icG, derinlik, G, D, yd, yG, yD, TG, TD } = en;
    let z = KENAR;
    satirlar.forEach((s, i) => {
      const fazla = icG - gen(s);
      const toplam = s.reduce((t, o) => t + o.g0, 0);
      let x = KENAR;
      for (const o of s) {
        o.g = o.g0 + fazla * (o.g0 / toplam);
        o.d = derinlik[i];
        o.x = x;
        o.z = z;
        x += o.g + KORIDOR;
      }
      z += derinlik[i] + KORIDOR;
    });
    this._sinir = { minX: 0, maxX: G, minZ: 0, maxZ: D, G, D }; // ofis binası
    this._tum = { minX: 0, maxX: TG, minZ: 0, maxZ: TD, G: TG, D: TD }; // ofis, bahçe ve yatakhane
    this.dunya.position.set(-TG / 2, 0, -TD / 2);
    // Yürüme yolları: her sıranın önündeki koridor ve binanın iki yanındaki geçit; bahçedeki taş yol.
    this._koridorZ = satirlar.map((s, i) => s[0].z + derinlik[i] + (i === satirlar.length - 1 ? KENAR / 2 : KORIDOR / 2));
    this._gecitX = [KENAR / 2, G - KENAR / 2];
    this._avluX = G + YAT.ara / 2;

    this._bina();
    satirlar.forEach((s, si) => {
      for (const o of s) {
        if (o.dinlenme) { this._dinlenme(o, si); continue; }
        if (o.arsiv) { this._arsiv(o, si); continue; }
        this._oda(o);
        const bx = (o.g - o.sutun * POD_G) / 2, bz = (o.d - o.satir * POD_D) / 2;
        o.uyeler.forEach((c, i) => {
          const sut = i % o.sutun, sat = Math.floor(i / o.sutun);
          this._masa(c, RENKLER[this.calisanlar.indexOf(c) % RENKLER.length],
            o.x + bx + sut * POD_G + POD_G / 2, o.z + bz + sat * POD_D + POD_D / 2, !!o.yonetim, si);
        });
      }
    });
    if (yG) {
      this._yatakhane(G + YAT.ara, yd, yG, yD, sakinler);
      this._avlu(G, TG, TD);
    }
  }

  _bina() {
    const { minX, maxX, minZ, maxZ, G, D } = this._sinir;
    const T = 0.16;
    // Maket gibi kalın taban: üstü beton, kenarları koyu.
    const beton = betonDokusu();
    beton.repeat.set((G + T) / 5, (D + T) / 5);
    const ust = malzeme('#ffffff', { map: beton, roughness: 0.85 });
    const yan = malzeme('#2a2724', { roughness: 0.7 });
    const zemin = new THREE.Mesh(new THREE.BoxGeometry(G + T, 0.3, D + T), [yan, yan, ust, yan, yan, yan]);
    zemin.position.set(minX + G / 2 - T / 2, -0.15, minZ + D / 2 - T / 2);
    zemin.receiveShadow = true;
    this.dunya.add(zemin);

    // Arka iki duvar lambiri giydirmeli: açık gri dikey çıtalar, antrasit süpürgelik ve duvar başlığı.
    this._lambiri ||= lambiriDokusu(AGT.acikGri, AGT.acikDerz);
    this._cevizDoku ||= lambiriDokusu(AGT.derinGri, AGT.derinDerz, 23);
    const duvarM = malzeme('#e6e5e2', { roughness: 0.92 });
    const kuzey = kutu(G + T, DUVAR_Y, T, [duvarM, duvarM, duvarM, duvarM, this._lambiriM(this._lambiri, G + T), duvarM]);
    kuzey.position.set(minX + G / 2 - T / 2, DUVAR_Y / 2, minZ - T / 2);
    const bati = kutu(T, DUVAR_Y, D, [this._lambiriM(this._lambiri, D), duvarM, duvarM, duvarM, duvarM, duvarM]);
    bati.position.set(minX - T / 2, DUVAR_Y / 2, minZ + D / 2);
    const s1 = kutu(G, 0.09, 0.022, this.ceviz, false);
    s1.position.set(minX + G / 2, 0.045, minZ + 0.011);
    const s2 = kutu(0.022, 0.09, D, this.ceviz, false);
    s2.position.set(minX + 0.011, 0.045, minZ + D / 2);
    const b1 = kutu(G + T, 0.035, T + 0.02, this.ceviz, false);
    b1.position.set(minX + G / 2 - T / 2, DUVAR_Y + 0.017, minZ - T / 2 + 0.01);
    const b2 = kutu(T + 0.02, 0.035, D, this.ceviz, false);
    b2.position.set(minX - T / 2 + 0.01, DUVAR_Y + 0.017, minZ + D / 2);
    this.dunya.add(kuzey, bati, s1, s2, b1, b2);
    // Duvar üstünde gizli LED: korniş altındaki şerit duvarı yukarıdan yıkar, zemin kenarında da hafif ışık.
    const ki = this._duvarIsigi(G);
    ki.position.set(minX + G / 2, 0, minZ);
    const bi = this._duvarIsigi(D);
    bi.position.set(minX, 0, minZ + D / 2);
    bi.rotation.y = Math.PI / 2;
    this.dunya.add(ki, bi);

    const pencere = (x, z, donuk) => this._pencere(x, z, donuk);
    // Arka duvarın ortası: derin gri çıtalı vurgu duvarında LED'li ofis tabelası. Pencereler ve kolonlar onun dışında.
    const cx = minX + G / 2;
    const tabela = this._ledTabela(G);
    tabela.grup.position.set(cx, 0, minZ);
    this.dunya.add(tabela.grup);
    const yari = tabela.gen / 2;
    const kSay = Math.max(2, Math.floor(G / 3.2));
    for (let i = 0; i < kSay; i++) {
      const x = minX + (G / kSay) * (i + 0.5);
      if (Math.abs(x - cx) < yari + 1.25) continue;
      pencere(x, minZ + 0.01, false);
    }
    const bSay = Math.max(1, Math.floor(D / 3.4));
    for (let i = 0; i < bSay; i++) pencere(minX + 0.01, minZ + (D / bSay) * (i + 0.5), true);

    // Derin gri lambirili kolonlar: köşede, vurgu duvarının iki yanında, pencere aralarında ve duvar uçlarında.
    const kolonKoy = (x, z, bati, led = true) => {
      const k = this._kolon(led);
      k.position.set(x, 0, z);
      if (bati) k.rotation.y = Math.PI / 2;
      this.dunya.add(k);
    };
    kolonKoy(minX + KOLON_G / 2, minZ, false, false);
    kolonKoy(minX, minZ + KOLON_G / 2, true, false);
    const kenar = yari + KOLON_G / 2;
    const kuzeyX = [cx - kenar, cx + kenar, maxX - KOLON_G / 2];
    for (let i = 1; i < kSay; i++) {
      const x = minX + (G / kSay) * i;
      if (Math.abs(x - cx) > kenar + 0.6) kuzeyX.push(x);
    }
    for (const x of kuzeyX) kolonKoy(x, minZ, false);
    for (let j = 1; j < bSay; j++) kolonKoy(minX, minZ + (D / bSay) * j, true);
    kolonKoy(minX, maxZ - KOLON_G / 2, true);
  }

  // Pencere: ince siyah kasa, ortada kayıt. donuk=true: yan duvara (batı) döner.
  _pencere(x, z, donuk, gen = 1.6, boy = 1.9, y = 1.4) {
    const g = new THREE.Group();
    const f = 0.045;
    const cam = new THREE.Mesh(new THREE.PlaneGeometry(gen, boy), this.pencereM);
    const ust = kutu(gen + f * 2, f, 0.05, this.siyah, false); ust.position.y = boy / 2 + f / 2;
    const alt = ust.clone(); alt.position.y = -boy / 2 - f / 2;
    const sol = kutu(f, boy + f * 2, 0.05, this.siyah, false); sol.position.x = -gen / 2 - f / 2;
    const sag = sol.clone(); sag.position.x = gen / 2 + f / 2;
    const orta = kutu(0.025, boy, 0.035, this.siyah, false);
    g.add(cam, ust, alt, sol, sag, orta);
    g.position.set(x, y, z);
    if (donuk) g.rotation.y = Math.PI / 2;
    this.dunya.add(g);
  }

  // Lambiri malzemesi: doku uzunluğa göre tekrarlanır, çıtalar her duvarda aynı genişlikte kalır.
  _lambiriM(doku, uzunluk) {
    const r = doku.renk.clone();
    r.repeat.set(uzunluk / LAMBIRI_ADIM, 1);
    r.needsUpdate = true;
    const k = doku.kabartma.clone();
    k.repeat.set(uzunluk / LAMBIRI_ADIM, 1);
    k.needsUpdate = true;
    return malzeme('#ffffff', { map: r, bumpMap: k, bumpScale: 3, roughness: 0.62 });
  }

  // LED malzemeleri: gündüz hafif, akşam (19:00-07:00) tam parlak yanar.
  _ledM(gunduz = 0.9, gece = 2.6) {
    const m = malzeme('#fff4e6', { emissive: '#ffd9a8', emissiveIntensity: gunduz, roughness: 0.4 });
    this.ledler.push({ tur: 'isik', m, gunduz, gece });
    return m;
  }

  _parilti(doku, renk, gunduz, gece) {
    const m = new THREE.MeshBasicMaterial({ map: doku, color: renk, transparent: true, opacity: gunduz, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.ledler.push({ tur: 'opak', m, gunduz, gece });
    return m;
  }

  _ledAyarla(aksam) {
    for (const p of this.ledler) {
      const v = aksam ? p.gece : p.gunduz;
      if (p.tur === 'opak') p.m.opacity = v;
      else if (p.tur === 'isik') p.m.emissiveIntensity = v;
      else if (p.tur === 'lamba') p.m.intensity = v;
      else if (p.tur === 'renk') p.m.color.copy(p.renk).multiplyScalar(v);
    }
  }

  // Duvar boyunca (yerel x) antrasit korniş, altında gizli LED şerit; ışık duvarı yukarıdan aşağı yıkar,
  // zeminde duvar dibinde hafif bir şerit bırakır. Yerel z=0 duvar yüzü, +z oda tarafı.
  _duvarIsigi(uz) {
    const g = new THREE.Group();
    const korniz = kutu(uz, 0.07, 0.1, this.ceviz, false);
    korniz.position.set(0, DUVAR_Y - 0.035, 0.05);
    const serit = kutu(uz, 0.012, 0.014, this._seritM ||= this._ledM(), false);
    serit.position.set(0, DUVAR_Y - 0.076, 0.092);
    this._yikamaDoku ||= isikDokusu('yikama');
    const yikama = new THREE.Mesh(new THREE.PlaneGeometry(uz, 1.15), this._yikamaM ||= this._parilti(this._yikamaDoku, '#ffd6a0', 0.14, 0.6));
    yikama.position.set(0, DUVAR_Y - 0.075 - 0.575, 0.006);
    const taban = new THREE.Mesh(new THREE.PlaneGeometry(uz, 0.6), this._tabanIsikM ||= this._parilti(this._yikamaDoku, '#ffd29a', 0, 0.38));
    taban.rotation.x = -Math.PI / 2;
    taban.position.set(0, 0.004, 0.3);
    g.add(korniz, serit, yikama, taban);
    return g;
  }

  // Derin gri lambiri giydirmeli kolon (yerel +z odaya bakar): siyah kaide, ön yüzde ince LED çizgisi ve yumuşak parıltı.
  _kolon(led) {
    const g = new THREE.Group();
    this._kolonM ||= this._lambiriM(this._cevizDoku, KOLON_G);
    const govde = kutu(KOLON_G, DUVAR_Y, KOLON_D, this._kolonM);
    govde.position.set(0, DUVAR_Y / 2, KOLON_D / 2);
    const kaide = kutu(KOLON_G + 0.03, 0.08, KOLON_D + 0.03, this.siyah, false);
    kaide.position.set(0, 0.04, KOLON_D / 2);
    g.add(govde, kaide);
    if (led) {
      const cizgi = kutu(0.016, DUVAR_Y - 0.46, 0.006, this._seritM ||= this._ledM(), false);
      cizgi.position.set(0, DUVAR_Y / 2 + 0.04, KOLON_D + 0.003);
      this._seritDoku ||= isikDokusu('serit');
      const par = new THREE.Mesh(new THREE.PlaneGeometry(KOLON_G * 0.85, DUVAR_Y - 0.32), this._kolonIsikM ||= this._parilti(this._seritDoku, '#ffd6a0', 0.2, 0.7));
      par.position.set(0, DUVAR_Y / 2 + 0.04, KOLON_D + 0.008);
      g.add(cizgi, par);
    }
    return g;
  }

  // Ofis tabelası: derin gri çıtalı vurgu duvarı, üstünde arkadan aydınlatmalı (hale) LED kanal harfler ve
  // LED halkalı logo. Akşam iki spot çıtaları aydınlatır. Döndürür: grup (yerel +z odaya bakar) ve duvarın genişliği.
  _ledTabela(G) {
    const ad = String(this.ayar.ofisAdi || 'Ofis').trim();
    const ek = ad.match(/^(.+?)\s+ofis[iı]?$/i);
    const ana = (ek ? ek[1] : ad).toLocaleUpperCase('tr-TR');
    const alt = ek ? 'OFİS' : '';
    const yuz = tabelaYazisi(ana, alt, false), hale = tabelaYazisi(ana, alt, true);
    const yaziG = THREE.MathUtils.clamp(G * 0.27, 2.4, 5), yaziY = yaziG * TABELA_Y / TABELA_G;
    const harfG = yaziG * yuz.oran;
    const logoR = yaziY * 0.27, ara = 0.16;
    const logoYer = this.ayar.logo ? logoR * 2 + ara : 0; // logo yoksa yazı ortalanır
    const blok = harfG + logoYer;
    const gen = THREE.MathUtils.clamp(blok + 1.3, 3.2, G * 0.5);
    const anaY = DUVAR_Y - 0.78; // ana satırın ortası
    const yaziMY = anaY - (TABELA_Y / 2 - TABELA_ANA) / TABELA_Y * yaziY;
    const yaziX = logoYer / 2;
    const g = new THREE.Group();

    // Vurgu duvarı: koyu zemin üstünde derin gri dikey çıtalar (tek çizimde, tonları hafif farklı).
    const arka = kutu(gen, DUVAR_Y, 0.02, malzeme('#18181a', { roughness: 0.85 }), false);
    arka.position.set(0, DUVAR_Y / 2, 0.01);
    const say = Math.round(gen / 0.07), adim = gen / say;
    const citalar = new THREE.InstancedMesh(new THREE.BoxGeometry(adim * 0.64, DUVAR_Y, 0.04), malzeme('#ffffff', { roughness: 0.5 }), say);
    const m4 = new THREE.Matrix4(), renk = new THREE.Color();
    const tonlar = AGT.citalar;
    for (let i = 0; i < say; i++) {
      citalar.setMatrixAt(i, m4.makeTranslation(-gen / 2 + adim * (i + 0.5), DUVAR_Y / 2, 0.04));
      citalar.setColorAt(i, renk.set(tonlar[(i * 7) % tonlar.length]));
    }
    citalar.castShadow = true;
    citalar.receiveShadow = true;
    g.add(arka, citalar);

    // Harfler: duvara vuran hale, bronz yanaklar (üst üste ince katmanlar) ve krem renkli ışıklı yüz.
    const duz = new THREE.PlaneGeometry(yaziG, yaziY);
    const haleP = new THREE.Mesh(duz, this._parilti(hale.doku, '#ffb768', 0.4, 0.85));
    haleP.position.set(yaziX, yaziMY, 0.063);
    g.add(haleP);
    // Tabela renkleri: şampanya altını yüz, füme metal yanak.
    const yanakM = new THREE.MeshStandardMaterial({ map: yuz.doku, color: '#46474a', alphaTest: 0.35, roughness: 0.35, metalness: 0.6 });
    for (let i = 0; i < 8; i++) {
      const k = new THREE.Mesh(duz, yanakM);
      k.position.set(yaziX, yaziMY, 0.068 + i * 0.004);
      g.add(k);
    }
    const yuzM = new THREE.MeshStandardMaterial({ map: yuz.doku, color: '#ead6b0', alphaTest: 0.35, roughness: 0.3, metalness: 0.35,
      emissive: '#d9bf92', emissiveMap: yuz.doku, emissiveIntensity: 0.55 });
    this.ledler.push({ tur: 'isik', m: yuzM, gunduz: 0.55, gece: 0.95 });
    const on = new THREE.Mesh(duz, yuzM);
    on.position.set(yaziX, yaziMY, 0.1);
    g.add(on);

    // Logo: harflerin solunda, arkasında hale ve çevresinde LED halka.
    const logo = this._logo(logoR);
    logo.position.set(yaziX - harfG / 2 - ara - logoR, anaY, 0.06);
    const logoHale = new THREE.Mesh(new THREE.PlaneGeometry(logoR * 3.4, logoR * 3.4), this._parilti(this._haleDoku ||= isikDokusu('hale'), '#ffb35c', 0.45, 0.95));
    logoHale.position.z = 0.002;
    const halka = new THREE.Mesh(new THREE.TorusGeometry(logoR * 1.13, 0.014, 8, 72), this._ledM(1.2, 2.8));
    halka.position.z = 0.04;
    logo.add(logoHale, halka);
    g.add(logo);

    // Akşam vurgu duvarını aydınlatan iki sıcak spot.
    for (const sx of [-0.28, 0.28]) {
      const spot = new THREE.PointLight('#ffcf94', 0, 3.4, 2);
      spot.position.set(gen * sx, DUVAR_Y - 0.3, 0.55);
      this.ledler.push({ tur: 'lamba', m: spot, gunduz: 0, gece: 2.4 });
      g.add(spot);
    }
    return { grup: g, gen };
  }

  // Tabeladaki logo: füme metal taban üstünde yuvarlak levha. Resim yolu ayardan gelir (ayar.logo);
  // verilmezse ya da yüklenemezse logo, halesi ve LED halkası hiç görünmez.
  _logo(r) {
    const g = new THREE.Group();
    if (!this.ayar.logo) { g.visible = false; return g; }
    const taban = silindir(r * 1.08, r * 1.08, 0.04, malzeme('#2b2c2f', { roughness: 0.35, metalness: 0.6 }), 64);
    taban.rotation.x = Math.PI / 2;
    taban.position.z = 0.02;
    const m = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.45 });
    const yuz = new THREE.Mesh(new THREE.CircleGeometry(r, 64), m);
    yuz.position.z = 0.042;
    yuz.visible = false;
    new THREE.TextureLoader().load(this.ayar.logo, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      m.map = t;
      m.needsUpdate = true;
      yuz.visible = true;
    }, undefined, () => { g.visible = false; });
    g.add(taban, yuz);
    return g;
  }

  // Modüler cam duvar: ince antrasit alüminyum profiller (alt ray, üst kayıt, modül araları),
  // camda buzlu bant (camDokusu). Kabinlerde alçak, arşivde boy yüksekliğinde.
  _camDuvar(x1, z1, x2, z2, yuk = CAM_Y) {
    const uz = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(uz / CAM_MODUL));
    const grup = new THREE.Group();
    grup.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    grup.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    const geo = new THREE.PlaneGeometry(uz, yuk);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);
    const cam = new THREE.Mesh(geo, this.camM);
    cam.position.y = yuk / 2;
    cam.renderOrder = 2;
    const altRay = kutu(uz, 0.036, 0.05, this.aluM, false);
    altRay.position.y = 0.018;
    const ustKayit = kutu(uz, 0.026, 0.04, this.aluM, false);
    ustKayit.position.y = yuk;
    grup.add(cam, altRay, ustKayit);
    for (let i = 1; i < n; i++) {
      const dikme = kutu(0.016, yuk, 0.028, this.aluM, false);
      dikme.position.set(-uz / 2 + (i * uz) / n, yuk / 2, 0);
      grup.add(dikme);
    }
    this.dunya.add(grup);
    return grup;
  }

  _oda(o) {
    const { x, z, g, d } = o;
    // Gri meşe zemin ve önde ekip renginde ince şerit.
    this._parke ||= parkeDokusu();
    const p = this._parke.clone();
    p.repeat.set(g / 4, d / 4);
    p.needsUpdate = true;
    const zemin = new THREE.Mesh(new THREE.PlaneGeometry(g, d), malzeme('#ffffff', { map: p, roughness: 0.6 }));
    zemin.rotation.x = -Math.PI / 2;
    zemin.position.set(x + g / 2, 0.006, z + d / 2);
    zemin.receiveShadow = true;
    const serit = kutu(g, 0.012, 0.07, malzeme(o.renk, { roughness: 0.5 }), false);
    serit.position.set(x + g / 2, 0.008, z + d - 0.035);
    this.dunya.add(zemin, serit);

    // Arka ve yanlarda alçak kabin camı; önü açık.
    this._camDuvar(x, z, x + g, z);
    this._camDuvar(x, z, x, z + d);
    this._camDuvar(x + g, z, x + g, z + d);
    for (const [px, pz] of [[x, z], [x + g, z], [x, z + d], [x + g, z + d]]) {
      const dk = kutu(0.04, CAM_Y + 0.02, 0.04, this.aluM);
      dk.position.set(px, (CAM_Y + 0.02) / 2, pz);
      this.dunya.add(dk);
    }
    const bitki = this._bitki(1.1);
    bitki.position.set(x + 0.4, 0, z + 0.4);
    this.dunya.add(bitki);
    // Oda adı, odanın içinde sol önde, zeminde durur.
    const capa = new THREE.Object3D();
    capa.position.set(x + 0.2, 0.02, z + d - 0.4);
    this.dunya.add(capa);
    this.odaEtiketleri.push({ ad: o.ad, renk: o.renk, capa });
  }

  // ---------- Masa ve karakter ----------

  _sandalye() {
    const g = new THREE.Group();
    const kumas = malzeme('#2a2c31', { roughness: 0.9 });
    const oturak = kutu(0.48, 0.07, 0.46, kumas); oturak.position.y = 0.48;
    const sirt = kutu(0.46, 0.52, 0.05, kumas); sirt.position.set(0, 0.82, -0.25);
    const ayak = silindir(0.025, 0.025, 0.4, this.metal, 10); ayak.position.y = 0.25;
    const taban = silindir(0.26, 0.26, 0.025, this.metal, 5); taban.position.y = 0.03;
    g.add(oturak, sirt, ayak, taban);
    return g;
  }

  // Görünüm role göre: genel müdür ceketli ve kır sakallı, muhasebeci yelekli ve gözlüklü,
  // ahşap ustası önlüklü, video editörü kapüşonlu.
  _stil(c, sira) {
    const m = `${c.id} ${c.rol}`.toLowerCase();
    const s = { ten: TENLER[sira % TENLER.length], sac: SACLAR[sira % SACLAR.length], sakal: sira % 3 !== 1, gozluk: false,
      ust: null, kol: null, yaka: false, kravat: false, onluk: false, kapusonlu: false,
      pantolon: PANTOLONLAR[sira % PANTOLONLAR.length], ayakkabi: sira % 2 ? '#3a2a1f' : '#1c1c1e' };
    if (c.id === 'genel-mudur') Object.assign(s, { ust: '#26334b', yaka: true, kravat: true, sakal: true, sac: '#5a524b', sakalRenk: '#7b746d', pantolon: '#26334b' });
    else if (c.yedek) Object.assign(s, { ust: '#3f5d4c', yaka: true, sakal: true });
    else if (/muhasebe/.test(m)) Object.assign(s, { ust: '#414857', kol: '#f1efe9', yaka: true, gozluk: true });
    else if (/ahşap|ahsap/.test(m)) Object.assign(s, { onluk: true, sakal: true });
    else if (/edit[oö]r/.test(m)) Object.assign(s, { kapusonlu: true });
    else if (/güvenlik|guvenlik/.test(m)) Object.assign(s, { ust: '#2c3038', yaka: true, sakal: true });
    else if (/rakip|site|web/.test(m)) s.gozluk = true;
    return s;
  }

  // Eklemli insan: kalça, diz, ayak; omuz, dirsek, el; boyun ve baş. Oturup kalkar, yürür, klavyeye yazar.
  _karakter(renk, c, sira) {
    const s = this._stil(c, sira);
    const g = this._kGeo ||= {
      kalca: new THREE.SphereGeometry(1, 16, 10),
      uyluk: new THREE.CapsuleGeometry(0.066, 0.28, 4, 10),
      baldir: new THREE.CapsuleGeometry(0.054, 0.3, 4, 10),
      ayak: new THREE.BoxGeometry(0.1, 0.07, 0.24),
      govde: new THREE.LatheGeometry([[0.001, 0], [0.13, 0], [0.138, 0.07], [0.128, 0.19], [0.134, 0.3], [0.152, 0.42], [0.158, 0.49], [0.13, 0.56], [0.075, 0.6], [0.001, 0.62]]
        .map(([r, y]) => new THREE.Vector2(r, y)), 24),
      boyun: new THREE.CylinderGeometry(0.048, 0.052, 0.12, 12),
      kafa: new THREE.SphereGeometry(0.105, 24, 18),
      sac: new THREE.SphereGeometry(0.111, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      sakal: new THREE.SphereGeometry(0.109, 20, 10, 0, Math.PI, Math.PI * 0.53, Math.PI * 0.37),
      kulak: new THREE.SphereGeometry(0.022, 10, 8),
      goz: new THREE.SphereGeometry(0.013, 8, 8),
      kas: new THREE.BoxGeometry(0.036, 0.008, 0.008),
      burun: new THREE.SphereGeometry(0.017, 10, 8),
      agiz: new THREE.BoxGeometry(0.032, 0.006, 0.006),
      biyik: new THREE.BoxGeometry(0.05, 0.013, 0.012),
      omuz: new THREE.SphereGeometry(0.05, 12, 10),
      ustKol: new THREE.CapsuleGeometry(0.045, 0.21, 4, 10),
      onKol: new THREE.CapsuleGeometry(0.039, 0.19, 4, 10),
      el: new THREE.SphereGeometry(0.04, 12, 10),
      gozluk: new THREE.TorusGeometry(0.021, 0.0035, 6, 18),
      kopru: new THREE.BoxGeometry(0.03, 0.004, 0.004),
    };
    const M = (r, ek) => malzeme(r, { roughness: 0.85, ...ek });
    const tenM = M(s.ten, { roughness: 0.62 }), ustM = M(s.ust || renk), kolM = s.kol ? M(s.kol) : ustM;
    const pantM = M(s.pantolon, { roughness: 0.9 }), ayakM = M(s.ayakkabi, { roughness: 0.5 });
    const sacM = M(s.sac, { roughness: 0.95 }), sakalM = s.sakalRenk ? M(s.sakalRenk, { roughness: 0.95 }) : sacM;
    const koyuM = this._koyuM ||= malzeme('#2a2018', { roughness: 0.3 });
    const parca = (geo, mat, x = 0, y = 0, z = 0) => { const p = new THREE.Mesh(geo, mat); p.position.set(x, y, z); p.castShadow = true; return p; };

    const grup = new THREE.Group();
    grup.rotation.order = 'YXZ'; // önce yön, sonra eğim: yatağa uzanırken sırtüstü yatar
    const pelvis = new THREE.Group();
    grup.add(pelvis);
    const kalca = parca(g.kalca, pantM, 0, -0.01, 0);
    kalca.scale.set(0.155, 0.1, 0.115);
    pelvis.add(kalca);
    const bacak = sx => {
      const kok = new THREE.Group(); kok.position.set(sx * 0.085, -0.02, 0); pelvis.add(kok);
      kok.add(parca(g.uyluk, pantM, 0, -0.2, 0));
      const diz = new THREE.Group(); diz.position.y = -0.42; kok.add(diz);
      diz.add(parca(g.baldir, pantM, 0, -0.2, 0), parca(g.ayak, ayakM, 0, -0.43, 0.045));
      return { kok, diz };
    };
    const bL = bacak(-1), bR = bacak(1);

    const govdeG = new THREE.Group();
    pelvis.add(govdeG);
    const govde = parca(g.govde, ustM);
    govde.scale.set(1.18, 1, 0.74);
    govdeG.add(govde);
    if (s.yaka) {
      // Ceketin ya da yeleğin içinden görünen gömlek, genel müdürde kravat.
      const v = parca(new THREE.PlaneGeometry(0.075, 0.075), this._gomlekM ||= malzeme('#f4f2ee', { roughness: 0.7 }), 0, 0.525, 0.112);
      v.rotation.set(-0.35, 0, Math.PI / 4);
      govdeG.add(v);
      if (s.kravat) { const kr = parca(new THREE.BoxGeometry(0.026, 0.17, 0.008), M('#7a2630', { roughness: 0.6 }), 0, 0.43, 0.118); kr.rotation.x = -0.12; govdeG.add(kr); }
    }
    if (s.onluk) {
      const om = M('#7a5233', { roughness: 0.7 });
      const on = parca(new THREE.BoxGeometry(0.26, 0.44, 0.012), om, 0, 0.22, 0.112);
      const a1 = parca(new THREE.BoxGeometry(0.018, 0.16, 0.01), om, -0.06, 0.5, 0.106); a1.rotation.z = -0.35;
      const a2 = a1.clone(); a2.position.x = 0.06; a2.rotation.z = 0.35;
      govdeG.add(on, a1, a2);
    }
    if (s.kapusonlu) {
      const kap = parca(new THREE.TorusGeometry(0.085, 0.036, 8, 20), ustM, 0, 0.585, -0.015);
      kap.rotation.x = Math.PI / 2 - 0.25;
      kap.scale.set(1.15, 1, 1);
      govdeG.add(kap);
    }
    govdeG.add(parca(g.boyun, tenM, 0, 0.64, 0));

    const bas = new THREE.Group();
    bas.position.y = 0.77;
    govdeG.add(bas);
    const kafa = parca(g.kafa, tenM);
    kafa.scale.set(0.94, 1.12, 1);
    const sac = parca(g.sac, sacM, 0, 0.014, -0.008);
    sac.scale.set(0.95, 1.1, 1.02);
    sac.rotation.x = -0.55;
    bas.add(kafa, sac);
    for (const sx of [-1, 1]) {
      const kulak = parca(g.kulak, tenM, sx * 0.097, -0.005, 0);
      kulak.scale.set(0.45, 1, 0.75);
      const kas = parca(g.kas, sacM, sx * 0.037, 0.042, 0.097);
      kas.rotation.z = sx * -0.12;
      bas.add(kulak, parca(g.goz, koyuM, sx * 0.036, 0.013, 0.096), kas);
      if (s.gozluk) bas.add(parca(g.gozluk, koyuM, sx * 0.037, 0.013, 0.106));
    }
    if (s.gozluk) bas.add(parca(g.kopru, koyuM, 0, 0.016, 0.108));
    const burun = parca(g.burun, tenM, 0, -0.012, 0.104);
    burun.scale.set(0.8, 1.05, 1.15);
    bas.add(burun);
    if (s.sakal) {
      const sakal = parca(g.sakal, sakalM);
      sakal.scale.set(0.95, 1.12, 1.03);
      bas.add(sakal, parca(g.biyik, sakalM, 0, -0.03, 0.1));
    } else bas.add(parca(g.agiz, M('#9a5b4c', { roughness: 0.6 }), 0, -0.047, 0.097));

    const kol = sx => {
      const omuz = new THREE.Group(); omuz.position.set(sx * 0.198, 0.5, 0); govdeG.add(omuz);
      omuz.add(parca(g.omuz, kolM), parca(g.ustKol, kolM, 0, -0.145, 0));
      const dirsek = new THREE.Group(); dirsek.position.y = -0.29; omuz.add(dirsek);
      dirsek.add(parca(g.onKol, kolM, 0, -0.13, 0));
      const el = new THREE.Group(); el.position.y = -0.285; dirsek.add(el);
      const avuc = parca(g.el, tenM); avuc.scale.set(0.8, 1.15, 0.62); el.add(avuc);
      return { omuz, dirsek, el };
    };
    const kL = kol(-1), kR = kol(1);
    const k = { grup, pelvis, govdeG, bas, kalcaL: bL.kok, dizL: bL.diz, kalcaR: bR.kok, dizR: bR.diz,
      omuzL: kL.omuz, dirsekL: kL.dirsek, elL: kL.el, omuzR: kR.omuz, dirsekR: kR.dirsek, elR: kR.el, poz: { ...POZ_OTUR } };
    this._pozUygula(k, k.poz);
    return k;
  }

  _pozUygula(k, p) {
    k.pelvis.position.y = p.py;
    k.govdeG.rotation.x = p.egil;
    k.kalcaL.rotation.x = p.kL; k.kalcaR.rotation.x = p.kR;
    k.dizL.rotation.x = p.dL; k.dizR.rotation.x = p.dR;
    k.omuzL.rotation.set(p.oLx, 0, p.oLz); k.omuzR.rotation.set(p.oRx, 0, p.oRz);
    k.dirsekL.rotation.x = p.eL; k.dirsekR.rotation.x = p.eR;
    k.bas.rotation.set(p.bx, p.by, p.bz);
  }

  // Duruşu hedefe yumuşakça yaklaştırır: oturup kalkma, yazma ve yürüme geçişleri.
  _pozYaklas(k, hedef, dt) {
    const f = AZ_HAREKET ? 1 : 1 - Math.exp(-dt * 14);
    for (const a in hedef) k.poz[a] += (hedef[a] - k.poz[a]) * f;
    this._pozUygula(k, k.poz);
  }

  _lamba() {
    const g = new THREE.Group();
    const m = this.siyah;
    const taban = silindir(0.07, 0.08, 0.02, m, 16); taban.position.y = 0.01;
    const kol = silindir(0.01, 0.01, 0.36, m, 8); kol.position.y = 0.19;
    const bas = silindir(0.03, 0.08, 0.1, m, 16); bas.position.set(0.06, 0.36, 0); bas.rotation.z = -0.6;
    const ampulM = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 0 });
    const ampul = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), ampulM); ampul.position.set(0.08, 0.32, 0);
    const isik = new THREE.PointLight('#ffc874', 0, 3, 2); isik.position.set(0.1, 0.3, 0);
    g.add(taban, kol, bas, ampul, isik);
    return { grup: g, ampulM, isik };
  }

  // Beyaz saksıda bitki.
  _bitki(olcek = 1, saksiRenk = '#efece6') {
    const g = new THREE.Group();
    const o = olcek;
    const saksi = silindir(0.17 * o, 0.14 * o, 0.38 * o, malzeme(saksiRenk, { roughness: 0.5 }), 24);
    saksi.position.y = 0.19 * o;
    const toprak = silindir(0.155 * o, 0.155 * o, 0.02 * o, malzeme('#3b2f26', { roughness: 1 }), 16);
    toprak.position.y = 0.375 * o;
    g.add(saksi, toprak);
    const yM = [malzeme('#4d7a45', { roughness: 0.8, flatShading: true }), malzeme('#62925a', { roughness: 0.8, flatShading: true })];
    for (let i = 0; i < 7; i++) {
      const y = new THREE.Mesh(new THREE.SphereGeometry(0.12 * o, 7, 5), yM[i % 2]);
      const a = i * 2.4, r = (i === 0 ? 0 : 0.1) * o;
      y.scale.set(0.75, 1.7, 0.75);
      y.position.set(Math.cos(a) * r, (0.62 + (i % 3) * 0.12 + (i === 0 ? 0.22 : 0)) * o, Math.sin(a) * r);
      y.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      y.castShadow = true;
      g.add(y);
    }
    return g;
  }

  _masa(c, renk, px, pz, buyuk, satir) {
    const grup = new THREE.Group();
    grup.position.set(px, 0, pz);
    this.dunya.add(grup);
    const mg = buyuk ? 1.9 : 1.5, md = 0.75, my = 0.74, masaZ = 0.35, karZ = -0.3;

    // Çöl gri tabla, siyah çelik ayak, önde beyaz panel.
    const ust = kutu(mg, 0.04, md, this.mese); ust.position.set(0, my, masaZ);
    grup.add(ust);
    for (const s of [-1, 1]) {
      const ax = s * (mg / 2 - 0.07);
      for (const zz of [-1, 1]) {
        const ayak = kutu(0.035, my - 0.02, 0.035, this.siyah);
        ayak.position.set(ax, (my - 0.02) / 2, masaZ + zz * (md / 2 - 0.07));
        grup.add(ayak);
      }
      const bag = kutu(0.035, 0.035, md - 0.14, this.siyah);
      bag.position.set(ax, my - 0.04, masaZ);
      grup.add(bag);
    }
    const on = kutu(mg - 0.2, 0.3, 0.02, this.beyaz); on.position.set(0, my - 0.21, masaZ + md / 2 - 0.09);
    grup.add(on);

    // Monitör: ekran çalışana bakar, arkasındaki ışık şeridi durumu gösterir.
    const monY = my + 0.02;
    const monZ = masaZ + 0.2;
    const ayakM = kutu(0.04, 0.2, 0.04, this.metal); ayakM.position.set(0, monY + 0.1, monZ + 0.02);
    const taban = kutu(0.2, 0.012, 0.14, this.metal); taban.position.set(0, monY + 0.006, monZ);
    const panel = kutu(0.68, 0.4, 0.025, malzeme('#18191c', { roughness: 0.4 })); panel.position.set(0, monY + 0.38, monZ);
    const ekranM = new THREE.MeshStandardMaterial({ color: '#0d1420', emissive: '#4da3ff', emissiveIntensity: 0.05, roughness: 0.3 });
    const ekran = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.36), ekranM);
    ekran.position.set(0, monY + 0.38, monZ - 0.014);
    ekran.rotation.y = Math.PI;
    const ledM = new THREE.MeshStandardMaterial({ color: '#1d1d20', emissive: '#000000', emissiveIntensity: 0 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.012), ledM);
    led.position.set(0, monY + 0.54, monZ + 0.016);
    grup.add(ayakM, taban, panel, ekran, led);

    const klavye = kutu(0.42, 0.018, 0.13, malzeme('#f1efea')); klavye.position.set(0, my + 0.03, masaZ - 0.12);
    const kupa = silindir(0.04, 0.035, 0.09, malzeme(renk, { roughness: 0.5 }), 14); kupa.position.set(mg / 2 - 0.2, my + 0.065, masaZ - 0.1);
    grup.add(klavye, kupa);

    const sandalye = this._sandalye(); sandalye.position.z = karZ;
    const k = this._karakter(renk, c, this.calisanlar.indexOf(c)); k.grup.position.z = karZ;
    grup.add(sandalye, k.grup);

    const isik = new THREE.PointLight('#4da3ff', 0, 2.2, 2);
    isik.position.set(0, monY + 0.4, monZ - 0.25);
    grup.add(isik);

    const halkaM = new THREE.MeshBasicMaterial({ color: '#4cc26a', transparent: true, opacity: 0, depthWrite: false });
    const halka = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.52, 48), halkaM);
    halka.rotation.x = -Math.PI / 2;
    halka.position.set(0, 0.03, karZ);
    grup.add(halka);

    const dusunce = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.03 + i * 0.012, 12, 10),
        new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#f2b33d', emissiveIntensity: 0.35 }));
      n.position.set(0.13 + i * 0.085, 0.99 + i * 0.09, 0.02);
      n.userData.y = n.position.y;
      dusunce.add(n);
    }
    dusunce.visible = false;
    k.govdeG.add(dusunce); // baloncuklar kişiyle birlikte gider

    const lamba = this._lamba();
    lamba.grup.position.set(-mg / 2 + 0.18, my + 0.02, masaZ + 0.12);
    grup.add(lamba.grup);

    this._esyalar(c, grup, { mg, my, masaZ, buyuk });

    // Kabin dolabı: iki kapaklı alçak dolap. Çalışan iş sürerken arada dosya almaya gider; tıklayınca da açılır.
    const dolap = this._kapakliDolap(0.9, 0.62, 0.42);
    const dx = buyuk ? 1.35 : -0.85, dz = -1.25;
    dolap.grup.position.set(dx, 0, dz);
    const sus = this._bitki(0.42);
    sus.position.set(dx + 0.26, 0.62, dz);
    const kitap1 = kutu(0.24, 0.035, 0.17, this._renk('#2b2c2f', { roughness: 0.7 })); kitap1.position.set(dx - 0.18, 0.638, dz);
    const kitap2 = kutu(0.21, 0.03, 0.15, this._renk('#cbaf8b', { roughness: 0.6 })); kitap2.position.set(dx - 0.17, 0.67, dz); kitap2.rotation.y = 0.18;
    grup.add(dolap.grup, sus, kitap1, kitap2);

    const capa = new THREE.Object3D(); capa.position.set(0, 1.19, 0); k.govdeG.add(capa); // etiket başın üstünde, yürürken de
    const masaCapa = new THREE.Object3D(); masaCapa.position.set(0.35, my + 0.06, masaZ - 0.05); grup.add(masaCapa);

    grup.traverse(m => { if (m.isMesh) m.userData.id = c.id; });
    this.tiklanabilir.push(grup);
    this.masalar.set(c.id, {
      id: c.id, c, k, ekranM, ledM, isik, halka, halkaM, dusunce, lamba, capa, masaCapa,
      sandalye, karZ, mg, px, pz, satir, kuyruk: [], hareket: null, zarfBekliyor: 0,
      durum: 'bosta', aktivite: '', degisim: -10, durumT: -10, faz: Math.random() * 6,
      dolap: { acilir: dolap.acilir, durX: dx, durZ: dz + 0.21 + 0.5 }, dolapT: 0,
      mola: 25 + Math.random() * 200, duyguBitis: 0,
      // Yatakhane: yer 'ofis' ya da 'ev'; ilk karede saate göre belirlenir. Güvenlik nöbetçidir, odası yok.
      nobetci: nobetciMi(c), oda: null, yer: undefined, yatakta: false, eveT: 0, kalkT: 0, uyuT: 0, devriyeT: 0,
    });
  }

  // Role göre masa eşyaları.
  _esyalar(c, grup, { mg, my, masaZ, buyuk }) {
    const metin = `${c.id} ${c.rol}`.toLowerCase();
    if (buyuk) {
      // Genel müdür: arkasında siyah çelik raf, çöl gri raflar.
      const raf = new THREE.Group();
      const yan = (x) => { const p = kutu(0.035, 1.8, 0.32, this.siyah); p.position.set(x, 0.9, 0); raf.add(p); };
      yan(-0.7); yan(0.7);
      const kitapRenk = ['#c9b8a0', '#2f3a45', '#b08a4a', '#e9e4dc', '#6b7b6e', '#a25f45'];
      for (let i = 0; i < 4; i++) {
        const r = kutu(1.4, 0.03, 0.32, this.mese); r.position.set(0, 0.05 + i * 0.58, 0); raf.add(r);
        if (i < 3) {
          let x = -0.62;
          const son = i === 1 ? 0.15 : 0.55;
          while (x < son) {
            const kg = 0.05 + ((x * 100) % 3) * 0.015, ky = 0.3 + ((x * 77) % 4) * 0.04;
            const kitap = kutu(kg, ky, 0.22, malzeme(kitapRenk[Math.abs(Math.round(x * 40)) % kitapRenk.length], { roughness: 0.7 }));
            kitap.position.set(x + kg / 2, 0.065 + i * 0.58 + ky / 2, 0);
            raf.add(kitap);
            x += kg + 0.012;
          }
          if (i === 1) {
            const vazo = silindir(0.07, 0.05, 0.26, malzeme('#e9e4dc', { roughness: 0.4 }), 18);
            vazo.position.set(0.42, 0.065 + 0.58 + 0.13, 0);
            raf.add(vazo);
          }
        }
      }
      raf.position.set(0, 0, -1.3);
      grup.add(raf);
      const pusula = silindir(0.09, 0.09, 0.03, malzeme('#c8a24a', { roughness: 0.3, metalness: 0.7 }), 24);
      pusula.position.set(mg / 2 - 0.45, my + 0.035, masaZ - 0.05);
      grup.add(pusula);
      return;
    }
    if (/kreatif/.test(metin)) {
      // Şövale: üstünde reklam taslağı.
      const sovale = new THREE.Group();
      const tahtaM = this.mese;
      const a1 = kutu(0.04, 1.75, 0.04, tahtaM); a1.position.set(-0.32, 0.86, 0); a1.rotation.z = 0.12;
      const a2 = a1.clone(); a2.position.x = 0.32; a2.rotation.z = -0.12;
      const a3 = kutu(0.04, 1.6, 0.04, tahtaM); a3.position.set(0, 0.78, -0.32); a3.rotation.x = -0.22;
      const raf = kutu(0.78, 0.04, 0.1, tahtaM); raf.position.set(0, 0.95, 0.05);
      const tuval = kutu(0.72, 0.56, 0.025, malzeme('#fbf6ea', { roughness: 0.8 })); tuval.position.set(0, 1.27, 0.06);
      const serit = kutu(0.6, 0.12, 0.006, malzeme('#c9733d', { roughness: 0.6 }), false); serit.position.set(0, 1.41, 0.075);
      const kutucuk = kutu(0.26, 0.2, 0.006, malzeme('#7a5233', { roughness: 0.6 }), false); kutucuk.position.set(-0.15, 1.19, 0.075);
      const cizgi = kutu(0.22, 0.03, 0.006, malzeme('#3d6b45', { roughness: 0.6 }), false); cizgi.position.set(0.17, 1.2, 0.075);
      sovale.add(a1, a2, a3, raf, tuval, serit, kutucuk, cizgi);
      sovale.position.set(0.7, 0, -1.15);
      sovale.rotation.y = -0.35;
      grup.add(sovale);
      const kalemlik = silindir(0.045, 0.045, 0.11, malzeme('#2f5d7c', { roughness: 0.5 }), 14);
      kalemlik.position.set(-mg / 2 + 0.45, my + 0.075, masaZ - 0.05);
      grup.add(kalemlik);
      ['#c0392b', '#e0a95a', '#3d6b45'].forEach((r, i) => {
        const k = silindir(0.007, 0.007, 0.16, malzeme(r), 6);
        k.position.set(-mg / 2 + 0.43 + i * 0.02, my + 0.15, masaZ - 0.05);
        k.rotation.z = (i - 1) * 0.15;
        grup.add(k);
      });
    } else if (/edit[oö]r|kurgu/.test(metin)) {
      // Tripodda kamera ve masada ikinci ekran (kurgu zaman çizelgesi).
      const kose = new THREE.Group();
      const ayakM = malzeme('#2b2d31', { roughness: 0.5, metalness: 0.4 });
      for (let i = 0; i < 3; i++) {
        const ayak = silindir(0.013, 0.013, 1.25, ayakM, 8);
        const a = (i / 3) * Math.PI * 2 + 0.4;
        ayak.position.set(Math.cos(a) * 0.17, 0.6, Math.sin(a) * 0.17);
        ayak.rotation.set(Math.sin(a) * 0.27, 0, -Math.cos(a) * 0.27);
        kose.add(ayak);
      }
      const govde = kutu(0.24, 0.16, 0.13, malzeme('#1d1f23', { roughness: 0.35 }));
      govde.position.y = 1.32;
      const lens = silindir(0.055, 0.06, 0.14, malzeme('#111214', { roughness: 0.25, metalness: 0.3 }), 18);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 1.32, 0.13);
      const kirmizi = silindir(0.012, 0.012, 0.01, malzeme('#e5483b', { emissive: '#e5483b', emissiveIntensity: 1.2 }), 8);
      kirmizi.position.set(0.08, 1.41, 0.02);
      kose.add(govde, lens, kirmizi);
      kose.position.set(0.8, 0, -1.05);
      kose.rotation.y = -2.4;
      grup.add(kose);
      const ekran = kutu(0.42, 0.26, 0.02, malzeme('#1d1f23', { roughness: 0.4 }));
      ekran.position.set(-mg / 2 + 0.55, my + 0.3, masaZ - 0.2);
      ekran.rotation.y = 0.35;
      const ayak2 = kutu(0.04, 0.16, 0.04, malzeme('#2b2d31'));
      ayak2.position.set(-mg / 2 + 0.55, my + 0.1, masaZ - 0.2);
      const serit = ['#e0a95a', '#4da3ff', '#4cc26a'];
      serit.forEach((r, i) => {
        const s = kutu(0.3 - i * 0.06, 0.03, 0.004, malzeme(r, { emissive: r, emissiveIntensity: 0.4 }), false);
        s.position.set(0, -0.06 + i * 0.05, -0.012);
        ekran.add(s);
      });
      grup.add(ekran, ayak2);
    } else if (/sosyal|reklam|instagram/.test(metin)) {
      // Tripodda telefon ve halka ışık: çekim köşesi.
      const kose = new THREE.Group();
      const ayakM = malzeme('#2b2d31', { roughness: 0.5, metalness: 0.4 });
      for (let i = 0; i < 3; i++) {
        const ayak = silindir(0.012, 0.012, 1.3, ayakM, 8);
        const a = (i / 3) * Math.PI * 2;
        ayak.position.set(Math.cos(a) * 0.16, 0.63, Math.sin(a) * 0.16);
        ayak.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        kose.add(ayak);
      }
      const direk = silindir(0.015, 0.015, 0.35, ayakM, 8);
      direk.position.y = 1.42;
      const halka = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 12, 40),
        malzeme('#fff4e0', { emissive: '#ffe7c2', emissiveIntensity: 0.9, roughness: 0.3 }));
      halka.position.y = 1.72;
      const tel = kutu(0.07, 0.14, 0.012, malzeme('#1d1f23', { roughness: 0.3 }));
      tel.position.set(0, 1.72, 0.01);
      kose.add(direk, halka, tel);
      kose.position.set(0.75, 0, -1.1);
      kose.rotation.y = -0.5;
      grup.add(kose);
      // Masada küçük ürün maketi: çekime hazır kapaklı dolap.
      const maket = kutu(0.2, 0.22, 0.12, malzeme('#e8dcc8', { roughness: 0.35 }));
      maket.position.set(-mg / 2 + 0.5, my + 0.13, masaZ - 0.05);
      const kulp = kutu(0.012, 0.08, 0.012, malzeme('#b08a4a', { metalness: 0.7, roughness: 0.3 }), false);
      kulp.position.set(-mg / 2 + 0.52, my + 0.14, masaZ + 0.016);
      grup.add(maket, kulp);
    } else if (/rakip|trend/.test(metin)) {
      // Mantar pano: iğnelenmiş notlar ve büyüteç.
      const pano = new THREE.Group();
      const mantar = kutu(1.0, 0.7, 0.03, malzeme('#b98d5f', { roughness: 0.95 }));
      mantar.position.y = 1.35;
      const cer = kutu(1.06, 0.76, 0.02, this.siyah); cer.position.set(0, 1.35, -0.02);
      const a1 = kutu(0.035, 1.7, 0.035, this.siyah); a1.position.set(-0.45, 0.85, -0.04);
      const a2 = a1.clone(); a2.position.x = 0.45;
      pano.add(cer, mantar, a1, a2);
      const notRenk = ['#fbf6ea', '#f6d77a', '#a9d3e8', '#fbf6ea', '#b8dca0', '#f3b48a'];
      notRenk.forEach((r, i) => {
        const n = kutu(0.2, 0.16, 0.006, malzeme(r, { roughness: 0.8 }), false);
        n.position.set(-0.3 + (i % 3) * 0.3, 1.47 - Math.floor(i / 3) * 0.26, 0.02);
        n.rotation.z = ((i * 37) % 7 - 3) * 0.03;
        const igne = silindir(0.012, 0.012, 0.02, malzeme('#c0392b', { roughness: 0.4 }), 8);
        igne.rotation.x = Math.PI / 2;
        igne.position.set(n.position.x, n.position.y + 0.06, 0.03);
        pano.add(n, igne);
      });
      pano.position.set(0.55, 0, -1.25);
      pano.rotation.y = -0.15;
      grup.add(pano);
      const buyutec = new THREE.Group();
      const cam = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), malzeme('#2b2d31', { metalness: 0.5, roughness: 0.4 }));
      cam.rotation.x = Math.PI / 2;
      const sap = silindir(0.009, 0.009, 0.1, this.ceviz, 8);
      sap.rotation.z = Math.PI / 2;
      sap.position.x = 0.1;
      buyutec.add(cam, sap);
      buyutec.position.set(-mg / 2 + 0.5, my + 0.03, masaZ - 0.02);
      buyutec.rotation.y = 0.6;
      grup.add(buyutec);
    } else if (/muhasebe|finans|hesap/.test(metin)) {
      for (let i = 0; i < 4; i++) {
        const k = kutu(0.24, 0.012, 0.32, malzeme('#fbf8f1'), false);
        k.position.set(-mg / 2 + 0.55 + i * 0.006, my + 0.028 + i * 0.012, masaZ - 0.02);
        k.rotation.y = (i - 1.5) * 0.06;
        grup.add(k);
      }
      const hm = kutu(0.12, 0.025, 0.17, malzeme('#3a3d44', { roughness: 0.5 }));
      hm.position.set(mg / 2 - 0.45, my + 0.035, masaZ - 0.02);
      const ekr = kutu(0.09, 0.005, 0.04, malzeme('#b9d3a0', { emissive: '#7fa865', emissiveIntensity: 0.3 }), false);
      ekr.position.set(mg / 2 - 0.45, my + 0.05, masaZ - 0.07);
      grup.add(hm, ekr);
    } else if (/site|web|yaz[ıi]l[ıi]m/.test(metin)) {
      const taban = kutu(0.36, 0.018, 0.25, malzeme('#b9bcc2', { roughness: 0.35, metalness: 0.5 }));
      taban.position.set(-mg / 2 + 0.6, my + 0.03, masaZ - 0.05);
      const kapak = kutu(0.36, 0.24, 0.012, malzeme('#b9bcc2', { roughness: 0.35, metalness: 0.5 }));
      kapak.position.set(-mg / 2 + 0.6, my + 0.145, masaZ + 0.07);
      kapak.rotation.x = -0.25;
      const ekr = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshStandardMaterial({ color: '#f5efe6', emissive: '#f0e3cf', emissiveIntensity: 0.25 }));
      ekr.position.set(-mg / 2 + 0.6, my + 0.145, masaZ + 0.063);
      ekr.rotation.set(-0.25, Math.PI, 0);
      grup.add(taban, kapak, ekr);
    } else if (/kanal|video|youtube|i[cç]erik/.test(metin)) {
      const pano = new THREE.Group();
      const yuzey = kutu(1.0, 0.7, 0.03, malzeme('#f7f5f0', { roughness: 0.4 }));
      yuzey.position.y = 1.35;
      const cer = kutu(1.06, 0.76, 0.02, this.siyah); cer.position.set(0, 1.35, -0.02);
      const a1 = kutu(0.035, 1.7, 0.035, this.siyah); a1.position.set(-0.45, 0.85, -0.04);
      const a2 = a1.clone(); a2.position.x = 0.45;
      pano.add(cer, yuzey, a1, a2);
      const cubuklar = [0.18, 0.3, 0.24, 0.42, 0.5];
      const cubukRenk = ['#e0a95a', '#d98c4a', '#c97a3e', '#4f9a63', '#3d7a46'];
      cubuklar.forEach((h, i) => {
        const b = kutu(0.1, h, 0.02, malzeme(cubukRenk[i]), false);
        b.position.set(-0.32 + i * 0.16, 1.07 + h / 2, 0.02);
        pano.add(b);
      });
      pano.position.set(0.55, 0, -1.25);
      pano.rotation.y = -0.15;
      grup.add(pano);
    } else {
      const b = this._bitki(0.55);
      b.position.set(-mg / 2 + 0.55, my + 0.02, masaZ - 0.05);
      grup.add(b);
    }
  }

  // Dinlenme köşesi: kanepe, sehpa, atölyeden bir konsol ve görev kutusu.
  _dinlenme(L, satir) {
    const { x, z, g, d } = L;
    const cx = x + g / 2, cz = z + d / 2;

    const r = Math.max(1.1, Math.min(g, d) / 2 - 0.4);
    const hali = new THREE.Mesh(new THREE.CircleGeometry(r, 64), malzeme('#d9d3c9', { roughness: 1 }));
    hali.rotation.x = -Math.PI / 2;
    hali.position.set(cx, 0.008, cz);
    hali.receiveShadow = true;
    this.dunya.add(hali);

    // Alçak modern kanepe
    const kumas = malzeme('#c9c3ba', { roughness: 0.95 });
    const kanepe = new THREE.Group();
    const otur = kutu(2.1, 0.28, 0.85, kumas); otur.position.y = 0.3;
    const sirt = kutu(2.1, 0.42, 0.18, kumas); sirt.position.set(0, 0.62, -0.34);
    const k1 = kutu(0.16, 0.44, 0.85, kumas); k1.position.set(-1.05, 0.38, 0);
    const k2 = k1.clone(); k2.position.x = 1.05;
    const y1 = kutu(0.3, 0.3, 0.12, malzeme('#cbaf8b', { roughness: 1 })); y1.position.set(-0.86, 0.6, -0.2); y1.rotation.set(0, 0.5, 0.1);
    const y2 = kutu(0.3, 0.3, 0.12, malzeme('#ece6dc', { roughness: 1 })); y2.position.set(0.86, 0.6, -0.2); y2.rotation.set(0, -0.5, -0.1);
    kanepe.add(otur, sirt, k1, k2, y1, y2);
    for (const [ax, az] of [[-1.0, -0.36], [1.0, -0.36], [-1.0, 0.36], [1.0, 0.36]]) {
      const a = kutu(0.04, 0.16, 0.04, this.siyah); a.position.set(ax, 0.08, az); kanepe.add(a);
    }
    kanepe.position.set(cx, 0, z + 0.85);
    this.dunya.add(kanepe);

    // Yuvarlak çöl gri sehpa
    const sehpaZ = Math.min(z + 2.25, cz + 0.4);
    const sUst = silindir(0.42, 0.42, 0.04, this.mese, 40); sUst.position.set(cx, 0.42, sehpaZ);
    const sAyak = silindir(0.035, 0.035, 0.4, this.siyah, 12); sAyak.position.set(cx, 0.2, sehpaZ);
    const sTaban = silindir(0.2, 0.2, 0.02, this.siyah, 24); sTaban.position.set(cx, 0.01, sehpaZ);
    const kupa = silindir(0.04, 0.035, 0.09, malzeme('#f2ede4'), 14); kupa.position.set(cx - 0.12, 0.485, sehpaZ - 0.05);
    const kitap = kutu(0.24, 0.035, 0.17, malzeme('#2f3a45', { roughness: 0.7 })); kitap.position.set(cx + 0.12, 0.457, sehpaZ + 0.05); kitap.rotation.y = 0.3;
    this.dunya.add(sUst, sAyak, sTaban, kupa, kitap);

    // Ayaklı lambader
    const lambader = new THREE.Group();
    const lt = silindir(0.14, 0.14, 0.02, this.siyah, 24); lt.position.y = 0.01;
    const ld = silindir(0.012, 0.012, 1.45, this.siyah, 8); ld.position.y = 0.74;
    const ls = silindir(0.16, 0.2, 0.26, malzeme('#f4efe6', { emissive: '#ffe2b0', emissiveIntensity: 0.15, roughness: 0.9 }), 24); ls.position.y = 1.5;
    lambader.add(lt, ld, ls);
    lambader.position.set(cx - 1.45, 0, z + 0.55);
    this.dunya.add(lambader);

    // Atölyeden bir parça: çöl gri konsol, siyah ayak, üstünde vazo.
    const konsol = new THREE.Group();
    const govde = kutu(1.5, 0.5, 0.42, this.mese); govde.position.y = 0.42;
    for (let i = -1; i <= 1; i++) {
      const cizgi = kutu(0.006, 0.44, 0.004, malzeme('#8f887d'), false); cizgi.position.set(i * 0.25 + 0.25 - 0.25, 0.42, 0.212);
      if (i !== 1) konsol.add(cizgi);
    }
    for (const [ax, az] of [[-0.68, -0.16], [0.68, -0.16], [-0.68, 0.16], [0.68, 0.16]]) {
      const a = kutu(0.03, 0.17, 0.03, this.siyah); a.position.set(ax, 0.085, az); konsol.add(a);
    }
    const vazo = silindir(0.07, 0.05, 0.3, malzeme('#2a2724', { roughness: 0.4 }), 18); vazo.position.set(-0.45, 0.82, 0);
    const dal = silindir(0.006, 0.006, 0.42, malzeme('#6e5a43'), 6); dal.position.set(-0.44, 1.12, 0); dal.rotation.z = 0.15;
    const maket = kutu(0.26, 0.2, 0.16, malzeme('#f1ebe1', { roughness: 0.35 })); maket.position.set(0.35, 0.77, 0);
    konsol.add(govde, vazo, dal, maket);
    konsol.rotation.y = Math.PI / 2;
    konsol.position.set(x + 0.32, 0, Math.min(z + d - 1.0, cz + 0.6));
    this.dunya.add(konsol);

    const bitki = this._bitki(1.45, '#2a2724');
    bitki.position.set(x + g - 0.45, 0, z + 0.45);
    this.dunya.add(bitki);

    this._kahveKosesi(x, z, g, d, cx, satir);

    // Görev kutusu: doğrudan verilen görevler buradan çıkar.
    const posta = new THREE.Group();
    const direk = kutu(0.06, 0.9, 0.06, this.siyah); direk.position.y = 0.45;
    const kutuG = kutu(0.44, 0.3, 0.32, this.siyah); kutuG.position.y = 1.05;
    const cati = kutu(0.48, 0.035, 0.36, this.mese); cati.position.y = 1.22;
    const yarik = kutu(0.28, 0.02, 0.02, malzeme('#cbaf8b', { emissive: '#cbaf8b', emissiveIntensity: 0.25 }), false); yarik.position.set(0, 1.12, 0.162);
    posta.add(direk, kutuG, cati, yarik);
    const px = x + g - 0.55, pz = z + d - 0.5;
    posta.position.set(px, 0, pz);
    this.dunya.add(posta);
    this.postaCapa = new THREE.Object3D();
    this.postaCapa.position.set(px, 1.3, pz);
    this.dunya.add(this.postaCapa);
    this.posta = { x: px, z: pz, satir };
  }

  // ---------- Yatakhane (yan bina) ----------

  // Alçak bölme duvarı (eksene paralel): sıva, üstünde antrasit başlık. Odaların içi yukarıdan görünür.
  _bolme(x1, z1, x2, z2, yuk = YAT.bolmeY) {
    const uz = x2 - x1 + z2 - z1; // hep x1<=x2, z1<=z2 ve tek eksende
    if (uz < 0.02) return;
    const yatay = Math.abs(z2 - z1) < 1e-6, D = 0.08;
    const d = kutu(yatay ? uz : D, yuk, yatay ? D : uz, this._renk('#e7e4df', { roughness: 0.9 }));
    d.position.set((x1 + x2) / 2, yuk / 2, (z1 + z2) / 2);
    const b = kutu(yatay ? uz + 0.02 : D + 0.02, 0.03, yatay ? D + 0.02 : uz + 0.02, this.ceviz, false);
    b.position.set((x1 + x2) / 2, yuk + 0.015, (z1 + z2) / 2);
    this.dunya.add(d, b);
  }

  // Ofisin doğusunda yatakhane: kuzey ve batı duvarı tam boy, odalar alçak bölmeli (maket gibi içi görünür).
  // Odalar ortadaki koridorun iki yanında (ya da tek sırada); girişi öndeki holden.
  _yatakhane(x0, yd, W, Dd, sakinler) {
    const T = 0.16, { sutun, sira } = yd, { odaEn, odaBoy, koridor, hol } = YAT;
    const kx = x0 + odaBoy + koridor / 2, odalarZ = sira * odaEn;
    this.yatakhane = { x0, W, Dd, kx, onZ: Dd + 0.45, holZ: odalarZ + hol / 2 };

    // Taban: maket gibi kalın, üstü beton; koridorda füme yolluk.
    const beton = betonDokusu();
    beton.repeat.set((W + T) / 5, (Dd + T) / 5);
    const ust = malzeme('#ffffff', { map: beton, roughness: 0.85 }), yan = malzeme('#2a2724', { roughness: 0.7 });
    const zemin = new THREE.Mesh(new THREE.BoxGeometry(W + T, 0.3, Dd + T), [yan, yan, ust, yan, yan, yan]);
    zemin.position.set(x0 + W / 2 - T / 2, -0.15, Dd / 2 - T / 2);
    zemin.receiveShadow = true;
    const yolluk = kutu(koridor - 0.5, 0.01, odalarZ - 0.4, this._renk('#545556', { roughness: 1 }), false);
    yolluk.position.set(kx, 0.006, odalarZ / 2 + 0.1);
    this.dunya.add(zemin, yolluk);
    for (const s of [-1, 1]) {
      const cizgi = kutu(0.03, 0.012, odalarZ - 0.5, this._renk('#cbaf8b', { roughness: 0.5 }), false);
      cizgi.position.set(kx + s * (koridor / 2 - 0.36), 0.008, odalarZ / 2 + 0.1);
      this.dunya.add(cizgi);
    }

    // Kuzey ve batı duvarı: sıcak beyaz sıva, antrasit süpürgelik ve başlık, korniş altında gizli LED.
    const duvarM = this._renk('#ebe8e3', { roughness: 0.92 });
    const kuzey = kutu(W + T, DUVAR_Y, T, duvarM); kuzey.position.set(x0 + W / 2 - T / 2, DUVAR_Y / 2, -T / 2);
    const bati = kutu(T, DUVAR_Y, Dd, duvarM); bati.position.set(x0 - T / 2, DUVAR_Y / 2, Dd / 2);
    const s1 = kutu(W, 0.09, 0.022, this.ceviz, false); s1.position.set(x0 + W / 2, 0.045, 0.011);
    const s2 = kutu(0.022, 0.09, Dd, this.ceviz, false); s2.position.set(x0 + 0.011, 0.045, Dd / 2);
    const b1 = kutu(W + T, 0.035, T + 0.02, this.ceviz, false); b1.position.set(x0 + W / 2 - T / 2, DUVAR_Y + 0.017, -T / 2 + 0.01);
    const b2 = kutu(T + 0.02, 0.035, Dd, this.ceviz, false); b2.position.set(x0 - T / 2 + 0.01, DUVAR_Y + 0.017, Dd / 2);
    this.dunya.add(kuzey, bati, s1, s2, b1, b2);
    const ki = this._duvarIsigi(W); ki.position.set(x0 + W / 2, 0, 0);
    const bi = this._duvarIsigi(Dd); bi.position.set(x0, 0, Dd / 2); bi.rotation.y = Math.PI / 2;
    this.dunya.add(ki, bi);
    this._pencere(kx, 0.01, false, 0.8, 1.9, 1.4); // koridorun sonunda boy pencere

    // Oda bölmeleri: odalar arası ve koridor tarafı (kapı boşluklu); doğu kenarı ve ön alçak.
    for (let c = 0; c < sutun; c++) {
      const xa = c ? x0 + odaBoy + koridor : x0, xb = xa + odaBoy, kapiX = c ? xa : xb;
      for (let r = 1; r <= sira; r++) this._bolme(xa, r * odaEn, xb, r * odaEn);
      for (let r = 0; r < sira; r++) {
        this._bolme(kapiX, r * odaEn, kapiX, r * odaEn + 1.25);
        this._bolme(kapiX, r * odaEn + 2.1, kapiX, (r + 1) * odaEn);
      }
    }
    const kg = koridor / 2; // giriş boşluğu koridor genişliğinde
    this._bolme(x0 + W, 0, x0 + W, Dd);
    this._bolme(x0, Dd, kx - kg, Dd);
    this._bolme(kx + kg, Dd, x0 + W, Dd);

    // Girişte levha (ön duvarda, kameraya bakar), paspas, ayakkabılık ve bitki.
    const levhaM = new THREE.MeshStandardMaterial({ map: levhaDokusu('YATAKHANE', 768), roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.15 });
    levhaM.emissiveMap = levhaM.map;
    this.ledler.push({ tur: 'isik', m: levhaM, gunduz: 0.15, gece: 0.7 });
    const lx = (x0 + kx - kg) / 2, lg = Math.min(1.2, kx - kg - x0 - 0.3);
    const levha = new THREE.Mesh(new THREE.PlaneGeometry(lg, lg / 6), levhaM);
    levha.position.set(lx, 0.6, Dd + 0.046);
    const levhaArka = kutu(lg + 0.04, lg / 6 + 0.04, 0.012, this.siyah, false); levhaArka.position.set(lx, 0.6, Dd + 0.04);
    const paspas = kutu(1.0, 0.012, 0.6, this._renk('#2f3033', { roughness: 1 }), false); paspas.position.set(kx, 0.006, Dd - 0.42);
    const ayakkabilik = kutu(0.36, 0.5, 1.0, this.ceviz); ayakkabilik.position.set(x0 + 0.2, 0.25, odalarZ + hol / 2);
    const aUst = kutu(0.38, 0.025, 1.02, this.mese, false); aUst.position.set(x0 + 0.2, 0.512, odalarZ + hol / 2);
    const bitki = this._bitki(0.9, '#2a2724'); bitki.position.set(x0 + W - 0.35, 0, Dd - 0.35);
    this.dunya.add(levhaArka, levha, paspas, ayakkabilik, aUst, bitki);
    const capa = new THREE.Object3D(); capa.position.set(x0 + 0.45, 0.02, odalarZ + 0.25); // levhanın üstünde kalsın
    this.dunya.add(capa);
    this.odaEtiketleri.push({ ad: 'Yatakhane', renk: '#cbaf8b', capa });

    // Odalar: önce kuzey, soldan sağa. Her sakinin nevresimi kendi renginde.
    this._parke ||= parkeDokusu();
    for (let i = 0; i < sira * sutun; i++) {
      const r = Math.floor(i / sutun), c = i % sutun;
      const cx = c ? x0 + odaBoy + koridor + odaBoy / 2 : x0 + odaBoy / 2, cz = r * odaEn + odaEn / 2;
      const kisi = sakinler[i], m = kisi && this.masalar.get(kisi.id);
      const oda = this._yatakOdasi(cx, cz, c ? -1 : 1, m ? RENKLER[this.calisanlar.indexOf(kisi) % RENKLER.length] : '#8d8e91');
      if (c === 0) this._pencere(x0 + 0.01, cz, true, 0.9, 0.9, 1.85);
      if (r === 0) this._pencere(cx, 0.01, false, 0.9, 0.9, 1.85);
      if (m) { oda.m = m; m.oda = oda; }
      this.odalar.push(oda);
    }
  }

  // Yatak odası. Yerel u: dış duvardan koridora, v: kuzeyden güneye. s=-1 doğudaki odalar (aynalı).
  // Yatağın başı dış duvarda, kapı koridor tarafında; komodinde abajur, karşıda şifonyer, yerde halı.
  _yatakOdasi(cx, cz, s, renk) {
    const { odaEn, odaBoy, koridor } = YAT;
    const p = this._parke.clone();
    p.repeat.set(odaBoy / 4, odaEn / 4);
    p.needsUpdate = true;
    const zemin = new THREE.Mesh(new THREE.PlaneGeometry(odaBoy, odaEn), malzeme('#ffffff', { map: p, roughness: 0.6 }));
    zemin.rotation.x = -Math.PI / 2;
    zemin.position.set(cx, 0.006, cz);
    zemin.receiveShadow = true;
    this.dunya.add(zemin);
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.scale.x = s;
    this.dunya.add(g);

    // Yatak: antrasit baza, beyaz şilte, kumaş başlık, yastık.
    const baza = kutu(2.0, 0.29, 1.02, this.ceviz); baza.position.set(-0.22, 0.165, -0.5);
    const silte = kutu(1.96, 0.15, 0.98, this.beyaz); silte.position.set(-0.22, 0.385, -0.5);
    const baslik = kutu(0.08, 1.0, 1.14, this._renk('#8f8b85', { roughness: 0.95 })); baslik.position.set(-1.26, 0.5, -0.5);
    const yastik = kutu(0.34, 0.1, 0.64, this.beyaz); yastik.position.set(-1.0, 0.51, -0.5); yastik.rotation.z = 0.12;
    g.add(baza, silte, baslik, yastik);
    // Yorgan sakinin renginde, baş tarafında beyaz çarşaf kıvrımı. Biri yatınca kabarır ve üstünü örter.
    const yorgan = new THREE.Group();
    yorgan.position.y = 0.46;
    const ana = kutu(1.4, 1, 1.06, malzeme(new THREE.Color(renk).lerp(new THREE.Color('#ffffff'), 0.2), { roughness: 0.92 }));
    ana.position.set(0.08, 0.5, -0.5);
    const kivrim = kutu(0.16, 1.02, 1.07, this.beyaz, false); kivrim.position.set(-0.6, 0.5, -0.5);
    yorgan.add(ana, kivrim);
    g.add(yorgan);
    const yor = this._acilir(v => { yorgan.scale.y = 0.05 + 0.25 * v; });
    yor.uygula(0);

    // Komodin ve abajur: gece sakini odaya girince yanar, uyuyunca söner.
    const komodin = kutu(0.4, 0.46, 0.42, this.ceviz); komodin.position.set(-1.0, 0.23, 0.3);
    const kUst = kutu(0.42, 0.025, 0.44, this.mese, false); kUst.position.set(-1.0, 0.472, 0.3);
    const kulp = kutu(0.012, 0.02, 0.14, this._kulpM, false); kulp.position.set(-0.795, 0.33, 0.3);
    const lambaM = new THREE.MeshStandardMaterial({ color: '#efe6d6', emissive: '#ffc77a', emissiveIntensity: 0, roughness: 0.7 });
    const ayak = silindir(0.05, 0.06, 0.03, this.siyah, 14); ayak.position.set(-1.0, 0.5, 0.3);
    const govde = silindir(0.012, 0.012, 0.16, this._kulpM, 8); govde.position.set(-1.0, 0.59, 0.3);
    const abajur = silindir(0.075, 0.105, 0.15, lambaM, 18); abajur.position.set(-1.0, 0.73, 0.3);
    this._haleDoku ||= isikDokusu('hale');
    const haleM = new THREE.SpriteMaterial({ map: this._haleDoku, color: '#ffcf8a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const hale = new THREE.Sprite(haleM); hale.scale.set(1.5, 1.5, 1); hale.position.set(-1.0, 0.73, 0.3);
    const yerM = new THREE.MeshBasicMaterial({ map: this._haleDoku, color: '#ffcf8a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const yer = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), yerM); yer.rotation.x = -Math.PI / 2; yer.position.set(-0.8, 0.012, 0.1);
    g.add(komodin, kUst, kulp, ayak, govde, abajur, hale, yer);

    // Şifonyer: üç çekmece, altın düğmeler; üstünde küçük bitki ve kitaplar. Yerde füme halı.
    const sifonyer = kutu(0.8, 0.76, 0.42, this.ceviz); sifonyer.position.set(-0.8, 0.38, 0.9);
    const sUst = kutu(0.82, 0.025, 0.44, this.mese, false); sUst.position.set(-0.8, 0.772, 0.9);
    g.add(sifonyer, sUst);
    for (const y of [0.27, 0.51]) { const c = kutu(0.76, 0.01, 0.006, this._renk('#1f2022'), false); c.position.set(-0.8, y, 0.687); g.add(c); }
    for (const y of [0.15, 0.39, 0.63]) { const d = kutu(0.05, 0.02, 0.012, this._kulpM, false); d.position.set(-0.8, y, 0.683); g.add(d); }
    const sus = this._bitki(0.33); sus.position.set(-0.6, 0.785, 0.92);
    const kitap = kutu(0.2, 0.04, 0.14, this._renk('#cbaf8b', { roughness: 0.6 })); kitap.position.set(-1.0, 0.805, 0.92);
    const hali = kutu(1.15, 0.008, 0.7, this._renk('#545556', { roughness: 1 }), false); hali.position.set(-0.05, 0.01, 0.5);
    g.add(sus, kitap, hali);

    const capa = new THREE.Object3D(); capa.position.set(-0.2, 1.0, -0.5); g.add(capa); // uyurken etiket yatağın üstünde
    const w = (u, v) => [cx + s * u, cz + v];
    return {
      yorgan: yor, lambaM, haleM, yerM, isik: 0, capa, m: null,
      yol: [w(odaBoy / 2 + koridor / 2, 0.52), w(odaBoy / 2, 0.52), w(0.9, 0.52), w(-0.15, 0.42)], // koridordan yatak kenarına
      oturma: w(-0.15, -0.06), yatPelvis: w(-0.2, -0.5),
      yatis: { x: cx + s * 0.7, z: cz - 0.5, yon: s * Math.PI / 2 }, // ayak ucu; baş dış duvara bakar
    };
  }

  // İki bina arası bahçe: çim, taş yollar, alçak bahçe lambaları ve çalılar.
  _avlu(G, TG, TD) {
    const T = 0.16, ax = this._avluX, Y = this.yatakhane;
    const cim = cimDokusu();
    cim.repeat.set((TG + T) / 3, (TD + T) / 3);
    const yan = malzeme('#2a2724', { roughness: 0.7 }), ust = malzeme('#ffffff', { map: cim, roughness: 0.95 });
    const taban = new THREE.Mesh(new THREE.BoxGeometry(TG + T - 0.02, 0.27, TD + T - 0.015), [yan, yan, ust, yan, yan, yan]);
    taban.position.set((TG - T) / 2, -0.155, (TD - T) / 2 - 0.0025);
    taban.receiveShadow = true;
    this.dunya.add(taban);

    const tas = tasDokusu();
    const plaka = (x1, z1, x2, z2, y) => {
      const t = tas.clone();
      t.repeat.set(x2 - x1, z2 - z1);
      t.needsUpdate = true;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), malzeme('#ffffff', { map: t, roughness: 0.85 }));
      p.rotation.x = -Math.PI / 2;
      p.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      p.receiveShadow = true;
      this.dunya.add(p);
    };
    const sonZ = Math.max(Y.onZ + 0.45, ...this._koridorZ.map(z => z + 0.55));
    plaka(ax - 0.6, 0.25, ax + 0.6, sonZ, -0.012);
    plaka(ax + 0.6, Y.onZ - 0.45, Y.kx + 0.6, Y.onZ + 0.45, -0.011);
    for (const z of this._koridorZ) plaka(G, z - 0.55, ax - 0.6, z + 0.55, -0.011);

    // Bahçe lambaları yolun doğusunda; geceleri yere sıcak ışık vurur. Çalılar batı şeritte.
    const yollar = [...this._koridorZ, Y.onZ];
    const bos = z => yollar.every(y => Math.abs(y - z) > 1.0);
    this._haleDoku ||= isikDokusu('hale');
    const basM = this._ledM(0.25, 2.6), haleM = this._parilti(this._haleDoku, '#ffd29a', 0, 0.55);
    for (let z = 1.3; z < sonZ - 0.8; z += 4.2) {
      if (!bos(z)) continue;
      const x = ax + 0.9;
      const ayak = silindir(0.045, 0.055, 0.62, this.ceviz, 12); ayak.position.set(x, 0.29, z);
      const bas = silindir(0.065, 0.065, 0.1, basM, 16); bas.position.set(x, 0.65, z);
      const kapak = silindir(0.08, 0.08, 0.025, this.ceviz, 16); kapak.position.set(x, 0.712, z);
      const hale = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), haleM); hale.rotation.x = -Math.PI / 2; hale.position.set(x, -0.006, z);
      this.dunya.add(ayak, bas, kapak, hale);
    }
    const caliM = [this._renk('#4d6b45', { roughness: 0.9, flatShading: true }), this._renk('#5f7f55', { roughness: 0.9, flatShading: true })];
    const caliG = new THREE.IcosahedronGeometry(0.3, 1);
    for (let z = 0.9; z < sonZ - 0.4; z += 1.6) {
      if (!bos(z)) continue;
      for (let i = 0; i < 3; i++) {
        const k = new THREE.Mesh(caliG, caliM[i % 2]);
        const o = 0.78 - i * 0.12;
        k.scale.set(o, o * 0.78, o);
        k.position.set(G + 0.45 + (i - 1) * 0.16, 0.1 + (i % 2) * 0.06, z + ((i * 7) % 3 - 1) * 0.14);
        k.castShadow = true;
        this.dunya.add(k);
      }
    }
  }

  _renk(renk, ek = {}) {
    const anahtar = renk + JSON.stringify(ek);
    this._renkler ||= new Map();
    if (!this._renkler.has(anahtar)) this._renkler.set(anahtar, malzeme(renk, ek));
    return this._renkler.get(anahtar);
  }

  // Açılıp kapanan parça: acik 0 (kapalı) ile 1 (açık) arasında yumuşakça ilerler (_mekanizmalar).
  _acilir(uygula, ek = {}) {
    const a = { acik: 0, hedef: 0, uygula, ...ek };
    this.acilirlar.push(a);
    return a;
  }

  // Kapaklı alçak dolap: yerel +z ön yüz, iki kapak dışa açılır; içinde raf, klasörler ve kâğıt.
  _kapakliDolap(G, Y, D, { govdeM = this.mese, kapakM = this.mese, ustM = govdeM, ic = 'evrak' } = {}) {
    const g = new THREE.Group();
    const t = 0.022, baza = 0.06, icY = Y - t - baza;
    const icM = this._dolapIcM ||= malzeme('#2a2b2e', { roughness: 0.8 });
    const ust = kutu(G, t, D, ustM); ust.position.y = Y - t / 2;
    const alt = kutu(G - 2 * t, t, D - 0.02, govdeM, false); alt.position.set(0, baza + t / 2, -0.01);
    const sol = kutu(t, icY, D, govdeM); sol.position.set(-G / 2 + t / 2, baza + icY / 2, 0);
    const sag = sol.clone(); sag.position.x = G / 2 - t / 2;
    const arka = kutu(G - 2 * t, icY, 0.012, icM, false); arka.position.set(0, baza + icY / 2, -D / 2 + 0.006);
    const rafY = baza + icY * 0.5;
    const raf = kutu(G - 2 * t, 0.016, D - 0.06, govdeM, false); raf.position.set(0, rafY, -0.02);
    const bazaK = kutu(G - 0.04, baza, D - 0.06, this.siyah, false); bazaK.position.set(0, baza / 2, -0.02);
    g.add(ust, alt, sol, sag, arka, raf, bazaK);
    const ic1 = baza + t, ic2 = rafY + 0.008;
    if (ic === 'evrak') {
      for (let i = 0; i < Math.floor((G - 0.2) / 0.075); i++) {
        const k = kutu(0.065, Math.min(0.22, rafY - ic1 - 0.03), D - 0.14, this._renk(KLASOR_RENK[(i * 3 + 1) % KLASOR_RENK.length], { roughness: 0.6 }), false);
        k.position.set(-G / 2 + 0.1 + i * 0.075, ic1 + k.geometry.parameters.height / 2, -0.03);
        g.add(k);
      }
      const yigin = kutu(0.24, 0.07, D - 0.12, this._renk('#f6f3ec', { roughness: 0.8 }), false); yigin.position.set(-G / 4, ic2 + 0.035, -0.02);
      const kutuK = kutu(0.26, 0.14, D - 0.12, this._renk('#c4a77c', { roughness: 0.9 }), false); kutuK.position.set(G / 4, ic2 + 0.07, -0.02);
      g.add(yigin, kutuK);
    } else if (ic === 'kahve') {
      for (let i = 0; i < 6; i++) {
        const f = silindir(0.04, 0.034, 0.09, this._renk('#f7f5f1', { roughness: 0.35 }), 14);
        f.position.set(-G / 2 + 0.12 + i * 0.1, ic2 + 0.045, -0.05);
        g.add(f);
      }
      for (let i = 0; i < 3; i++) {
        const p = kutu(0.12, 0.2, 0.08, this._renk(['#6b4a31', '#2b2c2f', '#cbaf8b'][i], { roughness: 0.7 }), false);
        p.position.set(G / 2 - 0.16 - i * 0.15, ic1 + 0.1, -0.05);
        g.add(p);
      }
    }
    const kapakY = icY - 0.008, kg = G / 2 - 0.004;
    const menteseler = [];
    for (const sx of [-1, 1]) {
      const m = new THREE.Group();
      m.position.set(sx * G / 2, baza + kapakY / 2 + 0.002, D / 2 + 0.011);
      const p = kutu(kg, kapakY, 0.018, kapakM); p.position.x = -sx * kg / 2;
      const kulp = kutu(0.012, Math.min(0.22, kapakY * 0.45), 0.016, this._kulpM, false);
      kulp.position.set(-sx * (kg - 0.05), 0, 0.018);
      m.add(p, kulp);
      g.add(m);
      menteseler.push([m, sx]);
    }
    const acilir = this._acilir(v => { for (const [m, sx] of menteseler) m.rotation.y = sx * v * 1.75; });
    g.userData.acilir = acilir;
    this.acilirKok.push(g);
    return { grup: g, acilir };
  }

  // Çelik dosya dolabı: dört çekmece; çekmece dışarı kayınca içindeki asılı dosyalar görünür.
  _dosyaDolabi() {
    const g = new THREE.Group();
    const W = 0.5, H = 1.32, D = 0.58, ch = 0.3;
    const govdeM = this._celikM ||= malzeme('#5d5f64', { roughness: 0.5, metalness: 0.2 });
    const onM = this._celikOnM ||= malzeme('#6b6d73', { roughness: 0.45, metalness: 0.2 });
    const icM = this._cekmeceM ||= malzeme('#2c2d30', { roughness: 0.6, metalness: 0.3 });
    const govde = kutu(W, H, D, govdeM); govde.position.y = H / 2;
    g.add(govde);
    const renkler = ['#d9c39a', '#7d9a76', '#6f87a6', '#d9c39a', '#c9a0a0', '#d9c39a', '#8d8e91'];
    const cekmeceler = [];
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Group();
      c.position.y = 0.04 + ch / 2 + i * (ch + 0.01);
      const on = kutu(W - 0.02, ch, 0.02, onM); on.position.z = D / 2 + 0.01;
      const kulp = kutu(0.16, 0.022, 0.025, this._kulpM, false); kulp.position.set(0, 0.06, D / 2 + 0.032);
      const et = kutu(0.08, 0.04, 0.004, this._renk('#f4f1ea'), false); et.position.set(0, -0.03, D / 2 + 0.022);
      const taban = kutu(W - 0.06, 0.012, D - 0.06, icM, false); taban.position.y = -ch / 2 + 0.03;
      const y1 = kutu(0.01, ch - 0.06, D - 0.06, icM, false); y1.position.x = -(W - 0.06) / 2;
      const y2 = y1.clone(); y2.position.x = (W - 0.06) / 2;
      const arka = kutu(W - 0.06, ch - 0.06, 0.01, icM, false); arka.position.z = -(D - 0.06) / 2;
      c.add(on, kulp, et, taban, y1, y2, arka);
      for (let j = 0; j < 7; j++) {
        const f = kutu(W - 0.1, ch - 0.1, 0.006, this._renk(renkler[(j + i) % renkler.length], { roughness: 0.8 }), false);
        f.position.z = -(D - 0.06) / 2 + 0.06 + j * 0.065;
        const sekme = kutu(0.06, 0.03, 0.006, f.material, false); sekme.position.set(-0.14 + ((j * 2) % 5) * 0.07, (ch - 0.1) / 2 + 0.015, f.position.z);
        c.add(f, sekme);
      }
      g.add(c);
      const a = this._acilir(v => { c.position.z = v * 0.42; }, { seviye: i });
      c.userData.acilir = a;
      this.acilirKok.push(c);
      cekmeceler.push(a);
    }
    return { grup: g, cekmeceler };
  }

  // Arşiv rafı: siyah dikmeler, çöl gri raflar; klasörler raflara sonradan dizilir (_arsiv).
  _arsivRafi(G = 1.0, H = 2.0, D = 0.36) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const y = kutu(0.03, H, D, this.siyah); y.position.set(sx * (G / 2 - 0.015), H / 2, 0);
      g.add(y);
    }
    for (let i = 0; i < 6; i++) {
      const r = kutu(G - 0.06, 0.025, D, this.mese); r.position.set(0, 0.04 + i * 0.39, 0);
      g.add(r);
    }
    return g;
  }

  // Dosya-evrak odası: boy camı, kayar kapı, raflarda biriken klasörler, çelik dosya dolapları,
  // köşede arşiv kutuları ve masada kâğıt yığınları. Biten işin dosyası buraya kaldırılır.
  _arsiv(L, satir) {
    const { x, z, g, d } = L;
    this._parke ||= parkeDokusu();
    const p = this._parke.clone();
    p.repeat.set(g / 4, d / 4);
    p.needsUpdate = true;
    const zemin = new THREE.Mesh(new THREE.PlaneGeometry(g, d), malzeme('#d6d3cd', { map: p, roughness: 0.6 }));
    zemin.rotation.x = -Math.PI / 2;
    zemin.position.set(x + g / 2, 0.006, z + d / 2);
    zemin.receiveShadow = true;
    this.dunya.add(zemin);

    // Cam duvarlar ve önde kayar kapı
    const kapiX = x + g / 2, onZ = z + d;
    this._camDuvar(x, z, x + g, z, ARSIV_Y);
    this._camDuvar(x, z, x, onZ, ARSIV_Y);
    this._camDuvar(x + g, z, x + g, onZ, ARSIV_Y);
    this._camDuvar(x, onZ, kapiX - KAPI_G / 2, onZ, ARSIV_Y);
    this._camDuvar(kapiX + KAPI_G / 2, onZ, x + g, onZ, ARSIV_Y);
    for (const [px, pz] of [[x, z], [x + g, z], [x, onZ], [x + g, onZ], [kapiX - KAPI_G / 2, onZ], [kapiX + KAPI_G / 2, onZ]]) {
      const dk = kutu(0.045, ARSIV_Y + 0.02, 0.045, this.aluM);
      dk.position.set(px, (ARSIV_Y + 0.02) / 2, pz);
      this.dunya.add(dk);
    }
    const baslik = kutu(KAPI_G, 0.05, 0.05, this.aluM, false); baslik.position.set(kapiX, ARSIV_Y, onZ);
    this.dunya.add(baslik);
    const kapi = new THREE.Group();
    const kc = new THREE.Mesh(new THREE.PlaneGeometry(KAPI_G, ARSIV_Y - 0.05), this.camM);
    kc.position.y = (ARSIV_Y - 0.05) / 2 + 0.01;
    kc.renderOrder = 2;
    const ks1 = kutu(0.03, ARSIV_Y - 0.03, 0.035, this.aluM, false); ks1.position.set(-KAPI_G / 2, (ARSIV_Y - 0.03) / 2, 0);
    const ks2 = ks1.clone(); ks2.position.x = KAPI_G / 2;
    const ku = kutu(KAPI_G, 0.03, 0.035, this.aluM, false); ku.position.y = ARSIV_Y - 0.03;
    const ka = kutu(KAPI_G, 0.03, 0.035, this.aluM, false); ka.position.y = 0.03;
    const kk = kutu(0.022, 0.5, 0.03, this._kulpM, false); kk.position.set(-KAPI_G / 2 + 0.09, 1.0, 0.04);
    kapi.add(kc, ks1, ks2, ku, ka, kk);
    kapi.position.set(kapiX, 0, onZ + 0.045);
    this.dunya.add(kapi);
    this.kapilar.push({ x: kapiX, z: onZ, acilir: this._acilir(v => { kapi.position.x = kapiX + v * (KAPI_G - 0.04); }) });
    // Kapının üstünde levha
    const levhaM = new THREE.MeshStandardMaterial({ map: levhaDokusu('ARŞİV'), roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.15 });
    levhaM.emissiveMap = levhaM.map;
    this.ledler.push({ tur: 'isik', m: levhaM, gunduz: 0.15, gece: 0.7 });
    const levha = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.165), levhaM);
    levha.position.set(kapiX, ARSIV_Y + 0.15, onZ + 0.02);
    const levhaArka = kutu(0.7, 0.2, 0.025, this.siyah, false); levhaArka.position.set(kapiX, ARSIV_Y + 0.15, onZ + 0.005);
    this.dunya.add(levhaArka, levha);

    // Arka duvar boyunca: raf, iki dosya dolabı, raf
    const rafG = 1.0, dolapG = 0.5, ara = 0.06;
    let ax = x + (g - (rafG * 2 + dolapG * 2 + ara * 3)) / 2;
    const rafZ = z + 0.3, dolapZ = z + 0.41;
    const rafX = [], dolaplar = [];
    const rafKur = () => { const r = this._arsivRafi(rafG); r.position.set(ax + rafG / 2, 0, rafZ); this.dunya.add(r); rafX.push(ax + rafG / 2); ax += rafG + ara; };
    const dolapKur = () => {
      const dd = this._dosyaDolabi(); dd.grup.position.set(ax + dolapG / 2, 0, dolapZ); this.dunya.add(dd.grup);
      dolaplar.push({ x: ax + dolapG / 2, cekmeceler: dd.cekmeceler }); ax += dolapG + ara;
    };
    rafKur(); dolapKur(); dolapKur(); rafKur();

    // Klasör yuvaları: raflar yukarıdan aşağı dolar.
    const yuvalar = [];
    for (const l of [4, 3, 2, 1, 0]) for (const rx of rafX) for (let s = 0; s < 11; s++) yuvalar.push([rx - 0.41 + s * 0.078, 0.04 + l * 0.39 + 0.0125 + 0.155, rafZ + 0.02]);
    const kap = yuvalar.length;
    const klasor = new THREE.InstancedMesh(new THREE.BoxGeometry(0.068, 0.31, 0.27), malzeme('#ffffff', { roughness: 0.55 }), kap);
    const sirt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.044, 0.075, 0.004), malzeme('#f6f3ec', { roughness: 0.7 }), kap);
    const delik = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12), malzeme('#151516'), kap);
    const o = new THREE.Object3D(), mt = new THREE.Matrix4(), renk = new THREE.Color();
    const sirtYer = new THREE.Matrix4().makeTranslation(0, 0.07, 0.137);
    const delikYer = new THREE.Matrix4().makeTranslation(0, -0.08, 0.137).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    let tohum = 7;
    const rast = () => { tohum = (tohum * 16807) % 2147483647; return tohum / 2147483647; };
    yuvalar.forEach(([px, py, pz], i) => {
      o.position.set(px, py, pz);
      o.rotation.set(0, (rast() - 0.5) * 0.06, (rast() - 0.5) * 0.03);
      o.updateMatrix();
      klasor.setMatrixAt(i, o.matrix);
      sirt.setMatrixAt(i, mt.copy(o.matrix).multiply(sirtYer));
      delik.setMatrixAt(i, mt.copy(o.matrix).multiply(delikYer));
      klasor.setColorAt(i, renk.set(KLASOR_RENK[Math.floor(rast() * KLASOR_RENK.length)]));
    });
    for (const im of [klasor, sirt, delik]) { im.count = 0; im.frustumCulled = false; im.castShadow = im === klasor; this.dunya.add(im); }

    // Raflar dolunca: sol önde üst üste arşiv kutuları
    const kutuYer = [];
    for (let k = 0; k < 3; k++) for (const kz of [onZ - 0.45, onZ - 0.8]) for (const kx of [x + 0.4, x + 0.82]) kutuYer.push([kx, 0.135 + k * 0.275, kz]);
    const kutular = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.27, 0.3), malzeme('#c4a77c', { roughness: 0.9 }), kutuYer.length);
    const kutuEt = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.08, 0.004), malzeme('#f6f3ec', { roughness: 0.8 }), kutuYer.length);
    kutuYer.forEach(([px, py, pz], i) => {
      o.position.set(px, py, pz);
      o.rotation.set(0, (rast() - 0.5) * 0.12, 0);
      o.updateMatrix();
      kutular.setMatrixAt(i, o.matrix);
      kutuEt.setMatrixAt(i, mt.copy(o.matrix).multiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0.152)));
    });
    for (const im of [kutular, kutuEt]) { im.count = 0; im.frustumCulled = false; im.castShadow = im === kutular; this.dunya.add(im); }

    // Sağ önde çalışma masası; üstünde kâğıt yığınları (arşiv kutuları da dolunca yükselir)
    const mx = x + g - 0.75, mz = onZ - 1.35, masaY = 0.74;
    const tabla = kutu(1.1, 0.04, 0.55, this.mese); tabla.position.set(mx, masaY - 0.02, mz);
    this.dunya.add(tabla);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const a = kutu(0.035, masaY - 0.04, 0.035, this.siyah); a.position.set(mx + sx * 0.5, (masaY - 0.04) / 2, mz + sz * 0.22);
      this.dunya.add(a);
    }
    const kagit = this._renk('#f7f4ee', { roughness: 0.85 });
    const yiginlar = [[-0.36, 0.05], [-0.08, 0.09], [0.22, 0.03], [0.4, 0.06]].map(([ox, taban], i) => {
      const y = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1, 0.3), kagit);
      y.position.set(mx + ox, masaY, mz + (i % 2 ? 0.06 : -0.05));
      y.rotation.y = (i - 1.5) * 0.08;
      y.castShadow = true;
      y.userData.taban = taban;
      this.dunya.add(y);
      return y;
    });
    const dosyaK = kutu(0.3, 0.02, 0.23, this._renk('#d9c39a', { roughness: 0.7 }), false); dosyaK.position.set(mx - 0.1, masaY + 0.01, mz + 0.14); dosyaK.rotation.y = 0.3;
    this.dunya.add(dosyaK);
    const bitki = this._bitki(0.9, '#2a2724');
    bitki.position.set(x + g - 0.35, 0, onZ - 0.4);
    this.dunya.add(bitki);

    this.arsiv = { satir, kapiX, icZ: onZ - 0.7, durZ: z + 1.35, dolaplar, sira: 0,
      klasor, sirt, delik, kap, kutular, kutuEt, kutuKap: kutuYer.length, yiginlar, masaY };
    this._dosyaGuncelle();
  }

  // Arşivdeki dosya sayısını raflara, kutulara ve kâğıt yığınlarına yansıtır.
  _dosyaGuncelle() {
    const A = this.arsiv;
    if (!A) return;
    const n = Math.max(0, Math.floor(this.dosya));
    A.klasor.count = A.sirt.count = A.delik.count = Math.min(n, A.kap);
    A.kutular.count = A.kutuEt.count = Math.min(Math.max(0, n - A.kap), A.kutuKap);
    const fazla = Math.max(0, n - A.kap - A.kutuKap);
    A.yiginlar.forEach((y, i) => {
      const h = y.userData.taban + Math.min(0.26, fazla * 0.008 * (1 + (i % 2) * 0.6));
      y.scale.y = h;
      y.position.y = A.masaY + h / 2;
    });
  }

  _arsivle() {
    this.dosya++;
    this.arsivYolda = Math.max(0, this.arsivYolda - 1);
    this._dosyaGuncelle();
  }

  // Kahve ve çay köşesi: sağ kenarda kapaklı tezgah; üstünde kahve makinesi, çaydanlık ve ince belli bardaklar.
  // Boştaki çalışan buradan kahvesini alır, kanepede oturup içer.
  _kahveKosesi(x, z, g, d, cx, satir) {
    const L = 1.4, D = 0.56, Y = 0.88;
    const tx = x + g - 0.33, tz = Math.min(z + 2.1, z + d - 1.6);
    const tezgah = this._kapakliDolap(L, Y, D, { govdeM: this.ceviz, kapakM: this.mese, ustM: this._renk('#e8e6e2', { roughness: 0.35 }), ic: 'kahve' });
    const T = tezgah.grup;
    T.position.set(tx, 0, tz);
    T.rotation.y = -Math.PI / 2; // ön yüzü odaya (-x) bakar
    this.dunya.add(T);
    const ust = Y + 0.002;
    const krom = this._renk('#c9ccd1', { metalness: 0.9, roughness: 0.22 });
    const celik = this._renk('#c3c6ca', { metalness: 0.85, roughness: 0.25 });
    const beyaz = this._renk('#f7f5f1', { roughness: 0.35 });
    // Kahve makinesi
    const mk = -0.4;
    const govde = kutu(0.3, 0.36, 0.34, this._renk('#2b2c30', { metalness: 0.6, roughness: 0.35 })); govde.position.set(mk, ust + 0.2, -0.06);
    const isitici = kutu(0.3, 0.02, 0.34, krom, false); isitici.position.set(mk, ust + 0.39, -0.06);
    const panel = kutu(0.26, 0.11, 0.01, krom, false); panel.position.set(mk, ust + 0.3, 0.115);
    const ekranM = new THREE.MeshStandardMaterial({ color: '#0f1a14', emissive: '#7fd0a0', emissiveIntensity: 0.35, roughness: 0.3 });
    const ekran = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.006), ekranM); ekran.position.set(mk, ust + 0.31, 0.122);
    const bas = silindir(0.03, 0.03, 0.05, krom, 14); bas.position.set(mk, ust + 0.19, 0.14);
    const tepsi = kutu(0.22, 0.02, 0.1, krom, false); tepsi.position.set(mk, ust + 0.01, 0.15);
    const fincan = silindir(0.034, 0.028, 0.07, beyaz, 14); fincan.position.set(mk, ust + 0.055, 0.15);
    T.add(govde, isitici, panel, ekran, bas, tepsi, fincan);
    for (let i = 0; i < 3; i++) {
      const f = silindir(0.034, 0.028, 0.07, beyaz, 14); f.position.set(mk + 0.24, ust + 0.035 + i * 0.05, -0.12);
      T.add(f);
    }
    // Çaydanlık: ocak, alt demlik, üst demlik
    const cy = 0.08;
    const ocak = silindir(0.12, 0.12, 0.03, this.siyah, 24); ocak.position.set(cy, ust + 0.015, -0.02);
    const kirmizi = kutu(0.02, 0.012, 0.006, this._renk('#ff4b3a', { emissive: '#ff4b3a', emissiveIntensity: 1.2 }), false); kirmizi.position.set(cy, ust + 0.02, 0.1);
    const altD = silindir(0.1, 0.11, 0.17, celik, 24); altD.position.set(cy, ust + 0.03 + 0.085, -0.02);
    const ustD = silindir(0.062, 0.07, 0.11, celik, 20); ustD.position.set(cy, ust + 0.2 + 0.055, -0.02);
    const kapak = silindir(0.03, 0.045, 0.025, celik, 16); kapak.position.set(cy, ust + 0.322, -0.02);
    const tepe = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), this.siyah); tepe.position.set(cy, ust + 0.342, -0.02);
    const emzik = silindir(0.008, 0.014, 0.09, celik, 8); emzik.position.set(cy + 0.085, ust + 0.27, -0.02); emzik.rotation.z = -0.9;
    const sap = kutu(0.018, 0.1, 0.02, this.siyah, false); sap.position.set(cy - 0.12, ust + 0.13, -0.02);
    T.add(ocak, kirmizi, altD, ustD, kapak, tepe, emzik, sap);
    // Tepside ince belli çay bardakları
    const tb = 0.45;
    const tepsiC = silindir(0.16, 0.16, 0.012, this._kulpM, 32); tepsiC.position.set(tb, ust + 0.006, 0.02);
    T.add(tepsiC);
    const cayM = this._cayM ||= new THREE.MeshStandardMaterial({ color: '#8a2f0e', transparent: true, opacity: 0.88, roughness: 0.1 });
    [[-0.07, -0.06], [0.07, -0.06], [-0.07, 0.07], [0.07, 0.07]].forEach(([ox, oz]) => {
      const tabak = silindir(0.036, 0.036, 0.005, beyaz, 16); tabak.position.set(tb + ox, ust + 0.015, 0.02 + oz);
      const bardak = silindir(0.021, 0.016, 0.068, cayM, 12); bardak.position.set(tb + ox, ust + 0.052, 0.02 + oz);
      T.add(tabak, bardak);
    });
    // Buhar: makinede kahve yapılırken, çaydanlıkta hep hafif
    const buhar = [];
    const buharYap = (bx, by, bz, cay) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      b.position.set(bx, by, bz);
      b.userData = { y: by, cay };
      b.visible = false;
      T.add(b);
      buhar.push(b);
    };
    for (let i = 0; i < 3; i++) buharYap(mk, ust + 0.11, 0.15, false);
    for (let i = 0; i < 3; i++) buharYap(cy + 0.13, ust + 0.32, -0.02, true);

    const sx = tx - D / 2 - 0.42; // tezgahın önünde durulan yer
    this.kahve = {
      satir, ekranM, buhar, aktif: 0, dolu: [null, null],
      yerler: [[sx, tz - 0.35], [sx, tz + 0.35]],
      koltuklar: [[cx + 0.5, z + 1.25], [cx - 0.5, z + 1.25]],
      yanlar: [cx + 0.95, cx - 0.95], onZ: z + 1.6, oturZ: z + 0.8,
    };
  }

  // Elde taşınan dosya klasörü.
  _klasorYap() {
    const g = new THREE.Group();
    const k = kutu(0.3, 0.02, 0.23, malzeme('#d9c39a', { roughness: 0.7 }));
    const a = kutu(0.27, 0.012, 0.2, malzeme('#fbf8f1', { roughness: 0.8 }), false); a.position.set(0.01, 0.014, 0.01);
    g.add(k, a);
    return g;
  }

  _fincanAl(m) {
    const g = new THREE.Group();
    const fM = malzeme('#f7f5f1', { roughness: 0.35 });
    const f = silindir(0.034, 0.028, 0.075, fM, 16);
    const k = silindir(0.03, 0.03, 0.004, malzeme('#4a2c1a', { roughness: 0.3 }), 16); k.position.y = 0.035;
    const kulp = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 6, 12), fM); kulp.position.x = 0.036;
    g.add(f, k, kulp);
    g.position.set(0, -0.07, 0.03);
    m.k.elR.add(g);
    return g;
  }

  // Etiketin köşesinde birkaç saniyelik duygu baloncuğu.
  _duygu(m, e, sure = 3) {
    if (!m?.duyguEl || !e) return;
    m.duyguEl.textContent = e;
    m.duyguEl.classList.add('acik');
    m.duyguBitis = this.saat.elapsedTime + sure;
  }

  _isiklar() {
    const { G, D } = this._tum;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#cdbfae', 1.05);
    this.ortam = new THREE.AmbientLight('#ffffff', 0.35);
    this.gunes = new THREE.DirectionalLight('#fff4e6', 2.0);
    this.gunes.position.set(-G * 0.3, 18, D * 0.55);
    this.gunes.castShadow = true;
    const s = Math.hypot(G, D) / 2 + 1.5;
    Object.assign(this.gunes.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 70 });
    this.gunes.shadow.mapSize.set(2048, 2048);
    this.gunes.shadow.bias = -0.0004;
    this.gunes.shadow.normalBias = 0.02;
    this.sahne.add(this.hemi, this.ortam, this.gunes);
  }

  // Varsayılan bakış ve ofisin ekrandaki kapsamı.
  _kameraSifirla() {
    const yon = new THREE.Vector3().setFromSphericalCoords(1, POLAR, AZ);
    const ileri = yon.clone().negate();
    const sag = new THREE.Vector3().crossVectors(ileri, new THREE.Vector3(0, 1, 0)).normalize();
    const ust = new THREE.Vector3().crossVectors(sag, ileri);
    const { minX, maxX, minZ, maxZ } = this._tum;
    const o = this.dunya.position, p = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const x of [minX - 0.2, maxX]) for (const y of [-0.3, DUVAR_Y]) for (const z of [minZ - 0.2, maxZ]) {
      p.set(x + o.x, y, z + o.z);
      const a = p.dot(sag), b = p.dot(ust);
      x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b);
    }
    this._kapsam = { g: x1 - x0, y: y1 - y0 };
    this._merkez = sag.multiplyScalar((x0 + x1) / 2).addScaledVector(ust, (y0 + y1) / 2);
    this._panSiniri = Math.max(this._tum.G, this._tum.D) * 0.4;
    this.kontrol.target.copy(this._merkez);
    this.kamera.position.copy(this._merkez).addScaledVector(yon, 80);
    this.kamera.zoom = 1;
    this._uydur();
    this.kontrol.update();
  }

  _uydur() {
    const W = this.kap.clientWidth || 1, H = this.kap.clientHeight || 1, oran = W / H;
    const { g, y } = this._kapsam;
    const yari = Math.max(y / 2, g / 2 / oran) * 1.04 + 0.2;
    Object.assign(this.kamera, { left: -yari * oran, right: yari * oran, top: yari, bottom: -yari });
    this.kamera.updateProjectionMatrix();
  }

  // ---------- Etiketler ----------

  _etiketKatmani() {
    this.katman = document.createElement('div');
    this.katman.className = 'ofis3d-etiketler';
    this.kap.appendChild(this.katman);
    for (const o of this.odaEtiketleri) {
      o.el = document.createElement('div');
      o.el.className = 'ofis3d-oda';
      o.el.style.setProperty('--oda-renk', o.renk);
      o.el.textContent = o.ad;
      this.katman.appendChild(o.el);
    }
    for (const m of this.masalar.values()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ofis3d-etiket';
      b.dataset.durum = 'bosta';
      b.title = `${m.c.rol}: görev vermek için tıkla`;
      b.innerHTML = '<b></b><span hidden></span><i class="duygu" aria-hidden="true"></i>';
      b.querySelector('b').textContent = m.c.kisa || m.c.rol;
      m.duyguEl = b.querySelector('.duygu');
      b.addEventListener('click', () => this.ayar.secildi?.(m.id));
      this.katman.appendChild(b);
      m.etiket = b;
    }
    const lejant = document.createElement('div');
    lejant.className = 'ofis3d-lejant';
    lejant.innerHTML = [['#b8ab98', 'Boşta'], ['#f2b33d', 'Düşünüyor'], ['#4da3ff', 'Çalışıyor'], ['#4cc26a', 'Bitti'], ['#ef5b4c', 'Hata']]
      .map(([r, y]) => `<span><i style="background:${r}"></i>${y}</span>`).join('');
    this.kap.appendChild(lejant);
    this.lejant = lejant;
    const ipucu = document.createElement('div');
    ipucu.className = 'ofis3d-ipucu';
    ipucu.textContent = 'Sürükle: döndür · Sağ tık: kaydır · Tekerlek: yakınlaş · Çift tık: sıfırla';
    this.kap.appendChild(ipucu);
    this.ipucu = ipucu;
  }

  // Etiketleri yerleştirir; üst üste binen etiketi yukarı kaydırır.
  // Ofis ekranda küçükse (dar pencere) oda adları gizlenir, sığmayan boştaki etiket saklanır.
  _etiketleriYerlestir() {
    const W = this.kap.clientWidth, H = this.kap.clientHeight, v = this._v;
    const kompakt = H / (this.kamera.top - this.kamera.bottom) * this.kamera.zoom < 30;
    if (kompakt !== this._kompakt) {
      this._kompakt = kompakt;
      this.katman.dataset.kompakt = kompakt ? '1' : '';
      for (const m of this.masalar.values()) m.w = 0;
    }
    const yansit = capa => {
      capa.getWorldPosition(v);
      v.project(this.kamera);
      if (v.z > 1 || v.z < -1) return null;
      return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
    };
    const kutular = [];
    for (const o of this.odaEtiketleri) {
      const p = kompakt ? null : yansit(o.capa);
      if (!p) { o.el.style.display = 'none'; continue; }
      o.el.style.display = '';
      if (!o.w) { o.w = o.el.offsetWidth; o.h = o.el.offsetHeight; }
      const x0 = Math.min(Math.max(p[0], 4), W - o.w - 4), y0 = p[1] - o.h / 2;
      o.el.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`;
      kutular.push([x0, y0, x0 + o.w, y0 + o.h]);
    }
    const liste = [];
    for (const m of this.masalar.values()) {
      const p = yansit(m.yatakta && m.oda ? m.oda.capa : m.capa);
      if (!p) { m.etiket.style.display = 'none'; continue; }
      m.etiket.style.display = '';
      if (!m.w) { m.w = m.etiket.offsetWidth; m.h = m.etiket.offsetHeight; }
      liste.push({ m, x: p[0], y: p[1] });
    }
    // Önce iş yapanlar yerleşir, sonra öndekiler (ekranda alttakiler).
    const oncelik = m => (AKTIVITE_GOSTER.has(m.durum) || m.duyguBitis ? 1 : 0);
    liste.sort((a, b) => oncelik(b.m) - oncelik(a.m) || b.y - a.y);
    for (const e of liste) {
      const { w, h } = e.m;
      const bx = Math.min(Math.max(e.x - w / 2, 4), W - w - 4);
      const by = e.y - h;
      // Çakışırsa üstüne, soluna ya da sağına dene; başına en yakın boş yeri seç.
      const cakisan = (x, y) => kutular.find(k => x < k[2] + 3 && x + w > k[0] - 3 && y < k[3] + 3 && y + h > k[1] - 3);
      const kuyruk = [[bx, by]];
      let en = null;
      for (let tur = 0; kuyruk.length && tur < 48; tur++) {
        const [x, y] = kuyruk.shift();
        const c = cakisan(x, y);
        const uzak = Math.hypot(x - bx, y - by);
        if (!c) { if (!en || uzak < en.uzak) en = { x, y, uzak }; continue; }
        if (en && uzak >= en.uzak) continue;
        kuyruk.push([x, c[1] - 4 - h]);
        if (c[0] - 4 - w >= 4) kuyruk.push([c[0] - 4 - w, y]);
        if (c[2] + 4 + w <= W - 4) kuyruk.push([c[2] + 4, y]);
      }
      const sakla = !en || (!oncelik(e.m) && en.uzak > h * 2.4);
      e.m.etiket.classList.toggle('sakla', sakla);
      if (sakla) continue;
      kutular.push([en.x, en.y, en.x + w, en.y + h]);
      e.m.etiket.style.transform = `translate(${en.x.toFixed(1)}px, ${en.y.toFixed(1)}px)`;
    }
  }

  // ---------- Dışarıdan gelen olaylar ----------

  // Video çekimi için kare kare ilerletme: duraklat açıkken zamanı dışarıdan sürer, sn saniyeyi dt adımlarla oynatır.
  // Ekran yenilemesine bağlı olmadığı için her çekimde aynı sahne çıkar. Sonunda bir kez çizer.
  ilerlet(sn, dt = 1 / 30) {
    if (!this.duraklat) return;
    for (let i = 0, n = Math.max(1, Math.round(sn / dt)); i < n; i++) {
      this.saat.elapsedTime += dt;
      const t = this.saat.elapsedTime;
      if (!(t - this._dkT < 1)) { this._dkT = t; this._dk = this._dakika(); }
      for (const m of this.masalar.values()) this._canlandir(m, t, dt);
      this._zarflariIlerlet(dt, t);
      this._mekanizmalar(t, dt);
    }
    this.kontrol.update();
    this.renderer.render(this.sahne, this.kamera);
    this._etiketleriYerlestir();
  }

  // Saati sabitler (deneme ve video çekimi): mesai, yatakhane ve gece ışığı bu saate göre davranır.
  saatAyarla(saat, dakika = 0) {
    this.dakikaSabit = saat * 60 + dakika;
    this._dkT = -Infinity;
    this._dk = this._dakika();
    this._gunIsigi();
  }

  durum(id, durum, aktivite = '') {
    const m = this.masalar.get(id);
    if (!m) return;
    const t = this.saat.elapsedTime;
    if (m.durum !== durum) {
      m.degisim = m.durumT = t;
      if (t > 2) this._duygu(m, DUYGU_DURUM[durum], durum === 'hata' ? 5 : 3.2);
      if (durum === 'bitti') m.mola = Math.min(m.mola, t + 15 + Math.random() * 30);
    }
    m.durum = durum;
    m.aktivite = aktivite;
    const renk = DURUM_RENK[durum];
    m.ledM.emissive.set(renk || '#000000');
    m.ledM.emissiveIntensity = renk ? 2.4 : 0;
    const calisiyor = durum === 'calisiyor', dusunuyor = durum === 'dusunuyor';
    m.ekranM.emissive.set(dusunuyor ? '#f2b33d' : '#5fb0ff');
    m.ekranM.emissiveIntensity = calisiyor ? 1.0 : dusunuyor ? 0.5 : 0.06;
    m.isik.color.set(dusunuyor ? '#f2b33d' : '#5fb0ff');
    m.isik.intensity = calisiyor ? 1.8 : dusunuyor ? 0.9 : 0;
    m.dusunce.visible = dusunuyor;
    m.halkaM.color.set(renk || '#ffffff');
    // Etikette ayrıntı sadece iş sürerken ya da hata varken görünür; ofis sade kalır.
    const yazi = AKTIVITE_GOSTER.has(durum) ? (aktivite || DURUM_YAZI[durum] || durum) : '';
    const span = m.etiket.querySelector('span');
    if (span.textContent !== yazi || span.hidden !== !yazi) m.w = 0;
    span.textContent = yazi;
    span.hidden = !yazi;
    m.etiket.dataset.durum = durum;
    const durumYazi = DURUM_YAZI[durum];
    m.etiket.title = `${m.c.rol}${durumYazi ? ' · ' + durumYazi : ''}: görev vermek için tıkla`;
  }

  // Sayfa açılırken eski görevler için zarf uçurma.
  gecmis(gorevler) {
    let biten = 0, enKucuk = Infinity;
    for (const g of gorevler || []) {
      (g.adimlar || []).forEach((a, i) => this.gorulen.add(`${g.id}-${i}`));
      if (g.degerlendirme) this.gorulen.add(`${g.id}-dg`);
      if (g.degerlendirme?.durum === 'bitti') this.gorulen.add(`${g.id}-dgb`);
      if (g.durum === 'bitti') { biten++; this.gorulen.add(`${g.id}-ar`); }
      if (Number.isFinite(g.id)) enKucuk = Math.min(enKucuk, g.id);
    }
    // Listede olmayan eski görevlerin dosyaları da arşivde sayılır.
    const eski = Number.isFinite(enKucuk) ? enKucuk - 1 : 0;
    this.dosya = Math.max(this.dosya, eski + biten - this.arsivYolda);
    this._dosyaGuncelle();
  }

  gorev(g) {
    const gm = this.masalar.get('genel-mudur');
    (g.adimlar || []).forEach((a, i) => {
      const anahtar = `${g.id}-${i}`;
      if (this.gorulen.has(anahtar)) return;
      if (a.durum === 'calisiyor') {
        this.gorulen.add(anahtar);
        // Genel müdür planladıysa görevi kendisi götürür; doğrudan verilen görevi çalışan görev kutusundan alır.
        const otomatik = g.hedef === 'otomatik' && gm && a.birim !== 'genel-mudur';
        if (otomatik ? this._isVer('genel-mudur', 'teslim', a.birim) : this._isVer(a.birim, 'getir')) return;
        const kaynak = new THREE.Vector3();
        if (otomatik) gm.masaCapa.getWorldPosition(kaynak);
        else this.postaCapa.getWorldPosition(kaynak);
        this._zarfGonder(kaynak, a.birim);
      } else if (a.durum !== 'sirada') {
        this.gorulen.add(anahtar);
      }
    });
    // Rapor, değerlendirme için genel müdürün masasına götürülür.
    const dg = `${g.id}-dg`;
    if (g.degerlendirme && !this.gorulen.has(dg)) {
      this.gorulen.add(dg);
      const son = (g.adimlar || [])[g.adimlar.length - 1];
      const m = son && this.masalar.get(son.birim);
      if (g.degerlendirme.durum === 'calisiyor' && m && !this._isVer(son.birim, 'teslim', 'genel-mudur')) {
        const kaynak = new THREE.Vector3();
        m.masaCapa.getWorldPosition(kaynak);
        this._zarfGonder(kaynak, 'genel-mudur');
      }
    }
    // Değerlendirme bitince genel müdür onaylar; biten işin dosyasını son işi yapan arşive kaldırır.
    const dgb = `${g.id}-dgb`;
    if (g.degerlendirme?.durum === 'bitti' && !this.gorulen.has(dgb)) { this.gorulen.add(dgb); this._duygu(gm, '👍', 3.5); }
    const ar = `${g.id}-ar`;
    if (g.durum === 'bitti' && !this.gorulen.has(ar)) {
      this.gorulen.add(ar);
      const kim = g.degerlendirme && gm ? 'genel-mudur' : (g.adimlar || []).at(-1)?.birim;
      if (this.arsiv && kim && this._isVer(kim, 'arsiv')) this.arsivYolda++;
      else { this.dosya++; this._dosyaGuncelle(); }
    }
  }

  // ---------- Yürüyerek görev götürme ----------

  // Yürüyecek kişinin sırasına iş ekler. Hareket azaltılmışsa ya da kişi yoksa false döner; o zaman zarf uçar.
  _isVer(kimId, tur, hedefId) {
    const m = this.masalar.get(kimId);
    if (AZ_HAREKET || !m || !this.posta) return false;
    if (tur === 'teslim') {
      const h = this.masalar.get(hedefId);
      if (!h || h === m) return false;
      h.zarfBekliyor++;
    }
    m.kuyruk.push({ tur, hedefId });
    return true;
  }

  // Masadan hedefe koridorlardan geçen yol; noktalar dünya (x, z) koordinatında.
  // Odaların önü açık: önce koridora çıkılır, başka sıradaki odaya binanın yanındaki geçitten gidilir.
  _yol(m, hedef) {
    const kz = m.pz + m.karZ;
    const farkli = m.satir !== hedef.satir;
    let gx = null;
    if (farkli) {
      const [a, b] = this._gecitX;
      gx = Math.abs(m.px - a) + Math.abs(hedef.x - a) <= Math.abs(m.px - b) + Math.abs(hedef.x - b) ? a : b;
    }
    let girisX, son, bak;
    if (hedef.son) {
      girisX = hedef.x;
      son = hedef.son;
      bak = hedef.bak;
    } else if (hedef.posta) {
      girisX = hedef.x;
      son = [[hedef.x, hedef.z + 0.42]];
      bak = Math.PI;
    } else {
      const yanB = Math.sign((farkli ? gx : m.px) - hedef.x) || 1;
      girisX = hedef.x + yanB * (hedef.mg / 2 + 0.32);
      const hz = hedef.z + hedef.karZ + 0.05;
      son = [[girisX, hz], [hedef.x + yanB * 0.62, hz]];
      bak = yanB > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const yan = Math.sign((farkli ? gx : girisX) - m.px) || 1;
    const yx = m.px + yan * (m.mg / 2 + 0.32);
    const kA = this._koridorZ[m.satir];
    const noktalar = [[m.px, kz], [yx, kz], [yx, kA]];
    if (farkli) { const kB = this._koridorZ[hedef.satir]; noktalar.push([gx, kA], [gx, kB], [girisX, kB]); }
    else noktalar.push([girisX, kA]);
    noktalar.push(...son);
    return { noktalar, bak };
  }

  _zarfYap() {
    const zarf = new THREE.Group();
    const kagit = kutu(0.34, 0.014, 0.24, malzeme('#fbf6ea', { roughness: 0.6 }));
    const kapak = kutu(0.24, 0.016, 0.24, malzeme('#efe3c8', { roughness: 0.6 }), false);
    kapak.rotation.y = Math.PI / 4;
    kapak.scale.set(1, 1, 0.5);
    kapak.position.set(0, 0.004, -0.04);
    const muhur = silindir(0.03, 0.03, 0.02, malzeme('#b03a2e', { roughness: 0.4 }), 16);
    muhur.position.set(0, 0.012, 0.01);
    zarf.add(kagit, kapak, muhur);
    return zarf;
  }

  _zarfAt(zarf) {
    zarf.removeFromParent();
    zarf.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }

  _zarfGonder(kaynak, hedefId) {
    const m = this.masalar.get(hedefId);
    if (!m) return;
    const hedef = new THREE.Vector3();
    m.masaCapa.getWorldPosition(hedef);
    const zarf = this._zarfYap();
    zarf.position.copy(kaynak);
    this.sahne.add(zarf);
    this.zarflar.push({ zarf, a: kaynak.clone(), b: hedef, t: AZ_HAREKET ? 1 : 0, sure: 1.5, yukseklik: 1.4, hedefId });
  }

  // Zarf yürüyen kişinin sağ elinde taşınır.
  _eleAl(m, z = this._zarfYap()) {
    z.scale.setScalar(0.7);
    z.rotation.set(Math.PI / 2, 0, 0);
    z.position.set(0, -0.06, 0.05);
    m.k.elR.add(z);
    return z;
  }

  // Elden masaya kısa atış: zarf masaya konur, sonra kaybolur.
  _masayaBirak(zarf, hedef, sonra, sessiz = false) {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    zarf.getWorldPosition(a);
    hedef.masaCapa.getWorldPosition(b);
    zarf.removeFromParent();
    zarf.position.copy(a);
    zarf.rotation.set(0, 0, 0);
    zarf.scale.setScalar(1);
    this.sahne.add(zarf);
    this.zarflar.push({ zarf, a, b, t: 0, sure: 0.45, yukseklik: 0.15, hedefId: hedef.id, sonra, sessiz });
  }

  // Yürüyüş planı: kalk → yürü → iş (bir ya da birkaç durak) → geri yürü → dön → otur.
  _hareketBaslat(m, is, t) {
    const kz = m.pz + m.karZ;
    const temel = { is, k: 0, bas: t, ilk: t, i: 1, x: m.px, z: kz, y: 0, egim: 0, yon: 0, adim: 0, zarf: null, fincan: null };
    if (is.tur === 'eve') {
      // Mesai bitti: masadan kalkar, bahçeden yatakhaneye yürür, odasına girip yatar.
      m.hareket = { ...temel, adimlar: [{ tur: 'kalk' }, { tur: 'yuru', noktalar: this._evYolu(m) }, { tur: 'eylem', ad: 'yat', sure: 2.8, bak: null }] };
      this._duygu(m, '👋', 2.5);
      this._masaIsigi(m);
      return;
    }
    if (is.tur === 'ise') {
      // Sabah ya da gece iş gelince: yataktan kalkar, ofise yürür, masasına oturur.
      const L = m.oda.yatis;
      m.hareket = { ...temel, x: L.x, z: L.z, y: YATIS_Y, egim: -Math.PI / 2, yon: L.yon,
        adimlar: [{ tur: 'eylem', ad: 'kalkYatak', sure: 2.7, bak: null }, { tur: 'yuru', noktalar: this._evYolu(m).reverse() }, { tur: 'don' }, { tur: 'otur' }] };
      m.sandalye.position.z = m.karZ - 0.45;
      return;
    }
    if (is.tur === 'devriye') {
      // Güvenlik mesai dışında ofisi ve yatakhanenin girişini fenerle dolaşır.
      const { git, don } = this._devriyeYolu(m);
      m.hareket = { ...temel, fener: this._fenerYap(m),
        adimlar: [{ tur: 'kalk' }, { tur: 'yuru', noktalar: git }, { tur: 'eylem', ad: 'kontrol', sure: 3.4, bak: Math.PI }, { tur: 'yuru', noktalar: don }, { tur: 'don' }, { tur: 'otur' }] };
      this._duygu(m, '🔦', 3);
      return;
    }
    const adimlar = [{ tur: 'kalk' }];
    const git = (hedef, eylem) => {
      const { noktalar, bak } = this._yol(m, hedef);
      adimlar.push({ tur: 'yuru', noktalar }, { ...eylem, tur: 'eylem', bak });
      return noktalar;
    };
    let donus, zarf = null;
    if (is.tur === 'getir') donus = git({ posta: true, ...this.posta }, { ad: 'al', sure: 1.05 });
    else if (is.tur === 'teslim') {
      const h = this.masalar.get(is.hedefId);
      donus = git({ x: h.px, z: h.pz, karZ: h.karZ, mg: h.mg, satir: h.satir }, { ad: 'ver', sure: 1.05 });
      zarf = this._eleAl(m);
    } else if (is.tur === 'arsiv') {
      const A = this.arsiv, s = A.sira++;
      const dolap = A.dolaplar[s % A.dolaplar.length];
      const cekmece = dolap.cekmeceler[[2, 3, 1, 2, 3, 0][s % 6]];
      // Çekmecenin biraz sağında durur: açılan çekmece kişinin arkasında kalmaz.
      donus = git({ x: A.kapiX, son: [[A.kapiX, A.icZ], [dolap.x + 0.3, A.durZ]], bak: Math.PI + 0.35, satir: A.satir },
        { ad: 'dosyala', sure: 2.6, cekmece, alt: cekmece.seviye < 2 });
      zarf = this._eleAl(m, this._klasorYap());
    } else if (is.tur === 'kahve') {
      const K = this.kahve, i = K.dolu.indexOf(null);
      K.dolu[i] = m.id;
      is.yer = i;
      const yer = K.yerler[i], koltuk = K.koltuklar[i];
      git({ x: yer[0], son: [yer], bak: Math.PI / 2, satir: K.satir }, { ad: 'kahve', sure: 7 });
      adimlar.push({ tur: 'yuru', noktalar: [yer, [yer[0], K.onZ], [koltuk[0], K.onZ], koltuk] },
        { tur: 'eylem', ad: 'kanepe', sure: 24, bak: 0, z0: koltuk[1], z1: K.oturZ });
      donus = this._yol(m, { x: K.yanlar[i], son: [[K.yanlar[i], K.onZ], [koltuk[0], K.onZ], koltuk], bak: 0, satir: K.satir }).noktalar;
    } else if (is.tur === 'dolap') {
      const d = m.dolap, sx = Math.sign(d.durX);
      donus = [[m.px, kz], [m.px + sx * 0.6, kz], [m.px + d.durX, m.pz + d.durZ]];
      adimlar.push({ tur: 'yuru', noktalar: donus }, { tur: 'eylem', ad: 'dolap', sure: 2.7, bak: Math.PI });
    }
    adimlar.push({ tur: 'yuru', noktalar: donus.slice().reverse() }, { tur: 'don' }, { tur: 'otur' });
    m.hareket = { is, adimlar, k: 0, bas: t, ilk: t, i: 1, x: m.px, z: kz, yon: 0, adim: 0, zarf, fincan: null,
      teslimEdildi: false, arsivlendi: false };
  }

  _yurumePozu(f, tasiyor) {
    const s = Math.sin(f), c = Math.cos(f);
    return { ...POZ_AYAKTA, py: 0.885 + Math.abs(c) * 0.02, egil: 0.04,
      kL: -0.42 * s, kR: 0.42 * s, dL: 0.08 + 0.65 * Math.max(0, c), dR: 0.08 + 0.65 * Math.max(0, -c),
      oLx: 0.35 * s, eL: -0.3, oRx: tasiyor ? -0.5 : -0.35 * s, eR: tasiyor ? -1.1 : -0.3 };
  }

  _hareketIlerle(m, t, dt) {
    const h = m.hareket, a = h.adimlar[h.k], gecen = t - h.bas;
    const yaklas = aci => { const f = Math.atan2(Math.sin(aci - h.yon), Math.cos(aci - h.yon)); h.yon += f * Math.min(1, dt * 9); };
    const sonraki = () => { h.k++; h.bas = t; h.i = 1; };
    let poz = POZ_AYAKTA;
    if (a.tur === 'kalk') {
      m.sandalye.position.z = m.karZ - 0.45 * Math.min(1, gecen / 0.5);
      if (gecen > 0.6) sonraki();
    } else if (a.tur === 'yuru') {
      let kalan = YURUME_HIZI * dt;
      while (kalan > 0 && h.i < a.noktalar.length) {
        const [nx, nz] = a.noktalar[h.i];
        const dx = nx - h.x, dz = nz - h.z, uz = Math.hypot(dx, dz);
        if (uz > 1e-3) yaklas(Math.atan2(dx, dz));
        const adim = Math.min(uz, kalan);
        if (uz <= kalan) { h.x = nx; h.z = nz; h.i++; } else { h.x += dx / uz * adim; h.z += dz / uz * adim; }
        h.adim += adim * Math.PI * 2 / ADIM_DONGU;
        kalan -= adim;
      }
      poz = this._yurumePozu(h.adim, !!h.zarf || !!h.fener);
      if (h.fincan) poz = { ...poz, oRx: POZ_FINCAN.oRx, oRz: POZ_FINCAN.oRz, eR: POZ_FINCAN.eR };
      if (h.i >= a.noktalar.length) sonraki();
    } else if (a.tur === 'eylem') {
      if (a.bak != null) yaklas(a.bak);
      poz = this._eylem(m, h, a, gecen, t, dt);
      if (gecen > a.sure) {
        if (h.k === h.adimlar.length - 1) { this._hareketBitir(m); return; } // eve varış: yatakta biter
        sonraki();
      }
    } else if (a.tur === 'don') {
      yaklas(0);
      if (gecen > 0.35) sonraki();
    } else {
      poz = POZ_OTUR;
      m.sandalye.position.z = m.karZ - 0.45 * (1 - Math.min(1, gecen / 0.6));
      if (h.zarf && gecen > 0.2) { this._masayaBirak(h.zarf, m, null, true); h.zarf = null; }
      if (h.fener && gecen > 0.2) { this._zarfAt(h.fener); h.fener = null; }
      if (gecen > 0.75) { this._hareketBitir(m); return; }
    }
    if (t - h.ilk > 240) { this._hareketBitir(m); return; } // takılırsa yerine döner
    m.k.grup.position.set(h.x - m.px, h.y || 0, h.z - m.pz);
    m.k.grup.rotation.set(h.egim || 0, h.yon, 0);
    this._pozYaklas(m.k, poz, dt);
    if (h.fincan) { // fincan elde dik durur
      m.k.elR.getWorldQuaternion(this._q);
      h.fincan.quaternion.copy(this._q).invert();
    }
  }

  // Duraktaki iş: görev kutusundan alma, masaya verme, arşive kaldırma, kahve, kanepe, kabin dolabı.
  _eylem(m, h, a, gecen, t, dt) {
    if (a.ad === 'yat') {
      // Yatak kenarına döner ve oturur, sonra sırtüstü uzanır; yorgan kabarıp üstünü örter.
      const o = m.oda;
      if (gecen < 0.8) {
        a.bas0 ||= { x: h.x, z: h.z, yon: h.yon };
        const g = yumusak(gecen / 0.8), b = a.bas0;
        h.x = b.x + (o.oturma[0] - b.x) * g;
        h.z = b.z + (o.oturma[1] - b.z) * g;
        h.yon = b.yon + Math.atan2(Math.sin(-b.yon), Math.cos(-b.yon)) * g;
        return karisim(POZ_AYAKTA, POZ_OTUR, g);
      }
      m.yatakta = true;
      if (gecen > 2.0) o.yorgan.hedef = 1;
      return this._yatakPozu(m, h, (gecen - 0.8) / 1.2);
    }
    if (a.ad === 'kalkYatak') {
      // Yorganı açar, doğrulup yatak kenarına oturur, kalkar.
      const o = m.oda;
      if (!a.basladi) { a.basladi = true; o.yorgan.hedef = 0; this._duygu(m, h.is.sebep === 'is' ? '⏰' : '☀️', 3); }
      if (gecen < 1.8) return this._yatakPozu(m, h, 1 - (gecen - 0.5) / 1.3);
      m.yatakta = false;
      const g = yumusak((gecen - 1.8) / 0.8), [bx, bz] = o.yol.at(-1);
      Object.assign(h, { y: 0, egim: 0, yon: 0, x: o.oturma[0] + (bx - o.oturma[0]) * g, z: o.oturma[1] + (bz - o.oturma[1]) * g });
      return karisim(POZ_OTUR, POZ_AYAKTA, g);
    }
    if (a.ad === 'kontrol') {
      // Güvenlik yatakhanenin girişinde durup fenerle etrafa bakar.
      return { ...POZ_FENER, by: Math.sin(gecen * 2.1) * 0.75, oRz: 0.07 + Math.sin(gecen * 2.1) * 0.25 };
    }
    if (a.ad === 'al' || a.ad === 'ver') {
      if (a.ad === 'al' && !h.zarf && gecen > 0.45) h.zarf = this._eleAl(m);
      if (a.ad === 'ver' && h.zarf && gecen > 0.45) {
        const hedef = this.masalar.get(h.is.hedefId);
        this._masayaBirak(h.zarf, hedef, () => { hedef.zarfBekliyor = Math.max(0, hedef.zarfBekliyor - 1); });
        h.zarf = null;
        h.teslimEdildi = true;
      }
      return gecen < 0.8 ? POZ_UZAN : POZ_AYAKTA;
    }
    if (a.ad === 'dosyala') {
      a.cekmece.hedef = gecen > 0.1 && gecen < 1.75 ? 1 : 0;
      if (h.zarf && gecen > 1.0) {
        this._zarfAt(h.zarf);
        h.zarf = null;
        h.arsivlendi = true;
        this._arsivle();
        this._duygu(m, '🗂️', 2.5);
      }
      return gecen > 0.5 && gecen < 1.4 ? (a.alt ? POZ_EGIL : POZ_UZAN) : POZ_AYAKTA;
    }
    if (a.ad === 'kahve') {
      if (!a.basladi) { a.basladi = true; this.kahve.aktif = t + 5; this._duygu(m, '☕', 7); }
      if (!h.fincan && gecen > 5.2) h.fincan = this._fincanAl(m);
      if (!h.fincan) return gecen < 0.9 ? POZ_UZAN : POZ_AYAKTA;
      return gecen > 5.9 && gecen < 6.7 ? { ...POZ_FINCAN, ...POZ_YUDUM } : POZ_FINCAN;
    }
    if (a.ad === 'kanepe') {
      if (!a.basladi) { a.basladi = true; this._duygu(m, '😌', 6); }
      // İş gelirse mola kısa kesilir.
      const isVar = m.kuyruk.length || m.zarfBekliyor || AKTIVITE_GOSTER.has(m.durum);
      if (isVar && gecen > 0.7 && gecen < a.sure - 0.8) a.sure = gecen + 0.8;
      const otur = Math.min(1, gecen / 0.6) * Math.min(1, Math.max(0, (a.sure - gecen) / 0.6));
      h.z = a.z0 + (a.z1 - a.z0) * otur;
      if (h.fincan && gecen > a.sure - 0.5) { this._zarfAt(h.fincan); h.fincan = null; }
      if (otur < 0.4) return h.fincan ? POZ_FINCAN : POZ_AYAKTA;
      return gecen % 6 > 4.7 ? { ...POZ_KANEPE, ...POZ_YUDUM } : POZ_KANEPE;
    }
    if (a.ad === 'dolap') {
      m.dolap.acilir.hedef = gecen > 0.15 && gecen < 2.0 ? 1 : 0;
      if (!h.zarf && gecen > 1.15) { h.zarf = this._eleAl(m, this._klasorYap()); this._duygu(m, '📂', 2.5); }
      return gecen > 0.55 && gecen < 1.45 ? POZ_EGIL : POZ_AYAKTA;
    }
    return POZ_AYAKTA;
  }

  _hareketBitir(m) {
    const h = m.hareket;
    if (h.zarf) this._zarfAt(h.zarf);
    if (h.fincan) this._zarfAt(h.fincan);
    if (h.fener) this._zarfAt(h.fener);
    if (h.is.tur === 'eve') { m.hareket = null; this._yatagaYerles(m, this.saat.elapsedTime); return; }
    if (h.is.tur === 'ise') { m.yer = 'ofis'; m.yatakta = false; m.oda.yorgan.hedef = 0; }
    if (h.is.tur === 'teslim' && !h.teslimEdildi) {
      const hedef = this.masalar.get(h.is.hedefId);
      if (hedef) hedef.zarfBekliyor = Math.max(0, hedef.zarfBekliyor - 1);
    }
    if (h.is.tur === 'arsiv' && !h.arsivlendi) this._arsivle();
    if (h.is.tur === 'kahve' && this.kahve) this.kahve.dolu[h.is.yer] = null;
    for (const a of h.adimlar) if (a.cekmece) a.cekmece.hedef = 0;
    if (h.is.tur === 'dolap') m.dolap.acilir.hedef = 0;
    m.k.grup.position.set(0, 0, m.karZ);
    m.k.grup.rotation.set(0, 0, 0);
    m.sandalye.position.z = m.karZ;
    m.hareket = null;
    this._masaIsigi(m);
  }

  // ---------- Mesai ve yatakhane ----------

  _dakika() {
    if (this.dakikaSabit != null) return this.dakikaSabit; // deneme için saat sabitlenebilir
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  // Şu an nerede olmalı: mesai içinde ofiste; mesai dışında işi olan ve güvenlik ofiste, diğerleri evde.
  _gerekli(m) {
    if (!m.oda) return 'ofis';
    return olmasiGerekenYer({ dk: this._dk, mesai: this.ayar.mesai, nobetci: m.nobetci, mesgul: mesgulMu(m) });
  }

  // Sayfa açılırken: mesai dışıysa ve işi yoksa doğrudan yatağında uyurken görünür (yürümez).
  _ilkYer(m, t) {
    m.yer = 'ofis';
    if (this._gerekli(m) === 'ev') this._yatagaYerles(m, t, true);
  }

  _yatagaYerles(m, t, ilk = false) {
    const o = m.oda, L = o.yatis;
    m.k.grup.position.set(L.x - m.px, YATIS_Y, L.z - m.pz);
    m.k.grup.rotation.set(-Math.PI / 2, L.yon, 0);
    m.k.poz = { ...POZ_YAT };
    this._pozUygula(m.k, m.k.poz);
    m.sandalye.position.z = m.karZ - 0.45;
    m.yer = 'ev';
    m.yatakta = true;
    o.yorgan.hedef = 1;
    if (ilk || AZ_HAREKET) { o.yorgan.acik = 1; o.yorgan.uygula(1); }
    m.uyuT = ilk ? t : t + 5; // abajur biraz sonra söner
    m.zzzT = t + (ilk ? 1 + Math.random() * 8 : 3.5);
    if (!ilk) this._duygu(m, '😴', 3);
    m.etiket?.classList.add('uyuyor');
    this._masaIsigi(m);
  }

  // Hareket azaltılmışsa yürümeden masasına döner.
  _masayaDon(m) {
    m.k.grup.position.set(0, 0, m.karZ);
    m.k.grup.rotation.set(0, 0, 0);
    m.sandalye.position.z = m.karZ;
    m.yer = 'ofis';
    m.yatakta = false;
    m.oda.yorgan.hedef = 0;
    m.etiket?.classList.remove('uyuyor');
    this._masaIsigi(m);
  }

  // Ofisteyken eve gitme vakti: mesai bitti ve işi yok. Herkes aynı anda kalkmasın diye biraz bekler.
  _eveVakti(m, t) {
    if (this._gerekli(m) === 'ofis') { m.eveT = 0; return false; }
    if (!m.eveT) { m.eveT = t + 8 + Math.random() * 100; return false; }
    if (t < m.eveT) return false;
    m.eveT = 0;
    if (AZ_HAREKET) { this._yatagaYerles(m, t); return false; }
    return true;
  }

  // Evde: uyur, arada 💤. Sabah mesai başlayınca ya da gece işi gelince kalkıp ofise gider.
  _evde(m, t, dt) {
    if (this._gerekli(m) === 'ofis') {
      const acil = mesgulMu(m);
      if (!m.kalkT || (acil && m.kalkT > t + 3)) m.kalkT = t + (acil ? 1 + Math.random() * 2 : 3 + Math.random() * 110);
      if (t >= m.kalkT) {
        m.kalkT = 0;
        m.etiket?.classList.remove('uyuyor');
        if (AZ_HAREKET) this._masayaDon(m);
        else this._hareketBaslat(m, { tur: 'ise', sebep: acil ? 'is' : 'sabah' }, t);
        return;
      }
    } else m.kalkT = 0;
    if (t > m.uyuT && t > m.zzzT) { this._duygu(m, '💤', 3.2); m.zzzT = t + 9 + Math.random() * 7; }
    this._pozYaklas(m.k, { ...POZ_YAT, by: Math.sin(t * 0.3 + m.faz) * 0.06 * (AZ_HAREKET ? 0 : 1) }, dt);
  }

  // Güvenlik mesai dışında arada devriye gezer.
  _devriyeVakti(m, t) {
    if (AZ_HAREKET || !m.nobetci || mesaideMi(this._dk, this.ayar.mesai) || mesgulMu(m)) return false;
    if (!m.devriyeT) { m.devriyeT = t + 20 + Math.random() * 60; return false; }
    if (t < m.devriyeT) return false;
    const [a, b] = DEVRIYE_ARALIK;
    m.devriyeT = t + a + Math.random() * (b - a);
    return true;
  }

  // Masadan bahçeye, oradan yatakhanedeki odasına ve yatağının kenarına giden yol.
  _evYolu(m) {
    const Y = this.yatakhane, kz = m.pz + m.karZ, kA = this._koridorZ[m.satir];
    const yx = m.px + (m.mg / 2 + 0.32), ax = this._avluX;
    return [[m.px, kz], [yx, kz], [yx, kA], [ax, kA], [ax, Y.onZ], [Y.kx, Y.onZ], ...m.oda.yol];
  }

  // Devriye: kendi koridorundan bahçeye, yatakhane holüne; dönüşte bütün koridorları sırayla dolaşır.
  _devriyeYolu(m) {
    const kz = m.pz + m.karZ, kA = this._koridorZ[m.satir], yx = m.px + (m.mg / 2 + 0.32);
    const [gW, gE] = this._gecitX, Y = this.yatakhane, ax = Y ? this._avluX : gE;
    const git = [[m.px, kz], [yx, kz], [yx, kA], [ax, kA]];
    const don = [];
    if (Y) {
      git.push([ax, Y.onZ], [Y.kx, Y.onZ], [Y.kx, Y.holZ]);
      don.push([Y.kx, Y.holZ], [Y.kx, Y.onZ], [ax, Y.onZ]);
    } else don.push([ax, kA]);
    let x = gE;
    this._koridorZ.forEach((z, i) => {
      if (i === 0) don.push([ax, z], [gE, z]); else don.push([x, z]);
      x = x === gE ? gW : gE;
      don.push([x, z]);
    });
    don.push([x, kA], [yx, kA], [yx, kz], [m.px, kz]);
    return { git, don };
  }

  // Yatağa giriş-çıkış: f=0 yatak kenarında oturuyor, f=1 sırtüstü yatıyor. Kalça noktasından kök hesaplanır.
  _yatakPozu(m, h, f) {
    const o = m.oda, e = yumusak(f);
    const py = 0.6 + 0.3 * e, egim = -Math.PI / 2 * e, yon = o.yatis.yon * e;
    const px = o.oturma[0] + (o.yatPelvis[0] - o.oturma[0]) * e;
    const pz = o.oturma[1] + (o.yatPelvis[1] - o.oturma[1]) * e;
    const pY = 0.6 + (YATIS_Y - 0.6) * e + Math.sin(Math.PI * e) * 0.1;
    const sE = Math.sin(egim);
    Object.assign(h, { x: px - py * sE * Math.sin(yon), z: pz - py * sE * Math.cos(yon), y: pY - py * Math.cos(egim), egim, yon });
    return karisim(POZ_OTUR, POZ_YAT, e);
  }

  // Masa lambası gece yanar; sahibi eve gidince söner.
  _masaIsigi(m) {
    const yanik = !!this.aksam && m.yer !== 'ev' && m.hareket?.is.tur !== 'eve';
    m.lamba.isik.intensity = yanik ? 1.6 : 0;
    m.lamba.ampulM.emissiveIntensity = yanik ? 2.2 : 0;
  }

  // Abajurlar: gece sakini yatakhanedeyken ve uyanıkken yanar, uyuyunca ya da çıkınca söner.
  _odaIsiklari(t, dt) {
    const Y = this.yatakhane;
    for (const o of this.odalar) {
      const m = o.m;
      let hedef = 0;
      if (this.aksam && m) {
        const h = m.hareket, yolda = h && (h.is.tur === 'eve' || h.is.tur === 'ise');
        const icerde = yolda ? h.x > Y.x0 - 0.3 : !h && m.yer === 'ev';
        hedef = icerde && (yolda || t < m.uyuT) ? 1 : 0;
      }
      if (o.isik === hedef) continue;
      o.isik += (hedef - o.isik) * (AZ_HAREKET ? 1 : Math.min(1, dt * 4));
      if (Math.abs(hedef - o.isik) < 0.01) o.isik = hedef;
      o.lambaM.emissiveIntensity = o.isik * 1.8;
      o.haleM.opacity = o.isik * 0.55;
      o.yerM.opacity = o.isik * 0.35;
    }
  }

  // Güvenliğin el feneri: geceleri önüne ışık huzmesi düşer.
  _fenerYap(m) {
    const g = new THREE.Group();
    const govde = silindir(0.022, 0.018, 0.16, this.siyah, 12);
    const cam = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), new THREE.MeshBasicMaterial({ color: '#fff4cf' }));
    cam.rotation.x = Math.PI / 2;
    cam.position.y = -0.081;
    this._yikamaDoku ||= isikDokusu('yikama');
    const isin = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.7, 20, 1, true), new THREE.MeshBasicMaterial({
      map: this._yikamaDoku, color: '#ffe7a8', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    isin.position.y = -0.93;
    isin.visible = !!this.aksam;
    g.add(govde, cam, isin);
    g.position.set(0, -0.05, 0.02);
    g.rotation.x = 0.61; // huzme önüne ve aşağı
    m.k.elR.add(g);
    return g;
  }

  // Boştaki çalışan arada kahve molasına çıkar (en çok iki kişi aynı anda).
  _molaVakti(m, t) {
    if (AZ_HAREKET || !this.kahve || t < m.mola || m.zarfBekliyor || m.kuyruk.length || m.eveT) return false; // eve çıkmak üzereyken mola yok
    if (!['bosta', 'bitti', 'durduruldu'].includes(m.durum)) return false;
    const [a, b] = MOLA_ARALIK;
    m.mola = t + (a + Math.random() * (b - a)) * (this.aksam ? 2 : 1);
    return this.kahve.dolu.includes(null);
  }

  // İş sürerken arada kabin dolabından dosya alır.
  _dolapVakti(m, t) {
    if (AZ_HAREKET || !m.dolap || m.durum !== 'calisiyor' || m.zarfBekliyor || m.kuyruk.length) return false;
    if (t - m.durumT < 20 || t < m.dolapT) return false;
    m.dolapT = t + 70 + Math.random() * 110;
    return true;
  }

  // Masada oturan kişi: yazıyor, düşünüyor (eli çenesinde) ya da boşta (etrafa bakıyor, nefes alıyor).
  // Genel müdür görevi getirene kadar çalışan işe başlamaz.
  _oturmaPozu(m, t) {
    const h = AZ_HAREKET ? 0 : 1;
    const durum = m.zarfBekliyor ? 'bosta' : m.durum;
    const p = { ...POZ_OTUR, by: Math.sin(t * 0.35 + m.faz) * 0.35 * h, egil: 0.05 + Math.sin(t * 1.6 + m.faz) * 0.012 * h };
    if (durum === 'calisiyor') {
      const a = t * 13 + m.faz;
      Object.assign(p, { egil: 0.13, oLx: -0.75, oLz: 0.16, oRx: -0.75, oRz: -0.16,
        eL: -0.85 + Math.sin(a) * 0.11 * h, eR: -0.85 + Math.sin(a + Math.PI) * 0.11 * h,
        bx: 0.1 + Math.sin(t * 2.3 + m.faz) * 0.04 * h, by: Math.sin(t * 0.7 + m.faz) * 0.06 * h });
    } else if (durum === 'dusunuyor' || durum === 'planlaniyor') {
      Object.assign(p, { egil: 0.16, oRx: -0.72, oRz: -0.32, eR: -2.35, bx: 0.14,
        by: Math.sin(t * 0.9) * 0.22 * h, bz: Math.sin(t * 1.4) * 0.08 * h });
    } else if (durum === 'bitti') {
      if (t - m.durumT < 2.4 && h) Object.assign(p, { egil: -0.12, oLx: -2.85, oLz: -0.3, oRx: -2.85, oRz: 0.3, eL: -0.35, eR: -0.35, bx: -0.18 });
      else p.egil = -0.06;
    } else if (durum === 'hata') {
      if (t - m.durumT < 6) Object.assign(p, { egil: 0.2, oRx: -1.05, oRz: -0.38, eR: -2.45, bx: 0.28, by: 0 });
      else Object.assign(p, { egil: 0.1, bx: 0.15 });
    }
    return p;
  }

  // ---------- Canlandırma ----------

  _dongu() {
    this._raf = requestAnimationFrame(this._dongu);
    if (this.duraklat || !this.kap.clientWidth) return;
    const dt = Math.min(this.saat.getDelta(), 0.05);
    const t = this.saat.elapsedTime;
    this.kontrol.update();
    this._kaydirmaSiniri();
    if (!(t - this._dkT < 1)) { this._dkT = t; this._dk = this._dakika(); }
    for (const m of this.masalar.values()) this._canlandir(m, t, dt);
    this._zarflariIlerlet(dt, t);
    this._mekanizmalar(t, dt);
    this.renderer.render(this.sahne, this.kamera);
    this._etiketleriYerlestir();
    if (Math.floor(t / 60) !== this._sonGun) { this._sonGun = Math.floor(t / 60); this._gunIsigi(); }
  }

  // Kapaklar, çekmeceler ve kayar kapı; kahve makinesi ve çaydanlık buharı.
  _mekanizmalar(t, dt) {
    for (const k of this.kapilar) {
      let yakin = false;
      for (const m of this.masalar.values()) {
        const h = m.hareket;
        if (h && Math.hypot(h.x - k.x, h.z - k.z) < 1.5) { yakin = true; break; }
      }
      k.acilir.hedef = yakin ? 1 : 0;
    }
    this._odaIsiklari(t, dt);
    const f = AZ_HAREKET ? 1 : Math.min(1, dt * 6);
    for (const a of this.acilirlar) {
      if (a.acik === a.hedef) continue;
      a.acik += (a.hedef - a.acik) * f;
      if (Math.abs(a.hedef - a.acik) < 0.002) a.acik = a.hedef;
      a.uygula(a.acik);
    }
    const K = this.kahve;
    if (!K) return;
    const aktif = t < K.aktif;
    K.ekranM.emissiveIntensity = aktif ? 1.4 : 0.35;
    K.buhar.forEach((b, i) => {
      const { y, cay } = b.userData;
      b.visible = !AZ_HAREKET && (cay || aktif);
      if (!b.visible) return;
      const p = (t * (cay ? 0.35 : 0.7) + (i % 3) / 3) % 1;
      b.position.y = y + p * (cay ? 0.16 : 0.24);
      b.material.opacity = (cay ? 0.22 : 0.45) * Math.sin(Math.PI * p);
      b.scale.setScalar(0.6 + p * 1.1);
    });
  }

  // Kaydırırken ofis ekrandan kaçmasın.
  _kaydirmaSiniri() {
    const f = this._fark.copy(this.kontrol.target).sub(this._merkez);
    const uz = f.length();
    if (uz <= this._panSiniri) return;
    f.setLength(uz - this._panSiniri);
    this.kontrol.target.sub(f);
    this.kamera.position.sub(f);
  }

  _canlandir(m, t, dt) {
    const h = AZ_HAREKET ? 0 : 1;
    if (m.yer === undefined) this._ilkYer(m, t);
    const sira = m.kuyruk[0];
    const alan = sira?.tur === 'teslim' ? this.masalar.get(sira.hedefId) : null;
    if (m.hareket) this._hareketIlerle(m, t, dt);
    else if (m.yer === 'ev') this._evde(m, t, dt);
    else if (this._eveVakti(m, t)) this._hareketBaslat(m, { tur: 'eve' }, t);
    // Sıradaki işe, kendi görevi geldiyse ve götüreceği kişi masasındaysa (yürümüyor, evde değil) başlar.
    else if (sira && !m.zarfBekliyor && !(alan && (alan.hareket || alan.yer !== 'ofis'))) this._hareketBaslat(m, m.kuyruk.shift(), t);
    else if (this._molaVakti(m, t)) this._hareketBaslat(m, { tur: 'kahve' }, t);
    else if (this._dolapVakti(m, t)) this._hareketBaslat(m, { tur: 'dolap' }, t);
    else if (this._devriyeVakti(m, t)) this._hareketBaslat(m, { tur: 'devriye' }, t);
    else this._pozYaklas(m.k, this._oturmaPozu(m, t), dt);
    if (m.duyguBitis && t > m.duyguBitis) { m.duyguEl.classList.remove('acik'); m.duyguBitis = 0; }
    if (m.dusunce.visible) m.dusunce.children.forEach((n, i) => { n.position.y = n.userData.y + Math.sin(t * 3 - i * 0.7) * 0.03 * h; });
    if (m.durum === 'calisiyor') m.ekranM.emissiveIntensity = 1.0 + Math.sin(t * 9 + m.faz) * 0.12 * h;
    const gecen = t - m.degisim;
    let opak = 0, olcek = 1;
    if (m.durum === 'bitti' || m.durum === 'hata') {
      opak = gecen < 3 ? 0.45 + 0.3 * Math.sin(gecen * 8) : 0.32;
      olcek = gecen < 3 ? 1 + Math.sin(gecen * 8) * 0.05 * h : 1;
    } else if (m.durum === 'calisiyor') {
      opak = 0.22 + Math.sin(t * 3) * 0.06 * h;
    } else if (m.durum === 'dusunuyor') {
      opak = 0.25;
    }
    m.halkaM.opacity = opak;
    m.halka.scale.setScalar(olcek);
  }

  _zarflariIlerlet(dt, t) {
    for (let i = this.zarflar.length - 1; i >= 0; i--) {
      const z = this.zarflar[i];
      z.t = Math.min(1, z.t + dt / z.sure);
      const e = z.t < 0.5 ? 2 * z.t * z.t : 1 - Math.pow(-2 * z.t + 2, 2) / 2;
      z.zarf.position.lerpVectors(z.a, z.b, e);
      const yuk = z.yukseklik ?? 1.4;
      z.zarf.position.y += Math.sin(Math.PI * e) * yuk;
      if (yuk > 0.5) { z.zarf.rotation.y = e * Math.PI * 2; z.zarf.rotation.z = Math.sin(Math.PI * e) * 0.3; }
      if (z.t >= 1) {
        this.sahne.remove(z.zarf);
        z.zarf.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        this.zarflar.splice(i, 1);
        const m = this.masalar.get(z.hedefId);
        if (m) {
          m.degisim = t;
          if (!z.sessiz) this._duygu(m, m.id === 'genel-mudur' ? '🧐' : '📩', 2.5);
        }
        z.sonra?.();
      }
    }
  }

  // Gündüz ve akşam ışığı: bilgisayarın saatine göre (saatAyarla ile sabitlenmişse o saate göre).
  _gunIsigi() {
    const s = Math.floor(this._dakika() / 60) % 24;
    const aksam = s < 7 || s >= 19;
    if (aksam === this.aksam) return;
    this.aksam = aksam;
    this.hemi.intensity = aksam ? 0.35 : 1.05;
    this.ortam.intensity = aksam ? 0.2 : 0.35;
    this.gunes.intensity = aksam ? 0.35 : 2.0;
    this.gunes.color.set(aksam ? '#8fa3d9' : '#fff4e6');
    this.pencereM.emissive.set(aksam ? '#1d2a4a' : '#bfe3fa');
    this.pencereM.emissiveIntensity = aksam ? 0.5 : 0.7;
    this._ledAyarla(aksam);
    for (const m of this.masalar.values()) {
      this._masaIsigi(m);
      if (m.hareket?.fener) m.hareket.fener.children[2].visible = aksam;
    }
    this.kap.dataset.aksam = aksam ? '1' : '';
  }

  yokEt() {
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    this.kontrol.dispose();
    this.sahne.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose();
        for (const m of [].concat(o.material)) { m.map?.dispose(); m.dispose(); }
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.katman.remove();
    this.lejant.remove();
    this.ipucu.remove();
  }
}
