"use client";
import React, { useState, useEffect, use, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Check, Flame, Clock, Star, Camera, Receipt, Utensils, CheckCircle2, ChevronUp, Users, Sparkles as SparklesIcon, AlertCircle, Coins, ArrowRight } from 'lucide-react';
import { 
  MenuItem,
  MenuTemplate,
  ModifiersSheet, 
  CartSheet
} from "@/components/MenuTemplates";
import { HotelPortal } from "@/components/HotelPortal";
import { DigitalBillModal, PaymentLock } from "@/components/DigitalBillModal";
import { ThankYouCelebrationView, SettlementData } from "@/components/ThankYouCelebrationView";
import { TableUnlockModal } from "@/components/TableUnlockModal";
import { generateSessionId, extractSessionId, attachSessionToNote } from "@/utils/orderSession";
import { generateTablePin, getTableSessionSeed, normalizeTableIdentifier, resolveTablePinAndSeed } from "@/utils/tableSessionPin";

interface LoyaltyMilestone {
  id: string;
  minSpend: number;
  coinsEarned: number;
}

interface PromotionsConfig {
  loyaltyEnabled: boolean;
  coinValueInRupees: number;
  milestones: LoyaltyMilestone[];
  minOrderToRedeem: number;
  maxCoinsPerOrder: number;
  happyHourEnabled: boolean;
  happyHourDiscountPct: number;
  happyHourStartTime: string;
  happyHourEndTime: string;
  happyHourDays: string[];
  cartBoosterEnabled: boolean;
  cartBoosterMinSpend: number;
  cartBoosterDiscount: number;
}

const DEFAULT_PROMOTIONS_CONFIG: PromotionsConfig = {
  loyaltyEnabled: true,
  coinValueInRupees: 1.0,
  milestones: [
    { id: "m-1", minSpend: 200, coinsEarned: 2 },
    { id: "m-2", minSpend: 400, coinsEarned: 6 },
    { id: "m-3", minSpend: 800, coinsEarned: 12 },
    { id: "m-4", minSpend: 1500, coinsEarned: 25 },
  ],
  minOrderToRedeem: 800,
  maxCoinsPerOrder: 100,
  happyHourEnabled: true,
  happyHourDiscountPct: 20,
  happyHourStartTime: "15:30",
  happyHourEndTime: "18:30",
  happyHourDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  cartBoosterEnabled: true,
  cartBoosterMinSpend: 1000,
  cartBoosterDiscount: 100,
};

function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  const period = h >= 12 ? "PM" : "AM";
  const hours12 = h % 12 || 12;
  const minutes = m < 10 ? `0${m}` : `${m}`;
  return `${hours12}:${minutes} ${period}`;
}

function getHappyHourStatus(config: PromotionsConfig) {
  if (!config || !config.happyHourEnabled) {
    return {
      isEnabled: false,
      isActive: false,
      discountPct: 0,
      startTimeDisplay: "",
      endTimeDisplay: "",
      isTodayScheduled: false,
      days: [] as string[]
    };
  }

  const now = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDay = dayNames[now.getDay()];
  const isTodayScheduled = !config.happyHourDays || config.happyHourDays.length === 0 || config.happyHourDays.includes(currentDay);

  const [startH, startM] = (config.happyHourStartTime || "15:30").split(":").map(Number);
  const [endH, endM] = (config.happyHourEndTime || "18:30").split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  const isActive = isTodayScheduled && currentMinutes >= startMinutes && currentMinutes <= endMinutes;

  return {
    isEnabled: true,
    isActive,
    discountPct: config.happyHourDiscountPct || 20,
    startTimeDisplay: formatTime12h(config.happyHourStartTime || "15:30"),
    endTimeDisplay: formatTime12h(config.happyHourEndTime || "18:30"),
    isTodayScheduled,
    days: config.happyHourDays || []
  };
}

function buildSettlementSnapshot(
  orders: any[], 
  rest: any, 
  tableNo: string, 
  promotions: any, 
  storedCoinsBalance: number = 0,
  isPayer: boolean = true,
  payerPhone?: string,
  payerName?: string
): SettlementData {
  let subtotal = 0;
  const itemsMap = new Map<string, { name: string; count: number; price: number }>();
  
  (orders || []).forEach(ord => {
    (ord.items_json || []).forEach((entry: any) => {
      const name = entry?.item?.name || entry?.name || 'Dish Item';
      const count = Number(entry?.quantity || 1);
      const price = Number(entry?.price || entry?.item?.basePrice || 0);
      subtotal += price * count;
      const existing = itemsMap.get(name);
      if (existing) {
        existing.count += count;
      } else {
        itemsMap.set(name, { name, count, price });
      }
    });
  });

  const ordersSumTotal = (orders || []).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  if (subtotal === 0 && ordersSumTotal > 0) {
    subtotal = Number((ordersSumTotal / 1.05).toFixed(2));
  }

  const taxAmount = Number((subtotal * 0.05).toFixed(2));
  const grandTotal = ordersSumTotal > 0 ? Number(ordersSumTotal.toFixed(2)) : Number((subtotal + taxAmount).toFixed(2));
  
  let earnedCoins = 0;
  if (promotions?.loyaltyEnabled !== false) {
    const milestones = promotions?.milestones || [];
    const sorted = [...milestones].sort((a: any, b: any) => b.minSpend - a.minSpend);
    const m = sorted.find((ms: any) => grandTotal >= ms.minSpend);
    earnedCoins = m ? m.coinsEarned : Math.max(0, Math.floor(grandTotal * 0.1));
  }

  const effectivePayerPhone = (payerPhone || orders.map(o => o.customer_phone).find(Boolean) || '').replace(/\D/g, '');
  const effectivePayerName = payerName || orders.map(o => o.customer_name).find(Boolean) || 'Table Guest';

  return {
    settledAt: Date.now(),
    tableNo,
    restaurantId: rest?.id || '',
    restaurantName: rest?.name || 'Restaurant',
    logoUrl: rest?.logo_url,
    grandTotal,
    subtotal,
    discount: 0,
    taxAmount,
    serviceChargeAmount: 0,
    earnedCoins,
    totalCoins: isPayer ? (storedCoinsBalance + earnedCoins) : storedCoinsBalance,
    previousCoins: storedCoinsBalance,
    isPayer,
    payerName: effectivePayerName,
    payerPhone: effectivePayerPhone,
    customerPhone: effectivePayerPhone,
    customerName: effectivePayerName,
    items: Array.from(itemsMap.values()),
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    upiId: rest?.upi_id || rest?.upi_vpa
  };
}

