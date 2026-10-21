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
  Printer,
  UtensilsCrossed,
  ShoppingBag,
  Send,
  RotateCcw,
  ArrowRightLeft,
  Merge,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown
} from "lucide-react";
import QRCode from "react-qr-code";
import { createClient } from "@/utils/supabase/client";

/* ─── Domain Models ────────────────────────────────────────────────── */
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

interface FiredRoundItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  category?: string;
  notes?: string;
  source: "QR" | "STAFF" | "CAPTAIN";
  roundNumber: number;
  orderId: string;
  createdAt: string;
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

type TerminalMode = "DINE_IN" | "TAKEAWAY";
type PaymentMethod = "CASH" | "UPI" | "CARD";

export default function UnifiedPosFloorPage() {
  const supabase = createClient();

  // Core Data State
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("Restaurant");
  const [upiId, setUpiId] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Terminal Navigation Mode
  const [terminalMode, setTerminalMode] = useState<TerminalMode>("DINE_IN");

  // Dine-In Table Management
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableFilter, setTableFilter] = useState<"ALL" | "ACTIVE" | "BILLED" | "VACANT">("ALL");
  const [showMovePicker, setShowMovePicker] = useState<boolean>(false);
  const [showMergePicker, setShowMergePicker] = useState<boolean>(false);

  // Takeaway State
  const [takeawayCounter, setTakeawayCounter] = useState<number>(1);
  const currentTakeawayToken = `Token #${takeawayCounter.toString().padStart(2, "0")}`;

  // Guest Info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Cart / New Staff Round to be sent to kitchen
  const [cart, setCart] = useState<CartItem[]>([]);

  // Menu Search & Category
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Discount
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [showDiscountSelector, setShowDiscountSelector] = useState(false);

  // Payment Drawer
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Thermal Chit Printing
  const [printChit, setPrintChit] = useState<{
    type: "KOT" | "BILL" | "VOID";
    mode: TerminalMode;
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

  // Minimal Toast Notice
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ─── 1. Fetch Real Data & Listen to Supabase Realtime ─────────────── */
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

      // Tables (Strictly owner-created, no dummy mocks)
      const { data: locData } = await supabase
        .from("locations")
        .select("*")
        .eq("restaurant_id", restId)
        .order("name", { ascending: true });

      if (locData && locData.length > 0) {
        const mappedLocs = locData.map((l: any) => ({
          id: l.id,
          name: l.name,
          type: l.type,
          capacity: l.capacity || 4,
        }));
        setLocations(mappedLocs);
        setSelectedTable(mappedLocs[0].name);
      } else {
        setLocations([]);
        setSelectedTable("");
      }

      // Menu Items
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

      await fetchActiveOrders(restId);
    } catch (err) {
      console.error("Failed to load POS data:", err);
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

      // Update Takeaway sequential token based on today's count
      const today = new Date().toDateString();
      const todayTakeaways = orderData.filter((o) => {
        const isTk = (o.table_no || "").toLowerCase().includes("token") || (o.table_no || "").toLowerCase().includes("takeaway");
        return isTk && new Date(o.created_at).toDateString() === today;
      });
      setTakeawayCounter(todayTakeaways.length + 1);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Supabase Realtime channel for instant sync across QR, Waiter, and Kitchen
    const channel = supabase
      .channel("unified_floor_live_sync")
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
          if (updated?.id) {
            setMenuItems((prev) =>
              prev.map((it) =>
                it.id === updated.id
                  ? { ...it, is_available: updated.is_available !== false }
                  : it
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

  /* ─── 2. Keyboard Ergonomics (F1, F2, F4, F8, F9, /) ──────────────── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        setTerminalMode("DINE_IN");
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        setTerminalMode("TAKEAWAY");
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        handleSendToKitchen();
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        setIsPaymentDrawerOpen(true);
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        handlePrintGuestBill();
        return;
      }
      if (e.key === "Escape") {
        setIsPaymentDrawerOpen(false);
        setShowMovePicker(false);
        setShowMergePicker(false);
        setShowDiscountSelector(false);
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  /* ─── 3. Unified Realtime Table State Machine ─────────────────────── */
  const tableSessionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        tableNo: string;
        status: "VACANT" | "COOKING" | "BILLED";
        orders: OrderRecord[];
        firedRounds: FiredRoundItem[];
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
        firedRounds: [],
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
          firedRounds: [],
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

      // Classify source: Guest QR vs Staff POS vs Captain
      const isGuestQr = !ord.note?.includes("Fired via POS");
      const roundIdx = session.orders.length;

      if (Array.isArray(ord.items_json)) {
        ord.items_json.forEach((raw: any) => {
          const it = raw.item || {};
          session!.firedRounds.push({
            id: it.id || raw.id || Math.random().toString(),
            name: it.name || raw.name || "Item",
            price: raw.price || it.basePrice || 0,
            quantity: raw.quantity || 1,
            isVeg: it.isVeg !== false,
            category: it.category,
            notes: raw.notes || "",
            source: isGuestQr ? "QR" : "STAFF",
            roundNumber: roundIdx,
            orderId: ord.id,
            createdAt: ord.created_at,
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
    if (terminalMode !== "DINE_IN" || !selectedTable) return null;
    return tableSessionMap.get(selectedTable) || null;
  }, [tableSessionMap, terminalMode, selectedTable]);

  // Quick Table Status Filter
  const filteredTables = useMemo(() => {
    return locations.filter((loc) => {
      const s = tableSessionMap.get(loc.name);
      if (tableFilter === "ACTIVE") return s && s.status === "COOKING";
      if (tableFilter === "BILLED") return s && s.status === "BILLED";
      if (tableFilter === "VACANT") return !s || s.status === "VACANT";
      return true;
    });
  }, [locations, tableSessionMap, tableFilter]);

  /* ─── 4. Active Takeaways ─────────────────────────────────────────── */
  const activeTakeaways = useMemo(() => {
    return activeOrders.filter((o) => {
      const t = (o.table_no || "").toLowerCase();
      return t.includes("token") || t.includes("takeaway") || t.includes("counter");
    });
  }, [activeOrders]);

  /* ─── 5. Categories & Dish Filters ────────────────────────────────── */
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

  /* ─── 6. Cart Management ──────────────────────────────────────────── */
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
    setIsPaymentDrawerOpen(false);
  };

  /* ─── 7. Financial Calculations ───────────────────────────────────── */
  const allCurrentItems = useMemo(() => {
    if (terminalMode === "DINE_IN") {
      const fired = currentTableSession?.firedRounds || [];
      return [...fired, ...cart];
    }
    return cart;
  }, [terminalMode, currentTableSession, cart]);

  const subtotal = useMemo(() => {
    return allCurrentItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [allCurrentItems]);

  const effectiveDiscount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const taxTotal = (taxableAmount * 5) / 100; // Standard 5% GST
  const grandTotal = Math.round(taxableAmount + taxTotal);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - grandTotal);
  }, [cashTendered, grandTotal]);

  /* ─── 8. Actions: Send to Kitchen (KOT) ────────────────────────────── */
  const handleSendToKitchen = async () => {
    if (cart.length === 0) {
      showToast("No new dishes in cart to send to kitchen.");
      return;
    }

    const targetDestination = terminalMode === "DINE_IN" ? selectedTable : currentTakeawayToken;
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

      const isDineIn = terminalMode === "DINE_IN";
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

      showToast(`Kitchen Chit sent for ${targetDestination} (Round ${kotRoundNum})`);

      setPrintChit({
        type: "KOT",
        mode: terminalMode,
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
      showToast("Failed to dispatch KOT: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 9. Actions: Void Fired Dish ─────────────────────────────────── */
  const handleVoidFiredDish = async (dishName: string, itemPrice: number, orderId: string) => {
    const confirmVoid = window.confirm(`Cancel 1x "${dishName}" from Table ${selectedTable}?`);
    if (!confirmVoid) return;

    setIsSubmitting(true);
    try {
      const targetOrder = currentTableSession?.orders.find((o) => o.id === orderId);
      if (!targetOrder || !Array.isArray(targetOrder.items_json)) return;

      const updatedItems = [...targetOrder.items_json];
      const idx = updatedItems.findIndex(
        (raw: any) => (raw.item?.name || raw.name) === dishName
      );

      if (idx !== -1) {
        const itemObj = updatedItems[idx];
        if (itemObj.quantity > 1) {
          itemObj.quantity -= 1;
        } else {
          updatedItems.splice(idx, 1);
        }

        const newTotal = Math.max(0, Number(targetOrder.total || 0) - itemPrice);

        if (updatedItems.length === 0) {
          await supabase.from("orders").delete().eq("id", targetOrder.id);
        } else {
          await supabase
            .from("orders")
            .update({
              items_json: updatedItems,
              total: newTotal,
              note: `[KOT Void: ${dishName}]`,
            })
            .eq("id", targetOrder.id);
        }

        setPrintChit({
          type: "VOID",
          mode: "DINE_IN",
          tableOrToken: selectedTable,
          items: [{ name: dishName, quantity: 1 }],
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          reason: "Customer cancellation",
        });

        showToast(`Cancelled 1x ${dishName} on Table ${selectedTable}`);
        if (restaurantId) fetchActiveOrders(restaurantId);

        setTimeout(() => {
          window.print();
        }, 100);
      }
    } catch (err: any) {
      showToast("Failed to void item: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 10. Actions: Move Table ─────────────────────────────────────── */
  const handleTransferTable = async (targetTable: string) => {
    if (!currentTableSession || currentTableSession.orders.length === 0) {
      setSelectedTable(targetTable);
      setShowMovePicker(false);
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

      showToast(`Transferred ${selectedTable} to ${targetTable}`);
      setSelectedTable(targetTable);
      setShowMovePicker(false);
      if (restaurantId) fetchActiveOrders(restaurantId);
    } catch (err: any) {
      showToast("Transfer failed: " + (err.message || "Failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 11. Actions: Merge Tables (Party of 8+) ─────────────────────── */
  const handleMergeTable = async (targetTable: string) => {
    if (!currentTableSession || currentTableSession.orders.length === 0) {
      showToast("No active check to merge.");
      return;
    }

    const confirmMerge = window.confirm(`Merge ${selectedTable} into ${targetTable}? All orders will combine.`);
    if (!confirmMerge) return;

    setIsSubmitting(true);
    try {
      const orderIds = currentTableSession.orders.map((o) => o.id);
      const { error } = await supabase
        .from("orders")
        .update({ table_no: targetTable, note: `[Merged ${selectedTable} into ${targetTable}]` })
        .in("id", orderIds);

      if (error) throw error;

      showToast(`Merged ${selectedTable} into ${targetTable}`);
      setSelectedTable(targetTable);
      setShowMergePicker(false);
      if (restaurantId) fetchActiveOrders(restaurantId);
    } catch (err: any) {
      showToast("Merge failed: " + (err.message || "Failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 12. Actions: Print Bill with Dynamic Tabletop UPI QR ─────────── */
  const handlePrintGuestBill = async () => {
    if (allCurrentItems.length === 0) {
      showToast("No items on table to generate bill.");
      return;
    }

    const targetDestination = terminalMode === "DINE_IN" ? selectedTable : currentTakeawayToken;

    if (currentTableSession && currentTableSession.orders.length > 0) {
      const orderIds = currentTableSession.orders.map((o) => o.id);
      await supabase
        .from("orders")
        .update({ note: `[POS Bill Printed ${new Date().toLocaleTimeString()}]` })
        .in("id", orderIds);
    }

    setPrintChit({
      type: "BILL",
      mode: terminalMode,
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

    showToast(`Bill Printed for ${targetDestination} (UPI QR included)`);
    if (restaurantId) fetchActiveOrders(restaurantId);

    setTimeout(() => {
      window.print();
    }, 100);
  };

  /* ─── 13. Actions: 1-Click Fast Settlement ────────────────────────── */
  const handleQuickSettle = async (method: PaymentMethod) => {
    if (allCurrentItems.length === 0) {
      showToast("Cannot settle empty check.");
      return;
    }

    const targetDestination = terminalMode === "DINE_IN" ? selectedTable : currentTakeawayToken;
    setIsSubmitting(true);

    try {
      if (terminalMode === "DINE_IN" && currentTableSession && currentTableSession.orders.length > 0) {
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

        // Also commit any unsaved staff cart items directly as settled
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
          customer_name: customerName.trim() || targetDestination,
          customer_phone: customerPhone.trim() || null,
          items_json: itemsPayload,
          note: `[POS Settled: ${method}]`,
        });
      }

      showToast(`Settled ₹${grandTotal} via ${method}`);

      setPrintChit({
        type: "BILL",
        mode: terminalMode,
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
      setIsPaymentDrawerOpen(false);

      if (terminalMode === "TAKEAWAY") {
        setTakeawayCounter((prev) => prev + 1);
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

  // UPI QR String for thermal print
  const upiIntentUrl = useMemo(() => {
    const vpa = upiId || "merchant@upi";
    const name = encodeURIComponent(restaurantName);
    return `upi://pay?pa=${vpa}&pn=${name}&am=${grandTotal}&cu=INR`;
  }, [upiId, restaurantName, grandTotal]);

  const activeTablesCount = Array.from(tableSessionMap.values()).filter((s) => s.status === "COOKING").length;
  const billedTablesCount = Array.from(tableSessionMap.values()).filter((s) => s.status === "BILLED").length;
  const vacantTablesCount = Array.from(tableSessionMap.values()).filter((s) => s.status === "VACANT").length;

  return (
    <div className="flex h-screen flex-col bg-[#F9FAFB] font-sans text-zinc-900 select-none overflow-hidden antialiased">
      
      {/* ── Refined Toast ── */}
      {toastMessage && (
        <div className="fixed top-3 right-4 z-[300] bg-zinc-900 text-white px-3.5 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TOP BAR: Minimal, Crisp Header (Lucid POS aesthetic)
         ═════════════════════════════════════════════════════════════════════ */}
      <header className="shrink-0 h-13 bg-white border-b border-zinc-200/80 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            {restaurantName}
          </span>

          {/* Minimal Mode Switcher */}
          <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
            <button
              onClick={() => {
                setTerminalMode("DINE_IN");
                if (!selectedTable && locations.length > 0) setSelectedTable(locations[0].name);
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                terminalMode === "DINE_IN"
                  ? "bg-white text-zinc-900 shadow-2xs border border-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <UtensilsCrossed size={13} className={terminalMode === "DINE_IN" ? "text-[#E46254]" : "text-zinc-400"} />
              <span>Dine-In</span>
            </button>

            <button
              onClick={() => setTerminalMode("TAKEAWAY")}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                terminalMode === "TAKEAWAY"
                  ? "bg-white text-zinc-900 shadow-2xs border border-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <ShoppingBag size={13} className={terminalMode === "TAKEAWAY" ? "text-[#E46254]" : "text-zinc-400"} />
              <span>Takeaway</span>
              {activeTakeaways.length > 0 && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1 rounded">
                  {activeTakeaways.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Keyboard Quick Hints */}
        <div className="hidden md:flex items-center gap-2 text-[11px] font-medium text-zinc-400">
          <span className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200/80 rounded font-mono text-[10px] text-zinc-500">/ Search</span>
          <span className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200/80 rounded font-mono text-[10px] text-zinc-500">F4 Send</span>
          <span className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200/80 rounded font-mono text-[10px] text-zinc-500">F8 Settle</span>
          <span className="px-1.5 py-0.5 bg-zinc-50 border border-zinc-200/80 rounded font-mono text-[10px] text-zinc-500">F9 Bill</span>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════════════
          SUB-BAR: Live Table Floor Matrix / Filter Bar
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 bg-white border-b border-zinc-200/70 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
        {terminalMode === "DINE_IN" ? (
          locations.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-zinc-600 bg-zinc-50 px-3 py-1 rounded-lg border border-zinc-200 w-full">
              <AlertCircle size={14} className="text-zinc-400 shrink-0" />
              <span>No tables configured yet.</span>
              <Link href="/dashboard/locations" className="font-semibold text-zinc-900 underline hover:text-black">
                Add tables in Locations
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              
              {/* Quick Status Segmented Filter */}
              <div className="flex items-center gap-1 shrink-0 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/60">
                <button
                  onClick={() => setTableFilter("ALL")}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    tableFilter === "ALL" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  All ({locations.length})
                </button>
                <button
                  onClick={() => setTableFilter("ACTIVE")}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    tableFilter === "ACTIVE" ? "bg-amber-500 text-white shadow-2xs" : "text-amber-800 hover:bg-amber-50/50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Cooking ({activeTablesCount})</span>
                </button>
                <button
                  onClick={() => setTableFilter("BILLED")}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    tableFilter === "BILLED" ? "bg-indigo-600 text-white shadow-2xs" : "text-indigo-800 hover:bg-indigo-50/50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>Billed ({billedTablesCount})</span>
                </button>
                <button
                  onClick={() => setTableFilter("VACANT")}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    tableFilter === "VACANT" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-800 hover:bg-emerald-50/50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Vacant ({vacantTablesCount})</span>
                </button>
              </div>

              {/* Table Badges Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1">
                {filteredTables.map((loc) => {
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
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                        isSelected
                          ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                          : isVacant
                          ? "bg-white text-zinc-700 border-zinc-200/80 hover:border-zinc-300"
                          : isCooking
                          ? "bg-amber-50/80 text-amber-900 border-amber-300/80"
                          : "bg-indigo-50/80 text-indigo-900 border-indigo-300/80"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isSelected
                            ? "bg-white"
                            : isVacant
                            ? "bg-emerald-500"
                            : isCooking
                            ? "bg-amber-500 animate-pulse"
                            : "bg-indigo-500"
                        }`}
                      />
                      <span className="font-semibold">{loc.name}</span>
                      {!isVacant && session?.runningTotal ? (
                        <span className={`text-[10px] tabular-nums font-mono ${isSelected ? "text-white/90" : "text-zinc-500"}`}>
                          ₹{session.runningTotal}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-900">
                {currentTakeawayToken}
              </span>
              <button
                onClick={() => {
                  setTakeawayCounter((prev) => prev + 1);
                  clearCurrentCart();
                  showToast(`Switched to Token #${(takeawayCounter + 1).toString().padStart(2, "0")}`);
                }}
                className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded text-xs font-medium text-zinc-700 cursor-pointer"
              >
                + Next Token
              </button>
            </div>

            {/* Waiting Takeaways */}
            {activeTakeaways.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-medium text-zinc-400">Waiting:</span>
                {activeTakeaways.map((ord) => (
                  <span
                    key={ord.id}
                    className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px] font-medium tabular-nums"
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
          MAIN WORKSPACE: Split Layout (Left: Menu 65% | Right: Live Check 35%)
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ── LEFT: High-Density Clean Menu Catalog ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA] border-r border-zinc-200/80">
          
          {/* Search + Categories Bar */}
          <div className="shrink-0 p-3 bg-white border-b border-zinc-200/80 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search dishes or categories... (Press '/' to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-8 py-1.5 bg-zinc-50 border border-zinc-200/80 hover:border-zinc-300 focus:border-[#E46254] focus:bg-white rounded-lg text-xs font-medium outline-none transition-all"
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
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 border shrink-0 ${
                      isSelected
                        ? "bg-[#E46254] text-white border-[#E46254]"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900"
                    }`}
                  >
                    <span>{cat === "ALL" ? "All Items" : cat}</span>
                    <span className={`text-[10px] tabular-nums ${isSelected ? "text-white/80" : "text-zinc-400"}`}>
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
                <Receipt size={24} className="text-zinc-300 mb-1" />
                <h3 className="text-xs font-semibold text-zinc-700">No dishes in this category</h3>
                <p className="text-[11px] text-zinc-400">Try selecting All Items</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                {filteredItems.map((dish) => {
                  const cartItem = cart.find((c) => c.id === dish.id);
                  const inCartQty = cartItem ? cartItem.quantity : 0;

                  return (
                    <div
                      key={dish.id}
                      onClick={() => addToCart(dish)}
                      className={`bg-white rounded-lg p-2.5 border transition-all cursor-pointer flex flex-col justify-between select-none hover:border-zinc-300 hover:shadow-2xs active:scale-[0.99] ${
                        inCartQty > 0 ? "border-[#E46254] ring-1 ring-[#E46254]/20 bg-[#E46254]/2" : "border-zinc-200/80"
                      }`}
                    >
                      <div>
                        {/* Dot indicator */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`w-2.5 h-2.5 border flex items-center justify-center shrink-0 rounded-2xs ${
                              dish.is_veg ? "border-emerald-600" : "border-rose-600"
                            }`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full ${
                                dish.is_veg ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            />
                          </span>
                          <span className="text-[9px] font-medium text-zinc-400 truncate max-w-[80px]">
                            {dish.category}
                          </span>
                        </div>

                        {/* Dish Name */}
                        <h4 className="text-xs font-semibold text-zinc-800 line-clamp-2 leading-snug min-h-[30px]">
                          {dish.name}
                        </h4>
                      </div>

                      {/* Price & Quantity Controls */}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-zinc-100">
                        <span className="text-xs font-bold text-zinc-900 tabular-nums font-mono">
                          ₹{dish.base_price}
                        </span>

                        {inCartQty > 0 ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 bg-[#E46254] text-white px-1.5 py-0.5 rounded"
                          >
                            <button
                              onClick={() => updateCartQty(dish.id, -1)}
                              className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                            >
                              <Minus size={9} />
                            </button>
                            <span className="text-[11px] font-semibold px-1 tabular-nums">{inCartQty}</span>
                            <button
                              onClick={() => updateCartQty(dish.id, 1)}
                              className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
                            >
                              <Plus size={9} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-medium text-zinc-500 hover:text-zinc-900 px-1.5 py-0.5 bg-zinc-50 rounded border border-zinc-200/80 transition-colors">
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

        {/* ── RIGHT: Direct Table Check (Lucid POS Live Ticket) ── */}
        <div className="w-[360px] xl:w-[390px] bg-white flex flex-col justify-between shrink-0 shadow-xs border-l border-zinc-200/80 z-20">
          
          {/* Header of Active Table Ticket */}
          <div className="shrink-0 p-3 border-b border-zinc-200/80 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-900 tracking-tight">
                  {terminalMode === "DINE_IN" ? selectedTable || "No Table" : currentTakeawayToken}
                </span>

                {/* Move Table */}
                {terminalMode === "DINE_IN" && locations.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowMovePicker((v) => !v);
                        setShowMergePicker(false);
                      }}
                      className="px-2 py-0.5 text-[10px] font-medium text-zinc-600 bg-white border border-zinc-200 rounded hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRightLeft size={9} />
                      <span>Move</span>
                    </button>

                    {showMovePicker && (
                      <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-zinc-200 rounded-lg shadow-lg p-1 z-50 space-y-0.5">
                        <p className="text-[10px] font-semibold text-zinc-400 px-2 py-1">Transfer to:</p>
                        {locations
                          .filter((l) => l.name !== selectedTable)
                          .map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleTransferTable(loc.name)}
                              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-zinc-100 cursor-pointer"
                            >
                              {loc.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Merge Table */}
                {terminalMode === "DINE_IN" && locations.length > 1 && currentTableSession && currentTableSession.orders.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowMergePicker((v) => !v);
                        setShowMovePicker(false);
                      }}
                      className="px-2 py-0.5 text-[10px] font-medium text-zinc-600 bg-white border border-zinc-200 rounded hover:bg-zinc-50 flex items-center gap-1 cursor-pointer"
                    >
                      <Merge size={9} />
                      <span>Merge</span>
                    </button>

                    {showMergePicker && (
                      <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-zinc-200 rounded-lg shadow-lg p-1 z-50 space-y-0.5">
                        <p className="text-[10px] font-semibold text-zinc-400 px-2 py-1">Merge into Table:</p>
                        {locations
                          .filter((l) => l.name !== selectedTable)
                          .map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleMergeTable(loc.name)}
                              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-zinc-100 cursor-pointer"
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
                  className="text-xs text-zinc-400 hover:text-rose-600 font-medium cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Guest Notes / Info */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input
                type="text"
                placeholder="Guest Name (Optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-zinc-200/80 rounded text-xs outline-none focus:border-zinc-400"
              />
              <input
                type="tel"
                placeholder="Phone (Optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-zinc-200/80 rounded text-xs outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Ticket Items Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            
            {/* IN KITCHEN (Fired via QR or previous staff rounds) */}
            {terminalMode === "DINE_IN" && currentTableSession?.firedRounds && currentTableSession.firedRounds.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 bg-zinc-100/70 px-2.5 py-1 rounded border border-zinc-200/60">
                  <span>In Kitchen (Fired)</span>
                  <span className="text-[10px] text-zinc-400">Tap ✕ to Void</span>
                </div>

                <div className="divide-y divide-zinc-100 bg-white rounded-lg p-2 border border-zinc-200/70">
                  {currentTableSession.firedRounds.map((fi, idx) => (
                    <div key={`${fi.id}-${idx}`} className="py-1.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 flex-1 pr-2">
                        <span className="text-[11px] font-mono text-zinc-500">{fi.quantity}×</span>
                        <div>
                          <p className="font-medium text-zinc-800">{fi.name}</p>
                          <span className="text-[9px] font-mono text-zinc-400 uppercase">
                            {fi.source === "QR" ? "Guest QR" : `Round ${fi.roundNumber}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 font-mono tabular-nums">
                          ₹{fi.price * fi.quantity}
                        </span>
                        <button
                          onClick={() => handleVoidFiredDish(fi.name, fi.price, fi.orderId)}
                          className="text-zinc-300 hover:text-rose-600 p-0.5 cursor-pointer transition-colors"
                          title="Void Item"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NEW ADDITIONS (Staff cart pending to be sent to kitchen) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700 px-1">
                <span>{terminalMode === "DINE_IN" ? "New Additions (Pending KOT)" : "Order Items"}</span>
                <span className="text-zinc-400 font-mono">{cart.length} items</span>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-zinc-200/80 rounded-lg">
                  <p className="text-xs text-zinc-400">No new items in queue</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Tap menu dishes on the left to add</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-zinc-200/80 rounded-lg p-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 pr-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.isVeg ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        <span className="text-xs font-medium text-zinc-800 truncate">{item.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-zinc-100 rounded p-0.5">
                          <button
                            onClick={() => updateCartQty(item.id, -1)}
                            className="p-0.5 text-zinc-600 hover:text-black cursor-pointer"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="text-xs font-semibold px-1.5 font-mono tabular-nums">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(item.id, 1)}
                            className="p-0.5 text-zinc-600 hover:text-black cursor-pointer"
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-zinc-900 w-12 text-right font-mono tabular-nums">
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
              CLEAN FINANCIAL DOCK: Settle / Send Actions (Zero Gimmicks)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="shrink-0 p-3 bg-zinc-50 border-t border-zinc-200/80 space-y-2.5">
            
            {/* Calculation Lines */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span className="font-semibold text-zinc-800 font-mono tabular-nums">₹{subtotal}</span>
              </div>

              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount ({discountPercent}%)</span>
                  <span className="font-mono tabular-nums">-₹{effectiveDiscount.toFixed(1)}</span>
                </div>
              )}

              <div className="flex justify-between text-zinc-500">
                <span className="flex items-center gap-1">
                  <span>Taxes (5% GST)</span>
                  <button
                    onClick={() => setShowDiscountSelector((v) => !v)}
                    className="text-[10px] text-zinc-500 underline cursor-pointer hover:text-zinc-900"
                  >
                    {discountPercent > 0 ? "Edit Disc" : "+ Disc"}
                  </button>
                </span>
                <span className="font-semibold text-zinc-800 font-mono tabular-nums">₹{taxTotal.toFixed(1)}</span>
              </div>

              {/* Discount Selector Strip */}
              {showDiscountSelector && (
                <div className="flex items-center gap-1 pt-1">
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        setDiscountPercent(pct);
                        setShowDiscountSelector(false);
                      }}
                      className={`flex-1 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${
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
                <span className="text-xs font-semibold text-zinc-600">Total Due:</span>
                <span className="text-base font-bold text-zinc-900 font-mono tabular-nums">₹{grandTotal}</span>
              </div>
            </div>

            {/* ACTION ROW 1: SEND TO KITCHEN & PRINT GUEST BILL */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleSendToKitchen}
                className="py-2 px-2 rounded-lg bg-zinc-900 hover:bg-black disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              >
                <Send size={13} />
                <span>Send to Kitchen (F4)</span>
              </button>

              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={handlePrintGuestBill}
                className="py-2 px-2 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-zinc-800 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Printer size={13} />
                <span>Print Bill (F9)</span>
              </button>
            </div>

            {/* ACTION ROW 2: SINGLE CLEAN SETTLE BUTTON OR QUICK DRAWER */}
            {!isPaymentDrawerOpen ? (
              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={() => setIsPaymentDrawerOpen(true)}
                className="w-full py-2.5 px-3 rounded-lg bg-[#E46254] hover:bg-[#D55345] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-all"
              >
                <CreditCard size={14} />
                <span>Settle Table (₹{grandTotal}) · F8</span>
              </button>
            ) : (
              <div className="bg-white border border-zinc-300 rounded-lg p-2.5 shadow-md space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-900">
                    Settle ₹{grandTotal} · Select Payment:
                  </span>
                  <button
                    onClick={() => setIsPaymentDrawerOpen(false)}
                    className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleQuickSettle("CASH")}
                    className="py-2 px-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 rounded font-medium text-xs flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <Banknote size={15} className="text-zinc-700" />
                    <span>Cash</span>
                  </button>

                  <button
                    disabled={isSubmitting}
                    onClick={() => handleQuickSettle("UPI")}
                    className="py-2 px-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 rounded font-medium text-xs flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <QrCode size={15} className="text-zinc-700" />
                    <span>UPI Received</span>
                  </button>

                  <button
                    disabled={isSubmitting}
                    onClick={() => handleQuickSettle("CARD")}
                    className="py-2 px-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 rounded font-medium text-xs flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <CreditCard size={15} className="text-zinc-700" />
                    <span>Card / EDC</span>
                  </button>
                </div>

                {/* Cash Tendered Input for return change calculation */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-100 text-xs">
                  <input
                    type="number"
                    placeholder="Cash given..."
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-24 px-2 py-0.5 bg-zinc-50 border border-zinc-300 rounded text-xs font-mono outline-none"
                  />
                  {parseFloat(cashTendered) > grandTotal && (
                    <span className="text-[11px] font-semibold text-emerald-600 ml-auto font-mono">
                      Change: ₹{changeDue}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          THERMAL RECEIPT (80mm / 58mm Standard ESC/POS)
          Includes Tabletop Dynamic UPI QR on Guest Bill
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
                
                {/* Dynamic UPI QR on Printed Bill */}
                {upiId && (
                  <div className="text-center pt-2 pb-1 border-t my-1">
                    <div className="flex justify-center py-1">
                      <QRCode value={upiIntentUrl} size={100} />
                    </div>
                    <div className="text-[10px] font-bold">SCAN TO PAY VIA UPI</div>
                    <div className="text-[9px] text-zinc-600">{upiId}</div>
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
