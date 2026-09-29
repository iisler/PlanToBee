import { auditTrail } from '../utils/format';

// Kaydın "ekleyen / son düzenleyen" izi. Kişinin kendi eklediği kayıtlarda hiçbir şey göstermez.
export default function AuditTag({ entry, myId, compact = false }) {
  const text = auditTrail(entry, myId);
  if (!text) return null;
  return <span className={compact ? 'audit compact' : 'audit'}>{text}</span>;
}
