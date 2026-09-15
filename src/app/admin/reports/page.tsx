'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  Coffee,
  DollarSign,
  Calendar,
  Lock,
  CheckCircle,
  CreditCard,
  Phone,
  Banknote,
  PieChart as PieIcon,
  BarChart3,
  Award,
  AlertCircle,
  Clock,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PaymentBreakdown {
  cash: number;
  telebirr: number;
  card: number;
  other: number;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
}

interface BestSeller {
  name: string;
  quantity: number;
  sales: number;
}

interface DailyRow {
  date: string;
  orders: number;
  itemsSold: number;
  totalSales: number;
  averageOrder: number;
}

interface ItemSaleRow {
  itemName: string;
  category: string;
  quantitySold: number;
  unitPrice: number;
  totalSales: number;
  status: string;
}

interface ReportData {
  period: string;
  startDate: string;
  endDate: string;
  totalSales: number;
  totalOrders: number;
  itemsSold: number;
  averageOrder: number;
  paymentBreakdown: PaymentBreakdown;
  categoryBreakdown: CategoryBreakdown[];
  bestSellingItems: BestSeller[];
  dailyBreakdown: DailyRow[];
  isTodayClosed: boolean;
}

// ---------------------------------------------------------------------------
// Excel export helpers
// ---------------------------------------------------------------------------

type ExportPeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

const EXPORT_PERIOD_OPTIONS: { id: ExportPeriodType; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom Range' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUARTER_OPTIONS = [
  { id: '1', label: 'Q1 (January - March)' },
  { id: '2', label: 'Q2 (April - June)' },
  { id: '3', label: 'Q3 (July - September)' },
  { id: '4', label: 'Q4 (October - December)' },
];

/** Excel number formats applied to numeric cells so amounts stay editable numbers, not text. */
const EXCEL_NUMBER_FORMATS: Record<string, string> = {
  currency: '#,##0.00 "ETB"',
  percent: '0.00%',
  integer: '#,##0',
  decimal: '#,##0.00',
};

const EXPORT_INPUT_CLASS =
  'bg-[#1A0D07] border border-[#4A2917] text-[#F3E4CB] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#8B5A2B] min-w-[150px]';

