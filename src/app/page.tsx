'use client';

import React, { useEffect, useState } from 'react';
import { Phone, MapPin, Coffee, Droplet, Leaf, Heart, Smile, Sparkles } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import CustomerFooter from '@/components/CustomerFooter';
import { ITEM_IMAGE_MAP } from '@/lib/constants';

interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
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

interface Settings {
  cafeName: string;
  logoUrl: string;
  description: string;
  tagline: string;
  phone: string;
  location: string;
  mapsUrl?: string;
  openingHours: string;
}

export default function LightThemeCustomerWebsite() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<Settings | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [catRes, itemRes, setRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/menu'),
        fetch('/api/settings'),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
      if (setRes.ok) setSettings(await setRes.json());
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const cafeName = settings?.cafeName || 'DUMERSO COFFEE';
  const logoUrl = settings?.logoUrl || '/logo.jpg';
  const description = settings?.description || 'Freshly brewed. Made with care.';
  const phone = settings?.phone || '+251 913 961 921';
  const rawPhone = phone.replace(/\s+/g, '');
  const location = settings?.location || 'Gombora Taxi Mazoriya';

  // Group items by category for single-page display
  const groupedItems = categories.map((cat) => {
    const categoryItems = items.filter((item) => item.categoryId === cat.id);
    return {
      category: cat,
      items: categoryItems,
    };
  });

  const getCategoryIcon = (catName: string) => {
    const name = catName.toLowerCase();
    if (name.includes('tea') || name.includes('drink')) return <Leaf className="w-5 h-5 text-emerald-700" />;
    if (name.includes('coffee')) return <Coffee className="w-5 h-5 text-[#381915]" />;
    if (name.includes('water')) return <Droplet className="w-5 h-5 text-sky-600" />;
    return <Sparkles className="w-5 h-5 text-amber-700" />;
  };

  const scrollToCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    if (categoryId !== 'all') {
      const el = document.getElementById(`category-${categoryId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F4ECE1] text-[#2A1810] font-sans antialiased flex flex-col justify-between selection:bg-[#381915] selection:text-white">
      
      <div>
        {/* 1. COMPACT HERO HEADER (With uploaded latte & coffee bean background) */}
        <header className="relative bg-[#1A0D07] text-[#F3E4CB] py-6 sm:py-7 px-4 sm:px-8 border-b border-[#4A2917]/60 shadow-lg overflow-hidden flex items-center">
          
          {/* Header Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-right sm:bg-center bg-no-repeat pointer-events-none transition-transform duration-700 hover:scale-102"
            style={{
              backgroundImage: `url('/header-bg.jpg')`,
            }}
          />

          {/* Subtle gradient overlay to make text pop on the left */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#1A0D07]/90 via-[#1A0D07]/75 to-transparent pointer-events-none" />

          <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
            
            {/* TOP LEFT CORNER: Logo + Café Name + Subtitle */}
            <div className="flex items-center gap-3.5 text-left">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-[#8B5A2B] overflow-hidden shrink-0 shadow-lg bg-[#1A0D07] p-0.5">
                <SafeImage
                  src={logoUrl}
                  alt={cafeName}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>

              <div>
                <h1 className="text-xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB] tracking-wider uppercase drop-shadow-md">
                  {cafeName}
                </h1>
                <p className="text-[11px] sm:text-xs text-[#CDB99D] font-serif italic mt-0.5 font-medium">
                  {description}
                </p>
              </div>
            </div>

            {/* TOP RIGHT CORNER: Phone Number & Location */}
            <div className="flex flex-col sm:flex-row md:flex-col items-center md:items-end gap-2 text-xs font-semibold text-[#F3E4CB] shrink-0">
              
              {/* Phone */}
              <a
                href={`tel:${rawPhone}`}
                className="inline-flex items-center gap-2 bg-[#24140C]/90 hover:bg-[#341B10] text-[#F3E4CB] px-3.5 py-1.5 rounded-full border border-[#4A2917] shadow-sm transition-all active:scale-95 text-xs"
              >
                <Phone className="w-3.5 h-3.5 text-[#8B5A2B]" />
                <span className="font-bold tracking-wide">{phone}</span>
              </a>

              {/* Location */}
              <div className="inline-flex items-center gap-2 bg-[#24140C]/90 text-[#CDB99D] px-3.5 py-1.5 rounded-full border border-[#4A2917] shadow-sm text-xs">
                <MapPin className="w-3.5 h-3.5 text-[#8B5A2B]" />
                <span>{location}</span>
              </div>

            </div>

          </div>
        </header>

        {/* 2. OUR MENU HEADER & CATEGORY PILLS */}
        <section className="max-w-6xl mx-auto px-4 pt-10 pb-6 text-center space-y-6">
          
          {/* Centered Decorative Title */}
          <div className="flex items-center justify-center gap-4">
            <div className="h-px bg-[#D8C7B2] w-16 sm:w-28" />
            <h2 className="text-2xl sm:text-4xl font-serif font-extrabold text-[#2A1810] tracking-tight">
              Our Menu
            </h2>
            <div className="h-px bg-[#D8C7B2] w-16 sm:w-28" />
          </div>

          {/* Category Pill Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => scrollToCategory('all')}
              className={`px-5 py-2.5 rounded-full text-xs font-extrabold transition-all border shadow-xs ${
                selectedCategory === 'all'
                  ? 'bg-[#381915] text-white border-[#381915] shadow-md scale-105'
                  : 'bg-white text-[#2A1810] border-[#D8C7B2] hover:bg-[#EFE7DA]'
              }`}
            >
              All Categories
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-extrabold transition-all border shadow-xs ${
                  selectedCategory === cat.id
                    ? 'bg-[#381915] text-white border-[#381915] shadow-md scale-105'
                    : 'bg-white text-[#2A1810] border-[#D8C7B2] hover:bg-[#EFE7DA]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

        </section>

        {/* 3. MENU CARDS GRID */}
        <main className="max-w-6xl mx-auto px-4 pb-12 space-y-12">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#523528]">
              <Coffee className="w-10 h-10 animate-bounce text-[#381915] mb-2" />
              <p className="text-xs font-bold">Loading menu...</p>
            </div>
          ) : (
            groupedItems.map(({ category, items: categoryItems }) => {
              if (
                selectedCategory !== 'all' &&
                selectedCategory !== category.id
              ) {
                return null;
              }

              if (categoryItems.length === 0) return null;

              return (
                <div
                  key={category.id}
                  id={`category-${category.id}`}
                  className="space-y-5 scroll-mt-24"
                >
                  
                  {/* Category Title */}
                  <div className="flex items-center gap-3 pb-2 border-b border-[#D8C7B2]">
                    {getCategoryIcon(category.name)}
                    <h3 className="text-xl sm:text-2xl font-serif font-extrabold text-[#2A1810]">
                      {category.name}
                    </h3>
                  </div>

                  {/* 3-Column Desktop / 2 Tablet / 1 Mobile Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {categoryItems.map((item) => {
                      const imageSrc = item.imageUrl || ITEM_IMAGE_MAP[item.name];

                      return (
                        <div
                          key={item.id}
                          className={`bg-white/95 rounded-2xl p-3.5 sm:p-4 border border-[#E2D4C3] shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-4 ${
                            item.isAvailable ? '' : 'opacity-75 bg-stone-100'
                          }`}
                        >
                          {/* Item Image */}
                          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-[#F4ECE1] border border-[#D8C7B2]/60 shadow-inner">
                            <SafeImage
                              src={imageSrc}
                              alt={item.name}
                              categoryName={category.name}
                              className="w-full h-full object-cover"
                            />
                            {!item.isAvailable && (
                              <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[1px] flex items-center justify-center">
                                <span className="text-[10px] font-extrabold text-white bg-rose-600 px-2 py-0.5 rounded uppercase tracking-wider">
                                  Unavailable
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Item Details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="font-serif font-bold text-base sm:text-lg text-[#2A1810] truncate">
                              {item.name}
                            </h4>

                            {item.description && (
                              <p className="text-xs text-[#665246] font-sans line-clamp-1">
                                {item.description}
                              </p>
                            )}

                            <div className="font-extrabold text-[#381915] text-sm sm:text-base pt-1">
                              {item.price} <span className="text-xs font-semibold text-[#665246]">ETB</span>
                            </div>

                            <div className="pt-0.5">
                              {item.isAvailable ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                                  <span className="w-2 h-2 rounded-full bg-emerald-600 shadow-[0_0_6px_#10b981]" />
                                  Available
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600">
                                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                                  Unavailable
                                </span>
                              )}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })
          )}

          {/* 4. ABOUT SECTION ("A Cozy Place for Great Coffee") */}
          <div className="bg-[#EAE0D0] rounded-3xl p-6 sm:p-10 border border-[#D8C7B2] shadow-sm grid grid-cols-1 md:grid-cols-12 gap-8 items-center mt-12">
            
            {/* Left Image */}
            <div className="md:col-span-5 aspect-[4/3] rounded-2xl overflow-hidden shadow-md bg-white border-2 border-white">
              <SafeImage
                src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80"
                alt="A Cozy Place for Great Coffee"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Right Text */}
            <div className="md:col-span-7 space-y-4 text-[#2A1810]">
              <h3 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#2A1810] leading-tight">
                A Cozy Place for Great Coffee
              </h3>
              
              <p className="text-xs sm:text-sm text-[#523528] leading-relaxed font-medium">
                At {cafeName}, we serve high-quality drinks made from the finest ingredients. Whether you&apos;re here for a quick coffee, a relaxing tea, or a refreshing drink, we&apos;re happy to have you!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="flex items-center gap-2.5 text-xs font-bold text-[#2A1810]">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                    <Leaf className="w-4 h-4 text-emerald-700" />
                  </div>
                  <span>Fresh Ingredients</span>
                </div>

                <div className="flex items-center gap-2.5 text-xs font-bold text-[#2A1810]">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200">
                    <Heart className="w-4 h-4 text-rose-700" />
                  </div>
                  <span>Great Taste</span>
                </div>

                <div className="flex items-center gap-2.5 text-xs font-bold text-[#2A1810]">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                    <Smile className="w-4 h-4 text-amber-700" />
                  </div>
                  <span>Friendly Service</span>
                </div>
              </div>
            </div>

          </div>

          {/* 5. CONTACT SECTION BAR */}
          <div className="bg-[#381915] text-[#F9F4EC] rounded-3xl p-6 sm:p-8 border border-[#2A1810] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs text-amber-200/80 font-medium">Location</div>
                  <div className="font-bold text-white">{location}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs text-amber-200/80 font-medium">Phone</div>
                  <a href={`tel:${rawPhone}`} className="font-bold text-white hover:underline">
                    {phone}
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 shrink-0">
              <a
                href={`tel:${rawPhone}`}
                className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-6 py-3 rounded-full text-xs transition-all shadow-md active:scale-95 uppercase tracking-wider"
              >
                CALL US
              </a>

              <div className="font-script text-xl text-amber-200 hidden sm:block">
                Scan. Browse. Enjoy.
              </div>
            </div>
          </div>

        </main>
      </div>

      {/* 6. FOOTER */}
      <CustomerFooter settings={settings} />

    </div>
  );
}
