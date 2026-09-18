'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, ExternalLink, Loader2, LogOut, ShieldCheck, User } from 'lucide-react';

type Account = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'pending' | 'staff' | 'admin';
  disabled: boolean;
};

const ROLE_BLURB: Record<Account['role'], string> = {
  admin: 'Full access, including staff approval and financial reports.',
  staff: 'Can take orders and manage the menu. Cannot change costs or settings.',
  pending: 'Waiting for an administrator to approve this account.',
};

/**
 * Identity is managed by Google, so there is no password to change here.
 * This page just shows who you are signed in as and what you can do.
 */
export default function AdminAccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setAccount(data?.user ?? null))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    try {
      const { signOutBrowser } = await import('@/lib/supabase/client');
      await signOutBrowser();
    } catch {
      // Client SDK unavailable; the server cookie is already cleared.
    }
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-serif">
          👤 Account
        </h1>
        <p className="text-xs text-amber-800/80 mt-0.5">
          You sign in with Google, so your name, email and password are managed by your Google
          account.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-3xl p-10 border border-amber-200 flex flex-col items-center gap-3 text-amber-800">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest">Loading account...</p>
        </div>
      ) : !account ? (
        <div className="bg-rose-50 text-rose-700 text-xs p-3.5 rounded-2xl font-semibold">
          Could not load your account. Try signing in again.
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 overflow-hidden flex items-center justify-center shrink-0">
              {account.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-amber-700" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-extrabold text-amber-950 truncate">
                {account.displayName || 'Signed in'}
              </p>
              <p className="text-xs text-amber-800/80 flex items-center gap-1.5 truncate">
                <AtSign className="w-3.5 h-3.5 text-amber-600" />
                {account.email}
              </p>
            </div>
          </div>

          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                Role: {account.role}
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80">{ROLE_BLURB[account.role]}</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-amber-100">
            <a
              href="https://myaccount.google.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
              Manage your Google account (name, photo, password)
            </a>

            <button
              onClick={handleSignOut}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-sm py-3 rounded-2xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
