import { NextResponse } from 'next/server';
import { denyUnlessApproved } from '@/lib/api-auth';
import { listActivity } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const activities = await listActivity(10);
    return NextResponse.json(activities);
  } catch (error) {
    console.error('API Activity GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
  }
}
