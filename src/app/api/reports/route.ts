import { NextResponse } from 'next/server';
import { denyUnlessAdmin, denyUnlessApproved } from '@/lib/api-auth';
import { addDays, ethiopiaDateString } from '@/lib/dates';
import { createActivity, getDailySummary, listOrders, upsertDailySummary } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const denied = await denyUnlessApproved();
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const todayStr = ethiopiaDateString();

    let startDateStr = todayStr;
    let endDateStr = todayStr;

    if (period === 'yesterday') {
      startDateStr = addDays(todayStr, -1);
      endDateStr = startDateStr;
    } else if (period === 'week') {
      startDateStr = addDays(todayStr, -6);
      endDateStr = todayStr;
    } else if (period === 'month') {
      startDateStr = addDays(todayStr, -29);
      endDateStr = todayStr;
    } else if (period === 'custom' && startDateParam && endDateParam) {
      startDateStr = startDateParam;
      endDateStr = endDateParam;
    }

    const orders = await listOrders({
      status: 'Completed',
      startDate: startDateStr,
      endDate: endDateStr,
    });

    let totalSales = 0;
    let itemsSold = 0;
    let cashSales = 0;
    let telebirrSales = 0;
    let cardSales = 0;
    let otherSales = 0;

    const categoryMap: Record<string, number> = {};
    const itemMap: Record<string, { name: string; quantity: number; sales: number }> = {};
    const dailyMap: Record<string, { date: string; orders: number; itemsSold: number; totalSales: number }> = {};

    for (const order of orders) {
      totalSales += order.totalAmount;

      const pm = order.paymentMethod?.toLowerCase() || 'cash';
      if (pm.includes('cash')) cashSales += order.totalAmount;
      else if (pm.includes('telebirr')) telebirrSales += order.totalAmount;
      else if (pm.includes('card')) cardSales += order.totalAmount;
      else otherSales += order.totalAmount;

      if (!dailyMap[order.orderDate]) {
        dailyMap[order.orderDate] = {
          date: order.orderDate,
          orders: 0,
          itemsSold: 0,
          totalSales: 0,
        };
      }
      dailyMap[order.orderDate].orders += 1;
      dailyMap[order.orderDate].totalSales += order.totalAmount;

      for (const item of order.items) {
        itemsSold += item.quantity;
        dailyMap[order.orderDate].itemsSold += item.quantity;

        const cat = item.categoryName || 'General';
        categoryMap[cat] = (categoryMap[cat] || 0) + item.subtotal;

        if (!itemMap[item.itemName]) {
          itemMap[item.itemName] = { name: item.itemName, quantity: 0, sales: 0 };
        }
        itemMap[item.itemName].quantity += item.quantity;
        itemMap[item.itemName].sales += item.subtotal;
      }
    }

    const totalOrders = orders.length;
    const averageOrder = totalOrders > 0 ? parseFloat((totalSales / totalOrders).toFixed(2)) : 0;

    const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount,
    }));

    const bestSellingItems = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const dailyBreakdown = Object.values(dailyMap)
      .map((d) => ({
        ...d,
        averageOrder: d.orders > 0 ? parseFloat((d.totalSales / d.orders).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const closedSummary = await getDailySummary(todayStr);

    return NextResponse.json({
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      totalSales,
      totalOrders,
      itemsSold,
      averageOrder,
      paymentBreakdown: {
        cash: cashSales,
        telebirr: telebirrSales,
        card: cardSales,
        other: otherSales,
      },
      categoryBreakdown,
      bestSellingItems,
      dailyBreakdown,
      isTodayClosed: Boolean(closedSummary?.isClosed),
    });
  } catch (error) {
    console.error('API Reports GET error:', error);
    return NextResponse.json({ error: 'Failed to generate sales report' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;

    const todayStr = ethiopiaDateString();

    const orders = await listOrders({
      status: 'Completed',
      date: todayStr,
    });

    let totalSales = 0;
    let itemsSold = 0;
    let cashSales = 0;
    let telebirrSales = 0;
    let cardSales = 0;
    let otherSales = 0;

    for (const order of orders) {
      totalSales += order.totalAmount;
      const pm = order.paymentMethod?.toLowerCase() || 'cash';
      if (pm.includes('cash')) cashSales += order.totalAmount;
      else if (pm.includes('telebirr')) telebirrSales += order.totalAmount;
      else if (pm.includes('card')) cardSales += order.totalAmount;
      else otherSales += order.totalAmount;

      for (const item of order.items) {
        itemsSold += item.quantity;
      }
    }

    const totalOrders = orders.length;
    const averageOrder = totalOrders > 0 ? parseFloat((totalSales / totalOrders).toFixed(2)) : 0;

    const summary = await upsertDailySummary({
      date: todayStr,
      totalSales,
      totalOrders,
      itemsSold,
      averageOrder,
      cashSales,
      telebirrSales,
      cardSales,
      otherSales,
      isClosed: true,
    });

    await createActivity({
      action: `Closed Sales for ${todayStr}`,
      details: `Total: ${totalSales} ETB (${totalOrders} orders, ${itemsSold} items)`,
      type: 'status',
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('API Reports POST Close Day error:', error);
    return NextResponse.json({ error: "Failed to close today's sales" }, { status: 500 });
  }
}
