import { NextResponse } from 'next/server';
import { INVITE_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Stores the signup invite for the OAuth round-trip (httpOnly, short-lived). */
export async function POST(request: Request) {
  const { inviteCode } = await request.json().catch(() => ({ inviteCode: '' }));
  const code = typeof inviteCode === 'string' ? inviteCode.trim() : '';

  if (!code) {
    return NextResponse.json({ error: 'Please enter the invite code you were given.' }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(INVITE_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });
  return response;
}
