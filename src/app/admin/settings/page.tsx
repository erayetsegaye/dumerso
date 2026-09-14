'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, Upload, Check, MapPin, Phone, Clock, Navigation } from 'lucide-react';
import SafeImage from '@/components/SafeImage';

export default function AdminSettingsPage() {
  const [cafeName, setCafeName] = useState('Dumerso Café');
  const [logoUrl, setLogoUrl] = useState('/logo.jpg');
  const [description, setDescription] = useState('Freshly brewed. Made with care.');
  const [tagline, setTagline] = useState('Scan. Browse. Enjoy.');
  const [phone, setPhone] = useState('+251 913 961 921');
  const [location, setLocation] = useState('Gombora Taxi Mazoriya');
  const [mapsUrl, setMapsUrl] = useState('');
  const [openingHours, setOpeningHours] = useState('Mon - Sun: 7:00 AM - 10:00 PM');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setCafeName(data.cafeName || 'Dumerso Café');
        setLogoUrl(data.logoUrl || '/logo.jpg');
        setDescription(data.description || 'Freshly brewed. Made with care.');
        setTagline(data.tagline || 'Scan. Browse. Enjoy.');
        setPhone(data.phone || '+251 913 961 921');
        setLocation(data.location || 'Gombora Taxi Mazoriya');
        setMapsUrl(data.mapsUrl || '');
        setOpeningHours(data.openingHours || 'Mon - Sun: 7:00 AM - 10:00 PM');
        setFacebook(data.facebook || '');
        setInstagram(data.instagram || '');
        setTelegram(data.telegram || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setLogoUrl(data.url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeName,
          logoUrl,
          description,
          tagline,
          phone,
          location,
          mapsUrl,
          openingHours,
          facebook,
          instagram,
          telegram,
        }),
      });

      if (res.ok) {
        setToastMessage('Café settings saved successfully!');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError('Network error while saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-amber-900/60 font-semibold text-xs">
        Loading café settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      
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
          ⚙️ Café Settings
        </h1>
        <p className="text-xs text-amber-800/80 mt-0.5">
          Update your café info, phone number, location, opening hours, and footer details.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-6">
        
        {/* Café Name & Logo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center border-b border-amber-100 pb-6">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
              Café Name
            </label>
            <input
              type="text"
              required
              value={cafeName}
              onChange={(e) => setCafeName(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-2 text-center sm:text-left">
            <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
              Café Logo
            </label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full border-2 border-amber-400 overflow-hidden bg-amber-900 shrink-0">
                <SafeImage
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <label className="bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs px-3 py-2 rounded-xl cursor-pointer transition-colors border border-amber-300">
                <span>{uploadingLogo ? '...' : 'Change Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Location & Phone (Requirement 1 & 15) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              Café Location
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Gombora Taxi Mazoriya"
              className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-amber-700/70">
              Exact location shown on customer footer.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-amber-600" />
              Phone Number
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +251 913 961 921"
              className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-amber-700/70">
              Clickable on mobile via <code className="font-mono font-bold">tel:</code> link.
            </p>
          </div>

        </div>

        {/* Descriptions & Opening Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
              Short Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Freshly brewed. Made with care."
              className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Opening Hours
            </label>
            <input
              type="text"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              placeholder="Mon - Sun: 7:00 AM - 10:00 PM"
              className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

        </div>

        {/* Optional Google Maps / Get Directions Link (Requirement 1 & 15) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-amber-600" />
            Google Maps Link (Get Directions Button)
          </label>
          <input
            type="url"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            placeholder="https://maps.google.com/?q=..."
            className="w-full px-4 py-3 text-sm bg-amber-50/50 border border-amber-200 rounded-xl text-amber-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-[11px] text-amber-700/70">
            If provided, a &ldquo;Get Directions&rdquo; button will appear in the customer website footer.
          </p>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-amber-100">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm py-3.5 rounded-2xl shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <span>Saving settings...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>SAVE CAFÉ SETTINGS</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}
