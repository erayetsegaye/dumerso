import { NextResponse } from 'next/server';
import { getAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { Role, requireAdmin } from '@/lib/auth';
import { countActiveAdmins, deleteProfile, getProfile, updateProfile } from '@/lib/db';

const ROLES: Role[] = ['pending', 'staff', 'admin'];

export const dynamic = 'force-dynamic';

/** Change a user's role or enable/disable them. Admins only. */
export async function PATCH(request: Request, { params }: { params: { uid: string } }) {
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

    const { uid } = params;
    const { role, disabled } = await request.json();

    if (role !== undefined && !ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Role must be one of: ${ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (uid === admin.uid && (role === 'pending' || role === 'staff' || disabled === true)) {
      return NextResponse.json(
        { error: 'You cannot remove your own admin access.' },
        { status: 400 }
      );
    }

    const existing = await getProfile(uid);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const losesAdmin =
      existing.role === 'admin' && ((role && role !== 'admin') || disabled === true);
    if (losesAdmin) {
      const admins = await countActiveAdmins();
      if (admins <= 1) {
        return NextResponse.json(
          { error: 'This is the last active admin. Promote someone else first.' },
          { status: 400 }
        );
      }
    }

    const updated = await updateProfile(uid, {
      ...(role !== undefined
        ? {
            role,
            approvedBy: admin.email ?? admin.uid,
            approvedAt: new Date().toISOString(),
          }
        : {}),
      ...(disabled !== undefined ? { disabled: Boolean(disabled) } : {}),
    });

    if (disabled === true) {
      await getAdminClient().auth.admin.signOut(uid, 'global').catch(() => undefined);
    }

    return NextResponse.json({
      message: 'User updated',
      user: {
        uid,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
        disabled: updated.disabled,
      },
    });
  } catch (error) {
    console.error('API Users PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/** Remove an account entirely (profile + Auth user). */
export async function DELETE(_request: Request, { params }: { params: { uid: string } }) {
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

    if (params.uid === admin.uid) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    await deleteProfile(params.uid);
    await getAdminClient().auth.admin.deleteUser(params.uid).catch(() => undefined);

    return NextResponse.json({ message: 'User removed' });
  } catch (error) {
    console.error('API Users DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