/** Sheet layout metadata returned by /api/export (see WORKBOOK_SPEC there). */
interface ExportSheetSpec {
  key: string;
  title: string;
  formats?: Record<string, string>;
  keyValue?: boolean;
  autofilter?: boolean;
  totalLabel?: string;
  sumColumns?: string[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return toLocalDateStr(dateObj) === value ? dateObj : null;
}

function formatLongDate(value: string): string {
  const d = parseLocalDate(value);
  if (!d) return value;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Monday..Sunday of the week that contains `value`. */
function weekBounds(value: string): { monday: string; sunday: string } | null {
  const d = parseLocalDate(value);
  if (!d) return null;
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday: toLocalDateStr(monday), sunday: toLocalDateStr(sunday) };
}

function describeExportPeriod(
  type: ExportPeriodType,
  values: { date: string; monthNum: string; quarter: string; year: string; start: string; end: string }
): string {
  switch (type) {
    case 'daily':
      return values.date ? formatLongDate(values.date) : 'Choose a day';
    case 'weekly': {
      const bounds = values.date ? weekBounds(values.date) : null;
      return bounds
        ? `Monday ${formatLongDate(bounds.monday)} to Sunday ${formatLongDate(bounds.sunday)}`
        : 'Choose any day in the week you want';
    }
    case 'monthly':
      return `${MONTH_NAMES[Number(values.monthNum) - 1] || ''} ${values.year}`.trim();
    case 'quarterly': {
      const first = (Number(values.quarter) - 1) * 3;
      return `Q${values.quarter} ${values.year} (${MONTH_NAMES[first] || ''} to ${MONTH_NAMES[first + 2] || ''})`;
    }
    case 'yearly':
      return `1 January to 31 December ${values.year}`;
    case 'custom':
      return values.start && values.end
        ? `${formatLongDate(values.start)} to ${formatLongDate(values.end)}`
        : 'Choose a start date and an end date';
    default:
      return '';
  }
}

/**
 * Adds one worksheet to the workbook: auto column widths, Excel number formats on
 * numeric cells, live SUM formulas on the total row and filter arrows on flat tables.
 */
function addWorksheet(wb: XLSX.WorkBook, rows: any[], spec: ExportSheetSpec) {
  const title = spec.title.slice(0, 31);

  if (!rows || rows.length === 0) {
    const emptyWs = XLSX.utils.aoa_to_sheet([['No data available for this section']]);
    XLSX.utils.book_append_sheet(wb, emptyWs, title);
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  const lastRowIndex = rows.length; // sheet row index of the last data row (row 0 is the header)

  // Column widths
  ws['!cols'] = headers.map((header) => {
    let maxLen = header.length;
    for (const row of rows) {
      const val = row[header];
      if (val === null || val === undefined) continue;
      const len = typeof val === 'number' ? val.toFixed(2).length + 6 : String(val).length;
      if (len > maxLen) maxLen = len;
    }
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
  });

  // Number formats
  headers.forEach((header, c) => {
    const columnFormat = spec.formats?.[header];
    for (let r = 1; r <= lastRowIndex; r++) {
      const cell = ws[XLSX.utils.encode_cell({ c, r })];
      if (!cell || cell.t !== 'n') continue;
      let formatKey = columnFormat;
      if (spec.keyValue) {
        const unit = rows[r - 1]?.Unit;
        formatKey = unit === 'ETB' ? 'currency' : unit === '%' ? 'percent' : Number.isInteger(cell.v) ? 'integer' : 'decimal';
      }
      if (formatKey && EXCEL_NUMBER_FORMATS[formatKey]) cell.z = EXCEL_NUMBER_FORMATS[formatKey];
    }
  });

  // Live SUM formulas on the total row, so edits above update the total in Excel
  if (spec.totalLabel && spec.sumColumns && spec.sumColumns.length > 0) {
    const totalIndex = rows.findIndex((row) => row[headers[0]] === spec.totalLabel);
    if (totalIndex > 0) {
      const totalExcelRow = totalIndex + 2; // +1 header row, +1 because Excel rows are 1-based
      for (const columnName of spec.sumColumns) {
        const c = headers.indexOf(columnName);
        if (c < 0) continue;
        const col = XLSX.utils.encode_col(c);
        const addr = XLSX.utils.encode_cell({ c, r: totalIndex + 1 });
        const existing = ws[addr];
        ws[addr] = {
          t: 'n',
          v: existing && typeof existing.v === 'number' ? existing.v : 0,
          f: `SUM(${col}2:${col}${totalExcelRow - 1})`,
          z: EXCEL_NUMBER_FORMATS[spec.formats?.[columnName] || 'decimal'],
        };
      }
    }
  }

  if (spec.autofilter) {
    ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${lastRowIndex + 1}` };
  }

  XLSX.utils.book_append_sheet(wb, ws, title);
}

export default function SalesReportsPage() {
  const [period, setPeriod] = useState<string>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [itemLevelSales, setItemLevelSales] = useState<ItemSaleRow[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'sales'>('quantity');
  const [isLoading, setIsLoading] = useState(true);

  // Excel Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportPeriodType, setExportPeriodType] = useState<ExportPeriodType>('daily');
  const [todayStr, setTodayStr] = useState<string>('');
  const [exportDate, setExportDate] = useState<string>('');
  const [exportMonthNum, setExportMonthNum] = useState<string>('');
  const [exportQuarter, setExportQuarter] = useState<string>('');
  const [exportYear, setExportYear] = useState<string>('');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');

  // Default the export pickers to the current day / month / quarter / year (set on the client to avoid hydration mismatches)
  useEffect(() => {
    const now = new Date();
    const today = toLocalDateStr(now);
    setTodayStr(today);
    setExportDate(today);
    setExportMonthNum(pad2(now.getMonth() + 1));
    setExportQuarter(String(Math.floor(now.getMonth() / 3) + 1));
    setExportYear(String(now.getFullYear()));
  }, []);

  const currentYear = todayStr ? Number(todayStr.slice(0, 4)) : new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  const buildExportQuery = (): string | null => {
    const params = new URLSearchParams({ period: exportPeriodType });
    switch (exportPeriodType) {
      case 'daily':
      case 'weekly':
        if (!exportDate) return null;
        params.set('date', exportDate);
        break;
      case 'monthly':
        if (!exportYear || !exportMonthNum) return null;
        params.set('month', `${exportYear}-${exportMonthNum}`);
        break;
      case 'quarterly':
        if (!exportYear || !exportQuarter) return null;
        params.set('quarter', `${exportYear}-Q${exportQuarter}`);
        break;
      case 'yearly':
        if (!exportYear) return null;
        params.set('year', exportYear);
        break;
      case 'custom':
        if (!exportStartDate || !exportEndDate) return null;
        params.set('startDate', exportStartDate);
        params.set('endDate', exportEndDate);
        break;
    }
    return params.toString();
  };

  const exportQuery = buildExportQuery();
  const exportPeriodDescription = describeExportPeriod(exportPeriodType, {
    date: exportDate,
    monthNum: exportMonthNum,
    quarter: exportQuarter,
    year: exportYear,
    start: exportStartDate,
    end: exportEndDate,
  });
  const exportPeriodLabel = EXPORT_PERIOD_OPTIONS.find((o) => o.id === exportPeriodType)?.label || '';
  
  // Close Day Modal State
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      let url = `/api/reports?period=${period}`;
      let exportUrl = `/api/export?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
        exportUrl += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const [res, exportRes] = await Promise.all([
        fetch(url),
        fetch(exportUrl),
      ]);

      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
      if (exportRes.ok) {
        const exportData = await exportRes.json();
        if (exportData.sheets?.itemSalesSummary) {
          // The Item Sales Summary sheet uses "Total Quantity Sold" / "Average Unit Price" columns
          setItemLevelSales(
            exportData.sheets.itemSalesSummary.map((i: any) => {
              const quantitySold = Number(i['Total Quantity Sold'] ?? i['Quantity Sold'] ?? 0) || 0;
              return {
                itemName: i['Item Name'] || '',
                category: i['Category'] || '',
                quantitySold,
                unitPrice: Number(i['Average Unit Price'] ?? i['Current Price'] ?? 0) || 0,
                totalSales: Number(i['Total Sales'] ?? 0) || 0,
                status: quantitySold > 0 ? 'Sold' : 'Not Sold',
              };
            })
          );
        }
      }
    } catch (err) {
      console.error('Failed to load sales report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [period]);

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (period === 'custom' && startDate && endDate) {
      fetchReports();
    }
  };

  const handleDownloadExcel = async () => {
    const query = buildExportQuery();
    if (!query) {
      alert('Please choose the period you want to export first.');
      return;
    }

    setIsExporting(true);
    setExportStatus('Preparing Excel report...');

    try {
      const res = await fetch(`/api/export?${query}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || 'Unable to generate the Excel report. Please try again or contact the administrator.');
        return;
      }

      if (!data.sheets || !Array.isArray(data.workbook)) {
        alert('No data available to export for this period.');
        return;
      }

      setExportStatus('Building 17 worksheets...');
      const wb = XLSX.utils.book_new();
      for (const spec of data.workbook as ExportSheetSpec[]) {
        addWorksheet(wb, data.sheets[spec.key] || [], spec);
      }

      const fallbackName = `Dumerso_Coffee_Report_${data.startDate}_to_${data.endDate}.xlsx`;
      XLSX.writeFile(wb, data.fileName || fallbackName);

      const periodText = data.periodLabel || `${data.startDate} to ${data.endDate}`;
      setToastMessage(`${data.reportTitle || 'Excel report'} downloaded (${periodText}).`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (error) {
      console.error('Error downloading Excel file:', error);
      alert('An unexpected error occurred while generating the Excel report.');
    } finally {
      setExportStatus(null);
      setIsExporting(false);
    }
  };

  const handleCloseDay = async () => {
    setIsClosing(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
      });
      if (res.ok) {
        setToastMessage("Today's sales have been successfully closed and recorded!");
        setShowCloseModal(false);
        fetchReports();
      } else {
        alert("Failed to close today's sales. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while closing sales.');
    } finally {
      setIsClosing(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const calculatePercentage = (amount: number, total: number) => {
    if (!total || total === 0) return 0;
    return Math.round((amount / total) * 100);
  };

  return (
    <div className="space-y-8">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#8B5A2B] text-[#FFF4E3] px-5 py-3 rounded-2xl shadow-2xl border border-[#F3E4CB]/40 flex items-center gap-2 text-xs font-bold animate-bounce">
          <CheckCircle className="w-4 h-4 text-[#59D98A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB] tracking-tight">
            Sales Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[#CDB99D] mt-0.5 font-medium">
            Monitor daily revenue, order trends, payment methods, and close daily registers
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {report?.isTodayClosed ? (
            <div className="inline-flex items-center gap-2 bg-[#59D98A]/10 text-[#59D98A] border border-[#59D98A]/30 px-4 py-2.5 rounded-xl font-bold text-xs">
              <Lock className="w-4 h-4 text-[#59D98A]" />
              <span>Today's Sales Closed</span>
            </div>
          ) : (
            <button
              onClick={() => setShowCloseModal(true)}
              className="inline-flex items-center gap-2 bg-[#1A0D07] hover:bg-[#341B10] text-[#FFF4E3] border border-[#4A2917] px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Lock className="w-4 h-4 text-[#8B5A2B]" />
              <span>End of Day / Close Today's Sales</span>
            </button>
          )}
        </div>
      </div>

      {/* Period Filter Tabs */}
      <div className="bg-[#24140C] rounded-2xl p-3 border border-[#4A2917] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'Custom Range' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                period === tab.id
                  ? 'bg-[#8B5A2B] text-[#FFF4E3] shadow-md border border-[#F3E4CB]/30'
                  : 'bg-[#1A0D07] text-[#CDB99D] hover:bg-[#2D1A10] border border-[#4A2917]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        {period === 'custom' && (
          <form onSubmit={handleCustomSearch} className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#1A0D07] border border-[#4A2917] text-[#F3E4CB] text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#8B5A2B]"
              required
            />
            <span className="text-[#CDB99D] text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#1A0D07] border border-[#4A2917] text-[#F3E4CB] text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#8B5A2B]"
              required
            />
            <button
              type="submit"
              className="bg-[#8B5A2B] text-[#FFF4E3] text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#724820]"
            >
              Filter
            </button>
          </form>
        )}
      </div>

      {/* Excel Export Panel */}
      <div className="bg-[#24140C] rounded-2xl p-4 sm:p-5 border border-[#8B5A2B]/40 shadow-lg space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4A2917] border border-[#8B5A2B]/50 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="text-sm font-serif font-bold text-[#F3E4CB]">
              Download Excel Report
            </div>
            <div className="text-[11px] text-[#CDB99D] leading-relaxed">
              Choose a report type and the period you want, then download. The workbook has 17 worksheets and every
              amount is a real number, so you can edit, sort and total the data in Excel after downloading.
            </div>
          </div>
        </div>

        {/* Report type */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {EXPORT_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setExportPeriodType(option.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                exportPeriodType === option.id
                  ? 'bg-[#8B5A2B] text-[#FFF4E3] shadow-md border border-[#F3E4CB]/30'
                  : 'bg-[#1A0D07] text-[#CDB99D] hover:bg-[#2D1A10] border border-[#4A2917]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Period pickers + download button */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            {(exportPeriodType === 'daily' || exportPeriodType === 'weekly') && (
              <label className="flex flex-col gap-1 text-[11px] font-bold text-[#CDB99D]">
                {exportPeriodType === 'daily' ? 'Day' : 'Any day in the week'}
                <input
                  type="date"
                  value={exportDate}
                  max={todayStr || undefined}
                  onChange={(e) => setExportDate(e.target.value)}
                  className={EXPORT_INPUT_CLASS}
                />
              </label>
            )}

            {exportPeriodType === 'monthly' && (
              <label className="flex flex-col gap-1 text-[11px] font-bold text-[#CDB99D]">
                Month
                <select
                  value={exportMonthNum}
                  onChange={(e) => setExportMonthNum(e.target.value)}
                  className={EXPORT_INPUT_CLASS}
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={pad2(index + 1)}>{name}</option>
                  ))}
                </select>
              </label>
            )}

            {exportPeriodType === 'quarterly' && (
              <label className="flex flex-col gap-1 text-[11px] font-bold text-[#CDB99D]">
                Quarter
                <select
                  value={exportQuarter}
                  onChange={(e) => setExportQuarter(e.target.value)}
                  className={EXPORT_INPUT_CLASS}
                >
                  {QUARTER_OPTIONS.map((q) => (
                    <option key={q.id} value={q.id}>{q.label}</option>
                  ))}
                </select>
              </label>
            )}

            {(exportPeriodType === 'monthly' || exportPeriodType === 'quarterly' || exportPeriodType === 'yearly') && (
              <label className="flex flex-col gap-1 text-[11px] font-bold text-[#CDB99D]">
                Year
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(e.target.value)}
                  className={EXPORT_INPUT_CLASS}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            )}

            {exportPeriodType === 'custom' && (
              <>
                <label className="flex flex-col gap-1 text-[11px] font-bold text-[#CDB99D]">
                  From
                  <input
                    type="date"
                    value={exportStartDate}
                    max={todayStr || undefined}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className={EXPORT_INPUT_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-bold text-[#CDB99D]">
                  To
                  <input
                    type="date"
                    value={exportEndDate}
                    max={todayStr || undefined}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className={EXPORT_INPUT_CLASS}
                  />
                </label>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExporting || !exportQuery}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#8B5A2B] to-[#724820] hover:from-[#724820] hover:to-[#5c3919] text-[#FFF4E3] px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 border border-[#F3E4CB]/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>
              {isExporting ? (exportStatus || 'Preparing Excel report...') : `Download ${exportPeriodLabel} Excel Report`}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-[#CDB99D]">
          Report covers: <span className="font-bold text-[#F3E4CB]">{exportPeriodDescription}</span>
          {exportPeriodType !== 'daily' && exportPeriodType !== 'custom' && (
            <span> (a period that is still running includes data up to today)</span>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6 text-[#59D98A]" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
              Total Sales
            </div>
            <div className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB]">
              {isLoading ? '...' : `${report?.totalSales || 0} ETB`}
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
              Total Orders
            </div>
            <div className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB]">
              {isLoading ? '...' : report?.totalOrders || 0}
            </div>
          </div>
        </div>

        {/* Items Sold */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0">
            <Coffee className="w-6 h-6 text-[#8B5A2B]" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
              Items Sold
            </div>
            <div className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB]">
              {isLoading ? '...' : report?.itemsSold || 0}
            </div>
          </div>
        </div>

        {/* Average Order */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
              Avg. Order Value
            </div>
            <div className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB]">
              {isLoading ? '...' : `${report?.averageOrder || 0} ETB`}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Payment Method Breakdown */}
        <div className="lg:col-span-6 bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-[#4A2917] pb-3">
            <PieIcon className="w-5 h-5 text-[#8B5A2B]" />
            <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
              Payment Method Breakdown
            </h2>
          </div>

          <div className="space-y-3 pt-2">
            {[
              {
                label: 'Cash',
                amount: report?.paymentBreakdown.cash || 0,
                icon: Banknote,
                color: 'bg-[#59D98A]',
              },
              {
                label: 'Telebirr',
                amount: report?.paymentBreakdown.telebirr || 0,
                icon: Phone,
                color: 'bg-sky-400',
              },
              {
                label: 'Card',
                amount: report?.paymentBreakdown.card || 0,
                icon: CreditCard,
                color: 'bg-amber-400',
              },
              {
                label: 'Other',
                amount: report?.paymentBreakdown.other || 0,
                icon: DollarSign,
                color: 'bg-purple-400',
              },
            ].map((pm) => {
              const pct = calculatePercentage(pm.amount, report?.totalSales || 0);
              const Icon = pm.icon;
              return (
                <div key={pm.label} className="bg-[#1A0D07] p-3.5 rounded-xl border border-[#4A2917] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-[#F3E4CB]">
                      <Icon className="w-4 h-4 text-[#CDB99D]" />
                      <span>{pm.label}</span>
                    </div>
                    <div className="font-bold text-[#FFF4E3]">
                      {pm.amount} ETB <span className="text-[#CDB99D]/60 font-normal">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-[#24140C] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${pm.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown & Best Sellers */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Category Sales */}
          <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-[#4A2917] pb-3">
              <BarChart3 className="w-5 h-5 text-[#8B5A2B]" />
              <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
                Category Sales Breakdown
              </h2>
            </div>

            <div className="space-y-2">
              {!report?.categoryBreakdown || report.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-[#CDB99D] py-2 text-center">No sales recorded for categories.</p>
              ) : (
                report.categoryBreakdown.map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between p-3 bg-[#1A0D07] rounded-xl border border-[#4A2917] text-xs"
                  >
                    <span className="font-bold text-[#F3E4CB]">{cat.category}</span>
                    <span className="font-bold text-[#59D98A]">{cat.amount} ETB</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Best-Selling Items */}
          <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-[#4A2917] pb-3">
              <Award className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
                Top Selling Items
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              {!report?.bestSellingItems || report.bestSellingItems.length === 0 ? (
                <p className="text-xs text-[#CDB99D] py-2 text-center">No best sellers yet.</p>
              ) : (
                report.bestSellingItems.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2.5 bg-[#1A0D07] rounded-xl border border-[#4A2917]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#4A2917] text-[#F3E4CB] flex items-center justify-center font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-[#F3E4CB]">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#FFF4E3]">{item.sales} ETB</div>
                      <div className="text-[10px] text-[#CDB99D]/60">{item.quantity} sold</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 3. COMPLETE ITEM-LEVEL SALES BREAKDOWN (EVERY MENU ITEM LISTED) */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#4A2917] pb-4">
          <div>
            <h2 className="text-base font-serif font-bold text-[#F3E4CB] flex items-center gap-2">
              <Coffee className="w-5 h-5 text-[#8B5A2B]" />
              <span>Complete Item-Level Sales Breakdown</span>
            </h2>
            <p className="text-xs text-[#CDB99D] mt-0.5">
              Every menu item in the catalog is listed below. Unsold items display 0 quantity and 0 ETB sales.
            </p>
          </div>

          {/* Controls: Category Filter & Sort */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-[#1A0D07] p-1 rounded-xl border border-[#4A2917]">
              {['All', 'Tea & Hot Drinks', 'Coffee', 'Water'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedCategoryFilter === cat
                      ? 'bg-[#8B5A2B] text-[#FFF4E3]'
                      : 'text-[#CDB99D] hover:text-[#F3E4CB]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'quantity' | 'sales')}
              className="bg-[#1A0D07] border border-[#4A2917] text-[#F3E4CB] text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-[#8B5A2B]"
            >
              <option value="quantity">Sort by Quantity Sold</option>
              <option value="sales">Sort by Sales Amount</option>
              <option value="name">Sort by Item Name</option>
            </select>

          </div>
        </div>

        {/* Catalog Statistics Bar */}
        <div className="flex items-center gap-4 text-xs font-medium text-[#CDB99D] bg-[#1A0D07] p-3 rounded-xl border border-[#4A2917]">
          <div>
            <span>Total Catalog Items: </span>
            <span className="font-bold text-[#F3E4CB]">{itemLevelSales.length}</span>
          </div>
          <div>•</div>
          <div>
            <span>Items Sold: </span>
            <span className="font-bold text-[#59D98A]">
              {itemLevelSales.filter((i) => (i.quantitySold || (i as any).totalQuantitySold || 0) > 0).length}
            </span>
          </div>
          <div>•</div>
          <div>
            <span>Unsold Items: </span>
            <span className="font-bold text-rose-400">
              {itemLevelSales.filter((i) => (i.quantitySold || (i as any).totalQuantitySold || 0) === 0).length}
            </span>
          </div>
        </div>

        {/* Item Table */}
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4A2917] text-[#CDB99D]/70 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Item Name</th>
                <th className="pb-3 px-3">Category</th>
                <th className="pb-3 px-3">Unit Price</th>
                <th className="pb-3 px-3">Quantity Sold</th>
                <th className="pb-3 px-3">Total Sales</th>
                <th className="pb-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A2917]/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#CDB99D]">
                    Loading complete item list...
                  </td>
                </tr>
              ) : itemLevelSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#CDB99D]">
                    No menu items in database catalog.
                  </td>
                </tr>
              ) : (
                itemLevelSales
                  .filter((item) => {
                    if (selectedCategoryFilter === 'All') return true;
                    return item.category?.toLowerCase() === selectedCategoryFilter.toLowerCase();
                  })
                  .sort((a, b) => {
                    const qA = a.quantitySold ?? (a as any).totalQuantitySold ?? 0;
                    const qB = b.quantitySold ?? (b as any).totalQuantitySold ?? 0;
                    const sA = a.totalSales || 0;
                    const sB = b.totalSales || 0;
                    if (sortBy === 'quantity') return qB - qA;
                    if (sortBy === 'sales') return sB - sA;
                    return a.itemName.localeCompare(b.itemName);
                  })
                  .map((item) => {
                    const qty = item.quantitySold ?? (item as any).totalQuantitySold ?? 0;
                    const isSold = qty > 0;
                    return (
                      <tr key={item.itemName} className="hover:bg-[#2D1A10]/50 transition-colors">
                        <td className="py-3 px-3 font-serif font-bold text-[#F3E4CB]">
                          {item.itemName}
                        </td>
                        <td className="py-3 px-3 text-[#CDB99D]">
                          {item.category}
                        </td>
                        <td className="py-3 px-3 text-[#FFF4E3]">
                          {item.unitPrice} ETB
                        </td>
                        <td className={`py-3 px-3 font-mono font-bold ${isSold ? 'text-[#F3E4CB]' : 'text-[#CDB99D]/40'}`}>
                          {qty}
                        </td>
                        <td className={`py-3 px-3 font-mono font-bold ${isSold ? 'text-[#59D98A]' : 'text-[#CDB99D]/40'}`}>
                          {item.totalSales} ETB
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isSold ? (
                            <span className="inline-flex items-center gap-1 bg-[#59D98A]/10 text-[#59D98A] border border-[#59D98A]/30 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                              ● Sold
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-950/40 text-rose-400 border border-rose-800/40 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                              ○ Not Sold
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Historical Daily Breakdown Table */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#4A2917] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#8B5A2B]" />
            <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
              Daily Sales History
            </h2>
          </div>
          <span className="text-xs text-[#CDB99D] font-medium">
            Total {report?.dailyBreakdown.length || 0} active days
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4A2917] text-[#CDB99D]/70 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Date</th>
                <th className="pb-3 px-3">Orders</th>
                <th className="pb-3 px-3">Items Sold</th>
                <th className="pb-3 px-3">Avg Order</th>
                <th className="pb-3 px-3 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A2917]/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#CDB99D]">
                    Loading sales records...
                  </td>
                </tr>
              ) : !report?.dailyBreakdown || report.dailyBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#CDB99D]">
                    No sales history found for the selected period.
                  </td>
                </tr>
              ) : (
                report.dailyBreakdown.map((row) => (
                  <tr key={row.date} className="hover:bg-[#2D1A10]/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#F3E4CB]">
                      {row.date}
                    </td>
                    <td className="py-3 px-3 text-[#CDB99D]">
                      {row.orders} orders
                    </td>
                    <td className="py-3 px-3 text-[#CDB99D]">
                      {row.itemsSold} items
                    </td>
                    <td className="py-3 px-3 text-[#CDB99D]">
                      {row.averageOrder} ETB
                    </td>
                    <td className="py-3 px-3 text-right font-serif font-bold text-[#59D98A]">
                      {row.totalSales} ETB
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Close Today's Sales Confirmation Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#24140C] border border-[#4A2917] rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[#4A2917] pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-[#F3E4CB]">
                  Close Today's Register?
                </h3>
                <p className="text-xs text-[#CDB99D]">
                  Generate official daily sales summary for today ({report?.startDate})
                </p>
              </div>
            </div>

            {/* Summary Details */}
            <div className="bg-[#1A0D07] rounded-2xl p-4 border border-[#4A2917] space-y-2 text-xs">
              <div className="flex justify-between text-[#CDB99D]">
                <span>Today's Total Sales:</span>
                <span className="font-bold text-[#59D98A]">{report?.totalSales || 0} ETB</span>
              </div>
              <div className="flex justify-between text-[#CDB99D]">
                <span>Total Orders Recorded:</span>
                <span className="font-bold text-[#F3E4CB]">{report?.totalOrders || 0}</span>
              </div>
              <div className="flex justify-between text-[#CDB99D]">
                <span>Items Sold:</span>
                <span className="font-bold text-[#F3E4CB]">{report?.itemsSold || 0}</span>
              </div>
              <div className="flex justify-between text-[#CDB99D] border-t border-[#4A2917] pt-2">
                <span>Cash / Telebirr / Card:</span>
                <span className="font-bold text-[#FFF4E3]">
                  {report?.paymentBreakdown.cash || 0} / {report?.paymentBreakdown.telebirr || 0} / {report?.paymentBreakdown.card || 0} ETB
                </span>
              </div>
            </div>

            <p className="text-xs text-[#CDB99D]/80 leading-relaxed">
              Closing today's sales marks the register as finalized for reporting. Existing orders will remain safely saved in the system.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                disabled={isClosing}
                className="flex-1 bg-[#1A0D07] hover:bg-[#341B10] text-[#CDB99D] font-bold py-2.5 rounded-xl text-xs border border-[#4A2917]"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseDay}
                disabled={isClosing}
                className="flex-1 bg-[#8B5A2B] hover:bg-[#724820] text-[#FFF4E3] font-bold py-2.5 rounded-xl text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isClosing ? (
                  <span>Closing Register...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Confirm & Close</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
