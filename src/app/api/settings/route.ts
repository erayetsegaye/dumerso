import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { denyUnlessAdmin } from '@/lib/api-auth';

// Never prerender/cache this at build time: without it the cafe settings are
// frozen into a static response and edits in the admin panel never show up
// on a hosted deployment.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'default',
          cafeName: 'Dumerso Café',
          logoUrl: '/logo.jpg',
          description: 'Freshly brewed. Made with care.',
          tagline: 'Scan. Browse. Enjoy.',
          phone: '+251 913 961 921',
          location: 'Gombora Taxi Mazoriya',
          openingHours: 'Mon - Sun: 7:00 AM - 10:00 PM',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('API Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // Cafe identity (name, logo, socials): admins only.
    const denied = await denyUnlessAdmin();
    if (denied) return denied;

    const body = await request.json();
    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
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
      },
      create: {
        id: 'default',
        cafeName: body.cafeName || 'Dumerso Café',
        logoUrl: body.logoUrl || '/logo.jpg',
        description: body.description || 'Freshly brewed. Made with care.',
        tagline: body.tagline || 'Scan. Browse. Enjoy.',
        phone: body.phone || '+251 913 961 921',
        location: body.location || 'Gombora Taxi Mazoriya',
        mapsUrl: body.mapsUrl || '',
        openingHours: body.openingHours || 'Mon - Sun: 7:00 AM - 10:00 PM',
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('API Settings PUT error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
