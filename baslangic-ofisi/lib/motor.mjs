// Claude Code ve Codex'i alt süreç olarak çalıştırır. Ofisin "motoru" budur:
// hangi programı, hangi ayarlarla, hangi ortamla başlatacağımızı burası bilir.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Ajanlar aboneliğinle (claude girişinle) çalışır. Ortamda bir API anahtarı kalırsa Claude onu kullanır
// ve ücretli API'den para harcar; o yüzden anahtarları ve iç oturum değişkenlerini temizliyoruz.
const SIL = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDECODE', 'CLAUDE_PID'];
const KALSIN = ['CLAUDE_CODE_GIT_BASH_PATH', 'CLAUDE_CODE_OAUTH_TOKEN'];

export function temizOrtam(env = process.env) {
  const yeni = {};
  for (const [k, v] of Object.entries(env)) {
    const b = k.toUpperCase();
    if (SIL.includes(b) || b.startsWith('CLAUDE_AGENT_SDK_') || (b.startsWith('CLAUDE_CODE_') && !KALSIN.includes(b))) continue;
    if (v !== undefined) yeni[k] = v;
  }
  return yeni;
}

const dosyaVar = d => { try { return !!d && fs.statSync(d).isFile(); } catch { return false; } };
const klasorler = (yol, platform) => String(yol ?? '')
  .split(platform === 'win32' ? ';' : ':')
  .map(s => s.trim().replace(/^"|"$/g, ''))
  .filter(Boolean);

// Windows'ta npm, programlar için .cmd kısayolu kurar. Node bunları kabuk olmadan çalıştıramaz;
// kısayolun içinden gerçek .js ya da .exe dosyasını bulup onu çalıştırırız.
export function komutCoz(komut, { platform = process.platform, path: yol = process.env.PATH } = {}) {
  if (!komut || platform !== 'win32') return komut;
  let k = komut;
  if (!/[\\/]/.test(k)) {
    const adaylar = path.extname(k) ? [k] : ['.exe', '.cmd', '.bat'].map(u => k + u);
    for (const d of klasorler(yol, platform)) {
      const bulunan = adaylar.map(a => path.join(d, a)).find(dosyaVar);
      if (bulunan) { k = bulunan; break; }
    }
  }
  if (/\.(cmd|bat)$/i.test(k) && dosyaVar(k)) {
    const metin = fs.readFileSync(k, 'utf8');
    const hedefler = [...metin.matchAll(/"%~?dp0%?\\([^"]+)"/gi)]
      .map(m => path.join(path.dirname(k), m[1]))
      .filter(h => /\.(c|m)?js$|\.exe$/i.test(h) && path.basename(h).toLowerCase() !== 'node.exe' && dosyaVar(h));
    if (hedefler.length) return hedefler[hedefler.length - 1];
  }
  return k;
}

// Claude Code'un yerini bulur: önce ayardaki yol, sonra PATH, sonra npm kurulumu, en son ~/.local/bin.
export function claudeBul({ ayarYolu, path: yol = process.env.PATH, platform = process.platform, ev = os.homedir() } = {}) {
  if (ayarYolu && dosyaVar(ayarYolu)) return ayarYolu;
  const dizinler = klasorler(yol, platform);
  const ad = platform === 'win32' ? 'claude.exe' : 'claude';
  for (const d of dizinler) if (dosyaVar(path.join(d, ad))) return path.join(d, ad);
  if (platform === 'win32') {
    for (const d of dizinler) {
      const cmd = path.join(d, 'claude.cmd');
      if (!dosyaVar(cmd)) continue;
      const exe = path.join(d, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
      if (dosyaVar(exe)) return exe;
      const hedef = komutCoz(cmd, { platform });
      if (hedef !== cmd) return hedef;
    }
  }
  const yerel = ev ? path.join(ev, '.local', 'bin', ad) : '';
  return dosyaVar(yerel) ? yerel : null;
}

const BOS_MCP = '{"mcpServers":{}}';

// Genel müdürün planı: araç yok, oturum kaydı yok, sadece JSON cevap.
export function planArgs(sistem, model = 'sonnet') {
  return ['-p', '--output-format', 'json', '--model', model, '--tools', '', '--no-session-persistence', '--strict-mcp-config', '--mcp-config', BOS_MCP, '--permission-prompts', 'none', '--system-prompt', sistem];
}

// Çalışanın işi: kendi klasöründe dosya okur ve yazar. Bash (komut çalıştırma) yok.
export function ajanArgs(c, kurallar, model = 'sonnet') {
  const araclar = ['Read', 'Write', 'Edit', 'Glob', 'Grep', ...(c?.web ? ['WebSearch', 'WebFetch'] : [])];
  return ['-p', '--output-format', 'stream-json', '--verbose', '--model', model, '--permission-mode', 'acceptEdits', '--permission-prompts', 'none', '--restricted', '--tools', araclar.join(','), '--allowedTools', ...araclar, '--append-system-prompt', kurallar, '--strict-mcp-config', '--mcp-config', BOS_MCP];
}

export function codexArgs(cwd, sonMesajDosyasi) {
  return ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '--cd', cwd, '--json', '--output-last-message', sonMesajDosyasi, '-'];
}

