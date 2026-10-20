"use client";
import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Check, Plus, Minus, ChevronRight, X, ArrowLeft, Info, BedDouble, Droplets, Coffee, Sparkles, Shirt, Bath, ConciergeBell, Wrench, Wifi, Phone, Copy } from 'lucide-react';

const CATEGORY_LUCIDE: Record<string, any> = {
  'AMENITIES': Bath,
  'SERVICES': ConciergeBell,
  'ROOM SERVICE': ConciergeBell,
  'MINI BAR': Coffee,
  'ROOM CLEANING': Sparkles,
  'BASIC ESSENTIALS': Bath,
  'TEA & COFFEE': Coffee,
  'WATER & DRINKS': Droplets,
  'BEDDING & LINEN': BedDouble,
  'LAUNDRY': Shirt,
  'MAINTENANCE': Wrench,
};

const CATEGORY_LABELS: Record<string, string> = {
  'AMENITIES': 'Toiletries & Amenities',
  'SERVICES': 'Room Services',
  'ROOM SERVICE': 'In-Room Dining',
  'MINI BAR': 'Mini Bar',
  'ROOM CLEANING': 'Room Cleaning',
  'BASIC ESSENTIALS': 'Basic Essentials',
  'TEA & COFFEE': 'Tea, Coffee & Water',
  'WATER & DRINKS': 'Water & Drinks',
  'BEDDING & LINEN': 'Bedding & Linen',
  'LAUNDRY': 'Laundry Services',
  'MAINTENANCE': 'Room Maintenance',
};

const CATEGORY_DESC: Record<string, string> = {
  'AMENITIES': 'Towels, soaps, dental kits & more',
  'SERVICES': 'Cleaning, laundry, AC & more',
  'ROOM SERVICE': 'Food & beverages to your room',
  'MINI BAR': 'Snacks, drinks & refreshments',
  'ROOM CLEANING': 'Washroom, full clean, vacuum',
  'BASIC ESSENTIALS': 'Toothbrush, soap, towels',
  'TEA & COFFEE': 'Sachets, milk powder, water bottles',
  'WATER & DRINKS': 'Water bottles, sodas',
  'BEDDING & LINEN': 'Bedsheet change, pillows',
  'LAUNDRY': 'Wash & fold, ironing',
  'MAINTENANCE': 'Electrical, plumbing, or room fixes',
};

