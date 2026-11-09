import type { RoomView } from '../../../shared/protocol';
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

  if (room.phase === 'choosing') {
    if (room.drawerId === you) {
      return (
        <div className="overlay">
          <h2>Chọn một từ để vẽ</h2>
          <div className="choices">
            {choices.map((w, i) => (
              <button key={w} className="btn primary" onClick={() => onChoose(i)}>{w}</button>
            ))}
          </div>
          <p className="muted">Tự chọn sau <Countdown endsAt={room.endsAt} offset={offset} /> giây</p>
        </div>
      );
    }
    return (
      <div className="overlay">
        <div className="big-avatar">{drawer?.avatar}</div>
        <h2>{drawer?.name ?? '…'} đang chọn từ…</h2>
      </div>
    );
  }

  if (room.phase === 'turnEnd' && room.reveal) {
    const { word, gains } = room.reveal;
    const rows = [...room.players].sort((a, b) => (gains[b.id] ?? 0) - (gains[a.id] ?? 0));
    return (
      <div className="overlay">
        {word ? (
          <h2>Đáp án là: <span className="answer">{word}</span></h2>
        ) : (
          <h2>Lượt này bị bỏ qua</h2>
        )}
        <ul className="gains">
          {rows.map((p) => (
            <li key={p.id} className={gains[p.id] ? 'plus' : ''}>
              <span>{p.avatar} {p.name}{p.id === room.drawerId ? ' ✏️' : ''}</span>
              <b>{gains[p.id] ? `+${gains[p.id]}` : '0'}</b>
            </li>
          ))}
        </ul>
        {word && <button className="btn small" onClick={onSaveImage}>💾 Lưu tranh</button>}
      </div>
    );
  }

  if (room.phase === 'gameOver') {
    const ranking = [...room.players].sort((a, b) => b.score - a.score);
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className="overlay">
        <h2>🏆 Kết quả</h2>
        <div className="podium">
          {ranking.slice(0, 3).map((p, i) => (
            <div key={p.id} className={`step step-${i + 1}`}>
              <div className="big-avatar">{p.avatar}</div>
              <div className="name">{medals[i]} {p.name}</div>
              <div className="score">{p.score} điểm</div>
            </div>
          ))}
        </div>
        {ranking.length > 3 && (
          <ol className="rest" start={4}>
            {ranking.slice(3).map((p) => (
              <li key={p.id}>{p.avatar} {p.name} – {p.score} điểm</li>
            ))}
          </ol>
        )}
        {isHost ? (
          <div className="choices">
            <button className="btn primary" onClick={onStart}>🔁 Chơi lại</button>
            <button className="btn" onClick={onLobby}>⚙️ Về phòng chờ</button>
          </div>
        ) : (
          <p className="muted">Đang chờ chủ phòng…</p>
        )}
      </div>
    );
  }

  return null;
}
