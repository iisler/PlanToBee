import { useEffect, useState } from 'react';

const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// Bugün için dakikada bir güncellenen "şu an" (gece yarısından beri dakika); active değilse (başka gün) null.
export default function useNow(active) {
  const [now, setNow] = useState(nowMinutes);
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(nowMinutes());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [active]);
  return active ? now : null;
}
