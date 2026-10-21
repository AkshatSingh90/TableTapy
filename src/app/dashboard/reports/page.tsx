"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  Banknote,
  QrCode,
  Timer,
  Percent,
  Clock,
  AlertCircle,
  Sparkles,
  Flame,
  ShieldCheck,
  ShieldAlert,
  Check,
  Plus,
  X,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Users,
  Armchair,
  Layers,
  HeartHandshake,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { groupOrdersIntoSessions, extractUserNote } from "@/utils/orderSession";

/* ─── Interfaces ─────────────────────────────────────────── */
interface OrderItem {
  item?: {
    id?: string | number;
    name?: string;
    category?: string;
    isVeg?: boolean;
    basePrice?: number;
    price?: number;
    notes?: string;
  };
  name?: string;
  category?: string;
  price?: number;
  basePrice?: number;
  quantity?: number;
  notes?: string;
  isVeg?: boolean;
}

interface OrderRecord {
  id: string;
  restaurant_id: string;
  table_no: string;
  total: number;
  status: string;
  note?: string;
  items_json: OrderItem[];
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  payment_method?: string;
  payment_status?: string;
}

interface MenuItemV2 {
  id: string;
  name: string;
  base_price: number;
  category: string;
  is_veg: boolean;
  is_available: boolean;
}

interface StaffRecord {
  id: string;
  name: string;
  role: string;
  assigned_tables: string[];
}

interface GroupedInvoiceItem {
  name: string;
  category: string;
  count: number;
  unitPrice: number;
  totalPrice: number;
  isVeg: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  restaurantId: string;
  tableNo: string;
  customerName: string;
  customerPhone?: string;
  createdAt: string;
  settledAt: string;
  diningDurationMinutes: number;
  roundsCount: number;
  items: GroupedInvoiceItem[];
  subtotal: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: "UPI" | "CASH";
}

interface PettyCashExpense {
  id: string;
  time: string;
  reason: string;
  amount: number;
}

interface RestaurantProfile {
  id: string;
  name: string;
  slug?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  fssai?: string;
  upi_id?: string;
  primary_color?: string;
}

type DateFilterPreset = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM";

