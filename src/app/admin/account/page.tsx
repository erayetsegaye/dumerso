'use client';

import React, { useEffect, useState } from 'react';
import { User, Lock, Check, KeyRound, AtSign, Mail } from 'lucide-react';

export default function AdminAccountPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [account, setAccount] = useState<{ username: string; email: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setAccount(data.user);
          setEmail(data.user.email || '');
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setIsSavingEmail(true);

    try {
      const res = await fetch('/api/auth/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentPassword: emailPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setAccount(data.user);
        setEmail(data.user.email || '');
        setEmailPassword('');
        showToast('Email updated successfully!');
      } else {
        setEmailError(data.error || 'Failed to update email');
      }
    } catch (err) {
      setEmailError('Error updating email');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setError('Error changing password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-amber-950 text-amber-50 px-4 py-3 rounded-2xl shadow-xl border border-amber-600 flex items-center gap-2 text-xs font-semibold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-serif">
          👤 Account Settings
        </h1>
        <p className="text-xs text-amber-800/80 mt-0.5">
          Update your sign-in email and password to keep your dashboard secure.
        </p>

        {account && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-full">
              <User className="w-3.5 h-3.5 text-amber-600" />
              {account.username}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-full">
              <Mail className="w-3.5 h-3.5 text-amber-600" />
              {account.email || 'No email set'}
            </span>
          </div>
        )}
      </div>

      {/* Email */}
      <form
        onSubmit={handleEmailSubmit}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-5"
      >
        <h2 className="text-sm font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-2">
          <AtSign className="w-4 h-4 text-amber-600" />
          Sign-in Email
        </h2>

        {emailError && (
          <div className="bg-rose-50 text-rose-700 text-xs p-3.5 rounded-2xl font-semibold">
            {emailError}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <p className="text-[11px] text-amber-800/70">
            You can sign in with either your username or this email address.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            Confirm With Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full pl-10 pr-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSavingEmail}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.99] disabled:opacity-60"
        >
          {isSavingEmail ? 'Saving email...' : 'SAVE EMAIL'}
        </button>
      </form>

      {error && (
        <div className="bg-rose-50 text-rose-700 text-xs p-3.5 rounded-2xl font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-5">
        <h2 className="text-sm font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-600" />
          Change Password
        </h2>

        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            Current Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full pl-10 pr-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            New Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full pl-10 pr-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full pl-10 pr-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="pt-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.99]"
          >
            {isSubmitting ? 'Updating password...' : 'UPDATE PASSWORD'}
          </button>
        </div>
      </form>

    </div>
  );
}
