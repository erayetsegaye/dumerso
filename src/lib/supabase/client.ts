'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export { isSupabaseConfigured };

export function getBrowserSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env (see .env.example).'
    );
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getBrowserSupabase();
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
}

export async function signOutBrowser(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getBrowserSupabase().auth.signOut().catch(() => undefined);
}

export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const code = (error as { code?: string })?.code || '';

  if (code === 'auth/popup-closed-by-user' || /closed/i.test(message)) {
    return 'Sign-in window was closed before finishing.';
  }
  if (/popup/i.test(message)) {
    return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
  }
  if (/provider/i.test(message) && /not/i.test(message)) {
    return 'Google sign-in is not enabled on this Supabase project yet.';
  }
  if (/redirect/i.test(message) || /url/i.test(message)) {
    return 'This site URL is not in the Supabase redirect allow list.';
  }
  if (/network/i.test(message) || /fetch/i.test(message)) {
    return 'Network error reaching Supabase. Check your connection.';
  }
  return message || 'Google sign-in failed. Please try again.';
}
