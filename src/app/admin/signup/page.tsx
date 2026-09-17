'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { describeAuthError, isFirebaseConfigured, signInWithGoogle } from '@/lib/firebase/client';

export default function AdminSignupPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const configured = isFirebaseConfigured();

  const handleGoogleSignup = async () => {
    setError('');

    if (!inviteCode.trim()) {
      setError('Please enter the invite code you were given.');
      return;
    }

    setIsLoading(true);

    try {
      const { idToken } = await signInWithGoogle();

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, inviteCode: inviteCode.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        // The server rejected us (bad invite code, disabled account): drop the
        // client-side Firebase session too so nothing is left half signed-in.
        const { getFirebaseAuth } = await import('@/lib/firebase/client');
        await getFirebaseAuth().signOut().catch(() => undefined);
        setError(data.error || 'Could not create your account.');
        setIsLoading(false);
        return;
      }

      router.replace(data.user?.role === 'admin' || data.user?.role === 'staff' ? '/admin' : '/admin/pending');
      router.refresh();
    } catch (err) {
      setError(describeAuthError(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A0D07] text-[#F3E4CB] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-[#8B5A2B] selection:text-white">

      {/* Warm Ambient Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#8B5A2B]/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#4A2917]/25 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-[#24140C] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#4A2917] relative z-10 space-y-6">

        {/* Brand Header */}
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
            <p className="text-xs text-[#CDB99D] font-medium mt-0.5">Request Staff Access</p>
          </div>
        </div>

        {!configured && (
          <div className="bg-amber-950/70 border border-amber-800 text-amber-100 text-xs p-3 rounded-xl font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Firebase is not configured yet. Add the <code>NEXT_PUBLIC_FIREBASE_*</code> values to{' '}
              <code>.env</code> to enable sign-ups.
            </span>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl font-semibold text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1.5">
              Invite Code
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#8B5A2B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoFocus
                autoCapitalize="characters"
                spellCheck={false}
                disabled={isLoading || !configured}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGoogleSignup();
                }}
                placeholder="Code from the cafe owner"
                className="w-full pl-10 pr-4 py-3 text-sm bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B] font-medium disabled:opacity-60"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={isLoading || !configured}
            className="w-full bg-[#FFF4E3] hover:bg-white text-[#1A0D07] font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 text-sm disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating your account...</span>
              </>
            ) : (
              <>
                <GoogleMark />
                <span>Sign up with Google</span>
              </>
            )}
          </button>

          <div className="bg-[#1A0D07] border border-[#4A2917] rounded-xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#8B5A2B] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#CDB99D] leading-relaxed">
              New accounts start with <strong className="text-[#F3E4CB]">no access</strong>. The cafe
              owner has to approve you before the dashboard opens up.
            </p>
          </div>
        </div>

        <div className="text-center pt-2 border-t border-[#4A2917]/60">
          <p className="text-[11px] text-[#CDB99D]">
            Already have access?{' '}
            <Link href="/admin/login" className="font-bold text-[#F3E4CB] hover:underline">
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}

/** Google's 'G' mark. */
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
