import { NextResponse } from 'next/server';
import { requireAdmin, requireApproved } from '@/lib/auth';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';

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

export function denyIfSupabaseDown(): NextResponse | null {
  if (isSupabaseAdminConfigured()) return null;
  return NextResponse.json(
    { error: 'Supabase is not configured on the server yet.' },
    { status: 503 }
  );
}

/** Any approved staff member or admin. */
export async function denyUnlessApproved(): Promise<NextResponse | null> {
  const down = denyIfSupabaseDown();
  if (down) return down;

  const user = await requireApproved();
  if (user) return null;

  return NextResponse.json(
    { error: 'Sign in with an approved account to do that.' },
    { status: 401 }
  );
}

/** Owner-level actions: money, exports, settings. */
export async function denyUnlessAdmin(): Promise<NextResponse | null> {
  const down = denyIfSupabaseDown();
  if (down) return down;

  const user = await requireAdmin();
  if (user) return null;

  return NextResponse.json({ error: 'Admins only' }, { status: 403 });
}
