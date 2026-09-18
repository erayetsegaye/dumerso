import { createUserServerClient } from '@/lib/supabase/server';
import { getAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  countActiveAdmins,
  getProfile,
  insertProfile,
  updateProfile,
} from '@/lib/db';

export const INVITE_COOKIE = 'signup_invite';
export const LEGACY_COOKIE = 'admin_token';

export type Role = 'pending' | 'staff' | 'admin';

export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
  disabled: boolean;
};

export function bootstrapAdminEmails(): string[] {
  return (process.env.BOOTSTRAP_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return bootstrapAdminEmails().includes(email.toLowerCase());
}

export function inviteCodeRequired(): boolean {
  return Boolean(process.env.SIGNUP_INVITE_CODE);
}

export function inviteCodeMatches(supplied: unknown): boolean {
  const expected = process.env.SIGNUP_INVITE_CODE;
  if (!expected) return true;
  return typeof supplied === 'string' && supplied.trim() === expected;
}

/**
 * Reads the profiles row for a signed-in user, creating it on first sign-in.
 * Emails in BOOTSTRAP_ADMIN_EMAILS are promoted automatically.
 */
export async function getOrCreateUserProfile(user: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}): Promise<{ role: Role; disabled: boolean; created: boolean }> {
  const existing = await getProfile(user.uid);
  const shouldBootstrap = isBootstrapAdmin(user.email);

  if (!existing) {
    const role: Role = shouldBootstrap ? 'admin' : 'pending';
    await insertProfile({
      id: user.uid,
      email: user.email?.toLowerCase() ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      role,
      disabled: false,
    });
    return { role, disabled: false, created: true };
  }

  let role = (existing.role as Role) || 'pending';
  const updates: {
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    lastSeenAt: string;
    role?: Role;
  } = {
    email: user.email?.toLowerCase() ?? existing.email ?? null,
    displayName: user.displayName ?? existing.displayName ?? null,
    photoURL: user.photoURL ?? existing.photoURL ?? null,
    lastSeenAt: new Date().toISOString(),
  };

  if (shouldBootstrap && role !== 'admin') {
    role = 'admin';
    updates.role = 'admin';
  }

  await updateProfile(user.uid, updates);
  return { role, disabled: existing.disabled, created: false };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const supabase = createUserServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    const profile = await getOrCreateUserProfile({
      uid: user.id,
      email: user.email ?? null,
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || null,
      photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    });

    return {
      uid: user.id,
      email: user.email ?? null,
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || null,
      photoURL: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      role: profile.role,
      disabled: profile.disabled,
    };
  } catch {
    return null;
  }
}

export async function requireApproved(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.disabled || user.role === 'pending') return null;
  return user;
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.disabled || user.role !== 'admin') return null;
  return user;
}

export async function activeAdminCount(): Promise<number> {
  return countActiveAdmins();
}

export async function signOutEverywhere(uid?: string): Promise<void> {
  const supabase = createUserServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  if (uid && isSupabaseAdminConfigured()) {
    await getAdminClient().auth.admin.signOut(uid, 'global').catch(() => undefined);
  }
}
