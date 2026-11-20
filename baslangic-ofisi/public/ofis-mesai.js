// 3D ofisin mesai kuralları (saf mantık; sahne ve testler kullanır).
// Mesai içinde herkes ofiste. Mesai dışında işi olmayan yatakhanedeki odasına gider;
// işi süren ya da sırada işi olan ofiste kalır, güvenlik nöbet için hep ofistedir.

const VARSAYILAN = { baslangic: 480, bitis: 1140 }; // 08:00-19:00

export function dakika(ss) {
  const m = /^(\d\d):(\d\d)$/.exec(ss || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function mesaideMi(dk, mesai) {
  const b = dakika(mesai?.baslangic) ?? VARSAYILAN.baslangic;
  const s = dakika(mesai?.bitis) ?? VARSAYILAN.bitis;
  return b <= s ? dk >= b && dk < s : dk >= b || dk < s;
}

export function nobetciMi(c) {
  return /güvenlik|guvenlik/i.test(`${c?.id || ''} ${c?.rol || ''}`);
}

const IS_SURUYOR = new Set(['calisiyor', 'dusunuyor', 'planlaniyor']);
export function mesgulMu({ durum, kuyruk, zarfBekliyor }) {
  return IS_SURUYOR.has(durum) || (kuyruk?.length || 0) > 0 || zarfBekliyor > 0;
}

export function olmasiGerekenYer({ dk, mesai, nobetci, mesgul }) {
  return nobetci || mesgul || mesaideMi(dk, mesai) ? 'ofis' : 'ev';
}

// Yatakhane odaları tek sırada ya da ortadaki koridorun iki yanında dizilebilir.
// Sahne ikisini de dener, ofisle birlikte ekrana en büyük sığanı seçer (telefonda dar ekran, bilgisayarda geniş).
export function yatakhaneSecenekleri(kisi) {
  if (!kisi) return [];
  return kisi > 1 ? [{ sutun: 1, sira: kisi }, { sutun: 2, sira: Math.ceil(kisi / 2) }] : [{ sutun: 1, sira: 1 }];
}
