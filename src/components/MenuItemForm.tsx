'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Check, Star, Flame, ArrowLeft, Image as ImageIcon, Sparkles } from 'lucide-react';
import SafeImage from './SafeImage';
import { PRESET_BEVERAGE_IMAGES } from '@/lib/constants';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface MenuItemFormProps {
  initialData?: {
    id?: string;
    name: string;
    categoryId: string;
    price: number;
    description?: string;
    imageUrl?: string;
    isAvailable: boolean;
    isSpecial: boolean;
    isPopular: boolean;
  };
  isEditing?: boolean;
}

export default function MenuItemForm({ initialData, isEditing = false }: MenuItemFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(initialData?.name || '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [price, setPrice] = useState(initialData?.price ? String(initialData.price) : '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [isAvailable, setIsAvailable] = useState(initialData ? initialData.isAvailable : true);
  const [isSpecial, setIsSpecial] = useState(initialData?.isSpecial || false);
  const [isPopular, setIsPopular] = useState(initialData?.isPopular || false);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        if (!categoryId && data.length > 0) {
          setCategoryId(data[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Image Upload Handler (Requirement 5 & 10)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
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
        setError('Failed to upload image. Please try again.');
      }
    } catch (err) {
      setError('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!name.trim()) {
      setError('Please enter an item name');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please enter a valid price (e.g. 50)');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name,
        categoryId,
        price: numPrice,
        description,
        imageUrl,
        isAvailable,
        isSpecial,
        isPopular,
      };

      const url = isEditing ? `/api/menu/${initialData?.id}` : '/api/menu';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMessage(
          isEditing ? 'Menu item updated successfully.' : 'Menu item added successfully.'
        );
        setTimeout(() => {
          router.push('/admin/menu');
          router.refresh();
        }, 1200);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save menu item');
      }
    } catch (err) {
      setError('Network error. Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 bg-white rounded-xl border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-serif">
            {isEditing ? 'Edit Menu Item' : '+ Add Menu Item'}
          </h1>
          <p className="text-xs text-amber-800/80">
            Fill in the simple fields below to update your customer menu.
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-emerald-600 text-white font-extrabold text-sm p-4 rounded-2xl shadow-lg flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-2xl font-semibold">
          {error}
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-6">
        
        {/* 1. Item Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            1. Item Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Macchiato"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>

        {/* 2. Category */}
        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            2. Category <span className="text-rose-500">*</span>
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Price (Requirement 5 & 11 - Automatic ETB format) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            3. Price (in ETB) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              required
              placeholder="e.g. 50"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full pl-4 pr-24 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-200/80 text-amber-950 px-3 py-1 rounded-lg text-xs font-extrabold">
              {price ? `${price} ETB` : '0 ETB'}
            </div>
          </div>
          <p className="text-[11px] text-amber-700/70">
            Automatically displayed as: <strong className="text-amber-950">{price ? `${price} ETB` : '50 ETB'}</strong>
          </p>
        </div>

        {/* 4. Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            4. Description <span className="text-amber-500/70 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Rich coffee drink topped with smooth milk foam."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>

        {/* 5. Image Upload & Preview (Requirement 5 & 10) */}
        <div className="space-y-3 pt-2">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
            5. Item Photo
          </label>

          {/* Current Image Preview */}
          {imageUrl && (
            <div className="relative aspect-[4/3] max-w-xs rounded-2xl overflow-hidden border-2 border-amber-300 shadow-md bg-amber-50">
              <SafeImage
                src={imageUrl}
                alt="Preview"
                categoryName={selectedCategoryName}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow"
              >
                Remove
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            
            {/* Upload Button */}
            <label className="flex-1 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-5 py-3.5 rounded-2xl cursor-pointer text-xs shadow-md transition-all active:scale-95">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>

          </div>

          {/* Preset Photo Selector Option */}
          <div className="pt-2">
            <details className="text-xs text-amber-800">
              <summary className="cursor-pointer font-bold text-amber-900 hover:underline inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Or pick from curated drink photos library
              </summary>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-3">
                {PRESET_BEVERAGE_IMAGES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className="relative aspect-square rounded-xl overflow-hidden border border-amber-200 hover:border-amber-500 focus:ring-2 focus:ring-amber-500 group"
                  >
                    <SafeImage
                      src={preset.url}
                      alt={preset.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-amber-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold p-1 text-center">
                      {preset.name}
                    </div>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>

        <div className="h-px bg-amber-100 my-4" />

        {/* 6. Availability Switch (Requirement 5 & 12) */}
        <div className="flex items-center justify-between bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
          <div>
            <span className="font-extrabold text-sm text-amber-950 block">
              6. Availability Status
            </span>
            <span className="text-xs text-amber-800/80">
              {isAvailable ? '🟢 Available for customers' : '🔴 Sold Out (hidden as available)'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAvailable(!isAvailable)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isAvailable
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                : 'bg-rose-600 text-white border-rose-700 shadow-md'
            }`}
          >
            {isAvailable ? '🟢 Available' : '🔴 Sold Out'}
          </button>
        </div>

        {/* 7 & 8. Special & Popular Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* 7. Special Switch */}
          <div className="flex items-center justify-between bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
            <div>
              <span className="font-extrabold text-xs text-amber-950 block flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                7. Special Item
              </span>
              <span className="text-[11px] text-amber-800/70">Show Special badge</span>
            </div>

            <button
              type="button"
              onClick={() => setIsSpecial(!isSpecial)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isSpecial
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              {isSpecial ? '⭐ Yes' : 'No'}
            </button>
          </div>

          {/* 8. Popular Switch */}
          <div className="flex items-center justify-between bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
            <div>
              <span className="font-extrabold text-xs text-amber-950 block flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                8. Popular Item
              </span>
              <span className="text-[11px] text-amber-800/70">Show Popular badge</span>
            </div>

            <button
              type="button"
              onClick={() => setIsPopular(!isPopular)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isPopular
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              {isPopular ? '🔥 Yes' : 'No'}
            </button>
          </div>

        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-base py-4 rounded-2xl shadow-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span>Saving item...</span>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>SAVE MENU ITEM</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
