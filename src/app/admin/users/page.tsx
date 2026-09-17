'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
  Users,
} from 'lucide-react';

type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'pending' | 'staff' | 'admin';
  disabled: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
  isSelf: boolean;
};

const ROLE_STYLES: Record<AppUser['role'], string> = {
  admin: 'bg-amber-100 text-amber-900 border-amber-300',
  staff: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  pending: 'bg-stone-100 text-stone-600 border-stone-300',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load users');
        return;
      }
      setUsers(data.users || []);
      setError('');
    } catch {
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const patchUser = async (uid: string, body: Record<string, unknown>, successMessage: string) => {
    setBusyUid(uid);
    setError('');
    try {
      const res = await fetch(`/api/users/${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Update failed');
        return;
      }
      showToast(successMessage);
      await load();
    } catch {
      setError('Update failed');
    } finally {
      setBusyUid(null);
    }
  };

  const removeUser = async (user: AppUser) => {
    const label = user.email || user.displayName || 'this account';
    if (!window.confirm(`Permanently remove ${label}? They will have to sign up again.`)) return;

    setBusyUid(user.uid);
    setError('');
    try {
      const res = await fetch(`/api/users/${user.uid}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Delete failed');
        return;
      }
      showToast('Account removed');
      await load();
    } catch {
      setError('Delete failed');
    } finally {
      setBusyUid(null);
    }
  };

  const pending = users.filter((u) => u.role === 'pending' && !u.disabled);
  const active = users.filter((u) => u.role !== 'pending' || u.disabled);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-amber-950 text-amber-50 px-4 py-3 rounded-2xl shadow-xl border border-amber-600 flex items-center gap-2 text-xs font-semibold">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-serif flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-600" />
          Staff Access
        </h1>
        <p className="text-xs text-amber-800/80 mt-0.5">
          Approve people who signed up, and decide who can manage the cafe.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 text-xs p-3.5 rounded-2xl font-semibold">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-3xl p-10 border border-amber-200 flex flex-col items-center gap-3 text-amber-800">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest">Loading accounts...</p>
        </div>
      ) : (
        <>
          {/* Awaiting approval */}
          <section className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
            <header className="px-5 py-4 border-b border-amber-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-extrabold text-amber-950 uppercase tracking-wider">
                Awaiting approval
              </h2>
              <span className="ml-auto text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                {pending.length}
              </span>
            </header>

            {pending.length === 0 ? (
              <p className="px-5 py-6 text-xs text-amber-800/70">No pending requests.</p>
            ) : (
              <ul className="divide-y divide-amber-100">
                {pending.map((user) => (
                  <li key={user.uid} className="px-5 py-4 flex flex-wrap items-center gap-3">
                    <UserSummary user={user} />
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => patchUser(user.uid, { role: 'staff' }, 'Approved as staff')}
                        disabled={busyUid === user.uid}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-60"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Approve as staff
                      </button>
                      <button
                        onClick={() => patchUser(user.uid, { role: 'admin' }, 'Approved as admin')}
                        disabled={busyUid === user.uid}
                        className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-60"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Make admin
                      </button>
                      <button
                        onClick={() => removeUser(user)}
                        disabled={busyUid === user.uid}
                        className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        aria-label="Reject and remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Everyone else */}
          <section className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
            <header className="px-5 py-4 border-b border-amber-100 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-extrabold text-amber-950 uppercase tracking-wider">
                Accounts
              </h2>
            </header>

            {active.length === 0 ? (
              <p className="px-5 py-6 text-xs text-amber-800/70">Nobody has access yet.</p>
            ) : (
              <ul className="divide-y divide-amber-100">
                {active.map((user) => (
                  <li key={user.uid} className="px-5 py-4 flex flex-wrap items-center gap-3">
                    <UserSummary user={user} />

                    <div className="flex items-center gap-2 ml-auto">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          user.disabled
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : ROLE_STYLES[user.role]
                        }`}
                      >
                        {user.disabled ? 'disabled' : user.role}
                      </span>

                      {!user.isSelf && (
                        <>
                          <select
                            value={user.role}
                            disabled={busyUid === user.uid}
                            onChange={(e) =>
                              patchUser(user.uid, { role: e.target.value }, 'Role updated')
                            }
                            className="text-xs font-bold bg-amber-50/60 border border-amber-200 rounded-xl px-2.5 py-2 text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                          >
                            <option value="pending">pending</option>
                            <option value="staff">staff</option>
                            <option value="admin">admin</option>
                          </select>

                          <button
                            onClick={() =>
                              patchUser(
                                user.uid,
                                { disabled: !user.disabled },
                                user.disabled ? 'Account re-enabled' : 'Account disabled'
                              )
                            }
                            disabled={busyUid === user.uid}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-60 ${
                              user.disabled
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                            }`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            {user.disabled ? 'Enable' : 'Disable'}
                          </button>

                          <button
                            onClick={() => removeUser(user)}
                            disabled={busyUid === user.uid}
                            className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                            aria-label="Remove account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {user.isSelf && (
                        <span className="text-[11px] font-semibold text-amber-800/70">(you)</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function UserSummary({ user }: { user: AppUser }) {
  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center overflow-hidden shrink-0">
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-extrabold text-amber-800">{initial}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-amber-950 truncate">
          {user.displayName || user.email || user.uid}
        </p>
        {user.email && user.displayName && (
          <p className="text-[11px] text-amber-800/70 truncate">{user.email}</p>
        )}
      </div>
    </div>
  );
}
