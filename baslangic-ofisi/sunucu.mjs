// Ofisin sunucusu: paneli (3D ofis) sunar, görevleri alır, canlı akışla panele haber verir.
// Kullanım: npm start  (ya da node sunucu.mjs)
import http from 'node:http';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GENEL_MUDUR } from './lib/ayar.mjs';
import { claudeBul } from './lib/motor.mjs';
import { GorevKutusu } from './lib/gorevler.mjs';
import { kur } from './kur.mjs';

const BURADA = path.dirname(fileURLToPath(import.meta.url));
const EN_COK_GOVDE = 64 * 1024;
const CANLI_TUT_MS = 25_000;
const JS = 'text/javascript; charset=utf-8';

// Sadece bu adresler dosya olarak verilir. Listede olmayan her şey 404: ayar, veri ve kod dışarı açılmaz.
export const STATIK = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/panel.js': ['panel.js', JS],
  '/ofis3d.js': ['ofis3d.js', JS],
  '/ofis3d.css': ['ofis3d.css', 'text/css; charset=utf-8'],
  '/ofis-mesai.js': ['ofis-mesai.js', JS],
  '/vendor/three.module.min.js': ['vendor/three.module.min.js', JS],
  '/vendor/OrbitControls.js': ['vendor/OrbitControls.js', JS],
};

const dosyaVar = d => { try { return !!d && fs.statSync(d).isFile(); } catch { return false; } };
const yerelMi = h => h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');

function gonder(res, kod, govde, tur = 'application/json; charset=utf-8') {
  const veri = typeof govde === 'string' || Buffer.isBuffer(govde) ? govde : JSON.stringify(govde);
  res.writeHead(kod, { 'content-type': tur, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(veri);
}
const hata = (res, kod, metin) => gonder(res, kod, { hata: metin });

function adAyikla(hostBasligi) {
  const h = String(hostBasligi ?? '').trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']'));
  return h.replace(/:\d+$/, '');
}

// Başka bir web sitesi tarayıcın üzerinden ofisine görev gönderemesin (CSRF ve DNS rebinding koruması).
function izinliMi(req, ayar) {
  const ad = adAyikla(req.headers.host);
  const adOk = net.isIP(ad) || yerelMi(ad) || ayar.izinliAdresler?.includes(ad) || (!yerelMi(ayar.host) && ad === String(ayar.host).toLowerCase());
  if (!adOk) return `Bu adres izinli değil: ${ad}. Gerekirse ofis.ayar.json içindeki "izinliAdresler" listesine ekle.`;
  if (req.headers.origin) {
    let kaynak = '';
    try { kaynak = new URL(req.headers.origin).host.toLowerCase(); } catch {}
    if (kaynak !== String(req.headers.host ?? '').toLowerCase()) return 'Başka bir siteden gelen istek kabul edilmez.';
  }
  return '';
}

function govdeOku(req) {
  return new Promise(ok => {
    let boyut = 0, buyuk = false;
    const parcalar = [];
    req.on('data', p => {
      boyut += p.length;
      if (boyut > EN_COK_GOVDE) buyuk = true;
      else parcalar.push(p);
    });
    req.on('end', () => ok(buyuk ? { buyuk } : { metin: Buffer.concat(parcalar).toString('utf8') }));
    req.on('error', () => ok({ buyuk: false, metin: '' }));
  });
}

