import { ChevNext, ChevPrev } from './Icons';

// Sayfa başlığı (Görev 17): üstte küçük satır (over), altında başlık; sağda isteğe bağlı hafta okları ve children
// (profil düğmesi). onStep(-1 | +1): önceki / sonraki hafta. headingRef: sayfa açılınca odağın gideceği başlık.
export default function WeekHead({ over, title, onStep, headingRef, children }) {
  return (
    <header className="pghead">
      <div className="pg-title">
        <span className="pg-over">{over}</span>
        <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      </div>
      {onStep && (
        <>
          <button type="button" className="navbtn" aria-label="Önceki hafta" onClick={() => onStep(-1)}><ChevPrev /></button>
          <button type="button" className="navbtn" aria-label="Sonraki hafta" onClick={() => onStep(1)}><ChevNext /></button>
        </>
      )}
      {children}
    </header>
  );
}
