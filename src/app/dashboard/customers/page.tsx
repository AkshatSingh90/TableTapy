"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Receipt,
  Sparkles,
  RefreshCw,
  Phone,
  UtensilsCrossed,
  X,
  ChevronRight,
  IndianRupee,
  Star,
  Heart,
  TrendingUp,
  Flame,
  Percent,
  Lock,
  Coins
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

/* ─── Interfaces ─────────────────────────────────────────── */
interface OrderItem {
  item?: { id?: string | number; name?: string; basePrice?: number; category?: string };
  name?: string;
  price?: number;
  basePrice?: number;
  quantity?: number;
  notes?: string;
}

interface OrderRecord {
  id: string;
  restaurant_id: string;
  table_no: string;
  total: number;
  status: string;
  payment_status?: string;
  payment_method?: string;
  customer_name?: string;
  customer_phone?: string;
  items_json: OrderItem[];
  created_at: string;
  note?: string;
}

interface CustomerProfile {
  id: string;
  phone: string;
  name: string;
  totalSpend: number;
  totalVisits: number;
  firstVisit: string;
  lastVisit: string;
  avgOrderValue: number;
  tablesSat: string[];
  orders: OrderRecord[];
  favoriteDishes: { name: string; count: number; spend: number }[];
  coinsBalance: number;
  segment: "VIP" | "Loyal" | "High Spenders" | "Frequent Diners";
  rfmScore: {
    recency: number;
    frequency: number;
    spending: number;
  };
}

