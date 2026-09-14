'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Coffee,
  Flame,
  Star,
  ToggleLeft,
  ToggleRight,
  Check,
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
  isSpecial: boolean;
  isPopular: boolean;
}

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [itemRes, catRes] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/categories'),
      ]);

      if (itemRes.ok) setItems(await itemRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (err) {
      console.error('Failed to load menu items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Quick Availability Toggle (Requirement 12 - Quick Sold-Out Button)
  const toggleAvailability = async (item: MenuItem) => {
    const newStatus = !item.isAvailable;
    
    // Optimistic UI update
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
          `"${item.name}" marked as ${newStatus ? '🟢 Available' : '🔴 Sold Out'}`
        );
      } else {
        fetchData(); // Rollback on failure
      }
    } catch (err) {
      fetchData();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        showToast(`"${name}" deleted successfully.`);
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error('Failed to delete menu item:', err);
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedCat !== 'all' && item.categoryId !== selectedCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = item.name.toLowerCase().includes(q);
      const descMatch = item.description?.toLowerCase().includes(q);
      if (!nameMatch && !descMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-amber-950 text-amber-50 px-4 py-3 rounded-2xl shadow-xl border border-amber-600 flex items-center gap-2 text-xs font-semibold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-amber-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-serif">
            ☕ Menu Management
          </h1>
          <p className="text-xs text-amber-800/80 mt-0.5">
            Manage your café items, prices, photos, and availability.
          </p>
        </div>

        <Link
          href="/admin/menu/new"
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-5 py-3 rounded-2xl text-xs shadow-md transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Menu Item</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-amber-200 rounded-xl text-amber-950 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          className="px-4 py-2.5 text-xs sm:text-sm bg-white border border-amber-200 rounded-xl text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
        >
          <option value="all">All Categories ({items.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Visual Menu List / Card Grid (Requirement 4) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-amber-900/60">
          <Coffee className="w-10 h-10 animate-bounce text-amber-600 mb-2" />
          <p className="text-xs font-semibold">Loading menu items...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-amber-200 max-w-md mx-auto my-8">
          <Coffee className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-amber-950">No menu items found</h3>
          <p className="text-xs text-amber-800/70 mt-1 mb-4">
            Create your first menu item or change your filter.
          </p>
          <Link
            href="/admin/menu/new"
            className="inline-flex items-center gap-1.5 bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Add First Item
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-3xl overflow-hidden border transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                item.isAvailable ? 'border-amber-200' : 'border-slate-300 bg-slate-50/50'
              }`}
            >
              <div>
                {/* Visual Image Header */}
                <div className="relative aspect-[4/3] bg-amber-100/50 overflow-hidden">
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.name}
                    categoryName={item.category?.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {item.isSpecial && (
                      <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        <Star className="w-3 h-3 fill-white" /> Special
                      </span>
                    )}
                    {item.isPopular && (
                      <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        <Flame className="w-3 h-3 fill-white" /> Popular
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-extrabold text-base text-amber-950 font-serif">
                      {item.name}
                    </h3>
                    <span className="text-amber-800 font-extrabold text-sm bg-amber-100/90 px-2.5 py-0.5 rounded-lg border border-amber-200">
                      {item.price} ETB
                    </span>
                  </div>

                  <p className="text-xs text-amber-900/60 line-clamp-1">
                    {item.category?.icon || '☕'} {item.category?.name}
                  </p>

                  {item.description && (
                    <p className="text-xs text-amber-900/80 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons Section */}
              <div className="p-4 pt-2 border-t border-amber-100 space-y-3">
                
                {/* Availability Switch (Requirement 12 - Quick Sold-Out Button) */}
                <button
                  onClick={() => toggleAvailability(item)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                    item.isAvailable
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {item.isAvailable ? '🟢 Available' : '🔴 Sold Out'}
                  </span>

                  {item.isAvailable ? (
                    <ToggleRight className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-rose-500" />
                  )}
                </button>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/menu/${item.id}/edit`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold py-2 rounded-xl text-xs transition-colors border border-amber-300/60"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Edit</span>
                  </Link>

                  {deleteConfirmId === item.id ? (
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="inline-flex items-center justify-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="inline-flex items-center justify-center p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200"
                      title="Delete item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
