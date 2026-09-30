import { useCallback, useEffect, useRef } from 'react';
import { errorCode, errorText } from '../api/errors';
import { cancelDeferred, defer } from '../api/deferred';
import { useNotice } from '../context/NoticeContext';

const UNDO_MS = 5000;

// Kayıt ekleme / düzenleme / silme için ortak akış:
// 1) (varsa) iyimser değişiklik ekrana hemen uygulanır,
// 2) istek gönderilir; başarılıysa veri sunucudan tazelenir,
// 3) hata olursa ekran eski haline döner, hata mesajı gösterilir ve veri sunucudan yeniden okunur.
// options.undo: "Geri al" metni (ör. "Matematik silindi"). Verilirse istek 5 sn bekletilir; bu sürede
// "Geri al" denirse hiç gönderilmez ve kayıt geri gelir (api/deferred.js). Silme işlemleri bunu kullanır.
// Dönüş değeri: işlem başarılıysa (ya da geri alınabilir olarak sıraya alındıysa) true.
export default function useMutation({ state, setState, reload, onAccessChanged }) {
  const { notify, dismiss } = useNotice();
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const send = useCallback(async (snapshot, request) => {
    try {
      await request();
    } catch (err) {
      setState(snapshot);
      notify(errorText(err));
      // Yetki değişmiş (rol değişikliği) olabilir: aile bilgisini de tazele.
      if (errorCode(err) === 'plan_read_only') onAccessChanged?.();
      await reload().catch(() => {});
      return false;
    }
    await reload().catch(() => {});
    return true;
  }, [setState, reload, notify, onAccessChanged]);

  return useCallback(async (optimistic, request, options = {}) => {
    const snapshot = stateRef.current;
    if (optimistic && snapshot) setState(optimistic(snapshot));
    if (!options.undo) return send(snapshot, request);

    let noticeId = 0;
    const run = () => send(snapshot, () => request({ _deferred: true }));
    defer(run, { delay: UNDO_MS, onSettled: () => dismiss(noticeId) });
    noticeId = notify(options.undo, 'info', {
      duration: UNDO_MS,
      action: {
        label: 'Geri al',
        // Bekleme sırasında sunucuya başka istek gitmediği için (gitse silme önce gönderilirdi) önceki durum günceldir.
        onClick: () => { if (cancelDeferred(run)) setState(snapshot); },
      },
    });
    return true;
  }, [send, setState, notify, dismiss]);
}

// Gün nesnesindeki bir listede tek kaydı değiştirir / siler (iyimser güncellemeler için).
export function patchEntry(day, listKey, id, patch) {
  return { ...day, [listKey]: day[listKey].map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}
export function removeEntry(day, listKey, id) {
  return { ...day, [listKey]: day[listKey].filter((e) => e.id !== id) };
}
