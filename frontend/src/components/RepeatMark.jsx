import { isOccurrence } from '../utils/recurrence';

// Tekrarlanan kaydın adının arkasındaki küçük "↻" (Görev 11). Seriden ayrılmış gün (normal aktivite) göstermez.
// Düğme içindeyse ekran okuyucu düğmenin adını okur; o ada utils/recurrence repeatAria eklenir.
export default function RepeatMark({ entry }) {
  if (!isOccurrence(entry)) return null;
  return <span className="rc" role="img" aria-label="Her hafta tekrarlanıyor">↻</span>;
}
