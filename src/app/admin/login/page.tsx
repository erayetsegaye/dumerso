'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, ArrowRight } from 'lucide-react';
import SafeImage from '@/components/SafeImage';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setError(data.error || 'Invalid username or password');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
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
            <p className="text-xs text-[#CDB99D] font-medium mt-0.5">Admin Dashboard Login</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#8B5A2B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-10 pr-4 py-3 text-sm bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8B5A2B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-4 py-3 text-sm bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B] font-medium"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#CDB99D]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded accent-[#8B5A2B]" defaultChecked />
              <span>Remember me</span>
            </label>
            <a href="#" className="hover:text-[#F3E4CB] transition-colors">Forgot password?</a>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#8B5A2B] hover:bg-[#724820] text-[#FFF4E3] font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm mt-2"
          >
            {isLoading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Login to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#4A2917]/60">
          <p className="text-[11px] text-[#CDB99D]">
            Default Password: <code className="bg-[#1A0D07] px-1.5 py-0.5 rounded font-mono font-bold text-[#FFF4E3] border border-[#4A2917]">dumerso123</code>
          </p>
        </div>

      </div>
    </div>
  );
}
