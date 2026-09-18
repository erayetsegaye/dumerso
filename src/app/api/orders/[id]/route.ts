import { NextResponse } from 'next/server';
import { denyUnlessApproved } from '@/lib/api-auth';
import { createActivity, deleteOrder, getOrder } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const order = await getOrder(params.id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('API Order GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const order = await getOrder(params.id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await deleteOrder(params.id);

    await createActivity({
      action: `Voided/Deleted Order ${order.orderNumber}`,
      details: `Amount: ${order.totalAmount} ETB`,
      type: 'delete',
    });

    return NextResponse.json({ message: 'Order voided/deleted successfully' });
  } catch (error) {
    console.error('API Order DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
