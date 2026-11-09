import { useEffect, useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { Home } from './components/Home';
import { loadProfile, loadSession, saveProfile, saveSession, type Profile } from './lib/identity';

function codeFromHash(): string | null {
  const m = location.hash.match(/^#\/?([A-Za-z0-9]{4,8})$/);
  return m ? m[1].toUpperCase() : null;
}

interface Session {
  code: string;
  create: boolean;
}

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [hashCode, setHashCode] = useState(codeFromHash);
  const [session, setSession] = useState<Session | null>(() => {
    // Tải lại trang khi đang ở trong phòng → tự vào lại
    const s = loadSession();
    const code = codeFromHash();
    return s && code === s.code && loadProfile().name ? s : null;
  });

  useEffect(() => {
    const onHash = () => {
      const code = codeFromHash();
      setHashCode(code);
      setSession((s) => (s && s.code !== code ? null : s));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const enter = (p: Profile, code: string, create: boolean) => {
    saveProfile(p);
    setProfile(p);
    const s = { code, create };
    saveSession(s);
    setSession(s);
    setHashCode(code);
    if (codeFromHash() !== code) location.hash = `/${code}`;
  };

  const leave = () => {
    saveSession(null);
    setSession(null);
    setHashCode(null);
    history.replaceState(null, '', location.pathname + location.search);
  };

  if (session) {
    return <GameScreen key={session.code} code={session.code} create={session.create} profile={profile} onLeave={leave} />;
  }
  return <Home profile={profile} invitedCode={hashCode} onEnter={enter} />;
}
