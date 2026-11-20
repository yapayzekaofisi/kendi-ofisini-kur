# Güvenlik

Ofisini kurmadan önce çalışanların neyi yapabildiğini, neyi yapamadığını bilmen iyi olur.

## Çalışanlar ne yapabilir?

- Kendi klasörlerindeki (`calisanlar/<çalışan>/`) dosyaları okuyup yazabilir.
- `web: true` verdiğin çalışan internette arama yapıp sayfa okuyabilir.
- Raporlarını kendi rapor klasörlerine yazar.

## Ne yapamaz?

- **Komut çalıştıramaz:** Çalışanlara Bash (terminal) verilmez; sadece dosya okuma, yazma, düzenleme ve arama araçları vardır.
- **İzin isteyemez:** Görevler arka planda çalışır. Claude Code çalışma klasörü dışındaki bir dosyaya yazmak için izin ister; ofiste bu izni verecek kimse olmadığı için istek reddedilir.
- **Yayınlamaz, göndermez, ödemez:** Her çalışanın iş tanımında ve her görevin kurallarında yazar: yayınlama, paylaşma, mesaj ya da e-posta gönderme, ödeme, mevcut dosyayı silme yasak. Böyle bir iş gerekirse taslağını hazırlayıp raporda "onay gerekiyor" yazar. Son kararı sen verirsin.
- **API anahtarını görmez:** Bilgisayarında bir Claude API anahtarı tanımlı olsa bile ofis onu çalışanların ortamından siler; çalışanlar sadece aboneliğinle çalışır.

Yapay zeka talimatları her zaman kusursuz uygulamaz. Bu yüzden önemli bir işi (örneğin müşteriye gidecek bir metni) kullanmadan önce raporu mutlaka kendin oku.

## Ofisin kendisi

- **Sadece senin bilgisayarın:** Ofis varsayılan olarak `127.0.0.1` adresinde açılır; aynı ağdaki başka biri bile göremez.
- **Başka sitelere kapalı:** Tarayıcında açık kötü niyetli bir site, ofisine görev göndermeye çalışamaz: ofis sadece kendi panelinden gelen isteği kabul eder, tanımadığı bir adla gelen isteği reddeder (`izinliAdresler`).
- **Dosyalar dışarı açılmaz:** Panel sadece kendi dosyalarını verir; ayar, görev kaydı ve kod tarayıcıdan okunamaz. Raporlar sadece çalışan klasörlerinden okunur.
- **Tek süreç:** Aynı anda tek bir görev çalışır.

## Senin yapman gerekenler

- Görev metnine şifre, kart numarası ya da kimlik numarası yazma. Görev metni ve çalışanın okuduğu dosyalar, işlenmek üzere Claude'a gönderilir.
- Hassas dosyalarını ofis klasörüne koyma. En temizi ofisi ayrı bir kullanıcı hesabında ya da ayrı bir sunucuda çalıştırmak: [Buluta taşıma](1-buluta-tasima.md).
- Ofisi internete açma; uzaktan erişim için [Telefondan erişim](2-telefondan-erisim.md) sayfasındaki Tailscale yolunu kullan.
- İş tanımlarındaki YASAK bölümünü silme.
- Ara sıra `veri/gorevler.json` dosyasını ve `calisanlar/` klasörünü yedekle; görev geçmişin ve raporların orada.
