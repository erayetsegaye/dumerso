import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { denyUnlessAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function getLocalDateString(dateObj: Date): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalTimeString(dateObj: Date): string {
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dateObj.getDay()] || 'Unknown';
}

function getMonthName(yearMonthStr: string): string {
  const [yStr, mStr] = yearMonthStr.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const dateObj = new Date(y, m, 1);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[dateObj.getMonth()]} ${y}`;
}

export async function GET(request: Request) {
  try {
    // Full sales history dump: admins only.
    const denied = await denyUnlessAdmin();
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const now = new Date();
    let endDateStr = getLocalDateString(now);
    let startDateStr = endDateStr;

    if (period === 'custom' && startDateParam && endDateParam) {
      startDateStr = startDateParam;
      endDateStr = endDateParam;
    } else if (startDateParam && endDateParam) {
      startDateStr = startDateParam;
      endDateStr = endDateParam;
    } else if (period === 'today') {
      startDateStr = endDateStr;
    } else if (period === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      startDateStr = getLocalDateString(yest);
      endDateStr = startDateStr;
    } else if (period === 'week') {
      const wk = new Date(now);
      wk.setDate(wk.getDate() - 7);
      startDateStr = getLocalDateString(wk);
    } else if (period === '3months') {
      const m3 = new Date(now);
      m3.setMonth(m3.getMonth() - 3);
      startDateStr = getLocalDateString(m3);
    } else if (period === '6months') {
      const m6 = new Date(now);
      m6.setMonth(m6.getMonth() - 6);
      startDateStr = getLocalDateString(m6);
    } else if (period === '1year') {
      const y1 = new Date(now);
      y1.setFullYear(y1.getFullYear() - 1);
      startDateStr = getLocalDateString(y1);
    } else {
      // default 30 days
      const m1 = new Date(now);
      m1.setDate(m1.getDate() - 30);
      startDateStr = getLocalDateString(m1);
    }

    // Fetch database records
    const [menuItems, categories, orders, allCosts] = await Promise.all([
      prisma.menuItem.findMany({ include: { category: true }, orderBy: { name: 'asc' } }),
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
      prisma.order.findMany({
        where: {
          status: 'Completed',
          orderDate: {
            gte: startDateStr,
            lte: endDateStr,
          },
        },
        include: { items: true },
        orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.cost.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    // Validation 1: Calculation Validation (Requirement 22)
    let sumOrdersTotal = 0;
    let sumOrderItemsSubtotal = 0;
    let sumDetailedSalesItemTotal = 0;

    for (const order of orders) {
      sumOrdersTotal += order.totalAmount;
      for (const item of order.items) {
        sumOrderItemsSubtotal += item.subtotal;
        sumDetailedSalesItemTotal += item.unitPrice * item.quantity;
      }
    }

    const diff1 = Math.abs(sumOrdersTotal - sumOrderItemsSubtotal);
    const diff2 = Math.abs(sumOrdersTotal - sumDetailedSalesItemTotal);

    if (orders.length > 0 && (diff1 > 0.05 || diff2 > 0.05)) {
      return NextResponse.json(
        { error: 'Unable to generate report because the sales totals do not match. Please try again or contact the administrator.' },
        { status: 400 }
      );
    }

    // Master Catalog mapping (Current Menu Items + Historical Deleted Items)
    const masterItemsMap: Record<string, {
      id: string;
      name: string;
      categoryName: string;
      defaultPrice: number;
      isAvailable: boolean;
      isDeleted: boolean;
      createdAt: string;
      updatedAt: string;
    }> = {};

    for (const mi of menuItems) {
      masterItemsMap[mi.name] = {
        id: mi.id,
        name: mi.name,
        categoryName: mi.category?.name || 'General',
        defaultPrice: mi.price,
        isAvailable: mi.isAvailable,
        isDeleted: false,
        createdAt: getLocalDateString(new Date(mi.createdAt)),
        updatedAt: getLocalDateString(new Date(mi.updatedAt)),
      };
    }

    for (const order of orders) {
      for (const item of order.items) {
        if (!masterItemsMap[item.itemName]) {
          masterItemsMap[item.itemName] = {
            id: item.menuItemId || `hist-${item.itemName}`,
            name: item.itemName,
            categoryName: item.categoryName || 'General',
            defaultPrice: item.unitPrice,
            isAvailable: false,
            isDeleted: true,
            createdAt: order.orderDate,
            updatedAt: order.orderDate,
          };
        }
      }
    }

    const allMasterItems = Object.values(masterItemsMap).sort((a, b) => a.name.localeCompare(b.name));

    // Dates list in range (Ascending order for daily breakdown)
    const datesListAsc: string[] = [];
    const startObj = new Date(startDateStr);
    const endObj = new Date(endDateStr);
    const curr = new Date(startObj);
    while (curr <= endObj) {
      datesListAsc.push(getLocalDateString(curr));
      curr.setDate(curr.getDate() + 1);
    }

    // Aggregation Maps
    const dailySalesMap: Record<string, { ordersCount: number; itemsSold: number; totalSales: number }> = {};
    const paymentMethodMap: Record<string, { count: number; totalSales: number }> = {
      Cash: { count: 0, totalSales: 0 },
      Telebirr: { count: 0, totalSales: 0 },
      Card: { count: 0, totalSales: 0 },
      Other: { count: 0, totalSales: 0 },
    };
    const categorySalesMap: Record<string, { qty: number; totalSales: number }> = {};
    const itemSalesStatsMap: Record<string, {
      totalQty: number;
      totalSales: number;
      prices: number[];
      daysSoldSet: Set<string>;
      firstSaleDate: string | null;
      lastSaleDate: string | null;
    }> = {};

    for (const masterItem of allMasterItems) {
      itemSalesStatsMap[masterItem.name] = {
        totalQty: 0,
        totalSales: 0,
        prices: [],
        daysSoldSet: new Set(),
        firstSaleDate: null,
        lastSaleDate: null,
      };
    }

    const detailedSalesRows: any[] = [];
    const ordersSheetRows: any[] = [];
    const orderItemsSheetRows: any[] = [];
    let overallTotalSales = 0;
    let overallTotalOrders = orders.length;
    let overallItemsSold = 0;

    for (const order of orders) {
      overallTotalSales += order.totalAmount;

      if (!dailySalesMap[order.orderDate]) {
        dailySalesMap[order.orderDate] = { ordersCount: 0, itemsSold: 0, totalSales: 0 };
      }
      dailySalesMap[order.orderDate].ordersCount += 1;
      dailySalesMap[order.orderDate].totalSales += order.totalAmount;

      // Payment method tracking
      const pm = order.paymentMethod || 'Cash';
      let matchedPmKey = 'Cash';
      if (pm.toLowerCase().includes('telebirr')) matchedPmKey = 'Telebirr';
      else if (pm.toLowerCase().includes('card')) matchedPmKey = 'Card';
      else if (pm.toLowerCase().includes('other')) matchedPmKey = 'Other';

      paymentMethodMap[matchedPmKey].count += 1;
      paymentMethodMap[matchedPmKey].totalSales += order.totalAmount;

      // 5. Orders Sheet Row
      ordersSheetRows.push({
        'Order ID': order.id,
        'Order Number': order.orderNumber,
        'Date': order.orderDate,
        'Time': order.orderTime,
        'Total Amount': `${order.totalAmount.toFixed(2)} ETB`,
        'Payment Method': order.paymentMethod || 'Cash',
        'Status': order.status,
        'Created At': new Date(order.createdAt).toISOString().replace('T', ' ').slice(0, 19),
      });

      for (const item of order.items) {
        overallItemsSold += item.quantity;
        dailySalesMap[order.orderDate].itemsSold += item.quantity;

        const itemTotal = parseFloat((item.unitPrice * item.quantity).toFixed(2));

        // 2. Detailed Sales Sheet Row (Every sold item has its own row)
        detailedSalesRows.push({
          'Date': order.orderDate,
          'Time': order.orderTime,
          'Order Number': order.orderNumber,
          'Item Name': item.itemName,
          'Category': item.categoryName || 'General',
          'Unit Price': `${item.unitPrice.toFixed(2)} ETB`,
          'Quantity': item.quantity,
          'Item Total': `${itemTotal.toFixed(2)} ETB`,
          'Payment Method': order.paymentMethod || 'Cash',
          'Order Total': `${order.totalAmount.toFixed(2)} ETB`,
          'Status': order.status,
        });

        // 6. Order Items Sheet Row
        orderItemsSheetRows.push({
          'Order ID': order.id,
          'Order Number': order.orderNumber,
          'Item ID': item.menuItemId || 'N/A',
          'Item Name': item.itemName,
          'Category': item.categoryName || 'General',
          'Quantity': item.quantity,
          'Historical Unit Price': `${item.unitPrice.toFixed(2)} ETB`,
          'Subtotal': `${item.subtotal.toFixed(2)} ETB`,
          'Order Date': order.orderDate,
          'Order Time': order.orderTime,
        });

        const catName = item.categoryName || 'General';
        if (!categorySalesMap[catName]) {
          categorySalesMap[catName] = { qty: 0, totalSales: 0 };
        }
        categorySalesMap[catName].qty += item.quantity;
        categorySalesMap[catName].totalSales += item.subtotal;

        if (itemSalesStatsMap[item.itemName]) {
          const stats = itemSalesStatsMap[item.itemName];
          stats.totalQty += item.quantity;
          stats.totalSales += item.subtotal;
          stats.prices.push(item.unitPrice);
          stats.daysSoldSet.add(order.orderDate);
          if (!stats.firstSaleDate || order.orderDate < stats.firstSaleDate) {
            stats.firstSaleDate = order.orderDate;
          }
          if (!stats.lastSaleDate || order.orderDate > stats.lastSaleDate) {
            stats.lastSaleDate = order.orderDate;
          }
        }
      }
    }

    // Monthly aggregation maps
    const monthlyMap: Record<string, { monthStr: string; sales: number; orders: number; itemsSold: number }> = {};
    const monthlyItemMap: Record<string, Record<string, { qty: number; sales: number }>> = {};

    let highestSalesDay = { date: 'N/A', sales: 0 };
    let lowestSalesDay = { date: 'N/A', sales: Infinity };

    for (const d of datesListAsc) {
      const dayData = dailySalesMap[d] || { ordersCount: 0, itemsSold: 0, totalSales: 0 };
      const dSales = dayData.totalSales;

      if (dSales > highestSalesDay.sales) {
        highestSalesDay = { date: d, sales: dSales };
      }
      if (dSales < lowestSalesDay.sales) {
        lowestSalesDay = { date: d, sales: dSales };
      }

      const ym = d.slice(0, 7);
      if (!monthlyMap[ym]) {
        monthlyMap[ym] = { monthStr: ym, sales: 0, orders: 0, itemsSold: 0 };
      }
      monthlyMap[ym].sales += dSales;
      monthlyMap[ym].orders += dayData.ordersCount;
      monthlyMap[ym].itemsSold += dayData.itemsSold;

      if (!monthlyItemMap[ym]) {
        monthlyItemMap[ym] = {};
      }
    }

    for (const order of orders) {
      const ym = order.orderDate.slice(0, 7);
      if (!monthlyItemMap[ym]) monthlyItemMap[ym] = {};
      for (const item of order.items) {
        if (!monthlyItemMap[ym][item.itemName]) {
          monthlyItemMap[ym][item.itemName] = { qty: 0, sales: 0 };
        }
        monthlyItemMap[ym][item.itemName].qty += item.quantity;
        monthlyItemMap[ym][item.itemName].sales += item.subtotal;
      }
    }

    if (lowestSalesDay.sales === Infinity) lowestSalesDay = { date: 'N/A', sales: 0 };

    const activeDaysCount = datesListAsc.length;
    const avgDailySales = activeDaysCount > 0 ? parseFloat((overallTotalSales / activeDaysCount).toFixed(2)) : 0;
    const avgOrderValue = overallTotalOrders > 0 ? parseFloat((overallTotalSales / overallTotalOrders).toFixed(2)) : 0;
    const avgDailyOrders = activeDaysCount > 0 ? parseFloat((overallTotalOrders / activeDaysCount).toFixed(2)) : 0;

    // 1. Sales Summary Sheet Data
    const salesSummaryRows = [
      { Metric: 'BUSINESS NAME', Value: 'DUMERSO COFFEE' },
      { Metric: 'REPORT TITLE', Value: 'Complete Business Sales & Financial Report' },
      { Metric: 'REPORT PERIOD', Value: `${startDateStr} to ${endDateStr}` },
      { Metric: 'GENERATED DATE', Value: getLocalDateString(now) },
      { Metric: 'GENERATED TIME', Value: getLocalTimeString(now) },
      { Metric: 'CURRENCY', Value: 'ETB (Ethiopian Birr)' },
      { Metric: '----------------------------------------', Value: '----------------------------------------' },
      { Metric: 'Total Sales', Value: `${overallTotalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` },
      { Metric: 'Total Orders', Value: overallTotalOrders.toLocaleString() },
      { Metric: 'Total Items Sold', Value: overallItemsSold.toLocaleString() },
      { Metric: 'Average Order Value', Value: `${avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` },
      { Metric: 'Average Daily Sales', Value: `${avgDailySales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` },
      { Metric: 'Average Daily Orders', Value: avgDailyOrders.toFixed(2) },
      { Metric: '----------------------------------------', Value: '----------------------------------------' },
      { Metric: 'Cash Sales', Value: `${paymentMethodMap.Cash.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` },
      { Metric: 'Telebirr Sales', Value: `${paymentMethodMap.Telebirr.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` },
      { Metric: 'Card Sales', Value: `${paymentMethodMap.Card.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` },
      { Metric: 'Other Sales', Value: `${paymentMethodMap.Other.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` },
      { Metric: '----------------------------------------', Value: '----------------------------------------' },
      { Metric: 'Top Selling Item', Value: 'Calculated in Item Breakdown' },
      { Metric: 'Top Selling Category', Value: 'Calculated in Category Sales' },
      { Metric: 'Highest Sales Day', Value: `${highestSalesDay.date} (${highestSalesDay.sales.toLocaleString()} ETB)` },
      { Metric: 'Lowest Sales Day', Value: `${lowestSalesDay.date} (${lowestSalesDay.sales.toLocaleString()} ETB)` },
    ];

    // 3. Daily Sales Summary Sheet Data (Requirement 5)
    const dailySalesSummaryRows: any[] = [];
    let summaryGrandOrders = 0;
    let summaryGrandItems = 0;
    let summaryGrandSales = 0;

    for (const d of datesListAsc) {
      const dayData = dailySalesMap[d] || { ordersCount: 0, itemsSold: 0, totalSales: 0 };
      summaryGrandOrders += dayData.ordersCount;
      summaryGrandItems += dayData.itemsSold;
      summaryGrandSales += dayData.totalSales;

      dailySalesSummaryRows.push({
        'Date': d,
        'Total Orders': dayData.ordersCount,
        'Total Items Sold': dayData.itemsSold,
        'Total Sales': `${dayData.totalSales.toFixed(2)} ETB`,
        'Daily Total Note': `DAILY TOTAL SALES: ${dayData.totalSales.toFixed(2)} ETB`,
      });
    }

    summaryGrandSales = parseFloat(summaryGrandSales.toFixed(2));
    dailySalesSummaryRows.push({
      'Date': '----------------------------------------',
      'Total Orders': '--------------------',
      'Total Items Sold': '--------------------',
      'Total Sales': '--------------------',
      'Daily Total Note': '--------------------',
    });
    dailySalesSummaryRows.push({
      'Date': 'GRAND TOTAL',
      'Total Orders': summaryGrandOrders,
      'Total Items Sold': summaryGrandItems,
      'Total Sales': `${summaryGrandSales.toFixed(2)} ETB`,
      'Daily Total Note': `GRAND TOTAL SALES: ${summaryGrandSales.toFixed(2)} ETB`,
    });

    // 4. Daily Item Sales Sheet Data (Requirement 6 - EVERY DAY & EVERY MENU ITEM)
    const dailyItemSalesRows: any[] = [];
    let dailyItemGrandQty = 0;
    let dailyItemGrandSales = 0;

    for (const d of datesListAsc) {
      const dayOrders = orders.filter((o) => o.orderDate === d);
      const dayItemPriceMap: Record<string, Record<string, { qty: number; sales: number }>> = {};

      for (const masterItem of allMasterItems) {
        dayItemPriceMap[masterItem.name] = {};
      }

      for (const order of dayOrders) {
        for (const item of order.items) {
          if (!dayItemPriceMap[item.itemName]) {
            dayItemPriceMap[item.itemName] = {};
          }
          const priceKey = item.unitPrice.toFixed(2);
          if (!dayItemPriceMap[item.itemName][priceKey]) {
            dayItemPriceMap[item.itemName][priceKey] = { qty: 0, sales: 0 };
          }
          dayItemPriceMap[item.itemName][priceKey].qty += item.quantity;
          dayItemPriceMap[item.itemName][priceKey].sales += item.subtotal;
        }
      }

      // Add Header for Day
      dailyItemSalesRows.push({
        'Date': `Date: ${d} (${getDayName(d)})`,
        'Item Name': '',
        'Category': '',
        'Unit Price': '',
        'Quantity Sold': '',
        'Total Sales': '',
      });

      let dayTotalQty = 0;
      let dayTotalSales = 0;

      for (const masterItem of allMasterItems) {
        const priceEntries = Object.entries(dayItemPriceMap[masterItem.name] || {});
        const activeEntries = priceEntries.filter(([_, data]) => data.qty > 0);

        if (activeEntries.length === 0) {
          dailyItemSalesRows.push({
            'Date': d,
            'Item Name': masterItem.name,
            'Category': masterItem.categoryName,
            'Unit Price': `${masterItem.defaultPrice.toFixed(2)} ETB`,
            'Quantity Sold': 0,
            'Total Sales': '0.00 ETB',
          });
        } else {
          for (const [pStr, data] of activeEntries) {
            const uPrice = parseFloat(pStr);
            const itemSales = parseFloat(data.sales.toFixed(2));
            dayTotalQty += data.qty;
            dayTotalSales += itemSales;

            dailyItemSalesRows.push({
              'Date': d,
              'Item Name': masterItem.name,
              'Category': masterItem.categoryName,
              'Unit Price': `${uPrice.toFixed(2)} ETB`,
              'Quantity Sold': data.qty,
              'Total Sales': `${itemSales.toFixed(2)} ETB`,
            });
          }
        }
      }

      dayTotalSales = parseFloat(dayTotalSales.toFixed(2));
      dailyItemGrandQty += dayTotalQty;
      dailyItemGrandSales += dayTotalSales;

      // Daily Total Row
      dailyItemSalesRows.push({
        'Date': `TOTAL FOR ${d}`,
        'Item Name': 'DAILY SUMMARY',
        'Category': '',
        'Unit Price': '',
        'Quantity Sold': dayTotalQty,
        'Total Sales': `${dayTotalSales.toFixed(2)} ETB`,
      });

      // Blank Separator
      dailyItemSalesRows.push({
        'Date': '',
        'Item Name': '',
        'Category': '',
        'Unit Price': '',
        'Quantity Sold': '',
        'Total Sales': '',
      });
    }

    dailyItemGrandSales = parseFloat(dailyItemGrandSales.toFixed(2));

    dailyItemSalesRows.push({
      'Date': '========================================',
      'Item Name': '====================',
      'Category': '====================',
      'Unit Price': '====================',
      'Quantity Sold': '====================',
      'Total Sales': '====================',
    });
    dailyItemSalesRows.push({
      'Date': 'GRAND TOTAL QUANTITY SOLD',
      'Item Name': '',
      'Category': '',
      'Unit Price': '',
      'Quantity Sold': dailyItemGrandQty,
      'Total Sales': '',
    });
    dailyItemSalesRows.push({
      'Date': 'GRAND TOTAL SALES',
      'Item Name': '',
      'Category': '',
      'Unit Price': '',
      'Quantity Sold': '',
      'Total Sales': `${dailyItemGrandSales.toFixed(2)} ETB`,
    });

    // 7. Menu Items Sheet Data (Requirement 10)
    const menuItemsSheetRows = allMasterItems.map((item) => ({
      'Item ID': item.id,
      'Item Name': item.name,
      'Category': item.categoryName,
      'Current Price': `${item.defaultPrice.toFixed(2)} ETB`,
      'Availability': item.isDeleted ? 'Deleted (Historical)' : (item.isAvailable ? 'Available' : 'Unavailable'),
      'Created Date': item.createdAt,
      'Updated Date': item.updatedAt,
    }));

    // 8. Category Sales Sheet Data (Requirement 11)
    const categorySalesSheetRows = categories.map((cat) => {
      const catSalesData = categorySalesMap[cat.name] || { qty: 0, totalSales: 0 };
      const catSales = parseFloat(catSalesData.totalSales.toFixed(2));
      const pctSales = overallTotalSales > 0 ? parseFloat(((catSales / overallTotalSales) * 100).toFixed(2)) : 0;

      return {
        'Category': cat.name,
        'Total Quantity Sold': catSalesData.qty,
        'Total Sales': `${catSales.toFixed(2)} ETB`,
        'Percentage of Total Sales': `${pctSales.toFixed(2)}%`,
      };
    });

    if (categorySalesSheetRows.length > 0) {
      const topCat = [...categorySalesSheetRows].sort((a, b) => parseFloat(b['Total Sales']) - parseFloat(a['Total Sales']))[0];
      if (topCat) {
        const topIndex = salesSummaryRows.findIndex(r => r.Metric === 'Top Selling Category');
        if (topIndex !== -1) salesSummaryRows[topIndex].Value = topCat['Category'];
      }
    }

    // 9. Payment Methods Sheet Data (Requirement 12)
    const paymentMethodsSheetRows = Object.entries(paymentMethodMap).map(([pmName, stats]) => {
      const pct = overallTotalSales > 0 ? parseFloat(((stats.totalSales / overallTotalSales) * 100).toFixed(2)) : 0;
      return {
        'Payment Method': pmName,
        'Number of Orders': stats.count,
        'Total Sales': `${stats.totalSales.toFixed(2)} ETB`,
        'Percentage': `${pct.toFixed(2)}%`,
      };
    });

    // 10. Best Selling Items & Unsold Items & Item Sales Summary
    const itemSalesSummaryRows: any[] = [];
    const bestSellingItemsRows: any[] = [];
    const unsoldItemsRows: any[] = [];

    const sortedBySalesItems = allMasterItems.map((masterItem) => {
      const stats = itemSalesStatsMap[masterItem.name] || {
        totalQty: 0,
        totalSales: 0,
        prices: [],
        daysSoldSet: new Set(),
        firstSaleDate: null,
        lastSaleDate: null,
      };

      const totalQty = stats.totalQty;
      const totalSales = parseFloat(stats.totalSales.toFixed(2));
      const avgPrice = stats.prices.length > 0
        ? parseFloat((stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length).toFixed(2))
        : masterItem.defaultPrice;
      const pctSales = overallTotalSales > 0 ? parseFloat(((totalSales / overallTotalSales) * 100).toFixed(2)) : 0;
      const daysSold = stats.daysSoldSet.size;
      const daysNotSold = Math.max(0, activeDaysCount - daysSold);

      return {
        id: masterItem.id,
        name: masterItem.name,
        category: masterItem.categoryName,
        totalQty,
        totalSales,
        avgPrice,
        pctSales,
        daysSold,
        daysNotSold,
        firstSaleDate: stats.firstSaleDate || 'N/A',
        lastSaleDate: stats.lastSaleDate || 'N/A',
        currentPrice: masterItem.defaultPrice,
        isAvailable: masterItem.isAvailable ? 'Available' : 'Unavailable',
      };
    }).sort((a, b) => b.totalQty - a.totalQty || b.totalSales - a.totalSales);

    let rankCounter = 1;
    if (sortedBySalesItems.length > 0 && sortedBySalesItems[0].totalSales > 0) {
      const topItemIndex = salesSummaryRows.findIndex(r => r.Metric === 'Top Selling Item');
      if (topItemIndex !== -1) salesSummaryRows[topItemIndex].Value = sortedBySalesItems[0].name;
    }

    for (const item of sortedBySalesItems) {
      itemSalesSummaryRows.push({
        'Item ID': item.id,
        'Item Name': item.name,
        'Category': item.category,
        'Total Quantity Sold': item.totalQty,
        'Total Sales': `${item.totalSales.toFixed(2)} ETB`,
        'Average Unit Price': `${item.avgPrice.toFixed(2)} ETB`,
        'Percentage of Total Sales': `${item.pctSales.toFixed(2)}%`,
        'Number of Days Sold': item.daysSold,
        'Number of Days Not Sold': item.daysNotSold,
        'First Sale Date': item.firstSaleDate,
        'Last Sale Date': item.lastSaleDate,
        'Current Price': `${item.currentPrice.toFixed(2)} ETB`,
        'Current Availability': item.isAvailable,
      });

      if (item.totalQty > 0) {
        bestSellingItemsRows.push({
          'Rank': rankCounter++,
          'Item Name': item.name,
          'Category': item.category,
          'Quantity Sold': item.totalQty,
          'Total Sales': `${item.totalSales.toFixed(2)} ETB`,
          'Percentage of Sales': `${item.pctSales.toFixed(2)}%`,
        });
      } else {
        unsoldItemsRows.push({
          'Item Name': item.name,
          'Category': item.category,
          'Current Price': `${item.currentPrice.toFixed(2)} ETB`,
          'Quantity Sold': 0,
          'Total Sales': '0.00 ETB',
        });
      }
    }

    // 11. Monthly Sales Sheet Data (Requirement 15)
    const monthlySalesSheetRows = Object.values(monthlyMap)
      .sort((a, b) => a.monthStr.localeCompare(b.monthStr))
      .map((m) => ({
        'Month': getMonthName(m.monthStr),
        'Total Orders': m.orders,
        'Total Items Sold': m.itemsSold,
        'Total Sales': `${m.sales.toFixed(2)} ETB`,
      }));

    // 12. Monthly Item Sales Sheet Data (Requirement 16)
    const monthlyItemSalesRows: any[] = [];
    const sortedMonths = Object.keys(monthlyItemMap).sort();

    for (const ym of sortedMonths) {
      const monthNameStr = getMonthName(ym);
      const mItems = monthlyItemMap[ym] || {};

      for (const masterItem of allMasterItems) {
        const itemStats = mItems[masterItem.name] || { qty: 0, sales: 0 };
        monthlyItemSalesRows.push({
          'Month': monthNameStr,
          'Item Name': masterItem.name,
          'Category': masterItem.categoryName,
          'Quantity Sold': itemStats.qty,
          'Total Sales': `${itemStats.sales.toFixed(2)} ETB`,
        });
      }
    }

    // 13. Costs & Expenses Sheet Data (Requirement 17)
    const activeCosts = allCosts.filter((c) => c.active);
    const fixedCosts = activeCosts.filter((c) => c.costType === 'fixed_monthly');
    const percentageCosts = activeCosts.filter((c) => c.costType === 'sales_percentage');

    const costsAndExpensesRows = allCosts.map((c) => ({
      'Date': getLocalDateString(new Date(c.createdAt)),
      'Cost Name': c.name,
      'Description': c.description || 'N/A',
      'Cost Type': c.costType === 'fixed_monthly' ? 'Fixed Monthly' : 'Sales Percentage',
      'Amount': c.amount ? `${c.amount.toFixed(2)} ETB` : 'N/A',
      'Percentage': c.percentage ? `${c.percentage.toFixed(2)}%` : 'N/A',
      'Calculated Cost': c.costType === 'fixed_monthly' ? `${(c.amount || 0).toFixed(2)} ETB/mo` : `${c.percentage}% of sales`,
      'Status': c.active ? 'Active' : 'Inactive',
    }));

    // 14. Daily Financial Report Sheet Data (Requirement 18)
    const dailyFinancialReportRows: any[] = [];
    let totalPeriodSales = 0;
    let totalPeriodFixedCosts = 0;
    let totalPeriodPctCosts = 0;
    let totalPeriodCosts = 0;
    let totalPeriodRemaining = 0;

    for (const d of datesListAsc) {
      const dSales = (dailySalesMap[d] || { totalSales: 0 }).totalSales;

      const [y, mStr] = d.split('-').map(Number);
      const daysInM = getDaysInMonth(y, mStr - 1);

      let dFixedCosts = 0;
      for (const fc of fixedCosts) {
        dFixedCosts += (fc.amount || 0) / daysInM;
      }
      dFixedCosts = parseFloat(dFixedCosts.toFixed(2));

      let dPctCosts = 0;
      for (const pc of percentageCosts) {
        dPctCosts += (dSales * (pc.percentage || 0)) / 100;
      }
      dPctCosts = parseFloat(dPctCosts.toFixed(2));

      const dTotalCosts = parseFloat((dFixedCosts + dPctCosts).toFixed(2));
      const dRemaining = parseFloat((dSales - dTotalCosts).toFixed(2));

      totalPeriodSales += dSales;
      totalPeriodFixedCosts += dFixedCosts;
      totalPeriodPctCosts += dPctCosts;
      totalPeriodCosts += dTotalCosts;
      totalPeriodRemaining += dRemaining;

      dailyFinancialReportRows.push({
        'Date': d,
        'Total Sales': `${dSales.toFixed(2)} ETB`,
        'Fixed Daily Costs': `${dFixedCosts.toFixed(2)} ETB`,
        'Percentage Costs': `${dPctCosts.toFixed(2)} ETB`,
        'Total Costs': `${dTotalCosts.toFixed(2)} ETB`,
        'Estimated Remaining': `${dRemaining.toFixed(2)} ETB`,
      });
    }

    dailyFinancialReportRows.push({
      'Date': '----------------------------------------',
      'Total Sales': '--------------------',
      'Fixed Daily Costs': '--------------------',
      'Percentage Costs': '--------------------',
      'Total Costs': '--------------------',
      'Estimated Remaining': '--------------------',
    });
    dailyFinancialReportRows.push({
      'Date': 'TOTAL FOR PERIOD',
      'Total Sales': `${totalPeriodSales.toFixed(2)} ETB`,
      'Fixed Daily Costs': `${totalPeriodFixedCosts.toFixed(2)} ETB`,
      'Percentage Costs': `${totalPeriodPctCosts.toFixed(2)} ETB`,
      'Total Costs': `${totalPeriodCosts.toFixed(2)} ETB`,
      'Estimated Remaining': `${totalPeriodRemaining.toFixed(2)} ETB`,
    });

    // 15. Monthly Financial Report Sheet Data (Requirement 19)
    const monthlyFinancialReportRows: any[] = [];
    const sortedMonthsList = Object.keys(monthlyMap).sort();

    for (const ym of sortedMonthsList) {
      const mData = monthlyMap[ym];
      const mSales = mData.sales;

      let mFixedCosts = 0;
      for (const fc of fixedCosts) {
        mFixedCosts += fc.amount || 0;
      }
      mFixedCosts = parseFloat(mFixedCosts.toFixed(2));

      let mPctCosts = 0;
      for (const pc of percentageCosts) {
        mPctCosts += (mSales * (pc.percentage || 0)) / 100;
      }
      mPctCosts = parseFloat(mPctCosts.toFixed(2));

      const mTotalCosts = parseFloat((mFixedCosts + mPctCosts).toFixed(2));
      const mRemaining = parseFloat((mSales - mTotalCosts).toFixed(2));
      const costPct = mSales > 0 ? parseFloat(((mTotalCosts / mSales) * 100).toFixed(2)) : 0;

      monthlyFinancialReportRows.push({
        'Month': getMonthName(ym),
        'Total Sales': `${mSales.toFixed(2)} ETB`,
        'Fixed Costs': `${mFixedCosts.toFixed(2)} ETB`,
        'Percentage Costs': `${mPctCosts.toFixed(2)} ETB`,
        'Total Costs': `${mTotalCosts.toFixed(2)} ETB`,
        'Estimated Remaining': `${mRemaining.toFixed(2)} ETB`,
        'Cost Percentage': `${costPct.toFixed(2)}%`,
      });
    }

    // Return complete JSON sheets
    return NextResponse.json({
      period,
      startDate: startDateStr,
      endDate: endDateStr,
      preview: {
        totalSales: overallTotalSales,
        totalOrders: overallTotalOrders,
        itemsSold: overallItemsSold,
        avgOrderValue,
      },
      sheets: {
        salesSummary: salesSummaryRows,
        detailedSales: detailedSalesRows,
        dailySalesSummary: dailySalesSummaryRows,
        dailyItemSales: dailyItemSalesRows,
        orders: ordersSheetRows,
        orderItems: orderItemsSheetRows,
        menuItems: menuItemsSheetRows,
        categorySales: categorySalesSheetRows,
        paymentMethods: paymentMethodsSheetRows,
        bestSellingItems: bestSellingItemsRows,
        unsoldItems: unsoldItemsRows,
        monthlySales: monthlySalesSheetRows,
        monthlyItemSales: monthlyItemSalesRows,
        costsAndExpenses: costsAndExpensesRows,
        dailyFinancialReport: dailyFinancialReportRows,
        monthlyFinancialReport: monthlyFinancialReportRows,
        itemSalesSummary: itemSalesSummaryRows,
      },
    });
  } catch (error) {
    console.error('API Export GET error:', error);
    return NextResponse.json({ error: 'Failed to generate complete business export data' }, { status: 500 });
  }
}
