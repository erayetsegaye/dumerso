'use client';

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, ExternalLink, QrCode as QrIcon } from 'lucide-react';
import SafeImage from '@/components/SafeImage';

export default function AdminQRCodePage() {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [menuUrl, setMenuUrl] = useState<string>('');
  const [settings, setSettings] = useState<{ cafeName?: string; logoUrl?: string }>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate URL based on current host
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setMenuUrl(origin);

    if (origin) {
      QRCode.toDataURL(origin, {
        width: 400,
        margin: 2,
        color: {
          dark: '#381915', // Warm cafe dark brown
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error(err));
    }

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, []);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${(settings.cafeName || 'Dumerso-Cafe').replace(/\s+/g, '-')}-Menu-QR.png`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-serif">
            🔳 Permanent QR Code
          </h1>
          <p className="text-xs text-amber-800/80 mt-0.5">
            Print this QR code for your café tables or display counter.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Printable Printable Display Card */}
      <div
        ref={printRef}
        className="bg-white rounded-3xl p-8 sm:p-12 border-2 border-amber-300 shadow-lg text-center space-y-6 max-w-md mx-auto print:border-none print:shadow-none print:m-0"
      >
        {/* Café Logo & Name Header */}
        <div className="space-y-3">
          <div className="w-20 h-20 rounded-full border-2 border-amber-500/50 overflow-hidden mx-auto shadow-md bg-amber-900 p-0.5">
            <SafeImage
              src={settings.logoUrl || '/logo.jpg'}
              alt="Café Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>

          <h2 className="text-2xl font-extrabold text-amber-950 font-serif tracking-tight">
            {settings.cafeName || 'Dumerso Café'}
          </h2>
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-widest">
            DIGITAL MENU
          </p>
        </div>

        {/* QR Code Container */}
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 inline-block shadow-inner">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Café Menu QR Code"
              className="w-64 h-64 mx-auto rounded-xl shadow-sm"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center text-amber-800 text-xs font-medium">
              Generating QR Code...
            </div>
          )}
        </div>

        {/* Instruction Tagline */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-amber-950 text-amber-100 font-extrabold text-sm px-5 py-2 rounded-full shadow-md">
            <QrIcon className="w-4 h-4 text-amber-400" />
            <span>Scan. Browse. Enjoy.</span>
          </div>
          <p className="text-xs text-amber-800/80 pt-2 font-medium">
            Scan with your phone camera to view our digital menu
          </p>
        </div>

        {/* Live URL Link */}
        <div className="pt-2">
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-700 hover:text-amber-900 underline inline-flex items-center gap-1 font-mono"
          >
            <span>{menuUrl}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

    </div>
  );
}
