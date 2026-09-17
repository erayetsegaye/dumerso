import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { denyUnlessApproved } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// Helper to get formatted local date (YYYY-MM-DD)
function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get formatted local time (hh:mm AM/PM)
function getLocalTimeString(dateObj = new Date()) {
  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
}

export async function GET(request: Request) {
  try {
    // Sales data: never public.
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = { status: 'Completed' };

    if (date) {
      where.orderDate = date;
    } else if (startDate && endDate) {
      where.orderDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
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
    const todayDateStr = getLocalDateString(now);
    const todayTimeStr = getLocalTimeString(now);

    // Calculate total and prepare order item records with current DB prices & names
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
        const dbItem = await prisma.menuItem.findUnique({
          where: { id: menuItemId },
          include: { category: true },
        });
        if (dbItem) {
          menuItemName = dbItem.name;
          unitPrice = dbItem.price; // ALWAYS use current price at order time
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

    // Generate unique sequential padded order number (e.g. #0001, #0002)
    const count = await prisma.order.count();
    const nextNum = count + 1;
    const orderNumber = `#${String(nextNum).padStart(4, '0')}`;

    // Create Order with nested items
    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderDate: todayDateStr,
        orderTime: todayTimeStr,
        totalAmount,
        paymentMethod,
        status: 'Completed',
        items: {
          create: preparedItems,
        },
      },
      include: {
        items: true,
      },
    });

    // Log Activity
    const itemSummary = preparedItems.map((i) => `${i.itemName} ×${i.quantity}`).join(', ');
    await prisma.activityLog.create({
      data: {
        action: `Recorded Order ${order.orderNumber} (${order.totalAmount} ETB)`,
        details: `${itemSummary} • ${paymentMethod}`,
        type: 'add',
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('API Orders POST error:', error);
    return NextResponse.json({ error: 'Failed to save order' }, { status: 500 });
  }
}
