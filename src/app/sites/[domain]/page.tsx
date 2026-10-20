"use client";
import React, { useState, useEffect, use } from 'react';
import { createClient } from '@/utils/supabase/client';
import { QrCode, Loader2 } from 'lucide-react';

export default function RootMenuPage({ params }: { params: Promise<{ domain: string }> }) {
  const resolvedParams = use(params);
  const domain = resolvedParams.domain;
  
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      const slug = domain.replace('.localhost:3000', '').replace('.tabletapy.com', '');
      const { data, error } = await supabase.from('restaurants').select('name').eq('slug', slug).single();
      
      if (error || !data) {
        setError(true);
      } else {
        setRestaurantName(data.name);
      }
      setLoading(false);
    }
    load();
  }, [domain]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-gray-400" size={32} /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 p-8 text-center">
        <h1 className="text-3xl font-black mb-2">Not Found</h1>
        <p className="text-gray-500 font-medium">This TableTapy portal does not exist.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 p-8 text-center animate-in fade-in">
      <div className="w-24 h-24 bg-white shadow-xl rounded-3xl flex items-center justify-center mb-8 text-[#E46254]">
        <QrCode size={48} strokeWidth={2} />
      </div>
      
      <h1 className="text-3xl font-black tracking-tight mb-3">Welcome to {restaurantName}</h1>
      <p className="text-gray-500 font-medium max-w-sm mb-12">
        To view the menu and place an order, please scan the QR code located at your table or in your room.
      </p>
      
      <div className="bg-blue-50 text-blue-500 p-4 rounded-2xl max-w-sm w-full shadow-sm border border-blue-100">
        <p className="text-sm font-bold">Why do I need to scan a QR code?</p>
        <p className="text-xs mt-1 text-blue-400/80">Scanning ensures your order is sent directly to your exact location, preventing mistakes and unauthorized orders.</p>
      </div>
    </div>
  );
}
