// Görev kutusu: patronun verdiği görevleri sıraya alır, genel müdüre planlatır,
// adımları çalışanlara tek tek yaptırır, raporları klasörlere yazar ve her şeyi diske kaydeder.
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { GENEL_MUDUR, idUret } from './ayar.mjs';
import { surecBaslat, planArgs, ajanArgs, codexArgs, akisOku, girisIpucu } from './motor.mjs';
import { kurallar } from './kurallar.mjs';
import { isTanimi } from '../kur.mjs';

const EN_COK_GOREV = 200;
const EN_COK_METIN = 20000;
const EN_COK_ADIM = 5;
const ONCEKI_RAPOR = 4000;
const EN_COK_LOG = 100;
const PLAN_SURESI = 5 * 60_000;
const ADIM_SURESI = 30 * 60_000;
const YARIM = ['sirada', 'planlaniyor', 'calisiyor'];

const CLAUDE_YOK = 'Claude Code bulunamadı. Önce Claude Code\'u kur ve terminalde `claude` yazıp hesabınla giriş yap. '
  + 'Başka bir yere kurduysan ofis.ayar.json içine "claudeYolu" yaz.';

const simdi = () => new Date().toISOString();
const bugun = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dosyaVar = d => { try { return !!d && fs.statSync(d).isFile(); } catch { return false; } };
const kisa = (m, n = 60) => (m.length > n ? m.slice(0, n - 1) + '…' : m);

const ARAC_YAZISI = {
  Read: 'Dosya okuyor', Write: 'Dosya yazıyor', Edit: 'Dosya düzenliyor', Glob: 'Dosya arıyor', Grep: 'Dosyalarda arıyor',
  WebSearch: 'İnternette arıyor', WebFetch: 'Sayfa okuyor',
};
function aracYazisi({ ad, girdi }) {
  const dosya = girdi?.file_path ? `: ${path.basename(String(girdi.file_path))}` : '';
  return kisa((ARAC_YAZISI[ad] ?? `${ad} kullanıyor`) + dosya);
}

function planSistemi(ayar) {
  const liste = ayar.calisanlar.map(c => `- ${c.id}: ${c.ad} (${c.rol}). ${c.is}`).join('\n');
  return `Sen ${ayar.ofisAdi} ofisinin genel müdürüsün. Patronun ${ayar.patron}. Patronun görevini uygun çalışanlara adım adım dağıtırsın; işi kendin yapmazsın.

Çalışanlar (id: ad, rol, iş):
${liste}

Kurallar:
- En çok ${EN_COK_ADIM} adım. Her adım tek bir çalışana gider; bir adımın raporu bir sonraki adıma aktarılır.
- Sadece listedeki id'leri kullan. Uygun çalışan yoksa "adimlar" boş liste olsun ve "ozet"e nedenini yaz.
- Her adımın görevini, çalışan başka bir şey bilmeden yapabileceği kadar açık yaz.
- Cevabın SADECE şu biçimde JSON olsun, başka hiçbir şey yazma:
{"ozet":"tek cümlelik plan","adimlar":[{"birim":"<id>","gorev":"çalışana verilecek görev"}]}`;
}

function planCoz(metin, ayar) {
  const bas = metin.indexOf('{'), son = metin.lastIndexOf('}');
  let o = null;
  if (bas >= 0 && son > bas) { try { o = JSON.parse(metin.slice(bas, son + 1)); } catch {} }
  if (!o || typeof o !== 'object' || !Array.isArray(o.adimlar)) throw new Error('Genel müdürden gelen plan okunamadı: ' + kisa(metin.trim() || '(boş cevap)', 200));
  const idler = new Set(ayar.calisanlar.map(c => c.id));
  const adimlar = o.adimlar
    .map(a => ({ birim: idUret(String(a?.birim ?? '')), gorev: typeof a?.gorev === 'string' ? a.gorev.trim() : '' }))
    .filter(a => idler.has(a.birim) && a.gorev)
    .slice(0, EN_COK_ADIM);
  return { ozet: typeof o.ozet === 'string' ? o.ozet.trim() : '', adimlar };
}

// stream-json/json çıktısındaki son "result" satırı.
function sonucSatiri(stdout) {
  const satirlar = String(stdout).trim().split(/\r?\n/);
  for (let i = satirlar.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(satirlar[i]); if (o?.type === 'result') return o; } catch {}
  }
  return null;
}

function hataMetni(r, sonucMetni = '') {
  const metin = r.zamanAsimi
    ? 'Süre doldu, görev yarıda kesildi.'
    : (String(sonucMetni || '').trim() || String(r.stderr || '').trim().slice(-600) || `Program ${r.kod} koduyla kapandı.`);
  const ipucu = girisIpucu(`${sonucMetni}\n${r.stderr}`);
  return ipucu ? `${metin} — ${ipucu}` : metin;
}

