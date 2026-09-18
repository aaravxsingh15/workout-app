/** Turns unknown errors (Supabase, network, validation) into short user-facing text. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/network request failed|failed to fetch|network error/i.test(msg)) return 'No internet connection. Please try again when you are online.';
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first, then sign in.';
  if (/user already registered/i.test(msg)) return 'An account with this email already exists. Try signing in.';
  if (/password should be at least/i.test(msg)) return 'Password is too short (minimum 6 characters).';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  return msg || 'Something went wrong.';
}
