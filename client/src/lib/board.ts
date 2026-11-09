import { CANVAS_H, CANVAS_W, type DrawOp } from '../../../shared/protocol';

const BG = '#ffffff';

/** Giữ danh sách thao tác vẽ và render lên canvas (vẽ tăng dần, chỉ vẽ lại toàn bộ khi undo/đồng bộ) */
export class Board {
  ops: DrawOp[] = [];
  private ctx: CanvasRenderingContext2D | null = null;

  attach(canvas: HTMLCanvasElement | null) {
    this.ctx = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
    this.redraw();
  }

  reset(ops: DrawOp[]) {
    this.ops = ops.map((o) => (o.k === 's' ? { ...o, p: [...o.p] } : { ...o }));
    this.redraw();
  }

  begin(c: string, w: number, p: number[]) {
    const op: DrawOp = { k: 's', c, w, p: [...p] };
    this.ops.push(op);
    this.drawStroke(op, 0);
  }

  points(p: number[]) {
    const last = this.ops[this.ops.length - 1];
    if (!last || last.k !== 's') return;
    const from = last.p.length;
    last.p.push(...p);
    this.drawStroke(last, from);
  }

  fill(c: string, x: number, y: number) {
    this.ops.push({ k: 'f', c, x, y });
    if (this.ctx) floodFill(this.ctx, x, y, c);
  }

  undo() {
    this.ops.pop();
    this.redraw();
  }

  clear() {
    this.ops = [];
    this.redraw();
  }

  /** Ảnh PNG của bảng vẽ hiện tại */
  toDataURL(): string | null {
    return this.ctx?.canvas.toDataURL('image/png') ?? null;
  }

  private redraw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const op of this.ops) {
      if (op.k === 's') this.drawStroke(op, 0);
      else floodFill(ctx, op.x, op.y, op.c);
    }
  }

  private drawStroke(op: Extract<DrawOp, { k: 's' }>, from: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const p = op.p;
    ctx.strokeStyle = op.c;
    ctx.fillStyle = op.c;
    ctx.lineWidth = op.w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (p.length === 2) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], op.w / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const start = Math.max(0, from - 2);
    ctx.beginPath();
    ctx.moveTo(p[start], p[start + 1]);
    for (let i = start + 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Tô màu vùng (flood fill) có dung sai để xử lý viền khử răng cưa */
export function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, hex: string) {
  const W = CANVAS_W;
  const H = CANVAS_H;
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const [r, g, b] = hexToRgb(hex);
  const start = sy * W + sx;
  const tr = d[start * 4];
  const tg = d[start * 4 + 1];
  const tb = d[start * 4 + 2];
  if (Math.abs(tr - r) + Math.abs(tg - g) + Math.abs(tb - b) < 6) return;

  const TOL = 100;
  const visited = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let sp = 0;
  stack[sp++] = start;
  visited[start] = 1;
  const match = (i: number) => {
    const j = i * 4;
    return Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) <= TOL;
  };
  const filled: number[] = [];
  while (sp > 0) {
    const p = stack[--sp];
    filled.push(p);
    const x = p % W;
    if (x > 0 && !visited[p - 1] && match(p - 1)) { visited[p - 1] = 1; stack[sp++] = p - 1; }
    if (x < W - 1 && !visited[p + 1] && match(p + 1)) { visited[p + 1] = 1; stack[sp++] = p + 1; }
    if (p >= W && !visited[p - W] && match(p - W)) { visited[p - W] = 1; stack[sp++] = p - W; }
    if (p < W * (H - 1) && !visited[p + W] && match(p + W)) { visited[p + W] = 1; stack[sp++] = p + W; }
  }
  const paint = (p: number) => {
    const j = p * 4;
    d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255;
  };
  for (const p of filled) paint(p);
  // Nới thêm 1px vào viền để không còn khe trắng cạnh nét vẽ
  for (const p of filled) {
    const x = p % W;
    if (x > 0 && !visited[p - 1]) paint(p - 1);
    if (x < W - 1 && !visited[p + 1]) paint(p + 1);
    if (p >= W && !visited[p - W]) paint(p - W);
    if (p < W * (H - 1) && !visited[p + W]) paint(p + W);
  }
  ctx.putImageData(img, 0, 0);
}