export class GorevKutusu extends EventEmitter {
  constructor({ kok, ayar, claudeYolu = null, codexYolu = null, veriDosyasi }) {
    super();
    this.kok = kok;
    this.ayar = ayar;
    this.claudeYolu = claudeYolu;
    this.codexYolu = codexYolu || ayar.codexYolu || null;
    this.veriDosyasi = veriDosyasi;
    this.gorevler = [];
    this.sonId = 0;
    this.loglar = [];
    this._durum = {};
    for (const id of [GENEL_MUDUR.id, ...ayar.calisanlar.map(c => c.id)]) this._durum[id] = { durum: 'bosta', aktivite: '' };
    this._durdurulan = new Set();
    this._aktif = null;
    this._yuruyor = false;
    this._yukle();
  }

  liste() { return this.gorevler; }
  bul(id) { return this.gorevler.find(g => g.id === Number(id)); }
  durumlar() { return Object.fromEntries(Object.entries(this._durum).map(([k, v]) => [k, { ...v }])); }

  olustur({ metin, hedef = 'otomatik' } = {}) {
    const m = typeof metin === 'string' ? metin.trim() : '';
    if (!m) throw new Error('Görev metni boş olamaz.');
    if (m.length > EN_COK_METIN) throw new Error(`Görev metni en çok ${EN_COK_METIN} karakter olabilir.`);
    let h = String(hedef ?? '').trim() || 'otomatik';
    if (h === GENEL_MUDUR.id) h = 'otomatik';
    if (h !== 'otomatik' && !this._calisan(h)) throw new Error(`Bilinmeyen hedef: ${h}. "otomatik" ya da bir çalışanın id'si olmalı.`);
    const g = { id: ++this.sonId, metin: m, hedef: h, durum: 'sirada', olustu: simdi(), adimlar: [] };
    this.gorevler.unshift(g);
    this._kirp();
    this._degisti(g);
    this._log(this.ayar.patron, `Görev ${g.id}: ${kisa(m, 120)}`);
    setImmediate(() => this._sirayiYurut());
    return g;
  }

  durdur(id) {
    const g = this.bul(id);
    if (!g) return false;
    if (g.durum === 'sirada') {
      g.durum = 'durduruldu';
      g.bitti = simdi();
      this._degisti(g);
      return true;
    }
    if (g.durum !== 'planlaniyor' && g.durum !== 'calisiyor') return false;
    this._durdurulan.add(g.id);
    if (this._aktif?.gorevId === g.id) this._aktif.durdur();
    this._log(this.ayar.patron, `Görev ${g.id} durduruluyor`);
    return true;
  }

  // --- iç işler ---

  _calisan(id) { return this.ayar.calisanlar.find(c => c.id === id); }

  _yukle() {
    let veri = null;
    if (fs.existsSync(this.veriDosyasi)) {
      try { veri = JSON.parse(fs.readFileSync(this.veriDosyasi, 'utf8')); } catch {
        // Bozuk dosyayı silmiyoruz; yanına kopyalayıp boş başlıyoruz.
        try { fs.copyFileSync(this.veriDosyasi, `${this.veriDosyasi}.bozuk`); } catch {}
      }
    }
    const liste = Array.isArray(veri?.gorevler) ? veri.gorevler.filter(g => g && Number.isInteger(g.id)) : [];
    let degisti = false;
    for (const g of liste) {
      if (!Array.isArray(g.adimlar)) g.adimlar = [];
      if (!YARIM.includes(g.durum)) continue;
      g.durum = 'yarida-kaldi';
      for (const a of g.adimlar) if (YARIM.includes(a.durum)) a.durum = 'yarida-kaldi';
      degisti = true;
    }
    liste.sort((a, b) => b.id - a.id);
    this.gorevler = liste.slice(0, EN_COK_GOREV);
    this.sonId = Math.max(Number(veri?.sonId) || 0, 0, ...this.gorevler.map(g => g.id));
    if (degisti) this._kaydet();
  }

  _kirp() {
    while (this.gorevler.length > EN_COK_GOREV) {
      const i = this.gorevler.findLastIndex(g => !YARIM.includes(g.durum));
      if (i < 0) break;
      this.gorevler.splice(i, 1);
    }
  }

  _kaydet() {
    const veri = JSON.stringify({ sonId: this.sonId, gorevler: this.gorevler }, null, 1);
    try {
      fs.mkdirSync(path.dirname(this.veriDosyasi), { recursive: true });
      const yeni = `${this.veriDosyasi}.yeni`;
      fs.writeFileSync(yeni, veri);
      try { fs.renameSync(yeni, this.veriDosyasi); } catch { fs.writeFileSync(this.veriDosyasi, veri); fs.rmSync(yeni, { force: true }); }
    } catch (e) {
      this._log('Ofis', `Görevler kaydedilemedi: ${e.message}`);
    }
  }

