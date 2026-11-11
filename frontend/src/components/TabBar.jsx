import { createPortal } from 'react-dom';

// Alt sabit menü (Görev 14; Görev 17'de yeniden düzenlendi): Bugün · Hafta · + · Dersler · Aile.
// - Bugün: gün ekranı; zaten oradaysa bugüne döner. Hafta ve Dersler: kendi sayfaları. Aile: aile sayfası.
// - +: Ekle sayfasını açar (components/AddSheet.jsx; ders ya da aktivite). Profil sağ üstteki baş harf düğmesindedir.
// active: 'today' | 'week' | 'lessons' | 'family' | null. addRef: Ekle sayfası kapanınca odağın döneceği + düğmesi.
// Menü #root dışına (body) çizilir. React Native'de alt sekme çubuğu (Tab.Navigator) ve ortadaki eylem düğmesi karşılığıdır.

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
  lessons: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l2 2 3.5-3.5" /><path d="M4 15l2 2 3.5-3.5" /><path d="M13 8h7M13 16h7" />
    </svg>
  ),
  family: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.6c2.4-.3 4.1 1.3 4.6 4.4" />
    </svg>
  ),
};

export default function TabBar({ active, onToday, onWeek, onAdd, onLessons, onFamily, addRef }) {
  const tab = (id, label, onClick) => (
    <button type="button" className={`tab${active === id ? ' on' : ''}`} aria-current={active === id ? 'page' : undefined} onClick={onClick}>
      <span className="ic">{ICONS[id]}</span><span className="lbl">{label}</span>
    </button>
  );

  return createPortal(
    <nav className="tabbar" aria-label="Ana menü">
      <div className="tabbar-in">
        {tab('today', 'Bugün', onToday)}
        {tab('week', 'Hafta', onWeek)}
        <div className="tab-addwrap">
          <button type="button" ref={addRef} className="tab-add" aria-haspopup="dialog" aria-label="Ekle: ders ya da aktivite" onClick={onAdd}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
        {tab('lessons', 'Dersler', onLessons)}
        {tab('family', 'Aile', onFamily)}
      </div>
    </nav>,
    document.body,
  );
}
