import { NextResponse } from 'next/server';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Lists every account so an admin can approve or revoke access. */
export async function GET() {
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

    const snapshot = await getAdminDb().collection('users').orderBy('createdAt', 'desc').get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        photoURL: data.photoURL ?? null,
        role: data.role ?? 'pending',
        disabled: Boolean(data.disabled),
        createdAt: data.createdAt ?? null,
        lastSeenAt: data.lastSeenAt ?? null,
        isSelf: doc.id === admin.uid,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('API Users GET error:', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