export function ofisSunucusu({ kok, ayar, kutu, publicKlasoru = path.join(BURADA, 'public') }) {
  const akislar = new Set();
  const yayinla = (olay, veri) => {
    const satir = `event: ${olay}\ndata: ${JSON.stringify(veri)}\n\n`;
    for (const res of akislar) res.write(satir);
  };
  kutu.on('gorev', g => yayinla('gorev', g));
  kutu.on('durum', (id, durum, aktivite) => yayinla('durum', { id, durum, aktivite }));
  kutu.on('log', l => yayinla('log', l));
  const calisanlarKlasoru = path.resolve(kok, 'calisanlar') + path.sep;

  const sunucu = http.createServer(async (req, res) => {
    try {
      const engel = izinliMi(req, ayar);
      if (engel) return hata(res, 403, engel);
      const yol = new URL(req.url, 'http://ofis').pathname;

      if (req.method === 'GET' && yol === '/api/durum') {
        return gonder(res, 200, {
          ofisAdi: ayar.ofisAdi, patron: ayar.patron, mesai: ayar.mesai,
          calisanlar: [GENEL_MUDUR, ...ayar.calisanlar],
          durumlar: kutu.durumlar(),
          gorevler: kutu.liste().slice(0, 50),
          loglar: kutu.loglar.slice(-30),
          claude: { bulundu: dosyaVar(kutu.claudeYolu) },
        });
      }

      if (req.method === 'GET' && yol === '/api/akis') {
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-content-type-options': 'nosniff' });
        res.write('retry: 3000\n\n');
        akislar.add(res);
        const canli = setInterval(() => res.write(': canli\n\n'), CANLI_TUT_MS);
        req.on('close', () => { clearInterval(canli); akislar.delete(res); });
        return;
      }

      if (req.method === 'POST' && yol.startsWith('/api/')) {
        if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return hata(res, 415, 'İstek application/json olmalı.');
        const govde = await govdeOku(req);
        if (govde.buyuk) return hata(res, 413, `İstek en çok ${EN_COK_GOVDE / 1024} KB olabilir.`);
        let veri = {};
        if (govde.metin.trim()) { try { veri = JSON.parse(govde.metin); } catch { return hata(res, 400, 'İstek gövdesi geçerli JSON değil.'); } }

        if (yol === '/api/gorev') {
          try { return gonder(res, 201, kutu.olustur({ metin: veri?.metin, hedef: veri?.hedef })); } catch (e) { return hata(res, 400, e.message); }
        }
        const d = yol.match(/^\/api\/gorev\/(\d+)\/durdur$/);
        if (d) {
          if (!kutu.bul(d[1])) return hata(res, 404, 'Görev bulunamadı.');
          return gonder(res, 200, { tamam: kutu.durdur(d[1]) });
        }
        return hata(res, 404, 'Bulunamadı.');
      }

      if (req.method === 'GET') {
        const g = yol.match(/^\/api\/gorev\/(\d+)$/);
        if (g) {
          const gorev = kutu.bul(g[1]);
          return gorev ? gonder(res, 200, gorev) : hata(res, 404, 'Görev bulunamadı.');
        }
        const r = yol.match(/^\/api\/gorev\/(\d+)\/rapor\/(\d+)$/);
        if (r) {
          const adim = kutu.bul(r[1])?.adimlar?.[Number(r[2])];
          const tam = adim?.raporDosyasi ? path.resolve(kok, adim.raporDosyasi) : '';
          if (!tam.startsWith(calisanlarKlasoru) || !dosyaVar(tam)) return hata(res, 404, 'Rapor bulunamadı.');
          return gonder(res, 200, fs.readFileSync(tam), 'text/plain; charset=utf-8');
        }
        const s = STATIK[yol];
        if (s && dosyaVar(path.join(publicKlasoru, s[0]))) {
          res.writeHead(200, { 'content-type': s[1], 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
          return fs.createReadStream(path.join(publicKlasoru, s[0])).pipe(res);
        }
      }
      return hata(res, 404, 'Bulunamadı.');
    } catch (e) {
      if (!res.headersSent) hata(res, 500, `Sunucu hatası: ${e.message}`);
      else res.end();
    }
  });

  sunucu.on('close', () => { for (const res of akislar) res.end(); akislar.clear(); });
  return sunucu;
}

function baslat() {
  const kok = process.env.OFIS_KOK ? path.resolve(process.env.OFIS_KOK) : BURADA;
  let ayar, olusan;
  try { ({ ayar, olusan } = kur(kok)); } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (process.env.OFIS_PORT) ayar.port = Number(process.env.OFIS_PORT);
  if (olusan.length) console.log(`Yeni çalışan klasörleri açıldı: ${olusan.join(', ')}`);

  const claudeYolu = claudeBul({ ayarYolu: ayar.claudeYolu });
  if (!claudeYolu) console.warn('UYARI: Claude Code bulunamadı. Ofis açılıyor ama görevler çalışmaz. Claude Code\'u kur, terminalde `claude` yazıp giriş yap, sonra ofisi yeniden başlat.');

  const kutu = new GorevKutusu({ kok, ayar, claudeYolu, veriDosyasi: path.join(kok, 'veri', 'gorevler.json') });
  const sunucu = ofisSunucusu({ kok, ayar, kutu });
  sunucu.on('error', e => {
    if (e.code === 'EADDRINUSE') console.error(`${ayar.port} portu dolu: ofis.ayar.json'da port'u değiştir ya da açık olan ofisi kapat.`);
    else console.error(`Sunucu açılamadı: ${e.message}`);
    process.exit(1);
  });
  sunucu.listen(ayar.port, ayar.host, () => {
    const ad = ayar.host === '0.0.0.0' || ayar.host === '::' ? '127.0.0.1' : ayar.host;
    console.log(`${ayar.ofisAdi} açıldı: http://${ad}:${ayar.port}`);
    console.log(`${ayar.calisanlar.length} çalışan + genel müdür hazır. Kapatmak için Ctrl+C.`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) baslat();
