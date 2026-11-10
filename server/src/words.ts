// Bộ từ theo chủ đề. Mỗi chủ đề là một file trong ./words/<id>.ts (danh sách từ cách nhau bởi dấu phẩy).
// Muốn thêm từ: mở file chủ đề và thêm vào. Muốn thêm chủ đề: thêm vào shared/topics.ts + tạo file mới + import ở dưới.
import { TOPICS } from '../../shared/topics';
import { stripClassifier } from '../../shared/text';
import animals from './words/animals';
import body from './words/body';
import fashion from './words/fashion';
import food from './words/food';
import fruits from './words/fruits';
import home from './words/home';
import jobs from './words/jobs';
import nature from './words/nature';
import office from './words/office';
import places from './words/places';
import space from './words/space';
import tech from './words/tech';
import vehicles from './words/vehicles';
import fantasy from './words/fantasy';
import games from './words/games';
import music from './words/music';
import sports from './words/sports';
import vietnam from './words/vietnam';

export const RAW_WORDS: Record<string, string> = {
  animals, fruits, food, home, tech, fashion, office, vehicles, nature,
  space, places, jobs, fantasy, sports, games, music, body, vietnam,
};

export const MAX_WORD_LENGTH = 25;
const VALID = /^[\p{L} ]+$/u;

export function parseWords(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((w) => w.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);
}

const compact = (w: string) => w.normalize('NFC').toLowerCase().replace(/\s+/g, '');

/** Phát hiện từ trùng. Giữ dấu ("cái cưa" ≠ "cái cửa"). Hai từ trùng khi giống hệt nhau,
 *  hoặc một từ là từ kia bỏ chữ chỉ loại ("mèo" ~ "con mèo"). Nhưng "tờ báo" ≠ "con báo". */
export class DuplicateChecker {
  private full = new Map<string, string>(); // từ đầy đủ → từ gốc
  private short = new Map<string, string>(); // từ đã bỏ chữ chỉ loại → từ gốc

  /** Trả về từ đã có nếu trùng, ngược lại ghi nhận từ mới và trả về null */
  add(w: string): string | null {
    const f = compact(w);
    const s = stripClassifier(w);
    const sk = s ? compact(s) : null;
    const hit = this.full.get(f) ?? this.short.get(f) ?? (sk ? this.full.get(sk) : undefined);
    if (hit) return hit;
    this.full.set(f, w);
    if (sk && !this.short.has(sk)) this.short.set(sk, w);
    return null;
  }
}

/** Từ theo chủ đề — đã lọc từ không hợp lệ; mỗi từ chỉ thuộc 1 chủ đề (trùng thì giữ ở chủ đề đứng trước) */
export const WORDS_BY_TOPIC: Record<string, string[]> = (() => {
  const dup = new DuplicateChecker();
  const out: Record<string, string[]> = {};
  for (const { id } of TOPICS) {
    out[id] = parseWords(RAW_WORDS[id] ?? '').filter(
      (w) => w.length <= MAX_WORD_LENGTH && VALID.test(w) && dup.add(w) === null,
    );
  }
  return out;
})();

export const WORDS: string[] = Object.values(WORDS_BY_TOPIC).flat();
