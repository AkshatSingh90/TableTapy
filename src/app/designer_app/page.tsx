"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ChevronLeft, UploadCloud, Save, Loader2, LayoutList, Grid2X2, Wand2, Sun, Moon, Palette, Check, Image as ImageIcon, CheckCircle2, AlertCircle, Camera, Utensils } from "lucide-react";
import { PhoneSimulator } from "@/components/PhoneSimulator";
import { createClient } from "@/utils/supabase/client";
import { 
  MOCK_ITEMS, MenuItem,
  MenuTemplate,
  ModifiersSheet, CartSheet, NEO_PALETTES, CAFE_PALETTES, QSR_PALETTES
} from "@/components/MenuTemplates";
import { HotelPortal } from "@/components/HotelPortal";
import { 
  extractPaletteFromImage, 
  ExtractedPalette, 
  isDarkColor, 
  getAdaptiveThemeTokens 
} from "@/utils/colorExtractor";

export default function StudioDesignerPage() {
  const supabase = createClient();
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState('#f9fafb');
  const [bgPattern, setBgPattern] = useState('none');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#111827');
  const [cardStyle, setCardStyle] = useState('solid');
  const [menuLayout, setMenuLayout] = useState('list');
  const [font, setFont] = useState('Inter, sans-serif');
  const [radius, setRadius] = useState('rounded');
  const [showDishImages, setShowDishImages] = useState(true);
  const [restaurantName, setRestaurantName] = useState('Menu');
  

  const [categories, setCategories] = useState(['ALL', 'BURGERS', 'SNACKS', 'DRINKS']);
  const [items, setItems] = useState<MenuItem[]>(MOCK_ITEMS);
  const [isPublishing, setIsPublishing] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState('RESTAURANT');

  // Client-Side Image Color Extraction & Toast State
  const [extractedPalette, setExtractedPalette] = useState<ExtractedPalette | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3500);
  };

  const processImageForPalette = async (dataUrl: string, autoApply: boolean = true) => {
    setIsAnalyzingImage(true);
    try {
      const palette = await extractPaletteFromImage(dataUrl);
      setExtractedPalette(palette);

      if (autoApply) {
        const suggested = palette.isDarkImage ? palette.suggestedDark : palette.suggestedLight;
        setPrimaryColor(suggested.primaryColor);
        setBgColor(suggested.bgColor);
        setCardStyle(suggested.cardStyle);
        showToast(`✨ Harmonious palette extracted! Applied "${suggested.name}"`);
      } else {
        showToast(`✨ Extracted ${palette.swatches.length} colors from image!`);
      }
    } catch (err) {
      console.error("Color extraction error:", err);
      showToast("Could not extract colors from this image.");
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      let activeUser: any = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData?.session?.user;
      } catch {}

      if (!activeUser && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          activeUser = user;
        } catch {}
      }

      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (!activeUser && !isOffline) {
        window.location.href = '/login';
        return;
      }
      
      const restId = activeUser?.user_metadata?.restaurant_id || (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_restaurant_id') : null);
      if (!restId) {
        alert("You need to create a restaurant in the dashboard first!");
        window.location.href = '/dashboard';
        return;
      }

      // 1. Fetch Restaurant Settings
      const { data: restData } = await supabase.from('restaurants').select('*').eq('id', restId).single();
      if (restData) {
        setRestaurantId(restData.id);
        setRestaurantName(restData.name || 'Menu');
        setBusinessType(restData.business_type || 'RESTAURANT');
        if (restData.logo_url) {
          setLogoUrl(restData.logo_url);
          extractPaletteFromImage(restData.logo_url)
            .then(p => setExtractedPalette(p))
            .catch(() => {});
        }
        if (restData.bg_color) setBgColor(restData.bg_color);
        if (restData.bg_pattern) setBgPattern(restData.bg_pattern);
        if (restData.bg_image) setBgImage(restData.bg_image);
        if (restData.primary_color) setPrimaryColor(restData.primary_color);
        if (restData.card_style) {
          if (['brutalist', 'cafe', 'qsr'].includes(restData.card_style)) {
            setCardStyle('solid');
          } else {
            setCardStyle(restData.card_style);
          }
        }
        if (restData.font) setFont(restData.font);
        if (restData.radius) setRadius(restData.radius);
        if (restData.menu_layout) setMenuLayout(restData.menu_layout);
        const storedShowImages = localStorage.getItem(`tabletapy_show_images_${restId}`);
        if (storedShowImages !== null) {
          setShowDishImages(storedShowImages === 'true');
        } else if (restData.card_style && restData.card_style.includes('no-image')) {
          setShowDishImages(false);
        }

        // 2. Fetch Menu Items strictly for this restaurant
        const { data: scopedMenu } = await supabase
          .from('menu_items_v2')
          .select('*')
          .eq('restaurant_id', restId)
          .eq('is_available', true)
          .order('created_at', { ascending: true });

        const menuData = scopedMenu || [];
        if (menuData && menuData.length > 0) {
          const mappedItems = menuData.map((d: any) => ({
            id: d.id,
            name: d.name,
            desc: d.description,
            basePrice: d.base_price,
            img: d.img_url,
            category: d.category,
            badge: d.badge,
            dietary: d.dietary,
            isVeg: d.is_veg
          }));
          setItems(mappedItems);
          const cats = ['ALL', ...Array.from(new Set(mappedItems.map((m: any) => m.category)))];
          setCategories(cats as string[]);
        }
      }
    }
    loadData();
  }, []);

  const handlePublish = async () => {
    if (!restaurantId) {
      showToast("Restaurant data not loaded yet! Please refresh the page.");
      return;
    }
    setIsPublishing(true);
    try {
      if (restaurantId) {
        localStorage.setItem(`tabletapy_show_images_${restaurantId}`, String(showDishImages));
      }
      const effectiveCardStyle = showDishImages ? (cardStyle.replace(':no-image', '')) : `${cardStyle.replace(':no-image', '')}:no-image`;
      const { error } = await supabase.from('restaurants').update({
        logo_url: logoUrl,
        bg_color: bgColor,
        bg_pattern: bgPattern,
        bg_image: bgImage,
        primary_color: primaryColor,
        card_style: effectiveCardStyle,
        font: font,
        radius: radius,
        menu_layout: menuLayout
      }).eq('id', restaurantId);
      
      if (error) {
        console.error("Supabase Error:", error);
        showToast(`Database Error: ${error.message}`);
        return;
      }
      
      showToast('✨ Theme published successfully to your live menu!');
    } catch (e: any) {
      console.error(e);
      showToast('Error publishing theme: ' + e.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setLogoUrl(dataUrl);
        processImageForPalette(dataUrl, true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMoodImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        processImageForPalette(dataUrl, true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBgImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<{ item: MenuItem; price: number }[]>([]);

  const cartTotal = cart.reduce((acc, curr) => acc + curr.price, 0);

  const handleUpdateQuantity = (item: MenuItem, delta: number) => {
    setCart(prev => {
      if (delta > 0) {
        return [...prev, { item, price: item.basePrice }];
      }
      const idx = prev.findIndex(c => c.item.id === item.id);
      if (idx !== -1) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      return prev;
    });
  };

  const handlePlaceOrder = (note: string) => {
    showToast(`(Preview Mode) Order placed! Note: ${note || 'None'}`);
  };

  // Shared props object to pass to all templates
  const templateProps = {
    items,
    categories,
    primaryColor,
    font,
    radius,
    layoutMode: menuLayout,
    restaurantName,
    logoUrl,
    tableNo: "12",
    bgColor,
    bgPattern,
    bgImage,
    cardStyle,
    cart,
    onUpdateQuantity: handleUpdateQuantity,
    onSelectItem: setSelectedItem,
    showDishImages,
    onOpenCart: () => setIsCartOpen(true)
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#1e1e1e] text-zinc-200 font-sans selection:bg-[#E46254] selection:text-white">
      {/* HEADER */}
      <header className="h-14 border-b border-black/20 bg-[#252525] flex items-center justify-between px-5 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={15} className="text-[#E46254]" /> Studio Pro
          </span>
        </div>
        <button 
          onClick={handlePublish}
          disabled={isPublishing}
          className="px-6 py-2 bg-[#E46254] hover:bg-[#c95346] text-white rounded-lg text-xs font-bold transition-all shadow-[0_0_20px_rgba(228,98,84,0.3)] disabled:opacity-50 flex items-center gap-2"
        >
          {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Publish Theme
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT CONTROL PANEL */}
        <div className="w-[360px] bg-[#252525] border-r border-black/20 flex flex-col shrink-0 z-40 overflow-y-auto custom-scrollbar pb-10 shadow-2xl z-50">
          
          {/* 1. BRAND IDENTITY */}
          <div className="p-6 border-b border-zinc-800/80 relative">
            <Link href="/dashboard/menu" className="absolute top-4 right-4 text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
               Manage Menu Items
            </Link>

            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4 mt-2">
              1. Brand Identity
            </h2>
            
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Restaurant Logo</label>
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-700 rounded-2xl bg-black/20 hover:bg-black/40 transition-colors cursor-pointer relative">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              {logoUrl ? (
                <img src={logoUrl} className="h-16 object-contain mb-2 pointer-events-none" />
              ) : (
                <UploadCloud className="w-8 h-8 text-zinc-500 mb-2 pointer-events-none" />
              )}
              <span className="text-xs font-bold text-zinc-400 pointer-events-none">{logoUrl ? 'Change Logo' : 'Upload Logo (PNG/JPG)'}</span>
            </div>
          </div>

          {/* ✨ MAGIC PALETTE & HARMONY ENGINE (0ms In-Browser Client-Side) */}
          <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/40">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Wand2 size={14} className="text-[#E46254]" />
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                  Auto-Style from Image
                </h2>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                0ms · Zero API
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-snug mb-3">
              Analyzes colors from your logo or food photos using client-side canvas and computes harmonic themes with guaranteed contrast.
            </p>

            {/* Upload food or mood photo to extract */}
            <div className="mb-3">
              <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-zinc-700 hover:border-[#E46254] bg-black/20 hover:bg-black/40 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleMoodImageUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
                {isAnalyzingImage ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-[#E46254]" />
                    <span className="text-[#E46254]">Analyzing Pixels...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon size={13} className="text-zinc-400" />
                    <span>Upload Dish / Mood Photo</span>
                  </>
                )}
              </label>
            </div>

            {/* Extracted Swatches & 1-Click Themes */}
            {extractedPalette && (
              <div className="space-y-3 pt-1">
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                    Extracted Swatches (Click to set Accent)
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {extractedPalette.swatches.map((hex, idx) => (
                      <button
                        key={`${hex}-${idx}`}
                        type="button"
                        onClick={() => {
                          setPrimaryColor(hex);
                          showToast(`Set primary accent to ${hex}`);
                        }}
                        title={`Click to set accent: ${hex}`}
                        className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                          primaryColor.toLowerCase() === hex.toLowerCase() 
                            ? 'border-white scale-110 shadow-md ring-2 ring-[#E46254]' 
                            : 'border-black/40'
                        }`}
                        style={{ backgroundColor: hex }}
                      >
                        {primaryColor.toLowerCase() === hex.toLowerCase() && (
                          <Check size={12} className={isDarkColor(hex) ? 'text-white' : 'text-zinc-900'} strokeWidth={3} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {extractedPalette.hasWhiteBackgroundBox && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10.5px] text-amber-200 flex items-start gap-2">
                    <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>White background box detected on logo. TableTapy automatically frames it in an aesthetic badge so it looks refined on dark mode!</span>
                  </div>
                )}

                {/* 1-Click Presets */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPrimaryColor(extractedPalette.suggestedLight.primaryColor);
                      setBgColor(extractedPalette.suggestedLight.bgColor);
                      setCardStyle('solid');
                      showToast(`Applied "${extractedPalette.suggestedLight.name}"!`);
                    }}
                    className="p-2.5 rounded-xl border border-zinc-700 bg-white hover:bg-zinc-100 text-zinc-900 transition-all text-left flex flex-col justify-between group cursor-pointer shadow-xs active:scale-95"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Sun size={14} className="text-amber-500" />
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-black/10" 
                        style={{ backgroundColor: extractedPalette.suggestedLight.primaryColor }} 
                      />
                    </div>
                    <span className="text-[11px] font-bold text-zinc-900 leading-tight">Vibrant Light</span>
                    <span className="text-[9px] text-zinc-500 font-medium mt-0.5">Harmonic daylight</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrimaryColor(extractedPalette.suggestedDark.primaryColor);
                      setBgColor(extractedPalette.suggestedDark.bgColor);
                      setCardStyle('solid');
                      showToast(`Applied "${extractedPalette.suggestedDark.name}"!`);
                    }}
                    className="p-2.5 rounded-xl border border-zinc-700/80 bg-zinc-950 hover:bg-black text-white transition-all text-left flex flex-col justify-between group cursor-pointer shadow-md active:scale-95"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Moon size={14} className="text-indigo-400" />
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-white/20" 
                        style={{ backgroundColor: extractedPalette.suggestedDark.primaryColor }} 
                      />
                    </div>
                    <span className="text-[11px] font-bold text-white leading-tight">Bistro Noir</span>
                    <span className="text-[9px] text-zinc-400 font-medium mt-0.5">Atmospheric dark</span>
                  </button>
                </div>
              </div>
            )}
          </div>



          {/* 2. BACKGROUND THEME */}
          <div className="p-6 border-b border-zinc-800/80">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
              2. Background Theme
            </h2>
            
            {/* Color options */}
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Base Color</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { val: '#ffffff', label: 'White' },
                { val: '#f9fafb', label: 'Gray' },
                { val: '#fef3c7', label: 'Warm' },
                { val: '#ecfdf5', label: 'Sage' },
                { val: '#e0e7ff', label: 'Blue' },
                { val: '#fbcfe8', label: 'Pink' },
                { val: '#0f172a', label: 'Dark' },
                { val: '#FFD600', label: 'Yellow' },
                { val: '#FF007F', label: 'Hot Pink' },
                { val: '#00FF00', label: 'Lime' }
              ].map(c => (
                <button 
                  key={c.val} 
                  title={c.label}
                  onClick={() => setBgColor(c.val)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${bgColor === c.val ? 'border-blue-500 scale-110' : 'border-zinc-700'}`}
                  style={{ backgroundColor: c.val }}
                />
              ))}
            </div>

            </div>

          {/* 3. TYPOGRAPHY & COLORS */}
          <div className="p-6 border-b border-zinc-800/80">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">
              3. Colors & Typography
            </h2>

            <label className="block text-xs font-semibold text-zinc-300 mb-2">Accent Color</label>
            {cardStyle === 'brutalist' ? (
              <div className="mb-6 space-y-2">
                <span className="text-[10px] text-zinc-500 font-bold block">Curated Neo-Brutalist Palettes</span>
                <div className="flex flex-col gap-2">
                  {Object.entries(NEO_PALETTES).map(([key, p]: any) => (
                    <button
                      key={key}
                      onClick={() => setPrimaryColor(key)}
                      title={p.name}
                      className={`flex p-1 border-[2px] transition-transform hover:-translate-y-[2px] ${primaryColor === key ? 'border-white shadow-[2px_2px_0_0_#fff]' : 'border-zinc-800'}`}
                      style={{ backgroundColor: p.bg }}
                    >
                       <div className="w-6 h-6 border-[2px] border-black shadow-[1px_1px_0_0_#000]" style={{ backgroundColor: p.accent }} />
                       <div className="w-6 h-6 border-[2px] border-black ml-1 shadow-[1px_1px_0_0_#000]" style={{ backgroundColor: p.alt }} />
                       <div className="w-6 h-6 border-[2px] border-black ml-1 shadow-[1px_1px_0_0_#000]" style={{ backgroundColor: p.card }} />
                       <div className="flex-1 flex items-center justify-end px-2">
                          <span className="text-[10px] uppercase font-bold text-black" style={{ color: p.text }}>{p.name}</span>
                       </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : cardStyle === 'cafe' ? (
              <div className="mb-6 space-y-2">
                <span className="text-[10px] text-zinc-500 font-bold block">Artisan Cafe Palettes</span>
                <div className="flex flex-col gap-2">
                  {Object.entries(CAFE_PALETTES).map(([key, p]: any) => (
                    <button
                      key={key}
                      onClick={() => setPrimaryColor(key)}
                      title={p.name}
                      className={`flex p-2 border transition-transform hover:scale-[1.02] ${primaryColor === key ? 'border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'border-zinc-800'}`}
                      style={{ backgroundColor: p.bg, borderRadius: '8px' }}
                    >
                       <div className="w-8 h-8 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: p.card }} />
                       <div className="w-8 h-8 rounded-full border border-black/10 shadow-sm -ml-2" style={{ backgroundColor: p.accent }} />
                       <div className="flex-1 flex items-center justify-end px-2">
                          <span className="text-[11px] font-bold" style={{ color: p.text, fontFamily: 'Playfair Display, serif' }}>{p.name}</span>
                       </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : cardStyle === 'qsr' ? (
              <div className="mb-6 space-y-2">
                <span className="text-[10px] text-zinc-500 font-bold block">QSR High-Energy Palettes</span>
                <div className="flex flex-col gap-2">
                  {Object.entries(QSR_PALETTES).map(([key, p]: any) => (
                    <button
                      key={key}
                      onClick={() => setPrimaryColor(key)}
                      title={p.name}
                      className={`flex p-2 border transition-all ${primaryColor === key ? 'border-white shadow-[0_0_12px_rgba(229,57,53,0.4)] scale-[1.02]' : 'border-zinc-800'}`}
                      style={{ backgroundColor: p.bg, borderRadius: '10px' }}
                    >
                       <div className="w-7 h-7 rounded-lg border border-black/10 shadow-sm" style={{ backgroundColor: p.accent }} />
                       <div className="w-7 h-7 rounded-lg border border-black/10 shadow-sm -ml-2" style={{ backgroundColor: p.alt }} />
                       <div className="flex-1 flex items-center justify-end px-2">
                          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: p.text }}>{p.name}</span>
                       </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (() => {
              const presetBgs = [
                { name: 'Pure White', hex: '#FFFFFF' },
                { name: 'Paper', hex: '#F9FAFB' },
                { name: 'Latte', hex: '#FDFBF7' },
                { name: 'Oatmeal', hex: '#F4EFE6' },
                { name: 'Midnight', hex: '#18181B' }
              ];
              const presetAccents = [
                { name: 'Obsidian', hex: '#111827' },
                { name: 'Tomato', hex: '#E11D48' },
                { name: 'Terracotta', hex: '#EA580C' },
                { name: 'Emerald', hex: '#059669' },
                { name: 'Cobalt', hex: '#2563EB' }
              ];
              const isCustomBg = !presetBgs.some(c => c.hex.toLowerCase() === bgColor?.toLowerCase());
              const isCustomAccent = !presetAccents.some(c => c.hex.toLowerCase() === primaryColor?.toLowerCase());

              return (
                <>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-2">Premium Backgrounds</label>
                  <div className="grid grid-cols-5 gap-2 mb-6">
                    {presetBgs.map(c => (
                      <button
                        key={c.name}
                        title={c.name}
                        onClick={() => setBgColor(c.hex)}
                        className="group flex flex-col items-center gap-1.5"
                      >
                        <div className={`w-full aspect-square rounded-xl shadow-sm border-[3px] transition-all ${!isCustomBg && bgColor?.toLowerCase() === c.hex.toLowerCase() ? 'border-blue-500 scale-105 shadow-md' : 'border-zinc-700/30 hover:scale-105 hover:border-zinc-500'}`} style={{ backgroundColor: c.hex }} />
                        <span className={`text-[8px] font-bold uppercase tracking-wider text-center leading-tight ${!isCustomBg && bgColor?.toLowerCase() === c.hex.toLowerCase() ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{c.name}</span>
                      </button>
                    ))}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`relative w-full aspect-square rounded-xl overflow-hidden border-[3px] flex items-center justify-center transition-all cursor-pointer ${isCustomBg ? 'border-blue-500 scale-105 shadow-md' : 'border-dashed border-zinc-600 hover:border-white'}`} style={{ backgroundColor: isCustomBg ? bgColor : 'transparent' }} title="Custom Background">
                        <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                        {!isCustomBg && <span className="text-zinc-400 font-bold">+</span>}
                      </div>
                      <span className={`text-[8px] font-bold uppercase tracking-wider text-center ${isCustomBg ? 'text-blue-400' : 'text-zinc-500'}`}>{isCustomBg ? bgColor : 'Custom'}</span>
                    </div>
                  </div>

                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-2 mt-4">Premium Accents</label>
                  <div className="grid grid-cols-5 gap-2 mb-6">
                    {presetAccents.map(c => (
                      <button
                        key={c.name}
                        title={c.name}
                        onClick={() => setPrimaryColor(c.hex)}
                        className="group flex flex-col items-center gap-1.5"
                      >
                        <div className={`w-full aspect-square rounded-xl shadow-sm border-[3px] transition-all ${!isCustomAccent && primaryColor?.toLowerCase() === c.hex.toLowerCase() ? 'border-white scale-105 shadow-md' : 'border-zinc-700/30 hover:scale-105 hover:border-zinc-500'}`} style={{ backgroundColor: c.hex }} />
                        <span className={`text-[8px] font-bold uppercase tracking-wider text-center leading-tight ${!isCustomAccent && primaryColor?.toLowerCase() === c.hex.toLowerCase() ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{c.name}</span>
                      </button>
                    ))}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`relative w-full aspect-square rounded-xl overflow-hidden border-[3px] flex items-center justify-center transition-all cursor-pointer ${isCustomAccent ? 'border-white scale-105 shadow-md' : 'border-dashed border-zinc-600 hover:border-white'}`} style={{ backgroundColor: isCustomAccent ? primaryColor : 'transparent' }} title="Custom Accent">
                        <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                        {!isCustomAccent && <span className="text-zinc-400 font-bold">+</span>}
                      </div>
                      <span className={`text-[8px] font-bold uppercase tracking-wider text-center ${isCustomAccent ? 'text-white' : 'text-zinc-500'}`}>{isCustomAccent ? primaryColor : 'Custom'}</span>
                    </div>
                  </div>
                </>
              );
            })()}

            <label className="block text-xs font-semibold text-zinc-300 mb-2">Menu Layout</label>
            <div className="flex bg-black/20 rounded-lg p-1 border border-zinc-800 mb-4">
              <button
                onClick={() => setMenuLayout('list')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold transition-all rounded-md cursor-pointer ${menuLayout === 'list' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <LayoutList size={16} /> 1 Per Row
              </button>
              <button
                onClick={() => setMenuLayout('grid')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold transition-all rounded-md cursor-pointer ${menuLayout === 'grid' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Grid2X2 size={16} /> 2 Per Row
              </button>
            </div>

            {/* Dish Card Photo Mode Toggle */}
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Card Image Display</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/20 rounded-xl border border-zinc-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setShowDishImages(true);
                  if (restaurantId) localStorage.setItem(`tabletapy_show_images_${restaurantId}`, 'true');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  showDishImages 
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Camera size={14} />
                <span>Show Photos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDishImages(false);
                  if (restaurantId) localStorage.setItem(`tabletapy_show_images_${restaurantId}`, 'false');
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !showDishImages 
                    ? 'bg-zinc-100 text-zinc-950 shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Utensils size={14} />
                <span>Editorial (Text Only)</span>
              </button>
            </div>

            <label className="block text-xs font-semibold text-zinc-300 mb-2">Typography</label>
            <select 
              value={font} 
              onChange={(e) => setFont(e.target.value)} 
              className="w-full bg-black/20 border border-zinc-800 rounded-lg p-2.5 text-xs font-bold text-zinc-300 outline-none focus:border-blue-500"
            >
              <option value="Inter, sans-serif">Modern (Inter)</option>
              <option value="Georgia, serif">Elegant (Georgia)</option>
              <option value="Space Grotesk, monospace">Edgy (Space Grotesk)</option>
              <option value="'Quicksand', sans-serif">Friendly (Quicksand)</option>
            </select>
          </div>

          {/* 4. CARD STYLE (Temporarily disabled to focus on core menu logic) */}
          {/* 
          <div className={`p-6 border-b border-zinc-800/80 transition-all ${cardStyle === 'brutalist' ? 'opacity-50 pointer-events-none' : ''}`}>
            ... (card styles locked) ...
          </div> 
          */}
        </div>

        {/* DEVICE PREVIEW - DESIGN CANVAS */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex justify-center py-10 px-4 relative" style={{ backgroundColor: '#f3f4f6', backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          
          {/* We use scale and top-center origin so it shrinks but NEVER clips the top off */}
          <div 
            className="w-[375px] h-[812px] shrink-0 relative shadow-[0_20px_80px_rgba(0,0,0,0.8)] flex flex-col rounded-[42px] border-[14px] border-[#18181b] bg-white overflow-hidden transition-transform"
            style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}
          >
            
            {/* Phone Notch/Dynamic Island */}
            <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50 pointer-events-none">
              <div className="w-[120px] h-[30px] bg-[#18181b] rounded-b-3xl"></div>
            </div>

            {/* Content Area */}
            <div className="w-full h-full relative overflow-hidden bg-white">
              
              {/* The Drag-to-Scroll Simulator */}
              <PhoneSimulator>
                {businessType === 'HOTEL' ? (
                  <HotelPortal
                    restaurantId={restaurantId}
                    hotelName={restaurantName}
                    logoUrl={logoUrl}
                    items={items}
                    theme={{
                      primary_color: primaryColor,
                      bg_color: bgColor,
                      radius: radius,
                      font: font
                    }}
                  />
                ) : (
                  <MenuTemplate {...templateProps} />
                )}
              </PhoneSimulator>

              {/* Cart Summary Button (Floats at bottom of phone) */}
              {businessType !== 'HOTEL' && cart.length > 0 && (
                <div className="absolute bottom-5 left-0 right-0 px-4 z-40 animate-in slide-in-from-bottom-4 pointer-events-none flex justify-center">
                  {cardStyle === 'brutalist' ? (
                    <button 
                    onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30); setIsCartOpen(true); }}
                    className="w-full max-w-[400px] border-[3px] border-black flex items-stretch text-black font-black uppercase pointer-events-auto shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <div className="flex-1 px-4 py-3 text-left flex items-center">
                      <span className="text-sm tracking-widest">CART [{cart.length}]</span>
                    </div>
                    <div className="px-4 py-3 border-l-[3px] border-black bg-white flex items-center justify-center min-w-[100px]">
                      <span className="text-base tracking-tighter">${cartTotal.toFixed(2)}</span>
                    </div>
                  </button>
                ) : cardStyle === 'cafe' ? (
                  <button 
                    onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30); setIsCartOpen(true); }}
                    className={`w-full max-w-[400px] py-4 px-6 flex justify-between items-center text-white transition-all pointer-events-auto active:scale-95 shadow-xl hover:shadow-2xl rounded-full border border-white/20 backdrop-blur-md`}
                    style={{ backgroundColor: (CAFE_PALETTES[primaryColor] || CAFE_PALETTES['#4A3B32']).accent }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full border border-white/30">
                        {cart.length}
                      </div>
                      <span className="text-sm tracking-widest uppercase font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>View Order</span>
                    </div>
                    <span className="text-base font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>${cartTotal.toFixed(2)}</span>
                  </button>
                ) : cardStyle === 'qsr' ? (
                  <button 
                    onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30); setIsCartOpen(true); }}
                    className="w-full max-w-[400px] py-4 px-6 flex justify-between items-center text-white transition-all pointer-events-auto active:scale-95 shadow-2xl rounded-2xl border border-white/20 font-black tracking-wider uppercase text-sm"
                    style={{ backgroundColor: (QSR_PALETTES[primaryColor] || QSR_PALETTES['#E53935']).accent }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center text-xs font-black rounded-full bg-white text-zinc-900">
                        {cart.length}
                      </div>
                      <span>VIEW ORDER</span>
                    </div>
                    <span className="text-base font-black">₹{cartTotal.toFixed(0)}</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30); setIsCartOpen(true); }}
                    className={`w-full max-w-[400px] py-4 px-5 flex justify-between items-center text-white font-bold transition-all pointer-events-auto active:scale-95 shadow-xl hover:opacity-95 ${cart.length === 0 ? 'opacity-90' : ''} ${radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-full' : 'rounded-2xl'}`}
                    style={{ backgroundColor: primaryColor }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center text-xs font-black rounded-full bg-white/20">
                        {cart.length}
                      </div>
                      <span className="text-sm tracking-wide">VIEW ORDER</span>
                    </div>
                    <span className="text-base">${cartTotal.toFixed(2)}</span>
                  </button>
                )}
              </div>
              )}

              {/* Modals are rendered OUTSIDE the PhoneSimulator so drag events don't mess with them */}
              {businessType !== 'HOTEL' && (
                <>
                  <ModifiersSheet item={selectedItem} primaryColor={primaryColor} radius={radius} cardStyle={cardStyle} onClose={() => setSelectedItem(null)} onAddToCart={(item: MenuItem, price: number) => { setCart(prev => [...prev, { item, price }]); setSelectedItem(null); }} />
                  <CartSheet businessType={businessType} isOpen={isCartOpen} cart={cart} primaryColor={primaryColor} radius={radius} cardStyle={cardStyle} onClose={() => setIsCartOpen(false)} onClearCart={() => setCart([])} onPlaceOrder={handlePlaceOrder} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] px-4 py-2.5 bg-zinc-950/95 backdrop-blur-md text-white text-xs font-semibold rounded-2xl border border-zinc-700/80 shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles size={14} className="text-[#E46254] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}