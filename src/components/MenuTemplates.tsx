"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  ShoppingBag,
  MessageSquarePlus,
  SlidersHorizontal,
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
  Loader2,
  Users
} from "lucide-react";

import { 
  ItemVariantsConfig, 
  extractVariantsFromDescription, 
  COMMON_PREP_TAGS, 
  PortionOption, 
  AddonOption 
} from "@/utils/menuItemVariants";
import { TaxSettings, DEFAULT_TAX_SETTINGS, calculateBillTaxes } from "@/utils/tax";
import { isDarkColor, getAdaptiveThemeTokens } from "@/utils/colorExtractor";

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

export function VegSymbol({ isVeg, className = "" }: { isVeg?: boolean; className?: string }) {
  if (isVeg === undefined) return null;
  return isVeg ? (
    <span 
      title="Vegetarian" 
      aria-label="Vegetarian"
      className={`inline-flex items-center justify-center w-[15px] h-[15px] border-[1.5px] border-emerald-600 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 p-[1.5px] shrink-0 rounded-[3.5px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shadow-2xs" />
    </span>
  ) : (
    <span 
      title="Non-Vegetarian" 
      aria-label="Non-Vegetarian"
      className={`inline-flex items-center justify-center w-[15px] h-[15px] border-[1.5px] border-rose-600 dark:border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 p-[1.5px] shrink-0 rounded-[3.5px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      <span className="w-0 h-0 border-x-[3px] border-x-transparent border-b-[5.5px] border-b-rose-600 dark:border-b-rose-400" />
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
  customerCoins,
  onCallWaiter,
  isWaiterCalled,
  activeGuestsCount,
  showDishImages = true,
  onOpenCart
}: any) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dietFilter, setDietFilter] = useState('ALL');
  const [showFilterModal, setShowFilterModal] = useState(false);

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

  const isDarkBg = isDarkColor(bgColor);
  const adaptiveTokens = getAdaptiveThemeTokens(bgColor);
  const textColor = isDarkBg ? 'text-zinc-50' : 'text-zinc-900';
  const subTextColor = isDarkBg ? 'text-zinc-400' : 'text-zinc-500';
  const cleanTableDisplay = (tableNo || '').toString().toLowerCase().startsWith('table')
    ? tableNo
    : `Table ${tableNo || '1'}`;

  // Normalized Card Style & Photo Display
  const rawCardStyle = cardStyle || 'solid';
  const effectiveCardStyle = rawCardStyle.split(':')[0];
  const shouldShowImages = showDishImages !== undefined 
    ? showDishImages 
    : !rawCardStyle.includes('no-image');

  // Card Theme Logic
  const getCardClasses = () => {
    let base = '';
    if (effectiveCardStyle === 'glass') {
      base = isDarkBg 
        ? 'bg-zinc-900/60 backdrop-blur-xl border border-white/10 shadow-xl text-zinc-100 '
        : 'bg-white/60 backdrop-blur-md border border-white/70 shadow-md text-zinc-900 ';
    } else if (effectiveCardStyle === 'minimal') {
      base = isDarkBg
        ? 'bg-transparent border-b border-zinc-800 shadow-none rounded-none pb-4 text-zinc-100 '
        : 'bg-transparent border-b border-zinc-200 shadow-none rounded-none pb-4 text-zinc-900 ';
    } else if (effectiveCardStyle === 'brutalist') {
      base = 'bg-white border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] text-black ';
    } else {
      // Solid / Default: 2026 Ambient Culinary Card (Soft glass glow, zero harsh flat white borders)
      base = isDarkBg 
        ? 'bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 backdrop-blur-md border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] text-zinc-100 ' 
        : 'bg-gradient-to-b from-white/95 via-white/90 to-white/80 backdrop-blur-md border border-black/[0.04] shadow-[0_8px_28px_-6px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.1)] text-zinc-900 ';
    }
    
    if (effectiveCardStyle !== 'minimal' && effectiveCardStyle !== 'brutalist') {
      base += (radius === 'sharp' ? 'rounded-none' : radius === 'pill' ? 'rounded-[2rem]' : 'rounded-2xl');
    }
    return base;
  };

  const getImgClasses = () => {
    if (effectiveCardStyle === 'minimal') return radClass;
    return 'rounded-none'; // takes parent's overflow-hidden
  };

  const activePalette = effectiveCardStyle === 'brutalist' 
    ? findPalette(NEO_PALETTES, primaryColor, '#CC3333')
    : effectiveCardStyle === 'cafe'
    ? findPalette(CAFE_PALETTES, primaryColor, '#4A3B32')
    : effectiveCardStyle === 'qsr'
    ? findPalette(QSR_PALETTES, primaryColor, '#E53935')
    : null;

  if (effectiveCardStyle === 'brutalist' && bgPattern !== 'brutalist-grid' && !bgImage) {
    rootStyle.backgroundColor = activePalette.bg;
  } else if (effectiveCardStyle === 'cafe' && !bgImage) {
    rootStyle.backgroundColor = activePalette.bg;
  } else if (effectiveCardStyle === 'qsr' && !bgImage) {
    rootStyle.backgroundColor = activePalette.bg;
  }

  return (
    <div className={`flex-1 w-full p-5 pb-36 transition-colors duration-300 relative ${textColor}`} style={rootStyle}>

      {/* Paper Texture Overlay */}
      {cardStyle === 'cafe' && !bgImage && (
        <div 
          className="absolute inset-0 pointer-events-none z-0 opacity-[0.4] mix-blend-multiply"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        ></div>
      )}

      {/* ── LEVEL 2: PROUD BRAND HERO HEADER ── */}
      <div className="pt-3 pb-3 mb-2 relative z-10 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left Section: Emblem Squircle + Cafe Name */}
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
          {logoUrl ? (
            <div className="relative shrink-0 flex items-center justify-center">
              {/* Subtle ambient luxury halo */}
              <div 
                className="absolute -inset-2.5 rounded-3xl opacity-20 blur-xl pointer-events-none transition-all"
                style={{ backgroundColor: primaryColor || '#E46254' }}
              />
              <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.08] dark:ring-white/10 flex items-center justify-center transition-transform duration-300 hover:scale-102 ${
                isDarkBg ? 'bg-zinc-900' : 'bg-white'
              }`}>
                <img 
                  src={logoUrl} 
                  alt={restaurantName || 'Logo'} 
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>
          ) : (
            <div className="relative shrink-0 flex items-center justify-center">
              <div 
                className="absolute -inset-2.5 rounded-3xl opacity-20 blur-xl pointer-events-none"
                style={{ backgroundColor: primaryColor || '#E46254' }}
              />
              <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)] ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center font-black text-2xl uppercase ${
                isDarkBg ? 'bg-zinc-900 text-white' : 'bg-zinc-950 text-white'
              }`}>
                {(restaurantName || 'M').charAt(0)}
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h1 className={`font-black text-xl sm:text-2xl md:text-[26px] tracking-[-0.03em] leading-tight truncate ${
              isDarkBg ? 'text-zinc-50' : 'text-zinc-950'
            }`}>
              {restaurantName || 'Menu'}
            </h1>
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-400 dark:text-zinc-500 mt-1">
              Dine-In
            </p>
          </div>
        </div>

        {/* Right Section: Sleek Luxury Glass Cart Bag Button */}
        {onOpenCart && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onOpenCart();
            }}
            className={`relative shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer shadow-sm ${
              cart && cart.length > 0
                ? isDarkBg
                  ? 'bg-zinc-900/90 text-white border border-white/15 shadow-md'
                  : 'bg-white text-zinc-900 border border-black/10 shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                : isDarkBg
                ? 'bg-zinc-900/60 text-zinc-400 border border-white/5 hover:text-white'
                : 'bg-white/70 text-zinc-500 border border-black/5 hover:text-zinc-900'
            }`}
            title="View Order"
          >
            <ShoppingBag size={20} strokeWidth={2.2} />
            
            {/* Active Cart Counter Badge */}
            {cart && cart.length > 0 && (
              <span 
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-white font-black text-[10.5px] flex items-center justify-center shadow-md animate-in zoom-in-75 duration-150 tabular-nums"
                style={{ 
                  backgroundColor: primaryColor || '#E46254',
                  boxShadow: `0 2px 8px ${primaryColor || '#E46254'}60`
                }}
              >
                {cart.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── LEVEL 3: UNIFIED LUXURY DISCOVERY & FILTER BAR ── */}
      <div className={`sticky top-0 z-30 -mx-5 px-5 py-2.5 backdrop-blur-xl border-b transition-all duration-300 ${
        isDarkBg 
          ? 'bg-zinc-950/85 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]' 
          : 'bg-white/85 border-black/5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]'
      }`}>
        {/* Row 1: Unified Sleek Search Capsule + Dedicated Glass Filter Button */}
        <div className="flex items-center gap-2 mb-2">
          {/* Frosted Glass Search Capsule */}
          <div className={`group relative flex-1 flex items-center h-10 rounded-full border transition-all duration-300 ${
            isDarkBg 
              ? 'bg-zinc-900/70 border-white/10 focus-within:border-white/30 focus-within:bg-zinc-900/95 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.08)] text-zinc-100' 
              : 'bg-zinc-100/80 border-black/5 focus-within:border-black/20 focus-within:bg-white focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.06)] text-zinc-900'
          }`}>
            <Search 
              size={15} 
              className={`absolute left-3.5 transition-colors duration-200 pointer-events-none ${
                isDarkBg ? 'text-zinc-500 group-focus-within:text-zinc-200' : 'text-zinc-400 group-focus-within:text-zinc-800'
              }`} 
            />
            <input 
              type="text" 
              placeholder="Search dishes, drinks, desserts..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-full pl-9 pr-8 bg-transparent outline-none text-xs sm:text-[13px] font-medium tracking-tight placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 w-5 h-5 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80 text-zinc-600 dark:text-zinc-200 hover:scale-105 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Clear search"
              >
                <X size={10} strokeWidth={3} />
              </button>
            )}
          </div>

          {/* Dedicated Glass Filter Trigger Button */}
          <button
            type="button"
            onClick={() => { triggerHaptic(); setShowFilterModal(true); }}
            aria-label="Open dietary and menu filters"
            className={`relative flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-200 active:scale-95 cursor-pointer shrink-0 ${
              dietFilter !== 'ALL'
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                : isDarkBg
                ? 'bg-zinc-900/70 border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                : 'bg-zinc-100/80 border-black/5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/80 shadow-xs'
            }`}
          >
            <SlidersHorizontal size={15} strokeWidth={2.2} />
            {dietFilter !== 'ALL' && (
              <span 
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-950 shadow-xs"
                style={{ backgroundColor: dietFilter === 'VEG' ? '#16A34A' : '#E11D48' }}
              />
            )}
          </button>
        </div>

        {/* Row 2: Clean, Minimalist Text Category Navigation Tabs (Zero Clutter, No Numbers) */}
        <div className="relative -mx-1 px-1">
          <div 
            className="flex items-center overflow-x-auto gap-2 py-1 no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{
              maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)'
            }}
          >
            {displayCategories.map((cat: string, i: number) => {
              const isActive = activeCategory === cat;
              const isHighlights = cat === 'HIGHLIGHTS';

              return (
                <button 
                  key={i} 
                  onClick={() => { triggerHaptic(); setActiveCategory(cat); }} 
                  className={`group relative px-3.5 py-1.5 rounded-full font-bold text-xs tracking-tight whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none ${
                    isActive 
                      ? 'text-white shadow-xs scale-[1.02]'
                      : isDarkBg 
                      ? 'bg-zinc-900/50 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 border border-white/5' 
                      : 'bg-zinc-100/70 hover:bg-zinc-200/70 text-zinc-600 hover:text-zinc-900 border border-black/5'
                  }`}
                  style={isActive ? { 
                    backgroundColor: primaryColor || '#E46254',
                    boxShadow: `0 3px 12px -2px ${primaryColor || '#E46254'}45`
                  } : {}}
                >
                  {isHighlights && (
                    <Sparkles size={12} className={isActive ? 'text-white' : 'text-amber-500'} />
                  )}
                  <span>{isHighlights ? "Chef's Picks" : cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── LUXURY FILTER BOTTOM SHEET / MODAL ── */}
      {showFilterModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowFilterModal(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl transition-all duration-300 border ${
              isDarkBg 
                ? 'bg-zinc-900 border-zinc-800 text-zinc-100' 
                : 'bg-white border-zinc-100 text-zinc-900'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                  <SlidersHorizontal size={15} />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Filter Menu</h3>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Refine by dietary preferences</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowFilterModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Dietary Preference Selector */}
            <div className="py-5 space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Dietary Preference
              </label>

              {/* ALL */}
              <button
                type="button"
                onClick={() => { triggerHaptic(); setDietFilter('ALL'); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  dietFilter === 'ALL'
                    ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-800/70 shadow-xs'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-400 dark:border-zinc-500 flex items-center justify-center">
                    {dietFilter === 'ALL' && <div className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-white" />}
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold block">All Dishes</span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Show complete dining menu</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-400 font-mono">
                  {items.length}
                </span>
              </button>

              {/* VEG */}
              <button
                type="button"
                onClick={() => { triggerHaptic(); setDietFilter('VEG'); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  dietFilter === 'VEG'
                    ? 'border-emerald-600 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-xs'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-4 h-4 border border-emerald-600 p-[1px] rounded-xs shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  </span>
                  <div className="text-left">
                    <span className="text-sm font-bold block text-emerald-700 dark:text-emerald-400">Pure Veg Only</span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Vegetarian culinary selections</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 font-mono">
                  {items.filter((i: any) => i.isVeg).length}
                </span>
              </button>

              {/* NON-VEG */}
              <button
                type="button"
                onClick={() => { triggerHaptic(); setDietFilter('NON-VEG'); }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  dietFilter === 'NON-VEG'
                    ? 'border-rose-600 bg-rose-500/5 dark:bg-rose-500/10 shadow-xs'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-4 h-4 border border-rose-600 p-[1px] rounded-xs shrink-0">
                    <span className="w-0 h-0 border-x-[3px] border-x-transparent border-b-[5px] border-b-rose-600" />
                  </span>
                  <div className="text-left">
                    <span className="text-sm font-bold block text-rose-700 dark:text-rose-400">Non-Veg Only</span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Meat, poultry & seafood dishes</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-rose-600 font-mono">
                  {items.filter((i: any) => !i.isVeg).length}
                </span>
              </button>
            </div>

            {/* Modal Action Buttons */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
              <button
                type="button"
                onClick={() => { triggerHaptic(); setDietFilter('ALL'); setShowFilterModal(false); }}
                className="flex-1 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic(); setShowFilterModal(false); }}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md hover:opacity-90 transition-opacity cursor-pointer text-center"
                style={{ backgroundColor: primaryColor || '#E46254' }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HOTEL AMENITIES & SERVICES DOCK (Optional) ── */}
      {serviceItems.length > 0 && (
        <div className="mt-3 mb-2">
          <h3 className={`text-xs font-bold mb-2 uppercase tracking-wider ${isDarkBg ? 'text-zinc-400' : 'text-gray-500'}`}>Guest Services</h3>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
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
                className={`shrink-0 flex flex-col items-center justify-center w-[74px] h-[74px] transition-transform active:scale-95 ${
                  isDarkBg ? 'bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200' : 'bg-white border border-gray-100 rounded-xl shadow-xs text-gray-700'
                }`}
              >
                <span className="text-xl mb-1">{getServiceIcon(item.name)}</span>
                <span className="text-[9.5px] font-bold text-center leading-tight px-1">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clean List/Grid Layout with Luxury Spacing */}
      <div className={layoutMode === 'grid' ? "grid grid-cols-2 gap-3.5 sm:gap-4 relative z-10 pt-4 pb-6" : "flex flex-col gap-3.5 sm:gap-4 relative z-10 pt-4 pb-6"}>
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

          // ══════════════════════════════════════════════════════════════════
          // MODE A: NO IMAGES / TEXT-ONLY (Clean Editorial Cards)
          // ══════════════════════════════════════════════════════════════════
          if (!shouldShowImages) {
            if (isGrid) {
              // 2x2 Grid Text Only: Well-proportioned tile
              return (
                <div 
                  key={item.id} 
                  onClick={() => { triggerHaptic(); onSelectItem(itemWithPromo); }} 
                  className={`group cursor-pointer w-full flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl transition-all duration-200 active:scale-[0.98] hover:shadow-md ${getCardClasses()}`}
                >
                  <div>
                    {/* Top: Veg Hallmark + Badge */}
                    <div className="flex items-center justify-between mb-2 gap-1.5">
                      <VegSymbol isVeg={item.isVeg ?? (item.category === 'BURGERS' || item.category === 'SNACKS')} />
                      {item.badge ? (
                        <DishBadgePill badge={item.badge} mode="inline" />
                      ) : (
                        <span className="text-[9px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 opacity-70 truncate">
                          {item.category}
                        </span>
                      )}
                    </div>

                    {/* Dish Title: Full wrap (no cutoffs) */}
                    <h3 className={`font-black text-xs sm:text-[13px] md:text-sm tracking-tight leading-snug break-words ${isDarkBg ? 'text-zinc-100' : 'text-zinc-900'} group-hover:text-primary transition-colors`}>
                      {item.name}
                    </h3>
                  </div>

                  {/* Bottom Line: Price & Tactile Add/Stepper */}
                  <div className="mt-3 pt-2.5 border-t border-black/[0.04] dark:border-white/5 flex items-center justify-between gap-1.5">
                    <div className="flex flex-col">
                      <span className={`font-black text-sm sm:text-base tracking-tight font-mono ${isDarkBg ? 'text-zinc-50' : 'text-zinc-950'}`}>
                        ₹{effectivePrice.toFixed(0)}
                      </span>
                      {isItemHappyHour && (
                        <span className="text-[10px] text-zinc-400 line-through font-mono">₹{item.basePrice.toFixed(0)}</span>
                      )}
                    </div>

                    {qty === 0 ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); else onSelectItem(itemWithPromo); }} 
                        className="px-3.5 py-1.5 rounded-full text-[11px] font-black text-white transition-all duration-150 hover:brightness-110 active:scale-90 shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                        style={{ 
                          backgroundColor: primaryColor || '#E46254',
                          boxShadow: `0 2px 10px ${primaryColor || '#E46254'}40`
                        }}
                      >
                        <span>ADD</span>
                        <span className="text-xs font-black leading-none">+</span>
                      </button>
                    ) : (
                      <div 
                        className={`flex items-center gap-1 p-0.5 rounded-full border shadow-2xs transition-all shrink-0 ${
                          isDarkBg 
                            ? 'bg-zinc-900/90 border-white/10' 
                            : 'bg-white/95 border-black/10'
                        }`}
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, -1); }} 
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black active:scale-90 transition-all cursor-pointer ${
                            isDarkBg ? 'text-zinc-200 bg-zinc-800 hover:bg-zinc-700' : 'text-zinc-800 bg-zinc-100 hover:bg-zinc-200'
                          }`}
                        >
                          -
                        </button>
                        <span className={`w-4 text-center font-black text-xs select-none tabular-nums ${isDarkBg ? 'text-zinc-100' : 'text-zinc-950'}`}>{qty}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); }} 
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white active:scale-90 transition-all shadow-xs cursor-pointer"
                          style={{ backgroundColor: primaryColor || '#E46254' }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // 1x1 List Text Only: Elegant single row with natural wrapping title
            return (
              <div 
                key={item.id} 
                onClick={() => { triggerHaptic(); onSelectItem(itemWithPromo); }} 
                className={`group cursor-pointer w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl transition-all duration-200 active:scale-[0.99] hover:shadow-md ${getCardClasses()}`}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0 pr-3">
                  <div className="mt-0.5 shrink-0">
                    <VegSymbol isVeg={item.isVeg ?? (item.category === 'BURGERS' || item.category === 'SNACKS')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <h3 className={`font-black text-sm sm:text-base tracking-tight break-words ${isDarkBg ? 'text-zinc-100' : 'text-zinc-900'} group-hover:text-primary transition-colors`}>
                        {item.name}
                      </h3>
                      {item.badge && (
                        <DishBadgePill badge={item.badge} mode="inline" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                      {item.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className={`font-black text-sm sm:text-base tracking-tight font-mono ${isDarkBg ? 'text-zinc-50' : 'text-zinc-950'}`}>
                      ₹{effectivePrice.toFixed(0)}
                    </span>
                    {isItemHappyHour && (
                      <span className="text-[10px] text-zinc-400 line-through font-mono">₹{item.basePrice.toFixed(0)}</span>
                    )}
                  </div>

                  {qty === 0 ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); else onSelectItem(itemWithPromo); }} 
                      className="px-3.5 py-1.5 rounded-full text-xs font-black text-white transition-all duration-150 hover:brightness-110 active:scale-95 shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                      style={{ 
                        backgroundColor: primaryColor || '#E46254',
                        boxShadow: `0 2px 10px ${primaryColor || '#E46254'}40`
                      }}
                    >
                      <span>ADD</span>
                      <span className="text-xs font-black leading-none">+</span>
                    </button>
                  ) : (
                    <div 
                      className={`flex items-center gap-1 p-0.5 rounded-full border shadow-2xs transition-all shrink-0 ${
                        isDarkBg 
                          ? 'bg-zinc-900/90 border-white/10' 
                          : 'bg-white/95 border-black/10'
                      }`}
                    >
                      <button 
                        onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, -1); }} 
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black active:scale-90 transition-all cursor-pointer ${
                          isDarkBg ? 'text-zinc-200 bg-zinc-800 hover:bg-zinc-700' : 'text-zinc-800 bg-zinc-100 hover:bg-zinc-200'
                        }`}
                      >
                        -
                      </button>
                      <span className={`w-5 text-center font-black text-xs select-none tabular-nums ${isDarkBg ? 'text-zinc-100' : 'text-zinc-950'}`}>{qty}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); }} 
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white active:scale-90 transition-all shadow-xs cursor-pointer"
                        style={{ backgroundColor: primaryColor || '#E46254' }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // ══════════════════════════════════════════════════════════════════
          // MODE B: SHOW WITH IMAGES (Luxury Presentation)
          // ══════════════════════════════════════════════════════════════════
          if (isGrid) {
            // 2x2 Grid Mode With Image: Well balanced card with full title readability
            return (
              <div 
                key={item.id} 
                onClick={() => { triggerHaptic(); onSelectItem(itemWithPromo); }} 
                className={`group cursor-pointer w-full flex flex-col rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.98] hover:shadow-md ${getCardClasses()}`}
              >
                {/* Photo Stage */}
                <div className="relative w-full h-32 sm:h-36 bg-stone-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                  {item.badge && (
                    <div className="absolute top-2 left-2 z-10">
                      <DishBadgePill badge={item.badge} mode="glass" />
                    </div>
                  )}
                  {item.img ? (
                    <img 
                      src={item.img} 
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-106 pointer-events-none" 
                    />
                  ) : (
                    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200/80 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-zinc-950">
                      <div className="w-9 h-9 rounded-full border border-black/[0.08] dark:border-white/10 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-xs flex items-center justify-center mb-1 shadow-2xs">
                        <ChefHat size={16} className="text-zinc-600 dark:text-zinc-300" strokeWidth={1.5} />
                      </div>
                      <span className="text-[7.5px] font-bold tracking-[0.2em] text-zinc-400 dark:text-zinc-500 uppercase">Chef's Selection</span>
                    </div>
                  )}
                </div>

                {/* Content Box */}
                <div className="p-3 sm:p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <VegSymbol isVeg={item.isVeg ?? (item.category === 'BURGERS' || item.category === 'SNACKS')} />
                      <span className="text-[9px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 truncate">
                        {item.category}
                      </span>
                    </div>
                    {/* Item Name: Clean, never abruptly truncated, readable wrap */}
                    <h3 className={`font-black text-xs sm:text-[13px] tracking-tight leading-snug break-words ${isDarkBg ? 'text-zinc-100' : 'text-zinc-900'} group-hover:text-primary transition-colors`}>
                      {item.name}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-2.5 mt-2 border-t border-black/[0.04] dark:border-white/5">
                    <span className={`font-black text-xs sm:text-sm tracking-tight font-mono ${isDarkBg ? 'text-zinc-50' : 'text-zinc-950'}`}>
                      ₹{effectivePrice.toFixed(0)}
                    </span>

                    {qty === 0 ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); else onSelectItem(itemWithPromo); }} 
                        className="px-2.5 py-1.5 rounded-full text-[10.5px] font-black text-white transition-all duration-150 hover:brightness-110 active:scale-90 shadow-xs flex items-center gap-0.5 cursor-pointer shrink-0"
                        style={{ backgroundColor: primaryColor || '#E46254' }}
                      >
                        <span>ADD</span>
                        <span className="text-xs font-black leading-none">+</span>
                      </button>
                    ) : (
                      <div className={`flex items-center gap-0.5 p-0.5 rounded-full border shadow-2xs shrink-0 ${isDarkBg ? 'bg-zinc-900/90 border-white/10' : 'bg-white/95 border-black/10'}`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, -1); }} 
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black active:scale-90 cursor-pointer ${
                            isDarkBg ? 'text-zinc-200 bg-zinc-800 hover:bg-zinc-700' : 'text-zinc-800 bg-zinc-100 hover:bg-zinc-200'
                          }`}
                        >
                          -
                        </button>
                        <span className={`w-3.5 text-center font-black text-[11px] tabular-nums ${isDarkBg ? 'text-zinc-100' : 'text-zinc-950'}`}>{qty}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); }} 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white active:scale-90 cursor-pointer shadow-xs"
                          style={{ backgroundColor: primaryColor || '#E46254' }}
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

          // 1x1 List Mode With Image: Spacious thumbnail card with natural wrapping title & properly positioned ADD button
          return (
            <div 
              key={item.id} 
              onClick={() => { triggerHaptic(); onSelectItem(itemWithPromo); }} 
              className={`group cursor-pointer w-full flex items-center p-3 sm:p-3.5 rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.99] hover:shadow-md ${getCardClasses()}`}
            >
              {/* Food Thumbnail with subtle rounded squircle */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-stone-100 dark:bg-zinc-900 flex items-center justify-center mr-3.5">
                {item.badge && (
                  <div className="absolute top-1 left-1 z-10">
                    <DishBadgePill badge={item.badge} mode="glass" />
                  </div>
                )}
                {item.img ? (
                  <img 
                    src={item.img} 
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-106 pointer-events-none" 
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full p-1 text-center bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200/80 dark:from-zinc-900 dark:to-zinc-950">
                    <div className="w-8 h-8 rounded-full border border-black/[0.08] dark:border-white/10 bg-white/60 dark:bg-zinc-800/60 flex items-center justify-center mb-0.5">
                      <ChefHat size={14} className="text-zinc-600 dark:text-zinc-300" strokeWidth={1.5} />
                    </div>
                  </div>
                )}
              </div>

              {/* Title, Category & Price with Natural Non-Cutoff Wrapping */}
              <div className="flex-1 min-w-0 pr-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <VegSymbol isVeg={item.isVeg ?? (item.category === 'BURGERS' || item.category === 'SNACKS')} />
                  <span className="text-[9.5px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 truncate">
                    {item.category}
                  </span>
                </div>
                <h3 className={`font-black text-sm sm:text-base tracking-tight leading-snug break-words ${isDarkBg ? 'text-zinc-100' : 'text-zinc-900'} group-hover:text-primary transition-colors`}>
                  {item.name}
                </h3>
                <span className={`font-black text-sm sm:text-base tracking-tight font-mono mt-1 block ${isDarkBg ? 'text-zinc-50' : 'text-zinc-950'}`}>
                  ₹{effectivePrice.toFixed(0)}
                </span>
              </div>

              {/* Action Stepper / ADD Button (Properly Anchored) */}
              <div className="shrink-0 pl-1">
                {qty === 0 ? (
                  <button 
                    onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); else onSelectItem(itemWithPromo); }} 
                    className="px-3.5 py-1.5 rounded-full text-xs font-black text-white transition-all duration-150 hover:brightness-110 active:scale-95 shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                    style={{ 
                      backgroundColor: primaryColor || '#E46254',
                      boxShadow: `0 2px 10px ${primaryColor || '#E46254'}40`
                    }}
                  >
                    <span>ADD</span>
                    <span className="text-xs font-black leading-none">+</span>
                  </button>
                ) : (
                  <div className={`flex items-center gap-1 p-0.5 rounded-full border shadow-2xs shrink-0 ${isDarkBg ? 'bg-zinc-900/90 border-white/10' : 'bg-white/95 border-black/10'}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, -1); }} 
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black active:scale-90 cursor-pointer ${
                        isDarkBg ? 'text-zinc-200 bg-zinc-800 hover:bg-zinc-700' : 'text-zinc-800 bg-zinc-100 hover:bg-zinc-200'
                      }`}
                    >
                      -
                    </button>
                    <span className={`w-5 text-center font-black text-xs select-none tabular-nums ${isDarkBg ? 'text-zinc-100' : 'text-zinc-950'}`}>{qty}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerHaptic(); if (onUpdateQuantity) onUpdateQuantity(itemWithPromo, 1); }} 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white active:scale-90 cursor-pointer shadow-xs"
                      style={{ backgroundColor: primaryColor || '#E46254' }}
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
        <div className={`text-center py-12 px-6 flex flex-col items-center gap-3 ${radClass} ${
          cardStyle === 'brutalist' 
            ? 'border-4 border-black bg-white text-black' 
            : isDarkBg 
            ? 'bg-zinc-900/90 border border-zinc-800 text-zinc-400' 
            : 'bg-white border border-gray-100 text-gray-400'
        }`}>
          <span className="font-medium text-sm">No items in {activeCategory}</span>
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
  runningTableSubtotal = 0,
  activeRoundsCount = 0,
  taxSettings
}: any) {
  const [name, setName] = useState(savedCustomerName || '');
  const [phone, setPhone] = useState(savedCustomerPhone || '');
  const [note, setNote] = useState('');
  const [payMethod, setPayMethod] = useState<'ROOM_CHARGE' | 'UPI' | 'CASH'>('UPI');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);

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

  // Cart Value Booster: Evaluated across the total dining table spend!
  const totalTableSpend = (runningTableSubtotal || 0) + subtotal;
  const boosterMinSpend = promotionsConfig?.cartBoosterMinSpend || 1000;
  const boosterEligible = promotionsConfig?.cartBoosterEnabled && (totalTableSpend >= boosterMinSpend);
  const boosterDiscount = boosterEligible ? (promotionsConfig?.cartBoosterDiscount || 100) : 0;

  // Calculate bill taxes dynamically using the taxSettings configuration
  const effectiveTaxSettings: TaxSettings = taxSettings || {
    ...DEFAULT_TAX_SETTINGS,
    gstType: 'REGULAR',
    cgstRate: 2.5,
    sgstRate: 2.5,
    pricingType: 'EXCLUSIVE',
  };

  const cartBillCalc = calculateBillTaxes({
    subtotal,
    isDineIn: true,
    settings: effectiveTaxSettings,
  });

  const isComposition = cartBillCalc.isComposition;
  const isInclusive = cartBillCalc.isInclusive;
  const gstAmount = cartBillCalc.totalGst;
  const total = cartBillCalc.grandTotal;

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
          <div className="flex items-center gap-2.5">
            <h2 className={`font-extrabold text-lg ${cardStyle === 'brutalist' ? 'uppercase tracking-tighter' : 'tracking-tight text-zinc-900'}`}>
              Your Order
            </h2>
            <span className="text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full tabular-nums">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
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
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      cardStyle === 'brutalist' 
                        ? 'bg-white border-2 border-black rounded-none shadow-[2px_2px_0_0_#000]' 
                        : 'bg-zinc-50/70 border-zinc-200/60 shadow-xs'
                    }`}
                  >
                    <div className="flex-1 pr-3 min-w-0">
                      <h4 className={`text-[13.5px] font-bold tracking-tight leading-snug break-words ${cardStyle === 'brutalist' ? 'uppercase font-black' : 'text-zinc-900'}`}>
                        {g.item?.name}
                      </h4>
                      {g.notes && (
                        <p className="text-[11px] text-amber-800 font-medium leading-snug mt-0.5 truncate">
                          {g.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
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
                            style={cardStyle !== 'brutalist' ? { backgroundColor: primaryColor || '#E46254' } : {}}
                          >
                            +
                          </button>
                        </div>
                      )}
                      <span className={`text-[14px] font-black tabular-nums font-mono min-w-[50px] text-right ${cardStyle === 'brutalist' ? 'text-black' : 'text-zinc-900'}`}>
                        ₹{g.totalPrice.toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* DINE FIRST, PAY LATER LUXURY BADGE */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center gap-3 text-zinc-900">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[12px] text-amber-950 dark:text-amber-300">Dine in first, pay later</p>
                  <p className="text-[11px] text-zinc-500 font-medium leading-snug">
                    Dishes fire directly to the kitchen. Settle your table bill whenever you finish dining.
                  </p>
                </div>
              </div>

              {/* CART PRIVILEGE (HIGHLIGHTED LUXURY VIP CARD) */}
              {promotionsConfig?.cartBoosterEnabled && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white shadow-md border border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
                  
                  {boosterEligible ? (
                    <div className="flex items-center justify-between text-xs relative z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <div>
                          <span className="block font-black text-sm text-amber-300 tracking-tight">VIP Privilege Unlocked!</span>
                          <span className="text-[11px] text-zinc-300 font-medium">Flat ₹{promotionsConfig.cartBoosterDiscount || 100} privilege applied to final table bill</span>
                        </div>
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2.5 py-1 rounded-full font-mono shrink-0">
                        -₹{promotionsConfig.cartBoosterDiscount || 100}
                      </span>
                    </div>
                  ) : (
                    <div className="relative z-10 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold tracking-tight text-amber-300 flex items-center gap-1.5">
                          <Sparkles size={13} className="text-amber-400" />
                          <span>Cart Privilege</span>
                        </span>
                        <span className="font-mono text-zinc-300 text-[11px]">
                          Add <span className="font-bold text-amber-300 font-mono">₹{Math.max(0, boosterMinSpend - totalTableSpend).toFixed(0)}</span> more for <span className="font-bold text-white font-mono">Flat ₹{promotionsConfig.cartBoosterDiscount || 100} OFF</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                          style={{ width: `${Math.min(100, (totalTableSpend / boosterMinSpend) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

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

              {/* COLLAPSIBLE SPECIAL COOKING INSTRUCTIONS */}
              <div>
                {!showNoteInput && !note ? (
                  <button
                    type="button"
                    onClick={() => setShowNoteInput(true)}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
                  >
                    <MessageSquarePlus size={14} className="text-zinc-400" />
                    <span>+ Add cooking instructions for Chef</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <ChefHat size={13} className="text-zinc-600" />
                        <span>Cooking Instructions (Optional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => { setShowNoteInput(false); setNote(''); }}
                        className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <textarea 
                      value={note} 
                      onChange={e => setNote(e.target.value)} 
                      placeholder="e.g. Extra spicy, less salt, serve hot..." 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-gray-400 text-gray-900 font-medium resize-none h-16 text-xs" 
                      autoFocus={showNoteInput && !note}
                    />
                  </div>
                )}
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
                  <span>Sending to Kitchen...</span>
                </div>
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    <Flame size={18} className="text-amber-300" />
                    <span>{hasActiveSession ? 'Add to Table Order' : 'Confirm & Place Order'}</span>
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
