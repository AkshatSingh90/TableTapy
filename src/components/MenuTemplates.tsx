"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Check, 
  LayoutList, 
  Grid2X2, 
  Search, 
  Flame, 
  Clock, 
  Star, 
  Camera,
  Coins,
  Sparkles,
  ChefHat,
  Percent,
  Tag,
  ShieldCheck,
  ArrowRight,
  Utensils,
  Bell,
  CheckCircle2,
  ExternalLink,
  Loader2
} from "lucide-react";

import { 
  ItemVariantsConfig, 
  extractVariantsFromDescription, 
  COMMON_PREP_TAGS, 
  PortionOption, 
  AddonOption 
} from "@/utils/menuItemVariants";

export function DishBadgePill({ 
  badge, 
  mode = 'glass' 
}: { 
  badge: string; 
  mode?: 'glass' | 'inline' 
}) {
  if (!badge) return null;
  const normalized = badge.toUpperCase().replace(/['\s_]/g, '');

  let label = badge;
  let Icon = Sparkles;
  let iconColor = 'text-amber-400';

  if (normalized.includes('CHEF')) {
    label = "Chef's Signature";
    Icon = ChefHat;
    iconColor = 'text-amber-300';
  } else if (normalized.includes('BESTSELLER')) {
    label = "Bestseller";
    Icon = Sparkles;
    iconColor = 'text-amber-300';
  } else if (normalized.includes('MUST')) {
    label = "Must Try";
    Icon = Flame;
    iconColor = 'text-orange-400';
  } else if (normalized.includes('SPECIAL')) {
    label = "House Special";
    Icon = Star;
    iconColor = 'text-amber-300';
  }

  if (mode === 'inline') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.2em] uppercase text-stone-600 dark:text-stone-300">
        <Icon size={10} className={iconColor} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-950/75 backdrop-blur-md text-white/95 border border-white/15 text-[9px] font-semibold tracking-[0.14em] uppercase shadow-md pointer-events-none">
      <Icon size={10} className={iconColor} />
      <span>{label}</span>
    </span>
  );
}

export const triggerHaptic = (pattern: number | number[] = 30) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const NEO_PALETTES: any = {
  '#CC3333': { name: 'Kuch Bhi', bg: '#FDFBF7', card: '#ffffff', accent: '#CC3333', alt: '#F2C94C', text: '#0B0C10', border: '#0B0C10' },
  '#FF007F': { name: 'Gumroad', bg: '#E0FF31', card: '#ffffff', accent: '#FF007F', alt: '#00F0FF', text: '#000000', border: '#000000' },
  '#0033FF': { name: 'Retro Tech', bg: '#E5E5F7', card: '#ffffff', accent: '#0033FF', alt: '#FF6600', text: '#111111', border: '#111111' },
  '#84A98C': { name: 'Matcha', bg: '#F2E9E4', card: '#ffffff', accent: '#84A98C', alt: '#E07A5F', text: '#22223B', border: '#22223B' },
  '#219EBC': { name: 'Loud Pink', bg: '#FFB3C6', card: '#ffffff', accent: '#219EBC', alt: '#FFB703', text: '#023047', border: '#023047' }
};

export const CAFE_PALETTES: any = {
  '#4A3B32': { name: 'Espresso', bg: '#FDFBF7', card: '#F5F2EB', accent: '#8B5A2B', text: '#3E2F25', border: '#E8DED1', line: '#D4C4B7' },
  '#2C3625': { name: 'Matcha Luxe', bg: '#F8FAF6', card: '#EDF2E8', accent: '#708861', text: '#2C3625', border: '#DCE6D5', line: '#C9D3C0' },
  '#1F2937': { name: 'Monochrome', bg: '#F8F9FA', card: '#FFFFFF', accent: '#4B5563', text: '#1F2937', border: '#E5E7EB', line: '#D1D5DB' },
  '#5C2C35': { name: 'Velvet', bg: '#FCF9FC', card: '#FDF7F8', accent: '#8E4A59', text: '#5C2C35', border: '#EBDDE0', line: '#DAB8C1' },
  '#0F172A': { name: 'Midnight', bg: '#0F172A', card: '#1E293B', accent: '#94A3B8', text: '#F8FAFC', border: '#334155', line: '#475569' }
};

export const QSR_PALETTES: any = {
  '#E53935': { name: 'Tandoori Red', bg: '#FFF8F6', card: '#FFFFFF', accent: '#E53935', alt: '#FFC107', text: '#111111', border: '#FEE2E2', badge: '#D97706' },
  '#D97706': { name: 'Turmeric Gold', bg: '#FFFDF5', card: '#FFFFFF', accent: '#D97706', alt: '#EF4444', text: '#1C1917', border: '#FEF3C7', badge: '#DC2626' },
  '#16A34A': { name: 'Chutney Green', bg: '#F0FDF4', card: '#FFFFFF', accent: '#16A34A', alt: '#EAB308', text: '#052E16', border: '#DCFCE7', badge: '#16A34A' },
  '#F97316': { name: 'Biryani Saffron', bg: '#18181B', card: '#27272A', accent: '#F97316', alt: '#F59E0B', text: '#FAFAFA', border: '#3F3F46', badge: '#F97316' },
  '#FF5200': { name: 'Fast Casual', bg: '#FAFAFA', card: '#FFFFFF', accent: '#FF5200', alt: '#22C55E', text: '#09090B', border: '#F4F4F5', badge: '#FF5200' }
};



export const findPalette = (palettes: any, colorKey: string, fallbackKey: string) => {
  if (!palettes) return null;
  if (colorKey && palettes[colorKey]) return palettes[colorKey];
  if (colorKey) {
    const match = Object.keys(palettes).find(k => k.toLowerCase() === colorKey.toLowerCase());
    if (match) return palettes[match];
  }
  return palettes[fallbackKey];
};

export function VegSymbol({ isVeg }: { isVeg?: boolean }) {
  if (isVeg === undefined) return null;
  return isVeg ? (
    <span title="Vegetarian" className="inline-flex items-center justify-center w-3.5 h-3.5 border-2 border-emerald-600 p-[1px] bg-white shrink-0 rounded-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
    </span>
  ) : (
    <span title="Non-Vegetarian" className="inline-flex items-center justify-center w-3.5 h-3.5 border-2 border-amber-800 p-[1px] bg-white shrink-0 rounded-sm">
      <span className="w-0 h-0 border-x-[3px] border-x-transparent border-b-[5px] border-b-amber-800" />
    </span>
  );
}

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  description?: string;
  basePrice: number;
  img?: string;
  category: string;
  badge?: string;
  dietary?: string[];
  isVeg?: boolean;
  variantsConfig?: ItemVariantsConfig;
  portionName?: string;
  notes?: string;
}

export const MOCK_ITEMS: MenuItem[] = [
  { 
    id: '1', 
    category: 'BURGERS', 
    name: 'Classic Burger', 
    desc: 'Crispy veggie patty, cheddar, lettuce, tomato, house sauce.', 
    basePrice: 249.00, 
    img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
    badge: 'POPULAR',
    isVeg: true
  },
  { 
    id: '2', 
    category: 'BURGERS', 
    name: 'Double Smash', 
    desc: 'Two smashed beef patties, double cheese, caramelized onions.', 
    basePrice: 349.00, 
    img: 'https://images.unsplash.com/photo-1594212848116-b8db20577184?w=600&q=80',
    badge: 'CHEF\'S SIGNATURE',
    dietary: ['GF'],
    isVeg: false
  },
  { 
    id: '3', 
    category: 'SNACKS', 
    name: 'Loaded Fries', 
    desc: 'Crispy fries topped with melted cheese, jalapeno, and herbs.', 
    basePrice: 199.00, 
    img: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&q=80',
    badge: 'BESTSELLER',
    isVeg: true
  },
  { 
    id: '4', 
    category: 'DRINKS', 
    name: 'Artisanal Craft Soda', 
    desc: 'Refreshing chilled botanical beverage infused with fresh lime.', 
    basePrice: 149.00,
    img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80',
    isVeg: true
  },
  {
    id: '5',
    category: 'MAINS',
    name: 'Truffle Mushroom Risotto',
    desc: 'Arborio rice in rich broth with shaved black truffles & parmesan.',
    basePrice: 499.00,
    img: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=600&q=80',
    badge: 'MUST TRY',
    isVeg: true
  }
];


