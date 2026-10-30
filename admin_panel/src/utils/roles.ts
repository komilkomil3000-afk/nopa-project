// Mentors (and super mentors) can browse all LMS content but never earn personal rewards.
export function isMentorRole(role?: string | null): boolean {
  const r = String(role || '').toLowerCase().replace(/[\s_-]/g, '');
  return r === 'mentor' || r === 'supermentor';
}
