import { useState } from 'react';
import { LIMITS, ROOM_CODE_RE } from '../../../shared/protocol';
import { AVATARS, newRoomCode, type Profile } from '../lib/identity';

interface Props {
  profile: Profile;
  invitedCode: string | null;
  onEnter: (profile: Profile, code: string, create: boolean) => void;
}

export function Home({ profile, invitedCode, onEnter }: Props) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [code, setCode] = useState(invitedCode ?? '');
  const [err, setErr] = useState('');

  const go = (create: boolean) => {
    const n = name.trim();
    if (!n) return setErr('Bạn hãy nhập tên trước nhé!');
    const c = create ? newRoomCode() : code.trim().toUpperCase();
    if (!create && !ROOM_CODE_RE.test(c)) return setErr('Mã phòng không hợp lệ.');
    onEnter({ name: n, avatar }, c, create);
  };

  return (
    <div className="center-screen home">
      <div className="card home-card">
        <h1 className="title">🎨 Vẽ Đoán</h1>
        <p className="muted">Một người vẽ – cả nhóm đoán. Chơi cùng bạn bè ngay trên trình duyệt!</p>

        <div className="avatar-picker">
          {AVATARS.map((a) => (
            <button key={a} className={a === avatar ? 'active' : ''} onClick={() => setAvatar(a)} type="button">
              {a}
            </button>
          ))}
        </div>

        <input
          className="name-input"
          placeholder="Tên của bạn"
          value={name}
          maxLength={LIMITS.nameLength}
          onChange={(e) => { setName(e.target.value); setErr(''); }}
          onKeyDown={(e) => e.key === 'Enter' && go(!invitedCode)}
          autoFocus
        />

        {invitedCode ? (
          <>
            <button className="btn primary big" onClick={() => go(false)}>
              Vào phòng {invitedCode}
            </button>
            <button className="btn link" onClick={() => go(true)}>hoặc tạo phòng mới</button>
          </>
        ) : (
          <>
            <button className="btn primary big" onClick={() => go(true)}>✨ Tạo phòng mới</button>
            <div className="divider"><span>hoặc vào phòng có sẵn</span></div>
            <form className="join-row" onSubmit={(e) => { e.preventDefault(); go(false); }}>
              <input
                placeholder="Mã phòng"
                value={code}
                maxLength={8}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(''); }}
              />
              <button className="btn" type="submit">Vào</button>
            </form>
          </>
        )}
        {err && <p className="error">{err}</p>}
      </div>
      <footer className="muted small">Làm cho vui với bạn bè ❤️</footer>
    </div>
  );
}
