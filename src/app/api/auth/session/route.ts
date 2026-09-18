import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { INVITE_COOKIE, LEGACY_COOKIE, getSessionUser, signOutEverywhere } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Sign out: clears the Supabase session cookies and the leftover password cookie. */
export async function DELETE() {
  const user = await getSessionUser().catch(() => null);
  await signOutEverywhere(user?.uid);

  const response = NextResponse.json({ success: true });
  for (const name of [INVITE_COOKIE, LEGACY_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  // Also drop any leftover cookies Next could not clear through the SSR client.
  cookies().getAll().forEach((cookie) => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
    }
  });

  return response;
}
