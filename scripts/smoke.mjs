// Kiểm thử đầu-cuối: giả lập 3 người chơi kết nối tới server thật (wrangler dev hoặc đã deploy)
// Dùng: node scripts/smoke.mjs [ws://localhost:8787]
const BASE = process.argv[2] ?? 'ws://localhost:8787';
const CODE = 'T' + Math.random().toString(36).slice(2, 6).toUpperCase();

function player(id, name, create) {
  const ws = new WebSocket(`${BASE}/ws?room=${CODE}`);
  const p = { id, name, ws, msgs: [], room: null, word: null, choices: null };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    p.msgs.push(m);
    if (m.t === 'room' || m.t === 'welcome') p.room = m.room;
    if (m.t === 'word') p.word = m.word;
    if (m.t === 'choices') p.choices = m.words;
  };
  p.ready = new Promise((res, rej) => {
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', playerId: id, name, avatar: '🙂', create }));
      res();
    };
    ws.onerror = rej;
  });
  p.send = (m) => ws.send(JSON.stringify(m));
  return p;
}

const wait = (cond, label, ms = 5000) =>
  new Promise((res, rej) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      let v;
      try { v = cond(); } catch { v = false; }
      if (v) { clearInterval(iv); res(v); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('Timeout: ' + label)); }
    }, 20);
  });

const ok = (msg) => console.log('  ✔', msg);

try {
  console.log(`Server: ${BASE}  Phòng: ${CODE}`);

  const ghost = player('ghost', 'Ma', false);
  await ghost.ready;
  await wait(() => ghost.msgs.find((m) => m.t === 'error' && m.code === 'not_found'), 'not_found');
  ok('Không vào được phòng chưa tồn tại');
  ghost.ws.close();

  const a = player('pa', 'An', true);
  await a.ready;
  await wait(() => a.room, 'An vào phòng');
  const b = player('pb', 'Bình', false);
  const c = player('pc', 'Chi', false);
  await Promise.all([b.ready, c.ready]);
  await wait(() => a.room.players.length === 3, '3 người');
  ok('3 người vào phòng, chủ phòng = ' + a.room.players.find((x) => x.id === a.room.hostId).name);

  a.send({ t: 'start' });
  await wait(() => a.choices, 'nhận từ để chọn');
  ok('Người vẽ nhận lựa chọn: ' + a.choices.join(' | '));
  if (b.choices) throw new Error('Người đoán không được thấy lựa chọn!');

  a.send({ t: 'choose', index: 0 });
  await wait(() => a.word && b.room.phase === 'drawing', 'bắt đầu vẽ');
  ok(`Bắt đầu vẽ "${a.word}", người đoán thấy gợi ý "${b.room.hint}"`);
  if (b.word || JSON.stringify(b.msgs).includes(a.word)) throw new Error('Lộ đáp án cho người đoán!');

  a.send({ t: 'begin', c: '#ff0000', w: 6, p: [100, 100] });
  a.send({ t: 'points', p: [120, 120, 140, 150] });
  await wait(() => c.msgs.find((m) => m.t === 'points'), 'nhận nét vẽ');
  ok('Nét vẽ được đồng bộ sang người khác');

  // Người vào sau giữa lượt phải thấy lại tranh
  const d = player('pd', 'Dũng', false);
  await d.ready;
  await wait(() => d.msgs.find((m) => m.t === 'welcome'), 'Dũng vào');
  const welcome = d.msgs.find((m) => m.t === 'welcome');
  if (welcome.ops.length !== 1 || welcome.ops[0].p.length !== 6) throw new Error('Không đồng bộ tranh cho người vào sau');
  ok('Người vào giữa lượt nhận đủ tranh đang vẽ');

  b.send({ t: 'guess', text: 'chắc chắn sai' });
  await wait(() => c.msgs.find((m) => m.t === 'chat' && m.msg.text === 'chắc chắn sai'), 'chat sai');
  ok('Đoán sai hiển thị cho mọi người');

  const noAccent = a.word.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toUpperCase();
  for (const p of [b, c, d]) p.send({ t: 'guess', text: noAccent });
  await wait(() => a.room.phase === 'turnEnd', 'kết thúc lượt');
  const gains = a.room.reveal.gains;
  ok(`Tất cả đoán đúng (gõ "${noAccent}") → hết lượt. Điểm: ` +
    a.room.players.map((p) => `${p.name}+${gains[p.id] ?? 0}`).join(', '));

  // Mất kết nối & vào lại
  b.ws.close();
  await wait(() => a.room.players.find((p) => p.id === 'pb')?.connected === false, 'Bình mất kết nối');
  const b2 = player('pb', 'Bình', false);
  await b2.ready;
  await wait(() => b2.room?.players.find((p) => p.id === 'pb')?.connected, 'Bình vào lại');
  ok('Kết nối lại giữ nguyên điểm: ' + b2.room.players.find((p) => p.id === 'pb').score);

  await wait(() => a.room.phase === 'choosing' && a.room.drawerId === 'pb', 'lượt kế tiếp', 9000);
  ok('Tự chuyển sang lượt của Bình');

  for (const p of [a, b2, c, d]) p.ws.close();
  console.log('\n✅ Smoke test PASSED');
  process.exit(0);
} catch (e) {
  console.error('\n❌ Smoke test FAILED:', e.message);
  process.exit(1);
}
