import HoneycombSpinner from './HoneycombSpinner';

// Düğme etiketi: işlem sürerken küçük dönen petek ve bekleme metni ("Giriş yapılıyor…"), değilse normal metin.
export default function BusyLabel({ busy, text, busyText }) {
  if (!busy) return text;
  return (
    <span className="btn-busy">
      <HoneycombSpinner size={30} onDark />
      <span>{busyText}</span>
    </span>
  );
}
