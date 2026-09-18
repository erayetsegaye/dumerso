import { NextResponse } from 'next/server';
import { denyUnlessApproved } from '@/lib/api-auth';
import { ethiopiaDateString, ethiopiaTime12 } from '@/lib/dates';
import { countOrders, createActivity, createOrder, getMenuItem, listOrders } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const orders = await listOrders({
      status: 'Completed',
      date,
      startDate,
      endDate,
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('API Orders GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const body = await request.json();
    const { items: orderItems, paymentMethod = 'Cash' } = body;

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return NextResponse.json({ error: 'At least one item is required for an order' }, { status: 400 });
    }

    const now = new Date();
    const todayDateStr = ethiopiaDateString(now);
    const todayTimeStr = ethiopiaTime12(now);

    let totalAmount = 0;
    const preparedItems = [];

    for (const itemInput of orderItems) {
      const { menuItemId, quantity } = itemInput;
      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) continue;

      let menuItemName = itemInput.itemName;
      let unitPrice = parseFloat(itemInput.unitPrice);
      let categoryName = itemInput.categoryName || 'General';

      if (menuItemId) {
        const dbItem = await getMenuItem(menuItemId);
        if (dbItem) {
          menuItemName = dbItem.name;
          unitPrice = dbItem.price;
          categoryName = dbItem.category?.name || 'General';
        }
      }

      if (!menuItemName || isNaN(unitPrice)) continue;

      const subtotal = qty * unitPrice;
      totalAmount += subtotal;

      preparedItems.push({
        menuItemId: menuItemId || null,
        itemName: menuItemName,
        categoryName,
        quantity: qty,
        unitPrice,
        subtotal,
      });
    }

    if (preparedItems.length === 0) {
      return NextResponse.json({ error: 'No valid items in order' }, { status: 400 });
    }

    const count = await countOrders();
    const nextNum = count + 1;
    const orderNumber = `#${String(nextNum).padStart(4, '0')}`;

    const order = await createOrder({
      orderNumber,
      orderDate: todayDateStr,
      orderTime: todayTimeStr,
      totalAmount,
      paymentMethod,
      status: 'Completed',
      items: preparedItems,
    });

    const itemSummary = preparedItems.map((i) => `${i.itemName} ×${i.quantity}`).join(', ');
    await createActivity({
      action: `Recorded Order ${order.orderNumber} (${order.totalAmount} ETB)`,
      details: `${itemSummary} • ${paymentMethod}`,
      type: 'add',
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('API Orders POST error:', error);
    return NextResponse.json({ error: 'Failed to save order' }, { status: 500 });
  }
}
