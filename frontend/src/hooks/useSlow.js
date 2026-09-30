import { useEffect, useState } from 'react';

// Birkaç saniyeden uzun süren bekleme için true döner. Ücretsiz sunucu (Render) uykudan
// uyanırken ilk istek 30-60 sn sürebilir; kullanıcıya bunun normal olduğunu söylemek için kullanılır.
export default function useSlow(active, delay = 5000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => setSlow(true), delay);
    return () => { clearTimeout(t); setSlow(false); };
  }, [active, delay]);
  return active && slow;
}

export const SLOW_TEXT = 'Sunucu uykudan uyanıyor olabilir; ilk açılışta bu 1 dakikaya kadar sürebilir.';