  _degisti(g) {
    this._kaydet();
    this.emit('gorev', g);
  }

  _log(kim, metin) {
    const satir = { zaman: simdi(), kim, metin };
    this.loglar.push(satir);
    if (this.loglar.length > EN_COK_LOG) this.loglar.shift();
    this.emit('log', satir);
  }

  _durumAyarla(id, durum, aktivite = '') {
    this._durum[id] = { durum, aktivite };
    this.emit('durum', id, durum, aktivite);
  }

  _claudeVar() { return dosyaVar(this.claudeYolu); }

  _calistir(g, secenek) {
    const { sonuc, durdur } = surecBaslat(secenek);
    this._aktif = { gorevId: g.id, durdur };
    if (this._durdurulan.has(g.id)) durdur();
    return sonuc.finally(() => { this._aktif = null; });
  }

  _gorevBitir(g, durum, hata) {
    g.durum = durum;
    if (hata) g.hata = hata;
    g.bitti = simdi();
    this._degisti(g);
    this._log('Ofis', `Görev ${g.id}: ${durum === 'bitti' ? 'bitti' : durum === 'durduruldu' ? 'durduruldu' : 'hata: ' + kisa(hata, 160)}`);
    return null;
  }

  async _sirayiYurut() {
    if (this._yuruyor) return;
    this._yuruyor = true;
    try {
      for (;;) {
        const g = this.gorevler.findLast(x => x.durum === 'sirada');
        if (!g) break;
        try { await this._yurut(g); } catch (e) { this._gorevBitir(g, 'hata', `Beklenmeyen hata: ${e.message}`); }
        this._durdurulan.delete(g.id);
      }
    } finally {
      this._yuruyor = false;
    }
  }

  async _yurut(g) {
    if (g.hedef === 'otomatik') {
      g.durum = 'planlaniyor';
      this._degisti(g);
      const plan = await this._planla(g);
      if (!plan) return;
      g.plan = { ozet: plan.ozet };
      g.adimlar = plan.adimlar.map(a => ({ ...a, durum: 'sirada' }));
    } else {
      g.adimlar = [{ birim: g.hedef, gorev: g.metin, durum: 'sirada' }];
    }
    g.durum = 'calisiyor';
    this._degisti(g);

    let onceki = '';
    for (let i = 0; i < g.adimlar.length; i++) {
      if (this._durdurulan.has(g.id)) break;
      const a = g.adimlar[i];
      await this._adim(g, a, i, onceki);
      if (a.durum !== 'bitti') break;
      onceki = a.rapor ?? '';
    }

    const hatali = g.adimlar.find(a => a.durum === 'hata');
    const durdu = this._durdurulan.has(g.id) || g.adimlar.some(a => a.durum === 'durduruldu');
    for (const a of g.adimlar) if (a.durum === 'sirada') a.durum = 'atlandi';
    if (hatali) return this._gorevBitir(g, 'hata', `${this._calisan(hatali.birim)?.ad ?? hatali.birim}: ${hatali.hata}`);
    return this._gorevBitir(g, durdu ? 'durduruldu' : 'bitti');
  }

  async _planla(g) {
    const gm = GENEL_MUDUR.id;
    if (!this._claudeVar()) {
      this._durumAyarla(gm, 'hata', 'Claude Code yok');
      return this._gorevBitir(g, 'hata', CLAUDE_YOK);
    }
    this._durumAyarla(gm, 'dusunuyor', 'Plan yapıyor');
    const r = await this._calistir(g, {
      komut: this.claudeYolu, args: planArgs(planSistemi(this.ayar), this.ayar.model), cwd: this.kok, girdi: g.metin, zamanAsimiMs: PLAN_SURESI,
    });
    if (r.durduruldu) {
      this._durumAyarla(gm, 'bosta');
      return this._gorevBitir(g, 'durduruldu');
    }
    const sonuc = sonucSatiri(r.stdout);
    if (r.kod !== 0 || !sonuc || sonuc.is_error) {
      this._durumAyarla(gm, 'hata', 'Plan yapamadı');
      return this._gorevBitir(g, 'hata', 'Genel müdür plan yapamadı: ' + hataMetni(r, sonuc?.result));
    }
    let plan;
    try { plan = planCoz(String(sonuc.result ?? ''), this.ayar); } catch (e) {
      this._durumAyarla(gm, 'hata', 'Plan okunamadı');
      return this._gorevBitir(g, 'hata', e.message);
    }
    if (!plan.adimlar.length) {
      this._durumAyarla(gm, 'hata', 'Uygun çalışan yok');
      return this._gorevBitir(g, 'hata', 'Genel müdür uygun çalışan bulamadı: ' + (plan.ozet || 'nedenini yazmadı'));
    }
    this._durumAyarla(gm, 'bosta');
    this._log(GENEL_MUDUR.ad, `Plan: ${plan.ozet || '-'} (${plan.adimlar.length} adım)`);
    return plan;
  }

