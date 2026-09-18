'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Coffee,
  PlusCircle,
  ClipboardList,
  BarChart3,
  DollarSign,
  FileSpreadsheet,
  Settings,
  UserCog,
  Users,
  LogOut,
  Menu,
  X,
  User,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';

type AuthUser = {
  email: string | null;
  displayName: string | null;
  role: 'pending' | 'staff' | 'admin';
  disabled: boolean;
};

/** Sign-in and holding screens render without the dashboard shell. */
const STANDALONE_PAGES = ['/admin/login', '/admin/signup', '/admin/pending'];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [settings, setSettings] = useState<{ cafeName?: string; logoUrl?: string }>({});
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  // Pages that render on their own, without the dashboard chrome.
  const isStandalonePage = STANDALONE_PAGES.includes(pathname);

  // Verify the session on every admin page load. The middleware only checks
  // that the cookie exists; this confirms it is valid and carries a role.
  useEffect(() => {
    if (isStandalonePage) return;
    let cancelled = false;

    fetch('/api/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`);
          return;
        }
        const data = await res.json();
        const user: AuthUser = data.user;

        // Signed in but not approved yet (or switched off) -> holding page.
        if (!user || user.disabled || user.role === 'pending') {
          router.replace('/admin/pending');
          return;
        }

        setAuthUser(user);
      })
      .catch(() => {
        if (!cancelled) router.replace('/admin/login');
      });

    return () => {
      cancelled = true;
    };
  }, [isStandalonePage, pathname, router]);

  useEffect(() => {
    if (isStandalonePage) return;

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, [isStandalonePage]);

  if (isStandalonePage) {
    return <>{children}</>;
  }

  // Hold the dashboard back until we know the session is valid, so protected
  // data never flashes on screen for a signed-out visitor.
  if (!authUser) {
    return (
      <div className="min-h-screen bg-[#1A0D07] text-[#CDB99D] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B5A2B]" />
        <p className="text-xs font-bold uppercase tracking-widest">Checking session...</p>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Menu Items', href: '/admin/menu', icon: Coffee },
    { name: 'Add New Item', href: '/admin/menu/new', icon: PlusCircle },
    { name: 'Daily Orders', href: '/admin/orders', icon: ClipboardList },
    { name: 'Sales Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'Costs & Expenses', href: '/admin/costs', icon: DollarSign },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
    { name: 'My Account', href: '/admin/account', icon: UserCog },
    // Only admins hand out access.
    ...(authUser.role === 'admin'
      ? [{ name: 'Staff Access', href: '/admin/users', icon: Users }]
      : []),
  ];

  const handleLogout = async () => {
    // Clears the Firebase session cookie and the legacy cookie server-side.
    await fetch('/api/auth/session', { method: 'DELETE' });

    try {
      const { getFirebaseAuth, isFirebaseConfigured } = await import('@/lib/firebase/client');
      if (isFirebaseConfigured()) await getFirebaseAuth().signOut();
    } catch {
      // Client SDK not configured - the server cookie is already cleared.
    }

    setAuthUser(null);
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#1A0D07] text-[#F3E4CB] flex flex-col md:flex-row font-sans selection:bg-[#8B5A2B] selection:text-white">
      
      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden bg-[#24140C] text-[#F3E4CB] px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-[#4A2917] shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full border border-[#8B5A2B] overflow-hidden bg-[#1A0D07]">
            <SafeImage
              src={settings.logoUrl || '/logo.jpg'}
              alt="Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-serif font-bold text-[#F3E4CB] text-sm tracking-wider uppercase">
            {settings.cafeName || 'DUMERSO COFFEE'}
          </span>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-xl text-[#CDB99D] hover:bg-[#381B10] transition-colors"
          aria-label="Toggle Menu"
        >
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#24140C] text-[#CDB99D] flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } border-r border-[#4A2917] shadow-2xl md:shadow-none`}
      >
        <div className="space-y-6">
          
          {/* Sidebar Brand Header */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="w-10 h-10 rounded-full border border-[#8B5A2B] overflow-hidden shrink-0 bg-[#1A0D07] p-0.5 shadow">
              <SafeImage
                src={settings.logoUrl || '/logo.jpg'}
                alt="Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <h2 className="font-serif font-bold text-sm text-[#F3E4CB] tracking-wider uppercase leading-tight">
                {settings.cafeName || 'DUMERSO COFFEE'}
              </h2>
              <p className="text-[10px] text-[#8B5A2B] font-bold uppercase tracking-widest">Admin Control</p>
            </div>
          </div>

          <div className="h-px bg-[#4A2917]/70" />

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#4A2917] text-[#FFF4E3] border border-[#8B5A2B]/60 shadow-md'
                      : 'text-[#CDB99D] hover:bg-[#341B10] hover:text-[#F3E4CB]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#F3E4CB]' : 'text-[#8B5A2B]'}`} />
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Actions */}
        <div className="pt-4 border-t border-[#4A2917]/70 space-y-2">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#CDB99D] hover:bg-[#341B10] hover:text-[#F3E4CB] transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-[#8B5A2B]" />
            <span>View Public Website</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Logout</span>
          </button>
        </div>

      </aside>

      {/* Main Admin Body Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="bg-[#24140C] border-b border-[#4A2917] px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm text-[#F3E4CB]">
              Dumerso Coffee
            </span>
            <span className="text-xs text-[#CDB99D]/60">• Admin Panel</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-[#CDB99D]">
            <div className="flex items-center gap-2 bg-[#1A0D07] px-3 py-1.5 rounded-full border border-[#4A2917]">
              <User className="w-3.5 h-3.5 text-[#8B5A2B]" />
              <span className="text-[#F3E4CB] font-bold">
                {authUser.displayName || authUser.email || 'Admin'}
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8B5A2B]">
                {authUser.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="hover:text-rose-300 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>

      </div>

    </div>
  );
}
