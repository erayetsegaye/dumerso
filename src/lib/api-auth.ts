import { NextResponse } from 'next/server';
import { requireAdmin, requireApproved } from '@/lib/auth';

/**
 * Route guards. Each returns a response to send back when access is refused,
 * or null when the caller may proceed:
 *
 *   const denied = await denyUnlessApproved();
 *   if (denied) return denied;
 *
 * Without these, the admin UI is gated but the API behind it is not — anyone
 * could POST straight to it.
 */

/** Any approved staff member or admin. */
export async function denyUnlessApproved(): Promise<NextResponse | null> {
  const user = await requireApproved();
  if (user) return null;

  return NextResponse.json(
    { error: 'Sign in with an approved account to do that.' },
    { status: 401 }
  );
}

/** Owner-level actions: money, exports, settings. */
export async function denyUnlessAdmin(): Promise<NextResponse | null> {
  const user = await requireAdmin();
  if (user) return null;

  return NextResponse.json({ error: 'Admins only' }, { status: 403 });
}
