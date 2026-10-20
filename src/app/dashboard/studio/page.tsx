"use client";
import React, { useState } from 'react';
import { PRODUCT_CATALOG, DesignState } from '@/lib/catalog';
import MockupEngine from '@/components/designer/MockupEngine';

export default function UnifiedStudioPage() {
  const [design, setDesign] = useState<DesignState>({
    productId: 'nfc_stand',
    finishId: 'charcoal',
    businessName: 'The Daily Café',
    customText: 'Scan for Menu & Ordering',
    qrUrl: 'https://example.com/menu',
    nfcUrl: 'https://example.com/menu',
    logoUrl: null,
    removeBackground: false,
    quantity: 10,
  });

  return (
    <div className="p-8 bg-black min-h-screen text-white">
      <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Hardware Studio</h1>
      <p className="text-gray-500 mb-8">Design premium NFC and QR products. Powered by Supabase Orders.</p>
      
      <div className="bg-[#0A0A0A] rounded-3xl border border-[#1A1A1A] overflow-hidden flex min-h-[600px] shadow-2xl">
        {/* Left Panel */}
        <div className="w-80 bg-[#111] border-r border-[#1A1A1A] p-6 z-10 shadow-xl">
           <h2 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-4">Select Product</h2>
           {PRODUCT_CATALOG.map(p => (
              <button 
                key={p.id}
                onClick={() => setDesign({ ...design, productId: p.id, finishId: p.finishes[0].id })}
                className={`block w-full text-left p-4 mb-3 rounded-xl border transition-all ${design.productId === p.id ? 'border-[#E46254] bg-[#1A1A1A] shadow-md' : 'border-[#222] hover:border-[#333] hover:bg-[#1A1A1A]'}`}
              >
                <div className="font-bold text-sm text-gray-200">{p.name}</div>
              </button>
           ))}
        </div>
        
        <div className="flex-1 bg-black relative">
           <MockupEngine design={design} view="angled" />
        </div>
      </div>
    </div>
  );
}
