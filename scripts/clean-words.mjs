// Dọn bộ từ: xóa từ trùng (kể cả khác dấu / khác chữ chỉ loại), từ không hợp lệ, rồi ghi lại file gọn gàng.
// Dùng: node scripts/clean-words.mjs          (chỉ báo cáo)
//       node scripts/clean-words.mjs --write  (sửa file)
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', 'server', 'src', 'words');
const ORDER = ['animals', 'fruits', 'food', 'home', 'tech', 'fashion', 'office', 'vehicles', 'nature',
  'space', 'places', 'jobs', 'fantasy', 'sports', 'games', 'music', 'body', 'vietnam'];
const CLASSIFIERS = new Set(['con', 'cái', 'chiếc', 'quả', 'trái', 'củ', 'cây', 'bông', 'đôi', 'tờ',
  'quyển', 'cuốn', 'ngọn', 'ngôi', 'viên', 'hòn', 'tấm', 'bức', 'que']);
const write = process.argv.includes('--write');

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
  .toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
const strip = (w) => {
  const i = w.indexOf(' ');
  if (i <= 0 || !CLASSIFIERS.has(w.slice(0, i))) return w;
  const rest = w.slice(i + 1);
  return normalize(rest).replace(/ /g, '').length >= 2 ? rest : w;
};
// Giữ dấu ('cái cưa' ≠ 'cái cửa'). Trùng khi giống hệt, hoặc một từ = từ kia bỏ chữ chỉ loại ('mèo' ~ 'con mèo')
const compact = (w) => w.replace(/ /g, '');
const full = new Map(), short = new Map();
const dupOf = (w) => {
  const f = compact(w), s = strip(w), sk = s !== w ? compact(s) : null;
  return full.get(f) ?? short.get(f) ?? (sk ? full.get(sk) : undefined);
};
const remember = (w, label) => {
  const s = strip(w);
  full.set(compact(w), label);
  if (s !== w && !short.has(compact(s))) short.set(compact(s), label);
};
let total = 0;
const report = [];
for (const id of ORDER) {
  const file = path.join(DIR, `${id}.ts`);
  if (!fs.existsSync(file)) { report.push(`!! thiếu file ${id}.ts`); continue; }
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/export default `([\s\S]*)`/);
  if (!m) { report.push(`!! ${id}.ts sai định dạng`); continue; }
  const header = (src.match(/^\/\/ Chủ đề: ([^—\n]+)/m)?.[1] ?? id).trim();
  const words = m[1].split(/[,\n]/).map((w) => w.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);
  const kept = [];
  for (const w of words) {
    if (!/^[\p{Ll} ]+$/u.test(w) || w.length > 25 || w.split(' ').length > 5) { report.push(`${id}: bỏ từ không hợp lệ "${w}"`); continue; }
    const hit = dupOf(w);
    if (hit) { report.push(`${id}: bỏ "${w}" — trùng ${hit}`); continue; }
    remember(w, `"${w}" (${id})`);
    kept.push(w);
  }
  total += kept.length;
  report.push(`== ${id}: ${words.length} → ${kept.length}`);
  if (write) {
    const lines = [];
    for (let i = 0; i < kept.length; i += 10) lines.push(kept.slice(i, i + 10).join(', ') + ',');
    fs.writeFileSync(file, `// Chủ đề: ${header} — ${kept.length} từ\nexport default \`\n${lines.join('\n')}\n\`;\n`);
  }
}
console.log(report.join('\n'));
console.log(`\nTỔNG: ${total} từ${write ? ' (đã ghi file)' : ' (chạy thêm --write để sửa file)'}`);
