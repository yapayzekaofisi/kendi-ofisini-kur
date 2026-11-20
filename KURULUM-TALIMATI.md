# Kurulum talimatı (Claude Code için)

> Bu dosyayı Claude Code okur ve uygular. Kullanıcıyla Türkçe ve sade konuş; teknik bir terim kullanırsan ne demek olduğunu kısaca söyle. Her adımda ne yaptığını bir cümleyle anlat.

## Kurallar

- Başlarken kullanıcıya şunu açıkça söyle: "Çalışanlarının adını ve işini kendin belirlersin. İstediğin kadar çalışan olabilir (1-15). Ofisini tarayıcıda 3D görürsün."
- Soruları tek tek sor; bir cevap gelmeden sonrakine geçme.
- Sadece kurulum klasöründe çalış; kullanıcının başka dosyalarına dokunma.
- `sunucu.mjs` ve `lib/` içindeki güvenlik kısımlarını değiştirme: API anahtarı temizliği (`temizOrtam`), çalışanların araç listesi (`ajanArgs`), tarayıcı koruması (`izinliMi`).
- Hiçbir yere API anahtarı ekleme. Ofis kullanıcının Claude aboneliğiyle çalışır.
- Çalışanlara Bash (komut çalıştırma) verme.
- Hiçbir komutu yönetici (administrator, sudo) yetkisiyle çalıştırma.
- İş tanımlarındaki **YASAK** bölümünü silme, gevşetme.
- Komutları tek tek çalıştır; `&&` ile birleştirme. Kullanıcı her komutu ayrı ayrı görüp onaylayabilsin.

## 0. Ön kontrol

Claude Code zaten çalışıyor; onu ayrıca kontrol etme. Şu iki komutu tek tek çalıştır ve sonucu kullanıcıya söyle:

```bash
node --version
```

```bash
git --version
```

- Node yoksa ya da 20'den eskiyse: kullanıcıdan [nodejs.org](https://nodejs.org) adresinden LTS sürümünü kurmasını, sonra terminali kapatıp yeniden açmasını iste. Kurulmadan devam etme.
- Git yoksa sorun değil; 2. adımda zip yolunu kullan.

## 1. Soruları sor

Sırayla, tek tek sor:

1. **Ofisinin adı ne olsun?** (en çok 40 harf; 3D tabelada yazar)
2. **Çalışanlar sana nasıl hitap etsin?** (örneğin "Usta", "Ali Bey")
3. **Ne iş yapıyorsun, ofisin sana en çok hangi işlerde yardım etsin?** Bu cevaba göre bir örnek ekip öner. Örneğin küçük bir dükkân için: internette araştırma yapan bir Araştırmacı, gönderi ve tanıtım metni yazan bir Yazar, haftalık planı çıkaran bir Planlamacı, müşteri mesajlarına cevap taslağı hazırlayan bir Asistan.
4. **Kaç çalışan istiyorsun?** (1-15; başlangıç için 3-4 öner)
5. Her çalışan için: **adı**, **rolü**, **işi** (1-3 cümle) ve **internette arama yapması gerekiyor mu?**

İstersen şunları da sor: ekipler (aynı ekiptekiler 3D ofiste aynı odada oturur) ve mesai saatleri.

Kullanıcıya hatırlat: hiçbir çalışan onun adına bir şey yayınlamaz, mesaj ya da e-posta göndermez, para işine girmez; sadece taslak ve rapor hazırlar.

## 2. Depoyu al

Ofis, Claude Code'un şu an açık olduğu klasörün içine `kendi-ofisini-kur` adıyla kurulur. Klonlamadan önce kullanıcıya bu klasörün tam yolunu söyle.

Önce bak: bu klasörde `kendi-ofisini-kur/baslangic-ofisi` zaten varsa yeniden klonlama; o klasörü kullan ve 3. adıma geç. Yoksa:

```bash
git clone https://github.com/yapayzekaofisi/kendi-ofisini-kur
```

Sonraki bütün komutları `kendi-ofisini-kur/baslangic-ofisi` klasöründe çalıştır.

Git yoksa `https://github.com/yapayzekaofisi/kendi-ofisini-kur/archive/refs/heads/main.zip` dosyasını indir, aç ve `kendi-ofisini-kur-main/baslangic-ofisi` klasörüne geç.

