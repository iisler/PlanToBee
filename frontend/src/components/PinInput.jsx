import { forwardRef } from 'react';

// 4 haneli PIN alanı: telefonda sayısal klavye açılır, yalnızca rakam kabul edilir, rakamlar gizli gösterilir.
// onComplete: 4. rakam girilince çağrılır (PIN'i ayrıca "Devam"a basmadan göndermek için).
const PinInput = forwardRef(function PinInput({ value, onChange, onComplete, label, autoFocus, disabled }, ref) {
  function handle(e) {
    const next = e.target.value.replace(/\D/g, '').slice(0, 4);
    onChange(next);
    if (next.length === 4 && value.length !== 4) onComplete?.(next);
  }
  return (
    <input ref={ref} className="pin-input" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
      maxLength={4} aria-label={label} placeholder="••••" value={value} onChange={handle}
      autoFocus={autoFocus} disabled={disabled} />
  );
});

export default PinInput;
