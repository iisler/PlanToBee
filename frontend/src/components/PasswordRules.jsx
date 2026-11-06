import { PASSWORD_RULES } from '../utils/passwordPolicy';

// Yeni şifre alanının altındaki kural listesi: karşılanan madde yazdıkça işaretlenir.
export default function PasswordRules({ password, id }) {
  return (
    <ul className="pw-rules" id={id} aria-label="Şifre kuralları">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.id} className={ok ? 'ok' : ''}>
            <span className="pw-rule-mark" aria-hidden="true">{ok ? '✓' : '•'}</span>
            {r.label}
            <span className="sr-only">{ok ? ' (tamam)' : ' (eksik)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
