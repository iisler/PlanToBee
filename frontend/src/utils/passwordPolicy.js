// Şifre politikası (sunucudaki karşılığı: backend Program.cs Identity ayarları + Infrastructure/PasswordPatternValidator.cs).
// Sunucu her zaman yeniden kontrol eder; buradaki kontrol yalnızca kullanıcıya anında geri bildirim içindir.
export const PASSWORD_MIN_LENGTH = 8;
const MAX_RUN = 3;

const isDigit = (c) => c >= '0' && c <= '9';
const isLetter = (c) => c >= 'a' && c <= 'z';

// Aynı karakter art arda 3 kez (111, aaa); büyük/küçük ayrımı yapılmaz.
function hasRepeatedRun(pw) {
  const s = pw.toLowerCase();
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    run = s[i] === s[i - 1] ? run + 1 : 1;
    if (run >= MAX_RUN) return true;
  }
  return false;
}

// Art arda artan ya da azalan 3 rakam veya harf (123, 321, abc, CBA).
function hasSequentialRun(pw) {
  const s = pw.toLowerCase();
  let up = 1;
  let down = 1;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1];
    const b = s[i];
    const same = (isDigit(a) && isDigit(b)) || (isLetter(a) && isLetter(b));
    const d = b.charCodeAt(0) - a.charCodeAt(0);
    up = same && d === 1 ? up + 1 : 1;
    down = same && d === -1 ? down + 1 : 1;
    if (up >= MAX_RUN || down >= MAX_RUN) return true;
  }
  return false;
}

// Identity'nin tanımıyla aynı: harf ya da rakam olmayan her karakter özel karakter sayılır.
const isLetterOrDigit = (c) => /[\p{L}\p{N}]/u.test(c);

export const PASSWORD_RULES = [
  { id: 'length', label: `En az ${PASSWORD_MIN_LENGTH} karakter`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper', label: 'Büyük harf (A-Z)', test: (pw) => /\p{Lu}/u.test(pw) },
  { id: 'lower', label: 'Küçük harf (a-z)', test: (pw) => /\p{Ll}/u.test(pw) },
  { id: 'digit', label: 'Rakam (0-9)', test: (pw) => /[0-9]/.test(pw) },
  { id: 'special', label: 'Özel karakter (/ * ! ? . gibi)', test: (pw) => [...pw].some((c) => !isLetterOrDigit(c)) },
  { id: 'pattern', label: 'Art arda aynı ya da ardışık karakter yok (111, 123, abc)', test: (pw) => pw.length > 0 && !hasRepeatedRun(pw) && !hasSequentialRun(pw) },
];

export const passwordValid = (pw) => PASSWORD_RULES.every((r) => r.test(pw));

export const PASSWORD_INVALID_TEXT = 'Şifre kurallara uymuyor. Aşağıdaki listede eksik kalan maddeleri tamamla.';
