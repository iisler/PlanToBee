// Basit onay penceresi. React Native'de Modal + Alert ile birebir değiştirilebilir.
export default function ConfirmDialog({ title, message, confirmLabel = 'Onayla', danger = false, busy = false, onConfirm, onCancel, children }) {
  return (
    <div className="dialog-backdrop" role="presentation" onClick={busy ? undefined : onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        {children}
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Vazgeç</button>
          <button type="button" className={danger ? 'btn-danger' : 'btn'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Bekle…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
