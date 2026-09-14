import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const availableOnly = searchParams.get('availableOnly') === 'true';

    const where: any = {};

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (availableOnly) {
      where.isAvailable = true;
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    const items = await prisma.menuItem.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error('API Menu GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    const item = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        categoryId,
        price: parsedPrice,
        description: description ? description.trim() : null,
        imageUrl: imageUrl || null,
        isAvailable: Boolean(isAvailable),
        isSpecial: Boolean(isSpecial),
        isPopular: Boolean(isPopular),
      },
      include: {
        category: true,
      },
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        action: `Added new item: ${item.name}`,
        details: `Added to ${item.category?.name || 'menu'}`,
        type: 'add',
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('API Menu POST error:', error);
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 });
  }
}