  async _adim(g, a, i, onceki) {
    const c = this._calisan(a.birim);
    const klasor = path.join(this.kok, 'calisanlar', c.id);
    const ad = `${bugun()}-gorev-${g.id}${g.adimlar.length > 1 ? `-${i + 1}` : ''}`;
    const raporRel = `raporlar/${ad}`;
    const raporKlasoru = path.join(klasor, 'raporlar', ad);
    fs.mkdirSync(raporKlasoru, { recursive: true });
    const tanimDosyasi = path.join(klasor, 'CLAUDE.md');
    if (!dosyaVar(tanimDosyasi)) fs.writeFileSync(tanimDosyasi, isTanimi(c, this.ayar), 'utf8');

    a.durum = 'calisiyor';
    a.basladi = simdi();
    this._durumAyarla(c.id, 'calisiyor', 'Göreve başladı');
    this._degisti(g);
    this._log(c.ad, `Görev ${g.id}: ${kisa(a.gorev, 120)}`);

    let girdi = `Görev: ${a.gorev}`;
    if (g.hedef === 'otomatik' && a.gorev !== g.metin) girdi += `\n\nPatronun asıl isteği: ${g.metin}`;
    if (onceki) girdi += `\n\nÖnceki adımın raporu:\n${onceki.slice(0, ONCEKI_RAPOR)}`;
    const ek = kurallar(c, this.ayar, raporRel);

    let r = null, rapor = '', hata = '';
    if (c.motor === 'codex') {
      if (!this.codexYolu) hata = 'Bu çalışan Codex ile çalışıyor ama ofis.ayar.json içinde "codexYolu" yok.';
      else {
        const son = path.join(raporKlasoru, '.codex-son-mesaj.txt');
        this._durumAyarla(c.id, 'calisiyor', 'Codex çalışıyor');
        r = await this._calistir(g, {
          komut: this.codexYolu, args: codexArgs(klasor, son), cwd: klasor, zamanAsimiMs: ADIM_SURESI,
          girdi: `${fs.readFileSync(tanimDosyasi, 'utf8')}\n\n${ek}\n\n${girdi}`,
        });
        try { rapor = fs.readFileSync(son, 'utf8'); } catch {}
        fs.rmSync(son, { force: true });
        if (!r.durduruldu && (r.kod !== 0 || !rapor.trim())) hata = hataMetni(r);
      }
    } else if (!this._claudeVar()) {
      hata = CLAUDE_YOK;
    } else {
      let sonuc = null;
      r = await this._calistir(g, {
        komut: this.claudeYolu, args: ajanArgs(c, ek, this.ayar.model), cwd: klasor, girdi, zamanAsimiMs: ADIM_SURESI,
        satirGeldi: s => {
          const o = akisOku(s);
          if (o.tur === 'arac') this._durumAyarla(c.id, 'calisiyor', aracYazisi(o));
          else if (o.tur === 'sonuc') sonuc = o;
        },
      });
      rapor = sonuc?.metin ?? '';
      if (!r.durduruldu && (r.kod !== 0 || !sonuc || sonuc.hata)) hata = hataMetni(r, sonuc?.metin);
    }

    if (r?.durduruldu) {
      a.durum = 'durduruldu';
      this._durumAyarla(c.id, 'bosta');
    } else if (hata) {
      a.durum = 'hata';
      a.hata = hata;
      this._durumAyarla(c.id, 'hata', kisa(hata));
    } else {
      // Ajan kendi rapor.md'sini yazdıysa ona dokunmayız; ofisin özeti yanına ayrı dosya olarak yazılır.
      const dosya = dosyaVar(path.join(raporKlasoru, 'rapor.md')) ? 'ofis-ozeti.md' : 'rapor.md';
      const govde = `# ${c.ad}: görev ${g.id}\n\n> ${a.gorev.replace(/\r?\n/g, '\n> ')}\n\n${rapor.trim()}\n`;
      fs.writeFileSync(path.join(raporKlasoru, dosya), govde, 'utf8');
      a.durum = 'bitti';
      a.rapor = rapor.trim().slice(0, ONCEKI_RAPOR);
      a.raporDosyasi = `calisanlar/${c.id}/${raporRel}/${dosya}`;
      this._durumAyarla(c.id, 'bitti', 'Raporu yazdı');
    }
    a.bitti = simdi();
    this._degisti(g);
  }
}
