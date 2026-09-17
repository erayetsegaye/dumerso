import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export const SESSION_COOKIE = 'admin_session';
export const LEGACY_COOKIE = 'admin_token';

/** 'pending' users are signed in but approved for nothing. */
export type Role = 'pending' | 'staff' | 'admin';

export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
  disabled: boolean;
  provider: 'firebase' | 'legacy';
};

const JWT_SECRET = process.env.JWT_SECRET || 'dumerso-cafe-secret-key-2026';
const USERS_COLLECTION = 'users';

/** Password login stays usable until Firebase is verified, then flip this off. */
export function legacyLoginEnabled(): boolean {
  return process.env.ALLOW_LEGACY_ADMIN_LOGIN !== 'false';
}

export function bootstrapAdminEmails(): string[] {
  return (process.env.FIREBASE_BOOTSTRAP_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return bootstrapAdminEmails().includes(email.toLowerCase());
}

/**
 * Reads the Firestore profile for a Firebase user, creating it on first sign-in.
 * Emails listed in FIREBASE_BOOTSTRAP_ADMIN_EMAILS are promoted automatically so
 * the first real admin can get in without a chicken-and-egg problem.
 */
export async function getOrCreateUserProfile(user: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}): Promise<{ role: Role; disabled: boolean; created: boolean }> {
  const db = getAdminDb();
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  const snapshot = await ref.get();
  const shouldBootstrap = isBootstrapAdmin(user.email);

  if (!snapshot.exists) {
    const role: Role = shouldBootstrap ? 'admin' : 'pending';
    await ref.set({
      email: user.email?.toLowerCase() ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      role,
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await syncRoleClaim(user.uid, role);
    return { role, disabled: false, created: true };
  }

  const data = snapshot.data() || {};
  let role = (data.role as Role) || 'pending';

  // Keep profile fields fresh, and honour a newly added bootstrap email.
  const updates: Record<string, unknown> = {
    email: user.email?.toLowerCase() ?? data.email ?? null,
    displayName: user.displayName ?? data.displayName ?? null,
    photoURL: user.photoURL ?? data.photoURL ?? null,
    lastSeenAt: new Date().toISOString(),
  };

  if (shouldBootstrap && role !== 'admin') {
    role = 'admin';
    updates.role = 'admin';
    updates.updatedAt = new Date().toISOString();
    await syncRoleClaim(user.uid, 'admin');
  }

  await ref.set(updates, { merge: true });

  return { role, disabled: Boolean(data.disabled), created: false };
}

/** Mirrors the role into a custom claim so it travels with the token. */
export async function syncRoleClaim(uid: string, role: Role): Promise<void> {
  await getAdminAuth().setCustomUserClaims(uid, { role });
}

/** Resolves the caller from the session cookie, or null when signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = cookies();
  const sessionCookie = store.get(SESSION_COOKIE)?.value;

  if (sessionCookie && isFirebaseAdminConfigured()) {
    try {
      // checkRevoked: a disabled or signed-out account loses access immediately.
      const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
      const profile = await getOrCreateUserProfile({
        uid: decoded.uid,
        email: decoded.email ?? null,
        displayName: (decoded.name as string) ?? null,
        photoURL: (decoded.picture as string) ?? null,
      });

      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        displayName: (decoded.name as string) ?? null,
        photoURL: (decoded.picture as string) ?? null,
        role: profile.role,
        disabled: profile.disabled,
        provider: 'firebase',
      };
    } catch {
      // Fall through to the legacy check below.
    }
  }

  if (legacyLoginEnabled()) {
    const legacyToken = store.get(LEGACY_COOKIE)?.value;
    if (legacyToken) {
      try {
        const decoded = jwt.verify(legacyToken, JWT_SECRET) as { id: string; username: string };
        return {
          uid: decoded.id,
          email: null,
          displayName: decoded.username,
          photoURL: null,
          role: 'admin',
          disabled: false,
          provider: 'legacy',
        };
      } catch {
        return null;
      }
    }
  }

  return null;
}

/** Caller must be an approved staff member or admin. */
export async function requireApproved(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.disabled || user.role === 'pending') return null;
  return user;
}

/** Caller must be an admin. */
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.disabled || user.role !== 'admin') return null;
  return user;
}
