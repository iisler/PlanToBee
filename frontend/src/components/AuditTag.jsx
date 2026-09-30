import { auditInfo, initial } from '../utils/format';
import { useAuditSettings } from '../context/AuditContext';

// Kaydın "ekleyen / son düzenleyen" izi.
// - Gün kartlarında tam metin: "Aslı ekledi", "Sen ekledin".
// - Hafta görünümünde (compact) yer kazanmak için yalnızca başka kişinin baş harfi; tam metin
//   dokunma/üzerine gelme ipucunda ve ekran okuyucuda. Kendi kaydında kısa gösterimde iz yazılmaz.
export default function AuditTag({ entry, myId, compact = false }) {
  const { showOwn } = useAuditSettings();
  const info = auditInfo(entry, myId, showOwn);
  if (!info) return null;
  if (!compact) return <span className="audit">{info.text}</span>;
  if (info.who) {
    return (
      <span className="audit-initial" title={info.text} role="img" aria-label={info.text}>
        {initial(info.who)}
      </span>
    );
  }
  if (!entry.isImported) return null;
  return <span className="audit compact">{info.text}</span>;
}
