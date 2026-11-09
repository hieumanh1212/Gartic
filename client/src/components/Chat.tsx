import { useEffect, useRef, useState } from 'react';
import { LIMITS, type RoomView } from '../../../shared/protocol';
import type { ChatEntry } from '../lib/useGame';

interface Props {
  room: RoomView;
  you: string | null;
  messages: ChatEntry[];
  onSend: (text: string) => void;
}

export function Chat({ room, you, messages, onSend }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const me = room.players.find((p) => p.id === you);
  const isDrawer = room.drawerId === you && room.phase === 'drawing';
  const guessed = !!me?.guessed && room.phase === 'drawing';

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Người đoán: tự focus ô nhập khi bắt đầu lượt vẽ
  useEffect(() => {
    if (room.phase === 'drawing' && !isDrawer && matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, [room.phase, isDrawer]);

  const placeholder = isDrawer
    ? 'Bạn đang vẽ – chỉ người đã đoán đúng thấy tin nhắn'
    : guessed
      ? 'Đã đoán đúng – tin nhắn chỉ người biết đáp án thấy'
      : room.phase === 'drawing'
        ? 'Nhập đáp án…'
        : 'Nhập tin nhắn…';

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.kind}`}>
            {m.kind === 'chat' || m.kind === 'secret' ? (
              <>
                <b>{m.name}:</b> {m.text}
              </>
            ) : (
              m.text
            )}
          </div>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t) onSend(t);
          setText('');
        }}
      >
        <input
          ref={inputRef}
          value={text}
          maxLength={LIMITS.chatLength}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button type="submit" aria-label="Gửi">➤</button>
      </form>
    </div>
  );
}
