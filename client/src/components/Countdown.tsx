import { useEffect, useState } from 'react';
import { sfx } from '../lib/sfx';

interface Props {
  endsAt: number;
  offset: number;
  /** phát tiếng tích tắc ở 5 giây cuối */
  tick?: boolean;
}

export function remainingSeconds(endsAt: number, offset: number) {
  return Math.max(0, Math.ceil((endsAt - (Date.now() + offset)) / 1000));
}

export function Countdown({ endsAt, offset, tick }: Props) {
  const [sec, setSec] = useState(() => remainingSeconds(endsAt, offset));

  useEffect(() => {
    let prev = -1;
    const update = () => {
      const s = remainingSeconds(endsAt, offset);
      setSec(s);
      if (tick && s !== prev && s > 0 && s <= 5) sfx.tick();
      prev = s;
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [endsAt, offset, tick]);

  return <>{sec}</>;
}
