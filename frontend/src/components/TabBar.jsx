import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import KindIcon from './KindIcon';

// Alt sabit menü (Görev 14; Görev 17 ve 17b'de yeniden düzenlendi): Bugün · Hafta · + · Program yükle · Aile.
// - Bugün: gün ekranı; zaten oradaysa bugüne döner. Hafta: haftanın sayfası (Dersler sayfası oradan açılır). Aile: aile sayfası.
// - +: düğmenin üstünde küçük menü açar (Aktivite · Ders); seçilen türle Ekle sayfası açılır (onAdd). Açıkken + işareti × olur.
// - Program yükle: okul ya da kurs programını Excel, CSV ya da fotoğraftan yükleme paneli (Görev 15).
// - Profil sağ üstteki baş harf düğmesindedir.
// active: 'today' | 'week' | 'import' | 'family' | null. addRef / importRef: açılan sayfa kapanınca odağın döneceği düğmeler.
// Menü hiçbir durumda gizlenmez (kullanıcı kararı, Görev 14c ve 17b): alt sayfalar menünün üstünde biter, menüye dokununca
// açık alt sayfalar kapanır (PlanShell). Menü #root dışına (body) çizilir: alt sayfa kökü etkisiz (inert) yaptığında da
// dokunulabilir kalır. React Native'de alt sekme çubuğu (Tab.Navigator) ve ortadaki eylem düğmesi karşılığıdır.

const ICONS = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3z" /><path d="M12 8.5l3 1.7v3.6l-3 1.7-3-1.7v-3.6z" />
    </svg>
  ),
  week: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  ),
  import: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V4" /><path d="M7.5 8.5L12 4l4.5 4.5" /><path d="M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14" />
    </svg>
  ),
  family: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.6c2.4-.3 4.1 1.3 4.6 4.4" />
    </svg>
  ),
};

// + menüsünün seçenekleri (Görev 14'teki menü; Program yükle artık alt menüde ayrı düğme)
const ADD_ITEMS = [
  { type: 'event', name: 'Aktivite', desc: 'Aktivite ekle', kind: 'Event', cls: 'evt' },
  { type: 'study', name: 'Ders', desc: 'Ders ekle', kind: 'study', cls: 'study' },
];

export default function TabBar({ active, onToday, onWeek, onAdd, onImport, onFamily, addRef, importRef }) {
  const [addOpen, setAddOpen] = useState(false);
  const listRef = useRef(null);
  const wrapRef = useRef(null);

  // Menü dışına dokununca kapanır. Mobil Safari'de dokunulan düğme odak almadığı için yalnızca onBlur'a güvenilmez.
  // Karartmaya dokunuş onun kendi onClick'iyle kapanır: menü pointerdown'da kalkarsa dokunuş alttaki sayfaya geçerdi.
  useEffect(() => {
    if (!addOpen) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target) && !e.target.closest?.('.addpop-dim')) setAddOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [addOpen]);

  // Açılınca odak ilk seçeneğe; ok tuşları seçenekler arasında gezer, Esc menüyü kapatıp odağı +'ya verir.
  // Yakalama aşamasında dinlenir: menü açık bir alt sayfanın üstündeyken Esc yalnızca menüyü kapatır, sayfayı değil.
  useEffect(() => {
    if (!addOpen) return undefined;
    listRef.current?.querySelector('button')?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setAddOpen(false);
        addRef.current?.focus({ preventScroll: true });
        return;
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && listRef.current?.contains(document.activeElement)) {
        const items = [...listRef.current.querySelectorAll('button')];
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [addOpen, addRef]);

  // Odak önce +'ya döner: Ekle sayfası onu açan düğme olarak alır, kapanınca odak oraya geri gelir.
  function choose(type) {
    setAddOpen(false);
    addRef.current?.focus({ preventScroll: true });
    onAdd(type);
  }

  const tab = (id, label, onClick) => (
    <button type="button" className={`tab${active === id ? ' on' : ''}`} aria-current={active === id ? 'page' : undefined}
      onClick={() => { setAddOpen(false); onClick(); }}>
      <span className="ic">{ICONS[id]}</span><span className="lbl">{label}</span>
    </button>
  );

  return createPortal(
    <>
      {addOpen && <div className="addpop-dim" onClick={() => setAddOpen(false)} />}
      <nav className="tabbar" aria-label="Ana menü">
        <div className="tabbar-in">
          {tab('today', 'Bugün', onToday)}
          {tab('week', 'Hafta', onWeek)}
          <div className="tab-addwrap" ref={wrapRef}
            onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setAddOpen(false); }}>
            {addOpen && (
              <ul className="addpop" role="menu" aria-label="Ne ekliyorsun?" ref={listRef}>
                {ADD_ITEMS.map(it => (
                  <li role="none" key={it.type}>
                    <button type="button" role="menuitem" className="addpop-item" onClick={() => choose(it.type)}>
                      <span className={`bub ${it.cls}`}><KindIcon kind={it.kind} size={20} /></span>
                      <span><b>{it.name}</b><small>{it.desc}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" ref={addRef} className={`tab-add${addOpen ? ' open' : ''}`} aria-haspopup="menu" aria-expanded={addOpen}
              aria-label={addOpen ? 'Ekle menüsünü kapat' : 'Ekle: aktivite ya da ders'} onClick={() => setAddOpen(o => !o)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
          <button type="button" ref={importRef} className={`tab tab-wide${active === 'import' ? ' on' : ''}`} aria-haspopup="dialog"
            aria-expanded={active === 'import'} onClick={() => { setAddOpen(false); onImport(); }}>
            <span className="ic">{ICONS.import}</span><span className="lbl">Program yükle</span>
          </button>
          {tab('family', 'Aile', onFamily)}
        </div>
      </nav>
    </>,
    document.body,
  );
}
