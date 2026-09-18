import { NextResponse } from 'next/server';
import { denyUnlessAdmin, denyIfSupabaseDown } from '@/lib/api-auth';
import { createDefaultSettings, getSettings, upsertSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const down = denyIfSupabaseDown();
    if (down) return down;

    let settings = await getSettings();
    if (!settings) {
      settings = await createDefaultSettings();
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('API Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;

    const body = await request.json();
    const settings = await upsertSettings({
      cafeName: body.cafeName,
      logoUrl: body.logoUrl,
      description: body.description,
      tagline: body.tagline,
      phone: body.phone,
      location: body.location,
      mapsUrl: body.mapsUrl,
      openingHours: body.openingHours,
      facebook: body.facebook,
      instagram: body.instagram,
      telegram: body.telegram,
      tiktok: body.tiktok,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('API Settings PUT error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
