# Codex ve Gemini

Başlangıç ofisinde bütün çalışanlar Claude Code ile çalışır. İstersen bir çalışanı OpenAI'ın Codex'i ile çalıştırabilirsin. Gemini için durum farklı; aşağıda dürüstçe anlattım.

## Bir çalışanı Codex ile çalıştırmak

Codex, ChatGPT aboneliğinle çalışan bir kodlama ajanıdır. Kod yazdıran işlerde iyi sonuç verir.

1. Kur ve giriş yap:

   ```bash
   npm install -g @openai/codex
   codex login
   ```

   `codex login` tarayıcıda ChatGPT hesabınla giriş yapmanı ister.

2. `ofis.ayar.json` içinde Codex'in yerini ve o çalışanın motorunu yaz:

   ```json
   "codexYolu": "codex",
   "calisanlar": [
     { "ad": "Kodcu", "rol": "Yazılımcı", "is": "Küçük betikler ve hesap tabloları için formüller yazar.", "motor": "codex" }
   ]
   ```

   `codexYolu` için `codex` yazmak çoğu zaman yeter; ofis Codex'i PATH'te bulur (Windows'taki `codex.cmd` kısayolu dahil). Bulamazsa tam yolunu yaz.

3. Ofisi yeniden başlat. Codex çalışanı kendi klasöründe, klasör dışına yazamayan modda (`--sandbox workspace-write`) çalışır; iş tanımı ve ofis kuralları her göreve eklenir.

Genel müdür her zaman Claude'dur; planı o yapar, Codex çalışanına adım verebilir.

## Gemini

Başlangıç ofisi görevleri otomatik olarak Gemini'ye yönlendirmez. Gemini CLI'nin bayrakları ve giriş akışı sık değiştiği için onu ofisin içine, deneyip doğrulayamadığım bir şekilde koymadım; çalışmayan bir kılavuz vermektense bunu açıkça söylemek istedim.

Gemini'yi ofisin yanında ayrı bir yardımcı olarak kullanabilirsin:

```bash
npm install -g @google/gemini-cli
gemini
```

Örneğin bir çalışanın hazırladığı raporu ya da video metnini Gemini'ye okutup ikinci bir göz olarak yazım hatası, eksik bilgi ya da paylaşmaman gereken kişisel bir bilgi var mı diye kontrol ettirebilirsin. Ben kendi ofisimde Gemini'yi böyle bir kontrol için kullanıyorum.