export default function CustomersPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  // Centered Top Nav Tab Toggle (Exact match to Inventory Page)
  const [activeTab, setActiveTab] = useState<"Intelligence" | "All Customers">("Intelligence");

  // Filter selection when clicking an Intelligence card
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState<string | null>(null);

  // Search input on List View
  const [searchQuery, setSearchQuery] = useState("");

  // Customer Detail Modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);

  /* ─── Fetch Data ────────────────────────────────────────── */
  const fetchData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const restId = user?.user_metadata?.restaurant_id;

      setRestaurantId(restId || null);

      if (restId) {
        const { data: ordersData } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restId)
          .neq("status", "CANCELLED")
          .order("created_at", { ascending: false })
          .limit(1500);

        if (ordersData) {
          setOrders(ordersData as OrderRecord[]);
        }
      }
    } catch (err) {
      console.error("Error loading customer data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  /* ─── Aggregate Customer Profiles ───────────────────────── */
  const customers = useMemo<CustomerProfile[]>(() => {
    if (!orders || orders.length === 0) return [];

    const map = new Map<
      string,
      {
        phone: string;
        name: string;
        orders: OrderRecord[];
        dishesMap: Map<string, { count: number; spend: number }>;
        tablesSet: Set<string>;
      }
    >();

    for (const order of orders) {
      const rawPhone = (order.customer_phone || "").trim();
      const cleanPhone = rawPhone.replace(/\D/g, "");
      const rawName = (order.customer_name || "").trim();
      const lowerName = rawName.toLowerCase();

      // Exclude staff & captain orders
      const isStaffOrCaptain =
        lowerName.startsWith("captain") ||
        lowerName.startsWith("waiter") ||
        lowerName.startsWith("steward") ||
        lowerName.startsWith("staff") ||
        lowerName.startsWith("admin") ||
        lowerName.includes("captain:");

      if (isStaffOrCaptain && !cleanPhone) continue;

      const isTakeaway =
        (order.table_no || "").toLowerCase().includes("takeaway") ||
        (order.table_no || "").toLowerCase().startsWith("takeaway") ||
        lowerName === "takeaway guest" ||
        lowerName === "takeaway customer";

      // If takeaway: ONLY add as a customer if cashier/customer provided BOTH name AND valid phone!
      // Otherwise skip completely.
      if (isTakeaway && (!cleanPhone || !rawName || lowerName === "takeaway guest")) {
        continue;
      }

      const isPlaceholder =
        !rawName ||
        lowerName === "dine-in guest" ||
        lowerName === "dine in customer" ||
        lowerName.startsWith("table ");

      if (!cleanPhone && isPlaceholder) continue;

      const key = cleanPhone || `name_${lowerName}`;

      let record = map.get(key);
      if (!record) {
        record = {
          phone: cleanPhone,
          name: isPlaceholder || isStaffOrCaptain
            ? cleanPhone
              ? `Guest (${cleanPhone.slice(-4)})`
              : "Dine In Customer"
            : rawName,
          orders: [],
          dishesMap: new Map(),
          tablesSet: new Set(),
        };
        map.set(key, record);
      }

      if (
        (isPlaceholder || isStaffOrCaptain) &&
        !record.name.startsWith("Guest") &&
        rawName &&
        !isPlaceholder &&
        !isStaffOrCaptain
      ) {
        record.name = rawName;
      }

      record.orders.push(order);
      if (order.table_no) record.tablesSet.add(order.table_no);

      const itemsList = Array.isArray(order.items_json) ? order.items_json : [];
      itemsList.forEach((entry) => {
        const raw: any = entry?.item || entry;
        const dName = raw?.name || entry?.name || "Dish Item";
        const qty = Number(entry.quantity || 1);
        const p = Number(entry.price ?? raw?.price ?? raw?.basePrice ?? 0) * qty;
        const existing = record!.dishesMap.get(dName);
        if (existing) {
          existing.count += qty;
          existing.spend += p;
        } else {
          record!.dishesMap.set(dName, { count: qty, spend: p });
        }
      });
    }

    const now = Date.now();
    const result: CustomerProfile[] = [];

    map.forEach((data, key) => {
      const sortedOrders = [...data.orders].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const firstVisit = sortedOrders[0]?.created_at || new Date().toISOString();
      const lastVisit = sortedOrders[sortedOrders.length - 1]?.created_at || new Date().toISOString();

      const totalSpend = sortedOrders.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
      const totalVisits = sortedOrders.length;
      const avgOrderValue = totalVisits > 0 ? totalSpend / totalVisits : 0;

      // Loyalty points are strictly for Dine-In guests. Never award loyalty points on takeaway orders!
      const dineInSpend = sortedOrders
        .filter((ord) => !(ord.table_no || "").toLowerCase().includes("takeaway"))
        .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);

      const daysSinceLastVisit = Math.max(
        0,
        Math.floor((now - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
      );

      const favoriteDishes = Array.from(data.dishesMap.entries())
        .map(([name, stat]) => ({ name, count: stat.count, spend: stat.spend }))
        .sort((a, b) => b.count - a.count);

      let recencyScore = 1;
      if (daysSinceLastVisit <= 7) recencyScore = 5;
      else if (daysSinceLastVisit <= 15) recencyScore = 4;
      else if (daysSinceLastVisit <= 30) recencyScore = 3;
      else if (daysSinceLastVisit <= 60) recencyScore = 2;

      const frequencyScore = Math.min(5, Math.max(1, totalVisits));

      let spendingScore = 1;
      if (totalSpend >= 5000) spendingScore = 5;
      else if (totalSpend >= 3000) spendingScore = 4;
      else if (totalSpend >= 1500) spendingScore = 3;
      else if (totalSpend >= 750) spendingScore = 2;

      // 4 High-Value Owner Segments
      let segment: "VIP" | "Loyal" | "High Spenders" | "Frequent Diners" = "Loyal";
      if (totalSpend >= 4000 || (totalVisits >= 4 && totalSpend >= 2500)) {
        segment = "VIP";
      } else if (avgOrderValue >= 1200 || totalSpend >= 2500) {
        segment = "High Spenders";
      } else if (totalVisits >= 3) {
        segment = "Frequent Diners";
      } else {
        segment = "Loyal";
      }

      result.push({
        id: key,
        phone: data.phone,
        name: data.name,
        totalSpend,
        totalVisits,
        firstVisit,
        lastVisit,
        avgOrderValue,
        tablesSat: Array.from(data.tablesSet),
        orders: [...sortedOrders].reverse(),
        favoriteDishes,
        coinsBalance: Math.floor(dineInSpend / 50),
        segment,
        rfmScore: {
          recency: recencyScore,
          frequency: frequencyScore,
          spending: spendingScore,
        },
      });
    });

    return result;
  }, [orders]);

  /* ─── Intelligence 4 Cards Data ─────────────────────────── */
  const vips = useMemo(() => customers.filter((c) => c.segment === "VIP"), [customers]);
  const loyals = useMemo(() => customers.filter((c) => c.segment === "Loyal"), [customers]);
  const highSpenders = useMemo(() => customers.filter((c) => c.segment === "High Spenders"), [customers]);
  const frequentDiners = useMemo(() => customers.filter((c) => c.segment === "Frequent Diners"), [customers]);

  /* ─── Filtered Customer List for "All Customers" ─────────── */
  const filteredList = useMemo(() => {
    let list = customers;

    if (selectedSegmentFilter) {
      list = list.filter((c) => c.segment.toLowerCase() === selectedSegmentFilter.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.favoriteDishes.some((d) => d.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [customers, selectedSegmentFilter, searchQuery]);

  const formatReferenceDate = (isoStr: string) => {
    const d = new Date(isoStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatModalDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-[#E46254] rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium text-xs">Loading customer intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden text-gray-900 font-sans relative">
      <div className="flex-1 overflow-y-auto slim-scrollbar px-6 md:px-10 w-full pb-10">
        
        {/* ───────────────────────────────────────────────────────────── */}
        {/* TOP NAV TABS (Exact match to Inventory Page: max-w-sm centered) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="pt-6 pb-2 w-full flex items-center justify-center">
          <div className="bg-gray-100/80 p-1 rounded-xl flex items-center gap-1 w-full max-w-sm mx-auto shadow-inner border border-gray-200/50">
            <button
              onClick={() => {
                setSelectedSegmentFilter(null);
                setActiveTab("Intelligence");
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-[13px] font-medium transition-all cursor-pointer ${
                activeTab === "Intelligence"
                  ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Sparkles
                size={14}
                className={activeTab === "Intelligence" ? "text-[#E46254]" : ""}
              />
              Intelligence
            </button>

            <button
              onClick={() => setActiveTab("All Customers")}
              className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-[13px] font-medium transition-all cursor-pointer ${
                activeTab === "All Customers"
                  ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Users
                size={14}
                className={activeTab === "All Customers" ? "text-[#E46254]" : ""}
              />
              All Customers
            </button>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* TAB 1: INTELLIGENCE VIEW (Exact match to IntelligenceDashboard.tsx) */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === "Intelligence" ? (
          <div className="flex flex-col h-full w-full max-w-5xl mx-auto mt-6 font-sans animate-in fade-in duration-300">
            
            {/* Header matching Tabletapy Inventory Intelligence */}
            <div className="mb-8">
              <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">
                TableTapy Customer Intelligence
              </h1>
              <p className="text-[13px] text-gray-500 mt-1">
                Smart insights, VIP guests, high spenders, and frequent diners.
              </p>
            </div>

            {/* 4 Cards Grid (Exact match to IntelligenceDashboard.tsx) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Card 1: VIP Customers */}
              <div
                onClick={() => {
                  setSelectedSegmentFilter("VIP");
                  setActiveTab("All Customers");
                }}
                className="p-5 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Star
                      size={22}
                      className="text-[#E46254] transition-transform group-hover:-translate-y-0.5"
                    />
                    <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">
                      VIP Customers
                    </h2>
                  </div>
                  <span className="text-[12px] font-bold text-[#E46254] bg-[#E46254]/8 px-2.5 py-0.5 rounded-full border border-[#E46254]/20 tabular-nums">
                    {vips.length} guests
                  </span>
                </div>
                <p className="text-[13px] text-gray-500 font-medium pl-[34px]">
                  High value, frequent, and top lifetime contributors
                </p>
              </div>

              {/* Card 2: Loyal Customers */}
              <div
                onClick={() => {
                  setSelectedSegmentFilter("Loyal");
                  setActiveTab("All Customers");
                }}
                className="p-5 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Heart
                      size={22}
                      className="text-[#E46254] transition-transform group-hover:-translate-y-0.5"
                    />
                    <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">
                      Loyal Customers
                    </h2>
                  </div>
                  <span className="text-[12px] font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200/80 tabular-nums">
                    {loyals.length} guests
                  </span>
                </div>
                <p className="text-[13px] text-gray-500 font-medium pl-[34px]">
                  Regular guests with consistent dining and bill history
                </p>
              </div>

              {/* Card 3: High Spenders */}
              <div
                onClick={() => {
                  setSelectedSegmentFilter("High Spenders");
                  setActiveTab("All Customers");
                }}
                className="p-5 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp
                      size={22}
                      className="text-[#E46254] transition-transform group-hover:-translate-y-0.5"
                    />
                    <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">
                      High Spenders
                    </h2>
                  </div>
                  <span className="text-[12px] font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200/80 tabular-nums">
                    {highSpenders.length} guests
                  </span>
                </div>
                <p className="text-[13px] text-gray-500 font-medium pl-[34px]">
                  Diners with premium table checks and highest order values
                </p>
              </div>

              {/* Card 4: Frequent Diners */}
              <div
                onClick={() => {
                  setSelectedSegmentFilter("Frequent Diners");
                  setActiveTab("All Customers");
                }}
                className="p-5 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Flame
                      size={22}
                      className="text-[#E46254] transition-transform group-hover:-translate-y-0.5"
                    />
                    <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">
                      Frequent Diners
                    </h2>
                  </div>
                  <span className="text-[12px] font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200/80 tabular-nums">
                    {frequentDiners.length} guests
                  </span>
                </div>
                <p className="text-[13px] text-gray-500 font-medium pl-[34px]">
                  Guests who visit most often & drive weekday floor volume
                </p>
              </div>

            </div>
          </div>
        ) : (
          /* ───────────────────────────────────────────────────────────── */
          /* TAB 2: ALL CUSTOMERS (Exact match to Inventory's Data View)   */
          /* ───────────────────────────────────────────────────────────── */
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* DYNAMIC TOP HEADER (Exact match to Inventory: sticky top-0 z-20) */}
            <div className="sticky top-0 z-20 pt-6 pb-3 bg-white/95 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h1 className="text-[13px] font-semibold text-gray-900 tracking-tight">
                  {selectedSegmentFilter ? `${selectedSegmentFilter}` : "All Customers"}
                </h1>
                <span className="px-2 py-0.5 border border-gray-200 text-gray-500 rounded text-[11px] font-medium bg-white">
                  {filteredList.length} Customers
                </span>
                {selectedSegmentFilter && (
                  <button
                    onClick={() => setSelectedSegmentFilter(null)}
                    className="text-[11px] font-semibold text-[#E46254] hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    (Clear Filter)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64 group">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#E46254] transition-colors"
                    size={16}
                  />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search customers or dishes..."
                    className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-[13px] font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#E46254] transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2 border border-gray-200 text-gray-500 hover:text-[#E46254] hover:border-[#E46254]/30 rounded-lg transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={refreshing ? "animate-spin text-[#E46254]" : ""} />
                </button>
              </div>
            </div>

            {/* Customers Card Grid */}
            <div className="mt-6">
              {filteredList.length === 0 ? (
                <div className="py-24 text-center bg-white rounded-2xl border border-gray-200 p-8">
                  <Users size={28} className="text-[#E46254] mx-auto mb-2.5" />
                  <h3 className="text-[15px] font-semibold text-gray-900">No Customers Found</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? `No customer records matched "${searchQuery}".`
                      : "Customer orders and contact profiles will populate here as guests dine in."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredList.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className="bg-white rounded-2xl p-4.5 border border-gray-200/80 hover:border-gray-300 hover:shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        {/* Customer Header */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-[#E46254]/10 text-[#E46254] flex items-center justify-center shrink-0 mt-0.5">
                            <Users size={15} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-[13.5px] font-bold text-gray-900 group-hover:text-[#E46254] transition-colors truncate">
                              {customer.name}
                            </h4>
                            <div className="text-[11.5px] text-gray-400 font-normal truncate">
                              {customer.phone || "No phone number"}
                            </div>
                          </div>

                          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                            {customer.segment}
                          </span>
                        </div>

                        {/* Customer 5 Rows: Total Orders, Total Spent, Avg Order, Coins, Last Order */}
                        <div className="space-y-1 text-[11.5px] text-gray-500 pt-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Total Orders:</span>
                            <span className="font-semibold text-gray-800 tabular-nums">
                              {customer.totalVisits}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Total Spent:</span>
                            <span className="font-semibold text-gray-800 tabular-nums">
                              ₹{customer.totalSpend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Avg Order:</span>
                            <span className="font-semibold text-gray-800 tabular-nums">
                              ₹{customer.avgOrderValue.toFixed(0)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 flex items-center gap-1">
                              <span>Coins Balance:</span>
                            </span>
                            <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded text-[11px] tabular-nums inline-flex items-center gap-1">
                              <Coins size={11} className="text-amber-500" />
                              {customer.coinsBalance} Coins
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Last Order:</span>
                            <span className="font-semibold text-gray-800 tabular-nums">
                              {formatReferenceDate(customer.lastVisit)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Footer */}
                      <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                        <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                          <UtensilsCrossed size={11} className="shrink-0" />
                          <span className="truncate">{customer.favoriteDishes[0]?.name || "Dine-in"}</span>
                        </div>
                        <span className="text-[#E46254] font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                          View <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CUSTOMER MODAL DIALOG                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedCustomer && (
        <div
          onClick={() => setSelectedCustomer(null)}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] bg-white rounded-3xl shadow-2xl border border-gray-200/90 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="relative pt-8 pb-5 px-6 text-center border-b border-gray-100">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>

              <div className="w-13 h-13 rounded-full bg-[#E46254] text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-[#E46254]/20">
                <Users size={22} />
              </div>

              <h3 className="text-[17px] font-bold text-gray-900 tracking-tight">
                {selectedCustomer.name}
              </h3>

              <div className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-50 border border-gray-200/70 px-2 py-0.5 rounded-md mt-1.5">
                <Lock size={10} className="text-gray-400" />
                <span>{selectedCustomer.segment}</span>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 slim-scrollbar text-xs">
              
              {/* Contact Information */}
              <div className="space-y-2">
                <h4 className="text-[11.5px] font-bold text-gray-800">
                  Contact Information
                </h4>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50/70 border border-gray-100 text-gray-600">
                  <Phone size={13} className="text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-gray-400 block font-normal">Phone</span>
                    <span className="text-xs font-semibold text-gray-900">
                      {selectedCustomer.phone || "Not provided"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Statistics */}
              <div className="space-y-2">
                <h4 className="text-[11.5px] font-bold text-gray-800">
                  Order Statistics
                </h4>
                
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 text-center">
                    <div className="w-6 h-6 rounded-lg bg-[#E46254]/10 text-[#E46254] flex items-center justify-center mx-auto mb-1.5">
                      <Receipt size={12} />
                    </div>
                    <span className="text-[10px] text-gray-400 block">Total Orders</span>
                    <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                      {selectedCustomer.totalVisits}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 text-center">
                    <div className="w-6 h-6 rounded-lg bg-[#E46254]/10 text-[#E46254] flex items-center justify-center mx-auto mb-1.5">
                      <IndianRupee size={12} />
                    </div>
                    <span className="text-[10px] text-gray-400 block">Total Spent</span>
                    <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                      ₹{selectedCustomer.totalSpend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 text-center">
                    <div className="w-6 h-6 rounded-lg bg-[#E46254]/10 text-[#E46254] flex items-center justify-center mx-auto mb-1.5">
                      <Percent size={12} />
                    </div>
                    <span className="text-[10px] text-gray-400 block">Avg Order</span>
                    <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                      ₹{selectedCustomer.avgOrderValue.toFixed(0)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-center">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-1.5">
                      <Coins size={12} className="text-amber-600" />
                    </div>
                    <span className="text-[10px] text-gray-400 block">TableTapy Coins</span>
                    <span className="text-[13px] font-bold text-amber-700 tabular-nums">
                      {selectedCustomer.coinsBalance}
                    </span>
                  </div>
                </div>
              </div>

              {/* Visit History & Behavior Score */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <h4 className="text-[11.5px] font-bold text-gray-800">
                    Visit History
                  </h4>
                  <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-100 space-y-2.5">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-normal">First Visit</span>
                      <span className="text-xs font-semibold text-gray-800 tabular-nums">
                        {formatModalDate(selectedCustomer.firstVisit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-normal">Last Visit</span>
                      <span className="text-xs font-semibold text-gray-800 tabular-nums">
                        {formatModalDate(selectedCustomer.lastVisit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-normal">Total Visits</span>
                      <span className="text-xs font-semibold text-gray-800 tabular-nums">
                        {selectedCustomer.totalVisits}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[11.5px] font-bold text-gray-800">
                    Customer Behavior Score
                  </h4>
                  <div className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-100 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Last Visited</span>
                        <span className="text-xs font-bold text-[#E46254] tabular-nums">
                          {selectedCustomer.rfmScore.recency}/5
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block font-normal">
                        How recently they visited
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Visit Frequency</span>
                        <span className="text-xs font-bold text-[#E46254] tabular-nums">
                          {selectedCustomer.rfmScore.frequency}/5
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block font-normal">
                        How often they order
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Spending Level</span>
                        <span className="text-xs font-bold text-[#E46254] tabular-nums">
                          {selectedCustomer.rfmScore.spending}/5
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 block font-normal">
                        How much they spend
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white font-medium text-xs hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
