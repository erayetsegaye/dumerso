'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { describeAuthError, isSupabaseConfigured, signInWithGoogle } from '@/lib/supabase/client';

/**
 * Messages for the `?error=` code that /auth/callback redirects back with.
 * Read after mount only — reading the URL during render would make the client
 * markup differ from the server markup and break hydration.
 */
const LOGIN_ERRORS: Record<string, string> = {
  invite: 'That invite code is not valid. Ask the cafe owner for the current code.',
  closed: 'Sign-ups are closed right now.',
  disabled: 'This account has been disabled by an administrator.',
  config: 'Supabase is not configured on the server yet.',
  auth: 'Google sign-in failed. Please try again.',
};

/**
 * Supabase reports provider failures in the URL *fragment*, which the browser
 * never sends to the server - so /auth/callback only ever sees "no code" and
 * falls back to the generic ?error=auth. Reading the fragment here recovers the
 * real reason (for example "Unable to exchange external code", which means the
 * Google client secret in Supabase does not match the client ID).
 */
function detailFromHash(hash: string): string {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const description = fragment.get('error_description');
  if (!description) return '';
  const clean = description.trim().replace(/\s+/g, ' ');
  return clean.length > 180 ? `${clean.slice(0, 180)}…` : clean;
}

export default function AdminLoginPage() {
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const configured = useMemo(() => isSupabaseConfigured(), []);

  // Browser-only: surface the callback error after the first render matches.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    const detail = detailFromHash(window.location.hash);

    if (code && LOGIN_ERRORS[code]) {
      setError(LOGIN_ERRORS[code]);
    } else if (detail) {
      setError(LOGIN_ERRORS.auth);
    }

    if (detail) {
      setErrorDetail(detail);
      // Drop the fragment so a refresh does not replay a stale failure.
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setError('');
    setErrorDetail('');
    setIsLoading(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(describeAuthError(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A0D07] text-[#F3E4CB] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-[#8B5A2B] selection:text-white">

      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#8B5A2B]/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#4A2917]/25 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-[#24140C] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#4A2917] relative z-10 space-y-6">

        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full border-2 border-[#8B5A2B] overflow-hidden mx-auto shadow-xl bg-[#1A0D07] p-0.5">
            <SafeImage
              src="/logo.jpg"
              alt="Dumerso Coffee Logo"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-extrabold text-[#F3E4CB] tracking-wider uppercase">
              DUMERSO COFFEE
            </h1>
            <p className="text-xs text-[#CDB99D] font-medium mt-0.5">Admin Dashboard Login</p>
          </div>
        </div>

        {!configured && (
          <div className="bg-amber-950/70 border border-amber-800 text-amber-100 text-xs p-3 rounded-xl font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Supabase is not configured yet. Add the <code>NEXT_PUBLIC_SUPABASE_*</code> values to{' '}
              <code>.env</code>.
            </span>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl font-semibold text-center space-y-1">
            <p>{error}</p>
            {errorDetail && (
              <p className="text-[10px] font-medium text-rose-300/80 break-words">{errorDetail}</p>
            )}
          </div>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || !configured}
            className="w-full bg-[#FFF4E3] hover:bg-white text-[#1A0D07] font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 text-sm disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <GoogleMark />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-[#CDB99D]">
            Need access?{' '}
            <Link href="/admin/signup" className="font-bold text-[#F3E4CB] hover:underline">
              Request it with an invite code
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.15.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.83.92 7.45 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.31-8.16 2.31-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
