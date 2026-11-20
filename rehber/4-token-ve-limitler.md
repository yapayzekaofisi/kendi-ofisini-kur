# Token ve limitler

## Ek ücret yok, ama limit var

Ofisin çalışanları senin Claude aboneliğinle (Pro ya da Max) çalışır. Ofis, bilgisayarında bir API anahtarı tanımlı olsa bile onu çalışanlara vermez; böylece kullandıkça ödenen API'ye geçip fatura çıkarmaz.

Abonelik sınırsız değildir: belli bir süre içinde kullanabileceğin bir limit vardır. Ağır kullanımda limit dolabilir; o zaman görev "hata" olur ve Claude'un mesajı panelde görünür. Limit yenilenince görevi yeniden verirsin.

## Neyi harcar?

Claude metni küçük parçalar hâlinde okur ve yazar; bunlara token denir. Bir görevde harcanan:

- **Genel müdürün planı:** kısa bir çağrı; çalışan listesini ve görevini okur, plan yazar.
- **Her adım:** çalışan iş tanımını, kuralları, görevi ve varsa önceki adımın raporunu okur; dosyalarına bakar, raporunu yazar. İnternette arama yapan çalışan okuduğu sayfalar kadar fazla harcar.

## Daha verimli kullanmak için

- **Önbellek:** Claude aynı başlangıç metnini (iş tanımı, kurallar) kısa süre içinde yeniden görünce onu önbellekten okur; bu, limitini çok daha az tüketir. İş tanımını sık sık değiştirmemek ve ilgili görevleri art arda vermek bu yüzden işe yarar.
- **Doğru model:** Basit işler için `ofis.ayar.json` içinde `"model": "haiku"` daha az harcar. Varsayılan `sonnet`; `opus` en güçlüsüdür ama en çok o harcar.
- **Açık görev:** "Bir şeyler yaz" yerine "Yeni ürün için 3 kısa gönderi açıklaması yaz, her biri en çok 2 cümle" gibi açık bir görev, çalışanın boşuna dolaşmasını önler.
- **Doğrudan görev:** Kimin yapacağını biliyorsan görevi doğrudan o çalışana ver; genel müdürün planı atlanır.
- **Sıra:** Ofis görevleri aynı anda değil, tek tek çalıştırır. Bu, limitinin bir anda tükenmesini önlemek için bilerek böyle.

Bir adım 30 dakikadan uzun sürerse ofis onu durdurur ve raporda "Süre doldu" yazar; takılan bir görev sırayı kilitlemez.
