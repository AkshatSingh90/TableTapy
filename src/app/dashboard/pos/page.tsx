"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  X,
  Check,
  Tag,
  ChefHat,
  Printer,
  Clock,
  Sparkles,
  LayoutGrid,
  UtensilsCrossed,
  ArrowRight,
  RotateCcw,
  User,
  Phone,
  Flame,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import QRCode from "react-qr-code";
import { createClient } from "@/utils/supabase/client";

/* ─── Interfaces ─────────────────────────────────────────── */
interface MenuItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  base_price: number;
  description?: string;
  is_veg: boolean;
  is_available: boolean;
}

interface Location {
  id: string;
  name: string;
  type?: string;
  capacity?: number;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  category?: string;
  notes?: string;
  isFired?: boolean; // true = already sent to kitchen (KOT)
  firedAt?: string;
}

interface ActiveOrderRecord {
  id: string;
  restaurant_id: string;
  table_no: string;
  total: number;
  status: "NEW" | "PREPARING" | "SERVED" | "COMPLETED" | "CANCELLED";
  payment_status: "PENDING" | "PAID";
  payment_method?: string;
  customer_name?: string;
  customer_phone?: string;
  items_json: any[];
  created_at: string;
  note?: string;
}

interface TableSessionState {
  table_no: string;
  status: "VACANT" | "OCCUPIED" | "BILLED";
  activeOrders: ActiveOrderRecord[];
  firedItems: OrderItem[];
  runningTotal: number;
  firstOrderTime?: string;
  customerName?: string;
  customerPhone?: string;
}

type PaymentMethod = "CASH" | "UPI" | "CARD";

