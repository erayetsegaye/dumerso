import { NextResponse } from 'next/server';
import { denyUnlessApproved, denyIfSupabaseDown } from '@/lib/api-auth';
import { createActivity, deleteMenuItem, getMenuItem, updateMenuItem } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const down = denyIfSupabaseDown();
    if (down) return down;

    const item = await getMenuItem(params.id);

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

    const updateData: {
      name?: string;
      categoryId?: string;
      price?: number;
      description?: string | null;
      imageUrl?: string | null;
      isAvailable?: boolean;
      isSpecial?: boolean;
      isPopular?: boolean;
    } = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.price !== undefined) updateData.price = parseFloat(body.price);
    if (body.description !== undefined) updateData.description = body.description ? body.description.trim() : null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.isAvailable !== undefined) updateData.isAvailable = Boolean(body.isAvailable);
    if (body.isSpecial !== undefined) updateData.isSpecial = Boolean(body.isSpecial);
    if (body.isPopular !== undefined) updateData.isPopular = Boolean(body.isPopular);

    const item = await updateMenuItem(params.id, updateData);

    if (body.isAvailable !== undefined && Object.keys(body).length === 1) {
      await createActivity({
        action: `Changed availability: ${item.name}`,
        details: `Marked as ${item.isAvailable ? 'Available' : 'Unavailable'}`,
        type: 'status',
      });
    } else {
      await createActivity({
        action: `Updated item: ${item.name}`,
        details: `Updated details / price (${item.price} ETB)`,
        type: 'update',
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

    const item = await getMenuItem(params.id);

    if (item) {
      await deleteMenuItem(params.id);
      await createActivity({
        action: `Deleted item: ${item.name}`,
        details: 'Removed from menu',
        type: 'delete',
      });
    }

    return NextResponse.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('API Menu Item DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 });
  }
}
