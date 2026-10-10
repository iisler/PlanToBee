import { useEffect, useRef } from 'react';

// ⋯ menüsünden silince odak kaybolmasın: sonraki satırın ⋯ düğmesine, yoksa öncekine; liste boşaldıysa
// fallback() öğesine (ör. "+ Ders ekle" ya da kart başlığı) gider. Satırların ⋯ düğmelerinde (ya da çizelge bloklarında) data-id bulunur.
// Dönen işlev, silme isteğinden hemen önce silinen kayıtla çağrılır.
export default function useFocusAfterDelete(items, containerRef, fallback) {
  const pending = useRef(undefined); // undefined: bekleyen yok · null: fallback · aksi halde hedef kaydın kimliği
  const fallbackRef = useRef(fallback);
  useEffect(() => { fallbackRef.current = fallback; });

  useEffect(() => {
    if (pending.current === undefined) return;
    const id = pending.current;
    pending.current = undefined;
    const target = id != null ? containerRef.current?.querySelector(`[data-id="${id}"]`) : null;
    (target ?? fallbackRef.current())?.focus();
  }, [items, containerRef]);

  return (item) => {
    const i = items.findIndex((x) => x.id === item.id);
    const neighbour = items[i + 1] ?? items[i - 1];
    pending.current = neighbour ? neighbour.id : null;
  };
}
