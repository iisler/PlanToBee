import { STATUS_SHORT } from '../utils/format';
import { Check } from './Icons';

// Dersin durum düğmesi (Görev 17): tek dokunuş Tamamlandı yapar, tamamlanmış derste geri alır (Yapılacak).
// "Devam ediyor" Şimdi kartındaki "Başla" ile ya da düzenleme formundan seçilir; burada yarım halka olarak görünür.
// onStatus(ders, yeniDurum). Dokunma alanı 44 px.
export default function StatusCheck({ entry, onStatus }) {
  const done = entry.status === 'done';
  return (
    <button type="button" className={`chk${done ? ' on' : entry.status === 'inprogress' ? ' half' : ''}`} aria-pressed={done}
      aria-label={`${entry.subject}: ${STATUS_SHORT[entry.status]}. Dokununca ${STATUS_SHORT[done ? 'todo' : 'done']} olur.`}
      onClick={() => onStatus(entry, done ? 'todo' : 'done')}>
      <i aria-hidden="true">{done && <Check />}</i>
    </button>
  );
}
