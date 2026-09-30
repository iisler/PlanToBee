import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Ekranın altında görünen kısa bildirim (hata veya bilgi). Sessiz başarısızlık olmasın diye
// tüm kayıt işlemleri hatayı buradan gösterir. İsteğe bağlı bir eylem düğmesi taşıyabilir ("Geri al").
const NoticeContext = createContext({ notify: () => 0, dismiss: () => {} });

export function NoticeProvider({ children }) {
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);
  const seq = useRef(0);

  // action: { label, onClick } · duration: ms (varsayılan hata 6 sn, bilgi 3,5 sn). Dönüş: bildirimin kimliği.
  const notify = useCallback((text, kind = 'error', { action, duration } = {}) => {
    clearTimeout(timer.current);
    const id = ++seq.current;
    setNotice({ id, text, kind, action });
    timer.current = setTimeout(() => setNotice(null), duration ?? (kind === 'error' ? 6000 : 3500));
    return id;
  }, []);

  // Yalnızca verilen bildirim hâlâ ekrandaysa kapatır (arada yenisi geldiyse ona dokunmaz).
  const dismiss = useCallback((id) => {
    setNotice((n) => (n && n.id === id ? null : n));
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <NoticeContext.Provider value={{ notify, dismiss }}>
      {children}
      {notice && (
        <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <span>{notice.text}</span>
          {notice.action && (
            <button className="notice-action" onClick={() => { setNotice(null); notice.action.onClick(); }}>
              {notice.action.label}
            </button>
          )}
          <button aria-label="Kapat" onClick={() => setNotice(null)}>×</button>
        </div>
      )}
    </NoticeContext.Provider>
  );
}

export const useNotice = () => useContext(NoticeContext);
