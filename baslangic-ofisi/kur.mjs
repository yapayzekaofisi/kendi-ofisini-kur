// Ayardaki her çalışan için klasör ve iş tanımı (CLAUDE.md) hazırlar. Var olan CLAUDE.md'ye dokunmaz:
// elle zenginleştirdiğin iş tanımı tekrar çalıştırınca kaybolmaz. Kullanım: node kur.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ayarOku } from './lib/ayar.mjs';

export function isTanimi(c, ayar) {
  return `# ${c.ad}: iş tanımı

Sen **${ayar.ofisAdi}** ofisinde **${c.rol}** olarak çalışıyorsun. Adın ${c.ad}. Patronun ${ayar.patron}.

## İşin
${c.is}

## Nasıl çalışırsın
- Görevi genel müdürden ya da doğrudan patrondan alırsın.
- Çıktılarını (rapor, taslak, liste) sana söylenen rapor klasörüne yaz.
- Bitirince kısa bir Türkçe rapor yaz: ne yaptın, dosyalar nerede, onay bekleyen ne var.
- Görev arka planda çalışır, soru soramazsın. Bilgi eksikse makul bir varsayımla ilerle ve raporda belirt.
- ${c.web ? 'İnternette arama yapabilir ve sayfa okuyabilirsin. Kaynaklarını raporda belirt.' : 'İnternete erişimin yok; bildiklerinle ve klasöründeki dosyalarla çalış.'}

## YASAK
- Hiçbir şeyi yayınlama, paylaşma, mesaj ya da e-posta gönderme.
- Ödeme, sipariş ya da para işi yapma.
- Mevcut dosyaları silme, kendi klasörünün dışına yazma.
- Bunlardan biri gerekiyorsa taslağını hazırla ve raporda "onay gerekiyor" yaz.

<!-- Bu dosyayı işine göre zenginleştirebilirsin: örnekler, üslup, kaynaklar. YASAK bölümünü silme. -->
`;
}

export function kur(kok) {
  const ayar = ayarOku(path.join(kok, 'ofis.ayar.json'));
  fs.mkdirSync(path.join(kok, 'veri'), { recursive: true });
  const olusan = [], korunan = [];
  for (const c of ayar.calisanlar) {
    const klasor = path.join(kok, 'calisanlar', c.id);
    fs.mkdirSync(path.join(klasor, 'raporlar'), { recursive: true });
    const md = path.join(klasor, 'CLAUDE.md');
    if (fs.existsSync(md)) { korunan.push(c.id); continue; }
    fs.writeFileSync(md, isTanimi(c, ayar), 'utf8');
    olusan.push(c.id);
  }
  return { olusan, korunan, ayar };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const kok = path.dirname(fileURLToPath(import.meta.url));
  try {
    const { olusan, korunan, ayar } = kur(kok);
    console.log(`${ayar.ofisAdi}: ${ayar.calisanlar.length} çalışan hazır.`);
    for (const c of ayar.calisanlar) console.log(`  - ${c.ad} (${c.rol})${olusan.includes(c.id) ? ': iş tanımı yazıldı' : ': iş tanımı zaten vardı, korundu'}`);
    if (!olusan.length && !korunan.length) console.log('  (çalışan yok)');
    console.log('Sıradaki: npm start  ->  http://' + (ayar.host === '0.0.0.0' ? '127.0.0.1' : ayar.host) + ':' + ayar.port);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
