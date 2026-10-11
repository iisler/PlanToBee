import { useRef } from 'react';

// Bölüm seçici (Görev 10): soldan sağa Plan (Aktiviteler) · To-do (Dersler) · Bee (Ajanda) — marka sırası.
// Açılışta herkes için Bee seçilidir (durum PlanShell'de; kalıcı saklanmaz).
// Sekme yapısı: ←/→ komşu sekmeye geçer ve seçer (uçlarda döner), Home/End ilk/son. Odak sekmede kalır.
// React Native'de üç düğmeli segment denetimi karşılığıdır.
export const SECTIONS = [
  { id: 'plan', name: 'Plan', desc: 'Aktiviteler' },
  { id: 'todo', name: 'To-do', desc: 'Dersler' },
  { id: 'bee', name: 'Bee', desc: 'Ajanda' },
];

export const tabId = (id) => `sect-tab-${id}`;
export const panelId = (id) => `sect-panel-${id}`;

const HEX = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3z" /><path d="M12 8.5l3 1.7v3.6l-3 1.7-3-1.7v-3.6z" />
  </svg>
);

export default function SectionTabs({ value, onChange }) {
  const refs = useRef({});

  function onKeyDown(e) {
    const i = SECTIONS.findIndex(s => s.id === value);
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % SECTIONS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + SECTIONS.length) % SECTIONS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SECTIONS.length - 1;
    if (next == null) return;
    e.preventDefault();
    const id = SECTIONS[next].id;
    onChange(id);
    refs.current[id]?.focus({ preventScroll: true });
  }

  return (
    <div className="sect" role="tablist" aria-label="Gün bölümleri" onKeyDown={onKeyDown}>
      {SECTIONS.map(s => {
        const on = s.id === value;
        return (
          <button key={s.id} ref={el => { refs.current[s.id] = el; }} type="button" role="tab" id={tabId(s.id)}
            aria-selected={on} aria-controls={on ? panelId(s.id) : undefined} tabIndex={on ? 0 : -1}
            aria-label={`${s.name}, ${s.desc}`} onClick={() => onChange(s.id)}>
            <b>{s.id === 'bee' && HEX}{s.name}</b><span>{s.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
