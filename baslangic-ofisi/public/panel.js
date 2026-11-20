// Panel: durumu sunucudan alır, 3D ofisi çizer; görev formunu, görev listesini ve canlı günlüğü yönetir.

// 3D motorun beklediği çalışan biçimi: { id, rol, kisa, ekip }. İlk sıradaki genel müdürdür.
export function sahneCalisanlari(durum) {
  return durum.calisanlar.map(c => ({
    id: c.id,
    rol: c.rol === c.ad ? c.ad : `${c.ad} (${c.rol})`,
    kisa: c.ad,
    ekip: c.ekip || '',
  }));
}

// Ekipler ajanların "ekip" alanından çıkar; hiç ekip yoksa motor herkesi tek odaya dizer.
export function sahneEkipleri(durum) {
  return [...new Set(durum.calisanlar.map(c => c.ekip).filter(Boolean))].map(ad => ({ id: ad, ad }));
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, h => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[h]));

const DURUM_YAZI = {
  sirada: 'Sırada', planlaniyor: 'Planlanıyor', calisiyor: 'Çalışıyor', bitti: 'Bitti', hata: 'Hata',
  durduruldu: 'Durduruldu', 'yarida-kaldi': 'Yarıda kaldı', atlandi: 'Atlandı',
};
const SURUYOR = new Set(['sirada', 'planlaniyor', 'calisiyor']);
const saat = iso => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

if (typeof document !== 'undefined') baslat();

