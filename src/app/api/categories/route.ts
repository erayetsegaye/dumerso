import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { denyUnlessApproved } from '@/lib/api-auth';

// GET stays public: the customer menu needs it.
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('API Categories GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const body = await request.json();
    const { name, icon, order } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        icon: icon || '☕',
        order: typeof order === 'number' ? order : 0,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('API Categories POST error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
