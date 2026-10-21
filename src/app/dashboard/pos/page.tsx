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
  Clock,
  User,
  Phone,
  RotateCcw,
  AlertCircle,
  Users,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import QRCode from "react-qr-code";
import { createClient } from "@/utils/supabase/client";

/* ─── Domain Types ─────────────────────────────────────────────────── */
interface Location {
  id: string;
  name: string;
  type?: string;
  capacity?: number;
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

interface TableSessionData {
  status: "COOKING" | "BILLED" | "VACANT";
  orders: OrderRecord[];
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    source: "QR" | "STAFF" | "CAPTAIN";
    roundNumber: number;
    orderId: string;
  }>;
  totalBill: number;
  customerName?: string;
  customerPhone?: string;
  firstOrderAt?: string;
  latestOrderAt?: string;
  hasNewRound: boolean;
}

type TerminalMode = "DINE_IN" | "TAKEAWAY";
type PaymentMethod = "CASH" | "UPI" | "CARD";

export default function PosPage() {
  const supabase = createClient();

  // Core State
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("Restaurant");
  const [upiId, setUpiId] = useState<string>("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Mode & Filters
  const [terminalMode, setTerminalMode] = useState<TerminalMode>("DINE_IN");
  const [tableFilter, setTableFilter] = useState<"ALL" | "OCCUPIED" | "VACANT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected Table Drawer (when user taps an active or vacant card)
  const [activeTableModal, setActiveTableModal] = useState<string | null>(null);

  // Settlement & Discount inside the table sheet
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Takeaway Tokens
  const [takeawayCounter, setTakeawayCounter] = useState<number>(1);
  const currentTakeawayToken = `Token #${takeawayCounter.toString().padStart(2, "0")}`;

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

      // Tables (locations)
      const { data: locData } = await supabase
        .from("locations")
        .select("*")
        .eq("restaurant_id", restId)
        .order("name", { ascending: true });

      if (locData) {
        setLocations(
          locData.map((l: any) => ({
            id: l.id,
            name: l.name,
            type: l.type,
            capacity: l.capacity || 4,
          }))
        );
      }

      await fetchActiveOrders(restId);
    } catch (err) {
      console.error("Failed to load POS tables:", err);
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
        setActiveTableModal(null);
        setIsPaymentDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel("pos_tables_realtime")
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

  /* ─── 2. Compute Table State Map ────────────────────────────────── */
  const tableSessionMap = useMemo(() => {
    const map = new Map<string, TableSessionData>();

    // Initialize all tables as vacant
    locations.forEach((loc) => {
      map.set(loc.name, {
        status: "VACANT",
        orders: [],
        items: [],
        totalBill: 0,
        hasNewRound: false,
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
        items: [],
        totalBill: 0,
        hasNewRound: false,
      };

      existing.orders.push(order);
      existing.totalBill += Number(order.total || 0);

      if (order.status === "NEW") {
        existing.hasNewRound = true;
      }

      if (order.customer_name && !existing.customerName) {
        existing.customerName = order.customer_name;
      }
      if (order.customer_phone && !existing.customerPhone) {
        existing.customerPhone = order.customer_phone;
      }

      if (!existing.firstOrderAt || new Date(order.created_at) < new Date(existing.firstOrderAt)) {
        existing.firstOrderAt = order.created_at;
      }
      if (!existing.latestOrderAt || new Date(order.created_at) > new Date(existing.latestOrderAt)) {
        existing.latestOrderAt = order.created_at;
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
          existing.items.push({
            name: itemObj.name || "Custom Item",
            price: Number(raw.price || itemObj.basePrice || itemObj.base_price || 0),
            quantity: Number(raw.quantity || 1),
            notes: raw.notes || raw.specialInstructions || "",
            source: orderSource,
            roundNumber: roundIndex,
            orderId: order.id,
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

  const activeTakeaways = useMemo(() => {
    return activeOrders.filter(
      (o) =>
        o.table_no.toLowerCase().includes("takeaway") ||
        o.table_no.toLowerCase().includes("token")
    );
  }, [activeOrders]);

  // Counts
  const occupiedCount = Array.from(tableSessionMap.values()).filter(
    (s) => s.status !== "VACANT"
  ).length;
  const vacantCount = locations.length - occupiedCount;

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return locations.filter((loc) => {
      const session = tableSessionMap.get(loc.name);
      const isOccupied = session && session.status !== "VACANT";

      if (tableFilter === "OCCUPIED" && !isOccupied) return false;
      if (tableFilter === "VACANT" && isOccupied) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        loc.name.toLowerCase().includes(q) ||
        session?.customerName?.toLowerCase().includes(q) ||
        session?.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [locations, tableSessionMap, tableFilter, searchQuery]);

  // Selected Table Session in Drawer
  const activeSession = useMemo(() => {
    if (!activeTableModal) return null;
    return tableSessionMap.get(activeTableModal) || null;
  }, [activeTableModal, tableSessionMap]);

  /* ─── Calculations for Selected Table ───────────────────────────── */
  const subtotal = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.items.reduce((s, it) => s + it.price * it.quantity, 0);
  }, [activeSession]);

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

  /* ─── Thermal Printing & Settle ─────────────────────────────────── */
  const handlePrintGuestBill = () => {
    if (!activeSession || activeSession.items.length === 0) {
      showToast("No active items on this table");
      return;
    }

    setPrintChit({
      type: "BILL",
      mode: "DINE_IN",
      tableOrToken: activeTableModal || "Table",
      customerName: activeSession.customerName || `Table ${activeTableModal}`,
      items: activeSession.items,
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
    if (!activeSession) return;
    const roundItems = activeSession.items.filter((i) => i.roundNumber === roundNum);
    if (roundItems.length === 0) return;

    setPrintChit({
      type: "KOT",
      mode: "DINE_IN",
      tableOrToken: activeTableModal || "Table",
      kotNumber: roundNum,
      customerName: activeSession.customerName,
      items: roundItems.map((i) => ({
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

  const handleSettleTable = async (method: PaymentMethod) => {
    if (!activeSession || activeSession.items.length === 0 || !activeTableModal) {
      showToast("No items to settle");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderIds = activeSession.orders.map((o) => o.id);

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

      showToast(`Table ${activeTableModal} settled ₹${grandTotal} via ${method}`);

      setPrintChit({
        type: "BILL",
        mode: "DINE_IN",
        tableOrToken: activeTableModal,
        customerName: activeSession.customerName,
        paymentMethod: method,
        items: activeSession.items,
        subtotal,
        discount: effectiveDiscount,
        tax: taxTotal,
        grandTotal,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      setActiveTableModal(null);
      setIsPaymentDrawerOpen(false);
      setDiscountPercent(0);

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
    const name = encodeURIComponent(restaurantName);
    return `upi://pay?pa=${vpa}&pn=${name}&am=${grandTotal}&cu=INR`;
  }, [upiId, restaurantName, grandTotal]);

  return (
    <div className="flex h-screen flex-col bg-[#FAFAFA] font-sans text-zinc-900 select-none overflow-hidden">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-6 z-[300] bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 border border-zinc-800 animate-in fade-in slide-in-from-top-2">
          <Check size={14} className="text-[#E46254]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── TOP BAR: Matches Dashboard ── */}
      <div className="shrink-0 bg-white border-b border-zinc-200/80 px-6 py-3.5 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-zinc-900 tracking-tight">Floor Tables</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10.5px] font-bold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Floor
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-200 mx-1" />

          {/* Mode Tabs */}
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/80">
            <button
              onClick={() => setTerminalMode("DINE_IN")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer ${
                terminalMode === "DINE_IN"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <UtensilsCrossed size={13} className={terminalMode === "DINE_IN" ? "text-[#E46254]" : "text-zinc-400"} />
              <span>Dine-In Tables ({locations.length})</span>
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
              <span>Takeaways ({activeTakeaways.length})</span>
            </button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative w-64 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tables or guests... (Press '/')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-8 py-1.5 text-[12.5px] placeholder:text-zinc-400 outline-none focus:border-zinc-400 focus:bg-white transition-all font-medium"
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

          <button
            onClick={() => {
              if (restaurantId) fetchActiveOrders(restaurantId);
              showToast("Floor refreshed");
            }}
            className="p-2 border border-zinc-200 bg-white rounded-xl text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors"
            title="Refresh"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* ── FILTER CHIPS BAR ── */}
      <div className="shrink-0 bg-white border-b border-zinc-200/80 px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTableFilter("ALL")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
              tableFilter === "ALL"
                ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs font-semibold"
                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            All Tables ({locations.length})
          </button>

          <button
            onClick={() => setTableFilter("OCCUPIED")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
              tableFilter === "OCCUPIED"
                ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs font-semibold"
                : "bg-white text-[#C2410C] border-zinc-200 hover:bg-[#E46254]/5"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${tableFilter === "OCCUPIED" ? "bg-white" : "bg-[#E46254]"}`} />
            <span>Active / Occupied ({occupiedCount})</span>
          </button>

          <button
            onClick={() => setTableFilter("VACANT")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
              tableFilter === "VACANT"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold"
                : "bg-white text-emerald-700 border-zinc-200 hover:bg-emerald-50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${tableFilter === "VACANT" ? "bg-white" : "bg-emerald-500"}`} />
            <span>Vacant ({vacantCount})</span>
          </button>
        </div>

        <Link
          href="/dashboard/locations"
          className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 font-medium"
        >
          <span>Manage Tables</span>
          <ChevronRight size={13} />
        </Link>
      </div>

      {/* ── ALL THE TABLES IN CARDS ── */}
      <div className="flex-1 overflow-y-auto p-6 slim-scrollbar">
        {locations.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-dashed border-zinc-200 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#E46254]/10 text-[#E46254] flex items-center justify-center mb-3">
              <UtensilsCrossed size={24} />
            </div>
            <h3 className="text-base font-bold text-zinc-900">No tables configured yet</h3>
            <p className="text-xs text-zinc-500 mt-1 mb-4 leading-relaxed">
              Create your dining tables in Locations to start taking orders and viewing your floor layout.
            </p>
            <Link
              href="/dashboard/locations"
              className="px-4 py-2 bg-[#E46254] hover:bg-[#D35546] text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              Add Tables in Locations
            </Link>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="h-[50vh] flex flex-col items-center justify-center text-center p-8">
            <AlertCircle size={28} className="text-zinc-300 mb-2" />
            <h3 className="text-sm font-semibold text-zinc-700">No tables matching this filter</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Try switching between All, Active, or Vacant</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filteredTables.map((loc) => {
              const session = tableSessionMap.get(loc.name);
              const isOccupied = session && session.status !== "VACANT";
              const itemCount = session?.items.reduce((s, it) => s + it.quantity, 0) || 0;

              // Elapsed time calculation
              const elapsedMinutes = session?.firstOrderAt
                ? Math.max(0, Math.floor((Date.now() - new Date(session.firstOrderAt).getTime()) / 60000))
                : 0;

              // Sources present in session
              const hasQR = session?.items.some((i) => i.source === "QR");
              const hasCaptain = session?.items.some((i) => i.source === "CAPTAIN");
              const hasPOS = session?.items.some((i) => i.source === "STAFF");

              return (
                <div
                  key={loc.id}
                  onClick={() => setActiveTableModal(loc.name)}
                  className={`relative rounded-2xl p-4.5 border transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-md select-none group ${
                    isOccupied
                      ? "bg-white border-[#E46254]/30 hover:border-[#E46254] ring-1 ring-[#E46254]/10"
                      : "bg-white border-zinc-200/80 hover:border-zinc-300"
                  }`}
                >
                  <div>
                    {/* Top Header: Table Name & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h2 className="text-base font-bold text-zinc-900 tracking-tight group-hover:text-[#E46254] transition-colors">
                          {loc.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                          <Users size={12} className="shrink-0" />
                          <span>{loc.capacity || 4} Seats</span>
                        </div>
                      </div>

                      {/* Status Indicator */}
                      {isOccupied ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E46254]/10 text-[#C2410C] text-[10.5px] font-bold border border-[#E46254]/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E46254] animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10.5px] font-semibold border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Vacant
                        </span>
                      )}
                    </div>

                    {/* Middle: Active Session Details or Vacant Placeholder */}
                    {isOccupied ? (
                      <div className="space-y-2 mt-3 pt-3 border-t border-zinc-100">
                        {/* Guest & Timer */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 truncate text-zinc-700 font-medium">
                            <User size={12} className="text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[110px]">
                              {session?.customerName || "Dine-in Guest"}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1 shrink-0">
                            <Clock size={11} />
                            {elapsedMinutes}m
                          </span>
                        </div>

                        {/* Order Origin Tags */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {hasQR && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Online QR
                            </span>
                          )}
                          {hasCaptain && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              Captain
                            </span>
                          )}
                          {hasPOS && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                              POS
                            </span>
                          )}
                          <span className="text-[10.5px] text-zinc-400 ml-auto font-medium">
                            {itemCount} {itemCount === 1 ? "item" : "items"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-5 flex flex-col items-center justify-center text-center">
                        <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 mb-1.5">
                          <UtensilsCrossed size={14} />
                        </div>
                        <span className="text-[11.5px] text-zinc-400 font-medium">Ready for guests</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Total Bill or Quick Seat Action */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                    {isOccupied ? (
                      <>
                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
                            Bill Total
                          </span>
                          <span className="text-base font-black text-zinc-900 font-mono tabular-nums">
                            ₹{session?.totalBill || 0}
                          </span>
                        </div>
                        <span className="px-3 py-1.5 rounded-lg bg-[#E46254] text-white text-xs font-semibold group-hover:brightness-105 transition-all shadow-2xs">
                          View Bill
                        </span>
                      </>
                    ) : (
                      <span className="w-full text-center py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs font-semibold transition-colors">
                        Available
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TABLE DETAILS MODAL / DRAWER ── */}
      {activeTableModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E46254]/10 text-[#E46254] flex items-center justify-center font-bold text-sm">
                  {activeTableModal.replace(/[^0-9]/g, "") || "T"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                    {activeTableModal}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                    <User size={12} className="text-zinc-400" />
                    <span>{activeSession?.customerName || "Dine-in Guest"}</span>
                    {activeSession?.customerPhone && (
                      <span className="text-zinc-400 font-mono text-[11px]">
                        · {activeSession.customerPhone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveTableModal(null);
                  setIsPaymentDrawerOpen(false);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Items Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 slim-scrollbar">
              {!activeSession || activeSession.items.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  <UtensilsCrossed size={28} className="text-zinc-300 mx-auto mb-2" />
                  <p className="font-semibold text-zinc-700 text-sm">Table is currently vacant</p>
                  <p className="text-zinc-400 mt-1">Guests can scan the table QR code to order, or captain can punch an order.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-600 bg-zinc-100/70 px-3 py-1.5 rounded-lg">
                    <span>Ordered Dishes ({activeSession.items.length})</span>
                    <span>Subtotal: ₹{subtotal}</span>
                  </div>

                  <div className="divide-y divide-zinc-100 bg-white rounded-xl border border-zinc-200/80 p-2">
                    {activeSession.items.map((it, idx) => (
                      <div key={idx} className="py-2.5 px-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 flex-1 pr-2">
                          <span className="font-bold font-mono text-zinc-400 w-5">{it.quantity}×</span>
                          <div>
                            <p className="font-semibold text-zinc-900 leading-snug">{it.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                it.source === "QR"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : it.source === "CAPTAIN"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                              }`}>
                                {it.source === "QR" ? "Online QR" : it.source === "CAPTAIN" ? "Captain" : "POS Counter"}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                Round #{it.roundNumber}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-zinc-900 font-mono tabular-nums">
                            ₹{it.price * it.quantity}
                          </span>
                          <button
                            onClick={() => handleReprintKOT(it.roundNumber)}
                            className="text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer transition-colors"
                            title="Reprint KOT"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calculations */}
                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200/80 space-y-1.5 text-xs">
                    <div className="flex justify-between text-zinc-500">
                      <span>Subtotal</span>
                      <span className="font-semibold text-zinc-800 font-mono">₹{subtotal}</span>
                    </div>

                    {effectiveDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Discount ({discountPercent}%)</span>
                        <span className="font-mono">-₹{effectiveDiscount.toFixed(1)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-zinc-500">
                      <span className="flex items-center gap-1">
                        <span>Taxes (5% GST)</span>
                        <button
                          onClick={() => setDiscountPercent((p) => (p === 0 ? 10 : 0))}
                          className="text-[10px] text-zinc-500 underline ml-1 cursor-pointer hover:text-zinc-900"
                        >
                          {discountPercent > 0 ? "Remove Disc" : "+ 10% Disc"}
                        </button>
                      </span>
                      <span className="font-semibold text-zinc-800 font-mono">₹{taxTotal.toFixed(1)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                      <span className="text-xs font-bold text-zinc-800">Grand Total</span>
                      <span className="text-base font-black text-zinc-900 font-mono">₹{grandTotal}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            {activeSession && activeSession.items.length > 0 && (
              <div className="p-4 bg-white border-t border-zinc-200 space-y-2.5">
                {!isPaymentDrawerOpen ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePrintGuestBill}
                      className="py-2.5 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Printer size={14} />
                      <span>Print Guest Bill</span>
                    </button>

                    <button
                      onClick={() => setIsPaymentDrawerOpen(true)}
                      className="py-2.5 px-3 rounded-xl bg-[#E46254] hover:bg-[#D35546] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <CreditCard size={14} />
                      <span>Settle Bill (₹{grandTotal})</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900">
                        Select Settle Method (₹{grandTotal}):
                      </span>
                      <button
                        onClick={() => setIsPaymentDrawerOpen(false)}
                        className="text-zinc-400 hover:text-zinc-600 p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        disabled={isSubmitting}
                        onClick={() => handleSettleTable("CASH")}
                        className="py-2 px-1 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-lg font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <Banknote size={15} className="text-zinc-700" />
                        <span>Cash</span>
                      </button>

                      <button
                        disabled={isSubmitting}
                        onClick={() => handleSettleTable("UPI")}
                        className="py-2 px-1 bg-[#E46254]/10 hover:bg-[#E46254]/15 border border-[#E46254]/30 text-[#C2410C] rounded-lg font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <QrCode size={15} className="text-[#E46254]" />
                        <span>UPI</span>
                      </button>

                      <button
                        disabled={isSubmitting}
                        onClick={() => handleSettleTable("CARD")}
                        className="py-2 px-1 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-lg font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <CreditCard size={15} className="text-zinc-700" />
                        <span>Card</span>
                      </button>
                    </div>

                    {/* Change calculator */}
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-200 text-xs">
                      <input
                        type="number"
                        placeholder="Cash given..."
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-24 px-2 py-1 bg-white border border-zinc-200 rounded-md text-xs font-mono outline-none"
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
            )}
          </div>
        </div>
      )}

      {/* ── THERMAL RECEIPT ── */}
      <div id="thermal-chit" className="hidden print:block text-black bg-white font-mono text-[11px] leading-tight p-2">
        {printChit && (
          <div>
            {printChit.type === "KOT" ? (
              <div className="space-y-1">
                <div className="text-center font-bold text-sm border-b pb-1">
                  *** KITCHEN ORDER TICKET (KOT) ***
                </div>
                <div className="flex justify-between font-bold pt-1">
                  <span>TABLE:</span>
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
                <div className="text-center text-[10px]">[DINE-IN PLATING]</div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-center font-bold text-base">{restaurantName}</div>
                <div className="text-center text-[10px]">TAX INVOICE / GUEST BILL</div>
                <div className="border-b my-1" />
                <div className="flex justify-between">
                  <span>Table: {printChit.tableOrToken}</span>
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