import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { Role, requireAdmin, syncRoleClaim } from '@/lib/auth';

const ROLES: Role[] = ['pending', 'staff', 'admin'];

/** Change a user's role or enable/disable them. Admins only. */
export async function PATCH(request: Request, { params }: { params: { uid: string } }) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Firebase is not configured on the server yet.' },
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

    // Guard rails: never let an admin lock themselves out...
    if (uid === admin.uid && (role === 'pending' || role === 'staff' || disabled === true)) {
      return NextResponse.json(
        { error: 'You cannot remove your own admin access.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const ref = db.collection('users').doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ...and never leave the cafe with zero admins.
    const losesAdmin =
      snapshot.data()?.role === 'admin' && ((role && role !== 'admin') || disabled === true);
    if (losesAdmin) {
      const admins = await db
        .collection('users')
        .where('role', '==', 'admin')
        .where('disabled', '==', false)
        .get();
      if (admins.size <= 1) {
        return NextResponse.json(
          { error: 'This is the last active admin. Promote someone else first.' },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (role !== undefined) {
      updates.role = role;
      updates.approvedBy = admin.email ?? admin.uid;
      updates.approvedAt = new Date().toISOString();
    }
    if (disabled !== undefined) {
      updates.disabled = Boolean(disabled);
    }

    await ref.set(updates, { merge: true });

    const auth = getAdminAuth();
    if (role !== undefined) {
      await syncRoleClaim(uid, role);
    }
    if (disabled !== undefined) {
      await auth.updateUser(uid, { disabled: Boolean(disabled) });
    }
    // Force the change to take effect on the next request.
    await auth.revokeRefreshTokens(uid);

    const updated = await ref.get();
    const data = updated.data() || {};

    return NextResponse.json({
      message: 'User updated',
      user: {
        uid,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        role: data.role ?? 'pending',
        disabled: Boolean(data.disabled),
      },
    });
  } catch (error) {
    console.error('API Users PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/** Remove an account entirely (Firestore profile + Firebase user). */
export async function DELETE(_request: Request, { params }: { params: { uid: string } }) {
  try {
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json(
        { error: 'Firebase is not configured on the server yet.' },
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

    await getAdminDb().collection('users').doc(params.uid).delete();
    await getAdminAuth().deleteUser(params.uid).catch(() => undefined);

    return NextResponse.json({ message: 'User removed' });
  } catch (error) {
    console.error('API Users DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
