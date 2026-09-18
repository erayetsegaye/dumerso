import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Who am I? Used by the admin layout to gate pages by role. */
export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: user.role,
      disabled: user.disabled,
      // Kept so older callers that read `username` keep working.
      username: user.displayName || user.email || 'admin',
    },
  });
}
