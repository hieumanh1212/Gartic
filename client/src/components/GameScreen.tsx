import { useState } from 'react';
import type { Profile } from '../lib/identity';
import { isMuted, setMuted } from '../lib/sfx';
import { useGame } from '../lib/useGame';
import { Canvas } from './Canvas';
import { Chat } from './Chat';
import { Countdown } from './Countdown';
import { Lobby } from './Lobby';
import { Overlay } from './Overlays';
import { PlayerList } from './PlayerList';

interface Props {
  code: string;
  create: boolean;
  profile: Profile;
  onLeave: () => void;
}

export function GameScreen({ code, create, profile, onLeave }: Props) {
  const { state, board, actions } = useGame(code, create, profile);
  const { room, you, status, error } = state;
  const [muted, setMutedState] = useState(isMuted());

  if (error) {
    return (
      <div className="center-screen">
        <div className="card">
          <h2>😕 {error}</h2>
          <button className="btn primary" onClick={onLeave}>Về trang chủ</button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="center-screen">
        <div className="card">
          <div className="spinner" />
          <p>{status === 'reconnecting' ? 'Không kết nối được tới server, đang thử lại…' : 'Đang vào phòng…'}</p>
          <button className="btn small" onClick={onLeave}>Hủy</button>
        </div>
      </div>
    );
  }

  const isDrawer = room.drawerId === you;
  const canDraw = isDrawer && room.phase === 'drawing';
  const drawer = room.players.find((p) => p.id === room.drawerId);

  let headline: React.ReactNode = null;
  if (room.phase === 'lobby') headline = <span className="muted">Phòng chờ</span>;
  else if (room.phase === 'choosing') headline = <span className="muted">{isDrawer ? 'Bạn' : drawer?.name} đang chọn từ…</span>;
  else if (room.phase === 'drawing') {
    headline = state.word ? (
      <span className="word">{isDrawer ? 'Vẽ: ' : ''}<b>{state.word}</b></span>
    ) : (
      <span className="hint" aria-label={`${room.hint.replace(/ /g, '').length} chữ cái`}>
        {room.hint.split(' ').map((part, i) => (
          <span key={i} className="hint-word">
            {[...part].map((ch, j) => <span key={j} className="hint-char">{ch === '_' ? '' : ch}</span>)}
            <sup>{part.length}</sup>
          </span>
        ))}
      </span>
    );
  } else if (room.phase === 'turnEnd') headline = <span>Đáp án: <b>{room.reveal?.word || '—'}</b></span>;
  else if (room.phase === 'gameOver') headline = <span>Kết thúc!</span>;

  const saveImage = () => {
    const url = board.toDataURL();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ve-doan-${room.reveal?.word || 'tranh'}.png`;
    a.click();
  };

  return (
    <div className={`game${canDraw ? ' drawer' : ''}`}>
      <header className="topbar">
        <button className="logo" onClick={() => confirm('Rời khỏi phòng?') && onLeave()} title="Rời phòng">🎨 <span>Vẽ Đoán</span></button>
        <div className="round">
          {room.phase !== 'lobby' && room.phase !== 'gameOver' && <>Vòng {room.round}/{room.settings.rounds}</>}
        </div>
        <div className="headline">{headline}</div>
        <div className="timer">
          {(room.phase === 'drawing' || room.phase === 'choosing') && room.endsAt > 0 && (
            <>⏱ <Countdown endsAt={room.endsAt} offset={state.offset} tick={room.phase === 'drawing'} /></>
          )}
        </div>
        <button
          className="icon-btn"
          onClick={() => { setMuted(!muted); setMutedState(!muted); }}
          title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      {status !== 'open' && <div className="net-banner">Mất kết nối, đang kết nối lại…</div>}

      <aside className="side-players">
        <PlayerList room={room} you={you} onKick={actions.kick} />
      </aside>

      <main className="stage">
        {room.phase === 'lobby' ? (
          <Lobby room={room} you={you} onSettings={actions.updateSettings} onStart={actions.start} />
        ) : (
          <Canvas board={board} canDraw={canDraw} send={actions.send}>
            <Overlay
              room={room}
              you={you}
              choices={state.choices}
              offset={state.offset}
              onChoose={actions.choose}
              onStart={actions.start}
              onLobby={actions.toLobby}
              onSaveImage={saveImage}
            />
          </Canvas>
        )}
      </main>

      <aside className="side-chat">
        <Chat room={room} you={you} messages={state.chat} onSend={actions.guess} />
      </aside>
    </div>
  );
}
