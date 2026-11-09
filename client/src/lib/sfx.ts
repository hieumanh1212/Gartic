// Âm thanh nhỏ tạo bằng WebAudio (không cần file âm thanh)
const KEY = 've-doan:muted';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;
export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', delay = 0, vol = 0.08) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    /* trình duyệt không hỗ trợ */
  }
}

export const sfx = {
  correct: () => { tone(660, 0.12); tone(880, 0.2, 'sine', 0.1); },
  close: () => tone(440, 0.12, 'triangle'),
  yourTurn: () => { tone(523, 0.1); tone(659, 0.1, 'sine', 0.1); tone(784, 0.18, 'sine', 0.2); },
  turnEnd: () => { tone(392, 0.18, 'triangle'); tone(330, 0.28, 'triangle', 0.16); },
  tick: () => tone(1000, 0.04, 'square', 0, 0.025),
  join: () => tone(720, 0.07, 'sine', 0, 0.05),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'triangle', i * 0.12)),
};
