import { requiredDocs } from '../utils/legal';

// Oturum durumu: 'anon' | 'loading' | 'unverified' | 'consent' | 'nofamily' | 'noprofile' | 'consent-other' | 'ready'
// Aile tek hesapla giriş yapar; girişten sonra cihazda profil seçilir ("Kim kullanıyor?").
// Yasal metin güncellendiyse (legal.*Required) yeniden onayı hesap sahibi verir: ailesi olmayan hesapta hemen,
// ailede hesap sahibinin profili seçilince ('consent'). Başka bir profil seçiliyse uygulama açılmaz ('consent-other').
export function accountStatus(user) {
  if (!user) return 'anon';
  if (user.emailVerified === undefined) return 'loading';
  if (!user.emailVerified) return 'unverified';
  const consent = requiredDocs(user.legal).length > 0;
  if (!user.family) return consent ? 'consent' : 'nofamily';
  if (!user.profile) return 'noprofile';
  if (consent) return user.profile.isOwner ? 'consent' : 'consent-other';
  return 'ready';
}
