'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Coffee,
  Leaf,
  Droplet,
  Plus,
  Edit2,
  Trash2,
  List,
  CheckCircle2,
  Upload,
  Check,
  Clock,
  DollarSign,
  ShoppingBag,
  Calculator,
  TrendingUp,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  category: Category;
  price: number;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
}

interface Activity {
  id: string;
  action: string;
  details: string;
  type: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [itemsSoldToday, setItemsSoldToday] = useState(0);

  const [todayCosts, setTodayCosts] = useState(0);
  const [todayRemaining, setTodayRemaining] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [monthCosts, setMonthCosts] = useState(0);
  const [monthRemaining, setMonthRemaining] = useState(0);

  const [isLoading, setIsLoading] = useState(true);

  // Form State for Inline Add Item
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const [itemRes, catRes, actRes, reportRes, todayCostsRes, monthCostsRes] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/categories'),
        fetch('/api/activity'),
        fetch('/api/reports?period=today'),
        fetch('/api/costs?period=today'),
        fetch('/api/costs?period=this_month'),
      ]);

      if (itemRes.ok) {
        const itemData = await itemRes.json();
        setItems(itemData);
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
        if (catData.length > 0 && !categoryId) {
          setCategoryId(catData[0].id);
        }
      }
      if (actRes.ok) {
        setActivities(await actRes.json());
      }
      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setTodaySales(reportData.totalSales || 0);
        setTodayOrders(reportData.totalOrders || 0);
        setItemsSoldToday(reportData.itemsSold || 0);
      }
      if (todayCostsRes.ok) {
        const todayCostData = await todayCostsRes.json();
        setTodayCosts(todayCostData.totalCosts || 0);
        setTodayRemaining(todayCostData.estimatedRemaining || 0);
      }
      if (monthCostsRes.ok) {
        const monthCostData = await monthCostsRes.json();
        setMonthSales(monthCostData.totalSales || 0);
        setMonthCosts(monthCostData.totalCosts || 0);
        setMonthRemaining(monthCostData.estimatedRemaining || 0);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
      } else {
        setError('Failed to upload image');
      }
    } catch (err) {
      setError('Error uploading image file');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Add Item Submit
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter item name');
      return;
    }
    if (!categoryId) {
      setError('Please select a category');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Please enter a valid price (e.g. 50)');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          categoryId,
          price: parsedPrice,
          imageUrl,
          isAvailable,
        }),
      });

      if (res.ok) {
        showToast(`Item "${name}" added successfully!`);
        setName('');
        setDescription('');
        setPrice('');
        setImageUrl('');
        setIsAvailable(true);
        fetchDashboardData();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to add item');
      }
    } catch (err) {
      setError('Network error while adding item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Availability Toggle
  const toggleAvailability = async (item: MenuItem) => {
    const newStatus = !item.isAvailable;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: newStatus } : i))
    );

    try {
      const res = await fetch(`/api/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: newStatus }),
      });
      if (res.ok) {
        showToast(
          `"${item.name}" availability set to ${newStatus ? 'Available' : 'Unavailable'}`
        );
        fetchDashboardData();
      }
    } catch (err) {
      fetchDashboardData();
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: string, itemName: string) => {
    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Item "${itemName}" deleted.`);
        setDeleteConfirmId(null);
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dynamic Statistics Calculation
  const totalItems = items.length;
  const teaCount = items.filter((i) =>
    i.category?.name.toLowerCase().includes('tea')
  ).length;
  const coffeeCount = items.filter((i) =>
    i.category?.name.toLowerCase().includes('coffee')
  ).length;
  const waterCount = items.filter((i) =>
    i.category?.name.toLowerCase().includes('water')
  ).length;

  return (
    <div className="space-y-8">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#8B5A2B] text-[#FFF4E3] px-5 py-3 rounded-2xl shadow-2xl border border-[#F3E4CB]/40 flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4 text-[#59D98A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Dashboard Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB] tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-[#CDB99D] mt-0.5 font-medium">
          Manage your coffee shop menu and items
        </p>
      </div>

      {/* 1. DYNAMIC STATISTIC CARDS */}
      <div className="space-y-4">
        
        {/* Today's Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Today's Sales */}
          <Link href="/admin/reports" className="bg-[#24140C] rounded-2xl p-4 sm:p-5 border border-[#4A2917] shadow-lg flex items-center gap-4 hover:border-[#8B5A2B] transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <DollarSign className="w-6 h-6 text-[#59D98A]" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
                Today's Sales
              </div>
              <div className="text-xl sm:text-2xl font-serif font-extrabold text-[#F3E4CB]">
                {isLoading ? '...' : `${todaySales} ETB`}
              </div>
            </div>
          </Link>

          {/* Today's Costs */}
          <Link href="/admin/costs" className="bg-[#24140C] rounded-2xl p-4 sm:p-5 border border-[#4A2917] shadow-lg flex items-center gap-4 hover:border-[#8B5A2B] transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Calculator className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
                Today's Costs
              </div>
              <div className="text-xl sm:text-2xl font-serif font-extrabold text-[#F3E4CB]">
                {isLoading ? '...' : `${todayCosts} ETB`}
              </div>
            </div>
          </Link>

          {/* Today's Remaining */}
          <Link href="/admin/costs" className="bg-[#24140C] rounded-2xl p-4 sm:p-5 border border-[#4A2917] shadow-lg flex items-center gap-4 hover:border-[#8B5A2B] transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
                Today's Remaining
              </div>
              <div className={`text-xl sm:text-2xl font-serif font-extrabold ${
                todayRemaining >= 0 ? 'text-[#59D98A]' : 'text-rose-400'
              }`}>
                {isLoading ? '...' : `${todayRemaining} ETB`}
              </div>
            </div>
          </Link>

          {/* Available Items */}
          <Link href="/admin/menu" className="bg-[#24140C] rounded-2xl p-4 sm:p-5 border border-[#4A2917] shadow-lg flex items-center gap-4 hover:border-[#8B5A2B] transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-[#4A2917]/50 border border-[#8B5A2B]/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Leaf className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
                Available Items
              </div>
              <div className="text-xl sm:text-2xl font-serif font-extrabold text-[#F3E4CB]">
                {isLoading ? '...' : items.filter((i) => i.isAvailable).length} / {items.length}
              </div>
            </div>
          </Link>

        </div>

        {/* This Month's Financial Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <Link href="/admin/reports" className="bg-[#1A0D07] rounded-2xl p-4 border border-[#4A2917] flex items-center justify-between hover:border-[#8B5A2B] transition-colors">
            <div className="text-xs font-bold text-[#CDB99D] uppercase tracking-wider">
              This Month's Sales
            </div>
            <div className="text-lg font-serif font-extrabold text-[#F3E4CB]">
              {isLoading ? '...' : `${monthSales} ETB`}
            </div>
          </Link>

          <Link href="/admin/costs" className="bg-[#1A0D07] rounded-2xl p-4 border border-[#4A2917] flex items-center justify-between hover:border-[#8B5A2B] transition-colors">
            <div className="text-xs font-bold text-[#CDB99D] uppercase tracking-wider">
              This Month's Costs
            </div>
            <div className="text-lg font-serif font-extrabold text-rose-300">
              {isLoading ? '...' : `${monthCosts} ETB`}
            </div>
          </Link>

          <Link href="/admin/costs" className="bg-[#1A0D07] rounded-2xl p-4 border border-[#4A2917] flex items-center justify-between hover:border-[#8B5A2B] transition-colors">
            <div className="text-xs font-bold text-[#CDB99D] uppercase tracking-wider">
              This Month's Remaining
            </div>
            <div className={`text-lg font-serif font-extrabold ${
              monthRemaining >= 0 ? 'text-[#59D98A]' : 'text-rose-400'
            }`}>
              {isLoading ? '...' : `${monthRemaining} ETB`}
            </div>
          </Link>

        </div>

      </div>

      {/* 2. RECENT MENU ITEMS TABLE (Reference Image Match) */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
        
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-[#F3E4CB]">
            Recent Menu Items
          </h2>
          <Link
            href="/admin/menu"
            className="text-xs font-bold text-[#CDB99D] hover:text-[#F3E4CB] bg-[#1A0D07] px-3 py-1.5 rounded-lg border border-[#4A2917]"
          >
            View All
          </Link>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4A2917] text-[#CDB99D]/70 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-2">Image</th>
                <th className="pb-3 px-2">Name</th>
                <th className="pb-3 px-2">Category</th>
                <th className="pb-3 px-2">Price</th>
                <th className="pb-3 px-2">Status</th>
                <th className="pb-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A2917]/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#CDB99D]">
                    Loading menu items...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#CDB99D]">
                    No menu items in database.
                  </td>
                </tr>
              ) : (
                items.slice(0, 7).map((item) => (
                  <tr key={item.id} className="hover:bg-[#2D1A10]/50 transition-colors">
                    
                    {/* Image */}
                    <td className="py-2.5 px-2">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#4A2917] bg-[#1A0D07] shrink-0">
                        <SafeImage
                          src={item.imageUrl}
                          alt={item.name}
                          categoryName={item.category?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-2 font-serif font-bold text-[#F3E4CB]">
                      {item.name}
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-2 text-[#CDB99D]">
                      {item.category?.name}
                    </td>

                    {/* Price */}
                    <td className="py-2.5 px-2 font-bold text-[#FFF4E3]">
                      {item.price} ETB
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-2">
                      <button
                        onClick={() => toggleAvailability(item)}
                        className="inline-flex items-center gap-1.5 font-semibold text-xs"
                      >
                        {item.isAvailable ? (
                          <span className="inline-flex items-center gap-1.5 text-[#59D98A]">
                            <span className="w-2 h-2 rounded-full bg-[#59D98A]" />
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-400">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            Unavailable
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/menu/${item.id}/edit`}
                          className="inline-flex items-center gap-1 bg-[#8B5A2B]/40 hover:bg-[#8B5A2B] text-[#FFF4E3] font-semibold px-2.5 py-1 rounded-lg border border-[#8B5A2B]/60 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </Link>

                        {deleteConfirmId === item.id ? (
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
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

      {/* 3. QUICK ACTIONS & RECENT ACTIVITY GRID (Reference Image Match) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Quick Actions */}
        <div className="lg:col-span-6 bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-xl space-y-4">
          <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
            Quick Actions
          </h2>

          <div className="grid grid-cols-2 gap-4">
            
            <a
              href="#add-new-item-form"
              className="bg-[#4A2917] hover:bg-[#8B5A2B] text-[#FFF4E3] p-6 rounded-2xl border border-[#8B5A2B]/60 flex flex-col items-center justify-center gap-2 text-center transition-all shadow-lg active:scale-95 group"
            >
              <Plus className="w-8 h-8 text-[#F3E4CB] group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm">Add New Item</span>
            </a>

            <Link
              href="/admin/menu"
              className="bg-[#1A0D07] hover:bg-[#2D1A10] text-[#CDB99D] hover:text-[#F3E4CB] p-6 rounded-2xl border border-[#4A2917] flex flex-col items-center justify-center gap-2 text-center transition-all shadow-lg active:scale-95 group"
            >
              <List className="w-8 h-8 text-[#8B5A2B] group-hover:scale-110 transition-transform" />
              <span className="font-bold text-sm">View All Items</span>
            </Link>

          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-6 bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-xl space-y-3">
          <h2 className="text-base font-serif font-bold text-[#F3E4CB]">
            Recent Activity
          </h2>

          <div className="space-y-2.5 text-xs text-[#CDB99D]">
            {activities.length === 0 ? (
              <p className="text-center py-4">No recent activity logs.</p>
            ) : (
              activities.slice(0, 4).map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-2.5 bg-[#1A0D07]/60 rounded-xl border border-[#4A2917]/50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#8B5A2B]" />
                    <span className="font-bold text-[#F3E4CB]">{act.action}</span>
                  </div>
                  <span className="text-[11px] text-[#CDB99D]/60 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Recently
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 4. ADD NEW MENU ITEM FORM (Reference Image Match) */}
      <div id="add-new-item-form" className="bg-[#24140C] rounded-2xl p-6 border border-[#4A2917] shadow-xl space-y-6">
        
        <div>
          <h2 className="text-lg font-serif font-bold text-[#F3E4CB]">
            Add New Menu Item
          </h2>
          <p className="text-xs text-[#CDB99D] mt-0.5">
            Fill in the item details to update the database and public menu instantly.
          </p>
        </div>

        {error && (
          <div className="bg-rose-950/80 border border-rose-700 text-rose-200 text-xs p-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Form Controls Left Column */}
          <div className="md:col-span-8 space-y-4">
            
            {/* Item Name */}
            <div>
              <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                Item Name *
              </label>
              <input
                type="text"
                required
                placeholder="Enter item name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                Description *
              </label>
              <input
                type="text"
                required
                placeholder="Enter short description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] focus:outline-none focus:border-[#8B5A2B]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#1A0D07]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                Price (ETB) *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="Enter price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#1A0D07] border border-[#4A2917] rounded-xl text-[#F3E4CB] placeholder-[#CDB99D]/40 focus:outline-none focus:border-[#8B5A2B]"
              />
            </div>

            {/* Image File Upload */}
            <div>
              <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                Image *
              </label>
              <label className="flex items-center gap-2 bg-[#1A0D07] border border-[#4A2917] hover:border-[#8B5A2B] text-[#CDB99D] px-4 py-2.5 rounded-xl cursor-pointer text-xs font-medium transition-colors">
                <Upload className="w-4 h-4 text-[#8B5A2B]" />
                <span>{isUploading ? 'Uploading image...' : 'Choose File / Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>

          </div>

          {/* Form Right Column: Image Preview Box & Availability */}
          <div className="md:col-span-4 flex flex-col justify-between space-y-4">
            
            {/* Image Preview Box (Reference Image Match) */}
            <div>
              <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                Image Preview
              </label>
              <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-[#4A2917] bg-[#1A0D07] overflow-hidden flex flex-col items-center justify-center p-2 text-center text-xs text-[#CDB99D]/60">
                {imageUrl ? (
                  <SafeImage
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="space-y-1">
                    <Coffee className="w-8 h-8 mx-auto text-[#8B5A2B]/40" />
                    <span>No image selected</span>
                  </div>
                )}
              </div>
            </div>

            {/* Availability Toggle */}
            <div className="bg-[#1A0D07] p-4 rounded-xl border border-[#4A2917] space-y-2">
              <div className="text-xs font-bold text-[#F3E4CB]">Availability</div>
              <button
                type="button"
                onClick={() => setIsAvailable(!isAvailable)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                  isAvailable
                    ? 'bg-[#59D98A]/20 text-[#59D98A] border-[#59D98A]/50'
                    : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                }`}
              >
                {isAvailable ? '🟢 Available' : '🔴 Unavailable'}
              </button>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setName('');
                  setDescription('');
                  setPrice('');
                  setImageUrl('');
                }}
                className="flex-1 bg-[#1A0D07] text-[#CDB99D] hover:bg-[#341B10] font-bold py-2.5 rounded-xl text-xs border border-[#4A2917]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[#8B5A2B] hover:bg-[#724820] text-[#FFF4E3] font-bold py-2.5 rounded-xl text-xs shadow-lg transition-all active:scale-95"
              >
                {isSubmitting ? 'Adding...' : 'Add Item'}
              </button>
            </div>

          </div>

        </form>

      </div>

    </div>
  );
}