export default function CustomerMenuPage({ params }: { params: Promise<{ domain: string, locationCode: string }> }) {
  const resolvedParams = use(params);
  const domain = resolvedParams.domain;
  const locationCode = resolvedParams.locationCode;
  
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [businessType, setBusinessType] = useState('RESTAURANT');
  const [error, setError] = useState<string | null>(null);

  // Shared data
  const [restData, setRestData] = useState<any>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [allItems, setAllItems] = useState<any[]>([]);

  // Restaurant-only state
  const [theme, setTheme] = useState<any>({});
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['ALL']);

  // Promotions and Badges State
  const [promotionsConfig, setPromotionsConfig] = useState<PromotionsConfig>(DEFAULT_PROMOTIONS_CONFIG);
  const [dishBadges, setDishBadges] = useState<Record<string, string>>({});
  const [customerCoinsBalance, setCustomerCoinsBalance] = useState<number>(0);

  const happyHourInfo = useMemo(() => {
    return getHappyHourStatus(promotionsConfig);
  }, [promotionsConfig]);
  
  // Real-time Collaborative Cart State
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<{ item: MenuItem; price: number }[]>([]);

  // Persistent Shared Running Table Orders (Synced via Supabase)
  const [tableOrders, setTableOrders] = useState<any[]>([]);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [orderToast, setOrderToast] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [activeGuestsCount, setActiveGuestsCount] = useState<number>(1);
  const [guestAlertModal, setGuestAlertModal] = useState<{ title: string; message: string } | null>(null);
  const [settlementSnapshot, setSettlementSnapshot] = useState<SettlementData | null>(null);

  // Table 4-Digit Safety PIN and Customer Identity
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isTableUnlocked, setIsTableUnlocked] = useState<boolean>(true);
  const [tableSessionPin, setTableSessionPin] = useState<string>('');

  // Concurrency Payment Lock for Multi-Guest Tables
  const [activePaymentLock, setActivePaymentLock] = useState<PaymentLock | null>(null);
  const activePaymentLockRef = React.useRef<PaymentLock | null>(null);
  useEffect(() => {
    activePaymentLockRef.current = activePaymentLock;
  }, [activePaymentLock]);

  // Restaurant Billing Mode: 'STAFF_ASSISTED' (Koi Resto-Bar flow) or 'SELF_PAY' (Guest In-App)
  const [billingMode, setBillingMode] = useState<'STAFF_ASSISTED' | 'SELF_PAY'>('STAFF_ASSISTED');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const restId = restData?.id || theme?.id;
    const savedMode = (restId ? localStorage.getItem(`tabletapy_billing_mode_${restId}`) : null) || localStorage.getItem('tabletapy_billing_mode_default');
    if (savedMode === 'SELF_PAY' || savedMode === 'STAFF_ASSISTED') {
      setBillingMode(savedMode);
    }
  }, [restData?.id, theme?.id]);

  // Sync customer coins balance with identified table phone number
  useEffect(() => {
    const phone = tableOrders[0]?.customer_phone;
    if (phone && restData?.id) {
      const cleanPhone = phone.replace(/\D/g, '');
      const stored = localStorage.getItem(`tabletapy_customer_coins_${restData.id}_${cleanPhone}`);
      setCustomerCoinsBalance(stored ? Number(stored) || 0 : 0);
    } else {
      setCustomerCoinsBalance(0);
    }
  }, [tableOrders, restData?.id]);

  // When table is settling (cash requested or UPI verification pending), lock to full-screen Thank You / Settlement
  useEffect(() => {
    const isSettling = tableOrders.some(
      o => o.payment_status === 'CASH_REQUESTED' || o.payment_status === 'UPI_VERIFICATION_PENDING'
    );
    if (isSettling) {
      setIsBillModalOpen(true);
    }
  }, [tableOrders]);

  // Real-time channel and client identity refs
  const channelRef = React.useRef<any>(null);
  const localBcRef = React.useRef<BroadcastChannel | null>(null);
  const cartRef = React.useRef<{ item: MenuItem; price: number }[]>([]);
  const clientIdRef = React.useRef<string>('');
  const restDataRef = React.useRef<any>(null);
  const locationNameRef = React.useRef<string>('');

  // Keep cartRef in sync with cart state
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const tableOrdersRef = React.useRef<any[]>([]);
  const lastActiveOrdersRef = React.useRef<any[]>([]);
  const promotionsConfigRef = React.useRef<any>(promotionsConfig);
  const customerCoinsBalanceRef = React.useRef<number>(customerCoinsBalance);

  useEffect(() => {
    restDataRef.current = restData;
  }, [restData]);

  useEffect(() => {
    locationNameRef.current = locationName;
  }, [locationName]);

  useEffect(() => {
    tableOrdersRef.current = tableOrders;
    if (tableOrders.length > 0) {
      lastActiveOrdersRef.current = tableOrders;
    }
  }, [tableOrders]);

  useEffect(() => {
    promotionsConfigRef.current = promotionsConfig;
  }, [promotionsConfig]);

  useEffect(() => {
    customerCoinsBalanceRef.current = customerCoinsBalance;
  }, [customerCoinsBalance]);

  // Dismiss sync toast automatically
  useEffect(() => {
    if (!syncToast) return;
    const t = setTimeout(() => setSyncToast(null), 3200);
    return () => clearTimeout(t);
  }, [syncToast]);

  // Strip one-time QR query params (?scan=true, ?s=...) so in-browser refreshes stay clean
  useEffect(() => {
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('scan') || currentUrl.searchParams.has('s')) {
          currentUrl.searchParams.delete('scan');
          currentUrl.searchParams.delete('s');
          const newSearch = currentUrl.searchParams.toString();
          const cleanUrl = currentUrl.pathname + (newSearch ? `?${newSearch}` : '');
          window.history.replaceState({}, '', cleanUrl);
        }
      } catch {}
    }
  }, []);

  // Real-time collaborative cart receiver (shared across BroadcastChannel, storage events, and Supabase Realtime)
  const applyIncomingCart = React.useCallback((payload: any) => {
    if (!payload || payload.senderId === clientIdRef.current) return;
    
    if (payload.action === 'order_placed') {
      setCart([]);
      cartRef.current = [];
      setIsCartOpen(false);
      setSyncToast(`Table guest sent order to kitchen!`);
      try {
        const rId = restDataRef.current?.id;
        const lName = locationNameRef.current;
        if (rId && lName) {
          localStorage.removeItem(`tabletapy_cart_${rId}_${lName}`);
        }
      } catch {}
      return;
    }

    const incomingCart = Array.isArray(payload.cart) ? payload.cart : [];
    
    // Fast check: if cart is already identical, do not trigger re-render
    const curCart = cartRef.current;
    if (
      incomingCart.length === curCart.length &&
      JSON.stringify(incomingCart) === JSON.stringify(curCart)
    ) {
      return;
    }

    setCart(incomingCart);
    cartRef.current = incomingCart;

    // Cache to local storage
    try {
      const rId = restDataRef.current?.id;
      const lName = locationNameRef.current;
      if (rId && lName) {
        if (incomingCart.length === 0) {
          localStorage.removeItem(`tabletapy_cart_${rId}_${lName}`);
        } else {
          localStorage.setItem(`tabletapy_cart_${rId}_${lName}`, JSON.stringify(incomingCart));
        }
      }
    } catch {}

    // Immediate user-friendly toast notification
    if (payload.action === 'guest_joined' && payload.senderName) {
      setSyncToast(`${payload.senderName} connected to Table ${locationNameRef.current || 'your table'}!`);
      return;
    }

    if (payload.action === 'add' && payload.itemName) {
      setSyncToast(`${payload.senderName || 'Table guest'} added ${payload.itemName}`);
    } else if (payload.action === 'remove' && payload.itemName) {
      setSyncToast(`${payload.senderName || 'Table guest'} removed ${payload.itemName}`);
    } else if (payload.action === 'clear') {
      setSyncToast(`Table cart cleared`);
    }
  }, []);

  // Synchronize cart across browser tabs via storage events as secondary fallback
  useEffect(() => {
    if (!restData?.id || !locationName) return;
    const cartKey = `tabletapy_cart_${restData.id}_${locationName}`;

    const handleStorageCartChange = (e: StorageEvent) => {
      if (e.key === cartKey) {
        try {
          const incoming = e.newValue ? JSON.parse(e.newValue) : [];
          if (Array.isArray(incoming)) {
            const curCart = cartRef.current;
            if (incoming.length !== curCart.length || JSON.stringify(incoming) !== JSON.stringify(curCart)) {
              setCart(incoming);
              cartRef.current = incoming;
            }
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageCartChange);
    return () => window.removeEventListener('storage', handleStorageCartChange);
  }, [restData?.id, locationName]);

  // Load initial restaurant, table, and active running table orders
  useEffect(() => {
    // Generate or retrieve stable unique client session ID for this browser tab/device
    let clientSessionId = '';
    if (typeof window !== 'undefined') {
      try {
        clientSessionId = sessionStorage.getItem('tabletapy_client_session_id') || '';
        if (!clientSessionId) {
          clientSessionId = 'cli_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
          sessionStorage.setItem('tabletapy_client_session_id', clientSessionId);
        }
      } catch {
        clientSessionId = 'cli_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      }
    }
    clientIdRef.current = clientSessionId;

    let activeChannel: any = null;

    async function loadData() {
      try {
        let rest: any = null;
        let loc: any = null;

        const cleanDomain = (domain || '').replace('.localhost:3000', '').replace('.tabletapy.com', '').trim();
        
        // 1. Try to fetch restaurant by domain slug if cleanDomain is valid
        if (cleanDomain && cleanDomain !== 'localhost' && cleanDomain !== 'direct') {
          const { data: r } = await supabase.from('restaurants').select('*').eq('slug', cleanDomain).maybeSingle();
          if (r) {
            rest = r;
            const { data: l } = await supabase.from('locations').select('*').eq('restaurant_id', rest.id).eq('secure_code', locationCode).maybeSingle();
            if (l) loc = l;
          }
        }

        // 2. Direct fallback: look up location by secure_code directly
        if (!loc) {
          const { data: l } = await supabase.from('locations').select('*').eq('secure_code', locationCode).maybeSingle();
          if (l) {
            loc = l;
            const { data: r } = await supabase.from('restaurants').select('*').eq('id', l.restaurant_id).maybeSingle();
            if (r) rest = r;
          }
        }

        if (!rest || !loc) {
          setError("Invalid QR Code: Table or Menu not found.");
          setLoading(false);
          return;
        }
        
        setLocationName(loc.name);

        const bType = rest.business_type || 'RESTAURANT';
        setBusinessType(bType);
        setRestData(rest);

        // Load local cart cache if present
        try {
          const cached = localStorage.getItem(`tabletapy_cart_${rest.id}_${loc.name}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCart(parsed);
              cartRef.current = parsed;
            }
          }
        } catch {}

        // 3. Check for active running table orders (Shared Table State)
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', rest.id)
          .ilike('table_no', loc.name)
          .neq('status', 'CANCELLED')
          .neq('payment_status', 'PAID')
          .order('created_at', { ascending: true });

        const validActive = activeOrders ? activeOrders.filter(o => o.payment_status !== 'PAID' && o.status !== 'CANCELLED') : [];
        if (validActive.length > 0) {
          // Live active dining session in progress: clear old settlement snapshot!
          setSettlementSnapshot(null);
          try {
            localStorage.removeItem(`tabletapy_settlement_${rest.id}_${loc.name}`);
          } catch {}
          setTableOrders(validActive);
        } else {
          setTableOrders([]);
        }

        // 3b. Fetch latest settled order for seed & compute active Table PIN
        const { data: settledOrders } = await supabase
          .from('orders')
          .select('id, table_no, created_at, payment_status')
          .eq('restaurant_id', rest.id)
          .eq('payment_status', 'PAID')
          .order('created_at', { ascending: false })
          .limit(25);

        const normLoc = normalizeTableIdentifier(loc.name);
        const tableSettled = (settledOrders || []).filter((o: any) => normalizeTableIdentifier(o.table_no) === normLoc);
        const { pin: expectedPin, seed: sessionSeed } = resolveTablePinAndSeed(loc.name, validActive, tableSettled);
        setTableSessionPin(expectedPin);
        console.log(`[Table Security] Table: "${loc.name}" (${normLoc}) -> Active PIN: ${expectedPin} (Seed: ${sessionSeed})`);

        // Check if customer has already entered the PIN on this device during this session
        const cleanTable = (loc.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        try {
          const storedUnlock = sessionStorage.getItem(`tabletapy_unlock_${rest.id}_${cleanTable}`);
          if (storedUnlock) {
            const parsed = JSON.parse(storedUnlock);
            if (parsed.pin === expectedPin && parsed.name && parsed.phone) {
              setCustomerName(parsed.name);
              setCustomerPhone(parsed.phone);
              setIsTableUnlocked(true);
            } else {
              setIsTableUnlocked(false);
            }
          } else {
            setIsTableUnlocked(false);
          }
        } catch {
          setIsTableUnlocked(false);
        }

        // 4. Setup SHARED Realtime Channel for this Table (Collaborative Cart + Orders + Presence)
        try {
          const cleanTable = (loc.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const sharedChannelName = `table_session_${rest.id}_${cleanTable}`;

          // Local 0ms cross-tab broadcast bus
          const bcChannelName = `tabletapy_bc_${rest.id}_${cleanTable}`;
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            try {
              if (localBcRef.current) {
                localBcRef.current.close();
              }
              const bc = new BroadcastChannel(bcChannelName);
              localBcRef.current = bc;
              bc.onmessage = (event) => {
                if (event.data) {
                  applyIncomingCart(event.data);
                }
              };
            } catch (bcErr) {
              console.warn("BroadcastChannel initialization notice:", bcErr);
            }
          }

          const existingCh = supabase.getChannels().find(c => c.topic === `realtime:${sharedChannelName}` || c.topic === sharedChannelName);
          if (existingCh) {
            try {
              existingCh.untrack();
            } catch {}
            await supabase.removeChannel(existingCh);
          }

          activeChannel = supabase.channel(sharedChannelName, {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: clientIdRef.current || 'guest' }
            }
          });
          channelRef.current = activeChannel;

          activeChannel
            // Listen for DB order state changes
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `restaurant_id=eq.${rest.id}`
              },
              (payload: any) => {
                const record = (payload.new || payload.old) as any;
                const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (record && normalize(record.table_no) === normalize(loc.name)) {
                  // If order was marked PAID, immediately build settlement snapshot and transition to thank you!
                  if (payload.new && payload.new.payment_status === 'PAID') {
                    const candidateOrders = tableOrdersRef.current.length > 0 
                      ? tableOrdersRef.current 
                      : lastActiveOrdersRef.current;
                    if (candidateOrders && candidateOrders.length > 0) {
                      const cleanMyPhone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
                      const recordPayerPhone = (payload.new?.customer_phone || '').replace(/\D/g, '');
                      const isPayer = Boolean(
                        (activePaymentLockRef.current && activePaymentLockRef.current.lockedByClientId === clientIdRef.current) ||
                        (cleanMyPhone && recordPayerPhone && cleanMyPhone === recordPayerPhone)
                      );
                      const resolvedPayerPhone = recordPayerPhone || (activePaymentLockRef.current?.payerPhone || '').replace(/\D/g, '') || cleanMyPhone;
                      const resolvedPayerName = payload.new?.customer_name || activePaymentLockRef.current?.payerName || candidateOrders[0]?.customer_name || 'Table Guest';

                      const snapshot = buildSettlementSnapshot(
                        candidateOrders, 
                        rest, 
                        loc.name, 
                        promotionsConfigRef.current, 
                        customerCoinsBalanceRef.current,
                        isPayer,
                        resolvedPayerPhone,
                        resolvedPayerName
                      );

                      if (isPayer && cleanMyPhone.length === 10 && rest?.id) {
                        const newTotal = customerCoinsBalanceRef.current + (snapshot.earnedCoins || 0);
                        localStorage.setItem(`tabletapy_customer_coins_${rest.id}_${cleanMyPhone}`, newTotal.toString());
                        setCustomerCoinsBalance(newTotal);
                      }

                      setSettlementSnapshot(snapshot);
                    }
                    setActivePaymentLock(null);
                    activePaymentLockRef.current = null;
                    setTableOrders([]);
                    setIsBillModalOpen(false);
                    return;
                  }

                  if (payload.new && payload.new.status === 'CANCELLED') {
                    setTableOrders(prev => prev.filter(o => o.id !== payload.new.id));
                  }

                  // Refresh active table orders for this table
                  supabase
                    .from('orders')
                    .select('*')
                    .eq('restaurant_id', rest.id)
                    .ilike('table_no', loc.name)
                    .neq('status', 'CANCELLED')
                    .neq('payment_status', 'PAID')
                    .order('created_at', { ascending: true })
                    .then(({ data }) => {
                      const valid = (data || []).filter(o => o.payment_status !== 'PAID' && o.status !== 'CANCELLED');
                      setTableOrders(valid);
                    });
                }
              }
            )
            // Listen for Food Ready broadcast from kitchen
            .on('broadcast', { event: 'food_ready' }, () => {
              supabase
                .from('orders')
                .select('*')
                .eq('restaurant_id', rest.id)
                .ilike('table_no', loc.name)
                .neq('status', 'CANCELLED')
                .neq('payment_status', 'PAID')
                .order('created_at', { ascending: true })
                .then(({ data }) => {
                  const valid = (data || []).filter(o => o.payment_status !== 'PAID' && o.status !== 'CANCELLED');
                  setTableOrders(valid);
                });
              setSyncToast('Your order has been plated and will be served shortly!');
            })
            // Concurrency: Table payment lock acquired by a guest
            .on('broadcast', { event: 'payment_lock_acquired' }, ({ payload }: any) => {
              if (!payload) return;
              if (payload.lockedByClientId !== clientIdRef.current) {
                setActivePaymentLock(payload);
                setSyncToast(`${payload.payerName || 'Table guest'} is currently paying the bill`);
              }
            })
            // Concurrency: Table payment lock released (user backed out or cancelled)
            .on('broadcast', { event: 'payment_lock_released' }, ({ payload }: any) => {
              setActivePaymentLock(null);
              activePaymentLockRef.current = null;
              setSyncToast('Payment hold released. You can now settle the bill.');
            })
            // Listen for Payment Confirmed broadcast from staff / captain
            .on('broadcast', { event: 'payment_confirmed' }, async ({ payload }: any) => {
              let candidateOrders = tableOrdersRef.current.length > 0 
                ? tableOrdersRef.current 
                : lastActiveOrdersRef.current;

              if (!candidateOrders || candidateOrders.length === 0) {
                try {
                  const { data: recent } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('restaurant_id', rest.id)
                    .ilike('table_no', loc.name)
                    .neq('status', 'CANCELLED')
                    .order('created_at', { ascending: false })
                    .limit(10);
                  candidateOrders = recent || [];
                } catch {}
              }

              const cleanMyPhone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
              const payloadPayerPhone = (payload?.payerPhone || '').replace(/\D/g, '');
              const lockPayerPhone = (activePaymentLockRef.current?.payerPhone || '').replace(/\D/g, '');
              const orderPayerPhone = (candidateOrders[0]?.customer_phone || '').replace(/\D/g, '');

              const isPayer = Boolean(
                (activePaymentLockRef.current && activePaymentLockRef.current.lockedByClientId === clientIdRef.current) ||
                (cleanMyPhone && payloadPayerPhone && cleanMyPhone === payloadPayerPhone) ||
                (cleanMyPhone && lockPayerPhone && cleanMyPhone === lockPayerPhone) ||
                (cleanMyPhone && orderPayerPhone && cleanMyPhone === orderPayerPhone)
              );

              const resolvedPayerPhone = payloadPayerPhone || lockPayerPhone || orderPayerPhone || cleanMyPhone;
              const resolvedPayerName = payload?.payerName || activePaymentLockRef.current?.payerName || candidateOrders[0]?.customer_name || 'Table Guest';

              if (candidateOrders && candidateOrders.length > 0) {
                const snapshot = buildSettlementSnapshot(
                  candidateOrders, 
                  rest, 
                  loc.name, 
                  promotionsConfigRef.current, 
                  customerCoinsBalanceRef.current,
                  isPayer,
                  resolvedPayerPhone,
                  resolvedPayerName
                );

                // ONLY credit loyalty stars in localStorage if THIS device was the payer!
                if (isPayer && cleanMyPhone.length === 10 && rest?.id) {
                  const newTotal = customerCoinsBalanceRef.current + (snapshot.earnedCoins || 0);
                  localStorage.setItem(`tabletapy_customer_coins_${rest.id}_${cleanMyPhone}`, newTotal.toString());
                  setCustomerCoinsBalance(newTotal);
                }

                setSettlementSnapshot(snapshot);
              }
              setActivePaymentLock(null);
              activePaymentLockRef.current = null;
              setIsBillModalOpen(false);
              setIsCartOpen(false);
            })
            // Listen for Table Cleared broadcast from staff / captain
            .on('broadcast', { event: 'table_cleared' }, async ({ payload }: any) => {
              let candidateOrders = tableOrdersRef.current.length > 0 
                ? tableOrdersRef.current 
                : lastActiveOrdersRef.current;

              if (!candidateOrders || candidateOrders.length === 0) {
                try {
                  const { data: recent } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('restaurant_id', rest.id)
                    .ilike('table_no', loc.name)
                    .neq('status', 'CANCELLED')
                    .order('created_at', { ascending: false })
                    .limit(10);
                  candidateOrders = recent || [];
                } catch {}
              }

              const cleanMyPhone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
              const payloadPayerPhone = (payload?.payerPhone || '').replace(/\D/g, '');
              const lockPayerPhone = (activePaymentLockRef.current?.payerPhone || '').replace(/\D/g, '');
              const orderPayerPhone = (candidateOrders[0]?.customer_phone || '').replace(/\D/g, '');

              const isPayer = Boolean(
                (activePaymentLockRef.current && activePaymentLockRef.current.lockedByClientId === clientIdRef.current) ||
                (cleanMyPhone && payloadPayerPhone && cleanMyPhone === payloadPayerPhone) ||
                (cleanMyPhone && lockPayerPhone && cleanMyPhone === lockPayerPhone) ||
                (cleanMyPhone && orderPayerPhone && cleanMyPhone === orderPayerPhone)
              );

              const resolvedPayerPhone = payloadPayerPhone || lockPayerPhone || orderPayerPhone || cleanMyPhone;
              const resolvedPayerName = payload?.payerName || activePaymentLockRef.current?.payerName || candidateOrders[0]?.customer_name || 'Table Guest';

              if (candidateOrders && candidateOrders.length > 0) {
                const snapshot = buildSettlementSnapshot(
                  candidateOrders, 
                  rest, 
                  loc.name, 
                  promotionsConfigRef.current, 
                  customerCoinsBalanceRef.current,
                  isPayer,
                  resolvedPayerPhone,
                  resolvedPayerName
                );

                // ONLY credit loyalty stars in localStorage if THIS device was the payer!
                if (isPayer && cleanMyPhone.length === 10 && rest?.id) {
                  const newTotal = customerCoinsBalanceRef.current + (snapshot.earnedCoins || 0);
                  localStorage.setItem(`tabletapy_customer_coins_${rest.id}_${cleanMyPhone}`, newTotal.toString());
                  setCustomerCoinsBalance(newTotal);
                }

                setSettlementSnapshot(snapshot);
              }
              setActivePaymentLock(null);
              activePaymentLockRef.current = null;
              setTableOrders([]);
              setCart([]);
              cartRef.current = [];
              setIsCartOpen(false);
              setIsBillModalOpen(false);
              setSyncToast('Payment verified & table settled! Thank you for dining with us.');
              try {
                localStorage.removeItem(`tabletapy_cart_${rest.id}_${loc.name}`);
              } catch {}
            })
            // Real-time collaborative cart changes broadcast from table guests
            .on('broadcast', { event: 'cart_change' }, ({ payload }: any) => {
              applyIncomingCart(payload);
            })
            // Reply to newcomer requesting table's active cart
            .on('broadcast', { event: 'request_cart_state' }, ({ payload }: any) => {
              if (payload && payload.requesterId !== clientIdRef.current && cartRef.current.length > 0) {
                const syncPayload = {
                  cart: cartRef.current,
                  senderId: clientIdRef.current,
                  action: 'initial_sync',
                  timestamp: Date.now()
                };
                try {
                  localBcRef.current?.postMessage(syncPayload);
                } catch {}
                activeChannel.send({
                  type: 'broadcast',
                  event: 'cart_change',
                  payload: syncPayload
                }).catch(() => {});
              }
            })
            // Live Presence tracking for diners at this table
            .on('presence', { event: 'sync' }, () => {
              const state = activeChannel.presenceState();
              const now = Date.now();
              const activeDeviceKeys = new Set<string>();
              let latestPeerCart: any[] | null = null;
              let latestPeerCartTime = 0;

              for (const key of Object.keys(state)) {
                const entries = (state[key] as any[]) || [];
                for (const e of entries) {
                  const onlineAt = Number(e?.onlineAt) || 0;
                  const isLive = onlineAt === 0 || (now - onlineAt < 30000);
                  if (isLive) {
                    activeDeviceKeys.add(key);
                    // Check if peer has cart
                    if (key !== clientIdRef.current && Array.isArray(e?.cart) && e.cart.length > 0) {
                      if (onlineAt >= latestPeerCartTime) {
                        latestPeerCartTime = onlineAt;
                        latestPeerCart = e.cart;
                      }
                    }
                  }
                }
              }

              // Hydrate empty cart from active peer if present
              if (cartRef.current.length === 0 && latestPeerCart && latestPeerCart.length > 0) {
                setCart(latestPeerCart);
                cartRef.current = latestPeerCart;
                try {
                  const rId = restDataRef.current?.id || rest?.id;
                  const lName = locationNameRef.current || loc?.name;
                  if (rId && lName) {
                    localStorage.setItem(`tabletapy_cart_${rId}_${lName}`, JSON.stringify(latestPeerCart));
                  }
                } catch {}
              }

              // Always at least 1 (current diner), deduplicated by stable device key
              const count = Math.max(1, activeDeviceKeys.size);
              setActiveGuestsCount(count);
            })
            .subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                // Track this device's presence
                activeChannel.track({
                  clientId: clientIdRef.current,
                  deviceId: clientIdRef.current,
                  onlineAt: Date.now(),
                  cart: cartRef.current,
                }).catch(() => {});

                // Ask peers if there's already an active cart
                activeChannel.send({
                  type: 'broadcast',
                  event: 'request_cart_state',
                  payload: { requesterId: clientIdRef.current }
                }).catch(() => {});
              }
            });
        } catch (channelErr) {
          console.warn("Realtime channel notice:", channelErr);
        }

        // 5. Fetch Menu Items (supports native column and metadata isolation per restaurant)
        let menuRows: any[] | null = null;
        const { data: scopedMenu, error: menuScopeErr } = await supabase
          .from('menu_items_v2')
          .select('*')
          .eq('restaurant_id', rest.id)
          .eq('is_available', true)
          .order('created_at', { ascending: true });

        if (!menuScopeErr && scopedMenu) {
          menuRows = scopedMenu;
        } else {
          const { data: allMenu } = await supabase
            .from('menu_items_v2')
            .select('*')
            .eq('is_available', true)
            .order('created_at', { ascending: true });
          if (allMenu) {
            menuRows = allMenu.filter((row: any) => {
              if (row.restaurant_id) return row.restaurant_id === rest.id;
              const savedCustomMenuIds = localStorage.getItem(`tabletapy_menu_${rest.id}`);
              if (savedCustomMenuIds) {
                try {
                  const ids: string[] = JSON.parse(savedCustomMenuIds);
                  if (ids.includes(row.id)) return true;
                } catch {}
              }
              return row.description && row.description.includes(`[REST:${rest.id}]`);
            });
          }
        }
        const menuData = menuRows || [];

        if (bType === 'HOTEL') {
          const mapped = (menuData || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            desc: d.description,
            basePrice: d.base_price,
            category: d.category,
            isVeg: d.is_veg,
            img: d.img_url,
          }));
          setAllItems(mapped);
        } else {
          let finalTheme = { ...rest };
          if (['brutalist', 'cafe', 'qsr'].includes(finalTheme.card_style)) {
            finalTheme.card_style = 'solid';
          }
          setTheme(finalTheme);

          // Load Saved Promotions Config
          let loadedConfig = DEFAULT_PROMOTIONS_CONFIG;
          try {
            const savedPromo = localStorage.getItem(`tabletapy_promotions_config_${rest.id}`);
            if (savedPromo) {
              loadedConfig = { ...DEFAULT_PROMOTIONS_CONFIG, ...JSON.parse(savedPromo) };
            }
          } catch {}
          setPromotionsConfig(loadedConfig);

          // Load Saved Dish Badges
          let loadedBadges: Record<string, string> = {};
          try {
            const savedBadges = localStorage.getItem(`tabletapy_dish_badges_${rest.id}`);
            if (savedBadges) {
              loadedBadges = JSON.parse(savedBadges);
            }
          } catch {}
          setDishBadges(loadedBadges);

          if (menuData) {
            const mappedItems = menuData.map((d: any) => ({
              id: d.id,
              name: d.name,
              desc: d.description,
              basePrice: d.base_price,
              img: d.img_url,
              category: d.category,
              badge: loadedBadges[d.id] || d.badge || null,
              dietary: d.dietary,
              isVeg: d.is_veg
            }));
            setItems(mappedItems);
            const cats = ['ALL', ...Array.from(new Set(mappedItems.map((m: any) => m.category)))];
            setCategories(cats as string[]);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    const heartbeatInterval = setInterval(() => {
      if (activeChannel) {
        activeChannel.track({
          clientId: clientIdRef.current,
          deviceId: clientIdRef.current,
          onlineAt: Date.now(),
          cart: cartRef.current,
        }).catch(() => {});
      }
    }, 15000);

    const handleBeforeUnload = () => {
      try {
        activeChannel?.untrack();
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeatInterval);
      if (localBcRef.current) {
        try {
          localBcRef.current.close();
        } catch {}
        localBcRef.current = null;
      }
      if (activeChannel) {
        try {
          activeChannel.untrack();
        } catch {}
        supabase.removeChannel(activeChannel);
      }
    };
  }, [domain, locationCode]);

  // Synchronize promotions & dish badges in real-time when updated in owner dashboard
  useEffect(() => {
    if (!restData?.id) return;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `tabletapy_promotions_config_${restData.id}` && e.newValue) {
        try {
          setPromotionsConfig({ ...DEFAULT_PROMOTIONS_CONFIG, ...JSON.parse(e.newValue) });
        } catch {}
      }
      if (e.key === `tabletapy_dish_badges_${restData.id}` && e.newValue) {
        try {
          const updatedBadges = JSON.parse(e.newValue);
          setDishBadges(updatedBadges);
          setItems(prev => prev.map(item => ({
            ...item,
            badge: updatedBadges[item.id] || null
          })));
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [restData?.id]);

  // Real-time polling fallback: ensures customer device immediately clears settled bill if websocket dropped
  useEffect(() => {
    if (!restData?.id || !locationName) return;

    const syncOrders = async () => {
      try {
        const { data: latest } = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restData.id)
          .ilike('table_no', locationName)
          .order('created_at', { ascending: true });

        if (latest) {
          const activeOnly = latest.filter(o => o.payment_status !== 'PAID' && o.status !== 'CANCELLED');
          setTableOrders(prev => {
            const prevActive = prev.filter(o => o.payment_status !== 'PAID' && o.status !== 'CANCELLED');
            const prevSig = prevActive.map(o => `${o.id}_${o.payment_status}_${o.status}`).join(',');
            const nextSig = activeOnly.map(o => `${o.id}_${o.payment_status}_${o.status}`).join(',');
            if (prevSig !== nextSig) {
              const wasLegitimatelyPaid = latest.some(o => o.payment_status === 'PAID');
              if (activeOnly.length === 0 && prevActive.length > 0 && wasLegitimatelyPaid) {
                // Table was settled by cashier/owner: build settlement snapshot and transition to thank you
                const candidateOrders = prevActive.length > 0 ? prevActive : (lastActiveOrdersRef.current || []);
                if (candidateOrders.length > 0) {
                  const snapshot = buildSettlementSnapshot(candidateOrders, restData, locationName, promotionsConfigRef.current, customerCoinsBalanceRef.current);
                  setSettlementSnapshot(snapshot);
                }
                setIsBillModalOpen(false);
                setIsCartOpen(false);
                setSyncToast('Payment verified & settled! Thank you for dining with us.');
                setTimeout(() => setSyncToast(null), 4500);
              }
              return activeOnly;
            }
            return prev;
          });
        }
      } catch (err) {
        // silent polling catch
      }
    };

    const interval = setInterval(syncOrders, 3000);
    return () => clearInterval(interval);
  }, [restData?.id, locationName]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="animate-spin text-zinc-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 p-8 text-center">
        <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h1 className="text-3xl font-black mb-2 tracking-tight">Access Denied</h1>
        <p className="text-gray-500 font-medium mb-8 max-w-sm">{error}</p>
        <p className="text-xs text-gray-400">Please scan the correct QR code provided by the front desk or your server.</p>
      </div>
    );
  }

  // ─── HOTEL PORTAL ──────────────────────────────────────────────────────────
  if (businessType === 'HOTEL') {
    return (
      <HotelPortal
        restaurantId={restData?.id}
        hotelName={restData?.name || 'Hotel'}
        logoUrl={restData?.logo_url}
        items={allItems}
        theme={restData}
        roomNo={locationName}
      />
    );
  }

  // ─── FULL-SCREEN THANK YOU CELEBRATION (POST-SETTLEMENT VIEW) ───
  if (settlementSnapshot) {
    return (
      <ThankYouCelebrationView
        settlement={settlementSnapshot}
        primaryColor={theme.primary_color || '#E46254'}
      />
    );
  }

  // ─── RESTAURANT RUNNING TAB CALCULATIONS ──────────────────────────────────
  const cartTotal = cart.reduce((acc, curr) => acc + curr.price, 0);

  // Calculate live running table bill total across all active rounds
  // An order remains on the table bill until paid (payment_status === 'PAID') or cancelled
  const activeRunningOrders = tableOrders.filter(
    o => o.status !== 'CANCELLED' && o.payment_status !== 'PAID'
  );

  const runningTableSubtotal = activeRunningOrders.reduce((sum, o) => {
    const itemsTotal = (o.items_json || []).reduce((acc: number, curr: any) => acc + (curr.price || curr.item?.basePrice || 0) * (curr.quantity || 1), 0);
    return sum + (itemsTotal > 0 ? itemsTotal : Number(o.total) || 0);
  }, 0);
  const runningTableGST = Number((runningTableSubtotal * 0.05).toFixed(2));
  const runningGrandTotal = Number((runningTableSubtotal + runningTableGST).toFixed(2));

  const totalOrderedDishesCount = activeRunningOrders.reduce((sum, o) => {
    return sum + (o.items_json || []).reduce((acc: number, curr: any) => acc + (curr.quantity || 1), 0);
  }, 0);

  const updateCartAndBroadcast = (
    updater: (prev: { item: MenuItem; price: number }[]) => { item: MenuItem; price: number }[],
    meta?: { action: 'add' | 'remove' | 'clear' | 'order_placed'; itemName?: string }
  ) => {
    const nextCart = updater(cartRef.current);
    cartRef.current = nextCart;
    setCart(nextCart);

    const rId = restDataRef.current?.id || restData?.id || theme?.id;
    const lName = locationNameRef.current || locationName;

    // 1. Immediately persist locally to localStorage
    try {
      if (typeof window !== 'undefined' && rId && lName) {
        if (nextCart.length === 0) {
          localStorage.removeItem(`tabletapy_cart_${rId}_${lName}`);
        } else {
          localStorage.setItem(`tabletapy_cart_${rId}_${lName}`, JSON.stringify(nextCart));
        }
      }
    } catch {}

    const payload = {
      cart: nextCart,
      senderId: clientIdRef.current,
      senderName: customerName || 'Table guest',
      action: meta?.action || 'update',
      itemName: meta?.itemName,
      timestamp: Date.now()
    };

    // 2. Instant 0ms broadcast to tabs in the same browser via BroadcastChannel
    try {
      localBcRef.current?.postMessage(payload);
    } catch {}

    // 3. Supabase Realtime WebSocket broadcast to remote phones (<50ms)
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'cart_change',
          payload
        }).catch((err: any) => console.warn('Realtime cart send:', err));

        // Track presence with latest cart
        channelRef.current.track({
          clientId: clientIdRef.current,
          deviceId: clientIdRef.current,
          onlineAt: Date.now(),
          cart: nextCart,
        }).catch(() => {});
      } catch (err) {
        console.warn('Realtime channel dispatch exception:', err);
      }
    }
  };

  const handleUpdateQuantity = (item: MenuItem, delta: number) => {
    updateCartAndBroadcast(prev => {
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
    }, { action: delta > 0 ? 'add' : 'remove', itemName: item.name });
  };

function areItemListsIdentical(listA: any[], listB: any[]): boolean {
  if (!Array.isArray(listA) || !Array.isArray(listB)) return false;
  if (listA.length === 0 || listB.length === 0) return false;

  const countA = new Map<string, number>();
  const countB = new Map<string, number>();

  listA.forEach(entry => {
    const key = entry?.item?.id || entry?.item?.name || 'item';
    countA.set(key, (countA.get(key) || 0) + (entry.quantity || 1));
  });

  listB.forEach(entry => {
    const key = entry?.item?.id || entry?.item?.name || 'item';
    countB.set(key, (countB.get(key) || 0) + (entry.quantity || 1));
  });

  if (countA.size !== countB.size) return false;
  for (const [key, val] of countA.entries()) {
    if (countB.get(key) !== val) return false;
  }
  return true;
}

  // Place order round to the active table session
  const handlePlaceOrder = async (checkoutData: any) => {
    if (!theme) {
      setGuestAlertModal({ title: "Theme Error", message: "Restaurant configuration is missing or unavailable." });
      return false;
    }

    if (!cart || cart.length === 0) {
      setGuestAlertModal({ title: "Cart Empty", message: "Your cart is empty or was already submitted by your table partner!" });
      setIsCartOpen(false);
      return false;
    }

    // Anti-Fraud check: Ensure table session is not already settled
    // Anti-Fraud check: Ensure active celebration modal is not currently open
    if (settlementSnapshot) {
      setGuestAlertModal({
        title: "Dining Session Closed",
        message: "This dining session was settled. Please close the receipt view to place a new order."
      });
      return false;
    }
    
    try {
      // 0. Pre-flight check: Verify items in cart are not sold out (86'd)
      const cartItemIds = Array.from(new Set(cart.map(c => c.item.id).filter(Boolean)));
      if (cartItemIds.length > 0) {
        const { data: stockCheck } = await supabase
          .from('menu_items_v2')
          .select('id, name, is_available')
          .in('id', cartItemIds);

        const soldOutItems = (stockCheck || []).filter(item => !item.is_available);
        if (soldOutItems.length > 0) {
          const soldOutNames = soldOutItems.map(i => i.name).join(', ');
          setGuestAlertModal({ title: "Item Sold Out", message: `${soldOutNames} just sold out and cannot be prepared. We have removed it from your cart.` });
          // Remove sold out items from cart
          const soldOutIds = new Set(soldOutItems.map(i => i.id));
          updateCartAndBroadcast(prev => prev.filter(c => !soldOutIds.has(c.item.id)), { action: 'remove' });
          return false;
        }
      }

      // 1. Check if another guest at this table just submitted the exact same order in the last 2 minutes
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', theme.id)
        .eq('table_no', locationName)
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false })
        .limit(4);

      if (recentOrders && recentOrders.length > 0) {
        const isDuplicate = recentOrders.some(recent => {
          const ageSecs = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
          if (ageSecs > 150) return false;
          return areItemListsIdentical(recent.items_json, cart);
        });

        if (isDuplicate) {
          // Clear duplicate local cart and notify user
          setCart([]);
          cartRef.current = [];
          setIsCartOpen(false);
          try {
            localStorage.removeItem(`tabletapy_cart_${theme.id}_${locationName}`);
          } catch {}
          setTableOrders(recentOrders.filter(o => o.status !== 'CANCELLED'));
          setGuestAlertModal({ title: "Order Already Placed", message: "These exact items were just submitted by your table guest! We prevented a duplicate round from being added." });
          return false;
        }
      }

      // Determine session ID:
      // If table already has active, unpaid orders, this order is Round 2+ of the ongoing dining session!
      const activeExistingOrders = tableOrders.filter(o => o.payment_status !== 'PAID' && o.status !== 'CANCELLED');
      let currentSessionId: string;
      if (activeExistingOrders.length > 0) {
        const existingSessionId = extractSessionId(activeExistingOrders[0].note);
        currentSessionId = existingSessionId || `sess_${activeExistingOrders[0].id}`;
      } else {
        // Table is empty or previous visit was settled: generate a fresh unique session ID!
        currentSessionId = generateSessionId();
      }

      const noteWithSession = attachSessionToNote(checkoutData.note, currentSessionId);
      const roundTotal = Number((cartTotal * 1.05).toFixed(2));
      const payload = {
        restaurant_id: theme.id,
        total: roundTotal,
        status: 'PREPARING', // Instant Kitchen Auto-Fire verified by 4-digit physical Table PIN
        note: noteWithSession,
        items_json: cart,
        table_no: locationName,
        customer_name: checkoutData.name || customerName || '',
        customer_phone: checkoutData.phone || customerPhone || '',
        payment_method: checkoutData.payMethod || 'PAY_AT_END',
        payment_status: 'PENDING'
      };
      
      const response = await supabase.from('orders').insert(payload).select();
      
      if (response.error) {
        console.error("Order Insert Error:", response.error);
        setGuestAlertModal({ title: "Order Failed", message: `Failed to place order! Error: ${response.error.message}` });
        return false;
      } else {
        const insertedOrder = response.data[0];
        setTableOrders(prev => [...prev, insertedOrder]);
        
        // Explicitly clear local cart state, storage, and broadcast
        setCart([]);
        cartRef.current = [];
        setIsCartOpen(false);
        try {
          if (typeof window !== 'undefined' && locationName) {
            if (restData?.id) localStorage.removeItem(`tabletapy_cart_${restData.id}_${locationName}`);
            if (theme?.id) localStorage.removeItem(`tabletapy_cart_${theme.id}_${locationName}`);
          }
        } catch {}
        updateCartAndBroadcast(() => [], { action: 'order_placed' });
        channelRef.current?.track({
          clientId: clientIdRef.current,
          onlineAt: Date.now(),
          cart: []
        }).catch(() => {});
        
        // Show confirmation toast
        setOrderToast(`Round #${tableOrders.length + 1} sent to kitchen! Preparation started.`);
        setTimeout(() => setOrderToast(null), 4500);

        return insertedOrder.id;
      }
    } catch (err: any) {
      console.error("System Error:", err);
      setGuestAlertModal({ title: "System Exception", message: err.message });
      return false;
    }
  };

  // Concurrency Payment Lock Handlers
  const handleAcquirePaymentLock = async (method: 'UPI' | 'CASH'): Promise<boolean> => {
    const currentLock = activePaymentLockRef.current;
    const now = Date.now();
    // Check if another guest holds an active (non-expired) lock
    if (currentLock && currentLock.lockedByClientId !== clientIdRef.current && (now - currentLock.lockedAt < 75000)) {
      return false;
    }

    const lockPayload: PaymentLock = {
      lockedByClientId: clientIdRef.current,
      payerName: customerName || 'Table Guest',
      payerPhone: customerPhone || '',
      paymentMethod: method,
      lockedAt: now
    };

    setActivePaymentLock(lockPayload);
    activePaymentLockRef.current = lockPayload;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'payment_lock_acquired',
        payload: lockPayload
      });
    }

    // Persist payer phone and name to active orders in Supabase
    try {
      if (tableOrdersRef.current.length > 0 && customerPhone) {
        const cleanPhone = customerPhone.replace(/\D/g, '');
        const orderIds = tableOrdersRef.current.map(o => o.id);
        await supabase
          .from('orders')
          .update({
            customer_phone: cleanPhone,
            customer_name: customerName || 'Table Guest'
          })
          .in('id', orderIds);
      }
    } catch (err) {
      console.warn("Error persisting payer phone to orders:", err);
    }

    return true;
  };

  const handleReleasePaymentLock = async (): Promise<void> => {
    const currentLock = activePaymentLockRef.current;
    if (!currentLock || currentLock.lockedByClientId !== clientIdRef.current) {
      return;
    }

    setActivePaymentLock(null);
    activePaymentLockRef.current = null;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'payment_lock_released',
        payload: { releasedByClientId: clientIdRef.current }
      });
    }
  };

  const templateProps = {
    items,
    categories,
    primaryColor: theme.primary_color || '#111827',
    font: theme.font || 'Inter, sans-serif',
    radius: theme.radius || 'rounded',
    layoutMode: theme.menu_layout || 'list',
    restaurantName: theme.name || 'Menu',
    logoUrl: theme.logo_url,
    tableNo: locationName,
    bgColor: theme.bg_color || '#f9fafb',
    bgPattern: theme.bg_pattern || 'none',
    bgImage: theme.bg_image,
    cardStyle: theme.card_style || 'solid',
    cart,
    onUpdateQuantity: handleUpdateQuantity,
    onSelectItem: setSelectedItem,
    promotionsConfig,
    happyHourInfo,
    customerCoins: { balance: customerCoinsBalance }
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-y-auto no-scrollbar bg-white">
      <MenuTemplate {...templateProps} />

      {/* 4-DIGIT TABLE SAFETY PIN UNLOCK MODAL */}
      <TableUnlockModal
        isOpen={!isTableUnlocked}
        tableNo={locationName}
        expectedPin={tableSessionPin}
        restaurantName={restData?.name || theme.name || 'Restaurant'}
        primaryColor={templateProps.primaryColor}
        onUnlock={(details) => {
          setCustomerName(details.name);
          setCustomerPhone(details.phone);
          setIsTableUnlocked(true);

          try {
            const cleanTable = (locationName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            sessionStorage.setItem(`tabletapy_unlock_${restData?.id || theme.id}_${cleanTable}`, JSON.stringify(details));
          } catch {}

          if ((restData?.id || theme.id) && details.phone) {
            const cleanPhone = details.phone.replace(/\D/g, '');
            const stored = localStorage.getItem(`tabletapy_customer_coins_${restData?.id || theme.id}_${cleanPhone}`);
            setCustomerCoinsBalance(stored ? Number(stored) || 0 : 0);
          }

          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'cart_change',
              payload: {
                action: 'guest_joined',
                senderName: details.name,
                senderId: clientIdRef.current,
                timestamp: Date.now()
              }
            });
          }
        }}
      />

      {/* REAL-TIME LIVE PRESENCE BADGE (Top Right) */}
      {activeGuestsCount > 1 && (
        <div className="fixed top-3 right-3 z-30 pointer-events-none animate-in fade-in duration-300">
          <div className="bg-zinc-900/80 backdrop-blur-md text-white/90 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Users size={12} className="text-emerald-400" />
            <span>{activeGuestsCount} guests ordering</span>
          </div>
        </div>
      )}

      {/* REAL-TIME COLLABORATIVE CART UPDATE TOAST */}
      {syncToast && (
        <div className="fixed top-5 left-0 right-0 px-4 z-50 flex justify-center pointer-events-none animate-in slide-in-from-top-3 fade-in duration-200">
          <div className="bg-zinc-900/95 backdrop-blur-md text-white text-[12.5px] font-semibold px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>{syncToast}</span>
          </div>
        </div>
      )}

      {/* ORDER PLACED CONFIRMATION TOAST */}
      {orderToast && (
        <div className="fixed top-5 left-0 right-0 px-4 z-50 flex justify-center animate-in slide-in-from-top-3 duration-200">
          <div className="bg-zinc-900/95 backdrop-blur-md text-white text-[13px] font-medium px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-white/10 max-w-sm">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{orderToast}</span>
          </div>
        </div>
      )}

      {/* PERSISTENT RUNNING TAB / CART FLOATING DOCK */}
      <div className="fixed bottom-5 left-0 right-0 px-4 z-40 flex justify-center pointer-events-none">
        <div className="w-full max-w-md pointer-events-auto flex flex-col gap-2">
          
          {/* Real-time sync hint when multiple guests are ordering together */}
          {activeGuestsCount > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-0.5 text-[10.5px] font-medium text-zinc-500 bg-white/70 backdrop-blur-xs rounded-full border border-zinc-200/50 shadow-xs mx-auto px-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Shared table cart · {activeGuestsCount} guests connected</span>
            </div>
          )}

          {/* Unified Intelligent Bottom Command Bar */}
          {(() => {
            const activeTableOrders = tableOrders.filter(
              o => o.status !== 'CANCELLED' && o.payment_status !== 'PAID'
            );
            const hasActive = activeTableOrders.length > 0;
            const hasCart = cart.length > 0;

            if (!hasActive && !hasCart) return null;

            const isCashRequested = activeTableOrders.some(o => o.payment_status === 'CASH_REQUESTED');
            const isUpiPending = activeTableOrders.some(o => o.payment_status === 'UPI_VERIFICATION_PENDING');

            // Scenario 1: Table has active dining session AND customer has new dishes in cart for Round 2+
            if (hasActive && hasCart) {
              return (
                <div className="bg-zinc-950/95 backdrop-blur-xl text-white rounded-3xl p-3 shadow-2xl border border-white/10 flex flex-col gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
                  {/* Top Row: Running table tab summary */}
                  <div className="flex items-center justify-between px-2 pt-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="text-[12px] font-bold text-zinc-300 truncate">
                        Table {locationName} • Live Tab: <strong className="text-white tabular-nums">₹{runningGrandTotal.toFixed(2)}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBillModalOpen(true)}
                      className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/15 text-white font-bold text-[11px] border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                    >
                      <Receipt size={12} />
                      <span>View Bill</span>
                    </button>
                  </div>

                  {/* Bottom Row: Primary Round 2 Action */}
                  <button
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
                      setIsCartOpen(true);
                    }}
                    className="w-full py-3.5 px-4 flex justify-between items-center text-white font-extrabold transition-all rounded-2xl shadow-md active:scale-[0.99] cursor-pointer hover:opacity-95"
                    style={{ backgroundColor: templateProps.primaryColor }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center text-[11px] font-black rounded-full bg-white/20">
                        {cart.length}
                      </span>
                      <span className="text-[13px] tracking-wide">
                        Review Round #{tableOrders.length + 1}
                      </span>
                    </div>
                    <span className="text-[14px] tabular-nums font-bold">
                      ₹{cartTotal.toFixed(2)}
                    </span>
                  </button>
                </div>
              );
            }

            // Scenario 2: Active dining session, cart is empty -> Full-width prominent black checkout & pay button
            if (hasActive && !hasCart) {
              const isHeldByOtherGuest = Boolean(
                activePaymentLock &&
                clientIdRef.current &&
                activePaymentLock.lockedByClientId !== clientIdRef.current &&
                (Date.now() - activePaymentLock.lockedAt < 75000)
              );

              if (isHeldByOtherGuest && activePaymentLock) {
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
                      setIsBillModalOpen(true);
                    }}
                    className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white rounded-2xl shadow-xl flex items-center justify-between gap-3.5 transition-all cursor-pointer animate-in slide-in-from-bottom-3 duration-200"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 text-left">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-xs">
                        <Clock size={18} className="animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[14px] font-black tracking-tight text-white truncate">
                          Payment in Progress by {activePaymentLock.payerName}
                        </h4>
                        <p className="text-[11.5px] text-amber-100 font-medium truncate mt-0.5">
                          Settle via {activePaymentLock.paymentMethod === 'CASH' ? 'Cash' : 'UPI'} • Tap to view bill
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-[16px] font-black tabular-nums text-white bg-white/20 px-2.5 py-1 rounded-xl">
                        ₹{runningGrandTotal.toFixed(2)}
                      </span>
                      <ArrowRight size={18} className="text-white/80" />
                    </div>
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
                    setIsBillModalOpen(true);
                  }}
                  className="w-full py-3.5 px-5 bg-zinc-950 hover:bg-black active:scale-[0.99] text-white rounded-2xl shadow-2xl border border-zinc-800/90 flex items-center justify-between gap-3.5 transition-all cursor-pointer group animate-in slide-in-from-bottom-3 duration-200"
                >
                  <div className="flex items-center gap-3.5 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/10 shadow-xs group-hover:scale-105 transition-transform">
                      <Receipt size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-black tracking-tight text-white truncate">
                        {isCashRequested
                          ? (billingMode === 'STAFF_ASSISTED' ? 'Bill Requested • Captain En Route' : 'Cash Waiter Called')
                          : isUpiPending
                          ? 'Verifying UPI Payment'
                          : 'View Table Bill & Settle'}
                      </h4>
                      <p className="text-[11.5px] text-zinc-400 font-medium truncate mt-0.5">
                        Table {locationName} • {totalOrderedDishesCount} {totalOrderedDishesCount === 1 ? 'dish' : 'dishes'} ordered
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-[16px] font-black tabular-nums text-emerald-400">
                      ₹{runningGrandTotal.toFixed(2)}
                    </span>
                    <ArrowRight size={18} className="text-zinc-400 group-hover:translate-x-1 group-hover:text-white transition-all" />
                  </div>
                </button>
              );
            }

            // Scenario 3: Fresh table, customer has items in cart for Round 1
            return (
              <button 
                onClick={() => { 
                  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30); 
                  setIsCartOpen(true); 
                }}
                className="w-full py-3.5 px-5 flex justify-between items-center text-white font-bold transition-all rounded-2xl shadow-xl active:scale-[0.99] cursor-pointer hover:opacity-95 animate-in slide-in-from-bottom-3 duration-200"
                style={{ backgroundColor: templateProps.primaryColor }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 flex items-center justify-center text-xs font-black rounded-full bg-white/20">
                    {cart.length}
                  </div>
                  <span className="text-[13px] tracking-wide">
                    REVIEW ORDER ({cart.length} {cart.length === 1 ? 'ITEM' : 'ITEMS'})
                  </span>
                </div>
                <span className="text-[14px] font-semibold tabular-nums">
                  ₹{cartTotal.toFixed(2)}
                </span>
              </button>
            );
          })()}

        </div>
      </div>

      {/* MODALS */}
      <ModifiersSheet 
        item={selectedItem} 
        primaryColor={templateProps.primaryColor} 
        radius={templateProps.radius} 
        cardStyle={theme.card_style} 
        onClose={() => setSelectedItem(null)} 
        onAddToCart={(item: MenuItem, price: number) => { 
          updateCartAndBroadcast(prev => [...prev, { item, price }], { action: 'add', itemName: item.name }); 
          setSelectedItem(null); 
        }} 
      />

      <CartSheet 
        businessType={businessType} 
        isOpen={isCartOpen} 
        orderStatus="NEW" 
        cart={cart} 
        primaryColor={templateProps.primaryColor} 
        radius={templateProps.radius} 
        cardStyle={theme.card_style} 
        hasActiveSession={tableOrders.length > 0}
        roundNumber={tableOrders.length + 1}
        savedCustomerName={customerName || tableOrders[0]?.customer_name || ''}
        savedCustomerPhone={customerPhone || tableOrders[0]?.customer_phone || ''}
        promotionsConfig={promotionsConfig}
        restaurantId={restData?.id}
        restaurantName={restData?.name || theme?.name || 'Restaurant'}
        tableNo={locationName}
        onClose={() => setIsCartOpen(false)} 
        onClearCart={() => updateCartAndBroadcast(() => [], { action: 'clear' })} 
        onPlaceOrder={handlePlaceOrder}
        onOpenBill={() => setIsBillModalOpen(true)}
        onUpdateQuantity={handleUpdateQuantity}
        runningGrandTotal={runningGrandTotal}
        activeRoundsCount={tableOrders.length}
      />

      {isBillModalOpen && (
        <DigitalBillModal 
          key={tableOrders.map(o => o.id).join('_') || 'bill_modal'}
          isOpen={isBillModalOpen} 
          onClose={() => setIsBillModalOpen(false)} 
          restaurantId={restData?.id} 
          restaurantName={restData?.name} 
          tableNo={locationName} 
          orders={tableOrders} 
          upiId={restData?.upi_id || restData?.upi_vpa}
          promotionsConfig={promotionsConfig}
          customerPhone={customerPhone || tableOrders[0]?.customer_phone || ''}
          customerName={customerName || tableOrders[0]?.customer_name || ''}
          clientId={clientIdRef.current}
          activePaymentLock={activePaymentLock}
          onAcquireLock={handleAcquirePaymentLock}
          onReleaseLock={handleReleasePaymentLock}
          billingMode={billingMode}
          onPaymentSettled={(snapshot) => {
            if (snapshot) {
              setSettlementSnapshot(snapshot);
            }
            setIsBillModalOpen(false);
            setTableOrders([]);
            setCart([]);
            cartRef.current = [];
          }} 
        />
      )}

      {/* Guest Alert Popup Dialog */}
      {guestAlertModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <AlertCircle size={24} />
            </div>
            <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">{guestAlertModal.title}</h4>
            <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
              {guestAlertModal.message}
            </p>
            <button
              onClick={() => setGuestAlertModal(null)}
              className="mt-5 w-full py-3 bg-zinc-900 hover:bg-black text-white font-bold rounded-2xl text-[13px] shadow-sm transition-all cursor-pointer active:scale-95"
            >
              OK, Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