export default function PosTerminalPage() {
  const supabase = createClient();

  // Core Data State
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("Restaurant");
  const [upiId, setUpiId] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [rawOrders, setRawOrders] = useState<ActiveOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View Mode: 'TABLES' (Floor view) or 'ORDER_PAD' (Menu & Cart)
  const [activeView, setActiveView] = useState<"TABLES" | "ORDER_PAD">("TABLES");

  // Selected Table & Guest Details
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [guestCount, setGuestCount] = useState<number>(2);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Cart (Items added in the current ordering round)
  const [cart, setCart] = useState<OrderItem[]>([]);

  // Menu Search & Category
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Discount State
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Settlement & Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Thermal Print State
  const [printChit, setPrintChit] = useState<{
    type: "KOT" | "BILL";
    tableNo: string;
    kotNumber?: number;
    items: { name: string; quantity: number; notes?: string; price?: number }[];
    subtotal?: number;
    tax?: number;
    discount?: number;
    grandTotal?: number;
    time: string;
  } | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ─── 1. Load Initial Data & Realtime Sync ────────────────────────── */
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const restId = user?.user_metadata?.restaurant_id;
      if (!restId) {
        setIsLoading(false);
        return;
      }
      setRestaurantId(restId);

      // 1. Restaurant profile
      const { data: rest } = await supabase
        .from("restaurants")
        .select("id, name, upi_id")
        .eq("id", restId)
        .maybeSingle();

      if (rest) {
        if (rest.name) setRestaurantName(rest.name);
        if (rest.upi_id) setUpiId(rest.upi_id);
      }

      // 2. Locations / Tables
      const { data: locData } = await supabase
        .from("locations")
        .select("*")
        .eq("restaurant_id", restId)
        .order("name", { ascending: true });

      let loadedLocs: Location[] = [];
      if (locData && locData.length > 0) {
        loadedLocs = locData.map((l: any) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          capacity: l.capacity || 4,
        }));
      } else {
        // Fallback default floor tables
        loadedLocs = [
          { id: "t1", name: "Table 01", capacity: 2 },
          { id: "t2", name: "Table 02", capacity: 4 },
          { id: "t3", name: "Table 03", capacity: 4 },
          { id: "t4", name: "Table 04", capacity: 6 },
          { id: "t5", name: "Table 05", capacity: 2 },
          { id: "t6", name: "Table 06", capacity: 4 },
          { id: "t7", name: "Table 07", capacity: 8 },
          { id: "t8", name: "Table 08", capacity: 4 },
        ];
      }
      setLocations(loadedLocs);
      if (!selectedTable && loadedLocs.length > 0) {
        setSelectedTable(loadedLocs[0].name);
      }

      // 3. Menu items (strict tenant isolation)
      const { data: menuData } = await supabase
        .from("menu_items_v2")
        .select("*")
        .eq("restaurant_id", restId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (menuData) {
        setMenuItems(
          menuData.map((row: any) => ({
            id: row.id,
            name: row.name,
            category: row.category || "Main Course",
            subcategory: row.subcategory || "",
            base_price: Number(row.base_price || 0),
            description: (row.description || "").replace(/\[REST:[^\]]+\]\s*/, ""),
            is_veg: row.is_veg !== false,
            is_available: row.is_available !== false,
          }))
        );
      }

      // 4. Active Orders across tables
      await fetchActiveOrders(restId);
    } catch (err) {
      console.error("Error loading POS data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveOrders = async (restId: string) => {
    const { data: orderData } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restId)
      .in("status", ["NEW", "PREPARING", "SERVED"])
      .order("created_at", { ascending: true });

    if (orderData) {
      setRawOrders(orderData as ActiveOrderRecord[]);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Supabase Realtime channel: listen to live order updates, kitchen KDS bumps, and menu 86 availability
    const channel = supabase
      .channel("pos_dinein_live_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (restaurantId) fetchActiveOrders(restaurantId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "menu_items_v2" },
        (payload) => {
          const updated = payload.new as any;
          if (updated && updated.id) {
            setMenuItems((prev) =>
              prev.map((item) =>
                item.id === updated.id
                  ? { ...item, is_available: updated.is_available !== false }
                  : item
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowPaymentModal(false);
        setShowDiscountModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ─── 2. Build Table Sessions State (Occupied, Vacant, Billed) ───── */
  const tableSessions = useMemo(() => {
    const map = new Map<string, TableSessionState>();

    // Initialize all floor tables as VACANT
    locations.forEach((loc) => {
      map.set(loc.name, {
        table_no: loc.name,
        status: "VACANT",
        activeOrders: [],
        firedItems: [],
        runningTotal: 0,
      });
    });

    // Populate with running orders from database
    rawOrders.forEach((ord) => {
      if (!ord.table_no) return;
      let session = map.get(ord.table_no);
      if (!session) {
        session = {
          table_no: ord.table_no,
          status: "VACANT",
          activeOrders: [],
          firedItems: [],
          runningTotal: 0,
        };
        map.set(ord.table_no, session);
      }

      session.activeOrders.push(ord);
      session.status = ord.note?.includes("[POS Bill Printed]") ? "BILLED" : "OCCUPIED";
      if (!session.firstOrderTime || new Date(ord.created_at) < new Date(session.firstOrderTime)) {
        session.firstOrderTime = ord.created_at;
      }
      if (ord.customer_name && !session.customerName) {
        session.customerName = ord.customer_name;
      }
      if (ord.customer_phone && !session.customerPhone) {
        session.customerPhone = ord.customer_phone;
      }

      // Aggregate all items previously fired to kitchen
      const rawItems: any[] = Array.isArray(ord.items_json) ? ord.items_json : [];
      rawItems.forEach((it, idx) => {
        const itemObj = it.item || it;
        session!.firedItems.push({
          id: `${ord.id}_${itemObj.id || idx}`,
          name: itemObj.name || "Item",
          price: Number(it.price || itemObj.basePrice || itemObj.price || 0),
          quantity: Number(it.quantity || 1),
          isVeg: itemObj.isVeg ?? itemObj.is_veg ?? true,
          category: itemObj.category,
          notes: it.notes || "",
          isFired: true,
          firedAt: ord.created_at,
        });
        session!.runningTotal += Number(it.price || itemObj.basePrice || 0) * Number(it.quantity || 1);
      });
    });

    return Array.from(map.values());
  }, [locations, rawOrders]);

  // Current selected table session
  const currentSession = useMemo(() => {
    return tableSessions.find((s) => s.table_no === selectedTable) || null;
  }, [tableSessions, selectedTable]);

  // When clicking a table from the Floor View
  const handleSelectTable = (tableNo: string) => {
    setSelectedTable(tableNo);
    const s = tableSessions.find((t) => t.table_no === tableNo);
    if (s && s.customerName) setCustomerName(s.customerName);
    if (s && s.customerPhone) setCustomerPhone(s.customerPhone);
    setActiveView("ORDER_PAD");
  };

  /* ─── 3. Menu Categories & Filtered Items ────────────────────────── */
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return ["ALL", ...Array.from(set)];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (item.is_available === false) return false;
      if (vegOnly && !item.is_veg) return false;
      if (selectedCategory !== "ALL" && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.subcategory && item.subcategory.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery, vegOnly]);

  /* ─── 4. Cart Operations (Adding / Stepping items) ────────────────── */
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.base_price,
          quantity: 1,
          isVeg: item.is_veg,
          category: item.category,
          isFired: false,
        },
      ];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.id === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  /* ─── 5. Billing Calculations ────────────────────────────────────── */
  // Combined Items = Previously Fired Items on table + Unfired Cart Items
  const allTableItems = useMemo(() => {
    const fired = currentSession?.firedItems || [];
    return [...fired, ...cart];
  }, [currentSession, cart]);

  const subtotal = useMemo(() => {
    return allTableItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [allTableItems]);

  const effectiveDiscount = useMemo(() => {
    if (discountMode === "PERCENT") {
      return (subtotal * discountPercent) / 100;
    }
    return Math.min(subtotal, discountAmount);
  }, [subtotal, discountMode, discountPercent, discountAmount]);

  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const taxTotal = (taxableAmount * 5) / 100; // Standard Indian 5% Restaurant GST
  const grandTotal = Math.round(taxableAmount + taxTotal);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - grandTotal);
  }, [cashTendered, grandTotal]);

  /* ─── 6. FIRE KOT ACTION (Send to Kitchen Display & Print KOT Chit) ── */
  const handleFireKOT = async () => {
    if (cart.length === 0) {
      showToast("No new dishes in cart to send to kitchen.");
      return;
    }
    if (!selectedTable) {
      showToast("Please choose a table first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const kotPayload = cart.map((c) => ({
        item: {
          id: c.id,
          name: c.name,
          basePrice: c.price,
          category: c.category,
          isVeg: c.isVeg,
        },
        price: c.price,
        quantity: c.quantity,
        notes: c.notes || "",
        isReady: false,
      }));

      const kotRoundNum = (currentSession?.activeOrders.length || 0) + 1;

      const { data: newOrder, error } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId,
          table_no: selectedTable,
          total: cart.reduce((s, it) => s + it.price * it.quantity, 0),
          status: "PREPARING",
          payment_status: "PENDING",
          customer_name: customerName.trim() || `Guest (${selectedTable})`,
          customer_phone: customerPhone.trim() || null,
          items_json: kotPayload,
          note: `[KOT #${kotRoundNum} Fired via POS]`,
        })
        .select()
        .single();

      if (error) throw error;

      showToast(`🔥 KOT #${kotRoundNum} sent to Kitchen for ${selectedTable}!`);

      // Trigger standard thermal print for Kitchen Chit
      setPrintChit({
        type: "KOT",
        tableNo: selectedTable,
        kotNumber: kotRoundNum,
        items: cart.map((c) => ({ name: c.name, quantity: c.quantity, notes: c.notes })),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      clearCart();
      if (restaurantId) fetchActiveOrders(restaurantId);

      // Brief delay to trigger browser ESC/POS print dialog
      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err: any) {
      showToast("Failed to fire KOT: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 7. PRINT BILL ESTIMATE (For guest review before paying) ─────── */
  const handlePrintGuestBill = async () => {
    if (allTableItems.length === 0) {
      showToast("No items on table to generate bill.");
      return;
    }

    // Mark active orders on this table as Billed in database note
    if (currentSession && currentSession.activeOrders.length > 0) {
      const orderIds = currentSession.activeOrders.map((o) => o.id);
      await supabase
        .from("orders")
        .update({ note: `[POS Bill Printed ${new Date().toLocaleTimeString()}]` })
        .in("id", orderIds);
    }

    setPrintChit({
      type: "BILL",
      tableNo: selectedTable,
      items: allTableItems.map((c) => ({
        name: c.name,
        quantity: c.quantity,
        price: c.price,
      })),
      subtotal,
      discount: effectiveDiscount,
      tax: taxTotal,
      grandTotal,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    showToast(`🖨️ Bill Estimate printed for ${selectedTable}`);
    if (restaurantId) fetchActiveOrders(restaurantId);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  /* ─── 8. SETTLE & VACATE TABLE (Payment Settlement) ───────────────── */
  const handleSettleAndVacate = async () => {
    if (allTableItems.length === 0) {
      showToast("Cannot settle empty table.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. If there were unsent cart items, combine them into a final round
      if (cart.length > 0) {
        const remainingPayload = cart.map((c) => ({
          item: { id: c.id, name: c.name, basePrice: c.price, category: c.category, isVeg: c.isVeg },
          price: c.price,
          quantity: c.quantity,
          notes: c.notes || "",
        }));

        await supabase.from("orders").insert({
          restaurant_id: restaurantId,
          table_no: selectedTable,
          total: cart.reduce((s, it) => s + it.price * it.quantity, 0),
          status: "COMPLETED",
          payment_status: "PAID",
          payment_method: selectedPaymentMethod,
          customer_name: customerName.trim() || `Guest (${selectedTable})`,
          customer_phone: customerPhone.trim() || null,
          items_json: remainingPayload,
          note: `[POS Final Direct Settle]`,
        });
      }

      // 2. Mark all existing active orders for this table as COMPLETED & PAID
      if (currentSession && currentSession.activeOrders.length > 0) {
        const orderIds = currentSession.activeOrders.map((o) => o.id);
        const { error } = await supabase
          .from("orders")
          .update({
            status: "COMPLETED",
            payment_status: "PAID",
            payment_method: selectedPaymentMethod,
          })
          .in("id", orderIds);

        if (error) throw error;
      }

      showToast(`✅ Table ${selectedTable} Settled (₹${grandTotal} via ${selectedPaymentMethod}) & Vacated.`);

      // Trigger final invoice receipt print
      setPrintChit({
        type: "BILL",
        tableNo: selectedTable,
        items: allTableItems.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          price: c.price,
        })),
        subtotal,
        discount: effectiveDiscount,
        tax: taxTotal,
        grandTotal,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      setShowPaymentModal(false);
      clearCart();
      setCustomerName("");
      setCustomerPhone("");
      setCashTendered("");
      setDiscountPercent(0);
      setDiscountAmount(0);

      if (restaurantId) fetchActiveOrders(restaurantId);

      // Return to Floor view
      setActiveView("TABLES");

      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err: any) {
      showToast("Settlement failed: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for running table elapsed time
  const getElapsedMinutes = (dateStr?: string) => {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    return mins > 0 ? `${mins}m` : "1m";
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 font-sans text-zinc-100 select-none overflow-hidden">
      
      {/* ── Top Toast Notice ── */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[300] bg-zinc-900 border border-zinc-700 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TOP PETPOOJA-STYLE HEADER & VIEW SWITCHER
          High-contrast, bold indicators, immediate floor switching
         ═════════════════════════════════════════════════════════════════════ */}
      <header className="shrink-0 h-14 bg-zinc-900 border-b border-zinc-800 px-5 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E46254] flex items-center justify-center font-black text-white text-sm shadow-md">
              T
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white leading-tight">
                {restaurantName}
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                POS Dine-In Active
              </span>
            </div>
          </div>

          {/* Floor Switcher Toggle (Tables Grid vs Order Pad) */}
          <div className="flex bg-zinc-800 p-0.5 rounded-xl border border-zinc-700/60 ml-4">
            <button
              onClick={() => setActiveView("TABLES")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === "TABLES"
                  ? "bg-[#E46254] text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={14} />
              <span>Floor Tables ({tableSessions.filter((s) => s.status !== "VACANT").length}/{tableSessions.length})</span>
            </button>

            <button
              onClick={() => setActiveView("ORDER_PAD")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === "ORDER_PAD"
                  ? "bg-[#E46254] text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <UtensilsCrossed size={14} />
              <span>Order Pad {selectedTable ? `(${selectedTable})` : ""}</span>
            </button>
          </div>
        </div>

        {/* Top Right Live Stats & Fast Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Table Jump Dropdown */}
          <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-semibold">
            <span className="text-zinc-400 text-[11px]">Table:</span>
            <select
              value={selectedTable}
              onChange={(e) => handleSelectTable(e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
            >
              {locations.map((loc) => {
                const s = tableSessions.find((t) => t.table_no === loc.name);
                const isOcc = s && s.status !== "VACANT";
                return (
                  <option key={loc.id} value={loc.name} className="bg-zinc-900 text-white">
                    {loc.name} {isOcc ? `(₹${s?.runningTotal})` : "(Vacant)"}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quick Cash Register Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-800/40 border border-zinc-800 text-[11px] font-semibold text-zinc-300">
            <Clock size={12} className="text-zinc-400" />
            <span>Shift Running</span>
          </div>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════════════
          MAIN VIEW CONTAINER
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ── OPTION A: FLOOR MAP / TABLES VIEW ────────────────────────── */}
        {activeView === "TABLES" && (
          <div className="flex-1 overflow-y-auto bg-zinc-950 p-6 md:p-8 space-y-6">
            
            {/* Top Legend Bar (Vacant / Cooking / Billed) */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Dining Floor Map</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-semibold">
                    {locations.length} Tables Registered
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Tap any table to start a new order, add items, fire KOT, or print guest bill.
                </p>
              </div>

              {/* Status Indicator Legend */}
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-sm" />
                  <span className="text-zinc-300">Vacant ({tableSessions.filter((s) => s.status === "VACANT").length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-amber-500 shadow-sm" />
                  <span className="text-zinc-300">KOT Active / Cooking ({tableSessions.filter((s) => s.status === "OCCUPIED").length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-indigo-500 shadow-sm" />
                  <span className="text-zinc-300">Bill Printed ({tableSessions.filter((s) => s.status === "BILLED").length})</span>
                </div>
              </div>
            </div>

            {/* Interactive Table Grid Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {tableSessions.map((session) => {
                const isVacant = session.status === "VACANT";
                const isOccupied = session.status === "OCCUPIED";
                const isBilled = session.status === "BILLED";
                const isSelected = selectedTable === session.table_no;
                const elapsed = getElapsedMinutes(session.firstOrderTime);

                return (
                  <div
                    key={session.table_no}
                    onClick={() => handleSelectTable(session.table_no)}
                    className={`rounded-2xl p-4.5 border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden select-none active:scale-[0.98] min-h-[160px] shadow-lg ${
                      isSelected ? "ring-2 ring-white" : ""
                    } ${
                      isVacant
                        ? "bg-zinc-900/60 border-emerald-500/30 hover:border-emerald-500/70 hover:bg-zinc-900"
                        : isOccupied
                        ? "bg-amber-950/20 border-amber-500/50 hover:border-amber-400 hover:bg-amber-950/30"
                        : "bg-indigo-950/20 border-indigo-500/50 hover:border-indigo-400 hover:bg-indigo-950/30"
                    }`}
                  >
                    {/* Top Table Badge + Seating Status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider ${
                            isVacant
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                              : isOccupied
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                              : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
                          }`}
                        >
                          {isVacant ? "VACANT" : isOccupied ? "COOKING" : "BILLED"}
                        </span>
                        <h3 className="text-xl font-black text-white mt-1.5 tracking-tight group-hover:text-[#E46254] transition-colors">
                          {session.table_no}
                        </h3>
                      </div>

                      {/* Seated Elapsed Time */}
                      {!isVacant && elapsed && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 tabular-nums">
                          <Clock size={11} />
                          <span>{elapsed}</span>
                        </div>
                      )}
                    </div>

                    {/* Middle: Running Guest / Items info */}
                    <div className="my-2">
                      {!isVacant ? (
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-zinc-300 truncate">
                            {session.customerName || "Dine-in Guests"}
                          </p>
                          <p className="text-[11px] font-medium text-zinc-400">
                            {session.firedItems.reduce((s, it) => s + it.quantity, 0)} items ordered
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 font-medium">Ready for guests</p>
                      )}
                    </div>

                    {/* Bottom Running Bill & Action */}
                    <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                      {!isVacant ? (
                        <>
                          <div>
                            <span className="text-[10px] font-medium text-zinc-400 block uppercase">Bill Due</span>
                            <span className="text-base font-black text-white tabular-nums">
                              ₹{session.runningTotal.toFixed(0)}
                            </span>
                          </div>
                          <button className="px-2.5 py-1 rounded-lg bg-zinc-800 text-xs font-bold text-zinc-200 group-hover:bg-[#E46254] group-hover:text-white transition-colors">
                            Manage →
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          + Tap to Start
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── OPTION B: ORDER PAD (Menu Grid Left, Running Ticket Right) ── */}
        {activeView === "ORDER_PAD" && (
          <div className="flex-1 flex overflow-hidden">
            
            {/* ── Left Area: Menu Catalog & Categories ── */}
            <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
              
              {/* Table Switcher Bar (Quick Table Pill Strip) */}
              <div className="shrink-0 bg-zinc-900 border-b border-zinc-800 px-5 py-2.5 flex items-center gap-2 overflow-x-auto slim-scrollbar">
                <span className="text-xs font-bold text-zinc-400 shrink-0 uppercase tracking-wider text-[11px]">
                  Tables:
                </span>
                {locations.map((loc) => {
                  const s = tableSessions.find((t) => t.table_no === loc.name);
                  const isOcc = s && s.status !== "VACANT";
                  const isCur = selectedTable === loc.name;

                  return (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedTable(loc.name)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCur
                          ? "bg-white text-zinc-950 shadow-md font-black"
                          : isOcc
                          ? "bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOcc ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <span>{loc.name}</span>
                      {isOcc && <span className="tabular-nums text-[10px] text-amber-200/90 font-normal">₹{s.runningTotal}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Search Bar + Veg Toggle */}
              <div className="shrink-0 px-5 pt-3 pb-2 flex items-center gap-3 bg-zinc-950">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search dish name, category, or code... (Press '/' to focus)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-9 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-medium text-white placeholder-zinc-500 outline-none focus:border-[#E46254] transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Pure Veg Filter Toggle Button */}
                <button
                  onClick={() => setVegOnly(!vegOnly)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    vegOnly
                      ? "bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-sm"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Veg Only</span>
                </button>
              </div>

              {/* Category Pills Strip */}
              <div className="shrink-0 px-5 py-2 flex items-center gap-2 overflow-x-auto slim-scrollbar border-b border-zinc-800/60 bg-zinc-950">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-[#E46254] text-white shadow-sm"
                        : "bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Dishes Grid */}
              <div className="flex-1 overflow-y-auto p-5 slim-scrollbar">
                {filteredItems.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                    <UtensilsCrossed size={36} className="text-zinc-700 mb-2" />
                    <p className="text-sm font-bold text-zinc-400">No dishes found</p>
                    <p className="text-xs text-zinc-500 mt-1">Try another category or clear search</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {filteredItems.map((item) => {
                      const inCart = cart.find((c) => c.id === item.id);

                      return (
                        <div
                          key={item.id}
                          onClick={() => addToCart(item)}
                          className={`rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden select-none active:scale-[0.98] min-h-[125px] ${
                            inCart
                              ? "bg-zinc-900 border-[#E46254] ring-1 ring-[#E46254]/40"
                              : "bg-zinc-900/90 border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-900"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              {/* Veg / Non-Veg Indicator */}
                              <div
                                className={`w-3.5 h-3.5 border flex items-center justify-center rounded-[3px] shrink-0 ${
                                  item.is_veg ? "border-emerald-500" : "border-rose-500"
                                }`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    item.is_veg ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                />
                              </div>

                              {inCart ? (
                                <span className="text-[10px] font-black bg-[#E46254] text-white px-2 py-0.5 rounded-md tabular-nums shadow-xs">
                                  {inCart.quantity} in order
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500 font-semibold truncate max-w-[100px]">
                                  {item.category}
                                </span>
                              )}
                            </div>

                            <h4 className="text-[13.5px] font-bold text-white group-hover:text-[#E46254] transition-colors leading-snug">
                              {item.name}
                            </h4>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between">
                            <span className="text-sm font-black text-white tabular-nums">
                              ₹{item.base_price}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(item);
                              }}
                              className={`h-7 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-black transition-all cursor-pointer ${
                                inCart
                                  ? "bg-[#E46254] text-white shadow-xs"
                                  : "bg-zinc-800 text-zinc-200 hover:bg-[#E46254] hover:text-white"
                              }`}
                            >
                              <Plus size={12} strokeWidth={3} />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right Area: Live Table Ticket (Fired KOTs + Unfired Cart) ── */}
            <div className="w-80 lg:w-96 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col z-20">
              
              {/* Table Header: Table Name, Elapsed time, Guest details */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white tracking-tight">
                      {selectedTable}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider ${
                        currentSession?.status === "OCCUPIED"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : currentSession?.status === "BILLED"
                          ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {currentSession?.status || "VACANT"}
                    </span>
                  </div>

                  <button
                    onClick={() => setActiveView("TABLES")}
                    className="text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    View Floor →
                  </button>
                </div>

                {/* Optional Customer info on ticket */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Guest Name (Opt)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full py-1.5 px-2.5 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-[#E46254]"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (Opt)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full py-1.5 px-2.5 bg-zinc-800/80 border border-zinc-700/80 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-[#E46254]"
                  />
                </div>
              </div>

              {/* Scrollable Ticket Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 slim-scrollbar">
                
                {/* 1. Previously Fired KOT Items (Sent to kitchen) */}
                {currentSession && currentSession.firedItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Flame size={12} />
                        <span>Fired in Kitchen ({currentSession.firedItems.length})</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 font-bold">KOT Dispatched</span>
                    </div>

                    <div className="space-y-1.5">
                      {currentSession.firedItems.map((item, idx) => (
                        <div
                          key={`fired_${idx}`}
                          className="bg-zinc-800/40 rounded-xl p-2.5 border border-zinc-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  item.isVeg ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              <span className="text-xs font-bold text-zinc-200 truncate">
                                {item.name}
                              </span>
                            </div>
                            {item.notes && (
                              <span className="text-[10px] text-amber-300/80 block pl-3">
                                ⚡ {item.notes}
                              </span>
                            )}
                          </div>

                          <span className="text-xs font-bold text-zinc-400 shrink-0 tabular-nums">
                            {item.quantity} &times; ₹{item.price}
                          </span>
                          <span className="text-xs font-bold text-white shrink-0 tabular-nums w-14 text-right">
                            ₹{item.price * item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Unfired Items in Current Cart (Newly added dishes) */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <Plus size={12} />
                      <span>New Round / Pending Firing ({cart.length})</span>
                    </span>
                    {cart.length > 0 && (
                      <button
                        onClick={clearCart}
                        className="text-[10px] font-bold text-zinc-500 hover:text-rose-400 transition-colors"
                      >
                        Clear Round
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-6 text-center text-zinc-600 text-xs">
                      {currentSession?.firedItems.length === 0
                        ? "Select dishes from the menu to start order"
                        : "No new items added. Table has running orders."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="bg-zinc-800/90 rounded-xl p-2.5 border border-[#E46254]/40 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    item.isVeg ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                />
                                <h5 className="text-xs font-bold text-white truncate">{item.name}</h5>
                              </div>
                              <span className="text-[10.5px] text-zinc-400 font-medium pl-3.5 block">
                                ₹{item.price} each
                              </span>
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-700 rounded-lg p-0.5 shrink-0">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-5 h-5 rounded flex items-center justify-center text-zinc-400 hover:text-white"
                              >
                                <Minus size={11} strokeWidth={2.5} />
                              </button>
                              <span className="text-xs font-bold w-4 text-center tabular-nums text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-5 h-5 rounded flex items-center justify-center bg-[#E46254] text-white hover:bg-[#D35546]"
                              >
                                <Plus size={11} strokeWidth={2.5} />
                              </button>
                            </div>

                            <span className="text-xs font-bold text-white tabular-nums w-12 text-right">
                              ₹{item.price * item.quantity}
                            </span>
                          </div>

                          {/* Quick Cooking Instructions */}
                          <input
                            type="text"
                            placeholder="Kitchen note (e.g. less spicy, extra butter)..."
                            value={item.notes || ""}
                            onChange={(e) => {
                              const noteVal = e.target.value;
                              setCart((prev) =>
                                prev.map((i) => (i.id === item.id ? { ...i, notes: noteVal } : i))
                              );
                            }}
                            className="w-full text-[10.5px] bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Bottom Breakdown & 3 Core Industry Actions */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900 space-y-3">
                
                {/* Discount Trigger */}
                <div className="flex items-center justify-between text-xs">
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    className="text-[11.5px] font-bold text-[#E46254] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Tag size={12} />
                    <span>
                      {effectiveDiscount > 0
                        ? `Discount Applied: ₹${effectiveDiscount.toFixed(0)}`
                        : "+ Add Discount"}
                    </span>
                  </button>
                  {effectiveDiscount > 0 && (
                    <button
                      onClick={() => {
                        setDiscountPercent(0);
                        setDiscountAmount(0);
                      }}
                      className="text-[10px] text-zinc-400 hover:text-white"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Subtotal, GST, Grand Total */}
                <div className="space-y-1 text-xs text-zinc-400 pt-1 border-t border-zinc-800">
                  <div className="flex justify-between text-[11.5px]">
                    <span>Table Subtotal</span>
                    <span className="font-semibold text-zinc-200 tabular-nums">₹{subtotal.toFixed(0)}</span>
                  </div>
                  {effectiveDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold text-[11.5px]">
                      <span>Discount</span>
                      <span className="tabular-nums">-₹{effectiveDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11.5px]">
                    <span>GST (5%)</span>
                    <span className="font-semibold text-zinc-200 tabular-nums">₹{taxTotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-zinc-700">
                    <span className="font-bold text-white text-xs">Total Bill Due</span>
                    <span className="text-xl font-black text-[#E46254] tabular-nums">
                      ₹{grandTotal}
                    </span>
                  </div>
                </div>

                {/* ═══ 3 PRIMARY BUTTONS: FIRE KOT | PRINT BILL | SETTLE ═══ */}
                <div className="space-y-2 pt-1">
                  
                  {/* Fire KOT Button (High priority during rush) */}
                  <button
                    disabled={cart.length === 0 || isSubmitting}
                    onClick={handleFireKOT}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-30 cursor-pointer shadow-lg active:scale-[0.98]"
                  >
                    <Flame size={15} />
                    <span>
                      {cart.length > 0
                        ? `Fire KOT (${cart.length} dishes)`
                        : "Send KOT to Kitchen"}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Print Guest Bill Button */}
                    <button
                      disabled={allTableItems.length === 0 || isSubmitting}
                      onClick={handlePrintGuestBill}
                      className="py-2.5 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 cursor-pointer border border-zinc-700"
                    >
                      <Printer size={13} />
                      <span>Print Bill</span>
                    </button>

                    {/* Settle & Close Table Button */}
                    <button
                      disabled={allTableItems.length === 0 || isSubmitting}
                      onClick={() => setShowPaymentModal(true)}
                      className="py-2.5 px-2 rounded-xl bg-[#E46254] hover:bg-[#D35546] text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_16px_rgba(228,98,84,0.3)] disabled:opacity-30 cursor-pointer active:scale-[0.98]"
                    >
                      <CreditCard size={13} />
                      <span>Settle ₹{grandTotal}</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          DISCOUNT MODAL
         ═════════════════════════════════════════════════════════════════════ */}
      {showDiscountModal && (
        <div
          onClick={() => setShowDiscountModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Tag size={15} className="text-[#E46254]" /> Add Bill Discount
              </h3>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mode Switcher: % vs Flat ₹ */}
            <div className="grid grid-cols-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setDiscountMode("PERCENT")}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  discountMode === "PERCENT"
                    ? "bg-[#E46254] text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setDiscountMode("FLAT")}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  discountMode === "FLAT"
                    ? "bg-[#E46254] text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Flat Amount (₹)
              </button>
            </div>

            {/* Quick Presets */}
            {discountMode === "PERCENT" ? (
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDiscountPercent(pct)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      discountPercent === pct
                        ? "bg-[#E46254] border-[#E46254] text-white"
                        : "bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDiscountAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      discountAmount === amt
                        ? "bg-[#E46254] border-[#E46254] text-white"
                        : "bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowDiscountModal(false)}
              className="w-full py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs"
            >
              Apply Discount
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          PAYMENT & SETTLEMENT MODAL (CASH, DYNAMIC UPI QR, CARD)
         ═════════════════════════════════════════════════════════════════════ */}
      {showPaymentModal && (
        <div
          onClick={() => setShowPaymentModal(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Settle {selectedTable}</h3>
                <p className="text-xs text-zinc-400">Total Due: <strong className="text-[#E46254] text-sm">₹{grandTotal}</strong></p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Payment Mode Selector */}
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "UPI", "CARD"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedPaymentMethod(m)}
                  className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${
                    selectedPaymentMethod === m
                      ? "bg-[#E46254] border-[#E46254] text-white shadow-md"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  }`}
                >
                  {m === "CASH" && <Banknote size={14} />}
                  {m === "UPI" && <QrCode size={14} />}
                  {m === "CARD" && <CreditCard size={14} />}
                  <span>{m}</span>
                </button>
              ))}
            </div>

            {/* Mode Specific Inputs */}
            {selectedPaymentMethod === "CASH" && (
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-zinc-300 block">Cash Tendered by Guest</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={grandTotal.toString()}
                    className="w-full pl-8 pr-4 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-lg font-black text-white outline-none focus:border-[#E46254]"
                  />
                </div>

                {/* Preset Fast Currency Notes */}
                <div className="grid grid-cols-4 gap-2">
                  {[grandTotal, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCashTendered(amt.toString())}
                      className="py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 border border-zinc-700"
                    >
                      {amt === grandTotal ? "Exact" : `₹${amt}`}
                    </button>
                  ))}
                </div>

                {changeDue > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400">Return Change:</span>
                    <span className="text-base font-black text-emerald-300 tabular-nums">₹{changeDue}</span>
                  </div>
                )}
              </div>
            )}

            {selectedPaymentMethod === "UPI" && (
              <div className="py-3 flex flex-col items-center justify-center text-center space-y-3">
                <div className="p-3 bg-white rounded-2xl shadow-md">
                  <QRCode
                    value={`upi://pay?pa=${upiId || "merchant@upi"}&pn=${encodeURIComponent(
                      restaurantName
                    )}&am=${grandTotal}&cu=INR`}
                    size={140}
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Scan to pay exact ₹{grandTotal}</p>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{upiId || "UPI Active"}</p>
                </div>
              </div>
            )}

            {selectedPaymentMethod === "CARD" && (
              <div className="py-6 text-center text-zinc-400 text-xs">
                <CreditCard size={28} className="mx-auto text-zinc-600 mb-2" />
                <p className="font-bold text-white">Swipe or Tap Card on EDC Machine</p>
                <p className="text-[11px] text-zinc-500 mt-1">Press confirm once transaction slips print</p>
              </div>
            )}

            {/* Confirm & Close Table Button */}
            <button
              disabled={isSubmitting}
              onClick={handleSettleAndVacate}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] cursor-pointer"
            >
              <Check size={16} strokeWidth={3} />
              <span>Confirm Payment & Vacate Table</span>
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          HIDDEN THERMAL PRINT LAYOUT (KOT Chit & Guest Tax Invoice Bill)
          Strictly ESC/POS 80mm/58mm standard format
         ═════════════════════════════════════════════════════════════════════ */}
      {printChit && (
        <div id="thermal-chit" className="hidden print:block text-black bg-white p-2">
          {printChit.type === "KOT" ? (
            /* ── KITCHEN KOT CHIT ── */
            <div className="w-[72mm] mx-auto text-left font-mono">
              <div className="text-center pb-2 border-b-2 border-dashed border-black">
                <h2 className="text-base font-black uppercase">*** KITCHEN KOT ***</h2>
                <p className="text-xs font-bold">KOT #{printChit.kotNumber || 1}</p>
                <p className="text-sm font-black mt-1">TABLE: {printChit.tableNo}</p>
                <p className="text-[10px] mt-0.5">{printChit.time}</p>
              </div>

              <div className="py-2 border-b-2 border-dashed border-black space-y-1.5 text-xs">
                <div className="flex justify-between font-black pb-1 text-[11px] border-b border-black">
                  <span>ITEM</span>
                  <span>QTY</span>
                </div>
                {printChit.items.map((it, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold text-sm">
                      <span className="uppercase">{it.name}</span>
                      <span className="text-base font-black">&times; {it.quantity}</span>
                    </div>
                    {it.notes && (
                      <p className="text-[10px] font-bold italic pl-2">
                        &gt;&gt; NOTE: {it.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="text-center pt-2 text-[10px]">
                <p className="font-bold">*** END OF KOT ***</p>
              </div>
            </div>
          ) : (
            /* ── GUEST TAX INVOICE BILL ── */
            <div className="w-[72mm] mx-auto text-left font-mono">
              <div className="text-center pb-2 border-b-2 border-dashed border-black">
                <h2 className="text-base font-black uppercase">{restaurantName}</h2>
                <p className="text-[10px]">Dine-In Tax Invoice</p>
                <p className="text-sm font-black mt-1">TABLE: {printChit.tableNo}</p>
                <p className="text-[10px]">{printChit.time}</p>
              </div>

              <div className="py-2 border-b-2 border-dashed border-black space-y-1 text-xs">
                <div className="flex justify-between font-bold pb-1 text-[10px]">
                  <span>ITEM</span>
                  <span className="text-right">QTY &nbsp; AMT</span>
                </div>
                {printChit.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="truncate pr-1">{it.name}</span>
                    <span className="shrink-0 text-right tabular-nums">
                      {it.quantity} &times; ₹{it.price} = ₹{(it.quantity * (it.price || 0)).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="py-2 border-b-2 border-dashed border-black space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{printChit.subtotal?.toFixed(0)}</span>
                </div>
                {printChit.discount ? (
                  <div className="flex justify-between font-bold">
                    <span>Discount:</span>
                    <span>-₹{printChit.discount.toFixed(0)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>GST (5%):</span>
                  <span>₹{printChit.tax?.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-sm font-black pt-1 border-t border-black">
                  <span>GRAND TOTAL:</span>
                  <span>₹{printChit.grandTotal?.toFixed(0)}</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] space-y-0.5">
                <p className="font-bold">Thank you for dining with us!</p>
                <p className="text-[9px] text-zinc-600">Powered by TableTapy POS</p>
              </div>
            </div>
          )}

          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #thermal-chit,
              #thermal-chit * {
                visibility: visible !important;
              }
              #thermal-chit {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}
