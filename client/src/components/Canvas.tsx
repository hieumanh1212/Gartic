import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { CANVAS_H, CANVAS_W, type ClientMsg } from '../../../shared/protocol';
import type { Board } from '../lib/board';

const COLORS = [
  '#000000', '#555555', '#9e9e9e', '#ffffff', '#7a4a1e', '#c0763b',
  '#e53935', '#ff7aa8', '#fb8c00', '#fdd835', '#7cb342', '#1b8f3a',
  '#26c6da', '#1e88e5', '#283593', '#8e24aa', '#f5c7a9', '#ffe0b2',
];
const SIZES = [3, 7, 14, 24, 40];
type Tool = 'pen' | 'eraser' | 'fill';

interface Props {
  board: Board;
  canDraw: boolean;
  send: (msg: ClientMsg) => void;
  children?: React.ReactNode;
}

export function Canvas({ board, canDraw, send, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(7);

  const drawing = useRef(false);
  const last = useRef<[number, number]>([0, 0]);
  const pending = useRef<number[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    board.attach(canvasRef.current);
    return () => board.attach(null);
  }, [board]);

  const flush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    if (pending.current.length) {
      send({ t: 'points', p: pending.current });
      pending.current = [];
    }
  }, [send]);

  // Hết lượt giữa chừng → dừng nét đang vẽ
  useEffect(() => {
    if (!canDraw) {
      drawing.current = false;
      pending.current = [];
    }
  }, [canDraw]);

  const undo = useCallback(() => {
    if (!canDraw) return;
    flush();
    board.undo();
    send({ t: 'undo' });
  }, [board, canDraw, flush, send]);

  const clear = useCallback(() => {
    if (!canDraw) return;
    flush();
    board.clear();
    send({ t: 'clear' });
  }, [board, canDraw, flush, send]);

  // Ctrl+Z để hoàn tác
  useEffect(() => {
    if (!canDraw) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canDraw, undo]);

  const pos = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [
      Math.round(((e.clientX - rect.left) * CANVAS_W) / rect.width),
      Math.round(((e.clientY - rect.top) * CANVAS_H) / rect.height),
    ];
  };

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || e.button > 0) return;
    e.preventDefault();
    const [x, y] = pos(e);
    if (tool === 'fill') {
      if (x < 0 || y < 0 || x >= CANVAS_W || y >= CANVAS_H) return;
      board.fill(color, x, y);
      send({ t: 'fill', c: color, x, y });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = [x, y];
    const c = tool === 'eraser' ? '#ffffff' : color;
    const w = tool === 'eraser' ? Math.max(size, 14) : size;
    board.begin(c, w, [x, y]);
    send({ t: 'begin', c, w, p: [x, y] });
  };

  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const native = e.nativeEvent;
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    for (const ev of events.length ? events : [native]) {
      const [x, y] = pos(ev);
      const [lx, ly] = last.current;
      if (Math.abs(x - lx) + Math.abs(y - ly) < 2) continue;
      last.current = [x, y];
      board.points([x, y]);
      pending.current.push(x, y);
    }
    if (!flushTimer.current && pending.current.length) flushTimer.current = setTimeout(flush, 40);
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    flush();
  };

  const brushPreview = tool === 'eraser' ? Math.max(size, 14) : size;

  return (
    <div className="board">
      <div className="board-canvas">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={canDraw ? `drawable tool-${tool}` : ''}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        {children}
      </div>

      {canDraw && (
        <div className="toolbar">
          <div className="tools">
            <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')} title="Bút">✏️</button>
            <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')} title="Tẩy">🧽</button>
            <button className={tool === 'fill' ? 'active' : ''} onClick={() => setTool('fill')} title="Tô màu">🪣</button>
            <span className="sep" />
            <button onClick={undo} title="Hoàn tác (Ctrl+Z)">↶</button>
            <button onClick={clear} title="Xóa hết">🗑️</button>
          </div>
          <div className="colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${color === c && tool !== 'eraser' ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                  if (tool === 'eraser') setTool('pen');
                }}
                title={c}
              />
            ))}
            <label className="swatch custom" title="Màu khác" style={{ background: color }}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
          </div>
          <div className="sizes">
            {SIZES.map((s) => (
              <button key={s} className={size === s ? 'active' : ''} onClick={() => setSize(s)} title={`Cỡ ${s}`}>
                <span className="dot" style={{ width: Math.min(s, 30), height: Math.min(s, 30) }} />
              </button>
            ))}
            <span className="size-preview" style={{ width: Math.min(brushPreview, 40), height: Math.min(brushPreview, 40), background: tool === 'eraser' ? '#fff' : color }} />
          </div>
        </div>
      )}
    </div>
  );
}
