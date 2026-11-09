import { DurableObject } from 'cloudflare:workers';
import { ROOM_CODE_RE, type ClientMsg, type ServerMsg } from '../../shared/protocol';
import { Game } from './game';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** Danh sách origin được phép, cách nhau bởi dấu phẩy. Để trống = cho phép tất cả. */
  ALLOWED_ORIGINS?: string;
}

const IDLE_LIMIT = 30 * 60_000; // đóng phòng nếu 30 phút không ai làm gì

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const code = (url.searchParams.get('room') ?? '').toUpperCase();
      if (!ROOM_CODE_RE.test(code)) return new Response('Mã phòng không hợp lệ', { status: 400 });
      if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Cần kết nối WebSocket', { status: 426 });
      }
      const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const origin = req.headers.get('Origin') ?? '';
      if (allowed.length && !allowed.includes(origin)) return new Response('Origin không được phép', { status: 403 });

      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(req);
    }
    return new Response('Vẽ Đoán server đang chạy ✔', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
} satisfies ExportedHandler<Env>;

/** Mỗi phòng chơi là một Durable Object */
export class Room extends DurableObject<Env> {
  private game: Game | null = null;
  private sockets = new Map<string, WebSocket>();
  private lastActivity = Date.now();
  private idleTimer: ReturnType<typeof setInterval> | null = null;

  async fetch(req: Request): Promise<Response> {
    const code = (new URL(req.url).searchParams.get('room') ?? '').toUpperCase();
    const game = (this.game ??= new Game(code, {
      send: (id, msg) => this.send(id, msg),
      disconnect: (id) => {
        const ws = this.sockets.get(id);
        this.sockets.delete(id);
        try { ws?.close(4003, 'kicked'); } catch { /* đã đóng */ }
      },
    }));

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.startIdleCheck();

    let playerId: string | null = null;

    server.addEventListener('message', (ev) => {
      let msg: ClientMsg;
      try {
        if (typeof ev.data !== 'string' || ev.data.length > 64_000) return;
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg?.t === 'ping') return;
      this.lastActivity = Date.now();

      if (!playerId) {
        if (msg?.t !== 'hello' || typeof msg.playerId !== 'string' || !msg.playerId) {
          server.close(4000, 'hello required');
          return;
        }
        const id = msg.playerId.slice(0, 64);
        const old = this.sockets.get(id);
        if (old && old !== server) {
          try {
            old.send(JSON.stringify({ t: 'error', code: 'replaced', message: 'Bạn đã mở phòng này ở tab khác.' }));
            old.close(4002, 'replaced');
          } catch { /* đã đóng */ }
        }
        this.sockets.set(id, server);
        if (game.join(id, msg.name, msg.avatar, !!msg.create)) {
          playerId = id;
        } else {
          this.sockets.delete(id);
          server.close(4001, 'rejected');
        }
        return;
      }
      game.handle(playerId, msg);
    });

    const onClose = () => {
      if (playerId && this.sockets.get(playerId) === server) {
        this.sockets.delete(playerId);
        game.disconnect(playerId);
      }
      if (this.sockets.size === 0) this.stopIdleCheck();
    };
    server.addEventListener('close', onClose);
    server.addEventListener('error', onClose);

    return new Response(null, { status: 101, webSocket: client });
  }

  private send(id: string, msg: ServerMsg) {
    const ws = this.sockets.get(id);
    if (!ws) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket đã đóng */
    }
  }

  private startIdleCheck() {
    if (this.idleTimer) return;
    this.idleTimer = setInterval(() => {
      if (Date.now() - this.lastActivity < IDLE_LIMIT) return;
      for (const ws of this.sockets.values()) {
        try {
          ws.send(JSON.stringify({ t: 'error', code: 'not_found', message: 'Phòng đã đóng vì lâu không hoạt động.' }));
          ws.close(4004, 'idle');
        } catch { /* bỏ qua */ }
      }
      this.sockets.clear();
      this.game?.dispose();
      this.game = null;
      this.stopIdleCheck();
    }, 60_000);
  }

  private stopIdleCheck() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
  }
}
