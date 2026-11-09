import type { RoomView } from '../../../shared/protocol';

interface Props {
  room: RoomView;
  you: string | null;
  onKick: (id: string) => void;
}

export function PlayerList({ room, you, onKick }: Props) {
  const inGame = room.phase !== 'lobby';
  const players = inGame ? [...room.players].sort((a, b) => b.score - a.score) : room.players;
  const isHost = you === room.hostId;

  return (
    <ul className="players">
      {players.map((p, i) => {
        const drawing = p.id === room.drawerId;
        return (
          <li
            key={p.id}
            className={[
              'player',
              p.id === you ? 'me' : '',
              drawing ? 'drawing' : '',
              p.guessed ? 'guessed' : '',
              p.connected ? '' : 'offline',
            ].join(' ')}
          >
            {inGame && <span className="rank">#{i + 1}</span>}
            <span className="avatar">{p.avatar}</span>
            <span className="info">
              <span className="name">
                {p.name}
                {p.id === you && <small> (bạn)</small>}
              </span>
              {inGame && <span className="score">{p.score} điểm</span>}
              {!p.connected && <span className="score">mất kết nối…</span>}
            </span>
            <span className="badges">
              {p.id === room.hostId && <span title="Chủ phòng">👑</span>}
              {drawing && <span title="Đang vẽ">✏️</span>}
              {p.guessed && <span title="Đã đoán đúng">✅</span>}
              {isHost && p.id !== you && (
                <button
                  className="kick"
                  title="Mời ra khỏi phòng"
                  onClick={() => confirm(`Mời ${p.name} ra khỏi phòng?`) && onKick(p.id)}
                >
                  ✕
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