async function baslat() {
  const $ = s => document.querySelector(s);
  const hedef = $('#hedef');
  const gorevler = new Map();
  let adlar = new Map();
  let sahne = null;

  const rozet = (yazi, hal) => { $('#baglanti').textContent = yazi; $('#baglanti').dataset.hal = hal; };

  async function durumuAl() {
    const r = await fetch('/api/durum');
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).hata || `Sunucu ${r.status} döndü`);
    return r.json();
  }

  let D;
  try { D = await durumuAl(); } catch (e) {
    rozet(`Sunucuya ulaşılamadı: ${e.message}`, 'kopuk');
    return;
  }
  adlar = new Map(D.calisanlar.map(c => [c.id, c.ad]));
  for (const g of D.gorevler) gorevler.set(g.id, g);
  document.title = D.ofisAdi;
  $('#ofisAdi').textContent = D.ofisAdi;
  $('#uyari').hidden = D.claude.bulundu;
  for (const c of D.calisanlar.slice(1)) hedef.add(new Option(c.rol === c.ad ? c.ad : `${c.ad} (${c.rol})`, c.id));
  for (const l of D.loglar || []) gunlugeEkle(l);
  listeyiCiz();

  try {
    const { OfisSahnesi } = await import('/ofis3d.js');
    sahne = new OfisSahnesi($('#ofis3d'), {
      calisanlar: sahneCalisanlari(D), ekipler: sahneEkipleri(D), ofisAdi: D.ofisAdi, mesai: D.mesai, logo: null,
      secildi: id => { hedef.value = id === 'genel-mudur' ? 'otomatik' : id; $('#metin').focus(); },
    });
    sahne.gecmis(D.gorevler);
    for (const [id, d] of Object.entries(D.durumlar)) sahne.durum(id, d.durum, d.aktivite);
  } catch (e) {
    console.error('3D görünüm açılamadı', e);
    $('#sahneHata').hidden = false;
  }

  function gorevHtml(g) {
    const kim = g.hedef === 'otomatik' ? 'Genel müdür planlıyor' : (adlar.get(g.hedef) ?? g.hedef);
    const adimlar = (g.adimlar || []).map((a, i) => `<li><span class="nokta ${esc(a.durum)}"></span>`
      + `<span>${esc(adlar.get(a.birim) ?? a.birim)}: ${esc(DURUM_YAZI[a.durum] ?? a.durum)}</span>`
      + (a.raporDosyasi ? ` <a href="/api/gorev/${esc(g.id)}/rapor/${esc(i)}" target="_blank" rel="noopener">Raporu aç</a>` : '')
      + '</li>').join('');
    return `<li class="gorev">
      <div class="gorev-ust"><span>#${esc(g.id)} · ${esc(kim)} · ${esc(saat(g.olustu))}</span><span class="durum ${esc(g.durum)}">${esc(DURUM_YAZI[g.durum] ?? g.durum)}</span></div>
      <p class="gorev-metin">${esc(g.metin)}</p>
      ${g.plan?.ozet ? `<p class="plan">Plan: ${esc(g.plan.ozet)}</p>` : ''}
      ${adimlar ? `<ol class="adimlar">${adimlar}</ol>` : ''}
      ${g.hata ? `<p class="gorev-hata">${esc(g.hata)}</p>` : ''}
      ${SURUYOR.has(g.durum) ? `<button type="button" class="durdur" data-id="${esc(g.id)}">Durdur</button>` : ''}
    </li>`;
  }

  function listeyiCiz() {
    const liste = [...gorevler.values()].sort((a, b) => b.id - a.id).slice(0, 30);
    $('#gorevYok').hidden = liste.length > 0;
    $('#gorevler').innerHTML = liste.map(gorevHtml).join('');
  }

  function gunlugeEkle(l) {
    const li = document.createElement('li');
    const t = document.createElement('time');
    t.textContent = saat(l.zaman);
    const b = document.createElement('b');
    b.textContent = `${l.kim}: `;
    li.append(t, b, document.createTextNode(l.metin));
    $('#gunluk').prepend(li);
    while ($('#gunluk').children.length > 40) $('#gunluk').lastElementChild.remove();
  }

  $('#gorevler').addEventListener('click', async e => {
    const b = e.target.closest('button.durdur');
    if (!b) return;
    b.disabled = true;
    await fetch(`/api/gorev/${b.dataset.id}/durdur`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
  });

  const mesaj = (yazi, hata = false) => { $('#formMesaj').textContent = yazi; $('#formMesaj').classList.toggle('hata', hata); };
  $('#gorevFormu').addEventListener('submit', async e => {
    e.preventDefault();
    const metin = $('#metin').value.trim();
    if (!metin) return;
    $('#gonder').disabled = true;
    mesaj('');
    try {
      const r = await fetch('/api/gorev', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ metin, hedef: hedef.value }) });
      const v = await r.json();
      if (!r.ok) throw new Error(v.hata || 'Görev verilemedi.');
      gorevler.set(v.id, v);
      listeyiCiz();
      $('#metin').value = '';
      mesaj(`Görev ${v.id} sıraya alındı.`);
    } catch (err) {
      mesaj(err.message, true);
    } finally {
      $('#gonder').disabled = false;
    }
  });
  $('#metin').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#gorevFormu').requestSubmit(); });

  // Canlı akış: kopup geri gelince kaçan değişiklikler için durumu baştan alırız.
  let kopmustu = false;
  const akis = new EventSource('/api/akis');
  akis.onopen = async () => {
    rozet('Canlı', 'canli');
    if (!kopmustu) return;
    kopmustu = false;
    try {
      const yeni = await durumuAl();
      for (const g of yeni.gorevler) { gorevler.set(g.id, g); sahne?.gorev(g); }
      for (const [id, d] of Object.entries(yeni.durumlar)) sahne?.durum(id, d.durum, d.aktivite);
      listeyiCiz();
    } catch {}
  };
  akis.onerror = () => { kopmustu = true; rozet('Bağlantı koptu, yeniden deneniyor…', 'kopuk'); };
  akis.addEventListener('gorev', e => { const g = JSON.parse(e.data); gorevler.set(g.id, g); sahne?.gorev(g); listeyiCiz(); });
  akis.addEventListener('durum', e => { const d = JSON.parse(e.data); sahne?.durum(d.id, d.durum, d.aktivite); });
  akis.addEventListener('log', e => gunlugeEkle(JSON.parse(e.data)));
}
