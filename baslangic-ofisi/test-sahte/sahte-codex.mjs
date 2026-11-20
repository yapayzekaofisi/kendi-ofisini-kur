// Testler için sahte Codex: "codex exec ... --output-last-message DOSYA -" gibi davranır.
// SAHTE_RAPOR (son mesaj), SAHTE_HATA (hata ile çıkar), SAHTE_BEKLE, ORTAM_YAZ, ARGS_YAZ sahte-claude ile aynı anlamdadır.
import fs from 'node:fs';

const args = process.argv.slice(2);
const e = process.env;
const yaz = o => process.stdout.write(JSON.stringify(o) + '\n');

let girdi = '';
for await (const p of process.stdin) girdi += p;
if (e.SAHTE_BEKLE) await new Promise(r => setTimeout(r, Number(e.SAHTE_BEKLE) * 1000));

if (e.SAHTE_HATA) {
  process.stderr.write('codex: hata (sahte)\n');
  process.exit(1);
}

const parcalar = [];
if (e.ARGS_YAZ) parcalar.push(JSON.stringify({ args, cwd: process.cwd(), girdi }));
else parcalar.push(e.SAHTE_RAPOR ?? 'codex tamam');
if (e.ORTAM_YAZ) parcalar.push(e.ANTHROPIC_API_KEY ? 'ANAHTAR_VAR' : 'ANAHTAR_YOK');
const son = parcalar.join('\n');

yaz({ type: 'thread.started' });
yaz({ type: 'item.completed', item: { type: 'agent_message', text: son } });
const i = args.indexOf('--output-last-message');
if (i >= 0) fs.writeFileSync(args[i + 1], son, 'utf8');
