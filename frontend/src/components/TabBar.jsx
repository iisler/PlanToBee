import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initial } from '../utils/format';

// Alt sabit menü (Görev 14): Gün · Hafta · + · Ailem · Profil. Plan ekranında ve Ailem / Bildirimler sayfalarında görünür.
// - Gün: Bee (ajanda) ana ekranı; zaten oradaysa bugüne döner. Hafta: haftanın tamamı paneli. Ailem: aile sayfası.
// - +: düğmenin üstünde küçük menü açar (Plan = aktivite ekle, To-do = ders ekle, Program yükle); açıkken + işareti × olur.
// - Profil: profil paneli (Profil değiştir, Bildirimler, Çıkış yap).
// active: 'today' | 'week' | 'family' | 'profile' | null. weekRef / profileRef: panel kapanınca odağın döneceği düğmeler.
// Menü hiçbir durumda gizlenmez: form açıkken, klavye açıkken ve Hafta paneli açıkken de görünür (kullanıcı kararı, Görev 14c).
// Menü #root dışına (body) çizilir: alt sayfalar kökü etkisiz (inert) yaptığında da Hafta paneli açıkken dokunulabilir kalır.
// React Native'de alt sekme çubuğu (Tab.Navigator) ve ortadaki eylem düğmesi karşılığıdır.

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
  family: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.6c2.4-.3 4.1 1.3 4.6 4.4" />
    </svg>
  ),
  plan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 21V4" /><path d="M6 4h11l-2.5 4L17 12H6" />
    </svg>
  ),
  todo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l2 2 3.5-3.5" /><path d="M4 15l2 2 3.5-3.5" /><path d="M13 8h7M13 16h7" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V4" /><path d="M7.5 8.5L12 4l4.5 4.5" /><path d="M4.5 14v4.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V14" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};

const ADD_ITEMS = [
  { type: 'event', name: 'Plan', desc: 'Aktivite ekle', icon: ICONS.plan, cls: 'evt' },
  { type: 'study', name: 'To-do', desc: 'Ders ekle', icon: ICONS.todo, cls: 'study' },
  // Program yükleme (Görev 15): Excel, CSV ya da fotoğraftan haftalık program
  { type: 'import', name: 'Program yükle', desc: 'Excel, CSV ya da fotoğraf', icon: ICONS.upload, cls: 'imp' },
];

// onAddOpen: + menüsü açılırken (açık Hafta paneli kapanır).
export default function TabBar({ active, name, onToday, onWeek, onAdd, onAddOpen, onFamily, onProfile, weekRef, profileRef }) {
  const [addOpen, setAddOpen] = useState(false);
  const addBtnRef = useRef(null);
  const listRef = useRef(null);
  const wrapRef = useRef(null);

  // Menü dışına dokununca kapanır. Mobil Safari'de dokunulan düğme odak almadığı için yalnızca onBlur'a güvenilmez.
  useEffect(() => {
    if (!addOpen) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setAddOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [addOpen]);

  useEffect(() => {
    if (!addOpen) return undefined;
    listRef.current?.querySelector('button')?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { setAddOpen(false); addBtnRef.current?.focus({ preventScroll: true }); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...(listRef.current?.querySelectorAll('button') ?? [])];
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addOpen]);

  // Açarken önce açık Hafta paneli kapanır (onAddOpen); menü bir sonraki adımda açılır: panel kapanırken odağı Hafta düğmesine
  // geri verir, menü o anda açık olsaydı bu odak değişimi menüyü kapatırdı.
  function openOrClose() {
    if (addOpen) { setAddOpen(false); return; }
    onAddOpen?.();
    setTimeout(() => setAddOpen(true), 0);
  }

  function choose(type) {
    setAddOpen(false);
    onAdd(type);
  }

  const tab = (id, label, onClick, ref) => (
    <button type="button" ref={ref} className={`tab${active === id ? ' on' : ''}`} aria-current={active === id ? 'page' : undefined}
      onClick={() => { setAddOpen(false); onClick(); }}>
      <span className="ic">{ICONS[id]}</span><span className="lbl">{label}</span>
    </button>
  );

  return createPortal(
    <>
      {addOpen && <div className="addpop-dim" onClick={() => setAddOpen(false)} />}
      <nav className="tabbar" aria-label="Ana menü">
        <div className="tabbar-in">
          {tab('today', 'Gün', onToday)}
          {tab('week', 'Hafta', onWeek, weekRef)}
          <div className="tab-addwrap" ref={wrapRef}
            onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setAddOpen(false); }}>
            {addOpen && (
              <ul className="addpop" role="menu" aria-label="Ekle" ref={listRef}>
                {ADD_ITEMS.map(it => (
                  <li role="none" key={it.type}>
                    <button type="button" role="menuitem" className="addpop-item" onClick={() => choose(it.type)}>
                      <span className={`bub ${it.cls}`}>{it.icon}</span>
                      <span><b>{it.name}</b><small>{it.desc}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" ref={addBtnRef} className={`tab-add${addOpen ? ' open' : ''}`} aria-haspopup="menu" aria-expanded={addOpen}
              aria-label={addOpen ? 'Ekle menüsünü kapat' : 'Ekle: Plan (aktivite) ya da To-do (ders)'}
              onClick={openOrClose}>
              {ICONS.plus}
            </button>
          </div>
          {tab('family', 'Ailem', onFamily)}
          <button type="button" ref={profileRef} className={`tab${active === 'profile' ? ' on' : ''}`} aria-haspopup="dialog"
            aria-label={`Profil: ${name}`} onClick={() => { setAddOpen(false); onProfile(); }}>
            <span className="pav" aria-hidden="true">{initial(name)}</span><span className="lbl">Profil</span>
          </button>
        </div>
      </nav>
    </>,
    document.body,
  );
}
