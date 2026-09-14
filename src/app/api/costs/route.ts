import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const targetDateParam = searchParams.get('date'); // YYYY-MM-DD for single day breakdown
    const targetMonthParam = searchParams.get('month'); // YYYY-MM for monthly breakdown

    const now = new Date();
    const todayStr = getLocalDateString(now);

    let startDateStr = todayStr;
    let endDateStr = todayStr;

    if (targetDateParam) {
      startDateStr = targetDateParam;
      endDateStr = targetDateParam;
    } else if (targetMonthParam) {
      // e.g. "2026-09"
      const [yStr, mStr] = targetMonthParam.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      const daysCount = getDaysInMonth(y, m);
      startDateStr = `${yStr}-${mStr}-01`;
      endDateStr = `${yStr}-${mStr}-${String(daysCount).padStart(2, '0')}`;
    } else if (period === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDateStr = getLocalDateString(yesterday);
      endDateStr = startDateStr;
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 6);
      startDateStr = getLocalDateString(weekAgo);
      endDateStr = todayStr;
    } else if (period === 'month' || period === 'this_month') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const daysCount = getDaysInMonth(y, m);
      const mStr = String(m + 1).padStart(2, '0');
      startDateStr = `${y}-${mStr}-01`;
      endDateStr = `${y}-${mStr}-${String(daysCount).padStart(2, '0')}`;
    } else if (period === 'previous_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = prev.getFullYear();
      const m = prev.getMonth();
      const daysCount = getDaysInMonth(y, m);
      const mStr = String(m + 1).padStart(2, '0');
      startDateStr = `${y}-${mStr}-01`;
      endDateStr = `${y}-${mStr}-${String(daysCount).padStart(2, '0')}`;
    } else if (period === 'custom' && startDateParam && endDateParam) {
      startDateStr = startDateParam;
      endDateStr = endDateParam;
    }

    // 1. Fetch all costs from DB
    const allCosts = await prisma.cost.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const activeCosts = allCosts.filter((c) => c.active);
    const fixedCosts = activeCosts.filter((c) => c.costType === 'fixed_monthly');
    const percentageCosts = activeCosts.filter((c) => c.costType === 'sales_percentage');

    // 2. Fetch completed orders in range
    const orders = await prisma.order.findMany({
      where: {
        status: 'Completed',
        orderDate: {
          gte: startDateStr,
          lte: endDateStr,
        },
      },
      select: {
        orderDate: true,
        totalAmount: true,
      },
    });

    // Group daily sales
    const dailySalesMap: Record<string, number> = {};
    let totalSales = 0;

    for (const o of orders) {
      totalSales += o.totalAmount;
      dailySalesMap[o.orderDate] = (dailySalesMap[o.orderDate] || 0) + o.totalAmount;
    }

    // Build list of dates in the selected range
    const startObj = new Date(startDateStr);
    const endObj = new Date(endDateStr);
    const datesList: string[] = [];
    const curr = new Date(startObj);
    while (curr <= endObj) {
      datesList.push(getLocalDateString(curr));
      curr.setDate(curr.getDate() + 1);
    }

    // 3. Compute Fixed Costs for period
    // Determine days in reference month for fixed cost daily equivalent calculation
    const refDateObj = new Date(startDateStr);
    const refYear = refDateObj.getFullYear();
    const refMonthZero = refDateObj.getMonth();
    const daysInMonth = getDaysInMonth(refYear, refMonthZero);
    const numDaysInPeriod = datesList.length;

    let totalFixedCosts = 0;
    const fixedBreakdown = fixedCosts.map((fc) => {
      const monthlyAmount = fc.amount || 0;
      const dailyEquivalent = parseFloat((monthlyAmount / daysInMonth).toFixed(2));
      let periodAmount = 0;

      if (numDaysInPeriod >= daysInMonth && startDateStr.endsWith('-01')) {
        // Full month or more
        periodAmount = monthlyAmount;
      } else {
        periodAmount = parseFloat((dailyEquivalent * numDaysInPeriod).toFixed(2));
      }

      totalFixedCosts += periodAmount;

      return {
        id: fc.id,
        name: fc.name,
        description: fc.description,
        monthlyAmount,
        dailyEquivalent,
        periodAmount,
        active: fc.active,
      };
    });

    // 4. Compute Percentage Costs for period (calculated using daily sales)
    let totalPercentageCosts = 0;
    const percentageBreakdown = percentageCosts.map((pc) => {
      const pct = pc.percentage || 0;
      let calculatedAmount = 0;

      // Sum of daily sales * pct / 100 for each day
      for (const d of datesList) {
        const dSales = dailySalesMap[d] || 0;
        calculatedAmount += (dSales * pct) / 100;
      }
      calculatedAmount = parseFloat(calculatedAmount.toFixed(2));
      totalPercentageCosts += calculatedAmount;

      return {
        id: pc.id,
        name: pc.name,
        description: pc.description,
        percentage: pct,
        calculatedAmount,
        active: pc.active,
      };
    });

    // 5. Total Calculations
    totalFixedCosts = parseFloat(totalFixedCosts.toFixed(2));
    totalPercentageCosts = parseFloat(totalPercentageCosts.toFixed(2));
    const totalCosts = parseFloat((totalFixedCosts + totalPercentageCosts).toFixed(2));
    const estimatedRemaining = parseFloat((totalSales - totalCosts).toFixed(2));
    const costPercentage = totalSales > 0 ? parseFloat(((totalCosts / totalSales) * 100).toFixed(2)) : 0;

    // 6. Daily Breakdown for selected period
    const dailyBreakdown = datesList.map((d) => {
      const dSales = dailySalesMap[d] || 0;
      
      // Daily fixed costs
      let dFixedCosts = 0;
      const dFixedItems = fixedCosts.map((fc) => {
        const dailyEq = parseFloat(((fc.amount || 0) / daysInMonth).toFixed(2));
        dFixedCosts += dailyEq;
        return { name: fc.name, amount: dailyEq };
      });
      dFixedCosts = parseFloat(dFixedCosts.toFixed(2));

      // Daily percentage costs
      let dPctCosts = 0;
      const dPctItems = percentageCosts.map((pc) => {
        const amt = parseFloat(((dSales * (pc.percentage || 0)) / 100).toFixed(2));
        dPctCosts += amt;
        return { name: pc.name, percentage: pc.percentage, amount: amt };
      });
      dPctCosts = parseFloat(dPctCosts.toFixed(2));

      const dTotalCosts = parseFloat((dFixedCosts + dPctCosts).toFixed(2));
      const dRemaining = parseFloat((dSales - dTotalCosts).toFixed(2));

      return {
        date: d,
        sales: dSales,
        fixedCosts: dFixedCosts,
        percentageCosts: dPctCosts,
        totalCosts: dTotalCosts,
        estimatedRemaining: dRemaining,
        fixedItems: dFixedItems,
        percentageItems: dPctItems,
      };
    });

    return NextResponse.json({
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      daysInMonth,
      totalSales,
      totalFixedCosts,
      totalPercentageCosts,
      totalCosts,
      estimatedRemaining,
      costPercentage,
      costs: allCosts,
      fixedBreakdown,
      percentageBreakdown,
      dailyBreakdown,
    });
  } catch (error) {
    console.error('API Costs GET error:', error);
    return NextResponse.json({ error: 'Failed to calculate costs and expenses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, costType, amount, percentage, active } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Cost name is required' }, { status: 400 });
    }

    if (!['fixed_monthly', 'sales_percentage'].includes(costType)) {
      return NextResponse.json({ error: 'Invalid cost type' }, { status: 400 });
    }

    let parsedAmount: number | null = null;
    let parsedPercentage: number | null = null;

    if (costType === 'fixed_monthly') {
      parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: 'Monthly amount must be greater than 0' }, { status: 400 });
      }
    } else if (costType === 'sales_percentage') {
      parsedPercentage = parseFloat(percentage);
      if (isNaN(parsedPercentage) || parsedPercentage <= 0 || parsedPercentage > 100) {
        return NextResponse.json({ error: 'Percentage must be between 0 and 100' }, { status: 400 });
      }
    }

    const newCost = await prisma.cost.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        costType,
        amount: parsedAmount,
        percentage: parsedPercentage,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: `Added Cost "${newCost.name}"`,
        details: `${costType === 'fixed_monthly' ? `${newCost.amount} ETB/month` : `${newCost.percentage}% of sales`}`,
        type: 'create',
      },
    });

    return NextResponse.json(newCost, { status: 201 });
  } catch (error) {
    console.error('API Costs POST error:', error);
    return NextResponse.json({ error: 'Failed to create cost' }, { status: 500 });
  }
}
