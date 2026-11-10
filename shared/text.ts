// Xử lý chữ tiếng Việt: chuẩn hóa, so khớp gần đúng, tạo gợi ý

/** Bỏ dấu, chuyển thường, bỏ ký tự đặc biệt, gộp khoảng trắng. "Con Mèo!" -> "con meo" */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Khoảng cách chỉnh sửa Levenshtein */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type GuessResult = 'correct' | 'close' | 'wrong';

/** Chữ chỉ loại đứng đầu từ — đoán thiếu cũng được tính đúng ("mèo" = "con mèo").
 *  So khớp trên chữ CÒN DẤU để không nhầm ("cờ vua" không phải "cô" + "vua"). */
const CLASSIFIERS = new Set([
  'con', 'cái', 'chiếc', 'quả', 'trái', 'củ', 'cây', 'bông', 'đôi', 'tờ',
  'quyển', 'cuốn', 'ngọn', 'ngôi', 'viên', 'hòn', 'tấm', 'bức', 'que',
]);

/** "con mèo" → "mèo"; trả về null nếu từ không bắt đầu bằng chữ chỉ loại */
export function stripClassifier(word: string): string | null {
  const w = word.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
  const i = w.indexOf(' ');
  if (i <= 0 || !CLASSIFIERS.has(w.slice(0, i))) return null;
  const rest = w.slice(i + 1);
  return normalize(rest).replace(/ /g, '').length >= 2 ? rest : null;
}

export function checkGuess(guess: string, word: string): GuessResult {
  const g = normalize(guess);
  if (!g) return 'wrong';
  const short = stripClassifier(word);
  const targets = [normalize(word), ...(short ? [normalize(short)] : [])];
  const compact = g.replace(/ /g, '');
  // Khớp chính xác, hoặc bỏ khoảng trắng: "conmeo" vẫn tính là đúng
  if (targets.some((w) => g === w || compact === w.replace(/ /g, ''))) return 'correct';
  const w = targets[0];
  if (g.includes(w)) return 'close';
  for (const t of targets) {
    const maxDist = t.length >= 8 ? 2 : 1;
    if (t.length >= 3 && levenshtein(g, t) <= maxDist) return 'close';
  }
  return 'wrong';
}

/** Vị trí các chữ cái (không phải khoảng trắng) */
export function letterIndexes(word: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < word.length; i++) if (word[i] !== ' ') out.push(i);
  return out;
}

export function makeHint(word: string, revealed: Set<number>): string {
  let s = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    s += ch === ' ' ? ' ' : revealed.has(i) ? ch : '_';
  }
  return s;
}

/** Số chữ cái được mở dần trong một lượt */
export function hintCount(word: string): number {
  const n = letterIndexes(word).length;
  return Math.max(0, Math.min(3, Math.floor((n - 1) / 3)));
}
