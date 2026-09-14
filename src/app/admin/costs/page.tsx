'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  PieChart as PieIcon,
  Layers,
  Calculator,
  ToggleLeft,
  ToggleRight,
  Clock,
  ArrowUpRight,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';

interface CostItem {
  id: string;
  name: string;
  description?: string;
  costType: 'fixed_monthly' | 'sales_percentage';
  amount?: number;
  percentage?: number;
  active: boolean;
  createdAt: string;
}

interface FixedBreakdownItem {
  id: string;
  name: string;
  description?: string;
  monthlyAmount: number;
  dailyEquivalent: number;
  periodAmount: number;
  active: boolean;
}

interface PercentageBreakdownItem {
  id: string;
  name: string;
  description?: string;
  percentage: number;
  calculatedAmount: number;
  active: boolean;
}

interface DailyBreakdownRow {
  date: string;
  sales: number;
  fixedCosts: number;
  percentageCosts: number;
  totalCosts: number;
  estimatedRemaining: number;
  fixedItems: { name: string; amount: number }[];
  percentageItems: { name: string; percentage: number; amount: number }[];
}

interface ReportData {
  period: string;
  startDate: string;
  endDate: string;
  daysInMonth: number;
  totalSales: number;
  totalFixedCosts: number;
  totalPercentageCosts: number;
  totalCosts: number;
  estimatedRemaining: number;
  costPercentage: number;
  costs: CostItem[];
  fixedBreakdown: FixedBreakdownItem[];
  percentageBreakdown: PercentageBreakdownItem[];
  dailyBreakdown: DailyBreakdownRow[];
}

