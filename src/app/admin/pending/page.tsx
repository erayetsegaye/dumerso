'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, LogOut, RefreshCw, ShieldOff } from 'lucide-react';
import SafeImage from '@/components/SafeImage';

type Me = {
  email: string | null;
  displayName: string | null;
  role: string;
  disabled: boolean;
};

/** Landing page for accounts that exist but have not been approved yet. */
export default function AdminPendingPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const check = async (redirectWhenApproved: boolean) => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        router.replace('/admin/login');
        return;
      }
      const data = await res.json();
      setMe(data.user);

      if (redirectWhenApproved && !data.user.disabled && data.user.role !== 'pending') {
        router.replace('/admin');
        router.refresh();
      }
    } catch {
      router.replace('/admin/login');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    check(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    try {
      const { signOutBrowser } = await import('@/lib/supabase/client');
      await signOutBrowser();
    } catch {
      // Client SDK may not be configured; the server cookie is already gone.
    }
    router.replace('/admin/login');
    router.refresh();
  };

  const isDisabled = me?.disabled;

  return (
    <div className="min-h-screen bg-[#1A0D07] text-[#F3E4CB] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#8B5A2B]/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#4A2917]/25 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-[#24140C] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#4A2917] relative z-10 space-y-6 text-center">
        <div className="w-20 h-20 rounded-full border-2 border-[#8B5A2B] overflow-hidden mx-auto shadow-xl bg-[#1A0D07] p-0.5">
          <SafeImage
            src="/logo.jpg"
            alt="Dumerso Coffee Logo"
            className="w-full h-full rounded-full object-cover"
          />
        </div>

        <div className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#1A0D07] border border-[#4A2917] flex items-center justify-center mx-auto">
            {isDisabled ? (
              <ShieldOff className="w-5 h-5 text-rose-400" />
            ) : (
              <Clock className="w-5 h-5 text-[#8B5A2B]" />
            )}
          </div>
          <h1 className="text-xl font-serif font-extrabold tracking-wide">
            {isDisabled ? 'Access Revoked' : 'Waiting for Approval'}
          </h1>
          <p className="text-xs text-[#CDB99D] leading-relaxed">
            {isDisabled
              ? 'An administrator has disabled this account. Contact the cafe owner if you think this is a mistake.'
              : 'Your account was created successfully. The cafe owner needs to approve it before you can open the dashboard.'}
          </p>
        </div>

        {me && (
          <div className="bg-[#1A0D07] border border-[#4A2917] rounded-xl p-3.5 text-left space-y-1">
            <p className="text-[11px] text-[#CDB99D]">
              Signed in as{' '}
              <strong className="text-[#F3E4CB]">{me.email || me.displayName || 'unknown'}</strong>
            </p>
            <p className="text-[11px] text-[#CDB99D]">
              Current role: <strong className="text-[#F3E4CB] uppercase">{me.role}</strong>
            </p>
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => check(true)}
            disabled={isChecking}
            className="w-full bg-[#8B5A2B] hover:bg-[#724820] text-[#FFF4E3] font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Check again'}</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
