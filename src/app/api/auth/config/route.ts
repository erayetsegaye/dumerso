import { NextResponse } from 'next/server';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Non-secret flags the sign-in screens need to render correctly.
 * Deliberately exposes booleans only — never the invite code itself.
 */
export async function GET() {
  return NextResponse.json({
    supabaseReady: isSupabaseAdminConfigured(),
    inviteRequired: Boolean(process.env.SIGNUP_INVITE_CODE),
  });
}
