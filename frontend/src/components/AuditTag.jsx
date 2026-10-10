import { creatorMark, initial } from '../utils/format';
import { useAuditSettings } from '../context/AuditContext';

// Satırdaki "kim ekledi" işareti: kaydı başka biri eklediyse o kişinin baş harfi (tam metin dokunma/üzerine gelme
// ipucunda ve ekran okuyucuda). Yalnızca ekleyene bakılır; durum değişikliği ya da düzenleme işaret göstermez.
// Çocuk profilinde hiç gösterilmez. Ayrıntılı iz (ekleyen + değiştiren) ⋯ menüsündedir (utils/format auditLine).
export default function AuditTag({ entry, myId }) {
  const { hideInitials } = useAuditSettings();
  const mark = creatorMark(entry, myId);
  if (!mark || hideInitials) return null;
  return (
    <span className="audit-initial" title={mark.text} role="img" aria-label={mark.text}>
      {initial(mark.name)}
    </span>
  );
}