export function MenuTemplate({ 
  items, 
  categories = ['ALL', 'BURGERS', 'SNACKS', 'DRINKS'], 
  primaryColor, 
  font, 
  restaurantName, 
  logoUrl, 
  tableNo, 
  onSelectItem, 
  bgColor = '#f9fafb', 
  bgPattern = 'none', 
  bgImage = null, 
  cardStyle = 'solid', 
  radius = 'rounded', 
  layoutMode = 'list', 
  marqueeText = '', 
  cart = [], 
  onUpdateQuantity,
  promotionsConfig,
  happyHourInfo,
  customerCoins
}: any) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dietFilter, setDietFilter] = useState('ALL');

  const hasBadgedItems = useMemo(() => items.some((i: any) => i.badge), [items]);
  const displayCategories = useMemo(() => {
    if (hasBadgedItems && !categories.includes('HIGHLIGHTS')) {
      const remaining = categories.filter((c: string) => c !== 'ALL');
      return ['ALL', 'HIGHLIGHTS', ...remaining];
    }
    return categories;
  }, [categories, hasBadgedItems]);

  const filteredItems = items
    .filter((item: MenuItem) => {
      if (activeCategory === 'ALL') return true;
      if (activeCategory === 'HIGHLIGHTS') return !!item.badge;
      return item.category === activeCategory;
    })
    .filter((item: MenuItem) => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.desc && item.desc.toLowerCase().includes(searchTerm.toLowerCase())))
    .filter((item: MenuItem) => {
      if (dietFilter === 'VEG') return item.isVeg === true;
      if (dietFilter === 'NON-VEG') return item.isVeg === false;
      return true;
    })
    .sort((a: MenuItem, b: MenuItem) => {
      if (a.badge && !b.badge) return -1;
      if (!a.badge && b.badge) return 1;
      return 0;
    });

  const cartSubtotal = cart.reduce((acc: number, curr: any) => acc + curr.price, 0);

  const { coinRewardText, currentTierCoins, nextMilestone } = useMemo(() => {
    if (!promotionsConfig?.loyaltyEnabled || !promotionsConfig?.milestones || promotionsConfig.milestones.length === 0) {
      return { coinRewardText: '', currentTierCoins: 0, nextMilestone: null };
    }

    const milestones = [...promotionsConfig.milestones].sort((a: any, b: any) => a.minSpend - b.minSpend);
    const earned = milestones.filter((m: any) => cartSubtotal >= m.minSpend).sort((a: any, b: any) => b.coinsEarned - a.coinsEarned)[0]?.coinsEarned || 0;
    const next = milestones.find((m: any) => m.minSpend > cartSubtotal);

    let text = '';
    if (cartSubtotal === 0) {
      const summary = milestones.map((m: any) => `₹${m.minSpend} → ${m.coinsEarned}c`).join(' · ');
      text = `TableTapy Coins: ${summary} (1 Coin = ₹1)`;
    } else if (earned === 0 && next) {
      text = `Add ₹${(next.minSpend - cartSubtotal).toFixed(0)} more to earn ${next.coinsEarned} TableTapy Coins!`;
    } else if (earned > 0 && next) {
      text = `${earned} Coins unlocked! Add ₹${(next.minSpend - cartSubtotal).toFixed(0)} to unlock ${next.coinsEarned} Coins`;
    } else if (earned > 0 && !next) {
      text = `Top tier unlocked! You earn ${earned} TableTapy Coins on this order`;
    }

    return { coinRewardText: text, currentTierCoins: earned, nextMilestone: next };
  }, [cartSubtotal, promotionsConfig]);

  const serviceCategories = ['Amenities', 'Services'];
  const serviceItems = filteredItems.filter((i: any) => serviceCategories.includes(i.category));
  const foodItems = filteredItems.filter((i: any) => !serviceCategories.includes(i.category));

  const getServiceIcon = (name: string) => {
    return <Sparkles size={20} className="text-zinc-600 mb-1" />;
  };


  const getItemQuantity = (itemId: string) => {
    if (!cart || !Array.isArray(cart)) return 0;
    return cart.filter((c: any) => (c.item?.id ? c.item.id === itemId : c.item === itemId)).length;
  };

  // Background Theme Logic
  const rootStyle: any = { fontFamily: font, backgroundColor: bgColor, minHeight: '100%', display: 'flex', flexDirection: 'column' };
  if (bgImage) {
    rootStyle.backgroundImage = `url(${bgImage})`;
    rootStyle.backgroundSize = 'cover';
    rootStyle.backgroundPosition = 'center';
    rootStyle.backgroundAttachment = 'fixed';
  }

  // Corner Radius Logic
  const radClass = cardStyle === 'brutalist' ? 'rounded-none' : radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-full' : 'rounded-2xl';
  const radSmClass = cardStyle === 'brutalist' ? 'rounded-none' : radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-full' : 'rounded-lg';
  const radBtnClass = cardStyle === 'brutalist' ? 'rounded-none' : radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-full' : 'rounded-xl';

  // Card Theme Logic
  const getCardClasses = () => {
    let base = cardStyle === 'glass' ? 'bg-white/50 backdrop-blur-md border border-white/60 shadow-lg ' :
               cardStyle === 'minimal' ? 'bg-transparent border-b border-gray-200 shadow-none rounded-none pb-4 ' :
               cardStyle === 'brutalist' ? 'bg-white border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] ' :
               'bg-white border border-gray-100 shadow-sm ';
    
    if (cardStyle !== 'minimal' && cardStyle !== 'brutalist') {
      base += (radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-[2rem]' : 'rounded-2xl');
    }
    return base;
  };

  const getImgClasses = () => {
    if (cardStyle === 'minimal') return radClass;
    return 'rounded-none'; // takes parent's overflow-hidden
  };

  const isDarkBg = bgColor === '#0f172a';
  const textColor = isDarkBg ? 'text-white' : 'text-gray-900';
  const subTextColor = isDarkBg ? 'text-gray-300' : 'text-gray-500';

  const activePalette = cardStyle === 'brutalist' 
    ? findPalette(NEO_PALETTES, primaryColor, '#CC3333')
    : cardStyle === 'cafe'
    ? findPalette(CAFE_PALETTES, primaryColor, '#4A3B32')
    : cardStyle === 'qsr'
    ? findPalette(QSR_PALETTES, primaryColor, '#E53935')
    : null;

  if (cardStyle === 'brutalist' && bgPattern !== 'brutalist-grid' && !bgImage) {
    rootStyle.backgroundColor = activePalette.bg;
  } else if (cardStyle === 'cafe' && !bgImage) {
    rootStyle.backgroundColor = activePalette.bg;
  } else if (cardStyle === 'qsr' && !bgImage) {
    rootStyle.backgroundColor = activePalette.bg;
  }

  return (
    <div className={`flex-1 w-full p-5 pb-36 transition-colors duration-300 relative ${textColor}`} style={rootStyle}>
      
      {/* ── TOP LUXURY PRIVILEGE RIBBON (Sleek, hairline, non-intrusive) ── */}
      {happyHourInfo?.isEnabled && (
        <div className="-mx-5 -mt-5 mb-5 overflow-hidden">
          {happyHourInfo.isActive ? (
            <div className="bg-zinc-950 text-white px-4 py-2 flex items-center justify-between text-[11px] font-medium tracking-wide shadow-sm border-b border-zinc-800">
              <div className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span className="font-semibold tracking-[0.16em] uppercase text-zinc-100 shrink-0">Happy Hour Active</span>
                <span className="text-zinc-400 truncate">
                  · Flat {happyHourInfo.discountPct}% OFF drinks & appetizers until {happyHourInfo.endTimeDisplay}
                </span>
              </div>
              {promotionsConfig?.loyaltyEnabled && customerCoins?.balance > 0 && (
                <div className="shrink-0 flex items-center gap-1.5 text-amber-300 text-[10.5px] font-medium pl-3">
                  <Sparkles size={11} className="text-amber-400" />
                  <span>{customerCoins.balance} Coins</span>
                </div>
              )}
            </div>
          ) : happyHourInfo.isTodayScheduled ? (
            <div className="bg-zinc-900/95 text-zinc-300 px-4 py-1.5 flex items-center justify-between text-[10.5px] font-medium tracking-wide border-b border-zinc-800/60">
              <div className="flex items-center gap-2 truncate">
                <Clock size={11} className="text-zinc-400 shrink-0" />
                <span className="truncate">
                  <strong className="text-zinc-200 font-semibold">Happy Hour Today:</strong> {happyHourInfo.startTimeDisplay} – {happyHourInfo.endTimeDisplay} · Flat {happyHourInfo.discountPct}% OFF
                </span>
              </div>
              {promotionsConfig?.loyaltyEnabled && customerCoins?.balance > 0 && (
                <div className="shrink-0 flex items-center gap-1.5 text-zinc-400 text-[10.5px] font-medium pl-3">
                  <Coins size={11} className="text-amber-400" />
                  <span>{customerCoins.balance} Coins</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Paper Texture Overlay */}
      {cardStyle === 'cafe' && !bgImage && (
        <div 
          className="absolute inset-0 pointer-events-none z-0 opacity-[0.4] mix-blend-multiply"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        ></div>
      )}

      {/* Header */}
      {cardStyle === 'brutalist' ? (
        <>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&display=swap');
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-marquee {
              animation: marquee 15s linear infinite;
              display: flex;
              width: max-content;
            }
            .font-stencil { font-family: 'Bebas Neue', cursive; }
            .font-display { font-family: 'Anton', sans-serif; }
          `}</style>
          
          <div className="mt-2 mb-8 flex items-stretch justify-between">
            <div className="flex-1 overflow-hidden border-[4px] p-4 shadow-[6px_6px_0_0_#000] mr-4 flex items-center" style={{ backgroundColor: activePalette.card, borderColor: activePalette.border }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-14 max-w-full object-contain" />
              ) : (
                <h1 className="text-5xl font-display uppercase tracking-wider truncate" style={{ color: activePalette.text }}>
                  {restaurantName || 'MENU'}
                </h1>
              )}
            </div>
            <div className="shrink-0 w-20 border-[4px] shadow-[4px_4px_0_0_#000] flex flex-col items-center justify-center rotate-3" style={{ backgroundColor: activePalette.alt, borderColor: activePalette.border, color: activePalette.text }}>
              <span className="font-stencil text-sm tracking-widest">TABLE</span>
              <span className="font-display text-3xl leading-none mt-1">{tableNo}</span>
            </div>
          </div>
        </>
      ) : cardStyle === 'cafe' ? (
        <div className="mb-10 pt-4 flex flex-col items-center justify-center text-center relative z-10">
          <div className="text-xs font-cafe-sans tracking-[0.3em] uppercase mb-2 opacity-70 flex items-center justify-center gap-2" style={{ color: activePalette.text }}>
            <span>Table {tableNo}</span>
            {promotionsConfig?.loyaltyEnabled && customerCoins?.balance > 0 && (
              <>
                <span className="opacity-40">•</span>
                <span className="text-amber-700 font-semibold flex items-center gap-1">
                  <Sparkles size={10} />
                  {customerCoins.balance} Coins
                </span>
              </>
            )}
          </div>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-20 max-w-[240px] w-auto object-contain" />
          ) : (
            <h1 className="text-4xl font-cafe-serif font-semibold tracking-wide" style={{ color: activePalette.text }}>
              {restaurantName || 'Menu'}
            </h1>
          )}
          <div className="w-12 h-[1px] mt-6" style={{ backgroundColor: activePalette.line }}></div>
        </div>
      ) : cardStyle === 'qsr' ? (
        <div className="mb-6 pt-2 flex items-center justify-between bg-white/90 backdrop-blur-md p-4 rounded-2xl border shadow-sm relative z-10" style={{ borderColor: activePalette.border }}>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 max-w-[150px] object-contain" />
            ) : (
              <div>
                <h1 className="text-2xl font-black tracking-tight uppercase" style={{ color: activePalette.text }}>
                  {restaurantName || 'EXPRESS MENU'}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" style={{ color: activePalette.accent }}>
                  ● Express Kitchen Live
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {promotionsConfig?.loyaltyEnabled && customerCoins?.balance > 0 && (
              <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                <Sparkles size={11} className="text-amber-600" />
                <span>{customerCoins.balance} Coins</span>
              </div>
            )}
            <div className="px-3.5 py-1.5 rounded-xl font-black text-xs tracking-wider text-white shadow-sm uppercase flex flex-col items-center justify-center" style={{ backgroundColor: activePalette.accent }}>
              <span className="text-[9px] opacity-80 leading-none">TABLE</span>
              <span className="text-sm font-extrabold leading-none mt-0.5">{tableNo}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 pt-3 space-y-6">
          <div className={`flex justify-between items-center ${bgImage ? `bg-white/90 backdrop-blur-md p-4 shadow-sm ${radClass}` : ''}`}>
            <div className="flex items-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-16 md:h-20 max-w-[200px] object-contain drop-shadow-sm" />
              ) : (
                <h1 className={`text-3xl md:text-4xl font-black tracking-tighter ${bgImage ? 'text-gray-900' : textColor}`}>
                  {restaurantName || 'Menu'}
                </h1>
              )}
            </div>
            <div className="flex items-center gap-2">
              {promotionsConfig?.loyaltyEnabled && customerCoins?.balance > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-medium border border-zinc-200/70 bg-white/80 backdrop-blur-xs shadow-2xs text-zinc-800">
                  <Sparkles size={11} className="text-amber-500" />
                  <span className="font-semibold">{customerCoins.balance} Coins</span>
                  <span className="text-zinc-400 text-[10px]">· ₹{customerCoins.balance}</span>
                </div>
              )}
              <div className={`flex flex-col items-center justify-center px-4 py-2 ${bgImage ? 'bg-white shadow-sm' : 'bg-black/5'} backdrop-blur-md rounded-2xl`}>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${bgImage ? 'text-gray-400' : subTextColor}`}>Table</span>
                <span className={`text-2xl md:text-3xl font-black leading-none mt-1 ${bgImage ? 'text-gray-900' : textColor}`}>
                  {tableNo}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative flex items-center w-full bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden">
              <Search size={18} className="absolute left-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search menu..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full py-4 pl-12 pr-4 bg-transparent outline-none text-sm font-bold text-gray-900 placeholder-gray-400"
              />
            </div>
            
            <div className="flex w-full bg-gray-200/60 p-1.5 rounded-2xl border border-gray-100/50 relative backdrop-blur-sm">
              <div 
                className="absolute top-1.5 bottom-1.5 bg-white rounded-xl shadow-sm transition-all duration-300 ease-out"
                style={{ 
                  width: 'calc(33.333% - 4px)', 
                  left: dietFilter === 'ALL' ? '6px' : dietFilter === 'VEG' ? 'calc(33.333% + 2px)' : 'calc(66.666% - 2px)'
                }}
              />
              {['ALL', 'VEG', 'NON-VEG'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => { triggerHaptic(); setDietFilter(opt); }}
                  className={`flex-1 py-3 text-[11px] sm:text-xs font-black tracking-wider uppercase z-10 transition-colors duration-300 ${dietFilter === opt ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {cardStyle === 'cafe' && (
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;700&display=swap');
          .font-cafe-serif { font-family: 'Playfair Display', serif; }
          .font-cafe-sans { font-family: 'Lato', sans-serif; }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-up {
            animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
        `}</style>
      )}


        
      {/* ── HOTEL AMENITIES & SERVICES DOCK ── */}
      {serviceItems.length > 0 && (
        <div className="px-5 mt-4 mb-2">
          <h3 className={`text-sm font-bold mb-3 ${cardStyle === 'brutalist' ? 'uppercase tracking-widest text-black' : 'text-gray-500'}`}>Guest Services</h3>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {serviceItems.map((item: any) => (
              <button
                key={item.id}
                onClick={() => {
                  const existing = cart.find((c: any) => c.id === item.id);
                  if (existing) {
                    onSelectItem(cart.map((c: any) => c.id === item.id ? { ...c, quantity: (c.quantity || 1) + 1, price: item.price * ((c.quantity || 1) + 1) } : c));
                  } else {
                    onSelectItem([...cart, { ...item, quantity: 1 }]);
                  }
                  triggerHaptic();
                }}
                className={`shrink-0 flex flex-col items-center justify-center w-[84px] h-[84px] transition-transform active:scale-95 ${cardStyle === 'brutalist' ? 'bg-white border-[3px] border-black rounded-none shadow-[2px_2px_0_0_#000]' : 'bg-white border border-gray-100 rounded-2xl shadow-sm'}`}
              >
                <span className="text-2xl mb-1">{getServiceIcon(item.name)}</span>
                <span className="text-[10px] font-bold text-center leading-tight px-1 text-gray-700">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div className={`flex overflow-x-auto gap-2 pb-4 mb-4 -mx-1 px-1 relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${cardStyle === 'cafe' ? 'justify-start md:justify-center border-b pb-6 gap-6' : ''}`} style={cardStyle === 'cafe' ? { borderColor: activePalette.line } : {}}>
          {displayCategories.map((cat: string, i: number) => {
            const isActive = activeCategory === cat;
            
            if (cardStyle === 'cafe') {
              return (
                <button 
                  key={i} 
                  onClick={() => { triggerHaptic(); setActiveCategory(cat); }} 
                  className={`relative font-cafe-sans tracking-[0.2em] text-xs uppercase whitespace-nowrap transition-colors pb-1 ${
                    isActive ? 'font-bold' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{ color: isActive ? activePalette.text : activePalette.text }}
                >
                  {cat}
                  {isActive && (
                    <span className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activePalette.accent }} />
                  )}
                </button>
              );
            }
            
            if (cardStyle === 'brutalist') {
              return (
                <button 
                  key={i} 
                  onClick={() => { triggerHaptic(); setActiveCategory(cat); }} 
                  className={`px-5 py-2 font-display text-2xl uppercase tracking-wide whitespace-nowrap transition-transform border-[4px] active:translate-y-0 ${
                    isActive 
                      ? 'translate-y-[4px] shadow-[0_0_0_0_#000]'
                      : 'hover:-translate-y-[2px]'
                  }`}
                  style={{
                    backgroundColor: isActive ? activePalette.accent : activePalette.card,
                    borderColor: activePalette.border,
                    color: activePalette.text,
                    boxShadow: isActive ? 'none' : `6px 6px 0 0 ${activePalette.border}`
                  }}
                >
                  {cat}
                </button>
              );
            }

            if (cardStyle === 'qsr') {
              return (
                <button 
                  key={i} 
                  onClick={() => { triggerHaptic(); setActiveCategory(cat); }} 
                  className={`px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-wider whitespace-nowrap transition-all shadow-sm ${
                    isActive 
                      ? 'text-white shadow-md scale-105' 
                      : 'bg-white border text-zinc-700 hover:bg-zinc-50'
                  }`}
                  style={isActive ? { backgroundColor: activePalette.accent, borderColor: activePalette.accent } : { borderColor: activePalette.border }}
                >
                  {cat}
                </button>
              );
            }

            return (
              <button 
                key={i} 
                onClick={() => { triggerHaptic(); setActiveCategory(cat); }} 
                className={`px-5 py-2 font-semibold capitalize text-sm whitespace-nowrap transition-all shadow-sm ${radClass} ${
                  isActive 
                    ? 'text-white'
                    : (isDarkBg ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')
                }`}
                style={isActive ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
              >
                {cat.toLowerCase()}
              </button>
            );
        })}
      </div>
      {/* Clean List/Grid Layout */}
      <div className={layoutMode === 'grid' ? "grid grid-cols-2 gap-4 relative z-10" : "flex flex-col gap-6 relative z-10"}>
        {filteredItems.map((item: MenuItem, i: number) => {
          const qty = getItemQuantity(item.id);
          const isGrid = layoutMode === 'grid';
          
          const isHappyHourActive = happyHourInfo?.isActive;
          const isEligibleCategory = (cat: string) => {
            const c = (cat || '').toUpperCase();
            return c.includes('DRINK') || c.includes('BEVERAGE') || c.includes('SNACK') || c.includes('APPETIZER') || c.includes('STARTER') || c.includes('CHAI') || c.includes('COFFEE');
          };
          const isItemHappyHour = isHappyHourActive && isEligibleCategory(item.category);
          const effectivePrice = isItemHappyHour 
            ? Math.round(item.basePrice * (1 - (happyHourInfo?.discountPct || 20) / 100))
            : item.basePrice;

          const itemWithPromo = isItemHappyHour 
            ? { ...item, basePrice: effectivePrice, originalPrice: item.basePrice }
            : item;

          if (cardStyle === 'brutalist') {
            return (
              <div 
                key={item.id} 
                onClick={() => { triggerHaptic(); onSelectItem(itemWithPromo); }} 
                className="relative cursor-pointer border-[4px] hover:-translate-y-[4px] transition-transform group flex flex-col w-full"
                style={{ 
                  backgroundColor: activePalette.card,
                  borderColor: activePalette.border,
                  boxShadow: `8px 8px 0 0 ${activePalette.border}`
                }}
              >
                {/* Tape Badge */}
                {item.badge && (
                  <div className="absolute top-2 -right-3 z-20 rotate-6 border-[3px] px-3 py-1 font-display text-lg tracking-wide uppercase whitespace-nowrap shadow-[4px_4px_0_0_#000]"
                       style={{ 
                         backgroundColor: activePalette.alt, 
                         color: activePalette.text, 
                         borderColor: activePalette.border
                       }}>
                    {item.badge}
                  </div>
                )}
                
                {/* Header Image Block */}
                <div className="w-full h-32 border-b-[4px] relative overflow-hidden bg-black/5 flex items-center justify-center" style={{ borderColor: activePalette.border }}>
                  {item.img ? (
                    <img src={item.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <Utensils size={36} className="text-stone-300 stroke-[1.5]" />
                    </div>
                  )}
                </div>
                
                {/* Content Block */}
                <div className="flex flex-col p-3 flex-1">
                   <div className="flex items-start gap-2 mb-1">
                     <div className="mt-1">
                       {item.isVeg ?? (item.category === 'BURGERS' || item.category === 'SNACKS') ? (
                         <span className="inline-block border-[2px] border-black bg-green-400 text-black px-1.5 py-0.5 text-[9px] font-black uppercase shadow-[2px_2px_0_0_#000] -rotate-2">VEG</span>
                       ) : (
                         <span className="inline-block border-[2px] border-black bg-red-400 text-black px-1.5 py-0.5 text-[9px] font-black uppercase shadow-[2px_2px_0_0_#000] -rotate-2">NON-VEG</span>
                       )}
                     </div>
                     <h3 className="font-display text-2xl uppercase leading-[1] tracking-wide line-clamp-2" style={{ color: activePalette.text }}>{item.name}</h3>
                   </div>
                   <p className="text-[11px] font-bold leading-snug line-clamp-2 mb-3 opacity-90" style={{ color: activePalette.text }}>{item.desc}</p>
                   
                   <div className="mt-auto flex justify-between items-center pt-3 border-t-[4px]" style={{ borderColor: activePalette.border }}>
                     <div className="flex items-baseline gap-1.5">
                       <span className="font-display text-2xl" style={{ color: activePalette.text }}>₹{effectivePrice.toFixed(0)}</span>
                       {isItemHappyHour && (
                         <span className="text-xs text-stone-400 line-through">₹{item.basePrice.toFixed(0)}</span>
                       )}
                     </div>
                     {qty === 0 ? (
                       <button 
                         onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); else onSelectItem(itemWithPromo); }} 
                         className="px-4 py-1.5 border-[3px] font-display text-xl uppercase tracking-wider hover:-translate-y-[2px] active:translate-y-0 transition-transform shadow-[3px_3px_0_0_#000]"
                         style={{ 
                           backgroundColor: activePalette.accent, 
                           color: activePalette.text, 
                           borderColor: activePalette.border,
                         }}
                       >
                         Add
                       </button>
                     ) : (
                       <div className="flex items-center border-[3px] border-black bg-white shadow-[3px_3px_0_0_#000] overflow-hidden shrink-0">
                         <button 
                           onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, -1); }} 
                           className="px-3 py-1 font-display text-xl font-black bg-yellow-400 hover:bg-yellow-300 border-r-[3px] border-black text-black active:scale-95 transition-transform flex items-center justify-center min-w-[36px] min-h-[36px]"
                         >
                           -
                         </button>
                         <span className="px-3 text-sm font-black font-display text-black select-none">{qty}</span>
                         <button 
                           onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); }} 
                           className="px-3 py-1 font-display text-xl font-black bg-yellow-400 hover:bg-yellow-300 border-l-[3px] border-black text-black active:scale-95 transition-transform flex items-center justify-center min-w-[36px] min-h-[36px]"
                         >
                           +
                         </button>
                       </div>
                     )}
                   </div>
                </div>
              </div>
            );
          }
          
          if (cardStyle === 'cafe') {
            return (
              <div 
                key={item.id} 
                onClick={() => { triggerHaptic(); onSelectItem(itemWithPromo); }} 
                className={`flex gap-4 py-4 border-b last:border-0 transition-colors cursor-pointer group animate-fade-up w-full ${isGrid ? '' : 'h-full'}`}
                style={{ borderColor: activePalette.line, backgroundColor: activePalette.card, padding: '16px', borderRadius: '16px', marginBottom: '12px', animationDelay: `${i * 80}ms` }}
              >
                <div className="w-20 h-24 shrink-0 rounded-t-full rounded-b-xl overflow-hidden shadow-sm border relative bg-zinc-100/50 flex items-center justify-center" style={{ borderColor: activePalette.border }}>
                  <div className="absolute inset-0 group-hover:bg-transparent transition-colors z-10 opacity-[0.08]" style={{ backgroundColor: activePalette.accent }} />
                  {item.img ? (
                    <img src={item.img} className="w-full h-full object-cover sepia-[0.3] group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <Utensils size={28} className="text-stone-300 stroke-[1.5]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 py-1 flex flex-col justify-center">
                   {item.badge && (
                     <div className="flex items-center gap-1.5 mb-1">
                       <Sparkles size={10} style={{ color: activePalette.accent }} />
                       <span className="text-[9.5px] font-cafe-sans tracking-[0.2em] uppercase font-bold opacity-80" style={{ color: activePalette.accent }}>
                         {item.badge}
                       </span>
                     </div>
                   )}
                   <div className="flex justify-between items-baseline gap-2 mb-1">
                       <div className="flex items-center gap-1.5">
                         <div className="translate-y-0.5"><VegSymbol isVeg={item.isVeg ?? (item.category === 'BURGERS' || item.category === 'SNACKS')} /></div>
                         <h3 className="font-cafe-serif text-lg font-bold" style={{ color: activePalette.text }}>
                           {item.name}
                         {item.dietary?.map(d => (                            <span key={d} className="ml-1 text-[8px] font-cafe-serif border px-1 rounded-sm opacity-60 align-middle" style={{ color: activePalette.text, borderColor: activePalette.text }}>{d}</span>
                         ))}
                       </h3>
                       </div>
                       <div className="flex-1 border-b-[2px] border-dotted mx-2 relative top-[-4px] opacity-40" style={{ borderColor: activePalette.text }}></div>
                       <div className="flex items-baseline gap-1.5">
                         <span className="font-cafe-sans font-bold text-base tracking-wider" style={{ color: activePalette.accent }}>₹{effectivePrice.toFixed(0)}</span>
                         {isItemHappyHour && (
                           <span className="text-[11px] text-stone-400 line-through">₹{item.basePrice.toFixed(0)}</span>
                         )}
                       </div>
                   </div>
                   <p className="text-xs font-cafe-sans line-clamp-2 leading-relaxed tracking-wide mb-3 opacity-70" style={{ color: activePalette.text }}>{item.desc}</p>
                   {qty === 0 ? (
                     <button 
                       onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); else onSelectItem(itemWithPromo); }}
                       className="mt-auto self-start text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1" 
                       style={{ color: activePalette.accent }}
                     >
                        <span>Add to Order</span>
                        <span className="text-lg leading-none mb-0.5">+</span>
                     </button>
                   ) : (
                     <div className="mt-auto self-start flex items-center gap-1 rounded-full p-0.5 border bg-white/90 shadow-sm" style={{ borderColor: activePalette.border }}>
                       <button 
                         onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, -1); }} 
                         className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-transform active:scale-90"
                         style={{ backgroundColor: activePalette.card, color: activePalette.text }}
                       >
                         -
                       </button>
                       <span className="w-5 text-center font-cafe-serif text-xs font-bold select-none" style={{ color: activePalette.text }}>{qty}</span>
                       <button 
                         onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); }} 
                         className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white transition-transform active:scale-90"
                         style={{ backgroundColor: activePalette.accent }}
                       >
                         +
                       </button>
                     </div>
                   )}
                </div>
              </div>
            );
          }

          if (cardStyle === 'qsr') {
            return (
              <div 
                key={item.id} 
                onClick={() => { triggerHaptic(); onSelectItem(itemWithPromo); }} 
                className="relative cursor-pointer rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col group border bg-white animate-fade-up w-full h-full"
                style={{ 
                  backgroundColor: activePalette.card,
                  borderColor: activePalette.border,
                  animationDelay: `${i * 80}ms`
                }}
              >
                {/* Deal / Badge Pill */}
                {item.badge && (
                  <div className="absolute top-2 left-2 z-20">
                    <DishBadgePill badge={item.badge} />
                  </div>
                )}

                {/* Big Food Image */}
                <div className="w-full h-36 relative overflow-hidden bg-black/5 flex items-center justify-center">
                  {item.img ? (
                    <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <Utensils size={36} className="text-zinc-300 stroke-[1.5]" />
                    </div>
                  )}
                </div>

                {/* Content & Ordering Section */}
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <VegSymbol isVeg={item.isVeg ?? (item.category === 'BURGERS' || item.category === 'SNACKS')} />
                    <h3 className="font-extrabold text-sm line-clamp-1 leading-snug" style={{ color: activePalette.text }}>
                      {item.name}
                    </h3>
                  </div>

                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-tight mb-3 flex-1 font-medium">
                    {item.desc}
                  </p>

                  <div className="mt-auto pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: activePalette.border }}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-black text-base tracking-tight" style={{ color: activePalette.accent }}>
                        ₹{effectivePrice.toFixed(0)}
                      </span>
                      {isItemHappyHour && (
                        <span className="text-[11px] text-zinc-400 line-through">₹{item.basePrice.toFixed(0)}</span>
                      )}
                    </div>
                    {qty === 0 ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); else onSelectItem(itemWithPromo); }}
                        className="px-4 py-1.5 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-all shadow-sm active:scale-95 text-white flex items-center gap-1"
                        style={{ backgroundColor: activePalette.accent }}
                      >
                        ADD <span className="text-sm leading-none">+</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 p-0.5 rounded-xl shadow-sm border bg-white" style={{ borderColor: activePalette.border }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, -1); }} 
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black transition-all active:scale-90 bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-black text-xs select-none" style={{ color: activePalette.accent }}>{qty}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); }} 
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black transition-all active:scale-90 text-white"
                          style={{ backgroundColor: activePalette.accent }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          const innerLayout = isGrid ? 'flex-col' : 'flex-row';
          const genericSpanClass = 'col-span-1';

          return (
            <div 
              key={item.id} 
              onClick={() => { triggerHaptic(); onSelectItem(itemWithPromo); }} 
              className={`cursor-pointer w-full flex h-full ${innerLayout} ${genericSpanClass} ${cardStyle !== 'minimal' ? 'rounded-2xl overflow-hidden' : ''} transition-transform active:scale-[0.98] hover:shadow-md ${getCardClasses()}`}
            >
              {/* Simple Image */}
              <div className={`relative ${isGrid ? 'w-full h-28 border-b border-zinc-100' : 'w-[110px] shrink-0'} bg-black/5 flex items-center justify-center overflow-hidden ${getImgClasses()}`}>
                {item.badge && (
                  <div className="absolute top-2 left-2 z-10">
                    <DishBadgePill badge={item.badge} mode="glass" />
                  </div>
                )}
                {item.img ? (
                  <img src={item.img} className="w-full h-full object-cover pointer-events-none" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <Utensils size={32} className="text-zinc-300 stroke-[1.5]" />
                  </div>
                )}
              </div>
              
              {/* Content Area */}
              <div className="flex-1 p-3.5 flex flex-col justify-between">
                <div>
                  <div className={`flex justify-between items-start mb-1 ${isGrid ? 'flex-col gap-1' : ''}`}>
                    <div className="flex items-start gap-1.5 pr-2">
                      <div className="mt-1"><VegSymbol isVeg={item.isVeg ?? (item.category === 'BURGERS' || item.category === 'SNACKS')} /></div>
                      <div>
                        {item.badge && !item.img && (
                          <div className="mb-0.5">
                            <DishBadgePill badge={item.badge} mode="inline" />
                          </div>
                        )}
                        <h3 className={`font-bold leading-tight ${isGrid ? 'text-[15px]' : 'text-base'}`}>{item.name}</h3>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-bold ${isGrid ? 'text-[15px]' : 'text-base'}`}>₹{effectivePrice.toFixed(0)}</span>
                        {isItemHappyHour && (
                          <span className="text-[11.5px] text-zinc-400 line-through">₹{item.basePrice.toFixed(0)}</span>
                        )}
                      </div>
                      {isItemHappyHour && (
                        <span className="text-[9.5px] font-semibold text-rose-600 dark:text-rose-400 tracking-wider uppercase mt-0.5">
                          Happy Hour
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-[13px] leading-snug mb-3 pr-2 line-clamp-2 ${subTextColor}`}>
                    {item.desc}
                  </p>
                </div>
                
                {qty === 0 ? (
                  <button 
                    onClick={(e) => { e.stopPropagation(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); else onSelectItem(itemWithPromo); }} 
                    className={`self-end px-4 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm ${radBtnClass}`}
                    style={{ backgroundColor: primaryColor }}
                  >
                    Add
                  </button>
                ) : (
                  <div className={`self-end flex items-center gap-1 p-0.5 border shadow-sm ${radBtnClass} ${cardStyle === 'glass' ? 'bg-white/70 backdrop-blur-md' : 'bg-white'}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, -1); }} 
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 active:scale-90 transition-all"
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-bold text-xs text-gray-900 select-none">{qty}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); }} 
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold text-white active:scale-90 transition-all"
                      style={{ backgroundColor: primaryColor }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {filteredItems.length === 0 && (
        <div className={`text-center py-12 px-6 bg-white flex flex-col items-center gap-3 ${radClass} ${cardStyle === 'brutalist' ? 'border-4 border-black' : 'border border-gray-100'}`}>
          <span className="text-gray-400 font-medium text-sm">No items in {activeCategory}</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SHARED MODALS (Cart & Modifiers)
// ==========================================
export function ModifiersSheet({ item, primaryColor, radius = 'rounded', cardStyle = 'solid', onClose, onAddToCart }: any) {
  if (!item) return null;

  // Resolve variants configuration safely
  const variantsConfig: ItemVariantsConfig = useMemo(() => {
    if (item.variantsConfig) return item.variantsConfig;
    const { config } = extractVariantsFromDescription(item.desc || item.description || '', item.basePrice || 0);
    return config;
  }, [item]);

  // Portions State: default to 'Full' or marked isDefault
  const defaultPortion = useMemo(() => {
    if (!variantsConfig.hasPortions || !variantsConfig.portions || variantsConfig.portions.length === 0) {
      return { name: 'Full', price: item.basePrice || 0, isDefault: true };
    }
    return (
      variantsConfig.portions.find(p => p.isDefault || p.name.toLowerCase() === 'full') ||
      variantsConfig.portions[0]
    );
  }, [variantsConfig, item.basePrice]);

  const [selectedPortion, setSelectedPortion] = useState<PortionOption>(defaultPortion);
  const [selectedAddons, setSelectedAddons] = useState<AddonOption[]>([]);
  const [selectedPrepTags, setSelectedPrepTags] = useState<string[]>([]);
  const [customDishNote, setCustomDishNote] = useState<string>('');

  useEffect(() => {
    setSelectedPortion(defaultPortion);
    setSelectedAddons([]);
    setSelectedPrepTags([]);
    setCustomDishNote('');
  }, [item.id, defaultPortion]);

  const portionPrice = variantsConfig.hasPortions && selectedPortion ? selectedPortion.price : item.basePrice;
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const finalPrice = portionPrice + addonsTotal;

  const radSheetClass = cardStyle === 'brutalist' ? 'rounded-none' : radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-t-[3rem]' : 'rounded-t-3xl';
  const radBtnClass = cardStyle === 'brutalist' ? 'rounded-none' : radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-full' : 'rounded-2xl';

  const activePalette = cardStyle === 'brutalist' 
    ? findPalette(NEO_PALETTES, primaryColor, '#CC3333')
    : cardStyle === 'cafe'
    ? findPalette(CAFE_PALETTES, primaryColor, '#4A3B32')
    : cardStyle === 'qsr'
    ? findPalette(QSR_PALETTES, primaryColor, '#E53935')
    : { bg: '#fff', card: '#fff', accent: primaryColor, text: '#000', border: '#ddd', line: '#ddd' };

  const handleAddCustomizedItem = () => {
    triggerHaptic();
    const isCustomPortion = variantsConfig.hasPortions && selectedPortion && selectedPortion.name.toLowerCase() !== 'full';
    const formattedName = isCustomPortion ? `${item.name} (${selectedPortion.name})` : item.name;

    const noteParts: string[] = [];
    if (selectedPrepTags.length > 0) noteParts.push(selectedPrepTags.join(', '));
    if (selectedAddons.length > 0) noteParts.push(`Add-ons: ${selectedAddons.map(a => a.name).join(', ')}`);
    if (customDishNote.trim()) noteParts.push(customDishNote.trim());
    const finalNotes = noteParts.join(' • ');

    const customizedItem = {
      ...item,
      name: formattedName,
      portionName: selectedPortion?.name,
      notes: finalNotes,
      basePrice: portionPrice,
    };

    onAddToCart(customizedItem, finalPrice, finalNotes);
  };

  const availableTags = variantsConfig.prepTags && variantsConfig.prepTags.length > 0
    ? variantsConfig.prepTags
    : COMMON_PREP_TAGS;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200 pointer-events-auto">
      {/* Soft Background Blur */}
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-xs" onClick={onClose} />
      
      <div className={`relative w-full flex flex-col max-h-[88%] overflow-hidden animate-in slide-in-from-bottom-full duration-300 text-gray-900 shadow-2xl ${cardStyle === 'brutalist' ? 'bg-white border-t-4 border-l-4 border-r-4 border-black' : 'bg-white'} ${radSheetClass}`}>
        
        {item.img && (
          <div className="relative h-44 shrink-0">
            <img src={item.img} alt={item.name} className={`w-full h-full object-cover ${cardStyle === 'brutalist' ? 'border-b-4 border-black' : ''}`} />
            <button onClick={onClose} className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-colors cursor-pointer ${cardStyle === 'brutalist' ? 'bg-white border-2 border-black text-black shadow-[2px_2px_0_0_#000]' : 'bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-black/70'}`}>
              <X size={16} strokeWidth={cardStyle === 'brutalist' ? 3 : 2} />
            </button>
          </div>
        )}

        {/* Modal Header if no image */}
        {!item.img && (
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-base text-gray-900">{item.name}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center cursor-pointer">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {item.img && (
            <div>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold text-gray-900 ${cardStyle === 'brutalist' ? 'tracking-tight uppercase' : ''}`}>{item.name}</h2>
                <span className="font-mono font-bold text-base text-gray-900">₹{item.basePrice}</span>
              </div>
              {item.desc && (
                <p className={`text-xs mt-1.5 leading-relaxed ${cardStyle === 'brutalist' ? 'text-black font-medium' : 'text-gray-500'}`}>{item.desc}</p>
              )}
            </div>
          )}

          {/* Portion Size Selection */}
          {variantsConfig.hasPortions && variantsConfig.portions && variantsConfig.portions.length > 0 && (
            <div className="space-y-2.5">
              <h3 className={`text-[11px] font-bold uppercase tracking-wider flex items-center justify-between ${cardStyle === 'brutalist' ? 'text-black' : 'text-gray-500'}`}>
                <span>Choose Portion Size</span>
                <span className="text-[10px] text-[#E46254] font-semibold">Required</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {variantsConfig.portions.map(p => {
                  const isSel = selectedPortion?.name === p.name;
                  const isFull = p.name.toLowerCase() === 'full';
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => { triggerHaptic([40]); setSelectedPortion(p); }}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSel
                          ? cardStyle === 'brutalist'
                            ? 'border-4 border-black bg-yellow-300 text-black shadow-[3px_3px_0_0_#000]'
                            : 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                          : cardStyle === 'brutalist'
                          ? 'border-2 border-black bg-white hover:bg-gray-50'
                          : 'border-gray-200 bg-gray-50/70 hover:bg-gray-100/70 text-gray-800'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs">{p.name}</p>
                        {isFull && (
                          <p className={`text-[9.5px] ${isSel ? 'text-zinc-300' : 'text-gray-400'}`}>Base Price</p>
                        )}
                      </div>
                      <span className={`font-mono font-bold text-xs ${isSel ? 'text-amber-300' : 'text-gray-900'}`}>
                        ₹{p.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons & Extras Selection */}
          {variantsConfig.hasAddons && variantsConfig.addons && variantsConfig.addons.length > 0 && (
            <div className="space-y-2">
              <h3 className={`text-[11px] font-bold uppercase tracking-wider ${cardStyle === 'brutalist' ? 'text-black' : 'text-gray-500'}`}>
                Add-ons & Extras
              </h3>
              <div className="space-y-1.5">
                {variantsConfig.addons.map(addon => {
                  const isSel = selectedAddons.some(a => a.name === addon.name || a.id === addon.id);
                  return (
                    <button
                      key={addon.id || addon.name}
                      type="button"
                      onClick={() => {
                        triggerHaptic([40]);
                        if (isSel) {
                          setSelectedAddons(prev => prev.filter(a => a.name !== addon.name));
                        } else {
                          setSelectedAddons(prev => [...prev, addon]);
                        }
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSel
                          ? cardStyle === 'brutalist'
                            ? 'border-3 border-black bg-amber-100 font-bold shadow-[2px_2px_0_0_#000]'
                            : 'border-amber-300 bg-amber-50/80 text-amber-950 font-medium'
                          : cardStyle === 'brutalist'
                          ? 'border-2 border-black bg-white hover:bg-gray-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                          isSel ? 'bg-amber-600 text-white' : 'border border-gray-300'
                        }`}>
                          {isSel && <Check size={10} strokeWidth={3} />}
                        </div>
                        <span className="text-xs">{addon.name}</span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-gray-600">
                        +₹{addon.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1-Tap Kitchen Prep Instructions */}
          <div className="space-y-2">
            <h3 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${cardStyle === 'brutalist' ? 'text-black' : 'text-gray-500'}`}>
              <ChefHat size={12} className="text-[#E46254]" />
              <span>Cooking Preferences (1-Tap)</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map(tag => {
                const isSel = selectedPrepTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      triggerHaptic([30]);
                      if (isSel) {
                        setSelectedPrepTags(prev => prev.filter(t => t !== tag));
                      } else {
                        setSelectedPrepTags(prev => [...prev, tag]);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      isSel
                        ? 'bg-[#E46254] text-white border-[#E46254] shadow-2xs font-semibold'
                        : cardStyle === 'brutalist'
                        ? 'border border-black bg-white hover:bg-gray-100 text-black'
                        : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Instructions Note Input */}
          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${cardStyle === 'brutalist' ? 'text-black' : 'text-gray-500'}`}>
              Special Note
            </label>
            <input
              type="text"
              placeholder="e.g., Extra hot, less salt, sauce on the side..."
              value={customDishNote}
              onChange={e => setCustomDishNote(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-gray-50 font-medium"
            />
          </div>
        </div>

        {/* Modal Bottom CTA */}
        <div className={`p-4 shrink-0 border-t ${cardStyle === 'brutalist' ? 'bg-white border-black border-t-4' : 'bg-gray-50 border-gray-100'}`}>
          <button 
            onClick={handleAddCustomizedItem}
            className={`w-full py-3.5 px-5 font-bold flex items-center justify-between transition-transform active:translate-y-0 cursor-pointer ${cardStyle === 'brutalist' ? 'rounded-full border-[3px] hover:-translate-y-[2px] font-stencil text-2xl tracking-widest' : `shadow-md text-base hover:opacity-90 active:scale-[0.98] ${radBtnClass}`}`}
            style={cardStyle === 'brutalist' ? { 
              backgroundColor: activePalette.accent, 
              color: activePalette.text, 
              borderColor: activePalette.border,
              boxShadow: `4px 4px 0 0 ${activePalette.border}` 
            } : { backgroundColor: primaryColor, color: '#fff' }}
          >
            <span>Add to Order</span>
            <span className="font-mono">₹{finalPrice.toFixed(0)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function CartSheet({ 
  businessType, 
  isOpen, 
  cart, 
  primaryColor, 
  radius = 'rounded', 
  cardStyle = 'solid', 
  onClose, 
  onClearCart, 
  onPlaceOrder, 
  orderStatus = 'NEW',
  hasActiveSession = false,
  roundNumber = 1,
  savedCustomerName = '',
  savedCustomerPhone = '',
  promotionsConfig,
  restaurantId,
  restaurantName,
  tableNo,
  onOpenBill,
  onUpdateQuantity,
  runningGrandTotal = 0,
  activeRoundsCount = 0
}: any) {
  const [name, setName] = useState(savedCustomerName || '');
  const [phone, setPhone] = useState(savedCustomerPhone || '');
  const [note, setNote] = useState('');
  const [payMethod, setPayMethod] = useState<'ROOM_CHARGE' | 'UPI' | 'CASH'>('UPI');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (savedCustomerName) setName(savedCustomerName);
    if (savedCustomerPhone) setPhone(savedCustomerPhone);
  }, [savedCustomerName, savedCustomerPhone]);

  const subtotal = (cart || []).reduce((acc: number, curr: any) => acc + curr.price, 0);

  const groupedCart = useMemo(() => {
    const map = new Map<string, { item: any; count: number; unitPrice: number; totalPrice: number; notes?: string }>();
    for (const c of (cart || [])) {
      const key = `${c.item?.id || c.item?.name || 'unknown'}_${c.item?.portionName || ''}_${c.item?.notes || c.notes || ''}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalPrice += c.price;
      } else {
        map.set(key, { 
          item: c.item, 
          count: 1, 
          unitPrice: c.price, 
          totalPrice: c.price,
          notes: c.item?.notes || c.notes 
        });
      }
    }
    return Array.from(map.values());
  }, [cart]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      if (!savedCustomerName) setName('');
      if (!savedCustomerPhone) setPhone('');
      setNote('');
      setInputError(null);
    }, 300);
  };

  // Cart Value Booster
  const boosterEligible = promotionsConfig?.cartBoosterEnabled && subtotal >= (promotionsConfig?.cartBoosterMinSpend || 1000);
  const boosterDiscount = boosterEligible ? (promotionsConfig?.cartBoosterDiscount || 100) : 0;

  const discountedSubtotal = Math.max(0, subtotal - boosterDiscount);
  const gstAmount = Number((discountedSubtotal * 0.05).toFixed(2));
  const total = Number((discountedSubtotal + gstAmount).toFixed(2)); // 5% GST

  const radSheetClass = cardStyle === 'brutalist' ? 'rounded-none' : radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-t-[3rem]' : 'rounded-t-3xl';
  const radBtnClass = cardStyle === 'brutalist' ? 'rounded-none' : radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-full' : 'rounded-2xl';

  const activePalette = cardStyle === 'brutalist' 
    ? { bg: '#fff', card: '#fff', accent: '#000', text: '#000', border: '#000', line: '#000' }
    : { bg: '#fff', card: '#fff', accent: primaryColor, text: '#000', border: '#ddd', line: '#ddd' };

  const handleDirectFireToKitchen = async () => {
    const finalCustomerPhone = (phone || savedCustomerPhone || '').trim();
    const finalCustomerName = (name || savedCustomerName || '').trim();

    if (!hasActiveSession && (!savedCustomerName || !savedCustomerPhone)) {
      if (!finalCustomerName) {
        setInputError('Please enter your name to fire the order.');
        return;
      }
      const digits = finalCustomerPhone.replace(/\D/g, '');
      if (digits.length !== 10) {
        setInputError('Please enter a valid 10-digit mobile number.');
        return;
      }
    }

    setInputError(null);
    triggerHaptic();
    setIsSubmitting(true);

    try {
      if (onPlaceOrder) {
        const orderSuccess = await onPlaceOrder({ 
          name: finalCustomerName, 
          phone: finalCustomerPhone, 
          note, 
          payMethod: businessType === 'HOTEL' ? payMethod : 'PAY_AT_END',
          coinsRedeemed: 0,
          coinsEarned: 0,
          boosterDiscount
        });

        if (orderSuccess) {
          onClearCart();
          handleClose();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end animate-in fade-in duration-200 pointer-events-auto">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={handleClose} />
      <div className={`relative w-full flex flex-col max-h-[92%] overflow-hidden animate-in slide-in-from-bottom-full duration-300 text-gray-900 shadow-2xl ${cardStyle === 'brutalist' ? 'bg-white border-t-4 border-l-4 border-r-4 border-black' : 'bg-white'} ${radSheetClass}`}>
        
        {/* HEADER */}
        <div className={`p-4 px-5 flex justify-between items-center ${cardStyle === 'brutalist' ? 'border-b-4 border-black' : 'border-b border-gray-100'}`}>
          <div>
            <h2 className={`font-extrabold text-lg ${cardStyle === 'brutalist' ? 'uppercase tracking-tighter' : 'tracking-tight'}`}>
              {hasActiveSession ? `Round #${roundNumber} Cart (${cart.length})` : `Your Cart (${cart.length})`}
            </h2>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {hasActiveSession ? 'Fires directly to kitchen · Added to live tab' : 'Dine First • Pay at the End'}
            </p>
          </div>
          <button 
            onClick={handleClose} 
            className={`w-8 h-8 flex items-center justify-center transition-colors cursor-pointer ${cardStyle === 'brutalist' ? 'bg-white border-2 border-black text-black' : 'rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className={`p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4 ${cardStyle === 'brutalist' ? 'font-mono' : ''}`}>
          
          {hasActiveSession && activeRoundsCount > 0 && (
            <div className="p-3.5 bg-zinc-900 text-white rounded-2xl flex items-center justify-between shadow-xs border border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                    Running Table Tab
                  </p>
                  <p className="text-[12px] font-extrabold text-white">
                    {activeRoundsCount} Round{activeRoundsCount > 1 ? 's' : ''} Already Placed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-black tabular-nums text-emerald-400">
                  ₹{runningGrandTotal.toFixed(0)}
                </span>
                {onOpenBill && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBill();
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold bg-white/15 hover:bg-white/25 text-white rounded-xl transition-all cursor-pointer border border-white/15"
                  >
                    View Bill
                  </button>
                )}
              </div>
            </div>
          )}

          {cart.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
                <Utensils size={20} />
              </div>
              <p className="text-sm font-bold text-gray-800">Your cart is empty</p>
              <p className="text-xs text-gray-400 mt-1">Tap dishes on the menu to add items</p>
            </div>
          ) : (
            <>
              {/* DISHES LIST */}
              <div className="space-y-2">
                {groupedCart.map((g, idx) => (
                  <div 
                    key={g.item?.id ? `${g.item.id}_${idx}` : idx} 
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      cardStyle === 'brutalist' 
                        ? 'bg-white border-2 border-black rounded-none shadow-[2px_2px_0_0_#000]' 
                        : 'bg-zinc-50/80 border-zinc-200/70 shadow-xs'
                    }`}
                  >
                    <div className="flex-1 pr-3 min-w-0">
                      <h4 className={`text-[13.5px] truncate leading-tight ${cardStyle === 'brutalist' ? 'font-black uppercase' : 'font-bold text-zinc-900'}`}>
                        {g.item?.name}
                      </h4>
                      {g.notes && (
                        <p className="text-[11px] text-amber-800 font-medium leading-snug mt-0.5 truncate">
                          {g.notes}
                        </p>
                      )}
                      <span className="text-[11px] font-semibold text-zinc-400 tabular-nums">
                        ₹{g.unitPrice.toFixed(0)} each
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2.5 shrink-0">
                      {onUpdateQuantity && (
                        <div className={`flex items-center gap-1 p-0.5 border ${
                          cardStyle === 'brutalist' 
                            ? 'border-black bg-white rounded-none' 
                            : 'rounded-xl border-zinc-200 bg-white shadow-xs'
                        }`}>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic();
                              onUpdateQuantity(g.item, -1);
                            }}
                            className={`w-6 h-6 flex items-center justify-center text-xs font-black transition-all cursor-pointer active:scale-90 ${
                              cardStyle === 'brutalist'
                                ? 'bg-yellow-400 text-black border border-black'
                                : 'rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                            }`}
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-black text-xs text-zinc-900 tabular-nums select-none">
                            {g.count}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic();
                              onUpdateQuantity(g.item, 1);
                            }}
                            className={`w-6 h-6 flex items-center justify-center text-xs font-black transition-all cursor-pointer active:scale-90 ${
                              cardStyle === 'brutalist'
                                ? 'bg-yellow-400 text-black border border-black'
                                : 'rounded-lg text-white shadow-xs'
                            }`}
                            style={cardStyle !== 'brutalist' ? { backgroundColor: primaryColor } : {}}
                          >
                            +
                          </button>
                        </div>
                      )}
                      <span className={`text-[13.5px] tabular-nums min-w-[50px] text-right ${cardStyle === 'brutalist' ? 'font-black text-black' : 'font-black text-zinc-900'}`}>
                        ₹{g.totalPrice.toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* DINE FIRST, PAY AT THE END ASSURANCE BADGE */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-3 text-emerald-950 text-xs">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[12px] text-emerald-900">Dine First • Pay at the End</p>
                  <p className="text-[11px] text-emerald-700 font-medium leading-snug">
                    {hasActiveSession 
                      ? `Round #${roundNumber} is fired straight to the chef. All rounds combine into your final table bill.` 
                      : 'Your dishes fire directly to the kitchen. Settle your final table bill whenever you finish dining.'}
                  </p>
                </div>
              </div>

              {/* GUEST INFO (ROUND 1 IF NOT ALREADY SAVED) */}
              {!hasActiveSession && (!savedCustomerName || !savedCustomerPhone) && (
                <div className="space-y-3 p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl">
                  {inputError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl animate-in fade-in">
                      {inputError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-1">Your Name</label>
                      <input 
                        type="text" 
                        value={name} 
                        onChange={e => { setName(e.target.value); setInputError(null); }} 
                        placeholder="Enter name" 
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 text-gray-900 font-semibold text-xs" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-1">Mobile Number</label>
                      <input 
                        type="tel" 
                        maxLength={10}
                        value={phone} 
                        onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setInputError(null); }} 
                        placeholder="10-digit number" 
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 text-gray-900 font-semibold text-xs font-mono" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIAL COOKING INSTRUCTIONS */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ChefHat size={13} className="text-zinc-600" />
                  <span>Cooking Instructions for Chef (Optional)</span>
                </label>
                <textarea 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  placeholder="e.g. Serve hot, extra spicy, less salt, less ice in drinks..." 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-gray-400 text-gray-900 font-medium resize-none h-16 text-xs" 
                />
              </div>

              {/* CART BOOSTER PRIVILEGE */}
              {promotionsConfig?.cartBoosterEnabled && (
                <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-2xl">
                  {boosterEligible ? (
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <Check size={14} className="text-emerald-600 shrink-0" />
                        <span>Flat ₹{promotionsConfig.cartBoosterDiscount || 100} Privilege Applied</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        -₹{promotionsConfig.cartBoosterDiscount || 100}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center text-xs font-medium text-zinc-600 mb-1.5">
                        <span>Cart Privilege</span>
                        <span className="font-semibold text-zinc-900">
                          Add ₹{((promotionsConfig.cartBoosterMinSpend || 1000) - subtotal).toFixed(0)} more for Flat ₹{promotionsConfig.cartBoosterDiscount || 100} OFF
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-zinc-900 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (subtotal / (promotionsConfig.cartBoosterMinSpend || 1000)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* BILL SUMMARY */}
              <div className="pt-2 space-y-1.5 text-xs font-medium">
                <div className="flex justify-between text-gray-500">
                  <span>Round Subtotal</span>
                  <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                </div>

                {boosterDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Cart Value Booster</span>
                    <span className="font-mono">-₹{boosterDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-gray-500">
                  <span>GST (5%)</span>
                  <span className="font-mono">₹{gstAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-gray-100 text-gray-900">
                  <span>Round Total</span>
                  <span className="font-mono">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}

        </div>

        {/* BOTTOM ACTION BAR - DIRECT FIRE TO KITCHEN */}
        {cart.length > 0 && (
          <div className={`p-4 shrink-0 ${cardStyle === 'brutalist' ? 'bg-white border-t-[3px] border-black' : 'bg-gray-50 border-t border-gray-100'}`} style={cardStyle === 'brutalist' ? { backgroundColor: activePalette.bg, borderColor: activePalette.border } : {}}>
            <button 
              disabled={isSubmitting}
              onClick={handleDirectFireToKitchen}
              className={`w-full py-4 px-5 font-bold flex items-center justify-between transition-transform active:translate-y-0 cursor-pointer ${cardStyle === 'brutalist' ? 'rounded-full border-[3px] hover:-translate-y-[2px] font-stencil text-2xl tracking-widest' : `shadow-md text-base hover:opacity-90 active:scale-[0.98] ${radBtnClass}`}`}
              style={cardStyle === 'brutalist' ? { backgroundColor: activePalette.accent, color: activePalette.text, borderColor: activePalette.border, boxShadow: `4px 4px 0 0 ${activePalette.border}` } : { backgroundColor: primaryColor, color: '#fff' }}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2 w-full">
                  <Loader2 size={18} className="animate-spin" />
                  <span>Firing to Kitchen...</span>
                </div>
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    <Flame size={18} className="text-amber-300" />
                    <span>{hasActiveSession ? `Fire Round #${roundNumber} to Kitchen` : 'Fire to Kitchen'}</span>
                  </span>
                  <span className="font-mono text-base font-extrabold">₹{total.toFixed(2)}</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