export function HotelPortal({ restaurantId, hotelName, logoUrl, items, theme, roomNo }: any) {
  const searchParams = useSearchParams();
  const rawRoom = roomNo || searchParams.get('room') || '101';
  const displayRoom = rawRoom.toLowerCase().includes('room') || rawRoom.toLowerCase().includes('table') ? rawRoom : `Room ${rawRoom}`;
  
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'SERVICES' | 'DINING'>('SERVICES');

  // Services flow: null = category grid, string = selected category
  const [selectedServiceCat, setSelectedServiceCat] = useState<string | null>(null);

  // Confirmation Flow State for Services (prevents accidental taps)
  const [confirmService, setConfirmService] = useState<any | null>(null);
  const [showWifi, setShowWifi] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [serviceNote, setServiceNote] = useState('');

  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [serviceSuccess, setServiceSuccess] = useState(false);

  // Theme
  const primaryColor = theme?.primary_color || '#111827';
  const bgColor = theme?.bg_color || '#F9FAFB';
  const radius = theme?.radius || 'rounded';
  const font = theme?.font || 'Inter, sans-serif';

  const cardRadius = radius === 'sharp' ? 'rounded-xl' : radius === 'pill' ? 'rounded-[2.5rem]' : 'rounded-[1.75rem]';
  const btnRadius = radius === 'sharp' ? 'rounded-lg' : radius === 'pill' ? 'rounded-full' : 'rounded-2xl';
  const headerRadius = radius === 'sharp' ? 'rounded-b-xl' : radius === 'pill' ? 'rounded-b-[3rem]' : 'rounded-b-[2rem]';

  const safeItems = (Array.isArray(items) ? items : []).map((i: any) => {
    if (i.category?.toUpperCase() === 'WATER & DRINKS') {
      return { ...i, category: 'TEA & COFFEE' };
    }
    return i;
  });

  const serviceItems = safeItems.filter((i: any) => !['ROOM SERVICE', 'MINI BAR'].includes(i.category?.toUpperCase() || ''));
  const diningItems = safeItems.filter((i: any) => ['ROOM SERVICE', 'MINI BAR'].includes(i.category?.toUpperCase() || ''));

  // Unique service categories (case insensitive mapping)
  const serviceCategories = Array.from(new Set(serviceItems.map((i: any) => i.category?.toUpperCase() || ''))) as string[];
  const diningCategories = Array.from(new Set(diningItems.map((i: any) => i.category?.toUpperCase() || ''))) as string[];

  // Items in the currently selected service category
  const selectedCatItems = selectedServiceCat
    ? serviceItems.filter((i: any) => (i.category?.toUpperCase() || '') === selectedServiceCat)
    : [];

  const groupedDining = diningItems.reduce((acc: any, item: any) => {
    const cat = item.category?.toUpperCase() || '';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handleOpenConfirm = (item: any) => {
    if (requestedIds.has(item.id)) return; // Already requested
    setConfirmService(item);
    setServiceNote('');
  };

  const handleConfirmRequest = async () => {
    if (!confirmService) return;
    setLoadingId(confirmService.id);
    
    try {
      await supabase.from('orders').insert({
        restaurant_id: restaurantId,
        total: 0,
        status: 'NEW',
        note: serviceNote,
        items_json: [{ item: confirmService, price: 0, quantity: 1 }],
        table_no: displayRoom,
        customer_name: displayRoom,
        payment_method: 'COMPLIMENTARY',
        payment_status: 'PENDING'
      });
      setRequestedIds(prev => new Set(prev).add(confirmService.id));
      setConfirmService(null);
      setServiceSuccess(true);
      setTimeout(() => setServiceSuccess(false), 3000);
    } catch (error) {} finally {
      setLoadingId(null);
    }
  };

  const handleUpdateCart = (item: any, delta: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (!existing) {
        if (delta > 0) return [...prev, { item, quantity: 1 }];
        return prev;
      }
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) return prev.filter(c => c.item.id !== item.id);
      return prev.map(c => c.item.id === item.id ? { ...c, quantity: nextQty } : c);
    });
  };

  const getQty = (id: string) => cart.find(c => c.item.id === id)?.quantity || 0;
  const cartTotal = cart.reduce((s, c) => s + ((c.item.basePrice || 0) * c.quantity), 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const handlePlaceFoodOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      await supabase.from('orders').insert({
        restaurant_id: restaurantId,
        total: cartTotal,
        status: 'NEW',
        note: '',
        items_json: cart.map(c => ({ item: c.item, price: c.item.basePrice || 0, quantity: c.quantity })),
        table_no: displayRoom,
        customer_name: displayRoom,
        payment_method: 'ROOM_CHARGE',
        payment_status: 'PENDING'
      });
      setOrderSuccess(true);
      setCart([]);
      setTimeout(() => { setOrderSuccess(false); setIsCartOpen(false); }, 3000);
    } catch (error) {} finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] pb-32 text-gray-900" style={{ backgroundColor: bgColor, fontFamily: font }}>

      {/* ── Header ── */}
      <header 
        className={`px-6 pt-12 pb-6 flex items-center justify-between ${headerRadius}`}
        style={{ backgroundColor: 'transparent' }}
      >
        <div className="flex-1 pr-4">
          {logoUrl
            ? <img src={logoUrl} alt={hotelName} className="h-16 md:h-20 w-auto object-contain" />
            : <h1 className="text-3xl font-black tracking-tight text-gray-900 truncate">{hotelName}</h1>
          }
        </div>
        
        <div className="shrink-0 flex items-center justify-center">
          <div 
            className="flex items-center gap-2 px-3 py-1.5 shadow-sm border border-black/5"
            style={{ 
              backgroundColor: '#ffffff', 
              borderRadius: radius === 'sharp' ? '0' : '100px' 
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-900 mt-0.5">{displayRoom}</span>
          </div>
        </div>
      </header>

      {/* ── Main Tabs ── */}
      <div className="px-5 pb-4 sticky top-0 z-30 backdrop-blur-2xl" style={{ backgroundColor: `${bgColor}E6` }}>
        <div className={`flex p-1 shadow-inner bg-black/5 border border-black/5 ${radius === 'sharp' ? 'rounded-none' : 'rounded-2xl'}`}>
          <button
            onClick={() => { setActiveTab('SERVICES'); setSelectedServiceCat(null); }}
            className={`flex-1 py-3.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${btnRadius} ${activeTab === 'SERVICES' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Concierge
          </button>
          <button
            onClick={() => setActiveTab('DINING')}
            className={`flex-1 py-3.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${btnRadius} ${activeTab === 'DINING' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            In-Room Dining
          </button>
        </div>
      </div>

      <main className="px-5 mt-2">
        {/* ── SERVICES TAB ── */}
        {activeTab === 'SERVICES' && (

          // STEP 1: Category Grid
          !selectedServiceCat ? (
            <div className="animate-in fade-in duration-500">
              
              {/* ── Active Requests Status ── */}
              {serviceItems.filter((i: any) => requestedIds.has(i.id)).length > 0 && (
                <div className="mb-8 px-1 animate-in fade-in slide-in-from-top-4">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Active Requests</h3>
                  <div className="space-y-3">
                    {serviceItems.filter((i: any) => requestedIds.has(i.id)).map((item: any) => (
                      <div key={item.id} className={`flex items-center p-3 bg-white border border-black/[0.03] transition-all ${cardRadius}`} style={{ boxShadow: '0 8px 20px -8px rgba(0,0,0,0.05)' }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                          <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-gray-900 truncate">{item.name}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: primaryColor }}>Front Desk Notified</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {serviceCategories.length === 0 ? (
                <div className="py-20 text-center text-sm font-bold text-gray-400">No services available</div>
              ) : (
                <div className="flex flex-col space-y-4 px-1">
                  {serviceCategories.map((cat) => {
                    const label = CATEGORY_LABELS[cat] || cat;
                    const desc = CATEGORY_DESC[cat];
                    const Icon = CATEGORY_LUCIDE[cat] || ConciergeBell;
                    
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedServiceCat(cat)}
                        className={`relative w-full flex items-center p-4 bg-white border border-black/[0.03] transition-all duration-300 group overflow-hidden active:scale-[0.98] ${cardRadius}`}
                        style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.01)' }}
                      >
                        {/* Subtle Hover Gradient */}
                        <div 
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" 
                          style={{ background: `linear-gradient(120deg, transparent, ${primaryColor}08, transparent)` }} 
                        />
                        
                        {/* Top-Right Highlight Badge */}
                        <div 
                          className="absolute top-0 right-0 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-white z-20 shadow-sm"
                          style={{ 
                            backgroundColor: primaryColor,
                            borderBottomLeftRadius: radius === 'sharp' ? '0' : '16px'
                          }}
                        >
                          Free
                        </div>

                        {/* Layered Icon Container (Faux 3D) */}
                        <div className="relative shrink-0 w-16 h-16 mr-5">
                          {/* Back shadow layer offset */}
                          <div 
                            className="absolute inset-0 rounded-2xl opacity-[0.15] transform translate-x-1.5 translate-y-1.5 transition-transform group-hover:translate-x-2 group-hover:translate-y-2" 
                            style={{ backgroundColor: primaryColor }} 
                          />
                          {/* Front glass layer */}
                          <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-white border border-gray-100/50 shadow-sm transition-transform group-hover:-translate-y-0.5 group-hover:-translate-x-0.5">
                            <Icon size={24} strokeWidth={1.5} style={{ color: primaryColor }} />
                          </div>
                        </div>
                        
                        {/* Text Content */}
                        <div className="flex-1 text-left pr-4 relative z-10">
                          <h3 className="text-[17px] font-black text-gray-900 tracking-tight mb-1 group-hover:text-black transition-colors">{label}</h3>
                          <p className="text-[12px] text-gray-500 font-medium leading-snug line-clamp-2">{desc}</p>
                        </div>

                        {/* Action Arrow */}
                        <div 
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-1 group-hover:shadow-md relative z-10"
                          style={{ backgroundColor: `${primaryColor}08`, color: primaryColor }}
                        >
                          <ChevronRight size={18} strokeWidth={2.5} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Quick Essentials (Wi-Fi & Phone) ── */}
              <div className="mt-8 mb-6 px-1">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Quick Essentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Wi-Fi Widget */}
                  <button 
                    onClick={() => setShowWifi(true)}
                    className={`flex flex-col items-center justify-center p-5 bg-white border border-black/[0.03] transition-all hover:shadow-lg active:scale-95 ${cardRadius}`}
                    style={{ boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)' }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-blue-50 text-blue-500">
                      <Wifi size={24} strokeWidth={1.5} />
                    </div>
                    <span className="text-[14px] font-black text-gray-900">Wi-Fi Access</span>
                  </button>

                  {/* Front Desk Widget */}
                  <a 
                    href="tel:0"
                    className={`flex flex-col items-center justify-center p-5 bg-white border border-black/[0.03] transition-all hover:shadow-lg active:scale-95 ${cardRadius}`}
                    style={{ boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)' }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-green-50 text-green-500">
                      <Phone size={24} strokeWidth={1.5} />
                    </div>
                    <span className="text-[14px] font-black text-gray-900">Front Desk</span>
                  </a>
                </div>
              </div>
            </div>

          // STEP 2: Sub-services list
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 py-2">
              {/* Back Button */}
              <button
                onClick={() => setSelectedServiceCat(null)}
                className="flex items-center gap-3 text-sm font-bold text-gray-900 mb-8 transition-colors active:scale-95 bg-white shadow-sm border border-gray-100 rounded-full pr-5 pl-2 py-2"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 text-gray-500">
                  <ArrowLeft size={16} strokeWidth={2.5} />
                </div>
                <span>{CATEGORY_LABELS[selectedServiceCat] || selectedServiceCat}</span>
              </button>

              {selectedCatItems.length === 0 ? (
                <div className="py-20 text-center text-sm text-gray-400">Nothing here yet.</div>
              ) : (
                <div className="space-y-5 px-1">
                  {selectedCatItems.map((item: any) => {
                    const isReq = requestedIds.has(item.id);
                    return (
                      <div key={item.id} className={`bg-white border border-black/[0.03] p-5 flex items-center justify-between gap-5 transition-shadow hover:shadow-xl ${cardRadius}`} style={{ boxShadow: '0 12px 30px -10px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.01)' }}>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[16px] font-black text-gray-900 tracking-tight mb-1.5">{item.name}</h3>
                          {item.desc && <p className="text-xs text-gray-500 font-medium line-clamp-2 mb-3 leading-relaxed">{item.desc}</p>}
                          <div className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest bg-gray-50 text-gray-400 border border-gray-100">
                            Complimentary
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenConfirm(item)}
                          disabled={isReq}
                          className={`shrink-0 h-12 px-6 flex items-center justify-center gap-2 text-[13px] uppercase tracking-widest font-black transition-all active:scale-95 shadow-md ${btnRadius}`}
                          style={
                            isReq
                              ? { backgroundColor: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb', boxShadow: 'none' }
                              : { backgroundColor: primaryColor, color: '#fff' }
                          }
                        >
                          {isReq ? <><Check size={16} strokeWidth={3} /> Requested</> : 'Request'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
        )}

        {/* ── DINING TAB ── */}
        {activeTab === 'DINING' && (
          <div className="animate-in fade-in duration-400 py-2 space-y-10">
            {Object.keys(groupedDining).length === 0 ? (
              <div className="py-20 text-center text-sm font-bold text-gray-400">No dining options available</div>
            ) : (
              Object.entries(groupedDining).map(([catName, catItems]: any) => (
                <div key={catName}>
                  <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 pl-1">
                    {CATEGORY_LABELS[catName] || catName}
                  </h2>
                  <div className="space-y-5">
                    {catItems.map((item: any) => {
                      const qty = getQty(item.id);
                      return (
                        <div key={item.id} className={`bg-white border border-gray-100 shadow-sm p-5 flex gap-4 ${cardRadius}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${item.isVeg !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                              <h3 className="text-base font-bold text-gray-900">{item.name}</h3>
                            </div>
                            <p className="text-lg font-black text-gray-900 mb-2">₹{item.basePrice?.toFixed(0)}</p>
                            {item.desc && <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{item.desc}</p>}
                          </div>
                          <div className="shrink-0 flex flex-col items-end justify-between w-24">
                            {item.img
                              ? <img src={item.img} alt={item.name} className={`w-24 h-24 object-cover bg-gray-50 mb-4 shadow-sm ${btnRadius}`} />
                              : <div className="h-4 mb-4" />
                            }
                            {qty > 0 ? (
                              <div className={`flex items-center gap-2 bg-gray-50 border border-gray-100 p-1.5 w-full ${btnRadius}`}>
                                <button onClick={() => handleUpdateCart(item, -1)} className={`w-7 h-7 flex items-center justify-center bg-white shadow-sm text-gray-700 ${btnRadius}`}><Minus size={13} /></button>
                                <span className="text-xs font-bold flex-1 text-center">{qty}</span>
                                <button onClick={() => handleUpdateCart(item, 1)} className={`w-7 h-7 flex items-center justify-center bg-white shadow-sm text-gray-700 ${btnRadius}`}><Plus size={13} /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleUpdateCart(item, 1)}
                                className={`w-full h-10 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-sm ${btnRadius}`}
                                style={{ backgroundColor: primaryColor }}
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* ── FLOATING CART ── */}
      {cart.length > 0 && activeTab === 'DINING' && (
        <div className="fixed bottom-6 left-0 right-0 px-5 z-40 animate-in slide-in-from-bottom-4">
          <button
            onClick={() => setIsCartOpen(true)}
            className={`w-full h-16 text-white px-6 flex items-center justify-between shadow-2xl active:scale-[0.98] transition-transform ${cardRadius}`}
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm">{cartCount}</div>
              <span className="text-sm font-bold">Review Order</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black">₹{cartTotal.toFixed(0)}</span>
              <ChevronRight size={20} className="opacity-80" />
            </div>
          </button>
        </div>
      )}

      {/* ── SERVICE SUCCESS TOAST ── */}
      {serviceSuccess && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`bg-gray-900 text-white px-6 py-4 flex items-center gap-3 shadow-2xl ${btnRadius}`}>
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <Check size={14} strokeWidth={3} className="text-white" />
            </div>
            <span className="text-sm font-bold">Request sent to staff</span>
          </div>
        </div>
      )}

      {/* ── SERVICE CONFIRMATION SHEET (STEP 3) ── */}
      {confirmService && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-in fade-in" onClick={() => setConfirmService(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6"
            style={{ borderTopLeftRadius: radius === 'sharp' ? '0' : '2rem', borderTopRightRadius: radius === 'sharp' ? '0' : '2rem' }}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2" />
            
            <div className="px-8 py-6 flex items-start justify-between shrink-0">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">{confirmService.name}</h2>
                <p className="text-sm text-gray-500 font-medium">{confirmService.desc || 'Confirm your request below.'}</p>
              </div>
              <button onClick={() => setConfirmService(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="px-8 pb-6 overflow-y-auto space-y-10">
              {/* Elegant Notes */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Additional Notes</label>
                <textarea 
                  className="w-full bg-transparent border-b-2 border-gray-100 py-3 text-base text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-900 transition-colors resize-none rounded-none"
                  rows={2}
                  placeholder="Any specific instructions for our staff?"
                  value={serviceNote}
                  onChange={(e) => setServiceNote(e.target.value)}
                />
              </div>

              {/* Minimalist Info */}
              <p className="text-xs text-gray-400 italic leading-relaxed">
                This request will be sent instantly to the front desk. The team will prioritize it immediately.
              </p>
            </div>

            <div className="px-8 pb-10">
              <button
                onClick={handleConfirmRequest}
                disabled={loadingId === confirmService.id}
                className={`w-full h-14 text-white text-[13px] font-black uppercase tracking-widest flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-transform disabled:opacity-70 ${btnRadius}`}
                style={{ backgroundColor: primaryColor }}
              >
                {loadingId === confirmService.id ? <Loader2 className="animate-spin" size={24} /> : 'Confirm Request'}
              </button>
              <button
                onClick={() => setConfirmService(null)}
                className={`w-full h-12 mt-3 text-gray-500 text-sm font-bold flex items-center justify-center transition-colors hover:bg-gray-50 ${btnRadius}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── DINING CART SHEET ── */}
      {isCartOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-6"
            style={{ borderTopLeftRadius: radius === 'sharp' ? '0' : '2rem', borderTopRightRadius: radius === 'sharp' ? '0' : '2rem' }}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2" />

            {orderSuccess ? (
              <div className="p-12 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6">
                  <Check size={32} strokeWidth={3} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Order Confirmed</h2>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Charged to {displayRoom}</p>
              </div>
            ) : (
              <>
                <div className="px-8 py-4 flex items-center justify-between shrink-0">
                  <h2 className="text-lg font-extrabold text-gray-900">Your Order</h2>
                  <button onClick={() => setIsCartOpen(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-8 py-4 overflow-y-auto flex-1 space-y-5">
                  {cart.map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-gray-400">{c.quantity}x</span>
                        <span className="text-sm font-bold text-gray-900">{c.item.name}</span>
                      </div>
                      <span className="text-sm font-black text-gray-900">₹{(c.item.basePrice * c.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div className="p-8 bg-gray-50 shrink-0 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Total</span>
                    <span className="text-2xl font-black text-gray-900">₹{cartTotal.toFixed(0)}</span>
                  </div>
                  <button
                    onClick={handlePlaceFoodOrder}
                    disabled={isSubmitting}
                    className={`w-full h-16 text-white text-sm font-bold uppercase tracking-widest flex items-center justify-center shadow-xl active:scale-[0.98] transition-transform disabled:opacity-70 ${btnRadius}`}
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : `Charge to ${displayRoom}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── WIFI MODAL ── */}
      {showWifi && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-md animate-in fade-in" onClick={() => setShowWifi(false)} />
          <div 
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] bg-white w-[90%] max-w-sm shadow-2xl animate-in zoom-in-95 p-8 flex flex-col items-center text-center" 
            style={{ borderRadius: radius === 'sharp' ? '0' : '2rem' }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 mb-6 shadow-inner">
              <Wifi size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Complimentary Wi-Fi</h2>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">Connect to our high-speed network for the duration of your stay.</p>
            
            <div className="w-full space-y-3 mb-8">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center text-left">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Network</p>
                  <p className="text-[15px] font-bold text-gray-900">{hotelName?.replace(/\s+/g, '_') || 'Hotel_Guest_Network'}</p>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center text-left">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Password</p>
                  <p className="text-[15px] font-bold text-gray-900">stay2026</p>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText('stay2026');
                    setCopiedWifi(true);
                    setTimeout(() => setCopiedWifi(false), 2500);
                  }}
                  className="px-3 h-10 flex items-center justify-center gap-1.5 bg-white border border-gray-200 rounded-full shadow-sm text-gray-600 hover:text-gray-900 transition-colors active:scale-95 text-xs font-bold cursor-pointer"
                >
                  {copiedWifi ? (
                    <>
                      <Check size={14} className="text-emerald-500" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <button 
              onClick={() => setShowWifi(false)}
              className={`w-full py-4 text-white font-black uppercase tracking-widest text-[11px] shadow-lg active:scale-95 transition-transform ${btnRadius}`}
              style={{ backgroundColor: primaryColor }}
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
