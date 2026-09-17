import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { denyUnlessApproved } from '@/lib/api-auth';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const body = await request.json();
    const { name, icon, order } = body;

    const category = await prisma.category.update({
      where: { id: params.id },
      data: {
        name,
        icon,
        order,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('API Category PUT error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    await prisma.category.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('API Category DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
