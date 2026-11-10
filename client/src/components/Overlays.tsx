import type { RoomView } from '../../../shared/protocol';
import { topicInfo } from '../../../shared/topics';
import { Countdown } from './Countdown';

interface Props {
  room: RoomView;
  you: string | null;
  choices: string[];
  offset: number;
  onChoose: (i: number) => void;
  onStart: () => void;
  onLobby: () => void;
  onSaveImage: () => void;
}

export function Overlay({ room, you, choices, offset, onChoose, onStart, onLobby, onSaveImage }: Props) {
  const drawer = room.players.find((p) => p.id === room.drawerId);
  const isHost = you === room.hostId;

  // ── Chọn từ ──
  if (room.phase === 'choosing') {
    if (room.drawerId === you) {
      return (
        <div className="overlay">
          <div className="overlay-card">
            <div className="card-kicker">Đến lượt bạn vẽ!</div>
            <h2 className="card-title">Chọn một từ</h2>
            <div className="choices">
              {choices.map((w, i) => (
                <button key={w} className="choice" onClick={() => onChoose(i)}>{w}</button>
              ))}
            </div>
            <p className="card-foot">Tự chọn sau <b><Countdown endsAt={room.endsAt} offset={offset} />s</b></p>
          </div>
        </div>
      );
    }
    return (
      <div className="overlay">
        <div className="overlay-card compact">
          <div className="avatar-bubble">{drawer?.avatar}</div>
          <h2 className="card-title">{drawer?.name ?? '…'}</h2>
          <p className="card-sub">đang chọn từ<span className="dots" /></p>
        </div>
      </div>
    );
  }

  // ── Kết quả lượt ──
  if (room.phase === 'turnEnd' && room.reveal) {
    const { word, gains } = room.reveal;
    const topic = topicInfo(room.topic);
    const guessers = room.players.filter((p) => p.id !== room.drawerId);
    const correct = guessers.filter((p) => gains[p.id]).length;
    const rows = [...room.players].sort((a, b) => (gains[b.id] ?? 0) - (gains[a.id] ?? 0));
    const summary = !word
      ? 'Lượt này bị bỏ qua'
      : correct === 0
        ? 'Không ai đoán ra 😅'
        : correct === guessers.length
          ? `Cả ${correct} người đều đoán đúng 🎉`
          : `${correct}/${guessers.length} người đoán đúng`;

    return (
      <div className="overlay">
        <div className="overlay-card">
          {word ? (
            <>
              <div className="card-kicker">Đáp án là</div>
              <div className="reveal-word">{word}</div>
              {topic && <span className="topic-badge">{topic.emoji} {topic.name}</span>}
            </>
          ) : (
            <h2 className="card-title">⏭️ Bỏ qua lượt</h2>
          )}
          <p className="card-sub">{summary}</p>

          <ul className="score-list">
            {rows.map((p) => {
              const g = gains[p.id] ?? 0;
              const isDrawer = p.id === room.drawerId;
              return (
                <li key={p.id} className={g ? 'won' : 'none'}>
                  <span className="who">
                    <span className="av">{p.avatar}</span>
                    <span className="nm">{p.name}{p.id === you && <small> (bạn)</small>}</span>
                    {isDrawer && <span className="tag">✏️ người vẽ</span>}
                  </span>
                  <span className={`pts ${g ? 'plus' : ''}`}>{g ? `+${g}` : '+0'}</span>
                </li>
              );
            })}
          </ul>

          <div className="card-actions">
            {word && <button className="btn small" onClick={onSaveImage}>💾 Lưu tranh</button>}
            <span className="card-foot">Lượt tiếp theo sau <b><Countdown endsAt={room.endsAt} offset={offset} />s</b></span>
          </div>
        </div>
      </div>
    );
  }

  // ── Kết thúc ván ──
  if (room.phase === 'gameOver') {
    const ranking = [...room.players].sort((a, b) => b.score - a.score);
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className="overlay">
        <div className="overlay-card wide">
          <div className="card-kicker">Kết thúc ván</div>
          <h2 className="card-title">🏆 {ranking[0]?.name} chiến thắng!</h2>
          <div className="podium">
            {ranking.slice(0, 3).map((p, i) => (
              <div key={p.id} className={`step step-${i + 1}`}>
                <div className="av">{p.avatar}</div>
                <div className="nm">{p.name}</div>
                <div className="sc">{p.score}</div>
                <div className="block">{medals[i]}</div>
              </div>
            ))}
          </div>
          {ranking.length > 3 && (
            <ol className="score-list rest" start={4}>
              {ranking.slice(3).map((p, i) => (
                <li key={p.id} className="none">
                  <span className="who"><span className="rank">#{i + 4}</span><span className="av">{p.avatar}</span><span className="nm">{p.name}</span></span>
                  <span className="pts">{p.score}</span>
                </li>
              ))}
            </ol>
          )}
          {isHost ? (
            <div className="card-actions center">
              <button className="btn primary" onClick={onStart}>🔁 Chơi lại</button>
              <button className="btn" onClick={onLobby}>⚙️ Về phòng chờ</button>
            </div>
          ) : (
            <p className="card-foot">Đang chờ chủ phòng chơi lại…</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
