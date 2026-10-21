"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
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
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  User,
  Phone,
  Flame,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRightLeft,
  ChevronDown
} from "lucide-react";
import QRCode from "react-qr-code";
import { createClient } from "@/utils/supabase/client";

/* ─── Types ───────────────────────────────────────────────────────── */
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
type PaymentMethod = "CASH" | "UPI" | "CARD" | "SPLIT";

export default function PosTerminalPage() {
  const supabase = createClient();

  // Core Data
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("Restaurant");
  const [upiId, setUpiId] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Terminal Mode
  const [orderMode, setOrderMode] = useState<OrderMode>("DINE_IN");

  // Dine-In Specific Selection
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [showMoveTablePicker, setShowMoveTablePicker] = useState<boolean>(false);

  // Takeaway Specific Selection: Sequential Daily Token
  const [takeawayTokenNumber, setTakeawayTokenNumber] = useState<number>(1);
  const takeawayToken = `Token #${takeawayTokenNumber}`;

  // Customer Info (Compact)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Cart / Pending Items
  const [cart, setCart] = useState<CartItem[]>([]);

  // Search & Categories
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Discount (Inline)
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  // Inline Payment States (NO MODALS)
  const [cashTendered, setCashTendered] = useState<string>("");
  const [showInlineUpi, setShowInlineUpi] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Thermal Print State
  const [printChit, setPrintChit] = useState<{
    type: "KOT" | "BILL" | "VOID";
    mode: OrderMode;
    tableOrToken: string;
    kotNumber?: number;
    customerName?: string;
    items: Array<{ name: string; quantity: number; price?: number; notes?: string }>;
    subtotal?: number;
    discount?: number;
    tax?: number;
    grandTotal?: number;
    paymentMethod?: string;
    time: string;
    reason?: string;
  } | null>(null);

  // Quick Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ─── 1. Load Real Data from Supabase ────────────────────────────── */
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

      // Restaurant Profile
      const { data: rest } = await supabase
        .from("restaurants")
        .select("id, name, upi_id")
        .eq("id", restId)
        .maybeSingle();

      if (rest) {
        if (rest.name) setRestaurantName(rest.name);
        if (rest.upi_id) setUpiId(rest.upi_id);
      }

      // Tables / Locations: STRICTLY ONLY WHAT OWNER CREATED (NO HARDCODING)
      const { data: locData } = await supabase
        .from("locations")
        .select("*")
        .eq("restaurant_id", restId)
        .order("name", { ascending: true });

      if (locData && locData.length > 0) {
        const loaded = locData.map((l: any) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          capacity: l.capacity,
        }));
        setLocations(loaded);
        setSelectedTable(loaded[0].name);
      } else {
        // Zero tables if the owner hasn't created any
        setLocations([]);
        setSelectedTable("");
      }

      // Menu Items (Tenant Scoped)
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

      // Active Orders
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
      setActiveOrders(orderData as OrderRecord[]);

      // Compute next sequential Takeaway Token # based on today's count
      const today = new Date().toDateString();
      const todayTakeaways = orderData.filter((o) => {
        const isTk = (o.table_no || "").toLowerCase().includes("token") || (o.table_no || "").toLowerCase().includes("takeaway");
        return isTk && new Date(o.created_at).toDateString() === today;
      });
      setTakeawayTokenNumber(todayTakeaways.length + 1);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Realtime Postgres listener
    const channel = supabase
      .channel("pos_fast_terminal_sync")
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

  /* ─── 2. Keyboard Shortcuts Engine (F1, F2, F4, F8, F9, /) ────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search: '/'
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // F1: Dine-In Mode
      if (e.key === "F1") {
        e.preventDefault();
        setOrderMode("DINE_IN");
        return;
      }
      // F2: Takeaway Mode
      if (e.key === "F2") {
        e.preventDefault();
        setOrderMode("TAKEAWAY");
        return;
      }
      // F4: Fire KOT
      if (e.key === "F4") {
        e.preventDefault();
        handleFireKOT();
        return;
      }
      // F8: Instant Cash Settle
      if (e.key === "F8") {
        e.preventDefault();
        handleQuickSettle("CASH");
        return;
      }
      // F9: Print Bill Estimate
      if (e.key === "F9") {
        e.preventDefault();
        handlePrintGuestBill();
        return;
      }
      // Esc: Dismiss UPI QR / Unfocus
      if (e.key === "Escape") {
        setShowInlineUpi(false);
        setShowMoveTablePicker(false);
        setShowDiscountInput(false);
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  /* ─── 3. Dine-In Table Status Computation ─────────────────────────── */
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
        ord.table_no.toLowerCase().includes("token") ||
        ord.table_no.toLowerCase().includes("takeaway") ||
        ord.table_no.toLowerCase().includes("counter");

      if (isTakeaway) return;

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
          session!.firedItems.push({
            id: it.id || raw.id || Math.random().toString(),
            name: it.name || raw.name || "Dish",
            price: raw.price || it.basePrice || 0,
            quantity: raw.quantity || 1,
            isVeg: it.isVeg !== false,
            category: it.category,
            notes: raw.notes || "",
          });
        });
      }

      if (ord.note && ord.note.includes("[POS Bill Printed")) {
        session.status = "BILLED";
      } else {
        session.status = "COOKING";
      }
    });

    return map;
  }, [locations, activeOrders]);

  const currentTableSession = useMemo(() => {
    if (orderMode !== "DINE_IN" || !selectedTable) return null;
    return tableSessionMap.get(selectedTable) || null;
  }, [tableSessionMap, orderMode, selectedTable]);

  /* ─── 4. Active Takeaway Tokens ───────────────────────────────────── */
  const activeTakeawayOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      const t = (o.table_no || "").toLowerCase();
      return t.includes("token") || t.includes("takeaway") || t.includes("counter");
    });
  }, [activeOrders]);

  /* ─── 5. Categories & Menu Filtering ──────────────────────────────── */
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
  }, [menuItems, selectedCategory, searchQuery]);

  /* ─── 6. Cart Operations ──────────────────────────────────────────── */
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

  const clearCurrentCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setCashTendered("");
    setShowInlineUpi(false);
  };

  /* ─── 7. Calculations ─────────────────────────────────────────────── */
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
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const taxTotal = (taxableAmount * 5) / 100; // 5% GST
  const grandTotal = Math.round(taxableAmount + taxTotal);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - grandTotal);
  }, [cashTendered, grandTotal]);

  /* ─── 8. Actions: Fire KOT ────────────────────────────────────────── */
  const handleFireKOT = async () => {
    if (cart.length === 0) {
      showToast("No new items in cart to send to kitchen.");
      return;
    }

    const targetDestination = orderMode === "DINE_IN" ? selectedTable : takeawayToken;
    if (!targetDestination) {
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
          (isDineIn ? `Guest (${selectedTable})` : `Takeaway (${targetDestination})`),
        customer_phone: customerPhone.trim() || null,
        items_json: kotPayload,
        note: orderTag,
      });

      if (error) throw error;

      showToast(`🔥 KOT fired to Kitchen for ${targetDestination}!`);

      setPrintChit({
        type: "KOT",
        mode: orderMode,
        tableOrToken: targetDestination,
        kotNumber: kotRoundNum,
        customerName: customerName.trim(),
        items: cart.map((c) => ({ name: c.name, quantity: c.quantity, notes: c.notes })),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      clearCurrentCart();
      if (restaurantId) fetchActiveOrders(restaurantId);

      setTimeout(() => {
        window.print();
      }, 100);
    } catch (err: any) {
      showToast("Failed to fire KOT: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 9. Actions: Void / Cancel Dish on Fired Order ───────────────── */
  const handleVoidFiredDish = async (dishName: string, itemPrice: number) => {
    if (!currentTableSession || currentTableSession.orders.length === 0) return;

    const confirmVoid = window.confirm(`Void / Cancel 1x "${dishName}" from Table ${selectedTable}?`);
    if (!confirmVoid) return;

    setIsSubmitting(true);
    try {
      // Find order containing this dish
      for (const ord of currentTableSession.orders) {
        if (!Array.isArray(ord.items_json)) continue;
        const idx = ord.items_json.findIndex(
          (raw: any) => (raw.item?.name || raw.name) === dishName
        );

        if (idx !== -1) {
          const updatedItems = [...ord.items_json];
          const target = updatedItems[idx];

          if (target.quantity > 1) {
            target.quantity -= 1;
          } else {
            updatedItems.splice(idx, 1);
          }

          const newTotal = Math.max(0, Number(ord.total || 0) - itemPrice);

          if (updatedItems.length === 0) {
            await supabase.from("orders").delete().eq("id", ord.id);
          } else {
            await supabase
              .from("orders")
              .update({
                items_json: updatedItems,
                total: newTotal,
                note: `[KOT Item Voided: ${dishName}]`,
              })
              .eq("id", ord.id);
          }

          // Trigger Kitchen Void Chit print
          setPrintChit({
            type: "VOID",
            mode: "DINE_IN",
            tableOrToken: selectedTable,
            items: [{ name: dishName, quantity: 1 }],
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            reason: "Customer Cancelled / Mistake",
          });

          showToast(`🚫 Cancelled 1x ${dishName} on Table ${selectedTable}`);
          if (restaurantId) fetchActiveOrders(restaurantId);

          setTimeout(() => {
            window.print();
          }, 100);
          break;
        }
      }
    } catch (err: any) {
      showToast("Error voiding item: " + (err.message || "Failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 10. Actions: Move / Transfer Table ──────────────────────────── */
  const handleTransferTable = async (targetTable: string) => {
    if (!currentTableSession || currentTableSession.orders.length === 0) {
      setSelectedTable(targetTable);
      setShowMoveTablePicker(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const orderIds = currentTableSession.orders.map((o) => o.id);
      const { error } = await supabase
        .from("orders")
        .update({ table_no: targetTable, note: `[Transferred from ${selectedTable}]` })
        .in("id", orderIds);

      if (error) throw error;

      showToast(`↔️ Moved ${selectedTable} ➔ ${targetTable}`);
      setSelectedTable(targetTable);
      setShowMoveTablePicker(false);
      if (restaurantId) fetchActiveOrders(restaurantId);
    } catch (err: any) {
      showToast("Transfer failed: " + (err.message || "Failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 11. Actions: Print Bill Estimate (Guest Check) ──────────────── */
  const handlePrintGuestBill = async () => {
    if (allCurrentItems.length === 0) {
      showToast("No items to print bill.");
      return;
    }

    const targetDestination = orderMode === "DINE_IN" ? selectedTable : takeawayToken;

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

    showToast(`🖨️ Bill Printed for ${targetDestination} (F9)`);
    if (restaurantId) fetchActiveOrders(restaurantId);

    setTimeout(() => {
      window.print();
    }, 100);
  };

  /* ─── 12. Actions: Fast Inline Settle (1-Click Cash/UPI/Card) ─────── */
  const handleQuickSettle = async (method: PaymentMethod) => {
    if (allCurrentItems.length === 0) {
      showToast("No items to settle.");
      return;
    }

    const targetDestination = orderMode === "DINE_IN" ? selectedTable : takeawayToken;
    setIsSubmitting(true);

    try {
      if (orderMode === "DINE_IN" && currentTableSession && currentTableSession.orders.length > 0) {
        const orderIds = currentTableSession.orders.map((o) => o.id);

        await supabase
          .from("orders")
          .update({
            status: "COMPLETED",
            payment_status: "PAID",
            payment_method: method,
            total: grandTotal,
            note: `[POS Settled: ${method}]`,
          })
          .in("id", orderIds);

        // Save any unsaved cart items directly as paid
        if (cart.length > 0) {
          const unsavedPayload = cart.map((c) => ({
            item: { id: c.id, name: c.name, basePrice: c.price, category: c.category, isVeg: c.isVeg },
            price: c.price,
            quantity: c.quantity,
            isReady: true,
          }));

          await supabase.from("orders").insert({
            restaurant_id: restaurantId,
            table_no: selectedTable,
            total: cart.reduce((s, it) => s + it.price * it.quantity, 0),
            status: "COMPLETED",
            payment_status: "PAID",
            payment_method: method,
            customer_name: customerName.trim() || `Guest (${selectedTable})`,
            items_json: unsavedPayload,
            note: `[POS Addon Settled: ${method}]`,
          });
        }
      } else {
        // Direct Takeaway Settle
        const itemsPayload = allCurrentItems.map((c) => ({
          item: { id: c.id, name: c.name, basePrice: c.price, category: c.category, isVeg: c.isVeg },
          price: c.price,
          quantity: c.quantity,
          isReady: true,
        }));

        await supabase.from("orders").insert({
          restaurant_id: restaurantId,
          table_no: targetDestination,
          total: grandTotal,
          status: "COMPLETED",
          payment_status: "PAID",
          payment_method: method,
          customer_name: customerName.trim() || `${targetDestination}`,
          customer_phone: customerPhone.trim() || null,
          items_json: itemsPayload,
          note: `[POS Settled: ${method}]`,
        });
      }

      showToast(`✅ Settled ₹${grandTotal} via ${method}!`);

      // Print Final Tax Invoice
      setPrintChit({
        type: "BILL",
        mode: orderMode,
        tableOrToken: targetDestination,
        customerName: customerName.trim(),
        paymentMethod: method,
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

      clearCurrentCart();
      setCustomerName("");
      setCustomerPhone("");

      // Increment Takeaway token sequentially
      if (orderMode === "TAKEAWAY") {
        setTakeawayTokenNumber((prev) => prev + 1);
      }

      if (restaurantId) fetchActiveOrders(restaurantId);

      setTimeout(() => {
        window.print();
      }, 100);
    } catch (err: any) {
      showToast("Settlement failed: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPI Intent URL
  const upiIntentUrl = useMemo(() => {
    const vpa = upiId || "merchant@upi";
    const name = encodeURIComponent(restaurantName);
    return `upi://pay?pa=${vpa}&pn=${name}&am=${grandTotal}&cu=INR`;
  }, [upiId, restaurantName, grandTotal]);

  return (
    <div className="flex h-screen flex-col bg-[#F8F9FA] font-sans text-zinc-900 select-none overflow-hidden">
      
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed top-3 right-4 z-[300] bg-zinc-900 text-white px-3.5 py-2 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          CLEAN SLIM HEADER: Store Name + Mode Tabs + Keyboard Shortcuts
         ═════════════════════════════════════════════════════════════════════ */}
      <header className="shrink-0 h-12 bg-white border-b border-zinc-200 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-black text-zinc-900 tracking-tight">
            {restaurantName}
          </h1>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
            <button
              onClick={() => {
                setOrderMode("DINE_IN");
                if (!selectedTable && locations.length > 0) setSelectedTable(locations[0].name);
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                orderMode === "DINE_IN"
                  ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <UtensilsCrossed size={13} className={orderMode === "DINE_IN" ? "text-[#E46254]" : ""} />
              <span>Dine-In (F1)</span>
            </button>

            <button
              onClick={() => setOrderMode("TAKEAWAY")}
              className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                orderMode === "TAKEAWAY"
                  ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <ShoppingBag size={13} className={orderMode === "TAKEAWAY" ? "text-[#E46254]" : ""} />
              <span>Takeaway (F2)</span>
            </button>

            <button
              onClick={() => setOrderMode("DELIVERY")}
              className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                orderMode === "DELIVERY"
                  ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <Bike size={13} className={orderMode === "DELIVERY" ? "text-[#E46254]" : ""} />
              <span>Delivery</span>
            </button>
          </div>
        </div>

        {/* Keyboard Helper Pills */}
        <div className="hidden md:flex items-center gap-2 text-[11px] font-semibold text-zinc-400">
          <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600">/ Search</span>
          <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600">F4 Fire KOT</span>
          <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600">F8 Settle Cash</span>
          <span className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600">F9 Bill</span>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════════════
          SUB-BAR: Real Tables Strip (NO Hardcoding) OR Takeaway Counter
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 bg-white border-b border-zinc-200 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        {orderMode === "DINE_IN" ? (
          locations.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 w-full">
              <AlertCircle size={14} className="shrink-0" />
              <span>No tables created yet.</span>
              <Link href="/dashboard/locations" className="font-bold underline text-amber-900 hover:text-black">
                Add your restaurant tables in Table Orders / Locations
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">
                Tables:
              </span>
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-[#E46254] text-white border-[#E46254] shadow-xs"
                        : isVacant
                        ? "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                        : isCooking
                        ? "bg-amber-50 text-amber-900 border-amber-300"
                        : "bg-indigo-50 text-indigo-900 border-indigo-300"
                    }`}
                  >
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
                      <span className={`text-[10px] font-bold ${isSelected ? "text-white" : "text-zinc-600"}`}>
                        ₹{session.runningTotal}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-zinc-900">
                {takeawayToken}
              </span>
              <button
                onClick={() => {
                  setTakeawayTokenNumber((prev) => prev + 1);
                  clearCurrentCart();
                  showToast(`Switched to Token #${takeawayTokenNumber + 1}`);
                }}
                className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                + Next Token
              </button>
            </div>

            {/* Quick in-progress takeaway pills */}
            {activeTakeawayOrders.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-bold text-zinc-400">Waiting:</span>
                {activeTakeawayOrders.map((ord) => (
                  <span
                    key={ord.id}
                    className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px] font-bold"
                  >
                    {ord.table_no} (₹{ord.total})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          MAIN WORKSPACE: Split Layout (Left Menu 65% | Right Ticket 35%)
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ── LEFT: High-Density Menu Catalog ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA] border-r border-zinc-200">
          
          {/* Search Bar + Category Pills */}
          <div className="shrink-0 p-3 bg-white border-b border-zinc-200 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search dish or category... ('/' to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:border-[#E46254] focus:bg-white rounded-lg text-xs font-medium outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category Pills Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 border shrink-0 ${
                      isSelected
                        ? "bg-[#E46254] text-white border-[#E46254]"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900"
                    }`}
                  >
                    <span>{cat === "ALL" ? "All" : cat}</span>
                    <span className={`text-[10px] font-semibold ${isSelected ? "text-white/80" : "text-zinc-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High-Density Dish Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl border border-zinc-200">
                <Receipt size={28} className="text-zinc-300 mb-1" />
                <h3 className="text-xs font-bold text-zinc-700">No dishes found</h3>
                <p className="text-[11px] text-zinc-400">Try clearing your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredItems.map((dish) => {
                  const cartItem = cart.find((c) => c.id === dish.id);
                  const inCartQty = cartItem ? cartItem.quantity : 0;

                  return (
                    <div
                      key={dish.id}
                      onClick={() => addToCart(dish)}
                      className={`bg-white rounded-xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between select-none hover:border-[#E46254]/50 hover:shadow-xs active:scale-[0.98] ${
                        inCartQty > 0 ? "border-[#E46254] ring-1 ring-[#E46254]/20 bg-[#E46254]/2" : "border-zinc-200"
                      }`}
                    >
                      <div>
                        {/* Dot + Category */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`w-3 h-3 border flex items-center justify-center shrink-0 rounded-2xs ${
                              dish.is_veg ? "border-emerald-600" : "border-rose-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                dish.is_veg ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            />
                          </span>
                          <span className="text-[9px] font-semibold text-zinc-400 truncate max-w-[80px]">
                            {dish.category}
                          </span>
                        </div>

                        {/* Name */}
                        <h4 className="text-xs font-bold text-zinc-800 line-clamp-2 leading-snug min-h-[30px]">
                          {dish.name}
                        </h4>
                      </div>

                      {/* Price & Add */}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-100">
                        <span className="text-xs font-extrabold text-zinc-900">
                          ₹{dish.base_price}
                        </span>

                        {inCartQty > 0 ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 bg-[#E46254] text-white px-1.5 py-0.5 rounded shadow-xs"
                          >
                            <button
                              onClick={() => updateCartQty(dish.id, -1)}
                              className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="text-[11px] font-black px-1">{inCartQty}</span>
                            <button
                              onClick={() => updateCartQty(dish.id, 1)}
                              className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-[#E46254] bg-[#E46254]/10 hover:bg-[#E46254] hover:text-white px-1.5 py-0.5 rounded transition-colors">
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

        {/* ── RIGHT: Direct Order Ticket & Inline Fast Tender Dock ── */}
        <div className="w-[360px] xl:w-[400px] bg-white flex flex-col justify-between shrink-0 shadow-md border-l border-zinc-200 z-20">
          
          {/* Ticket Header */}
          <div className="shrink-0 p-3 border-b border-zinc-200 bg-zinc-50/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-zinc-900">
                  {orderMode === "DINE_IN" ? selectedTable || "No Table" : takeawayToken}
                </span>

                {/* Transfer Table Button */}
                {orderMode === "DINE_IN" && locations.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMoveTablePicker((v) => !v)}
                      className="px-2 py-0.5 text-[10px] font-bold text-zinc-600 bg-white border border-zinc-300 rounded hover:bg-zinc-100 flex items-center gap-1 cursor-pointer"
                      title="Move Table"
                    >
                      <ArrowRightLeft size={10} />
                      <span>Move</span>
                    </button>

                    {/* Move Table Dropdown */}
                    {showMoveTablePicker && (
                      <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-zinc-200 rounded-lg shadow-xl p-1 z-50 space-y-0.5">
                        <p className="text-[10px] font-bold text-zinc-400 px-2 py-1">Transfer to:</p>
                        {locations
                          .filter((l) => l.name !== selectedTable)
                          .map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleTransferTable(loc.name)}
                              className="w-full text-left px-2 py-1 rounded text-xs font-semibold hover:bg-zinc-100 cursor-pointer"
                            >
                              {loc.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCurrentCart}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Optional Customer Inputs */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input
                type="text"
                placeholder="Guest Name (Optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-zinc-200 rounded text-xs outline-none focus:border-zinc-400"
              />
              <input
                type="tel"
                placeholder="Phone (Optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-zinc-200 rounded text-xs outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Ticket Scroll Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            
            {/* Previously Fired Kitchen Items (With VOID / CANCEL Button) */}
            {orderMode === "DINE_IN" && currentTableSession?.firedItems && currentTableSession.firedItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  <span className="flex items-center gap-1.5">
                    <ChefHat size={13} className="text-amber-600" />
                    <span>In Kitchen (Fired)</span>
                  </span>
                  <span className="text-[10px] text-amber-700">Tap ❌ to Void</span>
                </div>

                <div className="divide-y divide-zinc-100 bg-zinc-50 rounded-lg p-2 border border-zinc-200">
                  {currentTableSession.firedItems.map((fi, idx) => (
                    <div key={`${fi.id}-${idx}`} className="py-1 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 flex-1 pr-2">
                        <span className="text-[11px] font-bold text-zinc-500">{fi.quantity}×</span>
                        <span className="font-semibold text-zinc-700 truncate">{fi.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-800">₹{fi.price * fi.quantity}</span>
                        <button
                          onClick={() => handleVoidFiredDish(fi.name, fi.price)}
                          className="text-zinc-300 hover:text-rose-600 p-0.5 cursor-pointer"
                          title="Void / Cancel Dish"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Cart / Unfired Items */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-700 px-1">
                <span>{orderMode === "DINE_IN" ? "New Items (Pending KOT)" : "Cart Items"}</span>
                <span className="text-zinc-400">{cart.length} items</span>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-zinc-200 rounded-lg">
                  <p className="text-xs text-zinc-400">Cart is empty</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Click dishes on the left to add</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-zinc-200 rounded-lg p-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 pr-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.isVeg ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        <span className="text-xs font-bold text-zinc-800 truncate">{item.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-zinc-100 rounded p-0.5">
                          <button
                            onClick={() => updateCartQty(item.id, -1)}
                            className="p-0.5 text-zinc-600 hover:text-black cursor-pointer"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="text-xs font-bold px-1 tabular-nums">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(item.id, 1)}
                            className="p-0.5 text-zinc-600 hover:text-black cursor-pointer"
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-zinc-900 w-12 text-right">
                          ₹{item.price * item.quantity}
                        </span>

                        <button
                          onClick={() => removeCartItem(item.id)}
                          className="text-zinc-300 hover:text-rose-500 p-0.5 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              INLINE TENDER DOCK (NO POPUP MODALS - SUB-5 SECOND CHECKOUT)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="shrink-0 p-3 bg-zinc-50 border-t border-zinc-200 space-y-2.5">
            
            {/* Price Row */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span className="font-semibold text-zinc-800">₹{subtotal}</span>
              </div>

              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-₹{effectiveDiscount.toFixed(1)}</span>
                </div>
              )}

              <div className="flex justify-between text-zinc-500">
                <span className="flex items-center gap-1">
                  <span>GST (5%)</span>
                  <button
                    onClick={() => setShowDiscountInput((v) => !v)}
                    className="text-[10px] text-[#E46254] underline cursor-pointer"
                  >
                    {discountPercent > 0 ? "Edit Disc" : "+ Discount"}
                  </button>
                </span>
                <span className="font-semibold text-zinc-800">₹{taxTotal.toFixed(1)}</span>
              </div>

              {/* Discount Selector Strip */}
              {showDiscountInput && (
                <div className="flex items-center gap-1 pt-1">
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        setDiscountPercent(pct);
                        setShowDiscountInput(false);
                      }}
                      className={`flex-1 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                        discountPercent === pct
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-600 border-zinc-200"
                      }`}
                    >
                      {pct === 0 ? "None" : `${pct}%`}
                    </button>
                  ))}
                </div>
              )}

              {/* Grand Total */}
              <div className="flex items-center justify-between pt-1.5 border-t border-zinc-200">
                <span className="text-xs font-bold text-zinc-600">Grand Total:</span>
                <span className="text-base font-black text-zinc-900">₹{grandTotal}</span>
              </div>
            </div>

            {/* Inline Dynamic UPI Preview */}
            {showInlineUpi && (
              <div className="bg-white p-2.5 rounded-lg border border-zinc-300 shadow-sm flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="p-1.5 bg-white border rounded">
                  <QRCode value={upiIntentUrl} size={80} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-[11px] font-black text-zinc-900">Scan & Pay ₹{grandTotal}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{upiId || "UPI Active"}</p>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleQuickSettle("UPI")}
                    className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer"
                  >
                    Confirm Paid
                  </button>
                </div>
                <button
                  onClick={() => setShowInlineUpi(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer self-start"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Quick Cash Change Calculator Bar */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="Cash Given..."
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                className="w-24 px-2 py-1 bg-white border border-zinc-300 rounded text-xs font-bold outline-none"
              />
              {[grandTotal, 500, 1000, 2000]
                .filter((v, i, a) => v >= grandTotal && a.indexOf(v) === i)
                .slice(0, 3)
                .map((val) => (
                  <button
                    key={val}
                    onClick={() => setCashTendered(val.toString())}
                    className="px-1.5 py-1 bg-white border border-zinc-300 hover:bg-zinc-100 rounded text-[11px] font-bold text-zinc-700 cursor-pointer"
                  >
                    ₹{val}
                  </button>
                ))}
              {parseFloat(cashTendered) > grandTotal && (
                <span className="text-[11px] font-black text-emerald-600 ml-auto">
                  Change: ₹{changeDue}
                </span>
              )}
            </div>

            {/* 1-TAP INLINE ACTION BUTTONS */}
            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              
              {/* Button 1: FIRE KOT (F4) */}
              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleFireKOT}
                className="col-span-2 py-2 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <Flame size={13} />
                <span>Fire KOT (F4)</span>
              </button>

              {/* Button 2: Print Bill Estimate (F9) */}
              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={handlePrintGuestBill}
                className="col-span-2 py-2 px-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer size={13} />
                <span>Bill (F9)</span>
              </button>

              {/* Button 3: Instant CASH Settle (F8) */}
              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={() => handleQuickSettle("CASH")}
                className="col-span-2 py-2.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <Banknote size={14} />
                <span>CASH (F8)</span>
              </button>

              {/* Button 4: Instant UPI QR Toggle */}
              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={() => setShowInlineUpi((v) => !v)}
                className="col-span-1 py-2.5 px-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <QrCode size={13} />
                <span>UPI</span>
              </button>

              {/* Button 5: Instant CARD Settle */}
              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={() => handleQuickSettle("CARD")}
                className="col-span-1 py-2.5 px-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <CreditCard size={13} />
                <span>CARD</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          THERMAL PRINT RECEIPT (80mm / 58mm Standard ESC/POS)
         ═════════════════════════════════════════════════════════════════════ */}
      <div id="thermal-chit" className="hidden print:block text-black bg-white font-mono text-[11px] leading-tight p-2">
        {printChit && (
          <div>
            {printChit.type === "VOID" ? (
              <div className="space-y-1">
                <div className="text-center font-bold text-sm border-b pb-1">
                  *** KOT CANCELLATION CHIT ***
                </div>
                <div className="flex justify-between font-bold pt-1">
                  <span>TABLE: {printChit.tableOrToken}</span>
                  <span>{printChit.time}</span>
                </div>
                <div className="border-b my-1" />
                <div className="font-bold text-xs">
                  {printChit.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>CANCELLED: {it.quantity}× {it.name}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] pt-1">Reason: {printChit.reason || "Customer Request"}</div>
                <div className="border-t my-1" />
              </div>
            ) : printChit.type === "KOT" ? (
              <div className="space-y-1">
                <div className="text-center font-bold text-sm border-b pb-1">
                  *** KITCHEN ORDER TICKET (KOT) ***
                </div>
                <div className="flex justify-between font-bold pt-1">
                  <span>{printChit.mode === "DINE_IN" ? "TABLE:" : "TOKEN:"}</span>
                  <span className="text-base">{printChit.tableOrToken}</span>
                </div>
                {printChit.kotNumber && <div>KOT ROUND: #{printChit.kotNumber}</div>}
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
