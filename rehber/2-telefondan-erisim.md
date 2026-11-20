# Telefondan erişim

Ofisini telefondan yönetmenin en güvenli yolu Tailscale. Tailscale, senin cihazlarını kendi aralarında özel bir ağa bağlar; ofis internete açılmaz, sadece senin telefonun ve bilgisayarın görür. Kişisel kullanım için ücretsiz.

## 1. Ofisin çalıştığı makineye Tailscale kur

Sunucu (Linux) için:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4
```

`tailscale up` bir giriş bağlantısı verir; onu açıp hesabınla giriş yap. Son komut makinenin Tailscale adresini yazar; `100.` ile başlayan bir adres.

Ofis kendi bilgisayarındaysa Tailscale'i [tailscale.com](https://tailscale.com/download) adresinden indirip aynı hesapla giriş yapman yeter.

## 2. Ofisi o adreste aç

`ofis.ayar.json` içinde `host` alanına bu adresi yaz:

```json
"host": "100.x.y.z"
```

(`100.x.y.z` yerine kendi adresin.) Sonra ofisi yeniden başlat. Sunucudaysan: `sudo systemctl restart yapay-zeka-ofisi`.

## 3. Telefona Tailscale kur

Telefonuna Tailscale uygulamasını indir, aynı hesapla giriş yap ve bağlan. Tarayıcıda `http://100.x.y.z:4800` adresini aç. "Ana ekrana ekle" dersen uygulama gibi açılır.

## Makine adıyla girmek istersen

Tailscale makinelerine ad da verir. Adresi IP yerine adla açıyorsan ofis bu adı tanımaz ve "Bu adres izinli değil" der; adı `izinliAdresler` listesine ekle:

```json
"izinliAdresler": ["ofis-sunucum"]
```

Bu kontrol, başka bir web sitesinin senin tarayıcın üzerinden ofisine görev göndermesini engeller. IP adresiyle girişte ayar gerekmez.

## Yapma

- Modemde ya da sunucunun güvenlik duvarında 4800 portunu internete açma.
- Herkese açık bir sunucuda `host` alanını `0.0.0.0` yapma; bu, ofisi bütün ağlara açar.
- Panel adresini başkalarıyla paylaşma; paneli açan herkes görev verebilir.
