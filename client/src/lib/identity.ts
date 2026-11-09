export interface Profile {
  name: string;
  avatar: string;
}

export const AVATARS = [
  '🐱', '🐶', '🐼', '🦊', '🐸', '🐵', '🐯', '🦁', '🐷', '🐰', '🐻', '🐨',
  '🐔', '🐧', '🦄', '🐙', '🐳', '🦖', '👻', '🤖', '👽', '🎃', '🌵', '🍉',
];

const PROFILE_KEY = 've-doan:profile';
const ID_KEY = 've-doan:playerId';

function safeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store: Storage, key: string, value: string | null) {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* chế độ ẩn danh / bị chặn */
  }
}

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(safeGet(localStorage, PROFILE_KEY) ?? '');
    if (p && typeof p.name === 'string' && typeof p.avatar === 'string') return p;
  } catch {
    /* chưa có */
  }
  return { name: '', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)] };
}

export function saveProfile(p: Profile) {
  safeSet(localStorage, PROFILE_KEY, JSON.stringify(p));
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
}

let memoryId: string | null = null;

/** Mỗi tab có một id riêng (sessionStorage) → tải lại trang vẫn giữ được chỗ trong phòng */
export function getPlayerId(): string {
  const saved = safeGet(sessionStorage, ID_KEY);
  if (saved) return saved;
  memoryId ??= randomId();
  safeSet(sessionStorage, ID_KEY, memoryId);
  return memoryId;
}

const ROOM_KEY = 've-doan:room';

export function saveSession(s: { code: string; create: boolean } | null) {
  safeSet(sessionStorage, ROOM_KEY, s ? JSON.stringify(s) : null);
}

export function loadSession(): { code: string; create: boolean } | null {
  try {
    const s = JSON.parse(safeGet(sessionStorage, ROOM_KEY) ?? '');
    if (s && typeof s.code === 'string') return { code: s.code, create: !!s.create };
  } catch {
    /* không có */
  }
  return null;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ ký tự dễ nhầm: I, O, 0, 1

export function newRoomCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}
