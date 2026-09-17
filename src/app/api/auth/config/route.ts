import { NextResponse } from 'next/server';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { legacyLoginEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Non-secret flags the sign-in screens need to render correctly.
 * Deliberately exposes booleans only — never the invite code itself.
 */
export async function GET() {
  return NextResponse.json({
    firebaseReady: isFirebaseAdminConfigured(),
    legacyLoginEnabled: legacyLoginEnabled(),
    inviteRequired: Boolean(process.env.SIGNUP_INVITE_CODE),
  });
}
