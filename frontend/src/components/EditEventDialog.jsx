import { useEffect } from 'react';
import EventForm from './EventForm';
import { eventLabel, kindInfo } from '../utils/events';

// Hafta görünümünde bir aktiviteyi düzenleme penceresi (hücreler satır içi form için dar).
export default function EditEventDialog({ ev, onSave, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={`${eventLabel(ev)} düzenle`} onClick={(e) => e.stopPropagation()}>
        <h3><span aria-hidden="true">{kindInfo(ev.kind).icon}</span> {eventLabel(ev)}</h3>
        <EventForm mode="edit" initial={ev} onCancel={onClose}
          onSubmit={async (body) => { const ok = await onSave(body); if (ok) onClose(); return ok; }} />
      </div>
    </div>
  );
}
