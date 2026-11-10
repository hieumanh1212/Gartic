// Kiểm tra chất lượng bộ từ: chạy `npm test` sau khi sửa file trong server/src/words/
import { describe, expect, it } from 'vitest';
import { DuplicateChecker, MAX_WORD_LENGTH, parseWords, RAW_WORDS, WORDS, WORDS_BY_TOPIC } from '../server/src/words';
import { TOPICS } from '../shared/topics';

describe('bộ từ', () => {
  it('mọi chủ đề đều có đủ từ', () => {
    for (const t of TOPICS) expect(WORDS_BY_TOPIC[t.id]?.length ?? 0, t.id).toBeGreaterThanOrEqual(40);
  });

  it('từ hợp lệ: chữ thường, chỉ chữ cái và khoảng trắng, không quá dài, 1–5 tiếng', () => {
    const bad: string[] = [];
    for (const [topic, raw] of Object.entries(RAW_WORDS)) {
      for (const w of parseWords(raw)) {
        const syllables = w.split(' ').length;
        if (!/^[\p{Ll} ]+$/u.test(w) || w.length > MAX_WORD_LENGTH || syllables > 5) bad.push(`${topic}: "${w}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('không có từ trùng (kể cả khác chữ chỉ loại) trong file nguồn', () => {
    const dup = new DuplicateChecker();
    const dups: string[] = [];
    for (const [topic, raw] of Object.entries(RAW_WORDS)) {
      for (const w of parseWords(raw)) {
        const hit = dup.add(w);
        if (hit) dups.push(`"${w}" (${topic}) trùng với "${hit}"`);
      }
    }
    expect(dups).toEqual([]);
  });

  it('bộ phát hiện trùng: phân biệt dấu, nhận ra chữ chỉ loại', () => {
    const d = new DuplicateChecker();
    expect(d.add('con mèo')).toBeNull();
    expect(d.add('mèo')).toBe('con mèo');
    expect(d.add('cái cưa')).toBeNull();
    expect(d.add('cái cửa')).toBeNull();
    expect(d.add('con báo')).toBeNull();
    expect(d.add('tờ báo')).toBeNull();
    expect(d.add('CON  MÈO')).toBe('con mèo');
    expect(d.add('ngọn lửa')).toBeNull();
    expect(d.add('lửa')).toBe('ngọn lửa');
  });

  it('tổng số từ', () => {
    expect(WORDS.length).toBeGreaterThan(1800);
  });
});
