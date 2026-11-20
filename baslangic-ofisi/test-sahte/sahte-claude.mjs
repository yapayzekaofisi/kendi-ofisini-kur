// Testler için sahte Claude Code: gerçek Claude'u çağırmadan çıktı biçimini taklit eder.
// Davranışı ortam değişkenleriyle seçilir:
//   SAHTE_PLAN   json modunda bu metni sonuç olarak döndürür (genel müdür planı)
//   SAHTE_RAPOR  stream-json modunda bir Write aracı, bir metin, sonra bu metni sonuç olarak verir
//   SAHTE_HATA=giris  "giriş yapılmamış" hatası verir
//   SAHTE_BEKLE  bu kadar saniye bekler (durdurma testleri için)
//   ORTAM_YAZ    API anahtarını görürse ANAHTAR_VAR, görmezse ANAHTAR_YOK yazar
//   ARGS_YAZ     aldığı argümanları, klasörü ve girdiyi sonuç içine JSON olarak yazar
//   GIRDI_YAZ    stream-json modunda aldığı girdiyi sonucun sonuna ekler
const args = process.argv.slice(2);
const e = process.env;
const bicim = args.includes('--output-format') ? args[args.indexOf('--output-format') + 1] : 'text';
const yaz = o => process.stdout.write(JSON.stringify(o) + '\n');

let girdi = '';
for await (const p of process.stdin) girdi += p;
if (e.SAHTE_BEKLE) await new Promise(r => setTimeout(r, Number(e.SAHTE_BEKLE) * 1000));

if (e.SAHTE_HATA === 'giris') {
  if (bicim === 'stream-json') yaz({ type: 'system', subtype: 'init', model: 'sahte' });
  yaz({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in · Please run /login' });
  process.exit(1);
}

const parcalar = [];
if (e.ARGS_YAZ) parcalar.push(JSON.stringify({ args, cwd: process.cwd(), girdi }));
else parcalar.push((bicim === 'stream-json' ? e.SAHTE_RAPOR : e.SAHTE_PLAN) ?? 'tamam');
if (e.ORTAM_YAZ) parcalar.push(e.ANTHROPIC_API_KEY ? 'ANAHTAR_VAR' : 'ANAHTAR_YOK');
if (e.GIRDI_YAZ && bicim === 'stream-json') parcalar.push('GİRDİ:\n' + girdi);
const sonuc = parcalar.join('\n');

if (bicim === 'stream-json') {
  yaz({ type: 'system', subtype: 'init', model: 'sahte' });
  yaz({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'taslak.md' } }] } });
  yaz({ type: 'assistant', message: { content: [{ type: 'text', text: 'Taslağı yazdım.' }] } });
}
yaz({ type: 'result', subtype: 'success', is_error: false, result: sonuc, usage: { input_tokens: 10, output_tokens: 5 } });
