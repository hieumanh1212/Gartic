import type { ClientMsg, ServerMsg } from '../../../shared/protocol';

export type Status = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** WebSocket tự kết nối lại (backoff), gửi ping giữ kết nối */
export class Connection {
  private ws: WebSocket | null = null;
  private retry = 0;
  private stopped = false;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private url: string,
    private hello: () => ClientMsg,
    private onMessage: (msg: ServerMsg) => void,
    private onStatus: (status: Status) => void,
  ) {}

  connect() {
    if (this.stopped) return;
    this.onStatus(this.retry === 0 ? 'connecting' : 'reconnecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.onStatus('open');
      ws.send(JSON.stringify(this.hello()));
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.t === 'error') this.stopped = true; // lỗi nghiêm trọng → không kết nối lại
      this.onMessage(msg);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) this.onStatus('closed');
      else this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    this.retry++;
    this.onStatus('reconnecting');
    const delay = Math.min(5000, 400 * 2 ** (this.retry - 1));
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
