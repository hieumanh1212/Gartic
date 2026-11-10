import { useEffect, useState } from 'react';
import type { RoomView, Settings } from '../../../shared/protocol';
import { TOPICS } from '../../../shared/topics';
import { inviteLink } from '../lib/config';

interface Props {
  room: RoomView;
  you: string | null;
  onSettings: (s: Partial<Settings>) => void;
  onStart: () => void;
}

const parseWords = (s: string) =>
  s.split(/[,\n;]/).map((w) => w.trim()).filter(Boolean);

export function Lobby({ room, you, onSettings, onStart }: Props) {
  const isHost = you === room.hostId;
  const s = room.settings;
  const [copied, setCopied] = useState(false);
  const [words, setWords] = useState(s.customWords.join(', '));
  const connected = room.players.filter((p) => p.connected).length;
  const selectedTopics = s.topics ?? [];
  const toggleTopic = (id: string) =>
    onSettings({
      topics: selectedTopics.includes(id) ? selectedTopics.filter((t) => t !== id) : [...selectedTopics, id],
    });
  const link = inviteLink(room.code);

  // Đồng bộ ô từ tùy chỉnh khi trở thành chủ phòng
  useEffect(() => {
    if (isHost) setWords(room.settings.customWords.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      prompt('Sao chép link này gửi cho bạn bè:', link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Vẽ Đoán', text: 'Vào chơi Vẽ Đoán với mình nào!', url: link });
        return;
      } catch {
        /* người dùng hủy */
      }
    }
    void copy();
  };

  const select = (key: keyof Settings, values: number[], label: (v: number) => string) => (
    <select
      value={s[key] as number}
      disabled={!isHost}
      onChange={(e) => onSettings({ [key]: Number(e.target.value) })}
    >
      {values.map((v) => (
        <option key={v} value={v}>{label(v)}</option>
      ))}
    </select>
  );

  return (
    <div className="lobby">
      <div className="invite">
        <div>
          <div className="label">Mã phòng</div>
          <div className="code">{room.code}</div>
        </div>
        <div className="invite-actions">
          <button className="btn" onClick={copy}>{copied ? '✔ Đã chép' : '🔗 Chép link mời'}</button>
          {'share' in navigator && <button className="btn" onClick={share}>📤 Chia sẻ</button>}
        </div>
      </div>

      <div className="settings">
        <h3>Cài đặt {isHost ? '' : <small>(chỉ chủ phòng chỉnh được)</small>}</h3>
        <label>Số vòng {select('rounds', [1, 2, 3, 4, 5, 6, 8, 10], (v) => `${v} vòng`)}</label>
        <label>Thời gian vẽ {select('drawTime', [30, 45, 60, 80, 100, 120, 150, 180, 240], (v) => `${v} giây`)}</label>
        <label>Số từ để chọn {select('wordChoices', [1, 2, 3, 4, 5], (v) => `${v} từ`)}</label>
        <label>Tối đa {select('maxPlayers', [2, 4, 6, 8, 10, 12, 16], (v) => `${v} người`)}</label>
        <div className="topics">
          <div className="topics-label">
            Chủ đề <small>{isHost ? '(chọn một hoặc nhiều)' : ''}</small>
          </div>
          <div className="topic-chips">
            <button
              type="button"
              className={`chip ${selectedTopics.length === 0 ? 'active' : ''}`}
              disabled={!isHost}
              aria-pressed={selectedTopics.length === 0}
              onClick={() => onSettings({ topics: [] })}
            >
              🎲 Tất cả
            </button>
            {TOPICS.map((t) => {
              const on = selectedTopics.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${on ? 'active' : ''}`}
                  disabled={!isHost}
                  aria-pressed={on}
                  onClick={() => toggleTopic(t.id)}
                >
                  {t.emoji} {t.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={s.hints} disabled={!isHost} onChange={(e) => onSettings({ hints: e.target.checked })} />
          Tự mở dần chữ cái gợi ý
        </label>

        {isHost ? (
          <>
            <label className="block">
              Từ tùy chỉnh <small>(cách nhau bởi dấu phẩy hoặc xuống dòng)</small>
              <textarea
                rows={3}
                value={words}
                placeholder="vd: thầy giáo Hùng, quán trà sữa đầu ngõ, con mèo nhà Lan…"
                onChange={(e) => setWords(e.target.value)}
                onBlur={() => onSettings({ customWords: parseWords(words) })}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.onlyCustom}
                onChange={(e) => onSettings({ onlyCustom: e.target.checked, customWords: parseWords(words) })}
              />
              Chỉ dùng từ tùy chỉnh ({s.customCount} từ)
            </label>
          </>
        ) : (
          s.customCount > 0 && <p className="muted">Có {s.customCount} từ tùy chỉnh{s.onlyCustom ? ' (chỉ dùng từ tùy chỉnh)' : ''}.</p>
        )}
      </div>

      <div className="lobby-start">
        {isHost ? (
          <button className="btn primary big" disabled={connected < 2} onClick={onStart}>
            {connected < 2 ? 'Chờ thêm người chơi…' : `▶ Bắt đầu (${connected} người)`}
          </button>
        ) : (
          <p className="muted">Đang chờ chủ phòng bắt đầu…</p>
        )}
      </div>
    </div>
  );
}
