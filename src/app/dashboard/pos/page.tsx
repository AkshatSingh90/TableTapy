"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  X,
  Check,
  ChefHat,
  Printer,
  Clock,
  LayoutGrid,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  User,
  Phone,
  Flame,
  CheckCircle2,
  AlertCircle,
  Percent,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Hash,
  ArrowRight
} from "lucide-react";
import QRCode from "react-qr-code";
import { createClient } from "@/utils/supabase/client";

/* ─── Type Definitions ────────────────────────────────────────────── */
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

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  category?: string;
  notes?: string;
}

interface OrderRecord {
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

type OrderMode = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
type PaymentMethod = "CASH" | "UPI" | "CARD";

export default function PosTerminalPage() {
  const supabase = createClient();

  // Core Data State
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("Restaurant");
  const [upiId, setUpiId] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Terminal Mode (Dine In vs Takeaway vs Delivery)
  const [orderMode, setOrderMode] = useState<OrderMode>("DINE_IN");

  // Dine-In Specific Selection
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [showFloorModal, setShowFloorModal] = useState<boolean>(false);

  // Takeaway Specific Selection
  const [takeawayToken, setTakeawayToken] = useState<string>(() => `TK-${Math.floor(100 + Math.random() * 900)}`);

  // Customer Info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Cart / Pending Items (Round items to be fired or settled)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Search & Categories
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [vegOnlyFilter, setVegOnlyFilter] = useState(false);
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

  // Thermal Print State (KOT chit or Tax invoice)
  const [printChit, setPrintChit] = useState<{
    type: "KOT" | "BILL";
    mode: OrderMode;
    tableOrToken: string;
    kotNumber?: number;
    customerName?: string;
    customerPhone?: string;
    items: Array<{ name: string; quantity: number; price?: number; notes?: string }>;
    subtotal?: number;
    discount?: number;
    tax?: number;
    grandTotal?: number;
    paymentMethod?: string;
    time: string;
  } | null>(null);

  // Quick Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ─── 1. Load Store Data & Active Sessions ────────────────────────── */
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
          { id: "t1", name: "Table 1", capacity: 2 },
          { id: "t2", name: "Table 2", capacity: 4 },
          { id: "t3", name: "Table 3", capacity: 4 },
          { id: "t4", name: "Table 4", capacity: 6 },
          { id: "t5", name: "Table 5", capacity: 2 },
          { id: "t6", name: "Table 6", capacity: 4 },
          { id: "t7", name: "Table 7", capacity: 8 },
          { id: "t8", name: "Table 8", capacity: 4 },
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
            category: row.category || "General",
            subcategory: row.subcategory || "",
            base_price: Number(row.base_price || 0),
            description: (row.description || "").replace(/\[REST:[^\]]+\]\s*/, ""),
            is_veg: row.is_veg !== false,
            is_available: row.is_available !== false,
          }))
        );
      }

      // 4. Fetch Active Orders
      await fetchActiveOrders(restId);
    } catch (err) {
      console.error("Error loading POS initial data:", err);
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
      setActiveOrders(orderData as OrderRecord[]);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Realtime listener for orders and stock toggles
    const channel = supabase
      .channel("pos_master_sync")
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
        setShowFloorModal(false);
        setShowPaymentModal(false);
        setShowDiscountModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ─── 2. Dine-In Table Status Computation ─────────────────────────── */
  // Categorizes all tables into Vacant, Cooking (KOT Active), or Billed
  const tableSessionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        tableNo: string;
        status: "VACANT" | "COOKING" | "BILLED";
        orders: OrderRecord[];
        firedItems: CartItem[];
        runningTotal: number;
        firstOrderTime?: string;
        customerName?: string;
        customerPhone?: string;
      }
    >();

    locations.forEach((loc) => {
      map.set(loc.name, {
        tableNo: loc.name,
        status: "VACANT",
        orders: [],
        firedItems: [],
        runningTotal: 0,
      });
    });

    activeOrders.forEach((ord) => {
      if (!ord.table_no) return;
      const isTakeaway =
        ord.table_no.toLowerCase().startsWith("takeaway") ||
        ord.table_no.toLowerCase().startsWith("tk-") ||
        ord.table_no.toLowerCase().startsWith("counter");

      if (isTakeaway) return; // Handled separately in Takeaway drawer

      let session = map.get(ord.table_no);
      if (!session) {
        session = {
          tableNo: ord.table_no,
          status: "VACANT",
          orders: [],
          firedItems: [],
          runningTotal: 0,
        };
        map.set(ord.table_no, session);
      }

      session.orders.push(ord);
      session.runningTotal += Number(ord.total || 0);
      if (!session.firstOrderTime || new Date(ord.created_at) < new Date(session.firstOrderTime)) {
        session.firstOrderTime = ord.created_at;
      }
      if (ord.customer_name) session.customerName = ord.customer_name;
      if (ord.customer_phone) session.customerPhone = ord.customer_phone;

      // Extract fired kitchen items
      if (Array.isArray(ord.items_json)) {
        ord.items_json.forEach((raw: any) => {
          const it = raw.item || {};
          const qty = raw.quantity || 1;
          const price = raw.price || it.basePrice || 0;
          session!.firedItems.push({
            id: it.id || raw.id || Math.random().toString(),
            name: it.name || raw.name || "Item",
            price: price,
            quantity: qty,
            isVeg: it.isVeg !== false,
            category: it.category,
            notes: raw.notes || "",
          });
        });
      }

      // Check if bill was printed (proforma estimate)
      if (ord.note && ord.note.includes("[POS Bill Printed")) {
        session.status = "BILLED";
      } else {
        session.status = "COOKING";
      }
    });

    return map;
  }, [locations, activeOrders]);

  // Current selected table session
  const currentTableSession = useMemo(() => {
    if (orderMode !== "DINE_IN" || !selectedTable) return null;
    return tableSessionMap.get(selectedTable) || null;
  }, [tableSessionMap, orderMode, selectedTable]);

  /* ─── 3. Active Takeaway & Delivery Orders ─────────────────────────── */
  const activeTakeawayOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      const t = (o.table_no || "").toLowerCase();
      return t.startsWith("takeaway") || t.startsWith("tk-") || t.startsWith("counter") || t.startsWith("delivery");
    });
  }, [activeOrders]);

  // Switch to an active takeaway order
  const handleSelectActiveTakeaway = (ord: OrderRecord) => {
    setOrderMode(ord.table_no.toLowerCase().startsWith("delivery") ? "DELIVERY" : "TAKEAWAY");
    setTakeawayToken(ord.table_no);
    setCustomerName(ord.customer_name || "");
    setCustomerPhone(ord.customer_phone || "");

    // Load items into cart
    if (Array.isArray(ord.items_json)) {
      const loaded: CartItem[] = ord.items_json.map((raw: any) => {
        const it = raw.item || {};
        return {
          id: it.id || raw.id || Math.random().toString(),
          name: it.name || raw.name || "Item",
          price: raw.price || it.basePrice || 0,
          quantity: raw.quantity || 1,
          isVeg: it.isVeg !== false,
          category: it.category,
          notes: raw.notes || "",
        };
      });
      setCart(loaded);
    }
  };

  const handleStartNewTakeaway = () => {
    setOrderMode("TAKEAWAY");
    setTakeawayToken(`TK-${Math.floor(100 + Math.random() * 900)}`);
    setCustomerName("");
    setCustomerPhone("");
    setCart([]);
    showToast("Started New Takeaway Order");
  };

  /* ─── 4. Categories & Menu Filtering ──────────────────────────────── */
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((i) => {
      if (i.category && i.category.trim()) set.add(i.category.trim());
    });
    return ["ALL", ...Array.from(set)];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.is_available) return false;
      if (vegOnlyFilter && !item.is_veg) return false;
      if (selectedCategory !== "ALL" && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesCat) return false;
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery, vegOnlyFilter]);

  /* ─── 5. Cart Operations ──────────────────────────────────────────── */
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
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
        },
      ];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateCartItemNote = (id: string, note: string) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, notes: note } : i)));
  };

  const clearCurrentCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
  };

  /* ─── 6. Billing & Calculations ───────────────────────────────────── */
  // If Dine-In: includes items previously fired to kitchen + new items in cart
  const allCurrentItems = useMemo(() => {
    if (orderMode === "DINE_IN") {
      const fired = currentTableSession?.firedItems || [];
      return [...fired, ...cart];
    }
    return cart;
  }, [orderMode, currentTableSession, cart]);

  const subtotal = useMemo(() => {
    return allCurrentItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [allCurrentItems]);

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

  /* ─── 7. Actions: Fire KOT (Dine-In or Takeaway) ──────────────────── */
  const handleFireKOT = async () => {
    if (cart.length === 0) {
      showToast("No new items in cart to send to kitchen.");
      return;
    }

    const targetDestination = orderMode === "DINE_IN" ? selectedTable : takeawayToken;
    if (!targetDestination) {
      showToast("Please choose a table or takeaway token first.");
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

      const isDineIn = orderMode === "DINE_IN";
      const kotRoundNum = isDineIn ? (currentTableSession?.orders.length || 0) + 1 : 1;
      const orderTag = isDineIn
        ? `[KOT #${kotRoundNum} Fired via POS]`
        : `[TAKEAWAY KOT Fired via POS]`;

      const { error } = await supabase.from("orders").insert({
        restaurant_id: restaurantId,
        table_no: targetDestination,
        total: cart.reduce((s, it) => s + it.price * it.quantity, 0),
        status: "PREPARING",
        payment_status: "PENDING",
        customer_name:
          customerName.trim() ||
          (isDineIn ? `Guest (${selectedTable})` : `Takeaway Guest (${targetDestination})`),
        customer_phone: customerPhone.trim() || null,
        items_json: kotPayload,
        note: orderTag,
      });

      if (error) throw error;

      showToast(
        `🔥 KOT sent to Kitchen for ${targetDestination}! (${cart.length} dishes)`
      );

      // Trigger standard thermal print for Kitchen Chit
      setPrintChit({
        type: "KOT",
        mode: orderMode,
        tableOrToken: targetDestination,
        kotNumber: kotRoundNum,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cart.map((c) => ({ name: c.name, quantity: c.quantity, notes: c.notes })),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      clearCurrentCart();
      if (restaurantId) fetchActiveOrders(restaurantId);

      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err: any) {
      showToast("Failed to fire KOT: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 8. Actions: Print Bill Estimate (Dine-In Guest Check) ──────── */
  const handlePrintGuestBill = async () => {
    if (allCurrentItems.length === 0) {
      showToast("No items on table to generate bill.");
      return;
    }

    const targetDestination = orderMode === "DINE_IN" ? selectedTable : takeawayToken;

    // Mark active orders on this table as Billed in database note
    if (currentTableSession && currentTableSession.orders.length > 0) {
      const orderIds = currentTableSession.orders.map((o) => o.id);
      await supabase
        .from("orders")
        .update({ note: `[POS Bill Printed ${new Date().toLocaleTimeString()}]` })
        .in("id", orderIds);
    }

    setPrintChit({
      type: "BILL",
      mode: orderMode,
      tableOrToken: targetDestination,
      customerName: customerName.trim() || currentTableSession?.customerName,
      customerPhone: customerPhone.trim() || currentTableSession?.customerPhone,
      items: allCurrentItems.map((c) => ({
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

    showToast(`🖨️ Bill Estimate printed for ${targetDestination}`);
    if (restaurantId) fetchActiveOrders(restaurantId);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  /* ─── 9. Actions: Settle Payment & Close Order ────────────────────── */
  const handleSettleOrder = async () => {
    if (allCurrentItems.length === 0) {
      showToast("Cannot settle an empty order.");
      return;
    }

    const targetDestination = orderMode === "DINE_IN" ? selectedTable : takeawayToken;
    setIsSubmitting(true);

    try {
      if (orderMode === "DINE_IN" && currentTableSession && currentTableSession.orders.length > 0) {
        // Settle existing table orders
        const orderIds = currentTableSession.orders.map((o) => o.id);

        const { error } = await supabase
          .from("orders")
          .update({
            status: "COMPLETED",
            payment_status: "PAID",
            payment_method: selectedPaymentMethod,
            total: grandTotal,
            note: `[POS Settled Dine-In: ${selectedPaymentMethod}]`,
          })
          .in("id", orderIds);

        if (error) throw error;

        // If there were any unsaved cart items on the table, save them into a completed record
        if (cart.length > 0) {
          const unsavedPayload = cart.map((c) => ({
            item: { id: c.id, name: c.name, basePrice: c.price, category: c.category, isVeg: c.isVeg },
            price: c.price,
            quantity: c.quantity,
            notes: c.notes || "",
            isReady: true,
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
            items_json: unsavedPayload,
            note: `[POS Additional Settled: ${selectedPaymentMethod}]`,
          });
        }
      } else {
        // Direct Takeaway or Instant Settle
        const itemsPayload = allCurrentItems.map((c) => ({
          item: { id: c.id, name: c.name, basePrice: c.price, category: c.category, isVeg: c.isVeg },
          price: c.price,
          quantity: c.quantity,
          notes: c.notes || "",
          isReady: true,
        }));

        const { error } = await supabase.from("orders").insert({
          restaurant_id: restaurantId,
          table_no: targetDestination,
          total: grandTotal,
          status: "COMPLETED",
          payment_status: "PAID",
          payment_method: selectedPaymentMethod,
          customer_name: customerName.trim() || `${orderMode === "TAKEAWAY" ? "Takeaway" : "Delivery"} Guest`,
          customer_phone: customerPhone.trim() || null,
          items_json: itemsPayload,
          note: `[POS Settled ${orderMode}: ${selectedPaymentMethod}]`,
        });

        if (error) throw error;
      }

      showToast(`✅ ${targetDestination} Settled (₹${grandTotal}) via ${selectedPaymentMethod}!`);

      // Prepare Tax Invoice Print
      setPrintChit({
        type: "BILL",
        mode: orderMode,
        tableOrToken: targetDestination,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        paymentMethod: selectedPaymentMethod,
        items: allCurrentItems.map((c) => ({
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
      clearCurrentCart();
      setCustomerName("");
      setCustomerPhone("");
      setCashTendered("");
      setDiscountPercent(0);
      setDiscountAmount(0);

      if (orderMode === "TAKEAWAY") {
        setTakeawayToken(`TK-${Math.floor(100 + Math.random() * 900)}`);
      }

      if (restaurantId) fetchActiveOrders(restaurantId);

      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err: any) {
      showToast("Settlement failed: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for elapsed time
  const getElapsedMinutes = (dateStr?: string) => {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    return mins > 0 ? `${mins}m` : "1m";
  };

  // UPI Intent URL
  const upiIntentUrl = useMemo(() => {
    const vpa = upiId || "merchant@upi";
    const name = encodeURIComponent(restaurantName);
    return `upi://pay?pa=${vpa}&pn=${name}&am=${grandTotal}&cu=INR`;
  }, [upiId, restaurantName, grandTotal]);

  return (
    <div className="flex h-screen flex-col bg-[#F8F9FA] font-sans text-zinc-900 select-none overflow-hidden">
      
      {/* ── Top Toast Notice ── */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[300] bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TOP MASTER BAR: Brand + Order Mode Switcher + Stats
         ═════════════════════════════════════════════════════════════════════ */}
      <header className="shrink-0 h-16 bg-white border-b border-zinc-200/80 px-6 flex items-center justify-between z-30 shadow-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E46254] flex items-center justify-center font-black text-white text-base shadow-sm">
              T
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 tracking-tight leading-tight">
                {restaurantName}
              </h1>
              <p className="text-[11px] font-medium text-zinc-400">
                POS Terminal & Kitchen Ticketing
              </p>
            </div>
          </div>

          {/* Primary Order Mode Switcher: DINE-IN vs TAKEAWAY vs DELIVERY */}
          <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200/60">
            <button
              onClick={() => {
                setOrderMode("DINE_IN");
                if (!selectedTable && locations.length > 0) setSelectedTable(locations[0].name);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                orderMode === "DINE_IN"
                  ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <UtensilsCrossed size={14} className={orderMode === "DINE_IN" ? "text-[#E46254]" : ""} />
              <span>Dine-In</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-zinc-200/60 text-zinc-700">
                {Array.from(tableSessionMap.values()).filter((s) => s.status !== "VACANT").length} Active
              </span>
            </button>

            <button
              onClick={() => {
                setOrderMode("TAKEAWAY");
                if (!takeawayToken) setTakeawayToken(`TK-${Math.floor(100 + Math.random() * 900)}`);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                orderMode === "TAKEAWAY"
                  ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <ShoppingBag size={14} className={orderMode === "TAKEAWAY" ? "text-[#E46254]" : ""} />
              <span>Takeaway / Parcel</span>
              {activeTakeawayOrders.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-amber-100 text-amber-800">
                  {activeTakeawayOrders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setOrderMode("DELIVERY");
                setTakeawayToken(`DEL-${Math.floor(100 + Math.random() * 900)}`);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                orderMode === "DELIVERY"
                  ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <Bike size={14} className={orderMode === "DELIVERY" ? "text-[#E46254]" : ""} />
              <span>Delivery</span>
            </button>
          </div>
        </div>

        {/* Top Right Quick Stats & Floor Map Trigger */}
        <div className="flex items-center gap-3">
          {orderMode === "DINE_IN" && (
            <button
              onClick={() => setShowFloorModal(true)}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-700 flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <LayoutGrid size={14} className="text-[#E46254]" />
              <span>Floor Map</span>
            </button>
          )}

          {orderMode === "TAKEAWAY" && (
            <button
              onClick={handleStartNewTakeaway}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>New Takeaway</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 border border-zinc-200/70 text-xs font-semibold text-zinc-600">
            <Clock size={13} className="text-zinc-400" />
            <span>Shift Active</span>
          </div>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════════════
          SUB-BAR: Contextual Selector Strip
          - If DINE_IN: Fast Table Selector Strip with Status Colors
          - If TAKEAWAY: Active Takeaways & Customer Quick Info
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 bg-white border-b border-zinc-200/70 px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        {orderMode === "DINE_IN" ? (
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1">
              Select Table:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {locations.map((loc) => {
                const session = tableSessionMap.get(loc.name);
                const isSelected = selectedTable === loc.name;
                const isVacant = !session || session.status === "VACANT";
                const isCooking = session?.status === "COOKING";
                const isBilled = session?.status === "BILLED";

                return (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setSelectedTable(loc.name);
                      clearCurrentCart();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-[#E46254] text-white border-[#E46254] shadow-sm ring-2 ring-[#E46254]/20"
                        : isVacant
                        ? "bg-white text-zinc-700 border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50/30"
                        : isCooking
                        ? "bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-400"
                        : "bg-indigo-50 text-indigo-900 border-indigo-300 hover:border-indigo-400"
                    }`}
                  >
                    {/* Status Dot */}
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected
                          ? "bg-white"
                          : isVacant
                          ? "bg-emerald-500"
                          : isCooking
                          ? "bg-amber-500 animate-pulse"
                          : "bg-indigo-500"
                      }`}
                    />
                    <span>{loc.name}</span>
                    {!isVacant && session?.runningTotal ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold tabular-nums ${
                          isSelected ? "bg-white/20 text-white" : "bg-zinc-200/80 text-zinc-800"
                        }`}
                      >
                        ₹{session.runningTotal}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Active Takeaways:
              </span>
              {activeTakeawayOrders.length === 0 ? (
                <span className="text-xs text-zinc-400 italic">No pending takeaways</span>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {activeTakeawayOrders.map((ord) => {
                    const isSelected = takeawayToken === ord.table_no;
                    return (
                      <button
                        key={ord.id}
                        onClick={() => handleSelectActiveTakeaway(ord)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                        }`}
                      >
                        <span>{ord.table_no}</span>
                        <span className="text-[10px] bg-white/30 px-1 rounded font-bold">
                          ₹{ord.total}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400">Current Token:</span>
              <span className="px-2.5 py-1 bg-zinc-100 border border-zinc-300 rounded-lg text-xs font-black text-zinc-900">
                {takeawayToken}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          MAIN WORKSPACE: Split Layout
          - Left: Search + Category Pills + Dish Grid (65%)
          - Right: Live Order Pad & Billing Ticket (35%)
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ── LEFT SECTION: Menu Catalog & Selection ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA] border-r border-zinc-200">
          
          {/* Top Search & Filter Bar */}
          <div className="shrink-0 p-4 bg-white border-b border-zinc-100 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search dishes or categories... (Press '/' to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:border-[#E46254] focus:bg-white focus:ring-2 focus:ring-[#E46254]/10 rounded-xl text-xs font-medium transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Veg Only Filter Pill */}
            <button
              onClick={() => setVegOnlyFilter((v) => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
                vegOnlyFilter
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 border border-white" />
              <span>Veg Only</span>
            </button>
          </div>

          {/* Clean Horizontal Category Pills */}
          <div className="shrink-0 px-4 py-2.5 bg-white border-b border-zinc-200/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              const count =
                cat === "ALL"
                  ? menuItems.length
                  : menuItems.filter((i) => i.category.toLowerCase() === cat.toLowerCase()).length;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                    isSelected
                      ? "bg-[#E46254] text-white border-[#E46254] shadow-xs"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900"
                  }`}
                >
                  <span>{cat === "ALL" ? "All Items" : cat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold tabular-nums ${
                      isSelected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dish Grid: Touch-optimized Cards with immediate Add actions */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-zinc-200">
                <Receipt size={32} className="text-zinc-300 mb-2" />
                <h3 className="text-sm font-bold text-zinc-800">No dishes found</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Try switching categories or clearing the veg filter
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredItems.map((dish) => {
                  const cartItem = cart.find((c) => c.id === dish.id);
                  const inCartQty = cartItem ? cartItem.quantity : 0;

                  return (
                    <div
                      key={dish.id}
                      onClick={() => addToCart(dish)}
                      className={`bg-white rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between group select-none hover:shadow-md hover:border-[#E46254]/40 active:scale-[0.98] ${
                        inCartQty > 0
                          ? "border-[#E46254] ring-1 ring-[#E46254]/20 shadow-xs"
                          : "border-zinc-200/80"
                      }`}
                    >
                      <div>
                        {/* Top Indicator: Veg/Non-Veg + Category */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 rounded-xs ${
                              dish.is_veg ? "border-emerald-600" : "border-rose-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                dish.is_veg ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            />
                          </span>

                          <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase tracking-wider truncate max-w-[100px]">
                            {dish.category}
                          </span>
                        </div>

                        {/* Dish Name */}
                        <h4 className="text-xs font-bold text-zinc-800 group-hover:text-zinc-900 leading-snug line-clamp-2 min-h-[32px]">
                          {dish.name}
                        </h4>
                      </div>

                      {/* Bottom Price & Add Action */}
                      <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-100">
                        <span className="text-xs font-extrabold text-zinc-900">
                          ₹{dish.base_price}
                        </span>

                        {inCartQty > 0 ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 bg-[#E46254] text-white px-1.5 py-0.5 rounded-lg shadow-xs"
                          >
                            <button
                              onClick={() => updateCartQty(dish.id, -1)}
                              className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="text-[11px] font-bold px-1">{inCartQty}</span>
                            <button
                              onClick={() => updateCartQty(dish.id, 1)}
                              className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-[#E46254] bg-[#E46254]/10 hover:bg-[#E46254] hover:text-white px-2 py-0.5 rounded-lg transition-colors">
                            + Add
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SECTION: Order Ticket & Billing Pad ── */}
        <div className="w-[380px] xl:w-[420px] bg-white flex flex-col justify-between shrink-0 shadow-lg z-20">
          
          {/* Ticket Header */}
          <div className="shrink-0 p-4 border-b border-zinc-200/80 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Active Ticket
                </span>
                <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                  <span>{orderMode === "DINE_IN" ? selectedTable || "No Table" : takeawayToken}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      orderMode === "DINE_IN"
                        ? currentTableSession?.status === "COOKING"
                          ? "bg-amber-100 text-amber-800"
                          : currentTableSession?.status === "BILLED"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {orderMode === "DINE_IN"
                      ? currentTableSession?.status || "VACANT"
                      : orderMode}
                  </span>
                </h3>
              </div>

              {/* Reset / Clear Button */}
              {cart.length > 0 && (
                <button
                  onClick={clearCurrentCart}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Clear Cart</span>
                </button>
              )}
            </div>

            {/* Customer Details Strip */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-zinc-200/60">
              <div className="relative">
                <User size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-medium outline-none focus:border-[#E46254]"
                />
              </div>

              <div className="relative">
                <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-medium outline-none focus:border-[#E46254]"
                />
              </div>
            </div>
          </div>

          {/* Ticket Items Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* If Dine-In: Previously Fired Kitchen Items (Read-only status) */}
            {orderMode === "DINE_IN" && currentTableSession?.firedItems && currentTableSession.firedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/70">
                  <span className="flex items-center gap-1.5">
                    <ChefHat size={14} className="text-amber-600" />
                    <span>In Kitchen (Fired)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-amber-700">
                    {getElapsedMinutes(currentTableSession.firstOrderTime)} ago
                  </span>
                </div>

                <div className="divide-y divide-zinc-100 bg-zinc-50/60 rounded-xl p-2 border border-zinc-200/50">
                  {currentTableSession.firedItems.map((fi, idx) => (
                    <div key={`${fi.id}-${idx}`} className="py-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-zinc-500 w-5">
                          {fi.quantity}×
                        </span>
                        <div>
                          <p className="font-semibold text-zinc-700">{fi.name}</p>
                          {fi.notes && <p className="text-[10px] text-zinc-400 italic">{fi.notes}</p>}
                        </div>
                      </div>
                      <span className="font-bold text-zinc-800">₹{fi.price * fi.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Cart / Unfired Items Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-700 px-1">
                <span>
                  {orderMode === "DINE_IN" ? "New Items (Pending KOT)" : "Takeaway Dishes"}
                </span>
                <span className="text-zinc-400">{cart.length} items</span>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-zinc-200 rounded-2xl">
                  <p className="text-xs font-semibold text-zinc-400">
                    No new items in ticket
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Tap any dish from the menu to add
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-zinc-200/80 rounded-xl p-2.5 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 pr-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              item.isVeg ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span className="text-xs font-bold text-zinc-800 truncate">
                            {item.name}
                          </span>
                        </div>

                        {/* Qty Stepper */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
                            <button
                              onClick={() => updateCartQty(item.id, -1)}
                              className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-900 cursor-pointer"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="text-xs font-black px-1.5 text-zinc-900 tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartQty(item.id, 1)}
                              className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-900 cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          <span className="text-xs font-bold text-zinc-900 w-12 text-right">
                            ₹{item.price * item.quantity}
                          </span>

                          <button
                            onClick={() => removeCartItem(item.id)}
                            className="text-zinc-300 hover:text-rose-500 p-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Special cooking instruction note */}
                      <input
                        type="text"
                        placeholder="Add cooking note (e.g. less spicy)..."
                        value={item.notes || ""}
                        onChange={(e) => updateCartItemNote(item.id, e.target.value)}
                        className="w-full text-[11px] px-2 py-0.5 bg-zinc-50 border border-zinc-200/70 rounded text-zinc-600 placeholder:text-zinc-400 outline-none focus:border-zinc-400"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Footer: Bill Calculations + Action Buttons */}
          <div className="shrink-0 p-4 bg-zinc-50 border-t border-zinc-200/80 space-y-3">
            
            {/* Price Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span className="font-semibold text-zinc-800">₹{subtotal}</span>
              </div>

              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-₹{effectiveDiscount.toFixed(1)}</span>
                </div>
              )}

              <div className="flex justify-between text-zinc-500">
                <span>GST (5%)</span>
                <span className="font-semibold text-zinc-800">₹{taxTotal.toFixed(1)}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-sm font-black text-zinc-900">
                <div className="flex items-center gap-2">
                  <span>Grand Total</span>
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    className="text-[10px] font-bold text-[#E46254] bg-[#E46254]/10 px-2 py-0.5 rounded cursor-pointer hover:bg-[#E46254]/20"
                  >
                    {effectiveDiscount > 0 ? "Edit Disc" : "+ Discount"}
                  </button>
                </div>
                <span className="text-lg font-black text-zinc-900">₹{grandTotal}</span>
              </div>
            </div>

            {/* Action Buttons: High-Contrast & Clearly Positioned */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              
              {/* Button 1: FIRE KOT (Amber Button) */}
              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleFireKOT}
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Flame size={15} />
                <span>Fire KOT</span>
              </button>

              {/* Button 2: Print Bill Estimate (Dine-In) OR Direct Settle */}
              {orderMode === "DINE_IN" ? (
                <button
                  disabled={allCurrentItems.length === 0 || isSubmitting}
                  onClick={handlePrintGuestBill}
                  className="py-2.5 px-3 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Print Bill</span>
                </button>
              ) : null}

              {/* Button 3: Settle / Pay (Full Width or Primary Emerald Button) */}
              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={() => setShowPaymentModal(true)}
                className={`py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                  orderMode !== "DINE_IN" ? "col-span-1" : "col-span-2"
                }`}
              >
                <CreditCard size={15} />
                <span>
                  {orderMode === "DINE_IN" ? "Settle Table" : "Quick Pay & Settle"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: FULL FLOOR MAP (Table Layout Grid)
         ═════════════════════════════════════════════════════════════════════ */}
      {showFloorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-lg font-black text-zinc-900">Floor Tables Overview</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Select a table to open its active order ticket or start a new order.
                </p>
              </div>

              {/* Status Legend */}
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-zinc-600">Vacant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-zinc-600">In Kitchen</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-zinc-600">Billed</span>
                </div>
                <button
                  onClick={() => setShowFloorModal(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer ml-3"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {locations.map((loc) => {
                const session = tableSessionMap.get(loc.name);
                const isSelected = selectedTable === loc.name;
                const isVacant = !session || session.status === "VACANT";
                const isCooking = session?.status === "COOKING";
                const isBilled = session?.status === "BILLED";
                const elapsed = getElapsedMinutes(session?.firstOrderTime);

                return (
                  <div
                    key={loc.id}
                    onClick={() => {
                      setSelectedTable(loc.name);
                      setShowFloorModal(false);
                      clearCurrentCart();
                    }}
                    className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98] min-h-[140px] shadow-xs ${
                      isSelected ? "ring-2 ring-[#E46254]" : ""
                    } ${
                      isVacant
                        ? "bg-white border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50/20"
                        : isCooking
                        ? "bg-amber-50/70 border-amber-300 hover:border-amber-400"
                        : "bg-indigo-50/70 border-indigo-300 hover:border-indigo-400"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                            isVacant
                              ? "bg-emerald-100 text-emerald-800"
                              : isCooking
                              ? "bg-amber-200 text-amber-900"
                              : "bg-indigo-200 text-indigo-900"
                          }`}
                        >
                          {isVacant ? "Vacant" : isCooking ? "Cooking" : "Billed"}
                        </span>
                        <h4 className="text-base font-black text-zinc-900 mt-2">{loc.name}</h4>
                      </div>

                      {elapsed && (
                        <span className="text-[10px] font-bold text-zinc-500 bg-white/80 px-1.5 py-0.5 rounded">
                          {elapsed}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-200/60">
                      <span className="text-xs text-zinc-500 font-medium">
                        {isVacant ? `${loc.capacity || 4} Seats` : `${session?.firedItems.length || 0} items`}
                      </span>
                      <span className="text-sm font-black text-zinc-900">
                        {isVacant ? "Available" : `₹${session?.runningTotal}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: PAYMENT & SETTLEMENT (Cash Tender / Dynamic UPI / Card)
         ═════════════════════════════════════════════════════════════════════ */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-900">Payment Settlement</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {orderMode === "DINE_IN" ? `Table: ${selectedTable}` : takeawayToken} · Total: ₹{grandTotal}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Payment Method Selector */}
              <div className="grid grid-cols-3 gap-2">
                {(["CASH", "UPI", "CARD"] as PaymentMethod[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedPaymentMethod(mode)}
                    className={`py-3 rounded-2xl text-xs font-black flex flex-col items-center gap-1.5 border transition-all cursor-pointer ${
                      selectedPaymentMethod === mode
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-md"
                        : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {mode === "CASH" && <Banknote size={18} />}
                    {mode === "UPI" && <QrCode size={18} />}
                    {mode === "CARD" && <CreditCard size={18} />}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>

              {/* Mode-Specific Payment UI */}
              {selectedPaymentMethod === "CASH" && (
                <div className="space-y-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-600">Cash Tendered:</span>
                    <input
                      type="number"
                      placeholder={`₹${grandTotal}`}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-32 py-1.5 px-3 text-right bg-white border border-zinc-300 rounded-xl font-black text-sm outline-none focus:border-[#E46254]"
                    />
                  </div>

                  {/* Fast Note Quick Buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-400">Quick:</span>
                    {[
                      grandTotal,
                      Math.ceil(grandTotal / 100) * 100,
                      500,
                      1000,
                      2000,
                    ]
                      .filter((v, i, a) => v >= grandTotal && a.indexOf(v) === i)
                      .slice(0, 4)
                      .map((val) => (
                        <button
                          key={val}
                          onClick={() => setCashTendered(val.toString())}
                          className="px-2.5 py-1 rounded-lg bg-white border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                        >
                          ₹{val}
                        </button>
                      ))}
                  </div>

                  {/* Return Change Calculator */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
                    <span className="text-xs font-black text-zinc-600">Return Change:</span>
                    <span className="text-base font-black text-emerald-600">
                      ₹{changeDue.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}

              {selectedPaymentMethod === "UPI" && (
                <div className="flex flex-col items-center justify-center p-5 bg-zinc-50 rounded-2xl border border-zinc-200/80 text-center space-y-3">
                  <div className="p-3 bg-white rounded-2xl border border-zinc-200 shadow-sm">
                    <QRCode value={upiIntentUrl} size={150} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-800">Scan & Pay ₹{grandTotal}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{upiId || "UPI Enabled"}</p>
                  </div>
                </div>
              )}

              {selectedPaymentMethod === "CARD" && (
                <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-200/80 text-center space-y-2">
                  <CreditCard size={32} className="mx-auto text-zinc-400" />
                  <p className="text-xs font-bold text-zinc-800">Swipe / Tap on POS Terminal</p>
                  <p className="text-[11px] text-zinc-400">
                    Collect ₹{grandTotal} on your card machine and click Confirm below.
                  </p>
                </div>
              )}

              {/* Confirm Settlement Button */}
              <button
                disabled={isSubmitting}
                onClick={handleSettleOrder}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>
                  Confirm ₹{grandTotal} via {selectedPaymentMethod} & Print Invoice
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL: DISCOUNT SETTER
         ═════════════════════════════════════════════════════════════════════ */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-zinc-900">Apply Discount</h3>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button
                onClick={() => setDiscountMode("PERCENT")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  discountMode === "PERCENT" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setDiscountMode("FLAT")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  discountMode === "FLAT" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                Flat Amount (₹)
              </button>
            </div>

            {discountMode === "PERCENT" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setDiscountPercent(pct)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        discountPercent === pct
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Custom %"
                  value={discountPercent || ""}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                />
              </div>
            ) : (
              <input
                type="number"
                placeholder="Discount amount in ₹"
                value={discountAmount || ""}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none"
              />
            )}

            <button
              onClick={() => setShowDiscountModal(false)}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Apply Discount
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          THERMAL PRINT TEMPLATE (ESC/POS 80mm / 58mm Standard Receipt)
         ═════════════════════════════════════════════════════════════════════ */}
      <div id="thermal-chit" className="hidden print:block text-black bg-white font-mono text-[11px] leading-tight p-2">
        {printChit && (
          <div>
            {printChit.type === "KOT" ? (
              <div className="space-y-1">
                <div className="text-center font-bold text-sm border-b pb-1">
                  *** KITCHEN ORDER TICKET (KOT) ***
                </div>
                <div className="flex justify-between font-bold pt-1">
                  <span>{printChit.mode === "DINE_IN" ? "TABLE:" : "TOKEN:"}</span>
                  <span className="text-base">{printChit.tableOrToken}</span>
                </div>
                {printChit.kotNumber && (
                  <div>KOT ROUND: #{printChit.kotNumber}</div>
                )}
                <div>TIME: {printChit.time}</div>
                {printChit.customerName && <div>GUEST: {printChit.customerName}</div>}
                <div className="border-b my-1" />
                <div className="space-y-1 font-bold">
                  {printChit.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{it.quantity}× {it.name}</span>
                      {it.notes && <span className="text-[10px] italic">({it.notes})</span>}
                    </div>
                  ))}
                </div>
                <div className="border-t my-1" />
                <div className="text-center text-[10px]">
                  {printChit.mode === "DINE_IN" ? "[DINE-IN PLATING]" : "[PARCEL / TAKEAWAY PACKING]"}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-center font-bold text-base">{restaurantName}</div>
                <div className="text-center text-[10px]">TAX INVOICE / GUEST BILL</div>
                <div className="border-b my-1" />
                <div className="flex justify-between">
                  <span>{printChit.mode === "DINE_IN" ? "Table:" : "Token:"} {printChit.tableOrToken}</span>
                  <span>{printChit.time}</span>
                </div>
                {printChit.customerName && <div>Customer: {printChit.customerName}</div>}
                <div className="border-b my-1" />
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th>Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printChit.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-0.5">{it.name}</td>
                        <td className="text-center">{it.quantity}</td>
                        <td className="text-right">₹{(it.price || 0) * it.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t my-1" />
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{printChit.subtotal}</span>
                </div>
                {printChit.discount ? (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₹{printChit.discount.toFixed(1)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>GST (5%):</span>
                  <span>₹{printChit.tax?.toFixed(1)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t pt-1">
                  <span>Grand Total:</span>
                  <span>₹{printChit.grandTotal}</span>
                </div>
                {printChit.paymentMethod && (
                  <div className="flex justify-between text-[10px] pt-0.5">
                    <span>Paid via:</span>
                    <span>{printChit.paymentMethod}</span>
                  </div>
                )}
                <div className="border-t my-1" />
                <div className="text-center text-[10px]">Thank you, Visit Again!</div>
              </div>
            )}
          </div>
        )}
      </div>

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
            width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
          }
        }
      `}</style>
    </div>
  );
}
