import { NextResponse } from 'next/server';
import { denyUnlessApproved, denyIfSupabaseDown } from '@/lib/api-auth';
import { createActivity, createMenuItem, listMenuItems } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const down = denyIfSupabaseDown();
    if (down) return down;

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const availableOnly = searchParams.get('availableOnly') === 'true';

    const items = await listMenuItems({ categoryId, search, availableOnly });
    return NextResponse.json(items);
  } catch (error) {
    console.error('API Menu GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const body = await request.json();
    const {
      name,
      categoryId,
      price,
      description,
      imageUrl,
      isAvailable = true,
      isSpecial = false,
      isPopular = false,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
    }

    const item = await createMenuItem({
      name: name.trim(),
      categoryId,
      price: parsedPrice,
      description: description ? description.trim() : null,
      imageUrl: imageUrl || null,
      isAvailable: Boolean(isAvailable),
      isSpecial: Boolean(isSpecial),
      isPopular: Boolean(isPopular),
    });

    await createActivity({
      action: `Added new item: ${item.name}`,
      details: `Added to ${item.category?.name || 'menu'}`,
      type: 'add',
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('API Menu POST error:', error);
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 });
  }
}