// stream-json çıktısının bir satırını okur: ajan ne yapıyor, bitti mi?
export function akisOku(satir) {
  let o;
  try { o = JSON.parse(satir); } catch { return { tur: null }; }
  if (!o || typeof o !== 'object') return { tur: null };
  if (o.type === 'system' && o.subtype === 'init') return { tur: 'basla', model: o.model ?? null };
  if (o.type === 'assistant') {
    const icerik = Array.isArray(o.message?.content) ? o.message.content : [];
    const arac = icerik.find(p => p?.type === 'tool_use');
    if (arac) return { tur: 'arac', ad: String(arac.name ?? ''), girdi: arac.input ?? {} };
    const metin = icerik.filter(p => p?.type === 'text').map(p => p.text).join('\n').trim();
    if (metin) return { tur: 'metin', metin };
    return { tur: null };
  }
  if (o.type === 'result') {
    return { tur: 'sonuc', metin: typeof o.result === 'string' ? o.result : '', hata: o.is_error === true, altTur: o.subtype ?? '', kullanim: o.usage ?? null };
  }
  return { tur: null };
}

export function girisIpucu(metin) {
  return /log ?in|logged|auth|api key|oauth|credential|\b401\b/i.test(String(metin ?? ''))
    ? 'Terminalde `claude` yazıp hesabınla giriş yap, sonra görevi yeniden ver.'
    : '';
}

const EN_COK_CIKTI = 4_000_000;

// Programı başlatır. Hemen { sonuc, durdur } döner; sonuc süreç bitince { kod, stdout, stderr, durduruldu, zamanAsimi } verir.
// Hiçbir durumda hata fırlatmaz: program yoksa bile sonuç "başlatılamadı" yazısıyla gelir.
export function surecBaslat({ komut, args = [], cwd, girdi = '', satirGeldi, zamanAsimiMs = 0 }) {
  const windows = process.platform === 'win32';
  const gercek = komutCoz(komut);
  const betik = /\.(c|m)?js$/i.test(gercek ?? '');
  let cocuk = null, bitti = false, durduruldu = false, zamanAsimi = false, zamanlayici = null;

  const oldur = () => {
    if (!cocuk?.pid || bitti) return;
    if (windows) {
      spawn('taskkill', ['/PID', String(cocuk.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => cocuk.kill());
      return;
    }
    try { process.kill(-cocuk.pid, 'SIGTERM'); } catch { cocuk.kill('SIGTERM'); }
    setTimeout(() => { if (!bitti) { try { process.kill(-cocuk.pid, 'SIGKILL'); } catch { cocuk.kill('SIGKILL'); } } }, 3000).unref();
  };

  const sonuc = new Promise(resolve => {
    let stdout = '', stderr = '', artik = '';
    const bitir = (kod, ekHata = '') => {
      if (bitti) return;
      bitti = true;
      clearTimeout(zamanlayici);
      if (artik.trim() && satirGeldi) { try { satirGeldi(artik); } catch {} }
      resolve({ kod, stdout, stderr: ekHata ? (stderr + ekHata).trim() : stderr, durduruldu, zamanAsimi });
    };
    try {
      cocuk = spawn(betik ? process.execPath : gercek, betik ? [gercek, ...args] : args, {
        cwd, env: temizOrtam(), windowsHide: true, detached: !windows, stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e) {
      bitir(-1, `başlatılamadı: ${e.message}`);
      return;
    }
    cocuk.on('error', e => bitir(-1, `\nbaşlatılamadı: ${e.message}`));
    cocuk.on('close', kod => bitir(kod ?? -1));
    cocuk.stdout.setEncoding('utf8');
    cocuk.stderr.setEncoding('utf8');
    cocuk.stdout.on('data', p => {
      stdout += p;
      if (stdout.length > EN_COK_CIKTI) stdout = stdout.slice(-EN_COK_CIKTI / 2);
      if (!satirGeldi) return;
      artik += p;
      const satirlar = artik.split(/\r?\n/);
      artik = satirlar.pop();
      for (const s of satirlar) if (s.trim()) { try { satirGeldi(s); } catch {} }
    });
    cocuk.stderr.on('data', p => { stderr = (stderr + p).slice(-64_000); });
    cocuk.stdin.on('error', () => {});
    cocuk.stdin.end(String(girdi ?? ''));
    if (zamanAsimiMs > 0) zamanlayici = setTimeout(() => { zamanAsimi = true; oldur(); }, zamanAsimiMs);
  });

  return { sonuc, durdur: () => { durduruldu = true; oldur(); } };
}
