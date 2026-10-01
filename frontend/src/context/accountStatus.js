// Oturum durumu: 'anon' | 'loading' | 'unverified' | 'nofamily' | 'noprofile' | 'ready'
// Aile tek hesapla giriş yapar; girişten sonra cihazda profil seçilir ("Kim kullanıyor?").
export function accountStatus(user) {
  if (!user) return 'anon';
  if (user.emailVerified === undefined) return 'loading';
  if (!user.emailVerified) return 'unverified';
  if (!user.family) return 'nofamily';
  if (!user.profile) return 'noprofile';
  return 'ready';
}
