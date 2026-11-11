// Ortak çizgi ikonlar (Görev 17): hafta okları, onay işareti. Renk currentColor'dan gelir.
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };

export const ChevPrev = () => <svg {...base} strokeWidth="2.2"><path d="M14.5 6l-6 6 6 6" /></svg>;
export const ChevNext = () => <svg {...base} strokeWidth="2.2"><path d="M9.5 6l6 6-6 6" /></svg>;
export const Check = () => <svg {...base} strokeWidth="3.2"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
