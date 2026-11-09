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

export function checkGuess(guess: string, word: string): GuessResult {
  const g = normalize(guess);
  const w = normalize(word);
  if (!g) return 'wrong';
  if (g === w) return 'correct';
  // Bỏ khoảng trắng: "conmeo" vẫn tính là đúng
  if (g.replace(/ /g, '') === w.replace(/ /g, '')) return 'correct';
  if (g.includes(w)) return 'close';
  const maxDist = w.length >= 8 ? 2 : 1;
  if (w.length >= 3 && levenshtein(g, w) <= maxDist) return 'close';
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
