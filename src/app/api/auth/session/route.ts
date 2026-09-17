import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
  LEGACY_COOKIE,
  SESSION_COOKIE,
  getOrCreateUserProfile,
  isBootstrapAdmin,
} from '@/lib/auth';

const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // Firebase allows up to 14 days.

function inviteCodeRequired(): boolean {
  return Boolean(process.env.SIGNUP_INVITE_CODE);
}

function inviteCodeMatches(supplied: unknown): boolean {
  const expected = process.env.SIGNUP_INVITE_CODE;
  if (!expected) return true;
  return typeof supplied === 'string' && supplied.trim() === expected;
}

/**
 * Exchanges a Google ID token for an httpOnly session cookie.
 *
 * First-time accounts must present the invite code; afterwards they exist as
 * 'pending' until an admin approves them on /admin/users.
 */
export async function POST(request: Request) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Firebase is not configured on the server yet.' },
        { status: 503 }
      );
    }

    const { idToken, inviteCode } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing sign-in token' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);

    // Existing accounts never need the invite code again.
    const db = getAdminDb();
    const existing = await db.collection('users').doc(decoded.uid).get();
    const isNewAccount = !existing.exists;

    if (isNewAccount && !isBootstrapAdmin(decoded.email) && !inviteCodeMatches(inviteCode)) {
      // Do not leave a half-created Firebase user behind for a failed signup.
      await auth.deleteUser(decoded.uid).catch(() => undefined);
      return NextResponse.json(
        {
          error: inviteCodeRequired()
            ? 'That invite code is not valid. Ask the cafe owner for the current code.'
            : 'Sign-ups are closed right now.',
        },
        { status: 403 }
      );
    }

    if (existing.exists && existing.data()?.disabled) {
      return NextResponse.json(
        { error: 'This account has been disabled by an administrator.' },
        { status: 403 }
      );
    }

    const profile = await getOrCreateUserProfile({
      uid: decoded.uid,
      email: decoded.email ?? null,
      displayName: (decoded.name as string) ?? null,
      photoURL: (decoded.picture as string) ?? null,
    });

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const response = NextResponse.json({
      success: true,
      isNewAccount: profile.created,
      user: {
        uid: decoded.uid,
        email: decoded.email ?? null,
        displayName: (decoded.name as string) ?? null,
        role: profile.role,
      },
    });

    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_MS / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('API Session POST error:', error);
    return NextResponse.json({ error: 'Could not start a session' }, { status: 401 });
  }
}

/** Sign out: clears both the Firebase session and the legacy cookie. */
export async function DELETE() {
  const sessionCookie = cookies().get(SESSION_COOKIE)?.value;

  if (sessionCookie && isFirebaseAdminConfigured()) {
    try {
      const auth = getAdminAuth();
      const decoded = await auth.verifySessionCookie(sessionCookie, false);
      // Invalidates refresh tokens so the session cannot be resurrected.
      await auth.revokeRefreshTokens(decoded.sub);
    } catch {
      // Already invalid — nothing to revoke.
    }
  }

  const response = NextResponse.json({ success: true });
  for (const name of [SESSION_COOKIE, LEGACY_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  return response;
}
