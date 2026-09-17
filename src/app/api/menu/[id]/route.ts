import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { denyUnlessApproved } from '@/lib/api-auth';

// GET stays public: the customer menu needs it.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const item = await prisma.menuItem.findUnique({
      where: { id: params.id },
      include: { category: true },
    });

    if (!item) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('API Menu Item GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch menu item' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const body = await request.json();
    
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.description !== undefined) updateData.description = body.description ? body.description.trim() : null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.isAvailable !== undefined) updateData.isAvailable = Boolean(body.isAvailable);
    if (body.isSpecial !== undefined) updateData.isSpecial = Boolean(body.isSpecial);
    if (body.isPopular !== undefined) updateData.isPopular = Boolean(body.isPopular);

    const item = await prisma.menuItem.update({
      where: { id: params.id },
      data: updateData,
      include: { category: true },
    });

    // Log Activity
    if (body.isAvailable !== undefined && Object.keys(body).length === 1) {
      await prisma.activityLog.create({
        data: {
          action: `Changed availability: ${item.name}`,
          details: `Marked as ${item.isAvailable ? 'Available' : 'Unavailable'}`,
          type: 'status',
        },
      });
    } else {
      await prisma.activityLog.create({
        data: {
          action: `Updated item: ${item.name}`,
          details: `Updated details / price (${item.price} ETB)`,
          type: 'update',
        },
      });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('API Menu Item PUT error:', error);
    return NextResponse.json({ error: 'Failed to update menu item' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const item = await prisma.menuItem.findUnique({
      where: { id: params.id },
    });

    if (item) {
      await prisma.menuItem.delete({
        where: { id: params.id },
      });

      await prisma.activityLog.create({
        data: {
          action: `Deleted item: ${item.name}`,
          details: `Removed from menu`,
          type: 'delete',
        },
      });
    }

    return NextResponse.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('API Menu Item DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 });
  }
}
