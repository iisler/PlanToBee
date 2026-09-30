// Kullanıcının düzenleyemediği kayıtlarda (canEdit = false) düzenle/sil düğmelerinin yerine gösterilen kilit.
// Neden düzenlenemediğini hem ekran okuyucuya hem de uzun basışta/üzerine gelince söyler.
export const READ_ONLY_TEXT = 'Bu kaydı yalnızca ekleyen kişi ya da bir ebeveyn değiştirebilir.';

export default function ReadOnlyMark({ compact = false }) {
  return (
    <span className={compact ? 'ro compact' : 'ro'} role="img" aria-label={READ_ONLY_TEXT} title={READ_ONLY_TEXT}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    </span>
  );
}
