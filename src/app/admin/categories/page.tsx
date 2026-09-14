'use client';

import React, { useEffect, useState } from 'react';
import { FolderTree, Plus, Edit2, Trash2, Check, Coffee } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon: string;
  _count?: { items: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('☕');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/categories');
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingId) {
        const res = await fetch(`/api/categories/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), icon }),
        });
        if (res.ok) {
          showToast('Category updated successfully.');
          setEditingId(null);
          setName('');
          setIcon('☕');
          fetchCategories();
        }
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), icon }),
        });
        if (res.ok) {
          showToast('Category added successfully.');
          setName('');
          setIcon('☕');
          fetchCategories();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon || '☕');
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Are you sure you want to delete "${catName}" category and all its items?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Category "${catName}" deleted.`);
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-amber-950 text-amber-50 px-4 py-3 rounded-2xl shadow-xl border border-amber-600 flex items-center gap-2 text-xs font-semibold animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-serif">
          📂 Categories
        </h1>
        <p className="text-xs text-amber-800/80 mt-0.5">
          Organize your café menu into clear categories like Tea & Hot Drinks, Coffee, and Water.
        </p>
      </div>

      {/* Add / Edit Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-amber-200 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-amber-950 uppercase tracking-wider">
          {editingId ? 'Edit Category' : '+ Add New Category'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-amber-900 mb-1">
              Category Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Pastries & Snacks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">
              Icon / Emoji
            </label>
            <input
              type="text"
              placeholder="e.g. ☕ or 💧"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{editingId ? 'Update Category' : 'Save Category'}</span>
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setName('');
                setIcon('☕');
              }}
              className="bg-slate-200 text-slate-800 font-semibold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-300"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Categories List */}
      <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-amber-950 uppercase tracking-wider">
          Existing Categories
        </h2>

        {isLoading ? (
          <div className="py-8 text-center text-amber-900/60 text-xs">
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-amber-900/60 text-xs">
            No categories defined yet.
          </div>
        ) : (
          <div className="divide-y divide-amber-100">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="py-3.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl p-2 bg-amber-50 rounded-xl border border-amber-200/60">
                    {cat.icon}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-amber-950 font-serif">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-amber-800/70">
                      {cat._count?.items ?? 0} items
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(cat)}
                    className="p-2 text-amber-800 hover:bg-amber-100 rounded-xl transition-colors"
                    title="Edit category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
