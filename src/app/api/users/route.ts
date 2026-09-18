import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { listProfiles } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Lists every account so an admin can approve or revoke access. */
export async function GET() {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Supabase is not configured on the server yet.' },
        { status: 503 }
      );
    }

    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    const users = (await listProfiles()).map((user) => ({
      ...user,
      isSelf: user.uid === admin.uid,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('API Users GET error:', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
