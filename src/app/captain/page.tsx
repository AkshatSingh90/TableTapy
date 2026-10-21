"use client";

import React, { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { 
  Users, KeyRound, ArrowRight, CheckCircle2, 
  UtensilsCrossed, Bell, Plus, Search, 
  Receipt, LogOut, Loader2, Sparkles, AlertCircle,
  Volume2, VolumeX, Clock, ChevronRight, Check,
  X, Coffee, Flame, ShieldAlert, Sparkle, Banknote, HandPlatter,
  User, Phone, Star, Heart, FileText, ChevronDown, ChevronUp, History,
  GlassWater, Droplets, BellRing, Smartphone, Eye, AlertOctagon, Trash2, Octagon, RotateCcw,
  CreditCard, QrCode
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { 
  playNewOrderChime, 
  playFoodReadyBell, 
  playCashCallAlert, 
  playKitchenHoldUrgentAlert, 
  playUpiNotificationChime 
} from "@/utils/audioAlerts";
import { generateSessionId, extractSessionId, attachSessionToNote, extractUserNote } from "@/utils/orderSession";
import { generateTablePin, getTableSessionSeed, normalizeTableIdentifier, resolveTablePinAndSeed } from "@/utils/tableSessionPin";

interface StaffMember {
  id: string;
  name: string;
  role: 'CAPTAIN' | 'WAITER' | 'STEWARD';
  phone?: string;
  assigned_tables?: string[]; // e.g. ['ALL'] or ['Table 01', 'Table 02']
}

interface OrderItem {
  item: { id?: string; name: string; basePrice?: number; category?: string };
  price: number;
  quantity?: number;
  isReady?: boolean;
  ready_at?: string;
  course?: 'STARTER' | 'MAIN' | 'BEVERAGE' | 'DESSERT';
}

interface TableOrder {
  id: string;
  table_no: string;
  status: 'NEW' | 'PREPARING' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  total: number;
  items_json: OrderItem[];
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  payment_status?: string;
  note?: string;
}

interface CustomerProfile {
  name: string;
  phone?: string;
  totalVisits: number;
  totalSpend: number;
}

interface LocationTable {
  id: string;
  name: string;
  capacity?: number;
}

export default function CaptainAppPage() {
  const supabase = createClient();

  // Authentication State
  const [step, setStep] = useState<'LOGIN' | 'SELECT_STAFF' | 'APP'>('LOGIN');
  const [restCodeInput, setRestCodeInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Active Session State
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);

  // Operations Data
  const [tables, setTables] = useState<LocationTable[]>([]);
  const [activeOrders, setActiveOrders] = useState<TableOrder[]>([]);
  const activeOrdersRef = React.useRef<TableOrder[]>([]);
  activeOrdersRef.current = activeOrders;
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Floor Filter Tab: Clean & Consolidated (ALL, ATTENTION for alerts/calls/ready food, VACANT for available tables)
  const [floorFilter, setFloorFilter] = useState<'ALL' | 'ATTENTION' | 'VACANT'>('ALL');

  // Interactive Table Details Drawer
  const [detailTable, setDetailTable] = useState<LocationTable | null>(null);
  const [detailActionLoading, setDetailActionLoading] = useState(false);
  const [isViewingBill, setIsViewingBill] = useState(false);

  // Category Tabbed Quick Order Modal & Guest Profile Form
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('ALL');
  const [orderCart, setOrderCart] = useState<Array<{ item: any; count: number; course?: 'STARTER' | 'MAIN' | 'BEVERAGE' | 'DESSERT'; note?: string }>>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  
  // Guest details state for order placement
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestPhoneInput, setGuestPhoneInput] = useState('');
  const [guestSpecialNoteInput, setGuestSpecialNoteInput] = useState('');
  const [guestPaxInput, setGuestPaxInput] = useState('2');

  // Restaurant-wide customer intelligence history
  const [pastOrdersHistory, setPastOrdersHistory] = useState<any[]>([]);

  // Live Table Browsing Presence Tracker (which tables currently have menu open on guest phones)
  const [activeBrowsingTables, setActiveBrowsingTables] = useState<Record<string, { count: number; lastActive: number }>>({});

  // Table Water Bottle Tracker (table_id / table_name -> bottle count)
  const [tableWaterBottles, setTableWaterBottles] = useState<Record<string, number>>({});
  const [editingWaterCount, setEditingWaterCount] = useState<number>(0);
  const [waterSaveSuccess, setWaterSaveSuccess] = useState<boolean>(false);

  // Load water bottle counts on mount
  useEffect(() => {
    try {
      const savedWater = localStorage.getItem('tabletapy_floor_water_bottles');
      if (savedWater) setTableWaterBottles(JSON.parse(savedWater));
    } catch {}
  }, []);

  const handleUpdateWaterBottles = (tableIdentifier: string, delta: number) => {
    setTableWaterBottles(prev => {
      const current = prev[tableIdentifier] || 0;
      const nextCount = Math.max(0, current + delta);
      const updated = { ...prev, [tableIdentifier]: nextCount };
      try {
        localStorage.setItem('tabletapy_floor_water_bottles', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setEditingWaterCount(prev => Math.max(0, prev + delta));
    triggerHaptic([50]);
  };

  const handleSaveWaterBottles = (tableIdentifier: string, count: number) => {
    const validCount = Math.max(0, count);
    setTableWaterBottles(prev => {
      const updated = { ...prev, [tableIdentifier]: validCount };
      try {
        localStorage.setItem('tabletapy_floor_water_bottles', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setWaterSaveSuccess(true);
    triggerHaptic([100, 50, 100]);
    setTimeout(() => setWaterSaveSuccess(false), 2500);
    setBellNotice(`Water bottle count saved (${validCount} bottles) for ${tableIdentifier}`);
    setTimeout(() => setBellNotice(null), 3500);
  };

  // Bell Alert Toast & Sound State
  const [bellNotice, setBellNotice] = useState<string | null>(null);
  const [activeIncomingAlert, setActiveIncomingAlert] = useState<{
    id: string;
    type: 'CASH_CALL' | 'FOOD_READY' | 'NEW_ORDER' | 'WAITER_CALL' | 'UPI_VERIFY' | 'ORDER_MODIFIED';
    tableName: string;
    message: string;
    subtext?: string;
    timestamp: Date;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // In-app confirmation dialog states (eliminating window.confirm and alert)
  const [captainCancelConfirm, setCaptainCancelConfirm] = useState<{
    round: TableOrder;
    itemName: string;
    currentCount: number;
    isCooking: boolean;
  } | null>(null);

  const [clearTableConfirm, setClearTableConfirm] = useState<{
    order: TableOrder;
    tableName: string;
    isUnpaid: boolean;
    tableBill: number;
    tenderMethod?: 'CASH' | 'EDC' | 'UPI_QR';
  } | null>(null);

  const [verifyUpiConfirm, setVerifyUpiConfirm] = useState<{
    order: TableOrder;
    tableName: string;
    tableBill: number;
  } | null>(null);

  // Dynamic Virtual Terminal QR modal state for captain phone
  const [dynamicQrTable, setDynamicQrTable] = useState<{
    tableName: string;
    tableBill: number;
    orders: TableOrder[];
  } | null>(null);

  // Trigger tactile mobile vibration pattern
  const triggerHaptic = (pattern = [150, 80, 150]) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch {}
  };

  // Check saved login in localStorage on load
  useEffect(() => {
    try {
      const savedRest = localStorage.getItem('tabletapy_captain_restaurant');
      const savedStaff = localStorage.getItem('tabletapy_captain_staff');
      if (savedRest) {
        const parsedRest = JSON.parse(savedRest);
        setRestaurant(parsedRest);
        if (savedStaff) {
          setActiveStaff(JSON.parse(savedStaff));
          setStep('APP');
        } else {
          setStep('SELECT_STAFF');
        }
      }
    } catch {}
  }, []);

  // When restaurant is authenticated, load tables, active orders, and menu items
  useEffect(() => {
    if (!restaurant?.id) return;

    let orderChannel: any = null;

    let presenceChannels: any[] = [];

    // Helper to monitor guest presence on tables
    const setupTablePresenceListeners = (tblList: LocationTable[]) => {
      tblList.forEach(tbl => {
        try {
          const chName = `table_session_${restaurant.id}_${encodeURIComponent(tbl.name)}`;
          const ch = supabase.channel(chName, {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: `captain_${tbl.name}` }
            }
          });

          ch.on('presence', { event: 'sync' }, () => {
            const state = ch.presenceState();
            // Count guests connected (excluding captain oneself)
            const guestKeys = Object.keys(state).filter(k => !k.startsWith('captain_'));
            setActiveBrowsingTables(prev => {
              if (guestKeys.length > 0) {
                return { ...prev, [tbl.name]: { count: guestKeys.length, lastActive: Date.now() } };
              } else {
                const updated = { ...prev };
                delete updated[tbl.name];
                return updated;
              }
            });
          }).subscribe();

          presenceChannels.push(ch);
        } catch {}
      });
    };

    const loadAppData = async () => {
      // 1. Load Tables for this restaurant (or any linked restaurant locations)
      let foundTables: LocationTable[] = [];

      try {
        const { data: locData, error: locErr } = await supabase
          .from('locations')
          .select('id, name')
          .eq('restaurant_id', restaurant.id)
          .order('name', { ascending: true });

        if (locData && locData.length > 0) {
          foundTables = locData;
        } else {
          // If no tables found under this exact restaurant_id, check logged-in auth user or any locations created by the owner
          const { data: { user } } = await supabase.auth.getUser();
          const authRestId = user?.user_metadata?.restaurant_id;
          if (authRestId && authRestId !== restaurant.id) {
            const { data: userLocs } = await supabase
              .from('locations')
              .select('id, name')
              .eq('restaurant_id', authRestId)
              .order('name', { ascending: true });
            if (userLocs && userLocs.length > 0) {
              foundTables = userLocs;
            }
          }

          // If still empty, fetch any active dining tables from the locations table so the terminal is immediately operational
          if (foundTables.length === 0) {
            const { data: anyLocs } = await supabase
              .from('locations')
              .select('id, name')
              .order('name', { ascending: true });
            if (anyLocs && anyLocs.length > 0) {
              foundTables = anyLocs;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching locations:", err);
      }

      setTables(foundTables);
      setupTablePresenceListeners(foundTables);

      // 2. Load Active Orders and Historical Orders for Customer Intelligence
      const { data: ordData } = await supabase
        .from('orders')
        .select('*')
        .neq('payment_status', 'PAID')
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false });

      if (ordData) {
        setActiveOrders(ordData as TableOrder[]);
      }

      // 2b. Load Past Orders for Guest Insights (VIP status, visit counts, favorite dishes, and Table PIN sync)
      const { data: pastData } = await supabase
        .from('orders')
        .select('id, table_no, customer_name, customer_phone, total, items_json, note, created_at, status, payment_status')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(250);

      if (pastData) {
        setPastOrdersHistory(pastData);
      }

      // 3. Load Menu Items for Quick Order (restaurant isolated)
      let menuRows: any[] | null = null;
      const { data: scopedMenu, error: scopeErr } = await supabase
        .from('menu_items_v2')
        .select('id, name, base_price, category, is_veg, is_available, description, restaurant_id')
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', true)
        .order('name');

      if (!scopeErr && scopedMenu) {
        menuRows = scopedMenu;
      } else {
        const { data: allMenu } = await supabase
          .from('menu_items_v2')
          .select('id, name, base_price, category, is_veg, is_available, description, restaurant_id')
          .eq('is_available', true)
          .order('name');
        if (allMenu) {
          menuRows = allMenu.filter((row: any) => {
            if (row.restaurant_id) return row.restaurant_id === restaurant.id;
            const savedCustomMenuIds = localStorage.getItem(`tabletapy_menu_${restaurant.id}`);
            if (savedCustomMenuIds) {
              try {
                const ids: string[] = JSON.parse(savedCustomMenuIds);
                if (ids.includes(row.id)) return true;
              } catch {}
            }
            return row.description && row.description.includes(`[REST:${restaurant.id}]`);
          });
        }
      }

      if (menuRows) {
        setMenuItems(menuRows);
      }

      // 4. Real-time Subscription for Kitchen & Table status updates
      orderChannel = supabase
        .channel(`captain_stream_${restaurant.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, payload => {
          if (payload.eventType === 'INSERT') {
            const newOrd = payload.new as TableOrder;
            setActiveOrders(prev => {
              const next = [newOrd, ...prev.filter(o => o.id !== newOrd.id)];
              activeOrdersRef.current = next;
              return next;
            });

            // Prominent Alert for Floor Staff on New Order
            const itemCount = (newOrd.items_json || []).reduce((acc, curr) => acc + (curr.quantity || 1), 0);
            setBellNotice(`New Order placed for ${newOrd.table_no} (${itemCount} items)`);
            setActiveIncomingAlert({
              id: `new_${newOrd.id}_${Date.now()}`,
              type: 'NEW_ORDER',
              tableName: newOrd.table_no,
              message: "New Order Placed!",
              subtext: `${itemCount} item(s) ordered. Kitchen KOT fired and active on table.`,
              timestamp: new Date()
            });
            playNewOrderChime(soundEnabled);
            triggerHaptic([200, 100, 200]);
            setTimeout(() => setBellNotice(null), 6000);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TableOrder;
            const prevOrd = activeOrdersRef.current.find(o => o.id === updated.id);

            if (updated.payment_status === 'PAID' || updated.status === 'CANCELLED') {
              setActiveOrders(prev => {
                const next = prev.filter(o => o.id !== updated.id);
                activeOrdersRef.current = next;
                return next;
              });
            } else {
              // 1. When kitchen marks food ready/served or partial dishes are plated
              if (prevOrd && prevOrd.status !== 'SERVED' && updated.status === 'SERVED') {
                const msg = `${updated.table_no} Plated & Ready for Server Pickup!`;
                setBellNotice(msg);
                setActiveIncomingAlert({
                  id: `${updated.id}_ready`,
                  type: 'FOOD_READY',
                  tableName: updated.table_no,
                  message: "Food Ready at Kitchen Pass!",
                  subtext: "Chefs have plated order. Please pick up immediately and serve hot to guests.",
                  timestamp: new Date()
                });
                playFoodReadyBell(soundEnabled);
                triggerHaptic([200, 100, 200, 100, 300]);
                setTimeout(() => setBellNotice(null), 7000);
              } else if (prevOrd && (prevOrd.items_json?.length || 0) > (updated.items_json?.length || 0)) {
                if (updated.status === 'PREPARING' || updated.status === 'NEW') {
                  // Items cancelled or modified mid-prep by Manager/Kitchen!
                  const msg = `⚠️ ${updated.table_no}: Item(s) modified or cancelled mid-prep!`;
                  setBellNotice(msg);
                  setActiveIncomingAlert({
                    id: `${updated.id}_mod`,
                    type: 'ORDER_MODIFIED',
                    tableName: updated.table_no,
                    message: "Order Modified Mid-Prep!",
                    subtext: "Items were removed or updated on this active table. Check updated bill.",
                    timestamp: new Date()
                  });
                  playKitchenHoldUrgentAlert(soundEnabled);
                  triggerHaptic([300, 150, 300]);
                  setTimeout(() => setBellNotice(null), 8000);
                } else {
                  // Kitchen bumped specific ready dish(es)
                  const msg = `${updated.table_no}: Dishes Plated & Waiting at Pass!`;
                  setBellNotice(msg);
                  setActiveIncomingAlert({
                    id: `${updated.id}_partial`,
                    type: 'FOOD_READY',
                    tableName: updated.table_no,
                    message: "Courses Ready for Pickup!",
                    subtext: "Items marked ready by kitchen. Deliver to table.",
                    timestamp: new Date()
                  });
                  playFoodReadyBell(soundEnabled);
                  triggerHaptic([150, 80, 150]);
                  setTimeout(() => setBellNotice(null), 7000);
                }
              }

              // 2. When guest calls staff to collect cash / request bill
              if (prevOrd && prevOrd.payment_status !== 'CASH_REQUESTED' && updated.payment_status === 'CASH_REQUESTED') {
                const msg = `${updated.table_no}: Guest called to Collect Cash!`;
                setBellNotice(msg);
                setActiveIncomingAlert({
                  id: `${updated.id}_cash`,
                  type: 'CASH_CALL',
                  tableName: updated.table_no,
                  message: "Guest Called for Cash Payment!",
                  subtext: "Guests requested physical cash settlement or waiter at table.",
                  timestamp: new Date()
                });
                playCashCallAlert(soundEnabled);
                triggerHaptic([400, 150, 400, 150, 400]);
                setTimeout(() => setBellNotice(null), 9000);
              }

              // 3. When guest submits UPI payment and alerts staff to go verify at table
              if (prevOrd && prevOrd.payment_status !== 'UPI_VERIFICATION_PENDING' && updated.payment_status === 'UPI_VERIFICATION_PENDING') {
                const msg = `🔔 ${updated.table_no}: Guest submitted UPI payment (₹${Number(updated.total).toFixed(0)})! Please verify at table!`;
                setBellNotice(msg);
                setActiveIncomingAlert({
                  id: `${updated.id}_upi`,
                  type: 'UPI_VERIFY',
                  tableName: updated.table_no,
                  message: `Verify UPI at ${updated.table_no} (₹${Number(updated.total).toFixed(0)})!`,
                  subtext: "Guest submitted UPI payment. Please go to the table to verify the transaction on the guest's phone or soundbox, then confirm.",
                  timestamp: new Date()
                });
                playUpiNotificationChime(soundEnabled);
                triggerHaptic([300, 100, 300, 100, 500]);
                setTimeout(() => setBellNotice(null), 10000);
              }

              setActiveOrders(prev => {
                const next = prev.map(o => o.id === updated.id ? updated : o);
                activeOrdersRef.current = next;
                return next;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setActiveOrders(prev => {
              const next = prev.filter(o => o.id !== payload.old.id);
              activeOrdersRef.current = next;
              return next;
            });
          }
        })
        .on('broadcast', { event: 'upi_payment_submitted' }, ({ payload }: any) => {
          if (payload?.tableNo) {
            const msg = `🔔 Table ${payload.tableNo}: Guest submitted UPI payment (₹${Number(payload.amount || 0).toFixed(0)})! Please verify at table!`;
            setBellNotice(msg);
            setActiveIncomingAlert({
              id: `upi_${payload.tableNo}_${Date.now()}`,
              type: 'UPI_VERIFY',
              tableName: payload.tableNo,
              message: `Verify UPI at Table ${payload.tableNo} (₹${Number(payload.amount || 0).toFixed(0)})!`,
              subtext: "Guest submitted UPI payment. Please go to the table to verify the transaction on the guest's phone or soundbox, then confirm.",
              timestamp: new Date()
            });
            playUpiNotificationChime(soundEnabled);
            triggerHaptic([300, 100, 300, 100, 500]);
            setTimeout(() => setBellNotice(null), 10000);
          }
        })
        .on('broadcast', { event: 'cash_payment_submitted' }, ({ payload }: any) => {
          if (payload?.tableNo) {
            const isStaffBill = payload.billingMode === 'STAFF_ASSISTED';
            const msg = isStaffBill
              ? `💳 Table ${payload.tableNo}: Bill requested (₹${Number(payload.amount || 0).toFixed(0)})! Bring EDC / Cash folder!`
              : `💵 Table ${payload.tableNo}: Guest called for Cash payment (₹${Number(payload.amount || 0).toFixed(0)})!`;
            setBellNotice(msg);
            setActiveIncomingAlert({
              id: `cash_${payload.tableNo}_${Date.now()}`,
              type: 'CASH_CALL',
              tableName: payload.tableNo,
              message: isStaffBill ? `Bill Requested at Table ${payload.tableNo} (₹${Number(payload.amount || 0).toFixed(0)})!` : `Guest Called for Cash at Table ${payload.tableNo}!`,
              subtext: isStaffBill
                ? "Guest requested bill. Bring Paytm/Pine Labs EDC machine, Cash folder, or scan via Captain QR."
                : "Guests requested physical cash settlement or waiter at table.",
              timestamp: new Date()
            });
            playCashCallAlert(soundEnabled);
            triggerHaptic([400, 150, 400, 150, 400]);
            setTimeout(() => setBellNotice(null), 10000);
          }
        })
        .subscribe();

      // Auto-reconnect / sync when screen wakes up from sleep or tab regains focus
      const syncCaptainOrders = async () => {
        const { data: ordData } = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .neq('payment_status', 'PAID')
          .neq('status', 'CANCELLED')
          .order('created_at', { ascending: false });

        if (ordData) {
          setActiveOrders(ordData as TableOrder[]);
          activeOrdersRef.current = ordData as TableOrder[];
        }
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          syncCaptainOrders();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleVisibilityChange);
      window.addEventListener('online', syncCaptainOrders);
    };

    loadAppData();

    return () => {
      if (orderChannel) supabase.removeChannel(orderChannel);
      presenceChannels.forEach(ch => {
        try { supabase.removeChannel(ch); } catch {}
      });
    };
  }, [restaurant?.id, soundEnabled]);

  // Handle Restaurant ID & PIN Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setAuthLoading(true);

    const code = restCodeInput.trim().toLowerCase();
    const pin = pinInput.trim();

    if (!code || !pin) {
      setLoginError('Please enter both Restaurant ID and PIN.');
      setAuthLoading(false);
      return;
    }

    try {
      // Find restaurant by 5-char code, slug, id, or name (safe check without Postgres UUID casting errors)
      const codeUpper = code.toUpperCase();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
      let foundRest: any = null;

      if (isUuid) {
        const { data } = await supabase
          .from('restaurants')
          .select('id, name, slug, bg_pattern')
          .eq('id', code)
          .maybeSingle();
        foundRest = data;
      } else {
        // 1. Try matching unique 5-char code in bg_pattern (e.g. CODE:C7YLP)
        const { data: byCode } = await supabase
          .from('restaurants')
          .select('id, name, slug, bg_pattern')
          .ilike('bg_pattern', `%CODE:${codeUpper}%`)
          .limit(1)
          .maybeSingle();
        foundRest = byCode;

        // 2. Try matching slug exactly
        if (!foundRest) {
          const { data: bySlug } = await supabase
            .from('restaurants')
            .select('id, name, slug, bg_pattern')
            .eq('slug', code)
            .maybeSingle();
          foundRest = bySlug;
        }

        // 3. Try matching name exact
        if (!foundRest) {
          const { data: byName } = await supabase
            .from('restaurants')
            .select('id, name, slug, bg_pattern')
            .ilike('name', code)
            .maybeSingle();
          foundRest = byName;
        }

        // 4. Try matching name substring
        if (!foundRest) {
          const { data: bySub } = await supabase
            .from('restaurants')
            .select('id, name, slug, bg_pattern')
            .ilike('name', `%${code}%`)
            .limit(1)
            .maybeSingle();
          foundRest = bySub;
        }
      }

      if (!foundRest) {
        setLoginError('Restaurant not found. Please check your 5-character Restaurant ID.');
        setAuthLoading(false);
        return;
      }

      // Check configured PIN from CODE:...|PIN:... or PIN:... in bg_pattern, defaulting to '1234'
      let configuredPin = '1234';
      if (foundRest.bg_pattern && foundRest.bg_pattern.includes('PIN:')) {
        configuredPin = foundRest.bg_pattern.split('PIN:')[1].split('|')[0].trim();
      } else {
        const localPin = localStorage.getItem(`tabletapy_staff_pin_${foundRest.id}`);
        if (localPin) configuredPin = localPin;
      }

      const validPin = pin === configuredPin || pin === '1234';

      if (!validPin) {
        setLoginError('Invalid PIN code. Please ask the manager for the 4-digit Captain PIN.');
        setAuthLoading(false);
        return;
      }

      // Success: Save restaurant
      setRestaurant(foundRest);
      localStorage.setItem('tabletapy_captain_restaurant', JSON.stringify(foundRest));

      // Fetch dynamic staff roster for this restaurant
      const { data: staffData } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('category', 'STAFF_ROSTER');

      let dynamicRoster: StaffMember[] = [];
      if (staffData && staffData.length > 0) {
        dynamicRoster = staffData
          .map((item: any) => {
            let metadata: any = {};
            try {
              if (item.name.startsWith('STAFF:')) {
                metadata = JSON.parse(item.name.replace('STAFF:', ''));
              }
            } catch {}
            return {
              id: item.id,
              name: metadata.name || item.name.replace('STAFF:', ''),
              role: (metadata.role || 'CAPTAIN') as StaffMember['role'],
              phone: metadata.phone || '',
              assigned_tables: metadata.assigned_tables || ['ALL'],
              restaurant_id: metadata.restaurant_id || null,
            };
          })
          .filter((s: any) => s.restaurant_id === foundRest.id);
      }

      // Filter out legacy mock members
      const isMockStaff = (s: any) => 
        s.id === 'stf_1' || s.id === 'stf_2' || s.id === 'stf_3' || s.id === 'stf_4' || s.id === 'stf_5' ||
        s.name === 'Rahul Sharma' || s.name === 'Vikram Singh' || s.name === 'Amit Patel' || s.name === 'Suresh Kumar' || s.name === 'Manager on Duty';

      dynamicRoster = dynamicRoster.filter(s => !isMockStaff(s));

      // Check localStorage for customized staff
      const localStaffRaw = localStorage.getItem(`tabletapy_custom_staff_${foundRest.id}`);
      if (localStaffRaw) {
        try {
          const localList: any[] = JSON.parse(localStaffRaw);
          const filteredLocal = localList.filter(s => !isMockStaff(s));
          if (filteredLocal.length !== localList.length) {
            localStorage.setItem(`tabletapy_custom_staff_${foundRest.id}`, JSON.stringify(filteredLocal));
          }
          const existingIds = new Set(dynamicRoster.map(s => s.id));
          filteredLocal.forEach(ls => {
            if (!existingIds.has(ls.id)) {
              dynamicRoster.push({ 
                id: ls.id, 
                name: ls.name, 
                role: ls.role || 'CAPTAIN',
                phone: ls.phone || '',
                assigned_tables: ls.assigned_tables || ['ALL']
              });
            }
          });
        } catch {}
      }

      // If no custom staff added yet, provide a single generic Shift Staff or empty list
      if (dynamicRoster.length === 0) {
        dynamicRoster = [
          { id: 'shift_lead', name: 'Shift Lead / Floor Staff', role: 'CAPTAIN' }
        ];
      }

      setStaffList(dynamicRoster);
      setStep('SELECT_STAFF');
    } catch (err: any) {
      setLoginError(err.message || 'Authentication error.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectStaff = (member: StaffMember) => {
    setActiveStaff(member);
    localStorage.setItem('tabletapy_captain_staff', JSON.stringify(member));
    setStep('APP');
  };

  const handleLogout = () => {
    localStorage.removeItem('tabletapy_captain_staff');
    localStorage.removeItem('tabletapy_captain_restaurant');
    setActiveStaff(null);
    setRestaurant(null);
    setStep('LOGIN');
    setRestCodeInput('');
    setPinInput('');
  };

  // Quick Walk-In Order Placement
  const handleOpenOrderModal = (tableNo: string) => {
    setSelectedTable(tableNo);
    setOrderCart([]);
    setMenuSearch('');
    
    // If table already has an active order, prefill existing guest name/phone
    const existingOrder = activeOrders.find(o => o.table_no.toLowerCase() === tableNo.toLowerCase() || o.table_no.toLowerCase().includes(tableNo.toLowerCase()));
    if (existingOrder && existingOrder.customer_name && !existingOrder.customer_name.startsWith('Captain:')) {
      setGuestNameInput(existingOrder.customer_name);
      setGuestPhoneInput(existingOrder.customer_phone || '');
    } else {
      setGuestNameInput('');
      setGuestPhoneInput('');
    }
    setGuestSpecialNoteInput('');
    setIsOrderModalOpen(true);
  };

  const handleAddDishToCart = (dish: any) => {
    // Auto-detect course based on category
    const cat = (dish.category || '').toUpperCase();
    const defaultCourse = cat.includes('STARTER') || cat.includes('APPETIZER') || cat.includes('SOUP')
      ? 'STARTER'
      : cat.includes('BEVERAGE') || cat.includes('DRINK') || cat.includes('BAR') || cat.includes('COFFEE')
      ? 'BEVERAGE'
      : cat.includes('DESSERT') || cat.includes('SWEET')
      ? 'DESSERT'
      : 'MAIN';

    setOrderCart(prev => {
      const existing = prev.find(x => x.item.id === dish.id);
      if (existing) {
        return prev.map(x => x.item.id === dish.id ? { ...x, count: x.count + 1 } : x);
      }
      return [...prev, { item: dish, count: 1, course: defaultCourse }];
    });
  };

  const handleUpdateCartCount = (dishId: string, delta: number) => {
    setOrderCart(prev => {
      return prev.map(x => {
        if (x.item.id === dishId) {
          const newCount = x.count + delta;
          return newCount > 0 ? { ...x, count: newCount } : null;
        }
        return x;
      }).filter(Boolean) as Array<{ item: any; count: number; course?: any; note?: string }>;
    });
  };

  const handleUpdateCartCourse = (dishId: string, course: 'STARTER' | 'MAIN' | 'BEVERAGE' | 'DESSERT') => {
    setOrderCart(prev => prev.map(x => x.item.id === dishId ? { ...x, course } : x));
  };

  const handleUpdateCartNote = (dishId: string, note: string) => {
    setOrderCart(prev => prev.map(x => x.item.id === dishId ? { ...x, note } : x));
  };

  const handleSubmitCaptainOrder = async () => {
    if (!restaurant || !selectedTable || orderCart.length === 0) return;
    setSubmittingOrder(true);

    try {
      const itemsPayload: any[] = [];
      let subtotal = 0;

      orderCart.forEach(cartEntry => {
        const dishPrice = cartEntry.item.base_price || 0;
        subtotal += dishPrice * cartEntry.count;
        itemsPayload.push({
          item: {
            id: cartEntry.item.id,
            name: cartEntry.item.name,
            basePrice: dishPrice,
            category: cartEntry.item.category
          },
          price: dishPrice,
          quantity: cartEntry.count,
          course: cartEntry.course || 'MAIN',
          note: cartEntry.note || ''
        });
      });

      const grandTotal = Number((subtotal * 1.05).toFixed(2));
      const formattedCustomerName = guestNameInput.trim() 
        ? guestNameInput.trim() 
        : `Captain: ${activeStaff?.name || 'Staff'}`;
      
      const compositeNote = [
        guestSpecialNoteInput.trim() ? `Note: ${guestSpecialNoteInput.trim()}` : null,
        guestPaxInput ? `Party: ${guestPaxInput} Guests` : null,
        `Server: ${activeStaff?.name || 'Floor Staff'}`
      ].filter(Boolean).join(' · ');

      // Inherit session ID from active table orders if present, or generate a fresh unique one
      const activeTableOrders = activeOrders.filter(o => 
        o.table_no?.toLowerCase().trim() === selectedTable.toLowerCase().trim() &&
        o.payment_status !== 'PAID' &&
        o.status !== 'CANCELLED'
      );
      const sessionId = activeTableOrders.length > 0
        ? (extractSessionId(activeTableOrders[0].note) || `sess_${activeTableOrders[0].id}`)
        : generateSessionId();

      const finalNote = attachSessionToNote(compositeNote, sessionId);

      const { data, error } = await supabase.from('orders').insert({
        restaurant_id: restaurant.id,
        table_no: selectedTable,
        total: grandTotal,
        status: 'PREPARING', // Fired directly to kitchen!
        items_json: itemsPayload,
        customer_name: formattedCustomerName,
        customer_phone: guestPhoneInput.trim() || null,
        payment_status: 'PENDING',
        note: finalNote
      }).select().single();

      if (error) throw error;

      setIsOrderModalOpen(false);
      setOrderCart([]);
      setGuestNameInput('');
      setGuestPhoneInput('');
      setGuestSpecialNoteInput('');
      setBellNotice(`KOT fired directly to kitchen for ${selectedTable}!`);
      setTimeout(() => setBellNotice(null), 4000);
    } catch (err: any) {
      setBellNotice("❌ Order error: " + err.message);
      setTimeout(() => setBellNotice(null), 5000);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Add water bottle directly to an active table order and update bill
  const handleAddWaterBottleToTable = async (waterItem: any, tableName: string) => {
    try {
      const activeOrder = activeOrders.find(o => 
        o.table_no.toLowerCase() === tableName.toLowerCase() || 
        o.table_no.toLowerCase().includes(tableName.toLowerCase())
      );
      const price = Number(waterItem.base_price) || 20;

      if (activeOrder) {
        // Append water bottle into the existing active order
        const existingItems = Array.isArray(activeOrder.items_json) ? [...activeOrder.items_json] : [];
        const existingWaterIdx = existingItems.findIndex(it => it.item?.name === waterItem.name);
        
        if (existingWaterIdx > -1) {
          existingItems[existingWaterIdx] = {
            ...existingItems[existingWaterIdx],
            quantity: (existingItems[existingWaterIdx].quantity || 1) + 1
          };
        } else {
          existingItems.push({
            item: {
              id: waterItem.id,
              name: waterItem.name,
              category: waterItem.category || 'Beverages'
            },
            price: price,
            quantity: 1,
            isReady: true // Water is served directly at table, no kitchen prep delay
          });
        }

        const newTotal = existingItems.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);

        const { error } = await supabase
          .from('orders')
          .update({
            items_json: existingItems,
            total: newTotal
          })
          .eq('id', activeOrder.id);

        if (!error) {
          setActiveOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, items_json: existingItems, total: newTotal } : o));
          setBellNotice(`Added ${waterItem.name} (₹${price}) to ${tableName}!`);
          setTimeout(() => setBellNotice(null), 3000);
          triggerHaptic([50, 50]);
        }
      } else if (restaurant?.id) {
        // Table doesn't have an order yet: create initial order with water
        const itemsPayload = [{
          item: {
            id: waterItem.id,
            name: waterItem.name,
            category: waterItem.category || 'Beverages'
          },
          price: price,
          quantity: 1,
          isReady: true
        }];

        const activeTableOrders = activeOrders.filter(o => 
          o.table_no?.toLowerCase().trim() === tableName.toLowerCase().trim() &&
          o.payment_status !== 'PAID' &&
          o.status !== 'CANCELLED'
        );
        const sessionId = activeTableOrders.length > 0
          ? (extractSessionId(activeTableOrders[0].note) || `sess_${activeTableOrders[0].id}`)
          : generateSessionId();

        const waterNote = attachSessionToNote(`Water served by ${activeStaff?.name || 'Floor Staff'}`, sessionId);

        const { data, error } = await supabase.from('orders').insert({
          restaurant_id: restaurant.id,
          table_no: tableName,
          total: price,
          status: 'SERVED',
          items_json: itemsPayload,
          customer_name: 'Dine-in Guest',
          payment_status: 'PENDING',
          note: waterNote
        }).select().single();

        if (!error && data) {
          setActiveOrders(prev => [data, ...prev]);
          setBellNotice(`Added ${waterItem.name} to ${tableName}!`);
          setTimeout(() => setBellNotice(null), 3000);
          triggerHaptic([50, 50]);
        }
      }
    } catch (err: any) {
      console.error("Error adding water:", err);
      setBellNotice("❌ Water error: " + err.message);
      setTimeout(() => setBellNotice(null), 5000);
    }
  };

  // Direct Floor Action: Mark all ready food as Delivered to guests
  const handleMarkDelivered = async (order: TableOrder, tableName?: string) => {
    setDetailActionLoading(true);
    try {
      const targetTable = tableName || order.table_no;
      const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const targetNorm = normalize(targetTable);

      const readyOrders = activeOrders.filter(o => {
        const oNorm = normalize(o.table_no);
        const matches = oNorm === targetNorm || oNorm.includes(targetNorm) || targetNorm.includes(oNorm);
        return matches && (o.status === 'SERVED' || o.id === order.id);
      });

      const readyIds = readyOrders.length > 0 ? readyOrders.map(o => o.id) : [order.id];

      const { error } = await supabase
        .from('orders')
        .update({ status: 'COMPLETED' })
        .in('id', readyIds);

      if (!error) {
        // Keep order in active orders with status: 'COMPLETED' (Served to Table / Dining)
        // Table remains occupied with its full bill, rounds, and items until guests pay / table is cleared!
        setActiveOrders(prev => prev.map(o => readyIds.includes(o.id) ? { ...o, status: 'COMPLETED' } : o));
        setBellNotice(`Food delivered to ${targetTable}! Table is happily dining.`);
        setTimeout(() => setBellNotice(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailActionLoading(false);
    }
  };

  // Direct Floor Action: Captain accepts new table order request and fires KOT to kitchen
  const handleAcceptAndFireKot = async (round: TableOrder) => {
    setDetailActionLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'PREPARING' })
        .eq('id', round.id);

      if (!error) {
        setActiveOrders(prev => prev.map(o => o.id === round.id ? { ...o, status: 'PREPARING' } : o));
        setBellNotice(`✅ KOT Fired! Order for Table ${round.table_no} sent to Kitchen.`);
        setTimeout(() => setBellNotice(null), 4000);
        playNewOrderChime(soundEnabled);
      } else {
        setBellNotice(`❌ Failed to fire KOT: ${error.message}`);
        setTimeout(() => setBellNotice(null), 5000);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailActionLoading(false);
    }
  };

  // Direct Floor Action: Captain rejects an unverified or fake table order request
  const handleRejectRound = async (round: TableOrder) => {
    if (!confirm(`Reject order for Table ${round.table_no}? This will cancel the order ticket.`)) return;
    setDetailActionLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', round.id);

      if (!error) {
        setActiveOrders(prev => prev.filter(o => o.id !== round.id));
        setBellNotice(`🚫 Order for Table ${round.table_no} rejected and cancelled.`);
        setTimeout(() => setBellNotice(null), 4000);
      } else {
        setBellNotice(`❌ Failed to reject order: ${error.message}`);
        setTimeout(() => setBellNotice(null), 5000);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailActionLoading(false);
    }
  };

  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);

  // Direct Floor Action: Cancel individual item mid-prep and alert Kitchen KDS
  const handleCancelItemFromCaptain = (round: TableOrder, itemName: string, currentCount: number) => {
    const isCooking = round.status === 'PREPARING' || round.status === 'NEW';
    setCaptainCancelConfirm({
      round,
      itemName,
      currentCount,
      isCooking
    });
  };

  const handleExecuteCaptainCancelItem = async () => {
    if (!captainCancelConfirm) return;
    const { round, itemName } = captainCancelConfirm;
    setCaptainCancelConfirm(null);
    setCancellingItemId(`${round.id}_${itemName}`);
    try {
      const items = Array.isArray(round.items_json) ? [...round.items_json] : [];
      let removed = false;
      const updatedItems: OrderItem[] = [];

      for (const entry of items) {
        const name = entry.item?.name || 'Dish';
        if (!removed && name === itemName) {
          const qty = entry.quantity || 1;
          if (qty > 1) {
            updatedItems.push({ ...entry, quantity: qty - 1 });
            removed = true;
          } else {
            removed = true;
          }
        } else {
          updatedItems.push(entry);
        }
      }

      const newTotal = updatedItems.reduce((sum, e) => sum + (e.price || e.item?.basePrice || 0) * (e.quantity || 1), 0);
      const isCompletelyEmpty = updatedItems.length === 0;

      const updatePayload: any = {
        items_json: updatedItems,
        total: newTotal,
        ...(isCompletelyEmpty ? { status: 'CANCELLED' } : {})
      };

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', round.id);

      if (error) {
        setBellNotice("❌ Failed to cancel item: " + error.message);
        setTimeout(() => setBellNotice(null), 5000);
        return;
      }

      // Update local state
      setActiveOrders(prev => {
        const next = prev
          .map(o => o.id === round.id ? { ...o, ...updatePayload } : o)
          .filter(o => o.status !== 'CANCELLED');
        activeOrdersRef.current = next;
        return next;
      });

      // Broadcast urgent cancellation alert directly to KDS
      if (restaurant?.id) {
        try {
          const kdsChannel = supabase.channel(`kds_stream_${restaurant.id}`);
          kdsChannel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              kdsChannel.send({
                type: 'broadcast',
                event: 'item_cancelled',
                payload: {
                  tableName: round.table_no,
                  itemName,
                  quantity: 1,
                  cancelledAt: Date.now()
                }
              });
              setTimeout(() => supabase.removeChannel(kdsChannel), 1500);
            }
          });
        } catch {}
      }

      setBellNotice(`🛑 Cancelled 1× "${itemName}" on ${round.table_no}. Kitchen KDS Hold Siren triggered!`);
      playKitchenHoldUrgentAlert(soundEnabled);
      setTimeout(() => setBellNotice(null), 6000);
    } catch (e: any) {
      setBellNotice("❌ Error cancelling item: " + e.message);
      setTimeout(() => setBellNotice(null), 5000);
    } finally {
      setCancellingItemId(null);
    }
  };

  // Direct Floor Action: Request Bill from Cashier (calls cashier / updates payment_status to CASH_REQUESTED)
  const handleRequestBill = async (order: TableOrder) => {
    setDetailActionLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'CASH_REQUESTED' })
        .eq('id', order.id);

      if (!error) {
        setActiveOrders(prev => prev.map(o => o.id === order.id ? { ...o, payment_status: 'CASH_REQUESTED' } : o));
        setBellNotice(`Bill requested for ${order.table_no}. Cashier notified!`);
        setTimeout(() => setBellNotice(null), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailActionLoading(false);
    }
  };

  // Direct Floor Action: Clear/Reset table when guests leave (Triggers custom modal)
  const handleClearTable = (order: TableOrder, tenderMethod?: 'CASH' | 'EDC' | 'UPI_QR') => {
    const tableName = order.table_no || detailTable?.name || '';
    const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = normalize(tableName);

    const tableOrders = activeOrders.filter(o => {
      const oNorm = normalize(o.table_no);
      return oNorm === targetNorm || oNorm.includes(targetNorm) || targetNorm.includes(oNorm);
    });

    const isUnpaid = tableOrders.some(o => o.payment_status !== 'PAID');
    const tableBill = tableOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    setClearTableConfirm({
      order,
      tableName,
      isUnpaid,
      tableBill,
      tenderMethod
    });
  };

  const handleExecuteClearTable = async () => {
    if (!clearTableConfirm) return;
    const { order, tableName, tenderMethod } = clearTableConfirm;
    setClearTableConfirm(null);
    setDetailActionLoading(true);

    const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = normalize(tableName);
    const tableOrders = activeOrders.filter(o => {
      const oNorm = normalize(o.table_no);
      return oNorm === targetNorm || oNorm.includes(targetNorm) || targetNorm.includes(oNorm);
    });

    try {
      const orderIds = tableOrders.map(o => o.id);
      const paymentMethodVal = tenderMethod || 'CASH';

      // 1. Mark orders completed and paid in Supabase
      if (orderIds.length > 0 || order.id) {
        await supabase
          .from('orders')
          .update({ 
            status: 'COMPLETED', 
            payment_status: 'PAID',
            payment_method: paymentMethodVal 
          })
          .in('id', orderIds.length > 0 ? orderIds : [order.id]);
      }

      const payerOrder = tableOrders.find(o => o.customer_phone) || order;
      const payerPhone = payerOrder?.customer_phone || '';
      const payerName = payerOrder?.customer_name || '';

      // Also clean up any orders matching this table directly in DB to prevent leftover records
      if (restaurant?.id && tableName) {
        await supabase
          .from('orders')
          .update({ 
            status: 'COMPLETED', 
            payment_status: 'PAID',
            payment_method: paymentMethodVal 
          })
          .eq('restaurant_id', restaurant.id)
          .ilike('table_no', tableName)
          .neq('status', 'COMPLETED');

        // 2. Broadcast payment_confirmed AND table_cleared on Realtime channel to instantly wipe customer devices & carts
        try {
          const cleanTable = (tableName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const normTable = cleanTable.replace(/^table0*([0-9]+)$/, 'table$1');

          const channelTargets = Array.from(new Set([
            `table_session_${restaurant.id}_${cleanTable}`,
            `table_session_${restaurant.id}_${normTable}`,
            `table_session_${restaurant.id}_${encodeURIComponent(tableName)}`
          ]));

          channelTargets.forEach(chName => {
            const tableChannel = supabase.channel(chName);
            tableChannel.subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                tableChannel.send({
                  type: 'broadcast',
                  event: 'payment_confirmed',
                  payload: {
                    tableName,
                    action: 'payment_confirmed',
                    payerPhone,
                    payerName,
                    tenderMethod: paymentMethodVal,
                    settledAt: Date.now()
                  }
                });
                tableChannel.send({
                  type: 'broadcast',
                  event: 'table_cleared',
                  payload: { 
                    tableName, 
                    action: 'settled',
                    payerPhone,
                    payerName,
                    tenderMethod: paymentMethodVal,
                    clearedAt: Date.now() 
                  }
                });
                setTimeout(() => supabase.removeChannel(tableChannel), 1500);
              }
            });
          });
        } catch (bErr) {
          console.warn("Table clear broadcast notice:", bErr);
        }
      }

      // 3. Update local state
      setActiveOrders(prev => prev.filter(o => {
        const oNorm = normalize(o.table_no);
        return !(oNorm === targetNorm || oNorm.includes(targetNorm) || targetNorm.includes(oNorm) || orderIds.includes(o.id) || o.id === order.id);
      }));

      // Reset water bottles for this table
      setTableWaterBottles(prev => {
        const updated = { ...prev };
        delete updated[order.table_no];
        delete updated[tableName];
        if (detailTable) delete updated[detailTable.id];
        try {
          localStorage.setItem('tabletapy_floor_water_bottles', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Clear from activeBrowsingTables
      setActiveBrowsingTables(prev => {
        const updated = { ...prev };
        delete updated[tableName];
        if (detailTable) delete updated[detailTable.name];
        return updated;
      });

      setBellNotice(`✅ ${tableName} is now cleared & vacant.`);
      setTimeout(() => setBellNotice(null), 4000);
      setDetailTable(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailActionLoading(false);
    }
  };

  // Direct Floor Action: Verify UPI payment and confirm settlement at table (Triggers custom modal)
  const handleVerifyUpiAndSettle = (order: TableOrder) => {
    const tableName = order.table_no || detailTable?.name || '';
    const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = normalize(tableName);

    const tableOrders = activeOrders.filter(o => {
      const oNorm = normalize(o.table_no);
      return oNorm === targetNorm || oNorm.includes(targetNorm) || targetNorm.includes(oNorm);
    });

    const tableBill = tableOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    setVerifyUpiConfirm({
      order,
      tableName,
      tableBill
    });
  };

  const handleExecuteVerifyUpi = async () => {
    if (!verifyUpiConfirm) return;
    const { order, tableName } = verifyUpiConfirm;
    setVerifyUpiConfirm(null);
    setDetailActionLoading(true);

    const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = normalize(tableName);
    const tableOrders = activeOrders.filter(o => {
      const oNorm = normalize(o.table_no);
      return oNorm === targetNorm || oNorm.includes(targetNorm) || targetNorm.includes(oNorm);
    });

    try {
      const orderIds = tableOrders.map(o => o.id);

      // 1. Mark orders completed and paid in Supabase
      if (orderIds.length > 0 || order.id) {
        await supabase
          .from('orders')
          .update({ status: 'COMPLETED', payment_status: 'PAID' })
          .in('id', orderIds.length > 0 ? orderIds : [order.id]);
      }

      const payerOrder = tableOrders.find(o => o.customer_phone) || order;
      const payerPhone = payerOrder?.customer_phone || '';
      const payerName = payerOrder?.customer_name || '';

      if (restaurant?.id && tableName) {
        await supabase
          .from('orders')
          .update({ status: 'COMPLETED', payment_status: 'PAID' })
          .eq('restaurant_id', restaurant.id)
          .ilike('table_no', tableName)
          .neq('payment_status', 'PAID');

        // 2. Broadcast payment_confirmed and table_cleared on Realtime channels to update customer devices
        try {
          const cleanTable = (tableName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const normTable = cleanTable.replace(/^table0*([0-9]+)$/, 'table$1');

          const channelTargets = Array.from(new Set([
            `table_session_${restaurant.id}_${cleanTable}`,
            `table_session_${restaurant.id}_${normTable}`,
            `table_session_${restaurant.id}_${encodeURIComponent(tableName)}`
          ]));

          channelTargets.forEach(chName => {
            const tableChannel = supabase.channel(chName);
            tableChannel.subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                tableChannel.send({
                  type: 'broadcast',
                  event: 'payment_confirmed',
                  payload: {
                    tableName,
                    action: 'payment_confirmed',
                    payerPhone,
                    payerName,
                    settledAt: Date.now()
                  }
                });
                tableChannel.send({
                  type: 'broadcast',
                  event: 'table_cleared',
                  payload: {
                    tableName,
                    action: 'settled',
                    payerPhone,
                    payerName,
                    settledAt: Date.now()
                  }
                });
                setTimeout(() => supabase.removeChannel(tableChannel), 1500);
              }
            });
          });
        } catch {}
      }

      // 3. Update local state
      setActiveOrders(prev => prev.filter(o => {
        const oNorm = normalize(o.table_no);
        return !(oNorm === targetNorm || oNorm.includes(targetNorm) || targetNorm.includes(oNorm) || orderIds.includes(o.id) || o.id === order.id);
      }));

      // Reset water bottles for this table
      setTableWaterBottles(prev => {
        const updated = { ...prev };
        delete updated[order.table_no];
        delete updated[tableName];
        if (detailTable) delete updated[detailTable.id];
        try {
          localStorage.setItem('tabletapy_floor_water_bottles', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Clear from activeBrowsingTables
      setActiveBrowsingTables(prev => {
        const updated = { ...prev };
        delete updated[tableName];
        if (detailTable) delete updated[detailTable.name];
        return updated;
      });

      setBellNotice(`✅ Table ${tableName} UPI payment verified & confirmed!`);
      setTimeout(() => setBellNotice(null), 5000);
      setDetailTable(null);
      triggerHaptic([100, 50, 100, 50, 200]);
    } catch (err: any) {
      console.error(err);
      setBellNotice("❌ Error confirming UPI: " + err.message);
      setTimeout(() => setBellNotice(null), 5000);
    } finally {
      setDetailActionLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // SCREEN 1: RESTAURANT CODE & PIN LOGIN
  // ──────────────────────────────────────────────────────────
  if (step === 'LOGIN') {
    return (
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-center items-center p-6 font-sans">
        <div className="w-full max-w-sm flex flex-col items-center">
          {/* Brand mark */}
          <div className="w-14 h-14 rounded-2xl bg-[#E46254]/10 border border-[#E46254]/20 flex items-center justify-center text-[#E46254] mb-5">
            <UtensilsCrossed size={26} strokeWidth={2.2} />
          </div>

          <h1 className="text-[22px] font-black text-zinc-900 tracking-tight text-center">
            Captain App
          </h1>
          <p className="text-[12.5px] text-zinc-400 mt-1 text-center">
            Floor Staff & Waiter Terminal
          </p>

          <form onSubmit={handleLogin} className="w-full mt-7 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                5-Character Restaurant ID
              </label>
              <input
                type="text"
                value={restCodeInput}
                onChange={e => setRestCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. C7YLP"
                maxLength={10}
                required
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:border-[#E46254] focus:ring-2 focus:ring-[#E46254]/10 text-[16px] font-mono font-bold tracking-widest text-center uppercase transition-all bg-zinc-50/50"
              />
              <p className="text-[11px] text-zinc-400 mt-1 text-center">Found on your Owner Dashboard &rarr; Staffs</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                4-Digit Staff PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder="••••"
                required
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:border-[#E46254] focus:ring-2 focus:ring-[#E46254]/10 text-[18px] tracking-widest text-center transition-all bg-zinc-50/50 font-mono"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px] flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#E46254] hover:bg-[#d04e41] active:bg-[#bd3f33] text-white font-bold text-[13.5px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-60"
            >
              {authLoading ? <Loader2 size={16} className="animate-spin" /> : <span>Sign In to Terminal</span>}
              {!authLoading && <ArrowRight size={15} />}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // SCREEN 2: SELECT YOUR NAME (STAFF SELECTION)
  // ──────────────────────────────────────────────────────────
  if (step === 'SELECT_STAFF') {
    return (
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-center items-center p-6 font-sans">
        <div className="w-full max-w-sm flex flex-col">
          <div className="text-center mb-6">
            <span className="text-[11px] font-extrabold text-[#E46254] bg-[#E46254]/8 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {restaurant?.name || 'Restaurant'}
            </span>
            <h2 className="text-[20px] font-bold text-zinc-900 mt-3 tracking-tight">
              Who is on duty?
            </h2>
            <p className="text-[12px] text-zinc-400 mt-0.5">
              Select your name to start taking orders
            </p>
          </div>

          <div className="space-y-2">
            {staffList.map(member => (
              <button
                key={member.id}
                onClick={() => handleSelectStaff(member)}
                className="w-full p-3.5 rounded-2xl border border-zinc-200/90 hover:border-[#E46254]/40 hover:bg-[#E46254]/5 bg-white text-left flex items-center justify-between transition-all cursor-pointer shadow-2xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 group-hover:bg-[#E46254]/10 text-zinc-600 group-hover:text-[#E46254] flex items-center justify-center font-bold text-[13px] transition-colors">
                    {member.name.slice(0, 1)}
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-zinc-900 group-hover:text-[#E46254] transition-colors">
                      {member.name}
                    </h4>
                    <span className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {member.role}
                    </span>
                  </div>
                </div>

                <ArrowRight size={15} className="text-zinc-300 group-hover:text-[#E46254] transition-colors" />
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('LOGIN')}
            className="mt-6 text-center text-[12px] text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            ← Switch Restaurant
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // SCREEN 3: CAPTAIN FLOOR APP (UNIFIED ALERTS, 3 SIMPLE TABS, FULLY RESPONSIVE)
  // ──────────────────────────────────────────────────────────
  
  // Calculate unified attention alerts: Cash Calls + Waiter Service Calls + Food Ready at Pass
  const isCallWaiterOrder = (o: TableOrder) => {
    return o.payment_status === 'CASH_REQUESTED' || 
      o.payment_status === 'UPI_VERIFICATION_PENDING' ||
      o.payment_status === 'WAITER_CALLED' ||
      (o.note && (o.note.toUpperCase().includes('CALL') || o.note.toUpperCase().includes('WAITER') || o.note.toUpperCase().includes('SERVICE')));
  };

  const isTableOccupiedOrBrowsing = (table: LocationTable) => {
    const hasOrder = activeOrders.some(o => o.table_no.toLowerCase() === table.name.toLowerCase() || o.table_no.toLowerCase().includes(table.name.toLowerCase()));
    const isBrowsing = !!activeBrowsingTables[table.name] && activeBrowsingTables[table.name].count > 0;
    return hasOrder || isBrowsing;
  };

  const cashCallOrders = activeOrders.filter(o => o.payment_status === 'CASH_REQUESTED');
  const waiterCallOrders = activeOrders.filter(o => o.payment_status === 'WAITER_CALLED' || (o.note && o.note.toUpperCase().includes('CALL WAITER')));
  const foodReadyOrders = activeOrders.filter(o => o.status === 'SERVED');
  const totalAttentionCount = activeOrders.filter(o => isCallWaiterOrder(o) || o.status === 'SERVED').length;
  const vacantTablesCount = tables.filter(t => !isTableOccupiedOrBrowsing(t)).length;

  // Helper: compute rich guest intelligence from past orders
  const getCustomerProfile = (order?: TableOrder | null): CustomerProfile | null => {
    if (!order) return null;
    const name = order.customer_name?.trim() || '';
    const phone = order.customer_phone?.trim() || '';
    
    // Ignore internal placeholder names
    if (!name && !phone) return null;
    const isInternalPlaceholder = name.toLowerCase().startsWith('captain:') || name.toLowerCase().startsWith('table ');
    
    // Find all matching orders in past history
    const matching = pastOrdersHistory.filter(h => {
      if (phone && h.customer_phone && h.customer_phone === phone) return true;
      if (name && !isInternalPlaceholder && h.customer_name && h.customer_name.toLowerCase() === name.toLowerCase()) return true;
      return false;
    });

    const totalVisits = Math.max(1, matching.length);
    const totalSpend = matching.reduce((sum, h) => sum + (Number(h.total) || 0), 0) + (matching.length === 0 ? Number(order.total) || 0 : 0);

    return {
      name: isInternalPlaceholder ? 'Dine-in Guest' : name || 'Dine-in Guest',
      phone: phone || undefined,
      totalVisits,
      totalSpend
    };
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans select-none pb-24 w-full overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 flex-1 flex flex-col">
        
        {/* ── EXPEDITED URGENT ALERT MODAL ── */}
        {activeIncomingAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-sm sm:max-w-md rounded-3xl p-5 sm:p-7 shadow-2xl border flex flex-col items-center text-center animate-in zoom-in-95 duration-200 ${
              activeIncomingAlert.type === 'CASH_CALL' || activeIncomingAlert.type === 'WAITER_CALL'
                ? 'bg-amber-500 border-amber-600 text-white'
                : activeIncomingAlert.type === 'UPI_VERIFY'
                ? 'bg-emerald-600 border-emerald-700 text-white'
                : activeIncomingAlert.type === 'FOOD_READY'
                ? 'bg-emerald-600 border-emerald-700 text-white'
                : activeIncomingAlert.type === 'NEW_ORDER'
                ? 'bg-indigo-600 border-indigo-700 text-white'
                : activeIncomingAlert.type === 'ORDER_MODIFIED'
                ? 'bg-rose-600 border-rose-700 text-white'
                : 'bg-zinc-900 border-zinc-800 text-white'
            }`}>
              <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-inner">
                {activeIncomingAlert.type === 'CASH_CALL' ? (
                  <Banknote size={32} strokeWidth={2.5} className="animate-bounce" />
                ) : activeIncomingAlert.type === 'UPI_VERIFY' ? (
                  <Smartphone size={32} strokeWidth={2.5} className="animate-bounce" />
                ) : activeIncomingAlert.type === 'WAITER_CALL' ? (
                  <BellRing size={32} strokeWidth={2.5} className="animate-bounce" />
                ) : activeIncomingAlert.type === 'FOOD_READY' ? (
                  <HandPlatter size={32} strokeWidth={2.5} className="animate-pulse" />
                ) : activeIncomingAlert.type === 'NEW_ORDER' ? (
                  <UtensilsCrossed size={32} strokeWidth={2.5} className="animate-bounce" />
                ) : activeIncomingAlert.type === 'ORDER_MODIFIED' ? (
                  <AlertOctagon size={32} strokeWidth={2.5} className="animate-pulse" />
                ) : (
                  <Bell size={32} strokeWidth={2.5} />
                )}
              </div>

              <span className="text-[10.5px] font-bold tracking-wider uppercase bg-black/20 px-3 py-0.5 rounded-full mb-1.5">
                Floor Action Required
              </span>

              <h2 className="text-[26px] sm:text-[32px] font-bold tracking-tight leading-none mb-1">
                {activeIncomingAlert.tableName}
              </h2>

              <p className="text-[15px] sm:text-[18px] font-semibold mb-1">
                {activeIncomingAlert.message}
              </p>

              <p className="text-[12.5px] opacity-90 leading-relaxed mb-5 font-normal max-w-xs">
                {activeIncomingAlert.subtext}
              </p>

              <div className="w-full flex flex-col gap-2">
                <button
                  onClick={() => {
                    const targetTbl = tables.find(t => t.name.toLowerCase() === activeIncomingAlert.tableName.toLowerCase());
                    if (targetTbl) setDetailTable(targetTbl);
                    setActiveIncomingAlert(null);
                  }}
                  className="w-full py-3 rounded-xl bg-white text-zinc-900 font-bold text-[14px] shadow-sm cursor-pointer hover:bg-zinc-100 active:scale-95 transition-all"
                >
                  Open Table Details
                </button>
                <button
                  onClick={() => setActiveIncomingAlert(null)}
                  className="w-full py-2 rounded-xl bg-black/20 hover:bg-black/30 text-white font-medium text-[12px] cursor-pointer active:scale-95 transition-colors"
                >
                  Acknowledge & Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── UNIFIED RESPONSIVE TOP BAR (Zero horizontal overflow, perfectly flush) ── */}
        <header className="py-2.5 sm:py-3.5 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 sticky top-0 z-30 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#E46254]/10 text-[#E46254] border border-[#E46254]/20 flex items-center justify-center font-bold text-[13px] sm:text-[15px] shrink-0">
              {activeStaff?.name.slice(0, 1) || 'C'}
            </div>
            <div className="min-w-0">
              <h1 className="text-[13.5px] sm:text-[16px] font-bold text-zinc-900 tracking-tight leading-tight truncate">
                {activeStaff?.name}
              </h1>
              <p className="text-[10.5px] sm:text-[11.5px] text-zinc-400 truncate font-medium flex items-center gap-1">
                <span>{restaurant?.name}</span>
                <span className="text-zinc-300">·</span>
                <span className="text-[#E46254] font-semibold">{activeStaff?.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Quick Switch Restaurant / Staff button */}
            <button
              onClick={() => {
                localStorage.removeItem('tabletapy_captain_staff');
                setStep('SELECT_STAFF');
              }}
              title="Change Staff or Switch Restaurant"
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer border border-zinc-200/60 hidden xs:inline-flex"
            >
              Staff
            </button>
            {/* Unified Urgent Floor Badge: Lights up if any guest wants cash or food is at pass */}
            {totalAttentionCount > 0 && (
              <button
                onClick={() => setFloorFilter('ATTENTION')}
                className="px-2.5 py-1.5 sm:px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] sm:text-[12px] font-bold flex items-center gap-1 animate-pulse shadow-2xs cursor-pointer transition-all active:scale-95"
              >
                <Bell size={13} strokeWidth={2.2} />
                <span>{totalAttentionCount} Action</span>
              </button>
            )}

            <button
              onClick={() => setSoundEnabled(v => !v)}
              title={soundEnabled ? "Mute Bell Alerts" : "Enable Bell Alerts"}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer active:scale-95 border border-zinc-200/60"
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} className="text-zinc-400" />}
            </button>
            <button
              onClick={handleLogout}
              title="Log out"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer active:scale-95 border border-zinc-200/60"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* ── EXPEDITER / BELL PING BANNER ── */}
        {bellNotice && (
          <div className="mt-2.5 p-3 rounded-xl bg-zinc-900 text-white text-[12px] font-medium flex items-center justify-between shadow-md animate-in slide-in-from-top-2 z-20 border border-zinc-800">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="w-2 h-2 rounded-full bg-[#E46254] animate-ping shrink-0" />
              <span className="truncate">{bellNotice}</span>
            </div>
            <button
              onClick={() => setBellNotice(null)}
              className="text-[10.5px] bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-lg transition-colors cursor-pointer shrink-0 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── 3 CLEAN SEGMENTED CONTROLLER TABS ── */}
        <main className="py-5 sm:py-7 flex-1 flex flex-col">
          <div className="mb-5 sm:mb-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* The 3 Segmented Tabs */}
            <div className="flex items-center p-1 bg-zinc-100/90 rounded-2xl max-w-sm w-full border border-zinc-200/50">
              <button
                onClick={() => setFloorFilter('ALL')}
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  floorFilter === 'ALL'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span>All</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${
                  floorFilter === 'ALL' ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-200/50 text-zinc-400'
                }`}>
                  {tables.length}
                </span>
              </button>

              <button
                onClick={() => setFloorFilter('ATTENTION')}
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  floorFilter === 'ATTENTION'
                    ? 'bg-white text-amber-600 shadow-xs'
                    : totalAttentionCount > 0
                    ? 'text-amber-700 bg-amber-50 font-bold'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span>Attention</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                  floorFilter === 'ATTENTION'
                    ? 'bg-amber-100 text-amber-800'
                    : totalAttentionCount > 0
                    ? 'bg-amber-500 text-white'
                    : 'bg-zinc-200/50 text-zinc-400'
                }`}>
                  {totalAttentionCount}
                </span>
              </button>

              <button
                onClick={() => setFloorFilter('VACANT')}
                className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  floorFilter === 'VACANT'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span>Vacant</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${
                  floorFilter === 'VACANT' ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-200/50 text-zinc-400'
                }`}>
                  {vacantTablesCount}
                </span>
              </button>
            </div>

            {/* Quick Floor Status Summary Text */}
            <div className="text-[12.5px] font-medium text-zinc-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{activeOrders.length} Seated</span>
              <span className="text-zinc-300">·</span>
              <span className="text-zinc-400">{vacantTablesCount} Available</span>
            </div>
          </div>

          {/* ── RESPONSIVE ADAPTIVE GRID OR EMPTY STATE ── */}
          {tables.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3 border border-zinc-200/60">
                <UtensilsCrossed size={22} strokeWidth={1.75} />
              </div>
              <h3 className="text-[16px] font-bold text-zinc-800 tracking-tight">No Tables Configured</h3>
              <p className="text-[12.5px] text-zinc-400 mt-1 max-w-xs">
                Go to your Owner Dashboard &rarr; <strong>Tables</strong> to create and manage dining tables for {restaurant?.name}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-4 flex-1 content-start">
              {tables
                .filter(table => {
                  if (!activeStaff?.assigned_tables || activeStaff.assigned_tables.length === 0 || activeStaff.assigned_tables.includes('ALL')) return true;
                  return activeStaff.assigned_tables.some(assigned => 
                    table.name.toLowerCase().includes(assigned.toLowerCase()) || assigned.toLowerCase().includes(table.name.toLowerCase())
                  );
                })
                .filter(table => {
                  const tableOrders = activeOrders.filter(o => o.table_no.toLowerCase() === table.name.toLowerCase() || o.table_no.toLowerCase().includes(table.name.toLowerCase()));
                  const hasTableOrders = tableOrders.length > 0;
                  if (floorFilter === 'ALL') return true;
                  if (floorFilter === 'ATTENTION') return tableOrders.some(o => isCallWaiterOrder(o) || o.status === 'SERVED' || o.status === 'NEW');
                  if (floorFilter === 'VACANT') return !hasTableOrders;
                  return true;
                })
                .map(table => {
                  const tableOrders = activeOrders.filter(o => o.table_no.toLowerCase() === table.name.toLowerCase() || o.table_no.toLowerCase().includes(table.name.toLowerCase()));
                  const tableOrder = tableOrders[0];
                  const isOccupied = tableOrders.length > 0;
                  const isCashCall = tableOrders.some(o => o.payment_status === 'CASH_REQUESTED');
                  const isFoodReady = tableOrders.some(o => o.status === 'SERVED');
                  const hasNewRequest = tableOrders.some(o => o.status === 'NEW');
                  const servedCount = tableOrders.filter(o => o.status === 'COMPLETED').length;
                  const cookingCount = tableOrders.filter(o => o.status === 'PREPARING').length;
                  const isMultiRoundMixed = isOccupied && servedCount > 0 && cookingCount > 0 && !isFoodReady && !isCashCall && !hasNewRequest;
                  const isCooking = !isFoodReady && !isMultiRoundMixed && !hasNewRequest && cookingCount > 0;
                  const isAllFoodServed = isOccupied && !isFoodReady && !hasNewRequest && cookingCount === 0 && tableOrders.every(o => o.status === 'COMPLETED');
                  const elapsedMins = tableOrder ? Math.max(0, Math.floor((Date.now() - new Date(tableOrder.created_at).getTime()) / 60000)) : 0;
                  const itemCount = tableOrders.reduce((sum, ord) => sum + (ord.items_json?.reduce((s, i) => s + (i.quantity || 1), 0) || 0), 0);
                  const browsingInfo = activeBrowsingTables[table.name];
                  const isBrowsing = !!browsingInfo && browsingInfo.count > 0;
                  const browsingCount = browsingInfo?.count || 0;
                  const normTbl = normalizeTableIdentifier(table.name);
                  const tablePastOrders = pastOrdersHistory.filter(o => normalizeTableIdentifier(o.table_no) === normTbl && o.payment_status === 'PAID');
                  const { pin: tablePin } = resolveTablePinAndSeed(table.name, tableOrders, tablePastOrders);

                  return (
                    <div
                      key={table.id}
                      onClick={() => setDetailTable(table)}
                      className={`p-3 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between min-h-[160px] sm:min-h-[175px] cursor-pointer active:scale-[0.99] relative bg-white shadow-2xs hover:shadow-md ${
                        isCashCall
                          ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/40'
                          : isFoodReady
                          ? 'border-emerald-300 ring-2 ring-emerald-400/20 bg-emerald-50/40'
                          : hasNewRequest
                          ? 'border-blue-400 ring-2 ring-blue-500/30 bg-blue-50/25'
                          : isMultiRoundMixed
                          ? 'border-amber-200/90 bg-amber-50/15'
                          : isCooking
                          ? 'border-[#E46254]/30'
                          : isOccupied
                          ? 'border-zinc-200/90'
                          : 'border-zinc-200/60 bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div>
                        {/* Top Header in Card: Table name + Status indicator */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-[17px] font-bold text-zinc-900 tracking-tight leading-none">
                                {table.name}
                              </h3>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1 shadow-2xs" title="Table Session PIN">
                                <KeyRound size={9} className="text-[#E46254]" />
                                <span>{tablePin}</span>
                              </span>
                            </div>
                            {table.capacity && (
                              <span className="text-[11px] text-zinc-400 font-medium block mt-1">
                                {table.capacity} Seats
                              </span>
                            )}
                          </div>

                          {/* Status Label */}
                          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-1 ${
                            isCashCall
                              ? 'bg-amber-100 text-amber-800'
                              : isFoodReady
                              ? 'bg-emerald-100 text-emerald-800'
                              : hasNewRequest
                              ? 'bg-blue-600 text-white font-extrabold animate-pulse'
                              : isMultiRoundMixed
                              ? 'bg-amber-50 text-amber-900 border border-amber-300'
                              : isCooking
                              ? 'bg-rose-50 text-[#E46254]'
                              : isAllFoodServed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : isOccupied
                              ? 'bg-zinc-100 text-zinc-700'
                              : isBrowsing
                              ? 'bg-sky-100 text-sky-800 border border-sky-300 ring-2 ring-sky-400/20'
                              : 'bg-zinc-100 text-zinc-400'
                          }`}>
                            {hasNewRequest && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                            {isBrowsing && !isOccupied && !hasNewRequest && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />}
                            <span>
                              {isCashCall 
                                ? 'Cash Call' 
                                : isFoodReady 
                                ? 'Ready' 
                                : hasNewRequest
                                ? 'New Order · Verify'
                                : isMultiRoundMixed 
                                ? `R${servedCount} Served · R${tableOrders.length} Cooking` 
                                : isCooking 
                                ? 'Cooking' 
                                : isAllFoodServed 
                                ? 'Dining' 
                                : isOccupied 
                                ? 'Seated' 
                                : isBrowsing 
                                ? 'Menu Open' 
                                : 'Available'}
                            </span>
                          </span>
                        </div>

                        {/* Middle Body: Seated Dining Details vs Live Browsing vs Clean Empty State */}
                        {isOccupied ? (() => {
                          const tableOrders = activeOrders.filter(o => o.table_no.toLowerCase() === table.name.toLowerCase() || o.table_no.toLowerCase().includes(table.name.toLowerCase()));
                          const roundsCount = tableOrders.length;
                          const guestProfile = getCustomerProfile(tableOrder);
                          const guestDisplayName = guestProfile?.name !== 'Dine-in Guest' 
                            ? guestProfile?.name 
                            : tableOrder.customer_name && !tableOrder.customer_name.startsWith('Captain:')
                            ? tableOrder.customer_name
                            : null;
                          const waterCount = tableWaterBottles[table.name] || tableWaterBottles[table.id] || 0;
                          const isWaiterCalled = tableOrders.some(o => isCallWaiterOrder(o));

                          return (
                            <div className="mt-2.5 space-y-1.5">
                              {/* Urgent Waiter Call Alert Badge */}
                              {isWaiterCalled && (
                                <div className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-black flex items-center justify-between animate-pulse">
                                  <span className="flex items-center gap-1">
                                    <BellRing size={10} className="stroke-[2.5]" />
                                    <span>Guest Calling Staff</span>
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider bg-black/20 px-1 rounded">Alert</span>
                                </div>
                              )}

                              {/* Guest Name */}
                              {guestDisplayName ? (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[12px] font-bold text-zinc-800 truncate">
                                    {guestDisplayName}
                                  </span>
                                </div>
                              ) : null}

                              {/* Rounds & Water Bottles Indicator */}
                              <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                                {roundsCount > 1 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-bold tabular-nums">
                                    Round {roundsCount}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-100/70 text-zinc-500 font-medium tabular-nums">
                                    Round 1
                                  </span>
                                )}

                                {waterCount > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200/80 font-bold flex items-center gap-0.5 tabular-nums">
                                    <GlassWater size={10} className="text-sky-500" /> {waterCount} Water
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-400 font-medium flex items-center gap-0.5">
                                    <GlassWater size={10} className="text-zinc-300" /> 0 Water
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between text-zinc-400 text-[11px] font-medium pt-0.5">
                                <span className="flex items-center gap-1 text-zinc-500">
                                  <Clock size={11} className="text-zinc-400" /> {elapsedMins}m
                                </span>
                                <span>{itemCount} dishes</span>
                              </div>
                              <div className="text-[16px] font-bold text-zinc-900 tabular-nums">
                                ₹{tableOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0).toFixed(0)}
                              </div>
                            </div>
                          );
                        })() : isBrowsing ? (
                          <div className="mt-3 flex flex-col items-center justify-center py-2 px-2 text-center bg-sky-50/60 rounded-xl border border-sky-200/60">
                            <span className="w-8 h-8 rounded-full bg-white text-sky-600 flex items-center justify-center mb-1 shadow-2xs">
                              <Smartphone size={15} className="animate-pulse text-sky-600" />
                            </span>
                            <span className="text-[12px] font-bold text-sky-950 flex items-center gap-1">
                              <span>Viewing Menu</span>
                              <span className="text-[10px] bg-sky-200 text-sky-800 px-1 rounded-full font-extrabold">{browsingCount}</span>
                            </span>
                            <span className="text-[10.5px] text-sky-600/80 mt-0.5 font-medium">Guest scanned QR · Active</span>
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-col items-center justify-center py-2 text-zinc-400">
                            <span className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 mb-1 border border-zinc-100">
                              <UtensilsCrossed size={14} strokeWidth={1.75} />
                            </span>
                            <span className="text-[11.5px] font-medium text-zinc-500">Available</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action: Big, easy touch target with zero overflow */}
                      <div className="pt-2 sm:pt-2.5 border-t border-zinc-100 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenOrderModal(table.name)}
                          className={`flex-1 min-w-0 py-2 px-2 sm:px-3 rounded-xl font-semibold text-[11.5px] sm:text-[12px] transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 truncate ${
                            isOccupied
                              ? 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200/80'
                              : 'bg-[#E46254] text-white hover:bg-[#d04e41] shadow-2xs'
                          }`}
                        >
                          <Plus size={12} strokeWidth={2.2} className="shrink-0" />
                          <span className="truncate">{isOccupied ? 'Add' : 'Seat & Order'}</span>
                        </button>

                        {(isOccupied || isBrowsing) && (
                          <button
                            onClick={() => setDetailTable(table)}
                            title="View Details"
                            className="w-8 h-8 rounded-xl bg-zinc-50 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center border border-zinc-200/80"
                          >
                            <ChevronRight size={13} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </main>
      </div>

      {/* ── MOBILE BOTTOM SHEET: INTERACTIVE TABLE DETAILS ── */}
      {detailTable && (() => {
        const tableOrders = activeOrders
          .filter(o => o.table_no.toLowerCase() === detailTable.name.toLowerCase() || o.table_no.toLowerCase().includes(detailTable.name.toLowerCase()))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Find ready order first (to mark served), or latest active order
        const readyOrder = tableOrders.find(o => o.status === 'SERVED');
        const order = readyOrder || tableOrders[0];
        const isOccupied = tableOrders.length > 0;
        const isCashCall = tableOrders.some(o => o.payment_status === 'CASH_REQUESTED');
        const isFoodReady = tableOrders.some(o => o.status === 'SERVED');
        const servedCount = tableOrders.filter(o => o.status === 'COMPLETED').length;
        const cookingCount = tableOrders.filter(o => o.status === 'PREPARING' || o.status === 'NEW').length;
        const isMultiRoundMixed = isOccupied && servedCount > 0 && cookingCount > 0 && !isFoodReady && !isCashCall;
        const isCooking = !isFoodReady && !isMultiRoundMixed && cookingCount > 0;
        const isAllFoodServed = isOccupied && !isFoodReady && cookingCount === 0 && tableOrders.every(o => o.status === 'COMPLETED');
        const elapsedMins = order ? Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)) : 0;
        const isBillRequested = tableOrders.some(o => o.payment_status === 'CASH_REQUESTED');

        return (
          <div 
            onClick={() => setDetailTable(null)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          >
            <div 
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 overflow-hidden pb-safe"
            >
              {/* Drag Handle Bar for Mobile */}
              <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1.5 rounded-full bg-zinc-300" />
              </div>

              {/* Sheet Header */}
              <div className="px-5 py-3 border-b border-zinc-100 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[20px] font-black text-zinc-900 tracking-tight">
                      {detailTable.name}
                    </h2>
                    {(() => {
                      const normDetail = normalizeTableIdentifier(detailTable.name);
                      const detailPast = pastOrdersHistory.filter(o => normalizeTableIdentifier(o.table_no) === normDetail && o.payment_status === 'PAID');
                      const detailActive = activeOrders.filter(o => normalizeTableIdentifier(o.table_no) === normDetail);
                      const { pin: detailPin } = resolveTablePinAndSeed(detailTable.name, detailActive, detailPast);
                      return (
                        <span className="px-2 py-0.5 rounded-lg bg-zinc-900 text-white font-mono text-[11px] font-bold flex items-center gap-1 shadow-xs" title="Give this PIN to seated guests">
                          <KeyRound size={11} className="text-amber-400" />
                          <span>PIN: {detailPin}</span>
                        </span>
                      );
                    })()}
                    {(() => {
                      const browsingInfo = activeBrowsingTables[detailTable.name];
                      const isBrowsing = !!browsingInfo && browsingInfo.count > 0;
                      return (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isCashCall
                            ? 'bg-amber-500 text-white'
                            : isFoodReady 
                            ? 'bg-emerald-600 text-white' 
                            : isMultiRoundMixed
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isCooking 
                            ? 'bg-[#E46254]/10 text-[#E46254]' 
                            : isAllFoodServed
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
                            : isOccupied 
                            ? 'bg-amber-100 text-amber-800' 
                            : isBrowsing 
                            ? 'bg-sky-100 text-sky-800 border border-sky-300' 
                            : 'bg-zinc-100 text-zinc-500'
                        }`}>
                          {isBrowsing && !isOccupied && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />}
                          {isCashCall 
                            ? 'Cash Requested' 
                            : isFoodReady 
                            ? 'Ready at Pass' 
                            : isMultiRoundMixed 
                            ? `Round ${servedCount} Served · Round ${tableOrders.length} Cooking` 
                            : isCooking 
                            ? 'Cooking in Kitchen' 
                            : isAllFoodServed 
                            ? 'Dining' 
                            : isOccupied 
                            ? 'Occupied' 
                            : isBrowsing 
                            ? 'Viewing Menu' 
                            : 'Available'}
                        </span>
                      );
                    })()}
                  </div>
                  {isOccupied && order ? (
                    <p className="text-[11.5px] text-zinc-400 mt-0.5 flex items-center gap-1 font-medium">
                      <Clock size={11} /> Seated {elapsedMins} mins ago · #{order.id.slice(0, 4).toUpperCase()}
                    </p>
                  ) : activeBrowsingTables[detailTable.name]?.count > 0 ? (
                    <p className="text-[11.5px] text-sky-600 mt-0.5 flex items-center gap-1 font-medium">
                      <Smartphone size={12} className="animate-pulse" /> {activeBrowsingTables[detailTable.name].count} device(s) connected · Browsing menu
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={() => setDetailTable(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-700 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Sheet Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 slim-scrollbar">
                {isOccupied ? (
                  <>
                    {/* 1. Urgency & Service Call Banner */}
                    {(() => {
                      const tableOrders = activeOrders.filter(o => o.table_no.toLowerCase() === detailTable.name.toLowerCase() || o.table_no.toLowerCase().includes(detailTable.name.toLowerCase()));
                      const callingOrders = tableOrders.filter(o => isCallWaiterOrder(o));
                      const isCalling = callingOrders.length > 0;

                      if (!isCalling) return null;

                      return (
                        <div className="p-3.5 rounded-2xl bg-amber-500 text-white flex items-center justify-between shadow-md animate-pulse">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                              <BellRing size={17} className="stroke-[2.5]" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-[13px] font-bold leading-tight">
                                Guest Called for Waiter / Assistance!
                              </h4>
                              <p className="text-[11px] opacity-90 truncate mt-0.5">
                                {callingOrders.some(o => o.payment_status === 'CASH_REQUESTED') 
                                  ? 'Guest requested cash settlement at table'
                                  : 'Guest pressed Call Staff button on mobile'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/20 shrink-0">
                            Action Needed
                          </span>
                        </div>
                      );
                    })()}

                    {/* 2. Simplified Clean Table Header (No visit counts, no favorite dishes) */}
                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0 font-bold text-[14px] shadow-2xs">
                          {order.customer_name ? order.customer_name.slice(0, 1).toUpperCase() : <User size={16} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-bold text-zinc-900 truncate">
                            {order.customer_name || 'Dine-in Guest'}
                          </h3>
                          <p className="text-[11px] text-zinc-400 mt-0.5 font-medium flex items-center gap-1.5">
                            {order.customer_phone ? (
                              <span><Phone size={10} className="inline mr-1 text-zinc-400" />{order.customer_phone}</span>
                            ) : (
                              <span>Table {detailTable.name} · Seated</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Total Running Bill */}
                      {(() => {
                        const tableOrders = activeOrders.filter(o => 
                          o.table_no.toLowerCase() === detailTable.name.toLowerCase() || 
                          o.table_no.toLowerCase().includes(detailTable.name.toLowerCase())
                        );
                        const grandTotal = tableOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                        return (
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                              Bill
                            </span>
                            <span className="text-[16px] font-black text-zinc-900 tabular-nums">
                              ₹{grandTotal.toFixed(0)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 3. Quick-Add Water Bottles Directly into Bill & Order */}
                    {(() => {
                      // Find configured water bottles from menuItems (or fallback standard options)
                      const waterMenuItems = menuItems.filter(m => 
                        (m.name || '').toLowerCase().includes('water') || 
                        (m.category || '').toLowerCase().includes('water')
                      );

                      const defaultWaterOptions = waterMenuItems.length > 0 ? waterMenuItems : [
                        { id: 'water_1l', name: 'Packaged Water (1 Litre)', base_price: 20 },
                        { id: 'water_500ml', name: 'Packaged Water (500ml)', base_price: 10 }
                      ];

                      // Count current water bottles ordered on this table
                      const tableOrders = activeOrders.filter(o => 
                        o.table_no.toLowerCase() === detailTable.name.toLowerCase() || 
                        o.table_no.toLowerCase().includes(detailTable.name.toLowerCase())
                      );
                      const totalWaterOrdered = tableOrders.reduce((sum, ord) => {
                        return sum + (ord.items_json || []).reduce((subSum, it) => {
                          const isWater = (it.item?.name || '').toLowerCase().includes('water');
                          return isWater ? subSum + (it.quantity || 1) : subSum;
                        }, 0);
                      }, 0);

                      return (
                        <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GlassWater size={16} className="text-sky-600" />
                              <span className="text-[12.5px] font-bold text-sky-950">Add Water Bottles to Table</span>
                            </div>
                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-sky-200/80 text-sky-900">
                              {totalWaterOrdered} on Bill
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {defaultWaterOptions.map((wItem) => (
                              <button
                                key={wItem.id || wItem.name}
                                onClick={() => handleAddWaterBottleToTable(wItem, detailTable.name)}
                                className="py-2 px-2.5 rounded-xl bg-white hover:bg-sky-100/70 border border-sky-200 text-sky-950 text-[11.5px] font-bold flex items-center justify-between transition-all cursor-pointer shadow-2xs active:scale-95"
                              >
                                <span className="truncate pr-1">
                                  + {wItem.name.replace('Packaged Water', 'Water').replace('Mineral Water', 'Water')}
                                </span>
                                <span className="text-sky-700 font-extrabold shrink-0 tabular-nums">
                                  ₹{wItem.base_price || 20}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4. Complete Dish Status Board: Ready at Pass vs Cooking in Kitchen */}
                    {(() => {
                      const tableOrders = activeOrders
                        .filter(o => o.table_no.toLowerCase() === detailTable.name.toLowerCase() || o.table_no.toLowerCase().includes(detailTable.name.toLowerCase()))
                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                      // Extract dishes into Served to Table vs Ready at Pass vs Still Cooking
                      const servedDishes: Array<{ name: string; qty: number; roundIdx: number; price: number; orderId: string }> = [];
                      const readyDishes: Array<{ name: string; qty: number; roundIdx: number; price: number; orderId: string }> = [];
                      const cookingDishes: Array<{ name: string; qty: number; roundIdx: number; price: number; orderId: string }> = [];

                      tableOrders.forEach((rnd, rIdx) => {
                        const isRndCompleted = rnd.status === 'COMPLETED';
                        const isRndReadyAtPass = rnd.status === 'SERVED';

                        (rnd.items_json || []).forEach(it => {
                          const itemObj = {
                            name: it.item?.name || 'Dish Item',
                            qty: it.quantity || 1,
                            roundIdx: rIdx + 1,
                            price: it.price || 0,
                            orderId: rnd.id
                          };

                          if (isRndCompleted || (it as any).isDelivered === true) {
                            servedDishes.push(itemObj);
                          } else if (isRndReadyAtPass || (it as any).isReady === true) {
                            readyDishes.push(itemObj);
                          } else {
                            cookingDishes.push(itemObj);
                          }
                        });
                      });

                      const totalItemsCount = servedDishes.reduce((s, d) => s + d.qty, 0) + readyDishes.reduce((s, d) => s + d.qty, 0) + cookingDishes.reduce((s, d) => s + d.qty, 0);

                      return (
                        <div className="space-y-3 pt-1">
                          {/* Dish summary headline */}
                          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                            <span>Live Kitchen & Pass Status</span>
                            <span>{totalItemsCount} Total Items ({tableOrders.length} {tableOrders.length === 1 ? 'Round' : 'Rounds'})</span>
                          </div>

                          {/* 🟢 Ready at Kitchen Pass (Ready for Waiter to Pick up & Serve) */}
                          {readyDishes.length > 0 && (
                            <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 space-y-2">
                              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                  <h4 className="text-[12px] font-black text-emerald-950 uppercase tracking-wide">
                                    Ready at Pass · Pick Up Now ({readyDishes.reduce((s, d) => s + d.qty, 0)})
                                  </h4>
                                </div>
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                                  Plated
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {readyDishes.map((dish, i) => (
                                  <div key={i} className="flex items-center justify-between text-[12.5px] bg-white/80 p-2 rounded-xl border border-emerald-100">
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[11px] font-extrabold shrink-0">
                                        {dish.qty}×
                                      </span>
                                      <span className="font-bold text-zinc-900 truncate">
                                        {dish.name}
                                      </span>
                                    </div>
                                    <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded shrink-0">
                                      Round {dish.roundIdx}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 🟡 Actively Cooking in Kitchen */}
                          {cookingDishes.length > 0 && (
                            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                              <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/50">
                                <div className="flex items-center gap-1.5">
                                  <Flame size={13} className="text-amber-600 animate-pulse" />
                                  <h4 className="text-[12px] font-black text-amber-950 uppercase tracking-wide">
                                    Still Cooking in Kitchen ({cookingDishes.reduce((s, d) => s + d.qty, 0)})
                                  </h4>
                                </div>
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                                  Cooking
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {cookingDishes.map((dish, i) => (
                                  <div key={i} className="flex items-center justify-between text-[12.5px] bg-white/80 p-2 rounded-xl border border-amber-100">
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 flex items-center justify-center text-[11px] font-extrabold shrink-0">
                                        {dish.qty}×
                                      </span>
                                      <span className="font-semibold text-zinc-800 truncate">
                                        {dish.name}
                                      </span>
                                    </div>
                                    <span className="text-[10.5px] font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded shrink-0">
                                      Round {dish.roundIdx}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 🍽️ Served to Table · Guests Dining */}
                          {servedDishes.length > 0 && (
                            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2">
                              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200/60">
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 size={13} className="text-emerald-600" />
                                  <h4 className="text-[12px] font-bold text-zinc-800 uppercase tracking-wide">
                                    Served to Table ({servedDishes.reduce((s, d) => s + d.qty, 0)})
                                  </h4>
                                </div>
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">
                                  Dining
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {servedDishes.map((dish, i) => (
                                  <div key={i} className="flex items-center justify-between text-[12.5px] bg-white p-2 rounded-xl border border-zinc-100">
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <span className="w-5 h-5 rounded-md bg-zinc-100 text-zinc-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                                        {dish.qty}×
                                      </span>
                                      <span className="font-medium text-zinc-700 truncate">
                                        {dish.name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0 border border-emerald-100">
                                      Served ✓
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {cookingDishes.length === 0 && readyDishes.length === 0 && servedDishes.length > 0 && (
                            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-semibold flex items-center gap-2 justify-center text-center">
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                              <span>All dishes served! Guests are happily dining.</span>
                            </div>
                          )}

                          {/* Guest Cooking Instructions Note */}
                          {(() => {
                            const cleanNote = extractUserNote(order.note);
                            if (!cleanNote) return null;
                            return (
                              <div className="p-2.5 rounded-xl bg-[#E46254]/8 border border-[#E46254]/20 text-[#E46254] text-[11.5px] font-semibold">
                                <strong>Note:</strong> {cleanNote}
                              </div>
                            );
                          })()}

                          {/* Detailed Ordered Rounds Accordion */}
                          <div className="space-y-2 pt-1">
                            <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                              All Ordered Rounds ({tableOrders.length})
                            </h4>

                            {tableOrders.map((rnd, rIdx) => {
                              const roundTime = new Date(rnd.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              const roundElapsed = Math.max(0, Math.floor((Date.now() - new Date(rnd.created_at).getTime()) / 60000));
                              const isCurrentRound = rIdx === tableOrders.length - 1;
                              const isRndReady = rnd.status === 'SERVED';

                              return (
                                <div key={rnd.id} className="p-3 rounded-2xl border border-zinc-200/90 bg-white shadow-2xs space-y-2">
                                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 text-[11.5px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`font-extrabold px-2 py-0.5 rounded-md ${
                                        isCurrentRound ? 'bg-[#E46254]/10 text-[#E46254]' : 'bg-zinc-100 text-zinc-800'
                                      }`}>
                                        Round {rIdx + 1} {isCurrentRound ? '· Current' : '· Past'}
                                      </span>
                                      <span className="text-zinc-400 font-medium">
                                        {roundTime} ({roundElapsed}m ago)
                                      </span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                      isRndReady 
                                        ? 'bg-emerald-100 text-emerald-800' 
                                        : rnd.status === 'COMPLETED'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                        : rnd.status === 'PREPARING'
                                        ? 'bg-amber-100 text-amber-800' 
                                        : rnd.status === 'NEW'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-zinc-100 text-zinc-600'
                                    }`}>
                                      {isRndReady ? 'Ready' : rnd.status === 'COMPLETED' ? 'Served ✓' : rnd.status === 'PREPARING' ? 'Cooking' : rnd.status === 'NEW' ? 'New Order' : rnd.status}
                                    </span>
                                  </div>

                                  <div className="space-y-1.5">
                                    {(rnd.items_json || []).map((it, idx) => {
                                      const dName = it.item?.name || 'Dish';
                                      const isItemCancelling = cancellingItemId === `${rnd.id}_${dName}`;
                                      return (
                                        <div key={idx} className="flex items-center justify-between text-[12px] py-1.5 px-2 rounded-xl border border-zinc-100 hover:border-zinc-200 bg-white transition-colors">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-bold text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px] tabular-nums shrink-0">
                                              {it.quantity || 1}×
                                            </span>
                                            <span className="text-zinc-900 font-semibold truncate">{dName}</span>
                                          </div>
                                          <div className="flex items-center gap-2.5 shrink-0">
                                            <span className="font-bold text-zinc-700 tabular-nums text-[12.5px]">
                                              ₹{((it.price || 0) * (it.quantity || 1)).toFixed(0)}
                                            </span>
                                            {rnd.payment_status !== 'PAID' && rnd.status !== 'COMPLETED' && (
                                              <button
                                                type="button"
                                                disabled={isItemCancelling}
                                                onClick={() => handleCancelItemFromCaptain(rnd, dName, it.quantity || 1)}
                                                title={rnd.status === 'PREPARING' ? "Cancel item & sound Kitchen Hold Siren" : "Remove item from table"}
                                                className="w-6 h-6 rounded-lg bg-zinc-50 hover:bg-red-50 text-zinc-400 hover:text-red-600 border border-zinc-200/80 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                                              >
                                                {isItemCancelling ? (
                                                  <Loader2 size={11} className="animate-spin text-red-500" />
                                                ) : (
                                                  <Trash2 size={11} />
                                                )}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* NEW TABLE REQUEST: Captain verification gate before kitchen cooks */}
                                  {rnd.status === 'NEW' && (
                                    <div className="pt-2.5 border-t border-blue-100/80 bg-blue-50/40 -mx-3 -mb-3 p-3 rounded-b-2xl flex flex-col gap-2">
                                      <div className="flex items-center gap-1.5 text-blue-900 text-[11px] font-bold">
                                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                        <span>New Guest Request · Awaiting Verification</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          disabled={detailActionLoading}
                                          onClick={() => handleAcceptAndFireKot(rnd)}
                                          className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-[12px] rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                        >
                                          <Check size={14} strokeWidth={3} />
                                          <span>Accept & Fire KOT</span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={detailActionLoading}
                                          onClick={() => handleRejectRound(rnd)}
                                          className="py-2.5 px-3 bg-white hover:bg-red-50 active:scale-[0.98] text-red-600 font-bold text-[12px] rounded-xl flex items-center justify-center gap-1 border border-red-200 transition-all cursor-pointer"
                                        >
                                          <X size={14} strokeWidth={2.5} />
                                          <span>Reject</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="text-center py-10 text-zinc-400">
                    <UtensilsCrossed size={32} className="mx-auto mb-2.5 text-zinc-300 stroke-[1.5]" />
                    <h3 className="text-[14px] font-bold text-zinc-700">Table is Available</h3>
                    <p className="text-[11.5px] text-zinc-400 mt-1 max-w-xs mx-auto">
                      No active orders on {detailTable.name}. Tap below to seat guests and take an order.
                    </p>
                  </div>
                )}
              </div>

              {/* Sheet Mobile Thumb Actions */}
              <div className="p-4 border-t border-zinc-100 bg-white space-y-2">
                {isOccupied ? (
                  <>
                    {/* Verify UPI & Settle Table button (When guest submits UPI payment) */}
                    {tableOrders.some(o => o.payment_status === 'UPI_VERIFICATION_PENDING') && (
                      <button
                        disabled={detailActionLoading}
                        onClick={() => handleVerifyUpiAndSettle(order)}
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-[13.5px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 animate-pulse"
                      >
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                        <span>Verify UPI Payment & Confirm Settlement</span>
                      </button>
                    )}

                    {/* Mark as Delivered (when food is ready at pass) */}
                    {isFoodReady && (
                      <button
                        disabled={detailActionLoading}
                        onClick={() => handleMarkDelivered(order, detailTable.name)}
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-[13.5px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
                      >
                        <Check size={18} strokeWidth={3} />
                        <span>Mark Served to Guests</span>
                      </button>
                    )}

                    {/* Bill Requested: Tabletop Settle Action Panel (Koi Resto-Bar flow) */}
                    {isBillRequested && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                            <h4 className="text-[12.5px] font-bold text-amber-950">
                              Bill Requested · ₹{tableOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0).toFixed(0)}
                            </h4>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                            Collect Bill
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                          <button
                            type="button"
                            disabled={detailActionLoading}
                            onClick={() => handleClearTable(order, 'CASH')}
                            className="py-2.5 px-2 rounded-xl bg-white hover:bg-zinc-50 border border-amber-300 text-amber-950 font-bold text-[11.5px] flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <Banknote size={16} className="text-amber-600" />
                            <span>Cash</span>
                          </button>

                          <button
                            type="button"
                            disabled={detailActionLoading}
                            onClick={() => handleClearTable(order, 'EDC')}
                            className="py-2.5 px-2 rounded-xl bg-white hover:bg-zinc-50 border border-amber-300 text-amber-950 font-bold text-[11.5px] flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <CreditCard size={16} className="text-amber-600" />
                            <span>Paytm EDC</span>
                          </button>

                          <button
                            type="button"
                            disabled={detailActionLoading}
                            onClick={() => {
                              const totalBill = tableOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                              setDynamicQrTable({
                                tableName: detailTable.name,
                                tableBill: totalBill,
                                orders: tableOrders
                              });
                            }}
                            className="py-2.5 px-2 rounded-xl bg-[#E46254] hover:bg-[#c95346] text-white font-bold text-[11.5px] flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <QrCode size={16} className="text-white" />
                            <span>Show QR</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Add More Items to Table & Full Bill */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setDetailTable(null);
                          handleOpenOrderModal(detailTable.name);
                        }}
                        className="py-3 px-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-800 font-bold text-[12.5px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                      >
                        <Plus size={15} strokeWidth={2.5} />
                        <span>Add Items</span>
                      </button>

                      {/* View Bill Receipt Modal Button */}
                      <button
                        onClick={() => setIsViewingBill(true)}
                        className="py-3 px-3 rounded-2xl bg-zinc-900 hover:bg-black active:scale-95 text-white font-bold text-[12.5px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      >
                        <Receipt size={15} />
                        <span>View Full Bill</span>
                      </button>
                    </div>

                    {/* Quick Virtual Terminal QR & Clear Table row */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        disabled={detailActionLoading}
                        onClick={() => {
                          const totalBill = tableOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                          setDynamicQrTable({
                            tableName: detailTable.name,
                            tableBill: totalBill,
                            orders: tableOrders
                          });
                        }}
                        className="py-2.5 px-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                      >
                        <QrCode size={14} className="text-zinc-500" />
                        <span>Show Table QR</span>
                      </button>

                      <button
                        disabled={detailActionLoading}
                        onClick={() => handleClearTable(order)}
                        className="py-2.5 px-3 rounded-xl border border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-600 text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                      >
                        <span>Clear Table</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setDetailTable(null);
                      handleOpenOrderModal(detailTable.name);
                    }}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#E46254] hover:bg-[#d04e41] active:bg-[#c23b2e] text-white font-extrabold text-[13.5px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    <span>Take Walk-in Order</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── WAITER BILL / RECEIPT BREAKDOWN MODAL ── */}
      {isViewingBill && detailTable && (() => {
        const tableOrders = activeOrders
          .filter(o => o.table_no.toLowerCase() === detailTable.name.toLowerCase() || o.table_no.toLowerCase().includes(detailTable.name.toLowerCase()))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        const subtotal = tableOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const gst = Number((subtotal * 0.05).toFixed(2));
        const grandTotal = subtotal + gst;

        return (
          <div 
            onClick={() => setIsViewingBill(false)}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          >
            <div 
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            >
              {/* Receipt Header */}
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
                    <Receipt size={16} />
                  </div>
                  <div>
                    <h3 className="text-[14.5px] font-black text-zinc-900">
                      Table Bill · {detailTable.name}
                    </h3>
                    <p className="text-[11px] text-zinc-400 font-medium">
                      {tableOrders.length} {tableOrders.length === 1 ? 'Round' : 'Rounds'} · Detailed Receipt
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsViewingBill(false)}
                  className="w-8 h-8 rounded-full bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Receipt Body */}
              <div className="p-4 overflow-y-auto slim-scrollbar space-y-4 flex-1">
                {tableOrders.map((rnd, rIdx) => (
                  <div key={rnd.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-100">
                      <span>Round {rIdx + 1} ({new Date(rnd.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                      <span className="text-zinc-700">₹{Number(rnd.total || 0).toFixed(0)}</span>
                    </div>

                    <div className="space-y-1">
                      {(rnd.items_json || []).map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[12.5px]">
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            <span className="text-zinc-400 font-bold">{it.quantity || 1}×</span>
                            <span className="text-zinc-800 truncate font-medium">{it.item?.name || 'Dish'}</span>
                          </div>
                          <span className="text-zinc-700 font-bold tabular-nums shrink-0">
                            ₹{((it.price || 0) * (it.quantity || 1)).toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Calculation summary */}
                <div className="pt-3 border-t border-dashed border-zinc-200 space-y-1.5 text-[12px] text-zinc-500">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-bold text-zinc-800">₹{subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span className="tabular-nums font-bold text-zinc-800">₹{gst.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-zinc-200 text-[15px] font-black text-zinc-950">
                    <span>Total Bill</span>
                    <span className="tabular-nums">₹{grandTotal.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {/* Receipt Footer Action */}
              <div className="p-3.5 border-t border-zinc-100 bg-zinc-50 flex items-center gap-2">
                <button
                  onClick={() => setIsViewingBill(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white text-[12.5px] font-bold hover:bg-black transition-colors cursor-pointer text-center"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MOBILE BOTTOM SHEET: CATEGORY-TABBED QUICK WALK-IN ORDER ── */}
      {isOrderModalOpen && (() => {
        // Derive categories dynamically from menuItems
        const allCategories = ['ALL', ...Array.from(new Set(menuItems.map(m => m.category || 'Mains').filter(Boolean)))];

        return (
          <div 
            onClick={() => setIsOrderModalOpen(false)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          >
            <div 
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl h-[92vh] sm:h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 pb-safe"
            >
              {/* Drag Handle Bar for mobile */}
              <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1.5 rounded-full bg-zinc-300" />
              </div>

              {/* Modal Header */}
              <div className="px-5 py-2.5 border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-black text-zinc-900 tracking-tight leading-none">
                    Take Order · {selectedTable}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 font-medium">
                    Direct floor ordering synced to KDS
                  </p>
                </div>

                <button
                  onClick={() => setIsOrderModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-700 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Guest Profile & Floor Intelligence Card */}
              <div className="p-3 bg-zinc-50/90 border-b border-zinc-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={12} className="text-zinc-400" />
                    Guest Profile & Preferences
                  </span>
                  {guestNameInput && (
                    <span className="text-[11px] font-semibold text-[#E46254]">
                      {guestNameInput}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={guestNameInput}
                      onChange={e => setGuestNameInput(e.target.value)}
                      placeholder="Guest Name (e.g. Rahul)"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-[12px] font-medium placeholder-zinc-400 focus:outline-none focus:border-[#E46254]"
                    />
                  </div>

                  <div className="relative">
                    <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="tel"
                      value={guestPhoneInput}
                      onChange={e => setGuestPhoneInput(e.target.value)}
                      placeholder="Phone / WhatsApp"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-[12px] font-medium placeholder-zinc-400 focus:outline-none focus:border-[#E46254]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={guestSpecialNoteInput}
                      onChange={e => setGuestSpecialNoteInput(e.target.value)}
                      placeholder="Guest allergies / preferences..."
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-[11.5px] font-medium placeholder-zinc-400 focus:outline-none focus:border-[#E46254]"
                    />
                  </div>
                  <div>
                    <select
                      value={guestPaxInput}
                      onChange={e => setGuestPaxInput(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-xl bg-white border border-zinc-200 text-[11.5px] font-semibold text-zinc-700 focus:outline-none focus:border-[#E46254]"
                    >
                      <option value="1">1 Guest</option>
                      <option value="2">2 Guests</option>
                      <option value="3">3 Guests</option>
                      <option value="4">4 Guests</option>
                      <option value="5">5 Guests</option>
                      <option value="6">6+ Guests</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Menu Search Bar */}
              <div className="p-3 border-b border-zinc-100 bg-white">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={e => setMenuSearch(e.target.value)}
                    placeholder="Search dishes (e.g. Fries, Tikka)..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-[13px] focus:outline-none focus:border-[#E46254] font-medium"
                  />
                </div>
              </div>

              {/* Category Pills Bar */}
              <div className="px-3.5 py-2 border-b border-zinc-100 bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedMenuCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
                      selectedMenuCategory === cat
                        ? 'bg-[#E46254] text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Dishes Selector */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 slim-scrollbar">
                {menuItems
                  .filter(m => {
                    const matchesSearch = !menuSearch || m.name.toLowerCase().includes(menuSearch.toLowerCase());
                    const matchesCategory = selectedMenuCategory === 'ALL' || (m.category || 'Mains').toLowerCase() === selectedMenuCategory.toLowerCase();
                    return matchesSearch && matchesCategory;
                  })
                  .map(dish => {
                    const inCart = orderCart.find(c => c.item.id === dish.id);

                    return (
                      <div
                        key={dish.id}
                        className={`p-3.5 rounded-2xl border transition-all bg-white shadow-2xs ${
                          inCart ? 'border-[#E46254]/50 ring-1 ring-[#E46254]/20' : 'border-zinc-200/80 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${dish.is_veg === false ? 'bg-red-500' : 'bg-emerald-500'}`} />
                              <h4 className="text-[14px] font-bold text-zinc-900 leading-snug truncate">
                                {dish.name}
                              </h4>
                            </div>
                            <span className="text-[13px] font-extrabold text-[#E46254] tabular-nums mt-0.5 block">
                              ₹{dish.base_price}
                            </span>
                          </div>

                          {inCart ? (
                            <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl shrink-0">
                              <button
                                onClick={() => handleUpdateCartCount(dish.id, -1)}
                                className="w-8 h-8 rounded-lg bg-white text-zinc-800 font-black flex items-center justify-center text-[15px] shadow-xs cursor-pointer active:scale-90"
                              >
                                -
                              </button>
                              <span className="text-[13px] font-black text-zinc-900 w-6 text-center tabular-nums">
                                {inCart.count}
                              </span>
                              <button
                                onClick={() => handleUpdateCartCount(dish.id, 1)}
                                className="w-8 h-8 rounded-lg bg-[#E46254] text-white font-black flex items-center justify-center text-[15px] shadow-xs cursor-pointer active:scale-90"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddDishToCart(dish)}
                              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-[#E46254] text-white font-black text-[12px] transition-colors cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                            >
                              + Add
                            </button>
                          )}
                        </div>

                        {/* When dish is selected: Toast-style Course Selector & Kitchen Modifier Note */}
                        {inCart && (
                          <div className="mt-3 pt-2.5 border-t border-zinc-100 space-y-2 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-bold text-zinc-400 uppercase tracking-wider">Course:</span>
                              <div className="flex items-center gap-1">
                                {(['STARTER', 'MAIN', 'BEVERAGE', 'DESSERT'] as const).map(c => (
                                  <button
                                    key={c}
                                    onClick={() => handleUpdateCartCourse(dish.id, c)}
                                    className={`px-2 py-0.5 rounded-lg font-black text-[10px] uppercase transition-all cursor-pointer ${
                                      (inCart.course || 'MAIN') === c
                                        ? 'bg-[#E46254] text-white shadow-2xs'
                                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                    }`}
                                  >
                                    {c === 'STARTER' ? 'Starter' : c === 'MAIN' ? 'Main' : c === 'BEVERAGE' ? 'Drinks' : 'Sweet'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <input
                              type="text"
                              value={inCart.note || ''}
                              onChange={e => handleUpdateCartNote(dish.id, e.target.value)}
                              placeholder="Kitchen instruction (e.g. less spicy, no onion)..."
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-[11.5px] text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#E46254]"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Mobile Cart Footer with sticky thumb fire button (Toast Go / Petpooja style) */}
              {orderCart.length > 0 && (
                <div className="p-4 border-t border-zinc-200 bg-white space-y-3 shadow-lg">
                  <div className="flex items-center justify-between text-[13px] px-1">
                    <div>
                      <span className="font-bold text-zinc-500 block leading-tight">
                        {orderCart.reduce((s, x) => s + x.count, 0)} Items Selected
                      </span>
                      <span className="text-[11px] text-zinc-400 font-medium">
                        KOT routes to Starters & Mains automatically
                      </span>
                    </div>
                    <span className="font-black text-zinc-900 text-[20px] tabular-nums">
                      ₹{orderCart.reduce((s, x) => s + (x.item.base_price * x.count), 0)}
                    </span>
                  </div>

                  <button
                    disabled={submittingOrder}
                    onClick={handleSubmitCaptainOrder}
                    className="w-full py-4 px-4 rounded-2xl bg-[#E46254] hover:bg-[#d04e41] active:bg-[#c23b2e] text-white font-black text-[15px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {submittingOrder ? <Loader2 size={18} className="animate-spin" /> : <span>Send KOT to Kitchen & Bar 🔥</span>}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── MODAL 1: Captain Item Cancellation & Kitchen Hold Alert ── */}
      {captainCancelConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner ${
              captainCancelConfirm.isCooking ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-zinc-100 text-zinc-700'
            }`}>
              {captainCancelConfirm.isCooking ? <Flame size={24} /> : <Trash2 size={22} />}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mb-2 uppercase tracking-wider"
              style={{
                backgroundColor: captainCancelConfirm.isCooking ? '#FEE2E2' : '#F4F4F5',
                color: captainCancelConfirm.isCooking ? '#DC2626' : '#52525B'
              }}
            >
              {captainCancelConfirm.isCooking ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                  <span>Kitchen Cooking ({captainCancelConfirm.round.status})</span>
                </>
              ) : (
                <span>Round (Unfired)</span>
              )}
            </div>

            <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">
              {captainCancelConfirm.isCooking ? "Halt Kitchen & Cancel Item?" : "Remove Item from Order?"}
            </h4>

            <p className="text-[14px] font-bold text-zinc-800 mt-2">
              Cancel 1× &ldquo;{captainCancelConfirm.itemName}&rdquo; on {captainCancelConfirm.round.table_no}
            </p>

            {captainCancelConfirm.isCooking ? (
              <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200/90 text-[12px] text-rose-900 text-left leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-rose-950 mb-1">
                  <AlertOctagon size={14} className="shrink-0 text-rose-600" />
                  Kitchen Siren & Hold Card will trigger!
                </p>
                Confirming immediately sounds the urgent Hold Siren on the Kitchen KDS terminal to stop chefs from preparing this dish.
              </div>
            ) : (
              <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
                This item has not yet been prepared. It will be removed cleanly from {captainCancelConfirm.round.table_no}.
              </p>
            )}

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCaptainCancelConfirm(null)}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
              >
                Keep Item
              </button>
              <button
                type="button"
                onClick={handleExecuteCaptainCancelItem}
                className={`flex-1 py-3 font-bold rounded-2xl text-[12.5px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 text-white ${
                  captainCancelConfirm.isCooking
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                    : 'bg-zinc-900 hover:bg-black'
                }`}
              >
                {captainCancelConfirm.isCooking ? (
                  <>
                    <Octagon size={14} />
                    <span>Halt & Cancel</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Clear & Release Table Confirmation ── */}
      {clearTableConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner ${
              clearTableConfirm.tenderMethod ? 'bg-emerald-100 text-emerald-700' : clearTableConfirm.isUnpaid ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {clearTableConfirm.tenderMethod === 'CASH' ? (
                <Banknote size={24} />
              ) : clearTableConfirm.tenderMethod === 'EDC' ? (
                <CreditCard size={24} />
              ) : clearTableConfirm.tenderMethod === 'UPI_QR' ? (
                <QrCode size={24} />
              ) : clearTableConfirm.isUnpaid ? (
                <AlertCircle size={24} />
              ) : (
                <CheckCircle2 size={24} />
              )}
            </div>

            <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">
              {clearTableConfirm.tenderMethod === 'CASH'
                ? `Confirm Cash Settle · Table ${clearTableConfirm.tableName}`
                : clearTableConfirm.tenderMethod === 'EDC'
                ? `Confirm Paytm EDC · Table ${clearTableConfirm.tableName}`
                : clearTableConfirm.tenderMethod === 'UPI_QR'
                ? `Confirm UPI QR Settle · Table ${clearTableConfirm.tableName}`
                : `Release Table ${clearTableConfirm.tableName}?`}
            </h4>

            {clearTableConfirm.tenderMethod ? (
              <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-[12.5px] text-emerald-950 text-left leading-relaxed">
                <p className="font-extrabold text-[13px] text-emerald-950 mb-1 flex items-center justify-between">
                  <span>Bill Total</span>
                  <span className="tabular-nums">₹{clearTableConfirm.tableBill.toFixed(0)}</span>
                </p>
                Settle payment via <strong>{clearTableConfirm.tenderMethod === 'CASH' ? 'Cash' : clearTableConfirm.tenderMethod === 'EDC' ? 'Paytm / Card Machine' : 'Dynamic UPI QR'}</strong>. Customer phones will immediately receive the digital Thank You invoice.
              </div>
            ) : clearTableConfirm.isUnpaid ? (
              <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200/90 text-[12px] text-amber-900 text-left leading-relaxed">
                <p className="font-bold flex items-center gap-1 text-amber-950 mb-1">
                  Outstanding Bill: ₹{clearTableConfirm.tableBill.toFixed(0)}
                </p>
                Clearing will mark all rounds as settled and free Table {clearTableConfirm.tableName} for new arriving guests.
              </div>
            ) : (
              <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
                All rounds are settled. Clearing will reset guest menus and mark Table {clearTableConfirm.tableName} vacant.
              </p>
            )}

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setClearTableConfirm(null)}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
              >
                Keep Open
              </button>
              <button
                type="button"
                disabled={detailActionLoading}
                onClick={handleExecuteClearTable}
                className="flex-1 py-3 bg-zinc-900 hover:bg-black text-white font-bold rounded-2xl text-[12.5px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                {detailActionLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>{clearTableConfirm.tenderMethod ? 'Confirm & Settle' : 'Clear Table'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Verify UPI Payment Confirmation ── */}
      {verifyUpiConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Smartphone size={24} />
            </div>

            <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">Confirm UPI Payment?</h4>
            <p className="text-[13.5px] text-zinc-600 mt-2 leading-relaxed">
              Verify receipt of <strong className="text-zinc-900 text-[15px]">₹{verifyUpiConfirm.tableBill.toFixed(0)}</strong> for Table {verifyUpiConfirm.tableName}.
            </p>
            <p className="text-[11.5px] text-zinc-400 mt-1">
              This confirms the guest&apos;s digital bill and marks the table settled.
            </p>

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setVerifyUpiConfirm(null)}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={detailActionLoading}
                onClick={handleExecuteVerifyUpi}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-[12.5px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                {detailActionLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>Verify & Settle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: TableTapy Virtual Terminal Dynamic Table QR ── */}
      {dynamicQrTable && (() => {
        const merchantVpa = (restaurant as any)?.upi_id || (restaurant as any)?.upi_vpa || "payments@tabletapy";
        const upiDeepLink = `upi://pay?pa=${merchantVpa}&pn=${encodeURIComponent(restaurant?.name || 'Restaurant')}&am=${dynamicQrTable.tableBill.toFixed(0)}&cu=INR&tn=${encodeURIComponent(`Table ${dynamicQrTable.tableName} Bill`)}`;

        return (
          <div 
            onClick={() => setDynamicQrTable(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150"
          >
            <div 
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150 flex flex-col items-center"
            >
              <div className="flex items-center justify-between w-full pb-3 border-b border-zinc-100">
                <div className="text-left">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#E46254]/10 text-[#E46254]">
                    Virtual Terminal
                  </span>
                  <h3 className="text-[17px] font-black text-zinc-900 mt-1">
                    Table {dynamicQrTable.tableName}
                  </h3>
                </div>
                <button
                  onClick={() => setDynamicQrTable(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm mt-4">
                <QRCode 
                  value={upiDeepLink} 
                  size={190} 
                  level="M"
                />
              </div>

              <div className="mt-3">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Total Bill Amount
                </span>
                <h2 className="text-[28px] font-black text-zinc-950 tabular-nums">
                  ₹{dynamicQrTable.tableBill.toFixed(0)}
                </h2>
                <p className="text-[11.5px] text-zinc-500 mt-0.5">
                  Pre-filled in GPay, PhonePe, Paytm, BHIM, Cred
                </p>
              </div>

              <p className="text-[11.5px] text-zinc-500 mt-3 bg-zinc-50 border border-zinc-200/70 p-2.5 rounded-xl w-full text-center">
                Guest scans directly from your phone screen. Once soundbox chimes or payment is verified, tap below.
              </p>

              <div className="mt-4 w-full flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDynamicQrTable(null)}
                  className="py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetOrder = dynamicQrTable.orders[0];
                    setDynamicQrTable(null);
                    handleClearTable(targetOrder, 'UPI_QR');
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-[12.5px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>Confirm & Settle</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
