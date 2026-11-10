// Giao thức trao đổi giữa client và server (dùng chung cho cả 2 bên)

/** Kích thước "logic" của bảng vẽ. Mọi client dùng chung hệ tọa độ này. */
export const CANVAS_W = 800;
export const CANVAS_H = 600;

export type Phase = 'lobby' | 'choosing' | 'drawing' | 'turnEnd' | 'gameOver';

export interface Settings {
  rounds: number; // số vòng (1..10)
  drawTime: number; // giây mỗi lượt vẽ (30..240)
  wordChoices: number; // số từ cho người vẽ chọn (1..5)
  hints: boolean; // tự mở dần chữ cái
  maxPlayers: number; // 2..16
  customWords: string[]; // từ do chủ phòng thêm (chỉ gửi cho chủ phòng)
  customCount: number; // số từ tùy chỉnh (gửi cho mọi người)
  onlyCustom: boolean; // chỉ dùng từ tùy chỉnh
  topics: string[]; // chủ đề được chọn — rỗng = tất cả
}

export const DEFAULT_SETTINGS: Settings = {
  rounds: 3,
  drawTime: 80,
  wordChoices: 3,
  hints: true,
  maxPlayers: 12,
  customWords: [],
  customCount: 0,
  onlyCustom: false,
  topics: [],
};

export const LIMITS = {
  nameLength: 20,
  chatLength: 100,
  wordLength: 30,
  maxCustomWords: 500,
  chooseTime: 15_000,
  turnEndTime: 6_000,
  reconnectGrace: 20_000,
  drawerGrace: 8_000,
  maxBrushSize: 60,
  maxPointsPerMsg: 2_000,
  maxTotalPoints: 400_000,
} as const;

export interface PlayerView {
  id: string;
  name: string;
  avatar: string;
  score: number;
  guessed: boolean;
  connected: boolean;
}

export interface RoomView {
  code: string;
  hostId: string | null;
  players: PlayerView[];
  settings: Settings;
  phase: Phase;
  round: number;
  drawerId: string | null;
  /** Gợi ý: '_' là chữ ẩn, ' ' là khoảng trắng, còn lại là chữ đã lộ */
  hint: string;
  /** Chủ đề của từ đang vẽ (id trong shared/topics.ts, hoặc 'custom') */
  topic: string | null;
  /** Thời điểm (theo đồng hồ server) kết thúc pha hiện tại, 0 nếu không có */
  endsAt: number;
  /** Giờ server lúc gửi, để client bù lệch đồng hồ */
  now: number;
  /** Kết quả lượt vừa xong (pha turnEnd) */
  reveal: { word: string; gains: Record<string, number> } | null;
}

/** Một thao tác vẽ. Nét vẽ: p = [x0,y0,x1,y1,...] (số nguyên trong hệ 800x600) */
export type DrawOp =
  | { k: 's'; c: string; w: number; p: number[] }
  | { k: 'f'; c: string; x: number; y: number };

export type ChatKind = 'chat' | 'system' | 'correct' | 'close' | 'secret' | 'join' | 'leave';

export interface ChatMsg {
  kind: ChatKind;
  name?: string;
  text: string;
}

export type ErrorCode = 'not_found' | 'full' | 'kicked' | 'replaced' | 'bad_request';

export type ClientMsg =
  | { t: 'hello'; playerId: string; name: string; avatar: string; create: boolean }
  | { t: 'settings'; settings: Partial<Settings> }
  | { t: 'start' }
  | { t: 'lobby' }
  | { t: 'choose'; index: number }
  | { t: 'begin'; c: string; w: number; p: number[] }
  | { t: 'points'; p: number[] }
  | { t: 'fill'; c: string; x: number; y: number }
  | { t: 'undo' }
  | { t: 'clear' }
  | { t: 'guess'; text: string }
  | { t: 'kick'; playerId: string }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'welcome'; you: string; room: RoomView; ops: DrawOp[] }
  | { t: 'room'; room: RoomView }
  | { t: 'choices'; words: string[] }
  | { t: 'word'; word: string }
  | { t: 'chat'; msg: ChatMsg }
  | { t: 'begin'; c: string; w: number; p: number[] }
  | { t: 'points'; p: number[] }
  | { t: 'fill'; c: string; x: number; y: number }
  | { t: 'undo' }
  | { t: 'clear' }
  | { t: 'ops'; ops: DrawOp[] }
  | { t: 'error'; code: ErrorCode; message: string };

export const ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;
