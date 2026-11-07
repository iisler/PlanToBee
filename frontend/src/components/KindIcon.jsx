import { kindInfo } from '../utils/events';

// Ders ve aktivite türleri için çizgi ikonlar (Görev 16: emoji yerine). Renk kapsayıcının currentColor'ından gelir.
// ev: çizelge öğesi (ders ise ev.isStudy) ya da kind: tür adı ('study', 'Training', 'Music', ...). Tanınmayan tür Diğer'dir.
const PATHS = {
  study: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H5.5A1.5 1.5 0 0 1 4 18zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5.5A1.5 1.5 0 0 0 20 18z" />,
  Training: <><path d="M8.5 3.5l3.5 6 3.5-6" /><circle cx="12" cy="14.5" r="5" /></>,
  Music: <><path d="M9 17.5V5.5l10-2v12" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="15.5" r="2.5" /></>,
  Concert: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></>,
  Meeting: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.6c2.4-.3 4.1 1.3 4.6 4.4" /></>,
  Exam: <><path d="M6.5 3.5h7.5l4 4v13H6.5z" /><path d="M14 3.5v4h4M9.5 12h5.5M9.5 15.5h5.5" /></>,
  School: <path d="M3.5 20.5h17M5.5 20.5V10L12 5.5l6.5 4.5v10.5M10 20.5V16h4v4.5" />,
  Event: <path d="M12 3.5l2.4 5.5 6 .5-4.6 3.9 1.4 5.9L12 16.2l-5.2 3.1 1.4-5.9-4.6-3.9 6-.5z" />,
};

export default function KindIcon({ ev, kind, size = 18 }) {
  const k = ev?.isStudy || kind === 'study' ? 'study' : kindInfo(ev ? ev.kind : kind).kind;
  return (
    <svg className="kic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[k]}
    </svg>
  );
}
