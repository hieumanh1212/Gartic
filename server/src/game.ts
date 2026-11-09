// Logic game thuần túy — không phụ thuộc Cloudflare để dễ test.
import {
  DEFAULT_SETTINGS,
  LIMITS,
  type ChatMsg,
  type ClientMsg,
  type DrawOp,
  type ErrorCode,
  type Phase,
  type PlayerView,
  type RoomView,
  type ServerMsg,
  type Settings,
} from '../../shared/protocol';
import { checkGuess, hintCount, letterIndexes, makeHint } from '../../shared/text';
import { WORDS } from './words';

export interface Transport {
  /** Gửi tin cho 1 người chơi (bỏ qua nếu đang mất kết nối) */
  send(playerId: string, msg: ServerMsg): void;
  /** Đóng kết nối của 1 người chơi (bị kick) */
  disconnect(playerId: string): void;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  guessed: boolean;
  connected: boolean;
  leaveTimer: ReturnType<typeof setTimeout> | null;
  chatTimes: number[];
  msgWindowStart: number;
  msgCount: number;
}

type Timer = ReturnType<typeof setTimeout>;

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};

function cleanPoints(p: unknown): number[] | null {
  if (!Array.isArray(p) || p.length === 0 || p.length % 2 !== 0 || p.length > LIMITS.maxPointsPerMsg) return null;
  const out = new Array<number>(p.length);
  for (let i = 0; i < p.length; i++) {
    const v = p[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    out[i] = Math.round(Math.min(2000, Math.max(-200, v)));
  }
  return out;
}

export class Game {
  readonly code: string;
  private created = false;
  private hostId: string | null = null;
  private players = new Map<string, Player>();
  private kicked = new Set<string>();
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private phase: Phase = 'lobby';
  private round = 0;
  private order: string[] = [];
  private turnIdx = -1;
  private drawerId: string | null = null;
  private word: string | null = null;
  private choices: string[] = [];
  private revealed = new Set<number>();
  private endsAt = 0;
  private turnStart = 0;
  private reveal: RoomView['reveal'] = null;
  private gains: Record<string, number> = {};
  private ops: DrawOp[] = [];
  private totalPoints = 0;
  private strokeOpen = false;
  private usedWords = new Set<string>();
  private timers: Timer[] = [];
  private drawerLeaveTimer: Timer | null = null;

  constructor(
    code: string,
    private transport: Transport,
    private wordBank: string[] = WORDS,
    private rng: () => number = Math.random,
  ) {
    this.code = code;
  }

  get isEmpty() {
    return this.players.size === 0;
  }

  // ───────────────────────── Kết nối ─────────────────────────

  /** Người chơi gửi 'hello'. Trả về false nếu bị từ chối. */
  join(id: string, rawName: string, rawAvatar: string, create: boolean): boolean {
    const existing = this.players.get(id);
    if (!existing) {
      if (!this.created) {
        if (!create) return this.reject(id, 'not_found', 'Phòng không tồn tại hoặc đã đóng.');
        this.created = true;
      }
      if (this.kicked.has(id)) return this.reject(id, 'kicked', 'Bạn đã bị mời ra khỏi phòng.');
      if (this.players.size >= this.settings.maxPlayers) return this.reject(id, 'full', 'Phòng đã đầy.');
    }

    const name = String(rawName ?? '').trim().slice(0, LIMITS.nameLength) || 'Người chơi';
    const avatar = Array.from(String(rawAvatar ?? '')).slice(0, 4).join('') || '🙂';

    let p = existing;
    if (p) {
      if (p.leaveTimer) clearTimeout(p.leaveTimer);
      p.leaveTimer = null;
      p.connected = true;
      p.name = name;
      p.avatar = avatar;
      if (id === this.drawerId && this.drawerLeaveTimer) {
        clearTimeout(this.drawerLeaveTimer);
        this.drawerLeaveTimer = null;
      }
    } else {
      p = {
        id, name, avatar, score: 0, guessed: false, connected: true, leaveTimer: null,
        chatTimes: [], msgWindowStart: 0, msgCount: 0,
      };
      this.players.set(id, p);
      if (this.phase !== 'lobby' && this.phase !== 'gameOver') this.order.push(id);
    }
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = id;

    this.transport.send(id, { t: 'welcome', you: id, room: this.viewFor(id), ops: this.ops });
    if (id === this.drawerId && this.phase === 'choosing') this.transport.send(id, { t: 'choices', words: this.choices });
    if (this.word && this.phase === 'drawing' && (id === this.drawerId || p.guessed)) {
      this.transport.send(id, { t: 'word', word: this.word });
    }
    if (!existing) this.chatAll({ kind: 'join', text: `${p.name} đã vào phòng` });
    this.broadcastRoom();
    return true;
  }

  /** Socket đóng. Giữ chỗ một lúc để người chơi có thể kết nối lại. */
  disconnect(id: string) {
    const p = this.players.get(id);
    if (!p || !p.connected) return;
    p.connected = false;
    if (p.leaveTimer) clearTimeout(p.leaveTimer);
    p.leaveTimer = setTimeout(() => this.remove(id), LIMITS.reconnectGrace);
    if (id === this.drawerId && (this.phase === 'drawing' || this.phase === 'choosing')) {
      this.drawerLeaveTimer = setTimeout(() => {
        this.drawerLeaveTimer = null;
        if (id === this.drawerId) {
          this.chatAll({ kind: 'system', text: `${p.name} đã rời đi, bỏ qua lượt vẽ.` });
          this.endTurn();
        }
      }, LIMITS.drawerGrace);
    }
    this.broadcastRoom();
    this.checkAllGuessed();
  }

  remove(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    if (p.leaveTimer) clearTimeout(p.leaveTimer);
    this.players.delete(id);

    if (this.players.size === 0) {
      this.reset();
      return;
    }
    if (this.hostId === id) {
      const next = [...this.players.values()].find((x) => x.connected) ?? [...this.players.values()][0];
      this.hostId = next.id;
      this.chatAll({ kind: 'system', text: `${next.name} giờ là chủ phòng.` });
    }
    const idx = this.order.indexOf(id);
    if (idx !== -1) {
      this.order.splice(idx, 1);
      if (idx < this.turnIdx) this.turnIdx--;
      else if (idx === this.turnIdx) this.turnIdx--; // để nextTurn chuyển đúng sang người kế tiếp
    }
    this.chatAll({ kind: 'leave', text: `${p.name} đã rời phòng` });

    const inGame = this.phase === 'choosing' || this.phase === 'drawing' || this.phase === 'turnEnd';
    if (inGame && this.players.size < 2) {
      this.chatAll({ kind: 'system', text: 'Không đủ người chơi, quay về phòng chờ.' });
      this.toLobby();
      return;
    }
    if (id === this.drawerId && (this.phase === 'choosing' || this.phase === 'drawing')) {
      this.drawerId = null;
      this.endTurn();
      return;
    }
    this.broadcastRoom();
    this.checkAllGuessed();
  }

  /** Hủy toàn bộ timer (khi Durable Object bị dọn dẹp) */
  dispose() {
    this.clearTimers();
    for (const p of this.players.values()) if (p.leaveTimer) clearTimeout(p.leaveTimer);
  }

  // ───────────────────────── Tin nhắn ─────────────────────────

  handle(id: string, msg: ClientMsg) {
    const p = this.players.get(id);
    if (!p || !msg || typeof msg !== 'object') return;
    if (!this.allowMessage(p)) return;

    switch (msg.t) {
      case 'settings': return this.updateSettings(id, msg.settings);
      case 'start': return this.start(id);
      case 'lobby': if (id === this.hostId && this.phase === 'gameOver') this.toLobby(); return;
      case 'choose': return this.choose(id, msg.index);
      case 'guess': return this.guess(p, msg.text);
      case 'kick': return this.kick(id, msg.playerId);
      case 'begin': case 'points': case 'fill': case 'undo': case 'clear':
        return this.draw(id, msg);
      default: return;
    }
  }

  /** Giới hạn ~120 tin/giây/người để tránh spam */
  private allowMessage(p: Player) {
    const now = Date.now();
    if (now - p.msgWindowStart > 1000) {
      p.msgWindowStart = now;
      p.msgCount = 0;
    }
    return ++p.msgCount <= 120;
  }

  private updateSettings(id: string, s: Partial<Settings> | undefined) {
    if (id !== this.hostId || this.phase !== 'lobby' || !s || typeof s !== 'object') return;
    const cur = this.settings;
    const next: Settings = {
      rounds: clampInt(s.rounds, 1, 10, cur.rounds),
      drawTime: clampInt(s.drawTime, 30, 240, cur.drawTime),
      wordChoices: clampInt(s.wordChoices, 1, 5, cur.wordChoices),
      maxPlayers: clampInt(s.maxPlayers, Math.max(2, this.players.size), 16, cur.maxPlayers),
      hints: typeof s.hints === 'boolean' ? s.hints : cur.hints,
      onlyCustom: typeof s.onlyCustom === 'boolean' ? s.onlyCustom : cur.onlyCustom,
      customWords: cur.customWords,
      customCount: cur.customCount,
    };
    if (Array.isArray(s.customWords)) {
      const seen = new Set<string>();
      const words: string[] = [];
      for (const w of s.customWords) {
        if (typeof w !== 'string') continue;
        const clean = w.trim().replace(/\s+/g, ' ').slice(0, LIMITS.wordLength);
        const key = clean.toLowerCase();
        if (clean && !seen.has(key)) {
          seen.add(key);
          words.push(clean);
        }
        if (words.length >= LIMITS.maxCustomWords) break;
      }
      next.customWords = words;
      next.customCount = words.length;
    }
    this.settings = next;
    this.broadcastRoom();
  }

  private kick(id: string, target: string) {
    if (id !== this.hostId || target === id || !this.players.has(target)) return;
    const name = this.players.get(target)!.name;
    this.kicked.add(target);
    this.transport.send(target, { t: 'error', code: 'kicked', message: 'Bạn đã bị chủ phòng mời ra.' });
    this.transport.disconnect(target);
    this.chatAll({ kind: 'system', text: `${name} đã bị mời ra khỏi phòng.` });
    this.remove(target);
  }

  // ───────────────────────── Vòng chơi ─────────────────────────

  private connectedIds() {
    return [...this.players.values()].filter((p) => p.connected).map((p) => p.id);
  }

  private start(id: string) {
    if (id !== this.hostId || (this.phase !== 'lobby' && this.phase !== 'gameOver')) return;
    const ids = this.connectedIds();
    if (ids.length < 2) {
      this.transport.send(id, { t: 'chat', msg: { kind: 'system', text: 'Cần ít nhất 2 người để bắt đầu.' } });
      return;
    }
    for (const p of this.players.values()) p.score = 0;
    this.usedWords.clear();
    this.round = 1;
    this.order = ids;
    this.turnIdx = -1;
    this.chatAll({ kind: 'system', text: 'Trò chơi bắt đầu!' });
    this.nextTurn();
  }

  private nextTurn() {
    this.clearTimers();
    this.word = null;
    this.reveal = null;
    this.gains = {};
    this.revealed.clear();
    this.setOps([]);
    for (const p of this.players.values()) p.guessed = false;

    let drawer: string | null = null;
    while (!drawer) {
      this.turnIdx++;
      if (this.turnIdx >= this.order.length) {
        this.round++;
        if (this.round > this.settings.rounds) return this.gameOver();
        this.order = this.connectedIds();
        this.turnIdx = 0;
        if (this.order.length < 2) {
          this.chatAll({ kind: 'system', text: 'Không đủ người chơi, quay về phòng chờ.' });
          return this.toLobby();
        }
      }
      const cand = this.players.get(this.order[this.turnIdx]);
      if (cand?.connected) drawer = cand.id;
    }

    this.drawerId = drawer;
    this.choices = this.pickWords(this.settings.wordChoices);
    this.phase = 'choosing';
    this.endsAt = Date.now() + LIMITS.chooseTime;
    this.transport.send(drawer, { t: 'choices', words: this.choices });
    this.later(LIMITS.chooseTime, () => this.startDrawing(Math.floor(this.rng() * this.choices.length)));
    this.broadcastRoom();
  }

  private choose(id: string, index: unknown) {
    if (id !== this.drawerId || this.phase !== 'choosing') return;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= this.choices.length) return;
    this.startDrawing(index);
  }

  private startDrawing(index: number) {
    if (this.phase !== 'choosing' || !this.drawerId) return;
    this.clearTimers();
    const word = this.choices[index] ?? this.choices[0];
    this.word = word;
    this.usedWords.add(word.toLowerCase());
    this.phase = 'drawing';
    this.turnStart = Date.now();
    const total = this.settings.drawTime * 1000;
    this.endsAt = this.turnStart + total;
    this.transport.send(this.drawerId, { t: 'word', word });

    if (this.settings.hints) {
      const count = hintCount(word);
      for (let i = 0; i < count; i++) {
        const frac = 0.35 + (0.5 * (i + 1)) / (count + 1);
        this.later(total * frac, () => this.revealLetter());
      }
    }
    this.later(total, () => {
      this.chatAll({ kind: 'system', text: 'Hết giờ!' });
      this.endTurn();
    });
    const drawer = this.players.get(this.drawerId);
    this.chatAll({ kind: 'system', text: `${drawer?.name ?? '?'} đang vẽ.` });
    this.broadcastRoom();
  }

  private revealLetter() {
    if (this.phase !== 'drawing' || !this.word) return;
    const hidden = letterIndexes(this.word).filter((i) => !this.revealed.has(i));
    if (hidden.length <= 1) return;
    this.revealed.add(hidden[Math.floor(this.rng() * hidden.length)]);
    this.broadcastRoom();
  }

  private guess(p: Player, raw: unknown) {
    const text = String(raw ?? '').trim().slice(0, LIMITS.chatLength);
    if (!text) return;

    // chống spam chat: tối đa 5 tin / 3 giây
    const now = Date.now();
    p.chatTimes = p.chatTimes.filter((t) => now - t < 3000);
    if (p.chatTimes.length >= 5) {
      this.transport.send(p.id, { t: 'chat', msg: { kind: 'system', text: 'Bạn gửi tin quá nhanh!' } });
      return;
    }
    p.chatTimes.push(now);

    const msg: ChatMsg = { kind: 'chat', name: p.name, text };
    if (this.phase !== 'drawing' || !this.word) return this.chatAll(msg);

    // Người vẽ hoặc người đã đoán đúng: chỉ những người "biết đáp án" mới thấy
    if (p.id === this.drawerId || p.guessed) return this.chatSecret({ ...msg, kind: 'secret' });

    const result = checkGuess(text, this.word);
    if (result === 'correct') {
      p.guessed = true;
      const remaining = Math.max(0, this.endsAt - now);
      const total = this.settings.drawTime * 1000;
      const order = Object.keys(this.gains).filter((k) => k !== this.drawerId).length;
      const pts = Math.round(50 + 250 * (remaining / total)) + Math.max(0, 30 - order * 10);
      p.score += pts;
      this.gains[p.id] = pts;
      this.transport.send(p.id, { t: 'word', word: this.word });
      this.chatAll({ kind: 'correct', name: p.name, text: `${p.name} đã đoán đúng! (+${pts})` });
      this.broadcastRoom();
      this.checkAllGuessed();
    } else if (result === 'close') {
      this.transport.send(p.id, { t: 'chat', msg: { kind: 'close', text: `"${text}" gần đúng rồi!` } });
    } else {
      this.chatAll(msg);
    }
  }

  private checkAllGuessed() {
    if (this.phase !== 'drawing') return;
    const guessers = [...this.players.values()].filter((p) => p.connected && p.id !== this.drawerId);
    if (guessers.length > 0 && guessers.every((p) => p.guessed)) {
      this.chatAll({ kind: 'system', text: 'Mọi người đều đã đoán đúng!' });
      this.endTurn();
    }
  }

  private endTurn() {
    if (this.phase !== 'drawing' && this.phase !== 'choosing') return;
    this.clearTimers();
    const correct = Object.keys(this.gains).length;
    const drawer = this.drawerId ? this.players.get(this.drawerId) : undefined;
    if (drawer && correct > 0) {
      const pts = Math.min(300, correct * 50);
      drawer.score += pts;
      this.gains[drawer.id] = pts;
    }
    this.reveal = { word: this.word ?? '', gains: this.gains };
    this.phase = 'turnEnd';
    this.endsAt = Date.now() + LIMITS.turnEndTime;
    this.strokeOpen = false;
    this.later(LIMITS.turnEndTime, () => this.nextTurn());
    this.broadcastRoom();
  }

  private gameOver() {
    this.clearTimers();
    this.phase = 'gameOver';
    this.drawerId = null;
    this.word = null;
    this.endsAt = 0;
    this.reveal = null;
    const top = [...this.players.values()].sort((a, b) => b.score - a.score)[0];
    if (top) this.chatAll({ kind: 'system', text: `🏆 ${top.name} chiến thắng với ${top.score} điểm!` });
    this.broadcastRoom();
  }

  private toLobby() {
    this.clearTimers();
    this.phase = 'lobby';
    this.round = 0;
    this.order = [];
    this.turnIdx = -1;
    this.drawerId = null;
    this.word = null;
    this.endsAt = 0;
    this.reveal = null;
    for (const p of this.players.values()) p.guessed = false;
    this.setOps([]);
    this.broadcastRoom();
  }

  private reset() {
    this.clearTimers();
    this.created = false;
    this.hostId = null;
    this.kicked.clear();
    this.settings = { ...DEFAULT_SETTINGS };
    this.phase = 'lobby';
    this.round = 0;
    this.order = [];
    this.turnIdx = -1;
    this.drawerId = null;
    this.word = null;
    this.ops = [];
    this.totalPoints = 0;
    this.reveal = null;
  }

  private pickWords(n: number): string[] {
    const custom = this.settings.customWords;
    let pool = this.settings.onlyCustom && custom.length >= n ? custom : [...this.wordBank, ...custom];
    const fresh = pool.filter((w) => !this.usedWords.has(w.toLowerCase()));
    if (fresh.length >= n) pool = fresh;
    const copy = [...pool];
    const out: string[] = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(this.rng() * copy.length), 1)[0]);
    }
    return out;
  }

  // ───────────────────────── Vẽ ─────────────────────────

  private draw(id: string, msg: Extract<ClientMsg, { t: 'begin' | 'points' | 'fill' | 'undo' | 'clear' }>) {
    if (id !== this.drawerId || this.phase !== 'drawing') return;
    switch (msg.t) {
      case 'begin': {
        const p = cleanPoints(msg.p);
        if (!p || !COLOR_RE.test(msg.c) || this.totalPoints + p.length > LIMITS.maxTotalPoints) return;
        const w = clampInt(msg.w, 1, LIMITS.maxBrushSize, 4);
        this.ops.push({ k: 's', c: msg.c, w, p: p.slice() });
        this.totalPoints += p.length;
        this.strokeOpen = true;
        this.relay(id, { t: 'begin', c: msg.c, w, p });
        return;
      }
      case 'points': {
        const p = cleanPoints(msg.p);
        const last = this.ops[this.ops.length - 1];
        if (!p || !this.strokeOpen || !last || last.k !== 's') return;
        if (this.totalPoints + p.length > LIMITS.maxTotalPoints) return;
        last.p.push(...p);
        this.totalPoints += p.length;
        this.relay(id, { t: 'points', p });
        return;
      }
      case 'fill': {
        if (!COLOR_RE.test(msg.c) || this.ops.length > 5000) return;
        const x = clampInt(msg.x, 0, 799, 0);
        const y = clampInt(msg.y, 0, 599, 0);
        this.ops.push({ k: 'f', c: msg.c, x, y });
        this.strokeOpen = false;
        this.relay(id, { t: 'fill', c: msg.c, x, y });
        return;
      }
      case 'undo': {
        const op = this.ops.pop();
        if (op?.k === 's') this.totalPoints -= op.p.length;
        this.strokeOpen = false;
        this.relay(id, { t: 'undo' });
        return;
      }
      case 'clear': {
        this.ops = [];
        this.totalPoints = 0;
        this.strokeOpen = false;
        this.relay(id, { t: 'clear' });
        return;
      }
    }
  }

  private setOps(ops: DrawOp[]) {
    this.ops = ops;
    this.totalPoints = 0;
    this.strokeOpen = false;
    for (const p of this.players.keys()) this.transport.send(p, { t: 'ops', ops });
  }

  // ───────────────────────── Gửi tin ─────────────────────────

  private relay(from: string, msg: ServerMsg) {
    for (const id of this.players.keys()) if (id !== from) this.transport.send(id, msg);
  }

  private chatAll(msg: ChatMsg) {
    for (const id of this.players.keys()) this.transport.send(id, { t: 'chat', msg });
  }

  private chatSecret(msg: ChatMsg) {
    for (const p of this.players.values()) {
      if (p.id === this.drawerId || p.guessed) this.transport.send(p.id, { t: 'chat', msg });
    }
  }

  private reject(id: string, code: ErrorCode, message: string) {
    this.transport.send(id, { t: 'error', code, message });
    return false;
  }

  private viewFor(id: string): RoomView {
    const players: PlayerView[] = [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, score: p.score, guessed: p.guessed, connected: p.connected,
    }));
    const settings = { ...this.settings, customWords: id === this.hostId ? this.settings.customWords : [] };
    return {
      code: this.code,
      hostId: this.hostId,
      players,
      settings,
      phase: this.phase,
      round: this.round,
      drawerId: this.drawerId,
      hint: this.word && this.phase === 'drawing' ? makeHint(this.word, this.revealed) : '',
      endsAt: this.endsAt,
      now: Date.now(),
      reveal: this.reveal,
    };
  }

  private broadcastRoom() {
    for (const id of this.players.keys()) this.transport.send(id, { t: 'room', room: this.viewFor(id) });
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.drawerLeaveTimer) clearTimeout(this.drawerLeaveTimer);
    this.drawerLeaveTimer = null;
  }
}
