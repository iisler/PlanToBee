// Onay kutusunun değerinden (ConsentChecks) sunucuya gidecek sürüm: metinden okunan sürüm, yoksa fallback.
export const consentVersion = (v, fallback) => (typeof v === 'number' ? v : fallback);

// Hesabın yeniden onay vermesi gereken metinler (me / oturum cevabındaki legal). Eski önbellekte legal yoksa boştur.
export function requiredDocs(legal) {
  if (!legal) return [];
  return [legal.kvkkRequired && 'kvkk', legal.termsRequired && 'terms'].filter(Boolean);
}
