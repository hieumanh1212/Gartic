import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../server/src/game';
import { LIMITS, type RoomView, type ServerMsg } from '../shared/protocol';

function setup() {
  const inbox = new Map<string, ServerMsg[]>();
  const disconnected: string[] = [];
  const game = new Game(
    'ABCD',
    {
      send: (id, msg) => {
        if (!inbox.has(id)) inbox.set(id, []);
        inbox.get(id)!.push(msg);
      },
      disconnect: (id) => disconnected.push(id),
    },
    { animals: ['con mèo', 'con chó'], food: ['quả táo', 'bánh mì'], vehicles: ['ô tô', 'máy bay'] },
    () => 0, // luôn chọn phần tử đầu → kết quả xác định
  );
  const msgs = (id: string) => inbox.get(id) ?? [];
  const last = <T extends ServerMsg['t']>(id: string, t: T) =>
    [...msgs(id)].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  const room = (id: string): RoomView => last(id, 'room')!.room;
  const chats = (id: string) => msgs(id).filter((m) => m.t === 'chat').map((m) => (m as any).msg);
  return { game, inbox, msgs, last, room, chats, disconnected };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Game', () => {
  it('không vào được phòng chưa tạo', () => {
    const { game, last } = setup();
    expect(game.join('a', 'An', '🐱', false)).toBe(false);
    expect(last('a', 'error')?.code).toBe('not_found');
  });

  it('người tạo là chủ phòng, người sau vào được', () => {
    const { game, room } = setup();
    expect(game.join('a', 'An', '🐱', true)).toBe(true);
    expect(game.join('b', 'Bình', '🐶', false)).toBe(true);
    expect(room('b').hostId).toBe('a');
    expect(room('b').players.map((p) => p.name)).toEqual(['An', 'Bình']);
  });

  it('chỉ chủ phòng mới được xem từ tùy chỉnh', () => {
    const { game, room } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('a', { t: 'settings', settings: { customWords: ['bí mật', 'bí mật', ' x '] } });
    expect(room('a').settings.customWords).toEqual(['bí mật', 'x']);
    expect(room('b').settings.customWords).toEqual([]);
    expect(room('b').settings.customCount).toBe(2);
  });

  it('chơi trọn một lượt: chọn từ, vẽ, đoán đúng, tính điểm', () => {
    const { game, room, last, chats, msgs } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.join('c', 'Chi', '', false);

    game.handle('a', { t: 'start' });
    expect(room('a').phase).toBe('choosing');
    expect(room('a').drawerId).toBe('a');
    expect(last('a', 'choices')?.words).toHaveLength(3);
    expect(last('b', 'choices')).toBeUndefined(); // người đoán không thấy lựa chọn

    game.handle('a', { t: 'choose', index: 0 });
    expect(room('b').phase).toBe('drawing');
    expect(last('a', 'word')?.word).toBe('con mèo');
    expect(last('b', 'word')).toBeUndefined(); // đáp án bị giấu
    expect(room('b').hint).toBe('___ ___');

    // vẽ: chỉ người vẽ được vẽ, và nét vẽ được chuyển cho người khác
    game.handle('b', { t: 'begin', c: '#000000', w: 4, p: [1, 1] });
    expect(last('c', 'begin')).toBeUndefined();
    game.handle('a', { t: 'begin', c: '#000000', w: 4, p: [10, 10] });
    game.handle('a', { t: 'points', p: [20, 20, 30, 30] });
    expect(last('b', 'begin')?.p).toEqual([10, 10]);
    expect(last('c', 'points')?.p).toEqual([20, 20, 30, 30]);
    expect(last('a', 'begin')).toBeUndefined(); // không gửi lại cho người vẽ

    // đoán sai → mọi người thấy; gần đúng → chỉ người đoán thấy
    game.handle('b', { t: 'guess', text: 'con chó' });
    expect(chats('c').some((m) => m.text === 'con chó')).toBe(true);
    game.handle('b', { t: 'guess', text: 'con meoo' });
    expect(chats('b').some((m) => m.kind === 'close')).toBe(true);
    expect(chats('c').some((m) => m.text === 'con meoo')).toBe(false);

    vi.advanceTimersByTime(10_000);
    game.handle('b', { t: 'guess', text: 'CON MEO' });
    expect(room('b').players.find((p) => p.id === 'b')!.guessed).toBe(true);
    expect(last('b', 'word')?.word).toBe('con mèo');
    const bScore = room('b').players.find((p) => p.id === 'b')!.score;
    expect(bScore).toBeGreaterThan(200);

    // người đã đoán đúng chat → chỉ người vẽ + người đã đoán thấy
    game.handle('b', { t: 'guess', text: 'dễ quá' });
    expect(chats('a').some((m) => m.text === 'dễ quá' && m.kind === 'secret')).toBe(true);
    expect(chats('c').some((m) => m.text === 'dễ quá')).toBe(false);

    // người cuối đoán đúng → kết thúc lượt
    game.handle('c', { t: 'guess', text: 'con mèo' });
    expect(room('a').phase).toBe('turnEnd');
    expect(room('a').reveal?.word).toBe('con mèo');
    expect(room('a').reveal?.gains.a).toBe(100); // người vẽ: 2 người đúng × 50

    // sang lượt tiếp theo, bảng vẽ được xóa
    const opsBefore = msgs('b').filter((m) => m.t === 'ops').length;
    vi.advanceTimersByTime(LIMITS.turnEndTime);
    expect(room('a').phase).toBe('choosing');
    expect(room('a').drawerId).toBe('b');
    expect(msgs('b').filter((m) => m.t === 'ops').length).toBe(opsBefore + 1);
  });

  it('tự chọn từ khi hết giờ chọn, và hết giờ vẽ thì kết thúc lượt', () => {
    const { game, room } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('a', { t: 'settings', settings: { drawTime: 30, rounds: 1 } });
    game.handle('a', { t: 'start' });
    vi.advanceTimersByTime(LIMITS.chooseTime);
    expect(room('a').phase).toBe('drawing');
    vi.advanceTimersByTime(30_000);
    expect(room('a').phase).toBe('turnEnd');
    vi.advanceTimersByTime(LIMITS.turnEndTime); // lượt của b
    expect(room('a').drawerId).toBe('b');
    vi.advanceTimersByTime(LIMITS.chooseTime + 30_000 + LIMITS.turnEndTime);
    expect(room('a').phase).toBe('gameOver');
  });

  it('gợi ý mở dần chữ cái', () => {
    const { game, room } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('a', { t: 'settings', settings: { drawTime: 100 } });
    game.handle('a', { t: 'start' });
    game.handle('a', { t: 'choose', index: 0 }); // 'con mèo' → 1 gợi ý
    vi.advanceTimersByTime(70_000);
    expect(room('b').hint.replace(/[_ ]/g, '').length).toBe(1);
  });

  it('người vẽ mất kết nối quá lâu → bỏ lượt; người chơi rời hẳn sau thời gian chờ', () => {
    const { game, room } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.join('c', 'Chi', '', false);
    game.handle('a', { t: 'start' });
    game.handle('a', { t: 'choose', index: 0 });
    game.disconnect('a');
    expect(room('b').players.find((p) => p.id === 'a')!.connected).toBe(false);
    vi.advanceTimersByTime(LIMITS.drawerGrace);
    expect(room('b').phase).toBe('turnEnd');
    vi.advanceTimersByTime(LIMITS.reconnectGrace);
    expect(room('b').players.map((p) => p.id)).toEqual(['b', 'c']);
    expect(room('b').hostId).toBe('b');
  });

  it('kết nối lại kịp thì giữ nguyên điểm và vai trò', () => {
    const { game, room, last } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('a', { t: 'start' });
    game.handle('a', { t: 'choose', index: 0 });
    game.handle('a', { t: 'begin', c: '#ff0000', w: 5, p: [1, 2] });
    game.disconnect('a');
    vi.advanceTimersByTime(3000);
    game.join('a', 'An', '', false);
    expect(room('a').phase).toBe('drawing');
    expect(last('a', 'welcome')?.ops).toHaveLength(1);
    expect(last('a', 'word')?.word).toBe('con mèo');
    vi.advanceTimersByTime(LIMITS.drawerGrace + 1000);
    expect(room('a').phase).toBe('drawing');
  });

  it('chỉ còn 1 người → quay về phòng chờ', () => {
    const { game, room } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('a', { t: 'start' });
    game.remove('b');
    expect(room('a').phase).toBe('lobby');
  });

  it('kick người chơi', () => {
    const { game, room, disconnected } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('b', { t: 'kick', playerId: 'a' }); // không phải chủ phòng → bỏ qua
    expect(room('a').players).toHaveLength(2);
    game.handle('a', { t: 'kick', playerId: 'b' });
    expect(disconnected).toEqual(['b']);
    expect(room('a').players).toHaveLength(1);
    expect(game.join('b', 'Bình', '', false)).toBe(false);
  });

  it('chọn chủ đề: chỉ ra từ thuộc chủ đề đó, người đoán thấy tên chủ đề', () => {
    const { game, room, last } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('a', { t: 'settings', settings: { topics: ['food', 'khong-ton-tai', 'food'], wordChoices: 2 } });
    expect(room('b').settings.topics).toEqual(['food']); // lọc chủ đề lạ + trùng
    game.handle('a', { t: 'start' });
    expect(last('a', 'choices')?.words).toEqual(['quả táo', 'bánh mì']);
    expect(room('b').topic).toBeNull(); // chưa chọn từ thì chưa lộ chủ đề
    game.handle('a', { t: 'choose', index: 1 });
    expect(room('b').topic).toBe('food');
  });

  it('chủ đề quá ít từ → bổ sung từ chủ đề khác; chọn đủ mọi chủ đề = tất cả', () => {
    const { game, room, last } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('a', { t: 'settings', settings: { topics: ['animals'], wordChoices: 3 } });
    game.handle('a', { t: 'start' });
    expect(last('a', 'choices')?.words).toHaveLength(3);
    expect(last('a', 'choices')?.words.slice(0, 2)).toEqual(['con mèo', 'con chó']);
    game.handle('b', { t: 'settings', settings: { topics: [] } }); // không phải chủ phòng → bỏ qua
    expect(room('a').settings.topics).toEqual(['animals']);
  });

  it('từ tùy chỉnh có chủ đề custom; chỉ dùng từ tùy chỉnh bỏ qua chủ đề', () => {
    const { game, room, last } = setup();
    game.join('a', 'An', '', true);
    game.join('b', 'Bình', '', false);
    game.handle('a', { t: 'settings', settings: { topics: ['animals'], customWords: ['thầy Hùng'], onlyCustom: true, wordChoices: 1 } });
    game.handle('a', { t: 'start' });
    expect(last('a', 'choices')?.words).toEqual(['thầy Hùng']);
    game.handle('a', { t: 'choose', index: 0 });
    expect(room('b').topic).toBe('custom');
  });

  it('mọi người rời đi → phòng bị xóa', () => {
    const { game } = setup();
    game.join('a', 'An', '', true);
    game.disconnect('a');
    vi.advanceTimersByTime(LIMITS.reconnectGrace);
    expect(game.isEmpty).toBe(true);
    expect(game.join('x', 'X', '', false)).toBe(false);
  });
});
