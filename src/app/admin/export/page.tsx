'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExportRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/reports');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 space-y-4">
      <div className="w-12 h-12 rounded-full border-2 border-[#8B5A2B] border-t-transparent animate-spin" />
      <p className="text-sm font-bold text-[#F3E4CB]">
        Redirecting to Sales Reports...
      </p>
      <p className="text-xs text-[#CDB99D]">
        Excel data export functionality is now directly inside the Sales Reports page.
      </p>
    </div>
  );
}
