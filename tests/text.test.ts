import { describe, expect, it } from 'vitest';
import { checkGuess, hintCount, levenshtein, makeHint, normalize } from '../shared/text';

describe('normalize', () => {
  it('bỏ dấu, chữ đ và chữ hoa', () => {
    expect(normalize('  Con   MÈO! ')).toBe('con meo');
    expect(normalize('Đường đi')).toBe('duong di');
    expect(normalize('Hươu cao cổ')).toBe('huou cao co');
  });
});

describe('levenshtein', () => {
  it('tính đúng', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('', 'ab')).toBe(2);
  });
});

describe('checkGuess', () => {
  it('đúng khi không dấu / khác hoa thường / dính liền', () => {
    expect(checkGuess('con meo', 'con mèo')).toBe('correct');
    expect(checkGuess('CON MÈO', 'con mèo')).toBe('correct');
    expect(checkGuess('conmeo', 'con mèo')).toBe('correct');
  });
  it('gần đúng', () => {
    expect(checkGuess('con meeo', 'con mèo')).toBe('close');
    expect(checkGuess('là con mèo đó', 'con mèo')).toBe('close');
    expect(checkGuess('huou cao co', 'hươu cao cổ')).toBe('correct');
    expect(checkGuess('huou cao koo', 'hươu cao cổ')).toBe('close');
  });
  it('đoán thiếu chữ chỉ loại vẫn đúng', () => {
    expect(checkGuess('meo', 'con mèo')).toBe('correct');
    expect(checkGuess('táo', 'quả táo')).toBe('correct');
    expect(checkGuess('nhan', 'chiếc nhẫn')).toBe('correct');
    expect(checkGuess('ca rot', 'củ cà rốt')).toBe('correct');
    expect(checkGuess('con mèo', 'con mèo')).toBe('correct');
  });
  it('không cắt nhầm chữ không phải chữ chỉ loại', () => {
    expect(checkGuess('vua', 'cờ vua')).toBe('wrong'); // "cờ" ≠ "cô"
    expect(checkGuess('dâu', 'cô dâu')).toBe('wrong');
    expect(checkGuess('tu lanh', 'tủ lạnh')).toBe('correct');
    expect(checkGuess('lanh', 'tủ lạnh')).toBe('wrong');
  });
  it('sai', () => {
    expect(checkGuess('con chó', 'con mèo')).toBe('wrong');
    expect(checkGuess('', 'con mèo')).toBe('wrong');
  });
});

describe('hint', () => {
  it('ẩn chữ, giữ khoảng trắng', () => {
    expect(makeHint('con mèo', new Set())).toBe('___ ___');
    expect(makeHint('con mèo', new Set([4]))).toBe('___ m__');
  });
  it('số chữ được mở', () => {
    expect(hintCount('mèo')).toBe(0);
    expect(hintCount('con mèo')).toBe(1);
    expect(hintCount('máy bay trực thăng')).toBe(3);
  });
});