export default function CostsPage() {
  const [period, setPeriod] = useState<string>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Daily Breakdown Date Selector
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dailyDetail, setDailyDetail] = useState<ReportData | null>(null);
  const [isDailyLoading, setIsDailyLoading] = useState(false);

  // Monthly Overview Selector
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // e.g. "2026-09"
  );
  const [monthlyDetail, setMonthlyDetail] = useState<ReportData | null>(null);
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);

  // Modal State for Add / Edit Cost
  const [showModal, setShowModal] = useState(false);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  
  const [costType, setCostType] = useState<'fixed_monthly' | 'sales_percentage'>('fixed_monthly');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  const [active, setActive] = useState(true);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Main Report Fetch
  const fetchReport = async () => {
    try {
      setIsLoading(true);
      let url = `/api/costs?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to fetch cost reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Daily Detail Fetch
  const fetchDailyDetail = async (dateStr: string) => {
    try {
      setIsDailyLoading(true);
      const res = await fetch(`/api/costs?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setDailyDetail(data);
      }
    } catch (err) {
      console.error('Failed to fetch daily breakdown:', err);
    } finally {
      setIsDailyLoading(false);
    }
  };

  // Monthly Detail Fetch
  const fetchMonthlyDetail = async (monthStr: string) => {
    try {
      setIsMonthlyLoading(true);
      const res = await fetch(`/api/costs?month=${monthStr}`);
      if (res.ok) {
        const data = await res.json();
        setMonthlyDetail(data);
      }
    } catch (err) {
      console.error('Failed to fetch monthly breakdown:', err);
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period]);

  useEffect(() => {
    fetchDailyDetail(selectedDailyDate);
  }, [selectedDailyDate]);

  useEffect(() => {
    fetchMonthlyDetail(selectedMonth);
  }, [selectedMonth]);

  const handleCustomFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (period === 'custom' && startDate && endDate) {
      fetchReport();
    }
  };

  // Open Modal for Create or Edit
  const openAddModal = () => {
    setEditingCostId(null);
    setCostType('fixed_monthly');
    setName('');
    setDescription('');
    setAmount('');
    setPercentage('');
    setActive(true);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (c: CostItem) => {
    setEditingCostId(c.id);
    setCostType(c.costType);
    setName(c.name);
    setDescription(c.description || '');
    setAmount(c.amount !== undefined && c.amount !== null ? String(c.amount) : '');
    setPercentage(c.percentage !== undefined && c.percentage !== null ? String(c.percentage) : '');
    setActive(c.active);
    setFormError('');
    setShowModal(true);
  };

  // Submit Add/Edit Form
  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter a cost name');
      return;
    }

    if (costType === 'fixed_monthly') {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setFormError('Please enter a valid monthly amount greater than 0');
        return;
      }
    } else {
      const parsedPercentage = parseFloat(percentage);
      if (isNaN(parsedPercentage) || parsedPercentage <= 0 || parsedPercentage > 100) {
        setFormError('Please enter a valid percentage between 0 and 100');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        costType,
        amount: costType === 'fixed_monthly' ? parseFloat(amount) : undefined,
        percentage: costType === 'sales_percentage' ? parseFloat(percentage) : undefined,
        active,
      };

      const url = editingCostId ? `/api/costs/${editingCostId}` : '/api/costs';
      const method = editingCostId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingCostId ? `Cost "${name}" updated!` : `New cost "${name}" added!`);
        setShowModal(false);
        fetchReport();
        fetchDailyDetail(selectedDailyDate);
        fetchMonthlyDetail(selectedMonth);
      } else {
        const errData = await res.json();
        setFormError(errData.error || 'Failed to save cost');
      }
    } catch (err) {
      setFormError('Network error while saving cost');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Toggle Active State
  const toggleActiveStatus = async (c: CostItem) => {
    const newStatus = !c.active;
    try {
      const res = await fetch(`/api/costs/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newStatus }),
      });
      if (res.ok) {
        showToast(`"${c.name}" is now ${newStatus ? 'Active' : 'Inactive'}`);
        fetchReport();
        fetchDailyDetail(selectedDailyDate);
        fetchMonthlyDetail(selectedMonth);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Cost Item
  const handleDeleteCost = async (id: string, nameStr: string) => {
    try {
      const res = await fetch(`/api/costs/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(`Cost "${nameStr}" deleted.`);
        setDeleteConfirmId(null);
        fetchReport();
        fetchDailyDetail(selectedDailyDate);
        fetchMonthlyDetail(selectedMonth);
      }
    } catch (err) {
      console.error(err);
    }
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

      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB] tracking-tight">
            💰 Costs & Expenses
          </h1>
          <p className="text-xs sm:text-sm text-[#CDB99D] mt-0.5 font-medium">
            Manage fixed monthly expenses, percentage-based sales costs, and calculated net profit
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/admin/export?period=1month"
            className="inline-flex items-center gap-2 bg-[#1A0D07] hover:bg-[#341B10] text-[#FFF4E3] border border-[#4A2917] px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#8B5A2B]" />
            <span>Export Excel</span>
          </Link>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-[#8B5A2B] hover:bg-[#724820] text-[#FFF4E3] px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 border border-[#F3E4CB]/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Cost</span>
          </button>
        </div>
      </div>

      {/* 1. VISUAL SUMMARY CARDS (Top KPI Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's / Selected Period Sales */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6 text-[#59D98A]" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
              Today's Sales
            </div>
            <div className="text-xl sm:text-2xl font-serif font-extrabold text-[#F3E4CB]">
              {isLoading ? '...' : `${report?.totalSales || 0} ETB`}
            </div>
          </div>
        </div>

        {/* Today's / Selected Period Costs */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0">
            <Calculator className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
              Total Costs
            </div>
            <div className="text-xl sm:text-2xl font-serif font-extrabold text-[#F3E4CB]">
              {isLoading ? '...' : `${report?.totalCosts || 0} ETB`}
            </div>
          </div>
        </div>

        {/* Remaining / Estimated Profit */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
              Estimated Remaining
            </div>
            <div className={`text-xl sm:text-2xl font-serif font-extrabold ${
              (report?.estimatedRemaining || 0) >= 0 ? 'text-[#59D98A]' : 'text-rose-400'
            }`}>
              {isLoading ? '...' : `${report?.estimatedRemaining || 0} ETB`}
            </div>
          </div>
        </div>

        {/* Cost Percentage */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0">
            <PieIcon className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
              Cost Percentage
            </div>
            <div className="text-xl sm:text-2xl font-serif font-extrabold text-[#F3E4CB]">
              {isLoading ? '...' : `${report?.costPercentage || 0}%`}
            </div>
          </div>
        </div>

      </div>

      {/* 2. MONTHLY FIXED COSTS TABLE */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#4A2917] pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
              Monthly Fixed Costs
            </h2>
            <p className="text-xs text-[#CDB99D]">
              Recurring fixed expenses (Rent, Salaries, Bills) automatically converted to Daily Equivalent for daily reports
            </p>
          </div>
          <span className="text-xs font-bold text-[#59D98A] bg-[#1A0D07] px-3 py-1 rounded-lg border border-[#4A2917]">
            Total Fixed: {report?.totalFixedCosts || 0} ETB
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4A2917] text-[#CDB99D]/70 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Cost Name</th>
                <th className="pb-3 px-3">Description</th>
                <th className="pb-3 px-3">Monthly Amount</th>
                <th className="pb-3 px-3">Daily Equivalent</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A2917]/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[#CDB99D]">
                    Loading fixed costs...
                  </td>
                </tr>
              ) : !report?.fixedBreakdown || report.fixedBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[#CDB99D]">
                    No monthly fixed costs configured. Click "+ Add Cost" to add one.
                  </td>
                </tr>
              ) : (
                report.fixedBreakdown.map((item) => (
                  <tr key={item.id} className="hover:bg-[#2D1A10]/50 transition-colors">
                    <td className="py-3 px-3 font-serif font-bold text-[#F3E4CB]">
                      {item.name}
                    </td>
                    <td className="py-3 px-3 text-[#CDB99D]/80">
                      {item.description || '—'}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#FFF4E3]">
                      {item.monthlyAmount} ETB <span className="text-[10px] text-[#CDB99D]/60">/month</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#59D98A]">
                      {item.dailyEquivalent} ETB <span className="text-[10px] text-[#CDB99D]/60">/day</span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => {
                          const costObj = report.costs.find((c) => c.id === item.id);
                          if (costObj) toggleActiveStatus(costObj);
                        }}
                        className={`inline-flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                          item.active
                            ? 'bg-[#59D98A]/10 text-[#59D98A] border-[#59D98A]/30'
                            : 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-[#59D98A]' : 'bg-rose-500'}`} />
                        <span>{item.active ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            const costObj = report.costs.find((c) => c.id === item.id);
                            if (costObj) openEditModal(costObj);
                          }}
                          className="inline-flex items-center gap-1 bg-[#8B5A2B]/40 hover:bg-[#8B5A2B] text-[#FFF4E3] font-semibold px-2.5 py-1 rounded-lg border border-[#8B5A2B]/60 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {deleteConfirmId === item.id ? (
                          <button
                            onClick={() => handleDeleteCost(item.id, item.name)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="bg-rose-950/60 hover:bg-rose-800 text-rose-300 font-semibold px-2.5 py-1 rounded-lg border border-rose-800/60 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. SALES PERCENTAGE COSTS TABLE */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#4A2917] pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
              Sales Percentage Costs
            </h2>
            <p className="text-xs text-[#CDB99D]">
              Variable costs calculated dynamically from daily order sales (e.g. Raw Materials 20%, Variable Staff 5%)
            </p>
          </div>
          <span className="text-xs font-bold text-[#59D98A] bg-[#1A0D07] px-3 py-1 rounded-lg border border-[#4A2917]">
            Total % Costs: {report?.totalPercentageCosts || 0} ETB
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4A2917] text-[#CDB99D]/70 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Cost Name</th>
                <th className="pb-3 px-3">Description</th>
                <th className="pb-3 px-3">Percentage (%)</th>
                <th className="pb-3 px-3">Calculated Amount</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A2917]/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[#CDB99D]">
                    Loading percentage costs...
                  </td>
                </tr>
              ) : !report?.percentageBreakdown || report.percentageBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[#CDB99D]">
                    No percentage-based costs configured. Click "+ Add Cost" to create one.
                  </td>
                </tr>
              ) : (
                report.percentageBreakdown.map((item) => (
                  <tr key={item.id} className="hover:bg-[#2D1A10]/50 transition-colors">
                    <td className="py-3 px-3 font-serif font-bold text-[#F3E4CB]">
                      {item.name}
                    </td>
                    <td className="py-3 px-3 text-[#CDB99D]/80">
                      {item.description || '—'}
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-400">
                      {item.percentage}%
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#59D98A]">
                      {item.calculatedAmount} ETB
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => {
                          const costObj = report.costs.find((c) => c.id === item.id);
                          if (costObj) toggleActiveStatus(costObj);
                        }}
                        className={`inline-flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                          item.active
                            ? 'bg-[#59D98A]/10 text-[#59D98A] border-[#59D98A]/30'
                            : 'bg-rose-950/40 text-rose-400 border-rose-800/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-[#59D98A]' : 'bg-rose-500'}`} />
                        <span>{item.active ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            const costObj = report.costs.find((c) => c.id === item.id);
                            if (costObj) openEditModal(costObj);
                          }}
                          className="inline-flex items-center gap-1 bg-[#8B5A2B]/40 hover:bg-[#8B5A2B] text-[#FFF4E3] font-semibold px-2.5 py-1 rounded-lg border border-[#8B5A2B]/60 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {deleteConfirmId === item.id ? (
                          <button
                            onClick={() => handleDeleteCost(item.id, item.name)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="bg-rose-950/60 hover:bg-rose-800 text-rose-300 font-semibold px-2.5 py-1 rounded-lg border border-rose-800/60 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. DAILY COST BREAKDOWN SECTION */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#4A2917] pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
              Daily Cost Breakdown
            </h2>
            <p className="text-xs text-[#CDB99D]">
              Inspect itemized daily costs and net remaining for any specific date
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8B5A2B]" />
            <input
              type="date"
              value={selectedDailyDate}
              onChange={(e) => setSelectedDailyDate(e.target.value)}
              className="bg-[#1A0D07] border border-[#4A2917] text-[#F3E4CB] text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-[#8B5A2B]"
            />
          </div>
        </div>

        {isDailyLoading ? (
          <p className="text-center py-6 text-xs text-[#CDB99D]">Loading daily breakdown...</p>
        ) : !dailyDetail?.dailyBreakdown || dailyDetail.dailyBreakdown.length === 0 ? (
          <p className="text-center py-6 text-xs text-[#CDB99D]">No data for selected date.</p>
        ) : (
          (() => {
            const dayRow = dailyDetail.dailyBreakdown[0];
            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Summary Card */}
                <div className="lg:col-span-5 bg-[#1A0D07] p-5 rounded-2xl border border-[#4A2917] space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#CDB99D] border-b border-[#4A2917] pb-2">
                    Financial Summary for {selectedDailyDate}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[#CDB99D]">
                      <span>Daily Sales:</span>
                      <span className="font-bold text-[#F3E4CB]">{dayRow.sales} ETB</span>
                    </div>

                    <div className="flex justify-between text-[#CDB99D]">
                      <span>Fixed Cost Daily Equivalents:</span>
                      <span className="font-bold text-[#FFF4E3]">{dayRow.fixedCosts} ETB</span>
                    </div>

                    <div className="flex justify-between text-[#CDB99D]">
                      <span>Percentage Costs:</span>
                      <span className="font-bold text-[#FFF4E3]">{dayRow.percentageCosts} ETB</span>
                    </div>

                    <div className="flex justify-between text-[#CDB99D] border-t border-[#4A2917] pt-2">
                      <span>Total Daily Cost:</span>
                      <span className="font-bold text-rose-400">{dayRow.totalCosts} ETB</span>
                    </div>

                    <div className="flex justify-between text-sm border-t border-[#4A2917] pt-3 font-serif font-extrabold">
                      <span className="text-[#F3E4CB]">Estimated Remaining:</span>
                      <span className={dayRow.estimatedRemaining >= 0 ? 'text-[#59D98A]' : 'text-rose-400'}>
                        {dayRow.estimatedRemaining} ETB
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Itemized Items */}
                <div className="lg:col-span-7 space-y-4">
                  
                  {/* Fixed Cost Items */}
                  <div className="bg-[#1A0D07] p-4 rounded-2xl border border-[#4A2917] space-y-2">
                    <div className="text-xs font-bold text-[#F3E4CB] uppercase tracking-wider">
                      Fixed Costs (Daily Equivalent)
                    </div>
                    <div className="space-y-1.5 text-xs text-[#CDB99D]">
                      {dayRow.fixedItems.length === 0 ? (
                        <p className="text-[11px]">No active fixed costs.</p>
                      ) : (
                        dayRow.fixedItems.map((fi, idx) => (
                          <div key={idx} className="flex justify-between p-2 bg-[#24140C] rounded-lg">
                            <span>{fi.name}</span>
                            <span className="font-mono text-[#FFF4E3]">{fi.amount} ETB/day</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Percentage Cost Items */}
                  <div className="bg-[#1A0D07] p-4 rounded-2xl border border-[#4A2917] space-y-2">
                    <div className="text-xs font-bold text-[#F3E4CB] uppercase tracking-wider">
                      Percentage Costs (Based on {dayRow.sales} ETB Sales)
                    </div>
                    <div className="space-y-1.5 text-xs text-[#CDB99D]">
                      {dayRow.percentageItems.length === 0 ? (
                        <p className="text-[11px]">No active percentage costs.</p>
                      ) : (
                        dayRow.percentageItems.map((pi, idx) => (
                          <div key={idx} className="flex justify-between p-2 bg-[#24140C] rounded-lg">
                            <span>{pi.name} ({pi.percentage}%)</span>
                            <span className="font-mono text-[#59D98A]">{pi.amount} ETB</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

              </div>
            );
          })()
        )}
      </div>

      {/* 5. MONTHLY OVERVIEW SECTION */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#4A2917] pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
              Monthly Overview
            </h2>
            <p className="text-xs text-[#CDB99D]">
              Full monthly calculation comparing total monthly sales, fixed costs, and percentage costs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8B5A2B]" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#1A0D07] border border-[#4A2917] text-[#F3E4CB] text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-[#8B5A2B]"
            />
          </div>
        </div>

        {isMonthlyLoading ? (
          <p className="text-center py-6 text-xs text-[#CDB99D]">Loading monthly report...</p>
        ) : !monthlyDetail ? (
          <p className="text-center py-6 text-xs text-[#CDB99D]">No monthly data available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Monthly Cards */}
            <div className="md:col-span-6 space-y-3 text-xs">
              
              <div className="bg-[#1A0D07] p-4 rounded-xl border border-[#4A2917] flex justify-between items-center">
                <span className="font-bold text-[#CDB99D]">Monthly Total Sales:</span>
                <span className="text-lg font-serif font-extrabold text-[#F3E4CB]">
                  {monthlyDetail.totalSales} ETB
                </span>
              </div>

              <div className="bg-[#1A0D07] p-4 rounded-xl border border-[#4A2917] flex justify-between items-center">
                <span className="font-bold text-[#CDB99D]">Total Monthly Fixed Costs:</span>
                <span className="text-lg font-serif font-extrabold text-rose-300">
                  {monthlyDetail.totalFixedCosts} ETB
                </span>
              </div>

              <div className="bg-[#1A0D07] p-4 rounded-xl border border-[#4A2917] flex justify-between items-center">
                <span className="font-bold text-[#CDB99D]">Total Sales Percentage Costs:</span>
                <span className="text-lg font-serif font-extrabold text-amber-300">
                  {monthlyDetail.totalPercentageCosts} ETB
                </span>
              </div>

              <div className="bg-[#1A0D07] p-4 rounded-xl border border-[#4A2917] flex justify-between items-center">
                <span className="font-bold text-[#CDB99D]">Total Combined Costs:</span>
                <span className="text-lg font-serif font-extrabold text-rose-400">
                  {monthlyDetail.totalCosts} ETB
                </span>
              </div>

              <div className="bg-[#8B5A2B]/20 p-4 rounded-xl border border-[#8B5A2B]/50 flex justify-between items-center">
                <span className="font-serif font-bold text-[#F3E4CB]">Estimated Remaining Profit:</span>
                <span className={`text-xl font-serif font-extrabold ${
                  monthlyDetail.estimatedRemaining >= 0 ? 'text-[#59D98A]' : 'text-rose-400'
                }`}>
                  {monthlyDetail.estimatedRemaining} ETB
                </span>
              </div>

            </div>

            {/* Monthly Breakdowns List */}
            <div className="md:col-span-6 space-y-4">
              
              <div className="bg-[#1A0D07] p-4 rounded-xl border border-[#4A2917] space-y-2 text-xs">
                <div className="font-bold text-[#F3E4CB] uppercase tracking-wider border-b border-[#4A2917] pb-1.5">
                  Fixed Costs Breakdown
                </div>
                {monthlyDetail.fixedBreakdown.map((f) => (
                  <div key={f.id} className="flex justify-between text-[#CDB99D] py-1">
                    <span>{f.name}</span>
                    <span className="font-mono text-[#FFF4E3]">{f.monthlyAmount} ETB</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#1A0D07] p-4 rounded-xl border border-[#4A2917] space-y-2 text-xs">
                <div className="font-bold text-[#F3E4CB] uppercase tracking-wider border-b border-[#4A2917] pb-1.5">
                  Percentage Costs Breakdown
                </div>
                {monthlyDetail.percentageBreakdown.map((p) => (
                  <div key={p.id} className="flex justify-between text-[#CDB99D] py-1">
                    <span>{p.name} ({p.percentage}%)</span>
                    <span className="font-mono text-[#59D98A]">{p.calculatedAmount} ETB</span>
                  </div>
                ))}
              </div>

            </div>

          </div>
        )}
      </div>

      {/* 6. COST HISTORY SECTION */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#4A2917] pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
              Cost History & Period Selector
            </h2>
            <p className="text-xs text-[#CDB99D]">
              Filter overall financial performance by historical timeframes
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'previous_month', label: 'Previous Month' },
              { id: 'custom', label: 'Custom' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  period === tab.id
                    ? 'bg-[#8B5A2B] text-[#FFF4E3] border border-[#F3E4CB]/30'
                    : 'bg-[#1A0D07] text-[#CDB99D] hover:bg-[#2D1A10] border border-[#4A2917]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <form onSubmit={handleCustomFilterSubmit} className="flex items-center gap-2 pt-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#1A0D07] border border-[#4A2917] text-[#F3E4CB] text-xs px-3 py-1.5 rounded-xl"
              required
            />
            <span className="text-[#CDB99D] text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#1A0D07] border border-[#4A2917] text-[#F3E4CB] text-xs px-3 py-1.5 rounded-xl"
              required
            />
            <button
              type="submit"
              className="bg-[#8B5A2B] text-[#FFF4E3] text-xs font-bold px-4 py-1.5 rounded-xl hover:bg-[#724820]"
            >
              Filter
            </button>
          </form>
        )}

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4A2917] text-[#CDB99D]/70 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Date</th>
                <th className="pb-3 px-3">Sales</th>
                <th className="pb-3 px-3">Fixed Costs</th>
                <th className="pb-3 px-3">% Costs</th>
                <th className="pb-3 px-3">Total Costs</th>
                <th className="pb-3 px-3 text-right">Remaining Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A2917]/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[#CDB99D]">
                    Loading history...
                  </td>
                </tr>
              ) : !report?.dailyBreakdown || report.dailyBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[#CDB99D]">
                    No historical records found for selected period.
                  </td>
                </tr>
              ) : (
                report.dailyBreakdown.map((row) => (
                  <tr key={row.date} className="hover:bg-[#2D1A10]/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#F3E4CB]">
                      {row.date}
                    </td>
                    <td className="py-3 px-3 text-[#FFF4E3]">
                      {row.sales} ETB
                    </td>
                    <td className="py-3 px-3 text-[#CDB99D]">
                      {row.fixedCosts} ETB
                    </td>
                    <td className="py-3 px-3 text-[#CDB99D]">
                      {row.percentageCosts} ETB
                    </td>
                    <td className="py-3 px-3 font-bold text-rose-400">
                      {row.totalCosts} ETB
                    </td>
                    <td className={`py-3 px-3 text-right font-serif font-bold ${
                      row.estimatedRemaining >= 0 ? 'text-[#59D98A]' : 'text-rose-400'
                    }`}>
                      {row.estimatedRemaining} ETB
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. ADD / EDIT COST MODAL FORM */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#24140C] border border-[#4A2917] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#4A2917] pb-3">
              <h3 className="text-lg font-serif font-bold text-[#F3E4CB]">
                {editingCostId ? 'Edit Cost' : '+ Add New Cost'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#CDB99D] hover:text-[#F3E4CB] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-950/80 border border-rose-700 text-rose-200 text-xs p-3 rounded-xl font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCost} className="space-y-4">
              
              {/* Cost Type Selector */}
              <div>
                <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                  Cost Type *
                </label>
                <select
                  value={costType}
                  onChange={(e) => setCostType(e.target.value as 'fixed_monthly' | 'sales_percentage')}
                  className="w-full px-4 py-2.5 text-xs bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] focus:outline-none focus:border-[#8B5A2B]"
                >
                  <option value="fixed_monthly">Fixed Monthly Cost (e.g. Rent, Salary)</option>
                  <option value="sales_percentage">Percentage of Sales (e.g. Raw Materials %)</option>
                </select>
              </div>

              {/* Cost Name */}
              <div>
                <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                  Cost Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. House/Shop Rent, Coffee Beans"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Notes or vendor details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B]"
                />
              </div>

              {/* Dynamic Value Input: Amount or Percentage */}
              {costType === 'fixed_monthly' ? (
                <div>
                  <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                    Monthly Amount (ETB) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 15000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                    Percentage of Daily Sales (%) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 20"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B]"
                  />
                </div>
              )}

              {/* Active Toggle */}
              <div className="bg-[#1A0D07] p-3 rounded-xl border border-[#4A2917] flex items-center justify-between">
                <span className="text-xs font-bold text-[#F3E4CB]">Status</span>
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                    active
                      ? 'bg-[#59D98A]/20 text-[#59D98A] border-[#59D98A]/50'
                      : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                  }`}
                >
                  {active ? 'Active' : 'Inactive'}
                </button>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-[#1A0D07] text-[#CDB99D] hover:bg-[#341B10] font-bold py-2.5 rounded-xl text-xs border border-[#4A2917]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#8B5A2B] hover:bg-[#724820] text-[#FFF4E3] font-bold py-2.5 rounded-xl text-xs shadow-lg transition-all active:scale-95"
                >
                  {isSubmitting ? 'Saving...' : 'Save Cost'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
