// Tatil ve özel günler (Görev 11 eki). Sunucu her DayDto'da holidays: [{ name, kind }] döndürür;
// kind: official (resmî tatil) | half (arife, yarım gün) | school (okul tatili) | special (özel gün). Sıra sunucudadır.
// Saf işlevler (React Native'e aynen taşınabilir).

const TEXT = {
  official: (n) => `🇹🇷 ${n} · Resmî tatil`,
  half: (n) => `${n} · 13:00'ten sonra tatil`,
  school: (n) => `🎒 ${n}`,
  special: (n) => `🎈 ${n}`,
};

const list = (day) => day?.holidays ?? [];

// Bee şeridi metni: "🇹🇷 Cumhuriyet Bayramı · Resmî tatil · 🎈 …"; kayıt yoksa ''
export const holidayLine = (day) => list(day).map((h) => (TEXT[h.kind] ?? TEXT.special)(h.name)).join(' · ');

// Şerit ve işaret tonu: resmî tatil, arife ya da okul tatili varsa 'hol' (bal rengi), yalnızca özel gün varsa 'spc' (gri), yoksa null
export function holidayTone(day) {
  const hs = list(day);
  if (!hs.length) return null;
  return hs.some((h) => h.kind !== 'special') ? 'hol' : 'spc';
}

// Ekran okuyucu: "Cumhuriyet Bayramı, Resmî tatil" / "Öğretmenler Günü"; yoksa ''
const ARIA_KIND = { official: 'resmî tatil', half: "13:00'ten sonra tatil", school: 'okul tatili' };
export const holidayAria = (day) => list(day)
  .map((h) => (ARIA_KIND[h.kind] ? `${h.name}, ${ARIA_KIND[h.kind]}` : h.name)).join('; ');
