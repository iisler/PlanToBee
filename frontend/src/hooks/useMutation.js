import { useCallback, useEffect, useRef } from 'react';
import { errorCode, errorText } from '../api/errors';
import { useNotice } from '../context/NoticeContext';

// Kayıt ekleme / düzenleme / silme için ortak akış:
// 1) (varsa) iyimser değişiklik ekrana hemen uygulanır,
// 2) istek gönderilir; başarılıysa veri sunucudan tazelenir,
// 3) hata olursa ekran eski haline döner, hata mesajı gösterilir ve veri sunucudan yeniden okunur.
// Dönüş değeri: işlem başarılıysa true (formlar yalnızca o zaman temizlenir).
export default function useMutation({ state, setState, reload, onAccessChanged }) {
  const { notify } = useNotice();
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  return useCallback(async (optimistic, request) => {
    const snapshot = stateRef.current;
    if (optimistic && snapshot) setState(optimistic(snapshot));
    try {
      await request();
    } catch (err) {
      setState(snapshot);
      notify(errorText(err));
      const code = errorCode(err);
      // Yetki değişmiş (rol değişikliği) olabilir: aile bilgisini de tazele.
      if (code === 'plan_read_only') onAccessChanged?.(code);
      await reload().catch(() => {});
      return false;
    }
    await reload().catch(() => {});
    return true;
  }, [setState, reload, notify, onAccessChanged]);
}

// Gün nesnesindeki bir listede tek kaydı değiştirir / siler (iyimser güncellemeler için).
export function patchEntry(day, listKey, id, patch) {
  return { ...day, [listKey]: day[listKey].map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}
export function removeEntry(day, listKey, id) {
  return { ...day, [listKey]: day[listKey].filter((e) => e.id !== id) };
}
