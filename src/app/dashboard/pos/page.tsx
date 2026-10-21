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
  ArrowRightLeft,
  Clock,
  User,
  Phone,
  RotateCcw,
  AlertCircle,
  Percent,
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

export default function PosPage() {
  const supabase = createClient();

  // Core Data
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [upiId, setUpiId] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Terminal Navigation
  const [terminalMode, setTerminalMode] = useState<TerminalMode>("DINE_IN");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableFilter, setTableFilter] = useState<"ALL" | "ACTIVE" | "VACANT">("ALL");
  const [showMovePicker, setShowMovePicker] = useState<boolean>(false);

  // Takeaway Tokens
  const [takeawayCounter, setTakeawayCounter] = useState<number>(1);
  const currentTakeawayToken = `Token #${takeawayCounter.toString().padStart(2, "0")}`;

  // Guest Details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Cart (New order to fire to kitchen)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Search & Categories
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Settlement & Discounts
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [showDiscountSelector, setShowDiscountSelector] = useState(false);
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

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ─── 1. Load Data ──────────────────────────────────────────────── */
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const restId = user?.user_metadata?.restaurant_id;
      if (!restId) {
        setLoading(false);
        return;
      }
      setRestaurantId(restId);

      // Restaurant Info
      const { data: rest } = await supabase
        .from("restaurants")
        .select("id, name, upi_id")
        .eq("id", restId)
        .maybeSingle();

      if (rest) {
        if (rest.name) setRestaurantName(rest.name);
        if (rest.upi_id) setUpiId(rest.upi_id);
      }

      // Tables from Locations
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
      setLoading(false);
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setShowMovePicker(false);
        setIsPaymentDrawerOpen(false);
        setShowDiscountSelector(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Supabase Realtime Sync
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel("pos_realtime_orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchActiveOrders(restaurantId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  /* ─── 2. Active Session Computation ─────────────────────────────── */
  const tableSessionMap = useMemo(() => {
    const map = new Map<
      string,
      {
        status: "COOKING" | "BILLED" | "VACANT";
        orders: OrderRecord[];
        firedRounds: FiredRoundItem[];
        runningTotal: number;
        customerName?: string;
        customerPhone?: string;
      }
    >();

    locations.forEach((loc) => {
      map.set(loc.name, {
        status: "VACANT",
        orders: [],
        firedRounds: [],
        runningTotal: 0,
      });
    });

    activeOrders.forEach((order) => {
      const isTakeaway =
        order.table_no.toLowerCase().includes("takeaway") ||
        order.table_no.toLowerCase().includes("token");

      if (isTakeaway) return;

      const existing = map.get(order.table_no) || {
        status: "VACANT",
        orders: [],
        firedRounds: [],
        runningTotal: 0,
      };

      existing.orders.push(order);
      existing.runningTotal += Number(order.total || 0);

      if (order.customer_name && !existing.customerName) {
        existing.customerName = order.customer_name;
      }
      if (order.customer_phone && !existing.customerPhone) {
        existing.customerPhone = order.customer_phone;
      }

      // Order Origin Attribution
      let orderSource: "QR" | "STAFF" | "CAPTAIN" = "QR";
      const noteLower = (order.note || "").toLowerCase();
      const customerLower = (order.customer_name || "").toLowerCase();

      if (noteLower.includes("pos") || noteLower.includes("counter")) {
        orderSource = "STAFF";
      } else if (
        noteLower.includes("captain") ||
        customerLower.includes("captain") ||
        customerLower.includes("waiter")
      ) {
        orderSource = "CAPTAIN";
      }

      const roundIndex = existing.orders.length;

      if (Array.isArray(order.items_json)) {
        order.items_json.forEach((raw: any) => {
          const itemObj = raw.item || raw;
          existing.firedRounds.push({
            id: itemObj.id || Math.random().toString(),
            name: itemObj.name || "Custom Item",
            price: Number(raw.price || itemObj.basePrice || itemObj.base_price || 0),
            quantity: Number(raw.quantity || 1),
            isVeg: itemObj.isVeg ?? itemObj.is_veg ?? true,
            category: itemObj.category,
            notes: raw.notes || raw.specialInstructions || "",
            source: orderSource,
            roundNumber: roundIndex,
            orderId: order.id,
            createdAt: order.created_at,
          });
        });
      }

      if (order.payment_status === "PAID") {
        existing.status = "BILLED";
      } else {
        existing.status = "COOKING";
      }

      map.set(order.table_no, existing);
    });

    return map;
  }, [locations, activeOrders]);

  const currentTableSession = useMemo(() => {
    if (terminalMode === "TAKEAWAY") return null;
    return tableSessionMap.get(selectedTable) || null;
  }, [terminalMode, selectedTable, tableSessionMap]);

  // Autofill Guest Details
  useEffect(() => {
    if (terminalMode === "DINE_IN" && currentTableSession) {
      if (currentTableSession.customerName && !customerName) {
        setCustomerName(currentTableSession.customerName);
      }
      if (currentTableSession.customerPhone && !customerPhone) {
        setCustomerPhone(currentTableSession.customerPhone);
      }
    }
  }, [terminalMode, selectedTable, currentTableSession]);

  const activeTakeaways = useMemo(() => {
    return activeOrders.filter(
      (o) =>
        o.table_no.toLowerCase().includes("takeaway") ||
        o.table_no.toLowerCase().includes("token")
    );
  }, [activeOrders]);

  /* ─── 3. Filtering & Categories ─────────────────────────────────── */
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  /* ─── 4. Cart Operations ────────────────────────────────────────── */
  const addToCart = (dish: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === dish.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          id: dish.id,
          name: dish.name,
          price: dish.base_price,
          quantity: 1,
          isVeg: dish.is_veg,
          category: dish.category,
        },
      ];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCurrentCart = () => {
    setCart([]);
  };

  /* ─── 5. Financials ─────────────────────────────────────────────── */
  const targetDestination =
    terminalMode === "DINE_IN" ? selectedTable : currentTakeawayToken;

  const allCurrentItems = useMemo(() => {
    const list: Array<{ name: string; quantity: number; price: number; isVeg?: boolean }> = [];
    if (terminalMode === "DINE_IN" && currentTableSession?.firedRounds) {
      currentTableSession.firedRounds.forEach((fi) => {
        list.push({
          name: fi.name,
          quantity: fi.quantity,
          price: fi.price,
          isVeg: fi.isVeg,
        });
      });
    }
    cart.forEach((ci) => {
      list.push({
        name: ci.name,
        quantity: ci.quantity,
        price: ci.price,
        isVeg: ci.isVeg,
      });
    });
    return list;
  }, [terminalMode, currentTableSession, cart]);

  const subtotal = useMemo(() => {
    return allCurrentItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
  }, [allCurrentItems]);

  const effectiveDiscount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const taxTotal = useMemo(() => {
    return (subtotal - effectiveDiscount) * 0.05; // 5% GST
  }, [subtotal, effectiveDiscount]);

  const grandTotal = useMemo(() => {
    return Math.round(subtotal - effectiveDiscount + taxTotal);
  }, [subtotal, effectiveDiscount, taxTotal]);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered);
    if (isNaN(tendered) || tendered < grandTotal) return 0;
    return Math.round(tendered - grandTotal);
  }, [cashTendered, grandTotal]);

  /* ─── 6. Thermal Printing & Settlement Actions ──────────────────── */
  const handleSendToKitchen = async () => {
    if (cart.length === 0) return;
    if (terminalMode === "DINE_IN" && !selectedTable) {
      showToast("Please select a table first");
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = cart.map((c) => ({
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

      const roundNum = (currentTableSession?.orders.length || 0) + 1;

      const { error } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId,
          table_no: targetDestination,
          total: cart.reduce((s, it) => s + it.price * it.quantity, 0),
          status: "PREPARING",
          payment_status: "PENDING",
          customer_name: customerName.trim() || (terminalMode === "DINE_IN" ? `Table ${selectedTable}` : targetDestination),
          customer_phone: customerPhone.trim() || null,
          items_json: itemsPayload,
          note: `[POS Fired Round #${roundNum}]`,
        })
        .select()
        .single();

      if (error) throw error;

      // Print KOT
      setPrintChit({
        type: "KOT",
        mode: terminalMode,
        tableOrToken: targetDestination,
        kotNumber: roundNum,
        customerName: customerName.trim(),
        items: cart.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          notes: c.notes,
        })),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      showToast(`KOT Round #${roundNum} sent to kitchen`);
      clearCurrentCart();

      if (restaurantId) fetchActiveOrders(restaurantId);

      setTimeout(() => {
        window.print();
      }, 100);
    } catch (err: any) {
      showToast("Failed to send order: " + (err.message || "Network Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintGuestBill = () => {
    if (allCurrentItems.length === 0) {
      showToast("No active items on this bill");
      return;
    }

    setPrintChit({
      type: "BILL",
      mode: terminalMode,
      tableOrToken: targetDestination,
      customerName: customerName.trim() || (terminalMode === "DINE_IN" ? `Table ${selectedTable}` : targetDestination),
      items: allCurrentItems,
      subtotal,
      discount: effectiveDiscount,
      tax: taxTotal,
      grandTotal,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleReprintKOT = (roundNum: number) => {
    if (!currentTableSession) return;
    const itemsForRound = currentTableSession.firedRounds.filter(
      (r) => r.roundNumber === roundNum
    );
    if (itemsForRound.length === 0) return;

    setPrintChit({
      type: "KOT",
      mode: terminalMode,
      tableOrToken: selectedTable,
      kotNumber: roundNum,
      customerName: currentTableSession.customerName || customerName,
      items: itemsForRound.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        notes: `REPRINT - Round #${roundNum}`,
      })),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleVoidFiredDish = async (dishName: string, dishPrice: number, orderId: string) => {
    const reason = window.prompt(`Enter reason for voiding "${dishName}":`, "Customer changed mind");
    if (reason === null) return;

    try {
      const orderToUpdate = activeOrders.find((o) => o.id === orderId);
      if (!orderToUpdate) return;

      const updatedItems = (orderToUpdate.items_json || []).filter((raw: any) => {
        const itemObj = raw.item || raw;
        return itemObj.name !== dishName;
      });

      const updatedTotal = Math.max(0, (orderToUpdate.total || 0) - dishPrice);

      if (updatedItems.length === 0) {
        await supabase
          .from("orders")
          .update({
            status: "CANCELLED",
            note: `[Voided: ${reason}]`,
          })
          .eq("id", orderId);
      } else {
        await supabase
          .from("orders")
          .update({
            items_json: updatedItems,
            total: updatedTotal,
            note: `${orderToUpdate.note || ""} [Voided ${dishName}: ${reason}]`,
          })
          .eq("id", orderId);
      }

      setPrintChit({
        type: "VOID",
        mode: terminalMode,
        tableOrToken: selectedTable,
        reason,
        items: [{ name: dishName, quantity: 1, price: dishPrice }],
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      showToast(`Voided ${dishName}`);
      if (restaurantId) fetchActiveOrders(restaurantId);

      setTimeout(() => {
        window.print();
      }, 100);
    } catch (err: any) {
      showToast("Failed to void item: " + (err.message || "Error"));
    }
  };

  const handleTransferTable = async (newTable: string) => {
    if (!selectedTable || newTable === selectedTable) return;
    try {
      const currentOrders = currentTableSession?.orders || [];
      const orderIds = currentOrders.map((o) => o.id);

      if (orderIds.length > 0) {
        await supabase
          .from("orders")
          .update({
            table_no: newTable,
            note: `[Transferred from ${selectedTable} to ${newTable}]`,
          })
          .in("id", orderIds);
      }

      showToast(`Transferred ${selectedTable} ➔ ${newTable}`);
      setSelectedTable(newTable);
      setShowMovePicker(false);
      if (restaurantId) fetchActiveOrders(restaurantId);
    } catch (err: any) {
      showToast("Transfer failed: " + (err.message || "Error"));
    }
  };

  const handleQuickSettle = async (method: PaymentMethod) => {
    if (allCurrentItems.length === 0) {
      showToast("No items to settle");
      return;
    }

    setIsSubmitting(true);
    try {
      if (terminalMode === "DINE_IN") {
        const orderIds = (currentTableSession?.orders || []).map((o) => o.id);

        if (orderIds.length > 0) {
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
        }

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
            customer_phone: customerPhone.trim() || null,
            items_json: unsavedPayload,
            note: `[POS Addon Settled: ${method}]`,
          });
        }
      } else {
        // Takeaway Settlement
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
        items: allCurrentItems,
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

  const upiIntentUrl = useMemo(() => {
    const vpa = upiId || "merchant@upi";
    const name = encodeURIComponent(restaurantName || "Restaurant");
    return `upi://pay?pa=${vpa}&pn=${name}&am=${grandTotal}&cu=INR`;
  }, [upiId, restaurantName, grandTotal]);

  const filteredTables = useMemo(() => {
    return locations.filter((loc) => {
      const session = tableSessionMap.get(loc.name);
      const isVacant = !session || session.status === "VACANT";
      if (tableFilter === "ACTIVE") return !isVacant;
      if (tableFilter === "VACANT") return isVacant;
      return true;
    });
  }, [locations, tableSessionMap, tableFilter]);

  const activeTablesCount = Array.from(tableSessionMap.values()).filter(
    (s) => s.status !== "VACANT"
  ).length;

  return (
    <div className="flex h-screen flex-col bg-[#FAFAFA] font-sans text-zinc-900 select-none overflow-hidden">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-6 z-[300] bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 border border-zinc-800 animate-in fade-in slide-in-from-top-2">
          <Check size={14} className="text-[#E46254]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── STICKY TOP BAR: Matches /dashboard/orders & /dashboard/locations ── */}
      <div className="shrink-0 bg-white border-b border-zinc-200/80 px-6 py-3 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-zinc-900 tracking-tight">Point of Sale</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10.5px] font-bold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-200 mx-1" />

          {/* Mode Tabs */}
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/80">
            <button
              onClick={() => {
                setTerminalMode("DINE_IN");
                if (!selectedTable && locations.length > 0) setSelectedTable(locations[0].name);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer ${
                terminalMode === "DINE_IN"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <UtensilsCrossed size={13} className={terminalMode === "DINE_IN" ? "text-[#E46254]" : "text-zinc-400"} />
              <span>Dine-In</span>
            </button>

            <button
              onClick={() => setTerminalMode("TAKEAWAY")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer ${
                terminalMode === "TAKEAWAY"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <ShoppingBag size={13} className={terminalMode === "TAKEAWAY" ? "text-[#E46254]" : "text-zinc-400"} />
              <span>Takeaway</span>
              {activeTakeaways.length > 0 && (
                <span className="text-[9.5px] font-bold bg-[#E46254]/10 text-[#E46254] px-1.5 py-0.2 rounded-full">
                  {activeTakeaways.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Input matching Dashboard */}
        <div className="flex items-center gap-2">
          <div className="relative w-64 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search dishes or categories... (Press '/')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-8 py-1.5 text-[12.5px] placeholder:text-zinc-400 outline-none focus:border-zinc-400 focus:bg-white transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              if (restaurantId) fetchActiveOrders(restaurantId);
              showToast("Synced with cloud");
            }}
            className="p-2 border border-zinc-200 bg-white rounded-xl text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors"
            title="Refresh"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* ── TABLE MATRIX STRIP ── */}
      <div className="shrink-0 bg-white border-b border-zinc-200/80 px-6 py-2 flex items-center justify-between gap-4 overflow-x-auto slim-scrollbar">
        {terminalMode === "DINE_IN" ? (
          locations.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-0.5">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <span>No tables configured.</span>
              <Link href="/dashboard/locations" className="font-semibold text-zinc-900 underline">
                Add tables in Locations
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              {/* Filter Pills */}
              <div className="flex items-center gap-1 shrink-0 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/80">
                <button
                  onClick={() => setTableFilter("ALL")}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                    tableFilter === "ALL" ? "bg-white text-zinc-900 shadow-2xs font-semibold" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  All ({locations.length})
                </button>
                <button
                  onClick={() => setTableFilter("ACTIVE")}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    tableFilter === "ACTIVE" ? "bg-[#E46254] text-white font-semibold" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tableFilter === "ACTIVE" ? "bg-white" : "bg-[#E46254]"}`} />
                  <span>Active ({activeTablesCount})</span>
                </button>
                <button
                  onClick={() => setTableFilter("VACANT")}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    tableFilter === "VACANT" ? "bg-white text-zinc-900 shadow-2xs font-semibold" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Vacant</span>
                </button>
              </div>

              {/* Table Pills */}
              <div className="flex items-center gap-2 overflow-x-auto slim-scrollbar py-0.5 flex-1">
                {filteredTables.map((loc) => {
                  const session = tableSessionMap.get(loc.name);
                  const isSelected = selectedTable === loc.name;
                  const isVacant = !session || session.status === "VACANT";

                  return (
                    <button
                      key={loc.id}
                      onClick={() => {
                        setSelectedTable(loc.name);
                        clearCurrentCart();
                      }}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                        isSelected
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                          : isVacant
                          ? "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                          : "bg-[#E46254]/8 text-[#C2410C] border-[#E46254]/30 hover:border-[#E46254]/50"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isSelected
                            ? "bg-white"
                            : isVacant
                            ? "bg-emerald-500"
                            : "bg-[#E46254] animate-pulse"
                        }`}
                      />
                      <span>{loc.name}</span>
                      {!isVacant && session?.runningTotal ? (
                        <span className={`text-[10.5px] tabular-nums font-mono font-bold ${isSelected ? "text-white/90" : "text-[#C2410C]"}`}>
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
              <span className="text-xs font-bold text-zinc-900">
                {currentTakeawayToken}
              </span>
              <button
                onClick={() => {
                  setTakeawayCounter((prev) => prev + 1);
                  clearCurrentCart();
                  showToast(`Switched to Token #${(takeawayCounter + 1).toString().padStart(2, "0")}`);
                }}
                className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-md text-xs font-semibold text-zinc-700 cursor-pointer"
              >
                + Next Parcel
              </button>
            </div>

            {activeTakeaways.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto slim-scrollbar">
                <span className="text-xs font-medium text-zinc-400">Waiting:</span>
                {activeTakeaways.map((ord) => (
                  <span
                    key={ord.id}
                    className="px-2.5 py-0.5 bg-[#E46254]/10 border border-[#E46254]/20 text-[#C2410C] rounded-md text-xs font-semibold tabular-nums"
                  >
                    {ord.table_no} (₹{ord.total})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MAIN WORKSPACE: Split Screen ── */}
      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        
        {/* LEFT COLUMN: Dish Catalog */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white rounded-2xl border border-zinc-200/80 shadow-2xs">
          
          {/* Category Strip */}
          <div className="shrink-0 p-3.5 border-b border-zinc-100 flex items-center gap-1.5 overflow-x-auto slim-scrollbar bg-white">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                    isSelected
                      ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                      : "bg-white text-zinc-600 border-zinc-200/80 hover:border-zinc-300 hover:text-zinc-900"
                  }`}
                >
                  <span>{cat === "ALL" ? "All Items" : cat}</span>
                  <span className={`text-[10px] tabular-nums font-mono px-1 rounded ${
                    isSelected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dishes Grid */}
          <div className="flex-1 overflow-y-auto p-4 slim-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Receipt size={26} className="text-zinc-300 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-700">No dishes found</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Try clearing your search or pick another category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {filteredItems.map((dish) => {
                  const cartItem = cart.find((c) => c.id === dish.id);
                  const inCartQty = cartItem ? cartItem.quantity : 0;

                  return (
                    <div
                      key={dish.id}
                      onClick={() => addToCart(dish)}
                      className={`h-[110px] bg-white rounded-xl p-3 border transition-all cursor-pointer flex flex-col justify-between select-none shadow-2xs hover:shadow-xs hover:border-zinc-300 active:scale-[0.98] ${
                        inCartQty > 0
                          ? "border-[#E46254] ring-1 ring-[#E46254]/30 bg-[#E46254]/[0.02]"
                          : "border-zinc-200/80"
                      }`}
                    >
                      {/* Veg indicator & Category */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {dish.is_veg ? (
                            <span className="w-3 h-3 border border-emerald-600 flex items-center justify-center p-0.5 rounded-xs shrink-0">
                              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                            </span>
                          ) : (
                            <span className="w-3 h-3 border border-[#E46254] flex items-center justify-center p-0.5 rounded-xs shrink-0">
                              <span className="w-1.5 h-1.5 bg-[#E46254] rounded-full" />
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-zinc-400 truncate max-w-[80px]">
                            {dish.category}
                          </span>
                        </div>

                        {inCartQty > 0 && (
                          <span className="text-[10px] font-bold bg-[#E46254] text-white px-1.5 py-0.2 rounded-md font-mono">
                            {inCartQty}
                          </span>
                        )}
                      </div>

                      {/* Dish Name */}
                      <p className="text-xs font-semibold text-zinc-900 leading-snug line-clamp-2">
                        {dish.name}
                      </p>

                      {/* Price & Stepper */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-zinc-900 font-mono tabular-nums">
                          ₹{dish.base_price}
                        </span>

                        {inCartQty > 0 ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center bg-zinc-100 rounded-md border border-zinc-200"
                          >
                            <button
                              onClick={() => updateCartQuantity(dish.id, -1)}
                              className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-black cursor-pointer"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="w-4 text-center text-[10px] font-bold font-mono">
                              {inCartQty}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(dish.id, 1)}
                              className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-black cursor-pointer"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10.5px] font-semibold text-[#E46254] bg-[#E46254]/8 hover:bg-[#E46254] hover:text-white px-2 py-0.5 rounded-md transition-colors">
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

        {/* RIGHT COLUMN: Active Bill Ticket */}
        <div className="w-[370px] xl:w-[400px] bg-white rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between shrink-0 overflow-hidden">
          
          {/* Ticket Header */}
          <div className="shrink-0 p-4 border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                  {terminalMode === "DINE_IN" ? selectedTable || "Select Table" : currentTakeawayToken}
                </h3>

                {terminalMode === "DINE_IN" && locations.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMovePicker((v) => !v)}
                      className="px-2 py-0.5 text-[10.5px] font-medium text-zinc-600 bg-white border border-zinc-200 rounded-md hover:bg-zinc-100 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRightLeft size={9} />
                      <span>Shift</span>
                    </button>

                    {showMovePicker && (
                      <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-zinc-200 rounded-xl shadow-lg p-1 z-50 space-y-0.5">
                        <p className="text-[10px] font-semibold text-zinc-400 px-2 py-1">Transfer table to:</p>
                        {locations
                          .filter((l) => l.name !== selectedTable)
                          .map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleTransferTable(loc.name)}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-100 cursor-pointer"
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

            {/* Guest Details */}
            <div className="mt-2 flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-zinc-200/80 text-xs">
              <div className="flex items-center gap-2 truncate">
                <User size={12} className="text-zinc-400 shrink-0" />
                <span className="font-semibold text-zinc-800 truncate">
                  {currentTableSession?.customerName || customerName || "Dine-in Guest"}
                </span>
                {currentTableSession?.customerPhone && (
                  <span className="text-zinc-400 font-mono text-[10.5px]">
                    · {currentTableSession.customerPhone}
                  </span>
                )}
              </div>

              {terminalMode === "TAKEAWAY" && (
                <input
                  type="tel"
                  placeholder="Guest phone..."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-28 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-xs font-mono outline-none"
                />
              )}
            </div>
          </div>

          {/* Ticket Items Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 slim-scrollbar">
            
            {/* Items already sent to kitchen */}
            {terminalMode === "DINE_IN" && currentTableSession?.firedRounds && currentTableSession.firedRounds.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-600 bg-zinc-100/70 px-3 py-1.5 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-zinc-500" />
                    <span>Kitchen Orders ({currentTableSession.firedRounds.length})</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Tap ✕ to Void</span>
                </div>

                <div className="divide-y divide-zinc-100 bg-white rounded-xl p-2 border border-zinc-200/80">
                  {currentTableSession.firedRounds.map((fi, idx) => (
                    <div key={`${fi.id}-${idx}`} className="py-2 px-1 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 flex-1 pr-2">
                        <span className="text-xs font-bold font-mono text-zinc-400 w-5">{fi.quantity}×</span>
                        <div>
                          <p className="font-semibold text-zinc-900 leading-snug">{fi.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              fi.source === "QR"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : fi.source === "CAPTAIN"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                            }`}>
                              {fi.source === "QR" ? "Online QR" : fi.source === "CAPTAIN" ? "Captain" : "POS Counter"}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400">
                              R#{fi.roundNumber}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-bold text-zinc-900 font-mono tabular-nums">
                          ₹{fi.price * fi.quantity}
                        </span>

                        <button
                          onClick={() => handleReprintKOT(fi.roundNumber)}
                          className="text-zinc-400 hover:text-zinc-800 p-1 cursor-pointer transition-colors"
                          title="Reprint KOT"
                        >
                          <Printer size={13} />
                        </button>

                        <button
                          onClick={() => handleVoidFiredDish(fi.name, fi.price, fi.orderId)}
                          className="text-zinc-300 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                          title="Void Item"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unfired Cart Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 px-1">
                <span>New Items {cart.length > 0 ? `(${cart.length})` : ""}</span>
                {cart.length > 0 && (
                  <span className="text-[10px] text-[#E46254] font-medium">Ready to fire</span>
                )}
              </div>

              {cart.length === 0 ? (
                allCurrentItems.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 text-xs">
                    Tap dishes to add to this check
                  </div>
                ) : null
              ) : (
                <div className="divide-y divide-zinc-100 bg-white rounded-xl p-2 border border-zinc-200/80">
                  {cart.map((item) => (
                    <div key={item.id} className="py-2 px-1 flex items-center justify-between text-xs">
                      <div className="flex-1 pr-2 truncate">
                        <p className="font-semibold text-zinc-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">₹{item.price} each</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-zinc-100 rounded-md border border-zinc-200">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="p-1 text-zinc-600 hover:text-black cursor-pointer"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="w-4 text-center font-mono font-bold text-xs">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="p-1 text-zinc-600 hover:text-black cursor-pointer"
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-zinc-900 w-12 text-right font-mono tabular-nums">
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
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Financial Dock */}
          <div className="shrink-0 p-4 bg-zinc-50 border-t border-zinc-200/80 space-y-3">
            
            {/* Calculation Lines */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span className="font-semibold text-zinc-800 font-mono tabular-nums">₹{subtotal}</span>
              </div>

              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount ({discountPercent}%)</span>
                  <span className="font-mono tabular-nums">-₹{effectiveDiscount.toFixed(1)}</span>
                </div>
              )}

              <div className="flex justify-between text-zinc-500">
                <span className="flex items-center gap-1">
                  <span>Taxes (5% GST)</span>
                  <button
                    onClick={() => setShowDiscountSelector((v) => !v)}
                    className="text-[10px] text-zinc-500 underline cursor-pointer hover:text-zinc-900 ml-1"
                  >
                    {discountPercent > 0 ? "Edit Disc" : "+ Disc"}
                  </button>
                </span>
                <span className="font-semibold text-zinc-800 font-mono tabular-nums">₹{taxTotal.toFixed(1)}</span>
              </div>

              {/* Discount Selector */}
              {showDiscountSelector && (
                <div className="flex items-center gap-1 pt-1">
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        setDiscountPercent(pct);
                        setShowDiscountSelector(false);
                      }}
                      className={`flex-1 py-1 rounded-md text-[10px] font-semibold border cursor-pointer ${
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

              {/* Total Due */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                <span className="text-xs font-bold text-zinc-700">Total Due</span>
                <span className="text-lg font-black text-zinc-900 font-mono tabular-nums">
                  ₹{grandTotal}
                </span>
              </div>
            </div>

            {/* Action Row 1: Send to Kitchen & Print Bill */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleSendToKitchen}
                className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-black disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              >
                <Send size={13} />
                <span>Send to Kitchen</span>
              </button>

              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={handlePrintGuestBill}
                className="py-2.5 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 disabled:opacity-40 text-zinc-800 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Printer size={13} />
                <span>Print Bill</span>
              </button>
            </div>

            {/* Action Row 2: Settle Button (TableTapy Coral Brand Accent) */}
            {!isPaymentDrawerOpen ? (
              <button
                disabled={allCurrentItems.length === 0 || isSubmitting}
                onClick={() => setIsPaymentDrawerOpen(true)}
                className="w-full py-3 px-3 rounded-xl bg-[#E46254] hover:bg-[#D35546] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-all"
              >
                <CreditCard size={15} />
                <span>Collect Payment & Settle (₹{grandTotal})</span>
              </button>
            ) : (
              <div className="bg-white border border-zinc-300 rounded-xl p-3 shadow-md space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900">
                    Settle ₹{grandTotal} · Select Payment:
                  </span>
                  <button
                    onClick={() => setIsPaymentDrawerOpen(false)}
                    className="p-1 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleQuickSettle("CASH")}
                    className="py-2 px-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-lg font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-all"
                  >
                    <Banknote size={15} className="text-zinc-700" />
                    <span>Cash</span>
                  </button>

                  <button
                    disabled={isSubmitting}
                    onClick={() => handleQuickSettle("UPI")}
                    className="py-2 px-1 bg-[#E46254]/8 hover:bg-[#E46254]/15 border border-[#E46254]/25 text-[#C2410C] rounded-lg font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-all"
                  >
                    <QrCode size={15} className="text-[#E46254]" />
                    <span>UPI Received</span>
                  </button>

                  <button
                    disabled={isSubmitting}
                    onClick={() => handleQuickSettle("CARD")}
                    className="py-2 px-1 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-lg font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-all"
                  >
                    <CreditCard size={15} className="text-zinc-700" />
                    <span>Card</span>
                  </button>
                </div>

                {/* Tendered Change Calculator */}
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 text-xs">
                  <input
                    type="number"
                    placeholder="Cash given..."
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-24 px-2 py-1 bg-zinc-50 border border-zinc-300 rounded-md text-xs font-mono outline-none"
                  />
                  {parseFloat(cashTendered) > grandTotal && (
                    <span className="text-xs font-bold text-emerald-600 ml-auto font-mono">
                      Change: ₹{changeDue}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── THERMAL RECEIPT ── */}
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
                  {printChit.mode === "DINE_IN" ? "[DINE-IN PLATING]" : "[PARCEL / TAKEAWAY]"}
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
                
                {/* Dynamic Tabletop UPI QR */}
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