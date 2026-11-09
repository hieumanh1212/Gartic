import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMsg, ClientMsg, RoomView, ServerMsg, Settings } from '../../../shared/protocol';
import { Board } from './board';
import { wsUrl } from './config';
import { Connection, type Status } from './connection';
import { getPlayerId, type Profile } from './identity';
import { sfx } from './sfx';

export interface ChatEntry extends ChatMsg {
  id: number;
}

export interface GameState {
  status: Status;
  you: string | null;
  room: RoomView | null;
  chat: ChatEntry[];
  choices: string[];
  word: string | null;
  error: string | null;
  /** chênh lệch đồng hồ: giờ server - giờ máy */
  offset: number;
}

const initial: GameState = {
  status: 'connecting', you: null, room: null, chat: [], choices: [], word: null, error: null, offset: 0,
};

let chatSeq = 0;

export function useGame(code: string, create: boolean, profile: Profile) {
  const board = useMemo(() => new Board(), []);
  const [state, setState] = useState<GameState>(initial);
  const connRef = useRef<Connection | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const youRef = useRef<string | null>(null);

  useEffect(() => {
    setState(initial);
    const pushChat = (s: GameState, msg: ChatMsg): GameState => ({
      ...s,
      chat: [...s.chat.slice(-199), { ...msg, id: ++chatSeq }],
    });

    const onRoom = (room: RoomView, s: GameState): GameState => {
      const prev = s.room;
      const you = youRef.current;
      if (prev && prev.phase !== room.phase) {
        if (room.phase === 'choosing' && room.drawerId === you) sfx.yourTurn();
        if (room.phase === 'turnEnd') sfx.turnEnd();
        if (room.phase === 'gameOver') sfx.win();
      }
      return {
        ...s,
        room,
        offset: room.now - Date.now(),
        choices: room.phase === 'choosing' && room.drawerId === you ? s.choices : [],
        word: room.phase === 'drawing' || room.phase === 'turnEnd' ? s.word : null,
      };
    };

    const onMessage = (m: ServerMsg) => {
      switch (m.t) {
        case 'welcome':
          youRef.current = m.you;
          board.reset(m.ops);
          setState((s) => ({ ...onRoom(m.room, { ...s, room: null }), you: m.you, error: null }));
          return;
        case 'room':
          setState((s) => onRoom(m.room, s));
          return;
        case 'choices':
          setState((s) => ({ ...s, choices: m.words }));
          return;
        case 'word':
          setState((s) => ({ ...s, word: m.word }));
          return;
        case 'chat':
          if (m.msg.kind === 'correct') sfx.correct();
          else if (m.msg.kind === 'close') sfx.close();
          else if (m.msg.kind === 'join') sfx.join();
          setState((s) => pushChat(s, m.msg));
          return;
        case 'begin': board.begin(m.c, m.w, m.p); return;
        case 'points': board.points(m.p); return;
        case 'fill': board.fill(m.c, m.x, m.y); return;
        case 'undo': board.undo(); return;
        case 'clear': board.clear(); return;
        case 'ops': board.reset(m.ops); return;
        case 'error':
          setState((s) => ({ ...s, error: m.message }));
          return;
      }
    };

    const conn = new Connection(
      wsUrl(code),
      () => ({
        t: 'hello',
        playerId: getPlayerId(),
        name: profileRef.current.name,
        avatar: profileRef.current.avatar,
        create,
      }),
      onMessage,
      (status) => setState((s) => ({ ...s, status })),
    );
    connRef.current = conn;
    conn.connect();
    return () => {
      conn.close();
      connRef.current = null;
    };
  }, [code, create, board]);

  const send = useCallback((msg: ClientMsg) => connRef.current?.send(msg), []);

  const actions = useMemo(
    () => ({
      send,
      start: () => send({ t: 'start' }),
      toLobby: () => send({ t: 'lobby' }),
      choose: (index: number) => send({ t: 'choose', index }),
      guess: (text: string) => send({ t: 'guess', text }),
      kick: (playerId: string) => send({ t: 'kick', playerId }),
      updateSettings: (settings: Partial<Settings>) => send({ t: 'settings', settings }),
    }),
    [send],
  );

  return { state, board, actions };
}

export type GameActions = ReturnType<typeof useGame>['actions'];