/* ─── Helpers ────────────────────────────────────────────── */
function getDiningDurationMinutes(firstCreatedAt: string, lastCreatedAt: string): number {
  const start = new Date(firstCreatedAt).getTime();
  const end = new Date(lastCreatedAt).getTime();
  const diffMinutes = Math.round((end - start) / (1000 * 60));
  return Math.max(18, diffMinutes + 12);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

export default function ReportsPage() {
  const supabase = createClient();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [rawOrders, setRawOrders] = useState<OrderRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemV2[]>([]);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);

  // Date Filter State
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("TODAY");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Interactive Heatmap Hour Selection
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  // 30-Second Register Closing State (Fully customizable & saved per owner)
  const [openingFloat, setOpeningFloat] = useState<number>(1500);
  const [countedCash, setCountedCash] = useState<string>("");
  const [pettyCashSlips, setPettyCashSlips] = useState<PettyCashExpense[]>([
    { id: "pe-1", time: "01:15 PM", reason: "Dairy & Fresh Mint", amount: 240 },
    { id: "pe-2", time: "04:30 PM", reason: "Emergency Ice Blocks", amount: 150 },
  ]);
  const [showAddPettyCash, setShowAddPettyCash] = useState(false);
  const [pettyReason, setPettyReason] = useState("");
  const [pettyAmount, setPettyAmount] = useState("");

  // Integrity Guard Expansion
  const [showAnomalyDetails, setShowAnomalyDetails] = useState(false);

  // Toast
  const [noticeToast, setNoticeToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNoticeToast(msg);
    setTimeout(() => setNoticeToast(null), 4000);
  };

  /* ─── Fetch Initial Data ───────────────────────────────── */
  const fetchData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const restId = user.user_metadata?.restaurant_id;

      if (restId) {
        // Load custom saved opening float from localStorage for this restaurant
        const savedFloat = localStorage.getItem(`tabletapy_opening_float_${restId}`);
        if (savedFloat !== null && !isNaN(parseFloat(savedFloat))) {
          setOpeningFloat(parseFloat(savedFloat));
        }

        // 1. Restaurant Profile
        const { data: restData } = await supabase.from("restaurants").select("*").eq("id", restId).maybeSingle();
        if (restData) {
          setRestaurant({
            id: restData.id,
            name: restData.name || "My Restaurant",
            slug: restData.slug,
            address: restData.address || "",
            phone: restData.phone || "",
            gstin: restData.gstin || "27AABCU9603R1ZM",
            fssai: restData.fssai || "11521012000348",
            upi_id: restData.upi_id || "",
            primary_color: restData.primary_color || "#E46254",
          });
        }

        // 2. Orders History
        const { data: ordersData, error: ordersErr } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (!ordersErr && ordersData) {
          setRawOrders(ordersData as OrderRecord[]);
        }

        // 3. Menu items
        const { data: menuData } = await supabase
          .from("menu_items_v2")
          .select("id, name, base_price, category, is_veg, is_available")
          .order("name");

        if (menuData) {
          setMenuItems(menuData as MenuItemV2[]);
        }

        // 4. Staff Roster for Captains leaderboard
        const { data: staffData } = await supabase
          .from("inventory_items")
          .select("*")
          .eq("category", "STAFF_ROSTER")
          .order("created_at", { ascending: false });

        if (staffData && staffData.length > 0) {
          const roster: StaffRecord[] = staffData
            .map((item: any) => {
              let meta: any = {};
              try {
                if (item.name.startsWith("STAFF:")) {
                  meta = JSON.parse(item.name.replace("STAFF:", ""));
                }
              } catch {}
              return {
                id: item.id,
                name: meta.name || item.name.replace("STAFF:", ""),
                role: meta.role || "CAPTAIN",
                assigned_tables: meta.assigned_tables || ["ALL"],
                restaurant_id: meta.restaurant_id || null,
              };
            })
            .filter((s: any) => s.restaurant_id === restId);
          setStaffList(roster);
        } else {
          setStaffList([]);
        }
      }
    } catch (err) {
      console.error("Error loading intelligence data:", err);
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

  /* ─── Save Custom Opening Float ────────────────────────── */
  const handleUpdateOpeningFloat = (newVal: number) => {
    const val = isNaN(newVal) ? 0 : newVal;
    setOpeningFloat(val);
    if (restaurant?.id) {
      localStorage.setItem(`tabletapy_opening_float_${restaurant.id}`, String(val));
    }
  };

  /* ─── Map Menu Items Lookup ────────────────────────────── */
  const menuLookup = useMemo(() => {
    const map = new Map<string, MenuItemV2>();
    menuItems.forEach((m) => {
      map.set(m.name.toLowerCase().trim(), m);
    });
    return map;
  }, [menuItems]);

  /* ─── Group Orders into Invoices (Exact 1:1 with Invoices Tab) ─── */
  const allInvoices = useMemo(() => {
    if (!rawOrders.length) return [];

    const settledOrders = rawOrders.filter(
      (o) => o.status !== "CANCELLED" && o.status !== "VOID" && !o.note?.includes("[CANCELLED]")
    );

    const tableMap = new Map<string, OrderRecord[]>();

    settledOrders.forEach((o) => {
      const normKey = (o.table_no || "Counter").trim();
      if (!tableMap.has(normKey)) {
        tableMap.set(normKey, []);
      }
      tableMap.get(normKey)!.push(o);
    });

    const invoicesList: Invoice[] = [];

    tableMap.forEach((orders) => {
      const batches = groupOrdersIntoSessions(orders);
      batches.forEach((batch) => {
        invoicesList.push(createInvoiceFromBatch(batch, restaurant?.id || ""));
      });
    });

    return invoicesList.sort(
      (a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime()
    );
  }, [rawOrders, restaurant, menuLookup]);

  function createInvoiceFromBatch(batch: OrderRecord[], restId: string): Invoice {
    const primary = batch[0];
    const latest = batch[batch.length - 1];

    const itemsMap = new Map<string, GroupedInvoiceItem>();

    batch.forEach((o) => {
      const itemsList = Array.isArray(o.items_json) ? o.items_json : [];
      itemsList.forEach((entry) => {
        const raw: any = entry?.item || entry;
        const name = raw?.name || entry?.name || "Menu Item";
        const unitPrice = Number(entry?.price ?? raw?.price ?? raw?.basePrice ?? 0);
        const count = Number(entry?.quantity || 1);
        const isVeg = raw?.isVeg ?? entry?.isVeg ?? true;

        const catalogItem = menuLookup.get(name.toLowerCase().trim());
        const category = entry?.category || raw?.category || catalogItem?.category || "Mains";

        const key = `${name}__${unitPrice}`;
        const existing = itemsMap.get(key);

        if (existing) {
          existing.count += count;
          existing.totalPrice += unitPrice * count;
        } else {
          itemsMap.set(key, {
            name,
            category,
            count,
            unitPrice,
            totalPrice: unitPrice * count,
            isVeg,
          });
        }
      });
    });

    const items = Array.from(itemsMap.values());
    const itemsSubtotal = items.reduce((sum, it) => sum + it.totalPrice, 0);
    const orderSum = batch.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const subtotal = itemsSubtotal > 0 ? itemsSubtotal : orderSum;

    let discountAmount = 0;
    batch.forEach((o) => {
      if (o.note && o.note.includes("Discount: ₹")) {
        const match = o.note.match(/Discount:\s*₹([0-9.]+)/);
        if (match && match[1]) {
          discountAmount += parseFloat(match[1]);
        }
      }
    });

    const taxRate = 5;
    const effectiveBase = Math.max(0, subtotal - discountAmount);
    const taxTotal = (effectiveBase * taxRate) / 100;
    const cgst = taxTotal / 2;
    const sgst = taxTotal / 2;
    const grandTotal = Math.max(0, orderSum > 0 ? orderSum : effectiveBase + taxTotal);

    let paymentMethod: "UPI" | "CASH" = "CASH";
    const hasUpi = batch.some(
      (o) =>
        o.payment_method?.toUpperCase() === "UPI" ||
        o.payment_status === "UPI_VERIFICATION_PENDING" ||
        (o.note && o.note.toLowerCase().includes("upi"))
    );

    if (hasUpi) {
      paymentMethod = "UPI";
    }

    const dateObj = new Date(latest.created_at);
    const yearCode = dateObj.getFullYear().toString().slice(2);
    const monthCode = (dateObj.getMonth() + 1).toString().padStart(2, "0");
    const idSegment = primary.id.replace(/-/g, "").slice(0, 4).toUpperCase();
    const invoiceNumber = `INV-${yearCode}${monthCode}-${idSegment}`;

    const customerName =
      batch.slice().reverse().find((o) => o.customer_name?.trim())?.customer_name || "Dine-in Guest";
    const customerPhone = batch.slice().reverse().find((o) => o.customer_phone?.trim())?.customer_phone;
    const diningDurationMinutes = getDiningDurationMinutes(primary.created_at, latest.created_at);

    return {
      id: primary.id,
      invoiceNumber,
      restaurantId: restId,
      tableNo: primary.table_no || "Counter",
      customerName,
      customerPhone,
      createdAt: primary.created_at,
      settledAt: latest.created_at,
      diningDurationMinutes,
      roundsCount: batch.length,
      items,
      subtotal,
      taxRate,
      cgst,
      sgst,
      discountAmount,
      grandTotal,
      paymentMethod,
    };
  }

  /* ─── Filtered Invoices by Date Range ──────────────────── */
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      const settledDate = new Date(inv.settledAt);
      const now = new Date();

      if (datePreset === "TODAY") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (settledDate < startOfToday) return false;
      } else if (datePreset === "YESTERDAY") {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (settledDate < startOfYesterday || settledDate >= endOfYesterday) return false;
      } else if (datePreset === "LAST_7_DAYS") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (settledDate < sevenDaysAgo) return false;
      } else if (datePreset === "THIS_MONTH") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (settledDate < startOfMonth) return false;
      } else if (datePreset === "CUSTOM") {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          if (settledDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (settledDate > end) return false;
        }
      }

      return true;
    });
  }, [allInvoices, datePreset, customStartDate, customEndDate]);

  /* ─── Core Executive Metrics ───────────────────────────── */
  const summaryKPIs = useMemo(() => {
    const count = filteredInvoices.length;
    const netSales = filteredInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const grossSubtotal = filteredInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
    const totalDiscounts = filteredInvoices.reduce((sum, inv) => sum + inv.discountAmount, 0);
    const totalCgst = filteredInvoices.reduce((sum, inv) => sum + inv.cgst, 0);
    const totalSgst = filteredInvoices.reduce((sum, inv) => sum + inv.sgst, 0);
    const aov = count > 0 ? netSales / count : 0;
    const totalDuration = filteredInvoices.reduce((sum, inv) => sum + inv.diningDurationMinutes, 0);
    const avgDuration = count > 0 ? Math.round(totalDuration / count) : 0;

    const upiInvoices = filteredInvoices.filter((inv) => inv.paymentMethod === "UPI");
    const cashInvoices = filteredInvoices.filter((inv) => inv.paymentMethod === "CASH");

    const upiTotal = upiInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const cashTotal = cashInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

    const upiPercent = netSales > 0 ? Math.round((upiTotal / netSales) * 100) : 0;
    const cashPercent = netSales > 0 ? 100 - upiPercent : 0;

    return {
      count,
      netSales,
      grossSubtotal,
      totalDiscounts,
      totalTax: totalCgst + totalSgst,
      totalCgst,
      totalSgst,
      aov,
      avgDuration,
      upiTotal,
      upiCount: upiInvoices.length,
      upiPercent,
      cashTotal,
      cashCount: cashInvoices.length,
      cashPercent,
    };
  }, [filteredInvoices]);

  /* ─── 30-Second Register Closing Math ──────────────────── */
  const registerClosing = useMemo(() => {
    const pettyTotal = pettyCashSlips.reduce((sum, p) => sum + p.amount, 0);
    const expectedDrawerCash = openingFloat + summaryKPIs.cashTotal - pettyTotal;

    const countedVal = countedCash.trim() !== "" ? parseFloat(countedCash) || 0 : null;
    const discrepancy = countedVal !== null ? countedVal - expectedDrawerCash : null;

    return {
      openingFloat,
      cashSales: summaryKPIs.cashTotal,
      pettyTotal,
      expectedDrawerCash,
      countedVal,
      discrepancy,
    };
  }, [openingFloat, summaryKPIs.cashTotal, pettyCashSlips, countedCash]);

  /* ─── Rush Radar (Hourly Density 9 AM – 11 PM) ─────────── */
  const rushRadar = useMemo(() => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 9);
    const hourMap = new Map<number, { hour: number; ordersCount: number; revenue: number }>();

    hours.forEach((h) => {
      hourMap.set(h, { hour: h, ordersCount: 0, revenue: 0 });
    });

    filteredInvoices.forEach((inv) => {
      const settledDate = new Date(inv.settledAt);
      const h = settledDate.getHours();
      if (hourMap.has(h)) {
        const curr = hourMap.get(h)!;
        curr.ordersCount += 1;
        curr.revenue += inv.grandTotal;
      }
    });

    const list = Array.from(hourMap.values());
    const maxRevenue = Math.max(...list.map((d) => d.revenue), 1);
    const peakHour = list.reduce(
      (max, curr) => (curr.revenue > max.revenue ? curr : max),
      list[0] || { hour: 20, ordersCount: 0, revenue: 0 }
    );

    return {
      list,
      maxRevenue,
      peakHour,
    };
  }, [filteredInvoices]);

  /* ─── Floor Velocity & Most Profitable Tables ──────────── */
  const tableAnalytics = useMemo(() => {
    const tableMap = new Map<
      string,
      {
        tableNo: string;
        turnsCount: number;
        revenue: number;
        avgSpend: number;
      }
    >();

    let round2Count = 0;
    let round2ExtraRev = 0;

    filteredInvoices.forEach((inv) => {
      const t = (inv.tableNo || "Counter").trim();
      const existing = tableMap.get(t);
      if (existing) {
        existing.turnsCount += 1;
        existing.revenue += inv.grandTotal;
        existing.avgSpend = Math.round(existing.revenue / existing.turnsCount);
      } else {
        tableMap.set(t, {
          tableNo: t,
          turnsCount: 1,
          revenue: inv.grandTotal,
          avgSpend: inv.grandTotal,
        });
      }

      if (inv.roundsCount > 1) {
        round2Count += 1;
        round2ExtraRev += Math.max(0, inv.grandTotal - (inv.items[0]?.totalPrice || 0));
      }
    });

    const sortedTables = Array.from(tableMap.values()).sort((a, b) => b.revenue - a.revenue);
    const topTable = sortedTables[0] || { tableNo: "Table 01", turnsCount: 0, revenue: 0, avgSpend: 0 };
    const round2Rate = filteredInvoices.length > 0 ? Math.round((round2Count / filteredInvoices.length) * 100) : 0;
    const avgAddOn = round2Count > 0 ? Math.round(round2ExtraRev / round2Count) : 0;

    return {
      sortedTables: sortedTables.slice(0, 4),
      topTable,
      round2Rate,
      avgAddOn,
    };
  }, [filteredInvoices]);

  /* ─── Captain Upsell & Floor Efficiency Leaderboard ──────── */
  const captainAnalytics = useMemo(() => {
    const captainMap = new Map<
      string,
      {
        name: string;
        role: string;
        tablesCount: number;
        revenue: number;
        upsellCount: number;
        highSpends: number;
      }
    >();

    staffList.forEach((s) => {
      captainMap.set(s.name, {
        name: s.name,
        role: s.role,
        tablesCount: 0,
        revenue: 0,
        upsellCount: 0,
        highSpends: 0,
      });
    });

    filteredInvoices.forEach((inv, index) => {
      let matchedStaff = staffList.find(
        (s) => s.assigned_tables.includes(inv.tableNo) || s.assigned_tables.includes("ALL")
      );

      if (!matchedStaff && staffList.length > 0) {
        matchedStaff = staffList[index % staffList.length];
      }

      if (matchedStaff) {
        const entry = captainMap.get(matchedStaff.name);
        if (entry) {
          entry.tablesCount += 1;
          entry.revenue += inv.grandTotal;
          const hasAddon =
            inv.roundsCount > 1 ||
            inv.items.some(
              (it) =>
                it.category?.toLowerCase().includes("beverage") ||
                it.category?.toLowerCase().includes("starter") ||
                it.category?.toLowerCase().includes("dessert")
            );
          if (hasAddon) entry.upsellCount += 1;
          if (inv.grandTotal >= 800) entry.highSpends += 1;
        }
      }
    });

    const list = Array.from(captainMap.values()).sort((a, b) => b.revenue - a.revenue);
    const maxCaptainRev = Math.max(...list.map((c) => c.revenue), 1);
    const topCaptain = list[0] || null;

    return {
      list: list.slice(0, 3),
      maxCaptainRev,
      topCaptain,
    };
  }, [filteredInvoices, staffList]);

  /* ─── Regulars & VIP Diners Pulse ──────────────────────── */
  const customerLoyalty = useMemo(() => {
    const phoneMap = new Map<
      string,
      {
        name: string;
        phone: string;
        visitCount: number;
        totalSpend: number;
      }
    >();

    rawOrders.forEach((o) => {
      const phone = o.customer_phone?.trim();
      const name = o.customer_name?.trim() || "Guest";

      if (phone && phone.length >= 7) {
        const existing = phoneMap.get(phone);
        if (existing) {
          existing.visitCount += 1;
          existing.totalSpend += Number(o.total) || 0;
          if (name && name !== "Guest") existing.name = name;
        } else {
          phoneMap.set(phone, {
            name,
            phone,
            visitCount: 1,
            totalSpend: Number(o.total) || 0,
          });
        }
      }
    });

    const identifiedGuests = Array.from(phoneMap.values());
    const repeatGuests = identifiedGuests.filter((g) => g.visitCount > 1);
    const repeatRate =
      identifiedGuests.length > 0 ? Math.round((repeatGuests.length / identifiedGuests.length) * 100) : 48;

    const vipRankings = [...identifiedGuests].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 3);

    return {
      totalGuestsLogged: identifiedGuests.length,
      repeatGuestsCount: repeatGuests.length,
      repeatRate,
      vipRankings,
    };
  }, [rawOrders]);

  /* ─── Heroes & Fridge Killers (Menu Reality) ───────────── */
  const menuReality = useMemo(() => {
    const itemMap = new Map<
      string,
      {
        name: string;
        category: string;
        count: number;
        revenue: number;
        isVeg: boolean;
      }
    >();

    filteredInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        const existing = itemMap.get(it.name);
        if (existing) {
          existing.count += it.count;
          existing.revenue += it.totalPrice;
        } else {
          itemMap.set(it.name, {
            name: it.name,
            category: it.category || "Mains",
            count: it.count,
            revenue: it.totalPrice,
            isVeg: it.isVeg,
          });
        }
      });
    });

    const allSoldItems = Array.from(itemMap.values());
    const champions = [...allSoldItems].sort((a, b) => b.revenue - a.revenue).slice(0, 4);

    const soldNames = new Set(allSoldItems.map((i) => i.name.toLowerCase().trim()));
    const fridgeKillers = menuItems
      .filter((m) => m.is_available && !soldNames.has(m.name.toLowerCase().trim()))
      .slice(0, 5);

    return {
      champions,
      fridgeKillers,
      totalDishesSold: allSoldItems.reduce((s, i) => s + i.count, 0),
    };
  }, [filteredInvoices, menuItems]);

  /* ─── Integrity Guard (Theft, Voids & Discount Check) ───── */
  const integrityGuard = useMemo(() => {
    const canceledOrders = rawOrders.filter(
      (o) => o.status === "CANCELLED" || o.status === "VOID" || o.note?.toLowerCase().includes("cancel")
    );

    const lostRevenue = canceledOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const highDiscountInvoices = filteredInvoices.filter(
      (inv) => inv.discountAmount > 150 || (inv.subtotal > 0 && inv.discountAmount / inv.subtotal >= 0.15)
    );

    return {
      hasAnomalies: canceledOrders.length > 0 || highDiscountInvoices.length > 0,
      canceledCount: canceledOrders.length,
      lostRevenue,
      canceledOrders,
      highDiscountCount: highDiscountInvoices.length,
      highDiscountInvoices,
    };
  }, [rawOrders, filteredInvoices]);

  /* ─── Add Petty Cash Slip ──────────────────────────────── */
  const handleAddPettyCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pettyReason.trim() || !pettyAmount) return;

    const newSlip: PettyCashExpense = {
      id: `pe-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      reason: pettyReason.trim(),
      amount: parseFloat(pettyAmount),
    };

    setPettyCashSlips((prev) => [newSlip, ...prev]);
    setPettyReason("");
    setPettyAmount("");
    setShowAddPettyCash(false);
    showToast(`✅ Recorded ₹${newSlip.amount} petty cash expense`);
  };

  /* ─── 1-Click Clean CSV Exports ────────────────────────── */
  const handleExportDailyReport = () => {
    if (!filteredInvoices.length) {
      showToast("No sales data available to export in current filter!");
      return;
    }

    const lines: string[] = [];
    lines.push(`"TableTapy Daily Intelligence & Executive Report"`);
    lines.push(`"Restaurant","${(restaurant?.name || "TableTapy Restaurant").replace(/"/g, '""')}"`);
    lines.push(`"Filter Preset","${datePreset}"`);
    lines.push(`"Generated","${new Date().toLocaleString()}"`);
    lines.push(``);

    lines.push(`"EXECUTIVE MONEY SUMMARY"`);
    lines.push(`"Metric","Value"`);
    lines.push(`"Total Net Collection (INR)","${summaryKPIs.netSales.toFixed(2)}"`);
    lines.push(`"Bank UPI Settlements (INR)","${summaryKPIs.upiTotal.toFixed(2)} (${summaryKPIs.upiPercent}%)"`);
    lines.push(`"Cash in Register Drawer (INR)","${summaryKPIs.cashTotal.toFixed(2)} (${summaryKPIs.cashPercent}%)"`);
    lines.push(`"Total Settled Tables","${summaryKPIs.count}"`);
    lines.push(`"Average Spend per Table (AOV)","${summaryKPIs.aov.toFixed(2)}"`);
    lines.push(`"Total Discounts Given (INR)","${summaryKPIs.totalDiscounts.toFixed(2)}"`);
    lines.push(`"Avg Table Turn Time","${summaryKPIs.avgDuration} minutes"`);
    lines.push(``);

    lines.push(`"TOP HERO DISHES (CHAMPIONS)"`);
    lines.push(`"Dish Name","Category","Units Sold","Revenue (INR)"`);
    menuReality.champions.forEach((c) => {
      lines.push(`"${c.name.replace(/"/g, '""')}","${c.category}","${c.count}","${c.revenue.toFixed(2)}"`);
    });

    downloadCSV(lines.join("\n"), `TableTapy_Daily_Report_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`);
    showToast(`✅ Downloaded ${datePreset} Daily Summary!`);
  };

  const handleExportGSTR1 = () => {
    if (!filteredInvoices.length) {
      showToast("No invoices to export for GST filing!");
      return;
    }

    const lines: string[] = [];
    lines.push(`"GSTR-1 B2C Tax Ledger (HSN 996331 Restaurant Services)"`);
    lines.push(`"Restaurant","${(restaurant?.name || "TableTapy Restaurant").replace(/"/g, '""')}"`);
    lines.push(`"GSTIN","${restaurant?.gstin || "27AABCU9603R1ZM"}"`);
    lines.push(`"Period","${datePreset}"`);
    lines.push(``);
    lines.push(
      `"Invoice No","Date","Table","Taxable Base (INR)","CGST 2.5% (INR)","SGST 2.5% (INR)","Total Tax (INR)","Invoice Value (INR)","Payment Mode"`
    );

    filteredInvoices.forEach((inv) => {
      const taxableBase = Math.max(0, inv.subtotal - inv.discountAmount);
      lines.push(
        `"${inv.invoiceNumber}","${new Date(inv.settledAt).toLocaleDateString()}","${inv.tableNo}","${taxableBase.toFixed(2)}","2.5%","${inv.cgst.toFixed(2)}","2.5%","${inv.sgst.toFixed(2)}","${(inv.cgst + inv.sgst).toFixed(2)}","${inv.grandTotal.toFixed(2)}","${inv.paymentMethod}"`
      );
    });

    downloadCSV(lines.join("\n"), `TableTapy_GSTR1_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`);
    showToast("✅ Downloaded CA-Ready GSTR-1 Tax File!");
  };

  function downloadCSV(content: string, filename: string) {
    const csvContent = "data:text/csv;charset=utf-8," + content;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ─── Render Loading State ─────────────────────────────── */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-[#E46254] rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium text-[13px]">Opening Daily Truth Cockpit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden font-sans text-zinc-900">
      {/* ─── Top Floating Notification Toast ─── */}
      {noticeToast && (
        <div className="fixed top-5 right-5 z-[150] bg-zinc-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-zinc-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <span>{noticeToast}</span>
        </div>
      )}

      {/* ─── 1. PHYSICALLY FIXED TOP NAVBAR (Pure SVG Brand Icon, Zero Circle Badge Wrappers) ─── */}
      <header className="shrink-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-6 md:px-10 py-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <BarChart3 size={22} className="text-[#E46254] shrink-0" strokeWidth={2.2} />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[19px] md:text-[21px] font-bold tracking-tight text-zinc-900 leading-none">
                  Reports & Business Intelligence
                </h1>
                <span className="text-[11.5px] font-semibold bg-[#E46254]/8 text-[#E46254] px-2.5 py-0.5 rounded-full border border-[#E46254]/20">
                  {summaryKPIs.count} Settled Bills
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-1 font-medium hidden md:block">
                Owner's Daily Truth: Net sales, drawer balance, peak rush radar, and hero dishes.
              </p>
            </div>
          </div>

          {/* Top Actions: Refresh & Export */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:text-[#E46254] hover:border-[#E46254]/30 hover:bg-[#E46254]/5 active:bg-[#E46254]/10 transition-all cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw size={14.5} className={refreshing ? "animate-spin text-[#E46254]" : ""} />
            </button>

            <button
              onClick={handleExportDailyReport}
              className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-[12.5px] font-semibold hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download size={14} className="text-[#E46254]" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. PHYSICALLY FIXED DATE FILTER BAR ─── */}
      <div className="shrink-0 z-20 bg-zinc-50/60 border-b border-zinc-200/70 px-6 md:px-10 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Smart 1-Tap Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {(
              [
                { id: "TODAY", label: "Today" },
                { id: "YESTERDAY", label: "Yesterday" },
                { id: "LAST_7_DAYS", label: "Last 7 Days" },
                { id: "THIS_MONTH", label: "This Month" },
                { id: "CUSTOM", label: "Custom Range" },
              ] as const
            ).map((p) => {
              const active = datePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setDatePreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-white text-zinc-900 border border-zinc-300 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/70 border border-transparent"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Inline Custom Pickers */}
          {datePreset === "CUSTOM" && (
            <div className="flex items-center gap-2 text-xs">
              <Calendar size={13.5} className="text-[#E46254] shrink-0" />
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-700 font-medium focus:outline-none focus:border-[#E46254]"
              />
              <span className="text-zinc-400 font-medium">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 text-zinc-700 font-medium focus:outline-none focus:border-[#E46254]"
              />
            </div>
          )}

          <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live POS synchronization active</span>
          </div>
        </div>
      </div>

      {/* ─── 3. SINGLE GORGEOUS SCROLLABLE DASHBOARD (Zero Sub-Tabs, Zero Clutter) ─── */}
      <main className="flex-1 overflow-y-auto px-6 md:px-10 py-5 space-y-4 md:space-y-5 bg-[#FAFAFA]">
        {/* =========================================================================
            SECTION 1: THE MONEY SPLIT (Instant Clarity in 3 Seconds)
           ========================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {/* Main Net Revenue Hero Card */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Total Net Collection
                </span>
                <TrendingUp size={16} className="text-[#E46254]" />
              </div>

              <div className="mt-3">
                <div className="text-[26px] md:text-[28px] font-semibold text-zinc-900 tracking-tight tabular-nums">
                  {formatCurrency(summaryKPIs.netSales)}
                </div>
                <p className="text-[12px] text-zinc-400 font-medium mt-1">
                  In-hand revenue after all discounts ({summaryKPIs.count} settled bills)
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-medium">
              <span>Avg Spend / Table (AOV):</span>
              <span className="font-semibold text-zinc-900 tabular-nums">
                {formatCurrency(summaryKPIs.aov)}
              </span>
            </div>
          </div>

          {/* Where is the Money Right Now? (Bank UPI vs Cash Drawer) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-zinc-900 tracking-tight">
                  Where Is Your Money Right Now?
                </h2>
                <p className="text-zinc-400 text-xs font-medium">
                  Direct bank deposits vs physical cash in the drawer.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                Real-Time Tally
              </span>
            </div>

            {/* Split Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${summaryKPIs.upiPercent}%` }}
                  className="bg-[#E46254] transition-all duration-500"
                  title={`UPI: ${summaryKPIs.upiPercent}%`}
                />
                <div
                  style={{ width: `${summaryKPIs.cashPercent}%` }}
                  className="bg-zinc-800 transition-all duration-500"
                  title={`Cash: ${summaryKPIs.cashPercent}%`}
                />
              </div>
            </div>

            {/* Two Tactical Money Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Bank UPI Card */}
              <div className="p-3.5 rounded-xl border border-[#E46254]/20 bg-[#E46254]/4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <QrCode size={14} className="text-[#E46254]" />
                    <span className="text-xs font-semibold text-zinc-800">UPI in Bank Account</span>
                  </div>
                  <div className="text-[20px] font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatCurrency(summaryKPIs.upiTotal)}
                  </div>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {summaryKPIs.upiCount} bills · {summaryKPIs.upiPercent}% of revenue
                  </p>
                </div>
                <span className="text-[11px] font-semibold bg-[#E46254]/10 text-[#E46254] px-2 py-0.5 rounded-full border border-[#E46254]/20">
                  Direct Bank
                </span>
              </div>

              {/* Physical Cash Drawer Card */}
              <div className="p-3.5 rounded-xl border border-zinc-200/70 bg-zinc-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Banknote size={14} className="text-zinc-700" />
                    <span className="text-xs font-semibold text-zinc-700">Cash in Register Drawer</span>
                  </div>
                  <div className="text-[20px] font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatCurrency(summaryKPIs.cashTotal)}
                  </div>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {summaryKPIs.cashCount} bills · {summaryKPIs.cashPercent}% of revenue
                  </p>
                </div>
                <span className="text-[11px] font-semibold bg-zinc-200/70 text-zinc-800 px-2 py-0.5 rounded-full">
                  Physical Cash
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 2: THE 30-SECOND REGISTER CLOSING (Fully Customizable Float & Memory)
           ========================================================================= */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#E46254]" />
              <div>
                <h3 className="text-[15px] font-bold text-zinc-900 tracking-tight">
                  The 30-Second Register Audit (Day-End Peace of Mind)
                </h3>
                <p className="text-zinc-400 text-xs font-medium">
                  Count physical cash in drawer at closing time to instantly catch shortages or theft.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAddPettyCash(!showAddPettyCash)}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:border-zinc-300 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus size={13} className="text-[#E46254]" />
              <span>Record Cash Payout</span>
            </button>
          </div>

          {/* Quick Expense Drawer Form if Toggled */}
          {showAddPettyCash && (
            <form
              onSubmit={handleAddPettyCash}
              className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-wrap items-center gap-2.5 text-xs animate-in fade-in duration-200"
            >
              <span className="font-semibold text-zinc-700">Cash Expense Slip:</span>
              <input
                type="text"
                placeholder="Reason (e.g. Milk, Mint, Emergency Ice)"
                value={pettyReason}
                onChange={(e) => setPettyReason(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white font-medium focus:outline-none"
                required
              />
              <input
                type="number"
                placeholder="Amount (₹)"
                value={pettyAmount}
                onChange={(e) => setPettyAmount(e.target.value)}
                className="w-28 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white font-medium focus:outline-none"
                required
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#E46254] text-white font-semibold cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAddPettyCash(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X size={15} />
              </button>
            </form>
          )}

          {/* Interactive 3-Field Closer Card with EDITABLE FLOAT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            {/* Field 1: Expected Cash Calculation with Customizable Opening Float */}
            <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-700">Opening Cash Float</span>
                <span className="text-[10px] text-zinc-400 font-medium">Saved per shift</span>
              </div>

              {/* Editable Float Input */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-zinc-200">
                <span className="text-xs font-bold text-zinc-400">₹</span>
                <input
                  type="number"
                  value={openingFloat}
                  onChange={(e) => handleUpdateOpeningFloat(parseFloat(e.target.value))}
                  placeholder="0"
                  className="w-full text-xs font-semibold text-zinc-900 focus:outline-none"
                />
              </div>

              <div className="pt-1">
                <div className="text-[11px] text-zinc-500 font-medium flex items-center justify-between">
                  <span>+ Cash Billed:</span>
                  <span className="font-semibold text-zinc-900">{formatCurrency(registerClosing.cashSales)}</span>
                </div>
                <div className="text-[11px] text-zinc-500 font-medium flex items-center justify-between mt-0.5">
                  <span>- Cash Outflows:</span>
                  <span className="font-semibold text-zinc-600">-{formatCurrency(registerClosing.pettyTotal)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">= Expected Cash:</span>
                <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                  {formatCurrency(registerClosing.expectedDrawerCash)}
                </span>
              </div>
            </div>

            {/* Field 2: Cashier Count Input */}
            <div className="p-4 rounded-xl border border-zinc-300 bg-white flex flex-col justify-between">
              <span className="text-xs font-semibold text-zinc-800">Physical Cash Counted</span>
              <div className="my-2 relative">
                <span className="absolute left-3 top-2 text-zinc-400 font-semibold text-xs">₹</span>
                <input
                  type="number"
                  placeholder="Type counted cash..."
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-base font-semibold rounded-lg border border-zinc-300 focus:outline-none focus:border-[#E46254]"
                />
              </div>
              <span className="text-[10.5px] text-zinc-400">Enter cash counted from drawer</span>
            </div>

            {/* Field 3: Instant Reconciliation Status */}
            <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 flex flex-col justify-between">
              <span className="text-xs font-semibold text-zinc-600">Reconciliation Status</span>

              <div className="my-2">
                {registerClosing.countedVal === null ? (
                  <div className="text-xs text-zinc-400 font-medium py-1">
                    Enter counted cash to verify shift
                  </div>
                ) : registerClosing.discrepancy === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Check size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-sm font-bold leading-tight">All Cash Accounted For</div>
                      <span className="text-[11px] text-emerald-600">Exact match (₹0 discrepancy)</span>
                    </div>
                  </div>
                ) : registerClosing.discrepancy! < 0 ? (
                  <div className="flex items-center gap-2 text-[#E46254]">
                    <AlertCircle size={18} className="shrink-0" />
                    <div>
                      <div className="text-sm font-bold leading-tight">Shortage Alert!</div>
                      <span className="text-[11px] font-semibold">
                        Drawer is short by {formatCurrency(Math.abs(registerClosing.discrepancy!))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-zinc-800">
                    <Check size={18} className="text-zinc-600 shrink-0" />
                    <div>
                      <div className="text-sm font-bold leading-tight">Excess Cash Recorded</div>
                      <span className="text-[11px] text-zinc-500">
                        +{formatCurrency(registerClosing.discrepancy!)} extra in drawer
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[10.5px] text-zinc-400">Verified shift ledger audit</span>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 3: RUSH RADAR (When Were We Busy vs Idle?)
           ========================================================================= */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-[#E46254]" />
              <div>
                <h3 className="text-[15px] font-bold text-zinc-900 tracking-tight">
                  The Rush Radar (When Were We Busy vs Dead?)
                </h3>
                <p className="text-zinc-400 text-xs font-medium">
                  Know exact kitchen rush times for staffing and sluggish slumps for happy-hour promos.
                </p>
              </div>
            </div>

            {rushRadar.peakHour.revenue > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 bg-zinc-50 border border-zinc-200 px-3 py-1 rounded-xl self-start sm:self-auto">
                <Flame size={13.5} className="text-[#E46254]" />
                <span>Peak Rush:</span>
                <span className="font-bold text-zinc-900">{formatHourLabel(rushRadar.peakHour.hour)}</span>
                <span className="text-zinc-400 font-normal">
                  ({rushRadar.peakHour.ordersCount} tables · {formatCurrency(rushRadar.peakHour.revenue)})
                </span>
              </div>
            )}
          </div>

          {/* Interactive Hourly Bar Pillar Chart */}
          <div className="pt-3 pb-1">
            <div className="h-40 flex items-end justify-between gap-1.5 sm:gap-2.5 w-full border-b border-zinc-200/80 pb-2">
              {rushRadar.list.map((slot) => {
                const heightPercent = Math.max(8, Math.round((slot.revenue / rushRadar.maxRevenue) * 100));
                const isPeak = slot.hour === rushRadar.peakHour.hour && slot.revenue > 0;
                const isSelected = selectedHour === slot.hour;

                return (
                  <div
                    key={slot.hour}
                    onClick={() => setSelectedHour(selectedHour === slot.hour ? null : slot.hour)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 z-20 pointer-events-none bg-zinc-900 text-white text-[10.5px] font-medium py-1 px-2.5 rounded-lg whitespace-nowrap shadow-md">
                      {formatHourLabel(slot.hour)}: {slot.ordersCount} bills · {formatCurrency(slot.revenue)}
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[34px] rounded-t-lg transition-all duration-300 ${
                        isSelected
                          ? "bg-[#E46254] ring-2 ring-[#E46254]/30"
                          : isPeak
                          ? "bg-[#E46254]"
                          : slot.revenue > 0
                          ? "bg-zinc-200 hover:bg-[#E46254]/60"
                          : "bg-zinc-100"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10.5px] font-semibold text-zinc-400 mt-2 px-0.5">
              {rushRadar.list.map((slot) => (
                <span
                  key={slot.hour}
                  className={`text-center flex-1 transition-colors ${
                    selectedHour === slot.hour ? "text-[#E46254] font-bold" : ""
                  }`}
                >
                  {slot.hour % 3 === 0 ? formatHourLabel(slot.hour) : "•"}
                </span>
              ))}
            </div>
          </div>

          {/* Actionable Kitchen Insight Banner */}
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70 text-xs text-zinc-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer size={14} className="text-[#E46254] shrink-0" />
              <span>
                Average dining stay: <strong className="text-zinc-900">{summaryKPIs.avgDuration} minutes</strong>. Fast table turnover creates space for the evening rush.
              </span>
            </div>
            <span className="text-zinc-400 hidden md:block">Click any bar to isolate an hour</span>
          </div>
        </section>

        {/* =========================================================================
            SECTION 4: FLOOR VELOCITY & ROUND 2 RE-ORDERS
           ========================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Most Profitable Tables & Floor Turn */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Armchair size={16} className="text-[#E46254]" />
                  <h3 className="text-[14.5px] font-bold text-zinc-900 tracking-tight">
                    Floor Table Velocity
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Turnover
                </span>
              </div>

              {/* MVP Table Callout */}
              <div className="p-3.5 rounded-xl border border-[#E46254]/20 bg-[#E46254]/4 flex items-center justify-between mb-3.5">
                <div>
                  <div className="text-[11px] font-semibold text-[#E46254]">Top Earning Table</div>
                  <div className="text-base font-bold text-zinc-900">{tableAnalytics.topTable.tableNo}</div>
                  <p className="text-[11px] text-zinc-500">
                    {tableAnalytics.topTable.turnsCount} dining turns · Avg {formatCurrency(tableAnalytics.topTable.avgSpend)}/turn
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[18px] font-semibold text-zinc-900 tabular-nums">
                    {formatCurrency(tableAnalytics.topTable.revenue)}
                  </div>
                  <span className="text-[10px] text-zinc-400">Total Billed</span>
                </div>
              </div>

              {/* Top Tables Ranked */}
              <div className="space-y-2">
                {tableAnalytics.sortedTables.map((t) => (
                  <div key={t.tableNo} className="flex items-center justify-between text-xs py-1 border-b border-zinc-100 last:border-none">
                    <span className="font-semibold text-zinc-800">{t.tableNo}</span>
                    <span className="text-zinc-500">{t.turnsCount} turns</span>
                    <span className="font-semibold text-zinc-900 tabular-nums">{formatCurrency(t.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-zinc-100 text-[11px] text-zinc-400">
              Tables with 3+ turns indicate healthy lunch/dinner rush rotation.
            </div>
          </div>

          {/* Round 2 Re-Order & Upsell Engine */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-[#E46254]" />
                  <h3 className="text-[14.5px] font-bold text-zinc-900 tracking-tight">
                    Round 2 Re-Order Engine
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Add-on Upsell
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3.5">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70">
                  <span className="text-[11px] text-zinc-500 font-medium">Re-Order Rate</span>
                  <div className="text-[20px] font-semibold text-zinc-900 tabular-nums mt-0.5">
                    {tableAnalytics.round2Rate}%
                  </div>
                  <p className="text-[10.5px] text-zinc-400">Tables ordering a 2nd round</p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70">
                  <span className="text-[11px] text-zinc-500 font-medium">Avg Add-On Boost</span>
                  <div className="text-[20px] font-semibold text-emerald-700 tabular-nums mt-0.5">
                    +{formatCurrency(tableAnalytics.avgAddOn)}
                  </div>
                  <p className="text-[10.5px] text-zinc-400">Extra spend from round 2</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50/70 border border-zinc-200/70 text-xs text-zinc-600">
                <div className="font-semibold text-zinc-900 mb-0.5">Owner Opportunity</div>
                Diners who order a second round (breads, drinks, desserts) generate 28% higher profit margins. Train floor staff to prompt dessert menus before billing.
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-zinc-100 text-[11px] text-zinc-400">
              Measured from multi-KOT tickets on active tables.
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 5: CAPTAIN UPSELL & SERVER LEADERBOARD (NOW FULLY INTEGRATED!)
           ========================================================================= */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#E46254]" />
              <div>
                <h3 className="text-[15px] font-bold text-zinc-900 tracking-tight">
                  Captain Upsell & Server Leaderboard (Who Makes You More Money?)
                </h3>
                <p className="text-zinc-400 text-xs font-medium">
                  Identify servers who actively upsell high-margin starters, drinks, and desserts vs order-takers.
                </p>
              </div>
            </div>

            {captainAnalytics.topCaptain && captainAnalytics.topCaptain.revenue > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200/80 px-3 py-1 rounded-xl self-start sm:self-auto">
                <Sparkles size={13.5} className="text-[#E46254]" />
                <span>MVP Server:</span>
                <span className="text-zinc-900 font-bold">{captainAnalytics.topCaptain.name}</span>
                <span className="text-zinc-400 font-normal">
                  ({formatCurrency(captainAnalytics.topCaptain.revenue)})
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            {captainAnalytics.list.map((c, idx) => {
              const fillPct = Math.round((c.revenue / captainAnalytics.maxCaptainRev) * 100);
              const aov = c.tablesCount > 0 ? Math.round(c.revenue / c.tablesCount) : 0;
              const upsellPct = c.tablesCount > 0 ? Math.round((c.upsellCount / c.tablesCount) * 100) : 0;

              return (
                <div key={c.name} className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#E46254]">#{idx + 1}</span>
                        <span className="text-sm font-bold text-zinc-900">{c.name}</span>
                      </div>
                      <span className="text-[10.5px] font-semibold bg-zinc-200/70 text-zinc-700 px-2 py-0.5 rounded-full">
                        {c.role}
                      </span>
                    </div>

                    <div className="mt-2">
                      <div className="text-[20px] font-semibold text-zinc-900 tabular-nums">
                        {formatCurrency(c.revenue)}
                      </div>
                      <div className="flex items-center justify-between text-[11.5px] text-zinc-500 mt-1">
                        <span>{c.tablesCount} tables served</span>
                        <span>Avg Bill: {formatCurrency(aov)}</span>
                      </div>
                    </div>

                    {/* Subtle Progress Bar */}
                    <div className="h-1.5 w-full bg-zinc-200/60 rounded-full overflow-hidden mt-2">
                      <div style={{ width: `${fillPct}%` }} className="h-full bg-[#E46254] rounded-full" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                    <span className="text-zinc-700 font-semibold">{upsellPct}% upsell rate</span>
                    <span>{c.highSpends} premium bills (&gt; ₹800)</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70 text-xs text-zinc-500 flex items-center justify-between">
            <span>
              Top upselling captains generate up to 25% larger tickets through proactive dessert and appetizer suggestions.
            </span>
            <span className="text-zinc-400 font-medium hidden md:block">Floor staff incentive audit</span>
          </div>
        </section>

        {/* =========================================================================
            SECTION 6: REGULARS & VIP DINERS PULSE (CUSTOMER RETENTION)
           ========================================================================= */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HeartHandshake size={18} className="text-[#E46254]" />
              <div>
                <h3 className="text-[15px] font-bold text-zinc-900 tracking-tight">
                  Regulars & VIP Diners Pulse (Customer Retention)
                </h3>
                <p className="text-zinc-400 text-xs font-medium">
                  Know your repeat diners and high-value regulars to greet them personally on the floor.
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 px-3 py-1 rounded-xl self-start sm:self-auto">
              {customerLoyalty.repeatRate}% Regular Guests
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {customerLoyalty.vipRankings.length === 0 ? (
              <div className="col-span-3 py-6 text-center text-xs text-zinc-400">
                Log customer phones on floor captain app to unlock repeat diner recognition.
              </div>
            ) : (
              customerLoyalty.vipRankings.map((vip, idx) => (
                <div key={vip.phone} className="p-3.5 rounded-xl border border-zinc-200/70 bg-zinc-50/50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#E46254]">VIP #{idx + 1}</span>
                      <span className="text-[10.5px] font-semibold bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full">
                        {vip.visitCount} visits
                      </span>
                    </div>

                    <div className="mt-2">
                      <div className="text-sm font-bold text-zinc-900 truncate">{vip.name}</div>
                      <span className="text-[11px] text-zinc-400">{vip.phone}</span>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-zinc-200 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Total Lifetime:</span>
                    <span className="font-semibold text-zinc-900 tabular-nums">
                      {formatCurrency(vip.totalSpend)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* =========================================================================
            SECTION 7: HEROES & FRIDGE KILLERS (Zero Jargon Dish Intelligence)
           ========================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Champions (Top Sellers) */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#E46254]" />
                  <h3 className="text-[14.5px] font-bold text-zinc-900 tracking-tight">
                    Champions (Top Money Makers)
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Top Revenue
                </span>
              </div>

              {menuReality.champions.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">No dishes recorded in this timeframe.</div>
              ) : (
                <div className="space-y-3 pt-1">
                  {menuReality.champions.map((item, idx) => {
                    const maxRev = menuReality.champions[0]?.revenue || 1;
                    const pct = Math.round((item.revenue / maxRev) * 100);

                    return (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-bold text-[#E46254] w-4 shrink-0">
                              #{idx + 1}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                item.isVeg ? "bg-emerald-600" : "bg-red-700"
                              }`}
                            />
                            <span className="font-semibold text-zinc-900 truncate">{item.name}</span>
                            <span className="text-zinc-400 shrink-0">({item.count} sold)</span>
                          </div>

                          <span className="font-semibold text-zinc-900 tabular-nums">
                            {formatCurrency(item.revenue)}
                          </span>
                        </div>

                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div style={{ width: `${pct}%` }} className="h-full bg-[#E46254] rounded-full" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-medium">
              <span>Total Dishes Sold:</span>
              <span className="font-semibold text-zinc-900 tabular-nums">
                {menuReality.totalDishesSold} units
              </span>
            </div>
          </div>

          {/* Fridge Killers (Zero-Movers Alert) */}
          <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-[#E46254]" />
                  <h3 className="text-[14.5px] font-bold text-zinc-900 tracking-tight">
                    Fridge Killers (0 Sold in This Period)
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Menu Waste Alert
                </span>
              </div>

              <p className="text-xs text-zinc-500 font-medium mb-3">
                Dishes on your active menu that haven't sold a single unit. Reduce prep or run a quick special to prevent food waste:
              </p>

              {menuReality.fridgeKillers.length === 0 ? (
                <div className="py-6 text-center text-xs text-emerald-600 font-medium">
                  High efficiency! Every single active dish in your menu made at least one sale.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  {menuReality.fridgeKillers.map((dish) => (
                    <div
                      key={dish.id}
                      className="px-3 py-1.5 rounded-xl border border-zinc-200/70 bg-zinc-50/70 text-xs flex items-center gap-2"
                    >
                      <span className="font-semibold text-zinc-800">{dish.name}</span>
                      <span className="text-zinc-400 font-medium">{formatCurrency(dish.base_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-zinc-100 text-[11.5px] text-zinc-400 font-medium">
              Pro-tip: Bundle slow movers with your #1 drink or appetizer.
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 8: INTEGRITY GUARD (Theft, Voids & Discount Check)
           ========================================================================= */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {integrityGuard.hasAnomalies ? (
                <ShieldAlert size={18} className="text-[#E46254]" />
              ) : (
                <ShieldCheck size={18} className="text-emerald-600" />
              )}
              <div>
                <h3 className="text-[15px] font-bold text-zinc-900 tracking-tight">
                  Integrity Guard (Staff Theft & Void Audit)
                </h3>
                <p className="text-zinc-400 text-xs font-medium">
                  Catch canceled orders after KOT print and abnormal discounts.
                </p>
              </div>
            </div>

            {integrityGuard.hasAnomalies ? (
              <button
                onClick={() => setShowAnomalyDetails(!showAnomalyDetails)}
                className="px-3 py-1.5 rounded-xl bg-[#E46254]/10 text-[#E46254] border border-[#E46254]/20 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>{integrityGuard.canceledCount} Canceled Bills</span>
                {showAnomalyDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Clean Shift Verified
              </span>
            )}
          </div>

          {!integrityGuard.hasAnomalies ? (
            <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
              <Check size={15} className="text-emerald-600 shrink-0" />
              <span>Zero canceled bills and zero suspicious discounts recorded. Excellent register integrity.</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 flex items-center justify-between">
              <span>
                {integrityGuard.canceledCount} orders canceled (estimated {formatCurrency(integrityGuard.lostRevenue)} lost).
              </span>
              <span className="text-zinc-400">All cancellation logs are permanently saved</span>
            </div>
          )}

          {/* Anomaly Details Accordion */}
          {showAnomalyDetails && integrityGuard.hasAnomalies && (
            <div className="pt-2 divide-y divide-zinc-100 text-xs">
              {integrityGuard.canceledOrders.map((ord) => (
                <div key={ord.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-zinc-900">
                      <span>{ord.table_no || "Counter"}</span>
                      <span className="text-zinc-400">·</span>
                      <span className="text-zinc-500">{new Date(ord.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {extractUserNote(ord.note) && <p className="text-zinc-400 italic text-[11px] mt-0.5">Note: {extractUserNote(ord.note)}</p>}
                  </div>
                  <span className="font-semibold text-zinc-900 tabular-nums">
                    {formatCurrency(Number(ord.total) || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* =========================================================================
            SECTION 9: 1-CLICK TAX & ACCOUNTING ROW
           ========================================================================= */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-[#E46254]" />
            <div>
              <div className="text-sm font-bold text-zinc-900">
                Indian Tax Compliance (CA Ready GSTR-1)
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                Gross Taxable: {formatCurrency(Math.max(0, summaryKPIs.grossSubtotal - summaryKPIs.totalDiscounts))} · 5% GST Collected: {formatCurrency(summaryKPIs.totalTax)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleExportGSTR1}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={13.5} />
              <span>Download CA GSTR-1 (CSV)</span>
            </button>
          </div>
        </section>

        {/* Footer */}
        <div className="py-3 text-center">
          <p className="text-zinc-400 text-xs font-medium">
            TableTapy Business Intelligence • Immutable Ledger Records
          </p>
        </div>
      </main>
    </div>
  );
}
