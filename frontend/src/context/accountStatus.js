// Oturum durumu: 'anon' | 'loading' | 'unverified' | 'nofamily' | 'ready'
export function accountStatus(user) {
  if (!user) return 'anon';
  if (user.emailVerified === undefined) return 'loading';
  if (!user.emailVerified) return 'unverified';
  if (!user.family) return 'nofamily';
  return 'ready';
}
