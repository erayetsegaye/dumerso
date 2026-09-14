import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const now = new Date();
    const todayStr = getLocalDateString(now);

    let startDateStr = todayStr;
    let endDateStr = todayStr;

    if (period === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDateStr = getLocalDateString(yesterday);
      endDateStr = startDateStr;
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 6);
      startDateStr = getLocalDateString(weekAgo);
      endDateStr = todayStr;
    } else if (period === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setDate(now.getDate() - 29);
      startDateStr = getLocalDateString(monthAgo);
      endDateStr = todayStr;
    } else if (period === 'custom' && startDateParam && endDateParam) {
      startDateStr = startDateParam;
      endDateStr = endDateParam;
    }

    // Fetch all completed orders in range
    const orders = await prisma.order.findMany({
      where: {
        status: 'Completed',
        orderDate: {
          gte: startDateStr,
          lte: endDateStr,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        orderDate: 'desc',
      },
    });

    // 1. Core Summary Metrics
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
      
      // Payment Breakdown
      const pm = order.paymentMethod?.toLowerCase() || 'cash';
      if (pm.includes('cash')) cashSales += order.totalAmount;
      else if (pm.includes('telebirr')) telebirrSales += order.totalAmount;
      else if (pm.includes('card')) cardSales += order.totalAmount;
      else otherSales += order.totalAmount;

      // Daily Breakdown grouping
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

      // Process Order Items
      for (const item of order.items) {
        itemsSold += item.quantity;
        dailyMap[order.orderDate].itemsSold += item.quantity;

        // Category Breakdown
        const cat = item.categoryName || 'General';
        categoryMap[cat] = (categoryMap[cat] || 0) + item.subtotal;

        // Best Selling Items
        if (!itemMap[item.itemName]) {
          itemMap[item.itemName] = { name: item.itemName, quantity: 0, sales: 0 };
        }
        itemMap[item.itemName].quantity += item.quantity;
        itemMap[item.itemName].sales += item.subtotal;
      }
    }

    const totalOrders = orders.length;
    const averageOrder = totalOrders > 0 ? parseFloat((totalSales / totalOrders).toFixed(2)) : 0;

    // Convert Category breakdown to array
    const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount,
    }));

    // Convert Best Selling Items to sorted array
    const bestSellingItems = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Convert Daily Breakdown to sorted array
    const dailyBreakdown = Object.values(dailyMap)
      .map((d) => ({
        ...d,
        averageOrder: d.orders > 0 ? parseFloat((d.totalSales / d.orders).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Check if today is closed in DailySalesSummary
    const closedSummary = await prisma.dailySalesSummary.findUnique({
      where: { date: todayStr },
    });

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

// POST endpoint for "Close Today's Sales"
export async function POST() {
  try {
    const todayStr = getLocalDateString(new Date());

    // Fetch today's completed orders
    const orders = await prisma.order.findMany({
      where: {
        status: 'Completed',
        orderDate: todayStr,
      },
      include: {
        items: true,
      },
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

    // Upsert DailySalesSummary
    const summary = await prisma.dailySalesSummary.upsert({
      where: { date: todayStr },
      update: {
        totalSales,
        totalOrders,
        itemsSold,
        averageOrder,
        cashSales,
        telebirrSales,
        cardSales,
        otherSales,
        isClosed: true,
        closedAt: new Date(),
      },
      create: {
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
      },
    });

    // Log Activity
    await prisma.activityLog.create({
      data: {
        action: `Closed Sales for ${todayStr}`,
        details: `Total: ${totalSales} ETB (${totalOrders} orders, ${itemsSold} items)`,
        type: 'status',
      },
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error('API Reports POST Close Day error:', error);
    return NextResponse.json({ error: "Failed to close today's sales" }, { status: 500 });
  }
}
