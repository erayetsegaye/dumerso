'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MenuItemForm from '@/components/MenuItemForm';
import { Coffee } from 'lucide-react';

export default function EditMenuItemPage() {
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/menu/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setItem(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-amber-900/60">
        <Coffee className="w-10 h-10 animate-bounce text-amber-600 mb-2" />
        <p className="text-xs font-semibold">Loading item details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-10 font-bold text-amber-950">
        Item not found.
      </div>
    );
  }

  return <MenuItemForm initialData={item} isEditing={true} />;
}
