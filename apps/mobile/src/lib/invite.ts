/** Private onboarding link for a beta invite token. */
export function inviteLink(code: string) {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://app.angelos';
  return `${origin}/onboarding?invite=${encodeURIComponent(code)}`;
}