## 3. ofis.ayar.json dosyasını yaz

Depodaki `baslangic-ofisi/ofis.ayar.json` sadece bir örnektir ("Yapay Zeka Ofisim", 3 çalışan); onun üzerine yaz. Dosyayı kullanıcının cevaplarıyla baştan yaz. Biçimi şu örnekteki gibi:

```json
{
  "ofisAdi": "Atölye Ofisi",
  "patron": "Usta",
  "port": 4800,
  "host": "127.0.0.1",
  "model": "sonnet",
  "mesai": { "baslangic": "09:00", "bitis": "18:00" },
  "calisanlar": [
    {
      "ad": "Araştırmacı",
      "rol": "Pazar Araştırmacısı",
      "is": "Verilen konuyu internette araştırır, güvenilir kaynaklardan kısa ve maddeli bir özet çıkarır.",
      "web": true
    },
    {
      "ad": "Yazar",
      "rol": "Metin Yazarı",
      "is": "Ürün tanıtımı, gönderi açıklaması ve e-posta taslağı gibi kısa metinleri sade bir Türkçeyle yazar.",
      "ekip": "İçerik"
    },
    {
      "ad": "Planlamacı",
      "rol": "Planlamacı",
      "is": "Büyük işleri adımlara böler, haftalık plan ve yapılacaklar listesi hazırlar."
    }
  ]
}
```

Kurallar:

- `ad` ve `is` her çalışanda zorunlu. Klasör adı (`id`) addan kendiliğinden üretilir.
- "Genel Müdür" adı ayrılmıştır; çalışanlara verme.
- En az 1, en çok 15 çalışan.
- `web: true` sadece internette arama gereken çalışanlara.
- `model`: varsayılan `sonnet`. Kullanıcı limitinin çabuk dolmasından çekiniyorsa `haiku` öner.

## 4. Klasörleri kur ve iş tanımlarını zenginleştir

```bash
node kur.mjs
```

Bu komut her çalışan için `calisanlar/<id>/CLAUDE.md` iş tanımını yazar. Sonra her birini aç ve "İşin" bölümünü kullanıcının anlattıklarıyla zenginleştir: iyi bir çıktı neye benzer, hangi üslupla yazar, neye dikkat eder, kısa bir örnek. **YASAK** bölümünü silme; çalışana yayınlama, gönderme ya da ödeme izni ekleme.

## 5. Testleri çalıştır

```bash
npm test
```

Hepsi geçmeli. Geçmeyen olursa hatayı kullanıcıya göster ve sebebini düzelt; testleri geçsin diye testi değiştirme.

## 6. Ofisi aç

```bash
npm start
```

Bu komut kapanmaz: arka planda çalıştır ya da kullanıcıdan ayrı bir terminalde çalıştırmasını iste. Sonra kullanıcıya tarayıcıda `http://127.0.0.1:4800` adresini açmasını söyle.

- "4800 portu dolu" yazarsa `ofis.ayar.json` içindeki `port`'u değiştir (örneğin 4810).
- Panelde "Claude Code bulunamadı" yazarsa kullanıcı terminalde `claude` yazıp giriş yapmalı; Claude Code başka bir yere kuruluysa yolunu `claudeYolu` alanına yaz.

## 7. İlk deneme görevi

Kullanıcının ekibine uyan küçük bir görev öner ve panelden vermesini söyle. Örneğin: "Yazar: dükkânım için 3 kısa gönderi açıklaması yaz." Görev bitince panelde "Raporu aç" bağlantısı çıkar; rapor dosyası `calisanlar/<id>/raporlar/` altındadır. Her görevin aboneliğinin limitinden biraz kullandığını söyle.

## 8. Sonrası

Kullanıcıya şu sayfaları göster:

- [Buluta taşıma](rehber/1-buluta-tasima.md)
- [Telefondan erişim](rehber/2-telefondan-erisim.md)
- [Codex ve Gemini](rehber/3-codex-ve-gemini.md)
- [Token ve limitler](rehber/4-token-ve-limitler.md)
- [Güvenlik](rehber/5-guvenlik.md)

Son olarak: yeni bir çalışan eklemek için `ofis.ayar.json`'a ekleyip ofisi yeniden başlatması yeterli; klasörü ve iş tanımı kendiliğinden açılır.
