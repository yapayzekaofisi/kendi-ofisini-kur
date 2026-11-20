# Buluta taşıma

Ofisin kendi bilgisayarında çalışır; bilgisayarı kapatınca ofis de kapanır. Görevler sen yokken de yürüsün istiyorsan ofisi küçük bir sunucuya (VPS) taşıyabilirsin. Ubuntu 22.04 ya da 24.04 kurulu, 1-2 GB belleği olan herhangi bir VPS yeter.

## 1. Kendine normal bir kullanıcı aç

Sunucuya bağlandıktan sonra ofisi root ile değil, normal bir kullanıcıyla çalıştır:

```bash
sudo adduser kullanici
sudo usermod -aG sudo kullanici
su - kullanici
```

Bundan sonraki komutlar bu kullanıcıyla.

## 2. Node ve Claude Code'u kur

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
curl -fsSL https://claude.ai/install.sh | bash
```

Son komut Claude Code'u `~/.local/bin/claude` yoluna kurar. Sonra giriş yap:

```bash
claude
```

Claude bir bağlantı verir; onu telefonunda ya da bilgisayarında açıp hesabınla giriş yap, verilen kodu terminale yapıştır. Bu işi sen yaparsın; kodu kimseyle paylaşma.

## 3. Ofisi kur

```bash
git clone https://github.com/yapayzekaofisi/kendi-ofisini-kur
cd kendi-ofisini-kur/baslangic-ofisi
nano ofis.ayar.json
npm run kur
npm test
```

Bilgisayarındaki ofisi taşıyorsan `ofis.ayar.json` dosyasını ve `calisanlar/` klasörünü sunucuya kopyalaman yeter.

## 4. Kendiliğinden açılsın

Sunucu yeniden başlasa da ofis açılsın diye bir servis yaz:

```bash
sudo nano /etc/systemd/system/yapay-zeka-ofisi.service
```

```ini
[Unit]
Description=Yapay zeka ofisi
After=network-online.target

[Service]
User=kullanici
WorkingDirectory=/home/kullanici/kendi-ofisini-kur/baslangic-ofisi
ExecStart=/usr/bin/node sunucu.mjs
Environment=PATH=/home/kullanici/.local/bin:/usr/local/bin:/usr/bin:/bin
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now yapay-zeka-ofisi
journalctl -u yapay-zeka-ofisi -f
```

Son komut ofisin günlüğünü gösterir; "açıldı" satırını görünce tamamdır.

## 5. Ofisi internete açma

Ofis varsayılan olarak sadece sunucunun kendisinden (`127.0.0.1`) erişilebilir. 4800 portunu güvenlik duvarında herkese açma; paneli bilen herkes çalışanlarına görev verebilir. Telefondan ya da bilgisayarından güvenle bağlanmak için: [Telefondan erişim](2-telefondan-erisim.md).
