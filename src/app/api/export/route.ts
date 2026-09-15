import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Date helpers
// Orders store `orderDate` as a local YYYY-MM-DD string, so every range here is
// built from local dates and compared as strings. Never use `new Date('YYYY-MM-DD')`
// (that parses as UTC midnight and shifts the day in some time zones).
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const QUARTER_RE = /^\d{4}-Q[1-4]$/i;
const YEAR_RE = /^\d{4}$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeStr(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Strict local-date parser. Returns null for bad format or impossible dates (e.g. 2026-02-31). */
function parseDateStr(value: string | null | undefined): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return toDateStr(dateObj) === value ? dateObj : null;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

function getDayName(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return d ? DAY_NAMES[d.getDay()] : 'Unknown';
}

function getMonthName(yearMonthStr: string): string {
  const [yStr, mStr] = yearMonthStr.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  return `${MONTH_NAMES[m] || 'Unknown'} ${y}`;
}

function formatLongDate(dateStr: string): string {
  const d = parseDateStr(dateStr);
  if (!d) return dateStr;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}

/** Fraction of `part` in `whole` (0..1), rounded to 4 decimals so Excel shows a clean 0.00%. */
function ratio(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 10000) / 10000;
}

function listDates(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = parseDateStr(startDateStr);
  const end = parseDateStr(endDateStr);
  if (!start || !end) return dates;
  let curr = start;
  while (toDateStr(curr) <= toDateStr(end)) {
    dates.push(toDateStr(curr));
    curr = addDays(curr, 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Period resolution
// ---------------------------------------------------------------------------

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

interface ResolvedPeriod {
  periodType: PeriodType;
  /** Compact identifier used in the file name, e.g. 2026-09, 2026-Q3, 2026 */
  periodKey: string;
  /** Human readable label, e.g. "September 2026" */
  periodLabel: string;
  reportTitle: string;
  startDate: string;
  /** Last day that actually contains data (never later than today). */
  endDate: string;
  /** Natural end of the period before clamping to today. */
  periodEndDate: string;
  fileName: string;
}

const PERIOD_TITLES: Record<PeriodType, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  custom: 'Custom Range',
};

/**
 * Supported query strings:
 *   period=daily&date=YYYY-MM-DD          (default: today)
 *   period=weekly&date=YYYY-MM-DD         Monday..Sunday of the week containing `date` (default: this week)
 *   period=monthly&month=YYYY-MM          (default: this month)
 *   period=quarterly&quarter=YYYY-Qn      (default: this quarter)
 *   period=yearly&year=YYYY               (default: this year)
 *   period=custom&startDate=..&endDate=..
 * Legacy values used by the on-screen report tabs are still accepted:
 *   today, yesterday, week (last 7 days), month (last 30 days), 3months, 6months, 1year
 */
function resolvePeriod(params: URLSearchParams, now: Date): ResolvedPeriod | { error: string } {
  const todayStr = toDateStr(now);
  const requested = (params.get('period') || 'monthly').toLowerCase();

  let periodType: PeriodType;
  let startDate: string;
  let periodEndDate: string;
  let periodKey: string;
  let periodLabel: string;

  switch (requested) {
    case 'daily':
    case 'today':
    case 'yesterday': {
      let day: Date | null;
      if (requested === 'today') {
        day = new Date(now);
      } else if (requested === 'yesterday') {
        day = addDays(now, -1);
      } else {
        const raw = params.get('date');
        day = raw ? parseDateStr(raw) : new Date(now);
        if (!day) return { error: 'Invalid date. Use the format YYYY-MM-DD.' };
      }
      periodType = 'daily';
      startDate = toDateStr(day);
      periodEndDate = startDate;
      periodKey = startDate;
      periodLabel = `${getDayName(startDate)}, ${formatLongDate(startDate)}`;
      break;
    }

    case 'weekly': {
      const raw = params.get('date');
      const anchor = raw ? parseDateStr(raw) : new Date(now);
      if (!anchor) return { error: 'Invalid date. Use the format YYYY-MM-DD.' };
      const offsetFromMonday = (anchor.getDay() + 6) % 7;
      const monday = addDays(anchor, -offsetFromMonday);
      const sunday = addDays(monday, 6);
      periodType = 'weekly';
      startDate = toDateStr(monday);
      periodEndDate = toDateStr(sunday);
      periodKey = `${startDate}_to_${periodEndDate}`;
      periodLabel = `Week of ${formatLongDate(startDate)} to ${formatLongDate(periodEndDate)}`;
      break;
    }

    case 'monthly': {
      const raw = params.get('month');
      let year = now.getFullYear();
      let month0 = now.getMonth();
      if (raw) {
        if (!MONTH_RE.test(raw)) return { error: 'Invalid month. Use the format YYYY-MM.' };
        const [y, m] = raw.split('-').map(Number);
        if (m < 1 || m > 12) return { error: 'Invalid month. Use the format YYYY-MM.' };
        year = y;
        month0 = m - 1;
      }
      periodType = 'monthly';
      startDate = `${year}-${pad2(month0 + 1)}-01`;
      periodEndDate = `${year}-${pad2(month0 + 1)}-${pad2(getDaysInMonth(year, month0))}`;
      periodKey = `${year}-${pad2(month0 + 1)}`;
      periodLabel = `${MONTH_NAMES[month0]} ${year}`;
      break;
    }

    case 'quarterly': {
      const raw = params.get('quarter');
      let year = now.getFullYear();
      let quarter = Math.floor(now.getMonth() / 3) + 1;
      if (raw) {
        if (!QUARTER_RE.test(raw)) return { error: 'Invalid quarter. Use the format YYYY-Q1 to YYYY-Q4.' };
        year = Number(raw.slice(0, 4));
        quarter = Number(raw.slice(-1));
      }
      const firstMonth0 = (quarter - 1) * 3;
      const lastMonth0 = firstMonth0 + 2;
      periodType = 'quarterly';
      startDate = `${year}-${pad2(firstMonth0 + 1)}-01`;
      periodEndDate = `${year}-${pad2(lastMonth0 + 1)}-${pad2(getDaysInMonth(year, lastMonth0))}`;
      periodKey = `${year}-Q${quarter}`;
      periodLabel = `Q${quarter} ${year} (${MONTH_NAMES[firstMonth0]} to ${MONTH_NAMES[lastMonth0]} ${year})`;
      break;
    }

    case 'yearly': {
      const raw = params.get('year');
      let year = now.getFullYear();
      if (raw) {
        if (!YEAR_RE.test(raw)) return { error: 'Invalid year. Use the format YYYY.' };
        year = Number(raw);
      }
      periodType = 'yearly';
      startDate = `${year}-01-01`;
      periodEndDate = `${year}-12-31`;
      periodKey = `${year}`;
      periodLabel = `Year ${year}`;
      break;
    }

    case 'custom': {
      const start = parseDateStr(params.get('startDate'));
      const end = parseDateStr(params.get('endDate'));
      if (!start || !end) {
        return { error: 'A custom range needs both a start date and an end date (YYYY-MM-DD).' };
      }
      let s = toDateStr(start);
      let e = toDateStr(end);
      if (s > e) [s, e] = [e, s];
      periodType = 'custom';
      startDate = s;
      periodEndDate = e;
      periodKey = `${s}_to_${e}`;
      periodLabel = `${formatLongDate(s)} to ${formatLongDate(e)}`;
      break;
    }

    // Legacy rolling windows (kept for the on-screen report, which shares this endpoint).
    case 'week':
    case 'month':
    case '3months':
    case '6months':
    case '1year': {
      let start: Date;
      if (requested === 'week') start = addDays(now, -6);
      else if (requested === 'month') start = addDays(now, -29);
      else {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (requested === '3months') start.setMonth(start.getMonth() - 3);
        else if (requested === '6months') start.setMonth(start.getMonth() - 6);
        else start.setFullYear(start.getFullYear() - 1);
      }
      periodType = 'custom';
      startDate = toDateStr(start);
      periodEndDate = todayStr;
      periodKey = `${startDate}_to_${todayStr}`;
      periodLabel = `${formatLongDate(startDate)} to ${formatLongDate(todayStr)}`;
      break;
    }

    default:
      return { error: `Unknown period "${requested}". Use daily, weekly, monthly, quarterly, yearly or custom.` };
  }

  if (startDate > todayStr) {
    return { error: `The selected period starts in the future (${formatLongDate(startDate)}), so there is no sales data for it yet.` };
  }

  const endDate = periodEndDate > todayStr ? todayStr : periodEndDate;
  const title = PERIOD_TITLES[periodType];

  return {
    periodType,
    periodKey,
    periodLabel,
    reportTitle: `${title} Sales & Financial Report`,
    startDate,
    endDate,
    periodEndDate,
    fileName: `Dumerso_Coffee_${title.replace(/\s+/g, '_')}_Report_${periodKey}.xlsx`,
  };
}

// ---------------------------------------------------------------------------
// Workbook layout metadata
// The client builds the .xlsx from this: sheet order, number formats per column
// (so amounts are real numbers the user can edit and total in Excel) and which
// total rows should become live SUM formulas.
// ---------------------------------------------------------------------------

type ColumnFormat = 'currency' | 'percent' | 'integer' | 'decimal';

interface SheetSpec {
  key: string;
  title: string;
  formats?: Record<string, ColumnFormat>;
  /** Sales Summary style sheet: Metric / Value / Unit, formatted per row by Unit. */
  keyValue?: boolean;
  /** Flat table: turn on Excel filter arrows on the header row. */
  autofilter?: boolean;
  /** First-column label of the total row whose `sumColumns` become SUM formulas. */
  totalLabel?: string;
  sumColumns?: string[];
}

const WORKBOOK_SPEC: SheetSpec[] = [
  { key: 'salesSummary', title: 'Sales Summary', keyValue: true },
  {
    key: 'detailedSales', title: 'Detailed Sales', autofilter: true,
    formats: { 'Unit Price': 'currency', 'Quantity': 'integer', 'Item Total': 'currency', 'Order Total': 'currency' },
  },
  {
    key: 'dailySalesSummary', title: 'Daily Sales Summary',
    formats: { 'Total Orders': 'integer', 'Total Items Sold': 'integer', 'Total Sales': 'currency', 'Average Order Value': 'currency' },
    totalLabel: 'GRAND TOTAL', sumColumns: ['Total Orders', 'Total Items Sold', 'Total Sales'],
  },
  {
    key: 'dailyItemSales', title: 'Daily Item Sales',
    formats: { 'Unit Price': 'currency', 'Quantity Sold': 'integer', 'Total Sales': 'currency' },
  },
  { key: 'orders', title: 'Orders', autofilter: true, formats: { 'Total Amount': 'currency' } },
  {
    key: 'orderItems', title: 'Order Items', autofilter: true,
    formats: { 'Quantity': 'integer', 'Historical Unit Price': 'currency', 'Subtotal': 'currency' },
  },
  { key: 'menuItems', title: 'Menu Items', autofilter: true, formats: { 'Current Price': 'currency' } },
  {
    key: 'categorySales', title: 'Category Sales',
    formats: { 'Total Quantity Sold': 'integer', 'Total Sales': 'currency', 'Percentage of Total Sales': 'percent' },
  },
  {
    key: 'paymentMethods', title: 'Payment Methods',
    formats: { 'Number of Orders': 'integer', 'Total Sales': 'currency', 'Percentage': 'percent' },
  },
  {
    key: 'bestSellingItems', title: 'Best Selling Items', autofilter: true,
    formats: { 'Rank': 'integer', 'Quantity Sold': 'integer', 'Total Sales': 'currency', 'Percentage of Sales': 'percent' },
  },
  {
    key: 'unsoldItems', title: 'Unsold Items',
    formats: { 'Current Price': 'currency', 'Quantity Sold': 'integer', 'Total Sales': 'currency' },
  },
  {
    key: 'monthlySales', title: 'Monthly Sales',
    formats: { 'Total Orders': 'integer', 'Total Items Sold': 'integer', 'Total Sales': 'currency' },
  },
  {
    key: 'monthlyItemSales', title: 'Monthly Item Sales', autofilter: true,
    formats: { 'Quantity Sold': 'integer', 'Total Sales': 'currency' },
  },
  {
    key: 'costsAndExpenses', title: 'Costs & Expenses',
    formats: { 'Monthly Amount': 'currency', 'Percentage of Sales': 'percent' },
  },
  {
    key: 'dailyFinancialReport', title: 'Daily Financial Report',
    formats: {
      'Total Sales': 'currency', 'Fixed Daily Costs': 'currency', 'Percentage Costs': 'currency',
      'Total Costs': 'currency', 'Estimated Remaining': 'currency',
    },
    totalLabel: 'TOTAL FOR PERIOD',
    sumColumns: ['Total Sales', 'Fixed Daily Costs', 'Percentage Costs', 'Total Costs', 'Estimated Remaining'],
  },
  {
    key: 'monthlyFinancialReport', title: 'Monthly Financial Report',
    formats: {
      'Total Sales': 'currency', 'Fixed Costs': 'currency', 'Percentage Costs': 'currency',
      'Total Costs': 'currency', 'Estimated Remaining': 'currency', 'Cost Percentage': 'percent',
    },
  },
  {
    key: 'itemSalesSummary', title: 'Item Sales Summary', autofilter: true,
    formats: {
      'Total Quantity Sold': 'integer', 'Total Sales': 'currency', 'Average Unit Price': 'currency',
      'Percentage of Total Sales': 'percent', 'Number of Days Sold': 'integer', 'Number of Days Not Sold': 'integer',
      'Current Price': 'currency',
    },
  },
];

type PaymentBucket = 'Cash' | 'Telebirr' | 'Card' | 'Other';

function paymentBucket(paymentMethod: string | null | undefined): PaymentBucket {
  const pm = (paymentMethod || 'cash').toLowerCase();
  if (pm.includes('cash')) return 'Cash';
  if (pm.includes('telebirr')) return 'Telebirr';
  if (pm.includes('card')) return 'Card';
  return 'Other';
}

// ---------------------------------------------------------------------------
// GET /api/export
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const todayStr = toDateStr(now);

    const resolved = resolvePeriod(searchParams, now);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const { periodType, periodKey, periodLabel, reportTitle, startDate: startDateStr, endDate: endDateStr, periodEndDate, fileName } = resolved;
    const periodStillRunning = periodEndDate > endDateStr;

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

    // Validation: order totals must agree with their line items
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

    // Master catalog: current menu items plus historical (deleted) items that were sold in the period
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
        createdAt: toDateStr(new Date(mi.createdAt)),
        updatedAt: toDateStr(new Date(mi.updatedAt)),
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

    // Every calendar day in the range, ascending
    const datesListAsc = listDates(startDateStr, endDateStr);

    // Aggregation maps
    const dailySalesMap: Record<string, { ordersCount: number; itemsSold: number; totalSales: number }> = {};
    const paymentMethodMap: Record<PaymentBucket, { count: number; totalSales: number }> = {
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
    const overallTotalOrders = orders.length;
    let overallItemsSold = 0;

    for (const order of orders) {
      overallTotalSales += order.totalAmount;

      if (!dailySalesMap[order.orderDate]) {
        dailySalesMap[order.orderDate] = { ordersCount: 0, itemsSold: 0, totalSales: 0 };
      }
      dailySalesMap[order.orderDate].ordersCount += 1;
      dailySalesMap[order.orderDate].totalSales += order.totalAmount;

      const bucket = paymentBucket(order.paymentMethod);
      paymentMethodMap[bucket].count += 1;
      paymentMethodMap[bucket].totalSales += order.totalAmount;

      const createdAt = new Date(order.createdAt);

      // Orders sheet
      ordersSheetRows.push({
        'Order ID': order.id,
        'Order Number': order.orderNumber,
        'Date': order.orderDate,
        'Time': order.orderTime,
        'Total Amount': round2(order.totalAmount),
        'Payment Method': order.paymentMethod || 'Cash',
        'Status': order.status,
        'Created At': `${toDateStr(createdAt)} ${toTimeStr(createdAt)}`,
      });

      for (const item of order.items) {
        overallItemsSold += item.quantity;
        dailySalesMap[order.orderDate].itemsSold += item.quantity;

        const itemTotal = round2(item.unitPrice * item.quantity);

        // Detailed Sales sheet: one row per sold line item
        detailedSalesRows.push({
          'Date': order.orderDate,
          'Time': order.orderTime,
          'Order Number': order.orderNumber,
          'Item Name': item.itemName,
          'Category': item.categoryName || 'General',
          'Unit Price': round2(item.unitPrice),
          'Quantity': item.quantity,
          'Item Total': itemTotal,
          'Payment Method': order.paymentMethod || 'Cash',
          'Order Total': round2(order.totalAmount),
          'Status': order.status,
        });

        // Order Items sheet
        orderItemsSheetRows.push({
          'Order ID': order.id,
          'Order Number': order.orderNumber,
          'Item ID': item.menuItemId || 'N/A',
          'Item Name': item.itemName,
          'Category': item.categoryName || 'General',
          'Quantity': item.quantity,
          'Historical Unit Price': round2(item.unitPrice),
          'Subtotal': round2(item.subtotal),
          'Order Date': order.orderDate,
          'Order Time': order.orderTime,
        });

        const catName = item.categoryName || 'General';
        if (!categorySalesMap[catName]) {
          categorySalesMap[catName] = { qty: 0, totalSales: 0 };
        }
        categorySalesMap[catName].qty += item.quantity;
        categorySalesMap[catName].totalSales += item.subtotal;

        const stats = itemSalesStatsMap[item.itemName];
        if (stats) {
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

    overallTotalSales = round2(overallTotalSales);

    // Monthly aggregation
    const monthlyMap: Record<string, { monthStr: string; sales: number; orders: number; itemsSold: number }> = {};
    const monthlyItemMap: Record<string, Record<string, { qty: number; sales: number }>> = {};

    let highestSalesDay = { date: 'N/A', sales: 0 };
    let lowestSalesDay = { date: 'N/A', sales: Infinity };
    let daysWithSales = 0;

    for (const d of datesListAsc) {
      const dayData = dailySalesMap[d] || { ordersCount: 0, itemsSold: 0, totalSales: 0 };
      const dSales = dayData.totalSales;

      if (dayData.ordersCount > 0) {
        daysWithSales += 1;
        if (dSales > highestSalesDay.sales) highestSalesDay = { date: d, sales: dSales };
        if (dSales < lowestSalesDay.sales) lowestSalesDay = { date: d, sales: dSales };
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
    const avgDailySales = activeDaysCount > 0 ? round2(overallTotalSales / activeDaysCount) : 0;
    const avgOrderValue = overallTotalOrders > 0 ? round2(overallTotalSales / overallTotalOrders) : 0;
    const avgDailyOrders = activeDaysCount > 0 ? round2(overallTotalOrders / activeDaysCount) : 0;

    const separatorRow = { Metric: '----------------------------------------', Value: '', Unit: '' };

    // 1. Sales Summary (Metric / Value / Unit so that Value stays a real number)
    const salesSummaryRows: { Metric: string; Value: string | number; Unit: string }[] = [
      { Metric: 'BUSINESS NAME', Value: 'DUMERSO COFFEE', Unit: '' },
      { Metric: 'REPORT TYPE', Value: PERIOD_TITLES[periodType], Unit: '' },
      { Metric: 'REPORT TITLE', Value: reportTitle, Unit: '' },
      { Metric: 'REPORT PERIOD', Value: periodLabel, Unit: '' },
      { Metric: 'START DATE', Value: startDateStr, Unit: '' },
      { Metric: 'END DATE', Value: endDateStr, Unit: '' },
      ...(periodStillRunning
        ? [{ Metric: 'NOTE', Value: `Period still in progress. Data included through ${formatLongDate(endDateStr)} (period ends ${formatLongDate(periodEndDate)}).`, Unit: '' }]
        : []),
      { Metric: 'GENERATED DATE', Value: todayStr, Unit: '' },
      { Metric: 'GENERATED TIME', Value: toTimeStr(now), Unit: '' },
      { Metric: 'CURRENCY', Value: 'ETB (Ethiopian Birr)', Unit: '' },
      separatorRow,
      { Metric: 'Total Sales', Value: overallTotalSales, Unit: 'ETB' },
      { Metric: 'Total Orders', Value: overallTotalOrders, Unit: 'orders' },
      { Metric: 'Total Items Sold', Value: overallItemsSold, Unit: 'items' },
      { Metric: 'Average Order Value', Value: avgOrderValue, Unit: 'ETB' },
      { Metric: 'Average Daily Sales', Value: avgDailySales, Unit: 'ETB' },
      { Metric: 'Average Daily Orders', Value: avgDailyOrders, Unit: 'orders/day' },
      { Metric: 'Days in Period', Value: activeDaysCount, Unit: 'days' },
      { Metric: 'Days With Sales', Value: daysWithSales, Unit: 'days' },
      separatorRow,
      { Metric: 'Cash Sales', Value: round2(paymentMethodMap.Cash.totalSales), Unit: 'ETB' },
      { Metric: 'Telebirr Sales', Value: round2(paymentMethodMap.Telebirr.totalSales), Unit: 'ETB' },
      { Metric: 'Card Sales', Value: round2(paymentMethodMap.Card.totalSales), Unit: 'ETB' },
      { Metric: 'Other Sales', Value: round2(paymentMethodMap.Other.totalSales), Unit: 'ETB' },
      separatorRow,
      { Metric: 'Top Selling Item', Value: 'N/A', Unit: '' },
      { Metric: 'Top Selling Category', Value: 'N/A', Unit: '' },
      { Metric: 'Highest Sales Day', Value: highestSalesDay.date, Unit: '' },
      { Metric: 'Highest Sales Day Amount', Value: round2(highestSalesDay.sales), Unit: 'ETB' },
      { Metric: 'Lowest Sales Day (with sales)', Value: lowestSalesDay.date, Unit: '' },
      { Metric: 'Lowest Sales Day Amount', Value: round2(lowestSalesDay.sales), Unit: 'ETB' },
    ];

    // 3. Daily Sales Summary
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
        'Day': getDayName(d),
        'Total Orders': dayData.ordersCount,
        'Total Items Sold': dayData.itemsSold,
        'Total Sales': round2(dayData.totalSales),
        'Average Order Value': dayData.ordersCount > 0 ? round2(dayData.totalSales / dayData.ordersCount) : 0,
      });
    }

    summaryGrandSales = round2(summaryGrandSales);
    dailySalesSummaryRows.push({
      'Date': 'GRAND TOTAL',
      'Day': '',
      'Total Orders': summaryGrandOrders,
      'Total Items Sold': summaryGrandItems,
      'Total Sales': summaryGrandSales,
      'Average Order Value': summaryGrandOrders > 0 ? round2(summaryGrandSales / summaryGrandOrders) : 0,
    });

    // 4. Daily Item Sales (every day x every menu item)
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

      // Section header for the day
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
        const activeEntries = priceEntries.filter(([, data]) => data.qty > 0);

        if (activeEntries.length === 0) {
          dailyItemSalesRows.push({
            'Date': d,
            'Item Name': masterItem.name,
            'Category': masterItem.categoryName,
            'Unit Price': round2(masterItem.defaultPrice),
            'Quantity Sold': 0,
            'Total Sales': 0,
          });
        } else {
          for (const [pStr, data] of activeEntries) {
            const uPrice = parseFloat(pStr);
            const itemSales = round2(data.sales);
            dayTotalQty += data.qty;
            dayTotalSales += itemSales;

            dailyItemSalesRows.push({
              'Date': d,
              'Item Name': masterItem.name,
              'Category': masterItem.categoryName,
              'Unit Price': uPrice,
              'Quantity Sold': data.qty,
              'Total Sales': itemSales,
            });
          }
        }
      }

      dayTotalSales = round2(dayTotalSales);
      dailyItemGrandQty += dayTotalQty;
      dailyItemGrandSales += dayTotalSales;

      dailyItemSalesRows.push({
        'Date': `TOTAL FOR ${d}`,
        'Item Name': 'DAILY SUMMARY',
        'Category': '',
        'Unit Price': '',
        'Quantity Sold': dayTotalQty,
        'Total Sales': dayTotalSales,
      });

      dailyItemSalesRows.push({
        'Date': '',
        'Item Name': '',
        'Category': '',
        'Unit Price': '',
        'Quantity Sold': '',
        'Total Sales': '',
      });
    }

    dailyItemGrandSales = round2(dailyItemGrandSales);

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
      'Total Sales': dailyItemGrandSales,
    });

    // 7. Menu Items
    const menuItemsSheetRows = allMasterItems.map((item) => ({
      'Item ID': item.id,
      'Item Name': item.name,
      'Category': item.categoryName,
      'Current Price': round2(item.defaultPrice),
      'Availability': item.isDeleted ? 'Deleted (Historical)' : (item.isAvailable ? 'Available' : 'Unavailable'),
      'Created Date': item.createdAt,
      'Updated Date': item.updatedAt,
    }));

    // 8. Category Sales (current categories plus any historical category that had sales)
    const categoryNames = Array.from(new Set<string>([
      ...categories.map((c) => c.name),
      ...Object.keys(categorySalesMap),
    ]));

    const categorySalesSheetRows = categoryNames
      .map((catName) => {
        const catSalesData = categorySalesMap[catName] || { qty: 0, totalSales: 0 };
        const catSales = round2(catSalesData.totalSales);
        const pctSales = ratio(catSales, overallTotalSales);
        return {
          'Category': catName,
          'Total Quantity Sold': catSalesData.qty,
          'Total Sales': catSales,
          'Percentage of Total Sales': pctSales,
        };
      })
      .sort((a, b) => b['Total Sales'] - a['Total Sales'] || a['Category'].localeCompare(b['Category']));

    if (categorySalesSheetRows.length > 0 && categorySalesSheetRows[0]['Total Sales'] > 0) {
      const topIndex = salesSummaryRows.findIndex((r) => r.Metric === 'Top Selling Category');
      if (topIndex !== -1) salesSummaryRows[topIndex].Value = categorySalesSheetRows[0]['Category'];
    }

    // 9. Payment Methods
    const paymentMethodsSheetRows = (Object.entries(paymentMethodMap) as [PaymentBucket, { count: number; totalSales: number }][])
      .map(([pmName, stats]) => {
        const total = round2(stats.totalSales);
        const pct = ratio(total, overallTotalSales);
        return {
          'Payment Method': pmName,
          'Number of Orders': stats.count,
          'Total Sales': total,
          'Percentage': pct,
        };
      });

    // 10. Item Sales Summary, Best Selling Items, Unsold Items
    const itemSalesSummaryRows: any[] = [];
    const bestSellingItemsRows: any[] = [];
    const unsoldItemsRows: any[] = [];

    const sortedBySalesItems = allMasterItems.map((masterItem) => {
      const stats = itemSalesStatsMap[masterItem.name] || {
        totalQty: 0,
        totalSales: 0,
        prices: [],
        daysSoldSet: new Set<string>(),
        firstSaleDate: null,
        lastSaleDate: null,
      };

      const totalQty = stats.totalQty;
      const totalSales = round2(stats.totalSales);
      const avgPrice = stats.prices.length > 0
        ? round2(stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length)
        : round2(masterItem.defaultPrice);
      const pctSales = ratio(totalSales, overallTotalSales);
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
        currentPrice: round2(masterItem.defaultPrice),
        isAvailable: masterItem.isDeleted ? 'Deleted (Historical)' : (masterItem.isAvailable ? 'Available' : 'Unavailable'),
      };
    }).sort((a, b) => b.totalQty - a.totalQty || b.totalSales - a.totalSales || a.name.localeCompare(b.name));

    if (sortedBySalesItems.length > 0 && sortedBySalesItems[0].totalSales > 0) {
      const topItemIndex = salesSummaryRows.findIndex((r) => r.Metric === 'Top Selling Item');
      if (topItemIndex !== -1) salesSummaryRows[topItemIndex].Value = sortedBySalesItems[0].name;
    }

    let rankCounter = 1;
    for (const item of sortedBySalesItems) {
      itemSalesSummaryRows.push({
        'Item ID': item.id,
        'Item Name': item.name,
        'Category': item.category,
        'Total Quantity Sold': item.totalQty,
        'Total Sales': item.totalSales,
        'Average Unit Price': item.avgPrice,
        'Percentage of Total Sales': item.pctSales,
        'Number of Days Sold': item.daysSold,
        'Number of Days Not Sold': item.daysNotSold,
        'First Sale Date': item.firstSaleDate,
        'Last Sale Date': item.lastSaleDate,
        'Current Price': item.currentPrice,
        'Current Availability': item.isAvailable,
      });

      if (item.totalQty > 0) {
        bestSellingItemsRows.push({
          'Rank': rankCounter++,
          'Item Name': item.name,
          'Category': item.category,
          'Quantity Sold': item.totalQty,
          'Total Sales': item.totalSales,
          'Percentage of Sales': item.pctSales,
        });
      } else {
        unsoldItemsRows.push({
          'Item Name': item.name,
          'Category': item.category,
          'Current Price': item.currentPrice,
          'Quantity Sold': 0,
          'Total Sales': 0,
        });
      }
    }

    // 11. Monthly Sales
    const sortedMonthsList = Object.keys(monthlyMap).sort();
    const monthlySalesSheetRows = sortedMonthsList.map((ym) => {
      const m = monthlyMap[ym];
      return {
        'Month': getMonthName(ym),
        'Total Orders': m.orders,
        'Total Items Sold': m.itemsSold,
        'Total Sales': round2(m.sales),
      };
    });

    // 12. Monthly Item Sales
    const monthlyItemSalesRows: any[] = [];
    for (const ym of Object.keys(monthlyItemMap).sort()) {
      const monthNameStr = getMonthName(ym);
      const mItems = monthlyItemMap[ym] || {};

      for (const masterItem of allMasterItems) {
        const itemStats = mItems[masterItem.name] || { qty: 0, sales: 0 };
        monthlyItemSalesRows.push({
          'Month': monthNameStr,
          'Item Name': masterItem.name,
          'Category': masterItem.categoryName,
          'Quantity Sold': itemStats.qty,
          'Total Sales': round2(itemStats.sales),
        });
      }
    }

    // 13. Costs & Expenses
    const activeCosts = allCosts.filter((c) => c.active);
    const fixedCosts = activeCosts.filter((c) => c.costType === 'fixed_monthly');
    const percentageCosts = activeCosts.filter((c) => c.costType === 'sales_percentage');

    const costsAndExpensesRows = allCosts.map((c) => ({
      'Date Added': toDateStr(new Date(c.createdAt)),
      'Cost Name': c.name,
      'Description': c.description || 'N/A',
      'Cost Type': c.costType === 'fixed_monthly' ? 'Fixed Monthly' : 'Sales Percentage',
      'Monthly Amount': c.costType === 'fixed_monthly' ? round2(c.amount || 0) : null,
      'Percentage of Sales': c.costType === 'sales_percentage' ? ratio(c.percentage || 0, 100) : null,
      'How It Is Applied': c.costType === 'fixed_monthly'
        ? `${round2(c.amount || 0).toFixed(2)} ETB per month, spread evenly over the days of each month`
        : `${round2(c.percentage || 0)}% of each day's sales`,
      'Status': c.active ? 'Active' : 'Inactive',
    }));

    // 14. Daily Financial Report
    const dailyFinancialReportRows: any[] = [];
    let totalPeriodSales = 0;
    let totalPeriodFixedCosts = 0;
    let totalPeriodPctCosts = 0;
    let totalPeriodCosts = 0;
    let totalPeriodRemaining = 0;

    for (const d of datesListAsc) {
      const dSales = round2((dailySalesMap[d] || { totalSales: 0 }).totalSales);

      const [y, mNum] = d.split('-').map(Number);
      const daysInM = getDaysInMonth(y, mNum - 1);

      let dFixedCosts = 0;
      for (const fc of fixedCosts) {
        dFixedCosts += (fc.amount || 0) / daysInM;
      }
      dFixedCosts = round2(dFixedCosts);

      let dPctCosts = 0;
      for (const pc of percentageCosts) {
        dPctCosts += (dSales * (pc.percentage || 0)) / 100;
      }
      dPctCosts = round2(dPctCosts);

      const dTotalCosts = round2(dFixedCosts + dPctCosts);
      const dRemaining = round2(dSales - dTotalCosts);

      totalPeriodSales += dSales;
      totalPeriodFixedCosts += dFixedCosts;
      totalPeriodPctCosts += dPctCosts;
      totalPeriodCosts += dTotalCosts;
      totalPeriodRemaining += dRemaining;

      dailyFinancialReportRows.push({
        'Date': d,
        'Total Sales': dSales,
        'Fixed Daily Costs': dFixedCosts,
        'Percentage Costs': dPctCosts,
        'Total Costs': dTotalCosts,
        'Estimated Remaining': dRemaining,
      });
    }

    dailyFinancialReportRows.push({
      'Date': 'TOTAL FOR PERIOD',
      'Total Sales': round2(totalPeriodSales),
      'Fixed Daily Costs': round2(totalPeriodFixedCosts),
      'Percentage Costs': round2(totalPeriodPctCosts),
      'Total Costs': round2(totalPeriodCosts),
      'Estimated Remaining': round2(totalPeriodRemaining),
    });

    // 15. Monthly Financial Report
    const monthlyFinancialReportRows: any[] = [];

    for (const ym of sortedMonthsList) {
      const mData = monthlyMap[ym];
      const mSales = round2(mData.sales);

      let mFixedCosts = 0;
      for (const fc of fixedCosts) {
        mFixedCosts += fc.amount || 0;
      }
      mFixedCosts = round2(mFixedCosts);

      let mPctCosts = 0;
      for (const pc of percentageCosts) {
        mPctCosts += (mSales * (pc.percentage || 0)) / 100;
      }
      mPctCosts = round2(mPctCosts);

      const mTotalCosts = round2(mFixedCosts + mPctCosts);
      const mRemaining = round2(mSales - mTotalCosts);
      const costPct = ratio(mTotalCosts, mSales);

      monthlyFinancialReportRows.push({
        'Month': getMonthName(ym),
        'Total Sales': mSales,
        'Fixed Costs': mFixedCosts,
        'Percentage Costs': mPctCosts,
        'Total Costs': mTotalCosts,
        'Estimated Remaining': mRemaining,
        'Cost Percentage': costPct,
      });
    }

    return NextResponse.json({
      period: periodType,
      periodType,
      periodKey,
      periodLabel,
      reportTitle,
      fileName,
      startDate: startDateStr,
      endDate: endDateStr,
      periodEndDate,
      periodStillRunning,
      generatedAt: `${todayStr} ${toTimeStr(now)}`,
      preview: {
        totalSales: overallTotalSales,
        totalOrders: overallTotalOrders,
        itemsSold: overallItemsSold,
        avgOrderValue,
      },
      workbook: WORKBOOK_SPEC,
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
