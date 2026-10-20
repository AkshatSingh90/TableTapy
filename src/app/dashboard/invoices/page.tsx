"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  Search,
  Calendar,
  Printer,
  Download,
  Banknote,
  QrCode,
  X,
  RefreshCw,
  TrendingUp,
  Percent,
  Timer,
  Check,
  ChevronDown,
  Eye,
  User,
  FileText,
  Utensils,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { groupOrdersIntoSessions } from "@/utils/orderSession";

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

interface GroupedInvoiceItem {
  name: string;
  count: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  isVeg?: boolean;
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
  rounds: OrderRecord[];
  items: GroupedInvoiceItem[];
  subtotal: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: "UPI" | "CASH";
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

type DateFilterPreset = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "THIS_MONTH" | "ALL" | "CUSTOM";
type PaymentFilter = "ALL" | "UPI" | "CASH";

export default function InvoicesPage() {
  const supabase = createClient();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [rawOrders, setRawOrders] = useState<OrderRecord[]>([]);

  // Expanded Invoice IDs for horizontal cards dropdown
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("TODAY");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");

  // Selected Invoice for Full Thermal Modal View
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Payment Method Edit State
  const [editingPaymentInvoice, setEditingPaymentInvoice] = useState<Invoice | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  // Toast
  const [noticeToast, setNoticeToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNoticeToast(msg);
    setTimeout(() => setNoticeToast(null), 4000);
  };

  const toggleExpand = (id: string) => {
    setExpandedInvoiceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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

      let restId = user.user_metadata?.restaurant_id;

      if (!restId) {
        const { data: recentOrder } = await supabase
          .from("orders")
          .select("restaurant_id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentOrder?.restaurant_id) {
          restId = recentOrder.restaurant_id;
        } else {
          const { data: firstRest } = await supabase.from("restaurants").select("id").limit(1).maybeSingle();
          if (firstRest) restId = firstRest.id;
        }
      }

      if (restId) {
        const { data: restData } = await supabase.from("restaurants").select("*").eq("id", restId).maybeSingle();
        if (restData) {
          setRestaurant({
            id: restData.id,
            name: restData.name || "My Restaurant",
            slug: restData.slug,
            address: restData.address || "",
            phone: restData.phone || "",
            gstin: restData.gstin || "",
            fssai: restData.fssai || "",
            upi_id: restData.upi_id || "",
            primary_color: restData.primary_color || "#E46254",
          });
        }

        const { data: ordersData, error: ordersErr } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false })
          .limit(600);

        if (!ordersErr && ordersData) {
          setRawOrders(ordersData as OrderRecord[]);
        }
      }
    } catch (err) {
      console.error("Error loading invoice data:", err);
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

  /* ─── Helper: Dining Duration Calculation ─────────────── */
  function getDiningDurationMinutes(startStr: string, endStr: string): number {
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    return Math.max(1, Math.round((end - start) / 60000));
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  /* ─── Group Orders into Invoices ───────────────────────── */
  const allInvoices = useMemo(() => {
    if (!rawOrders.length) return [];

    const tableMap = new Map<string, OrderRecord[]>();

    rawOrders.forEach((o) => {
      const isSettled = (o.payment_status === "PAID" || o.status === "COMPLETED") && o.status !== "CANCELLED";
      if (!isSettled) return;

      const rawKey = (o.table_no || "Counter / Takeaway").trim();
      const normKey = rawKey.toLowerCase();

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
  }, [rawOrders, restaurant]);

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
        const notes = entry?.notes || raw?.notes || "";
        const isVeg = raw?.isVeg ?? entry?.isVeg ?? true;

        const key = `${name}__${unitPrice}__${notes}`;
        const existing = itemsMap.get(key);

        if (existing) {
          existing.count += count;
          existing.totalPrice += unitPrice * count;
        } else {
          itemsMap.set(key, {
            name,
            count,
            unitPrice,
            totalPrice: unitPrice * count,
            notes,
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
      rounds: batch,
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

  /* ─── Date & Search Filtering ──────────────────────────── */
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

      if (paymentFilter !== "ALL" && inv.paymentMethod !== paymentFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesInvoiceNo = inv.invoiceNumber.toLowerCase().includes(q);
        const matchesTable = inv.tableNo.toLowerCase().includes(q);
        const matchesCustomer = inv.customerName.toLowerCase().includes(q);
        const matchesPhone = inv.customerPhone?.toLowerCase().includes(q);
        const matchesItem = inv.items.some((it) => it.name.toLowerCase().includes(q));

        if (!matchesInvoiceNo && !matchesTable && !matchesCustomer && !matchesPhone && !matchesItem) {
          return false;
        }
      }

      return true;
    });
  }, [allInvoices, datePreset, customStartDate, customEndDate, paymentFilter, searchQuery]);

  /* ─── Financial Summary Metrics ────────────────────────── */
  const summaryMetrics = useMemo(() => {
    let totalRevenue = 0;
    let upiRevenue = 0;
    let cashRevenue = 0;
    let totalDiscounts = 0;

    filteredInvoices.forEach((inv) => {
      totalRevenue += inv.grandTotal;
      totalDiscounts += inv.discountAmount;

      if (inv.paymentMethod === "UPI") {
        upiRevenue += inv.grandTotal;
      } else {
        cashRevenue += inv.grandTotal;
      }
    });

    const count = filteredInvoices.length;
    const aov = count > 0 ? totalRevenue / count : 0;
    const upiPercent = totalRevenue > 0 ? (upiRevenue / totalRevenue) * 100 : 0;
    const cashPercent = totalRevenue > 0 ? (cashRevenue / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      upiRevenue,
      cashRevenue,
      totalDiscounts,
      invoiceCount: count,
      aov,
      upiPercent,
      cashPercent,
    };
  }, [filteredInvoices]);

  /* ─── 1-Tap Row Instant Thermal Print ───────────────────── */
  const handleDirectPrint = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  /* ─── Manager Payment Switcher (UPI <-> CASH Only) ─────── */
  const handleUpdatePaymentMethod = async (newMethod: "UPI" | "CASH") => {
    if (!editingPaymentInvoice) return;
    setUpdatingPayment(true);

    try {
      const orderIds = editingPaymentInvoice.rounds.map((r) => r.id);

      const { error } = await supabase
        .from("orders")
        .update({
          payment_method: newMethod,
          payment_status: "PAID",
          note: `[Payment Method updated to ${newMethod}]`,
        })
        .in("id", orderIds);

      if (error) {
        showToast("Error updating payment: " + error.message);
      } else {
        setRawOrders((prev) =>
          prev.map((o) => (orderIds.includes(o.id) ? { ...o, payment_method: newMethod } : o))
        );
        showToast(`✅ Invoice ${editingPaymentInvoice.invoiceNumber} switched to ${newMethod}`);
        setEditingPaymentInvoice(null);
      }
    } catch (err: any) {
      showToast("Failed to update payment: " + err.message);
    } finally {
      setUpdatingPayment(false);
    }
  };

  /* ─── Export Invoices to CSV ───────────────────────────── */
  const handleExportCSV = () => {
    if (!filteredInvoices.length) {
      showToast("No invoices to export in current filter!");
      return;
    }

    const headers = [
      "Invoice Number",
      "Date",
      "Time",
      "Table",
      "Dining Duration (Mins)",
      "Customer Name",
      "Phone",
      "Items Count",
      "Items Summary",
      "Payment Mode",
      "Subtotal (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "Discount (INR)",
      "Grand Total (INR)",
    ];

    const rows = filteredInvoices.map((inv) => {
      const d = new Date(inv.settledAt);
      const dateStr = d.toISOString().slice(0, 10);
      const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const itemsSummary = inv.items.map((it) => `${it.count}x ${it.name}`).join(" | ");

      return [
        `"${inv.invoiceNumber}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${inv.tableNo}"`,
        inv.diningDurationMinutes,
        `"${inv.customerName.replace(/"/g, '""')}"`,
        `"${inv.customerPhone || ""}"`,
        inv.items.reduce((s, it) => s + it.count, 0),
        `"${itemsSummary.replace(/"/g, '""')}"`,
        `"${inv.paymentMethod}"`,
        inv.subtotal.toFixed(2),
        inv.cgst.toFixed(2),
        inv.sgst.toFixed(2),
        inv.discountAmount.toFixed(2),
        inv.grandTotal.toFixed(2),
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Tabletapy_Invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`✅ Exported ${filteredInvoices.length} invoices to CSV!`);
  };

  /* ─── Render Loading State ─────────────────────────────── */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-[#E46254] rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium text-[13px]">Loading settlement records...</p>
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

      {/* ─── 1. PHYSICALLY FIXED TOP NAVBAR (Apple HIG, Direct Brand Icon, Zero Circle Wrappers) ─── */}
      <header className="shrink-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-6 md:px-10 py-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          {/* Header Title with Pure Brand Icon directly beside text (No Circle Boxes) */}
          <div className="flex items-center gap-3">
            <Receipt size={22} className="text-[#E46254] shrink-0" strokeWidth={2.2} />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[19px] md:text-[21px] font-bold tracking-tight text-zinc-900 leading-none">
                  Invoices & Settlement History
                </h1>
                <span className="text-[11.5px] font-semibold bg-[#E46254]/8 text-[#E46254] px-2.5 py-0.5 rounded-full border border-[#E46254]/20">
                  {summaryMetrics.invoiceCount} Settled
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-1 font-medium hidden md:block">
                Review settled dining sessions, view itemized orders, and audit cash vs UPI collections.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:text-[#E46254] hover:border-[#E46254]/30 hover:bg-[#E46254]/5 active:bg-[#E46254]/10 transition-all cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw size={14.5} className={refreshing ? "animate-spin text-[#E46254]" : ""} />
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-[12.5px] font-semibold hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download size={14} className="text-[#E46254]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. PHYSICALLY FIXED CONTROLS BAR (Spacious Metrics + Filter Pills) ─── */}
      <div className="shrink-0 z-20 bg-white border-b border-zinc-100 px-6 md:px-10 py-4 space-y-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        {/* Apple Style Metrics Cards (No Clumsy Colored Boxes, No Bold Chunky Numbers) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Revenue */}
          <div className="bg-white rounded-2xl p-4 md:p-4.5 border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-zinc-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Total Invoiced
              </span>
              <TrendingUp size={16} className="text-[#E46254]" strokeWidth={2.2} />
            </div>
            <div className="text-[19px] md:text-[21px] font-semibold text-zinc-900 tracking-tight tabular-nums leading-tight">
              ₹{summaryMetrics.totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* UPI Collections */}
          <div className="bg-white rounded-2xl p-4 md:p-4.5 border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-zinc-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  UPI Settled
                </span>
                <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200/80">
                  {summaryMetrics.upiPercent.toFixed(0)}%
                </span>
              </div>
              <QrCode size={16} className="text-[#E46254]" strokeWidth={2.2} />
            </div>
            <div className="text-[19px] md:text-[21px] font-semibold text-zinc-900 tracking-tight tabular-nums leading-tight">
              ₹{summaryMetrics.upiRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Cash in Drawer */}
          <div className="bg-white rounded-2xl p-4 md:p-4.5 border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-zinc-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Cash in Drawer
                </span>
                <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200/80">
                  {summaryMetrics.cashPercent.toFixed(0)}%
                </span>
              </div>
              <Banknote size={16} className="text-[#E46254]" strokeWidth={2.2} />
            </div>
            <div className="text-[19px] md:text-[21px] font-semibold text-zinc-900 tracking-tight tabular-nums leading-tight">
              ₹{summaryMetrics.cashRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Avg Bill (AOV) */}
          <div className="bg-white rounded-2xl p-4 md:p-4.5 border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-zinc-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Avg Bill (AOV)
              </span>
              <Percent size={15} className="text-[#E46254]" strokeWidth={2.2} />
            </div>
            <div className="text-[19px] md:text-[21px] font-semibold text-zinc-900 tracking-tight tabular-nums leading-tight">
              ₹{summaryMetrics.aov.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Search & Quick Filter Pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-0.5">
          {/* Live Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
            <input
              type="text"
              placeholder="Search by invoice #, table, customer, phone, or dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-white border border-zinc-200 hover:border-zinc-300 focus:border-[#E46254] focus:ring-2 focus:ring-[#E46254]/10 rounded-xl text-[12.5px] transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date & Payment Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Payment Filter: All, UPI, Cash Only */}
            <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-xl">
              {(["ALL", "UPI", "CASH"] as PaymentFilter[]).map((pf) => (
                <button
                  key={pf}
                  onClick={() => setPaymentFilter(pf)}
                  className={`px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer ${
                    paymentFilter === pf
                      ? "bg-[#E46254]/10 text-[#E46254] border border-[#E46254]/25 font-bold"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {pf === "ALL" ? "All Bills" : pf}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block" />

            {/* Date Preset Filter */}
            <div className="flex items-center gap-1 bg-white border border-zinc-200 p-1 rounded-xl">
              {(
                [
                  { label: "Today", value: "TODAY" },
                  { label: "Yesterday", value: "YESTERDAY" },
                  { label: "7 Days", value: "LAST_7_DAYS" },
                  { label: "Month", value: "THIS_MONTH" },
                  { label: "All", value: "ALL" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setDatePreset(preset.value)}
                  className={`px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer ${
                    datePreset === preset.value
                      ? "bg-zinc-900 text-white font-semibold shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. SCROLLABLE HORIZONTAL CARDS FEED (Spacious & Refined) ─── */}
      <div className="flex-1 overflow-y-auto slim-scrollbar px-6 md:px-10 py-5 space-y-3 pb-28">
        {filteredInvoices.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-2xl border border-zinc-200/80 p-8 shadow-xs">
            <Receipt size={28} className="text-[#E46254] mx-auto mb-3" strokeWidth={1.8} />
            <h3 className="text-[16px] font-bold text-zinc-800">No matching orders found</h3>
            <p className="text-[13px] text-zinc-400 mt-1 max-w-sm mx-auto font-medium">
              {searchQuery || datePreset !== "ALL" || paymentFilter !== "ALL"
                ? "Try adjusting search query or switching date filters above."
                : "Settled dining bills will automatically populate here in real-time."}
            </p>
          </div>
        ) : (
          filteredInvoices.map((inv) => {
            const isExpanded = !!expandedInvoiceIds[inv.id];

            const settledDate = new Date(inv.settledAt);
            const formattedTime = settledDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={inv.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${
                  isExpanded
                    ? "border-[#E46254]/40 ring-2 ring-[#E46254]/10 shadow-sm"
                    : "border-zinc-200/80 hover:border-zinc-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                }`}
              >
                {/* ─── HORIZONTALLY EXTENDED SUMMARY ROW (Spacious, Room to Breathe) ─── */}
                <div
                  onClick={() => toggleExpand(inv.id)}
                  className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 cursor-pointer hover:bg-zinc-50/40 transition-colors select-none"
                >
                  {/* Left: Table, Stay, Invoice # */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Table Pill */}
                    <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-[#E46254]/8 text-[#E46254] border border-[#E46254]/20 shrink-0">
                      {inv.tableNo}
                    </span>

                    {/* Invoice ID */}
                    <span className="font-mono text-xs font-semibold shrink-0 text-zinc-900">
                      {inv.invoiceNumber}
                    </span>

                    {/* Time & Dining Stay Duration */}
                    <div className="flex items-center gap-2 text-[12px] text-zinc-400 font-medium">
                      <span>•</span>
                      <span>{formattedTime}</span>
                      <span className="text-zinc-300">/</span>
                      <span className="flex items-center gap-1 text-zinc-600 font-medium" title="Total stay duration">
                        <Timer size={13} className="text-[#E46254]" />
                        <span>{formatDuration(inv.diningDurationMinutes)} stay</span>
                      </span>
                    </div>
                  </div>

                  {/* Middle: Customer & Food Summary Capsule */}
                  <div className="flex-1 flex items-center gap-2.5 overflow-hidden px-1 md:px-4 text-xs">
                    {/* Customer with Pure SVG Icon */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <User size={13} className="text-[#E46254]" />
                      <span className="font-medium text-zinc-900 truncate max-w-[130px] text-[12.5px]">
                        {inv.customerName}
                      </span>
                    </div>

                    <span className="text-zinc-300 hidden sm:inline">•</span>

                    {/* Dishes summary pill */}
                    <p className="text-zinc-500 truncate text-[12.5px] font-normal hidden sm:block">
                      {inv.items.map((it) => `${it.count}× ${it.name}`).join(", ") || "Dine-in Order"}
                    </p>
                  </div>

                  {/* Right: Payment Pill, Grand Total, View Bill, Print, Chevron */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Payment Mode Pill (Clean Monochrome / Zinc Pill with Pure SVG Icon) */}
                    <button
                      type="button"
                      onClick={() => setEditingPaymentInvoice(inv)}
                      className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 border border-zinc-200"
                      title="Click to switch payment mode"
                    >
                      {inv.paymentMethod === "UPI" ? (
                        <QrCode size={12} className="text-[#E46254]" />
                      ) : (
                        <Banknote size={12} className="text-[#E46254]" />
                      )}
                      <span>{inv.paymentMethod}</span>
                    </button>

                    {/* Total Amount (Clean Apple Typography - Not Harsh Chunky Bold) */}
                    <div className="text-right pl-1">
                      <span className="text-[15.5px] font-semibold tabular-nums block leading-none text-zinc-900 tracking-tight">
                        ₹{inv.grandTotal.toFixed(0)}
                      </span>
                      {inv.discountAmount > 0 && (
                        <span className="text-[10.5px] text-zinc-500 font-medium block leading-none mt-1">
                          -₹{inv.discountAmount.toFixed(0)} discount
                        </span>
                      )}
                    </div>

                    {/* Quick Access: View Bill Button directly on minimized card */}
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-3 py-1.5 rounded-xl border border-zinc-200/80 text-zinc-700 hover:text-[#E46254] hover:border-[#E46254]/30 hover:bg-[#E46254]/5 active:bg-[#E46254]/10 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ml-1"
                      title="View & Print Full Bill Slip"
                    >
                      <Eye size={13} className="text-[#E46254]" />
                      <span>View Bill</span>
                    </button>

                    {/* Quick Thermal Print Icon */}
                    <button
                      onClick={() => handleDirectPrint(inv)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-[#E46254] hover:bg-[#E46254]/8 active:bg-[#E46254]/15 transition-all cursor-pointer"
                      title="1-Tap Instant Thermal Print"
                    >
                      <Printer size={15} />
                    </button>

                    {/* Dropdown Toggle Chevron */}
                    <button
                      onClick={() => toggleExpand(inv.id)}
                      className={`p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-transform duration-200 cursor-pointer ${
                        isExpanded ? "rotate-180 text-zinc-900" : ""
                      }`}
                      title={isExpanded ? "Collapse Details" : "Expand Details"}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>

                {/* ─── DROPDOWN ACCORDION DETAILS (Revealed on Toggle) ─── */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 bg-[#FCFCFD] px-6 py-4 space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150 text-xs">
                    {/* Itemized Breakdown Table */}
                    <div className="bg-white rounded-xl border border-zinc-200/70 p-4 shadow-xs">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider pb-2.5 border-b border-zinc-100 mb-2.5">
                        <span>Dish & Modifiers</span>
                        <div className="flex items-center gap-8">
                          <span className="w-10 text-center">Qty</span>
                          <span className="w-16 text-right">Rate</span>
                          <span className="w-16 text-right">Amount</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {inv.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[12.5px] py-0.5">
                            <div className="flex items-center gap-2.5 truncate pr-4">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  it.isVeg ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              <span className="font-medium text-zinc-800 truncate">{it.name}</span>
                              {it.notes && (
                                <span className="px-2 py-0.5 rounded-md bg-[#E46254]/6 text-[#E46254] border border-[#E46254]/15 text-[10.5px] font-medium flex items-center gap-1 shrink-0">
                                  <FileText size={10} className="text-[#E46254]" />
                                  <span>{it.notes}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-8 tabular-nums shrink-0">
                              <span className="w-10 text-center text-zinc-600 font-medium">{it.count}×</span>
                              <span className="w-16 text-right text-zinc-400 font-normal">₹{it.unitPrice.toFixed(0)}</span>
                              <span className="w-16 text-right font-semibold text-zinc-900">
                                ₹{it.totalPrice.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tax & Discount Calculations + Actions Footer */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      {/* Left: Customer & Meta Info with Pure SVG Icons */}
                      <div className="flex items-center gap-3 text-zinc-500 text-[12px]">
                        <span className="flex items-center gap-1">
                          <User size={12} className="text-[#E46254]" />
                          <span>Guest: <strong className="text-zinc-800 font-medium">{inv.customerName}</strong></span>
                        </span>
                        {inv.customerPhone && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-zinc-600">{inv.customerPhone}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{inv.rounds.length} {inv.rounds.length === 1 ? "round" : "rounds"}</span>
                      </div>

                      {/* Right: Tax Breakdown Summary */}
                      <div className="flex items-center gap-4 text-xs tabular-nums text-zinc-600">
                        <span>Subtotal: <strong className="text-zinc-900 font-semibold">₹{inv.subtotal.toFixed(0)}</strong></span>
                        <span>CGST (2.5%): <strong className="text-zinc-900 font-semibold">₹{inv.cgst.toFixed(0)}</strong></span>
                        <span>SGST (2.5%): <strong className="text-zinc-900 font-semibold">₹{inv.sgst.toFixed(0)}</strong></span>
                        {inv.discountAmount > 0 && (
                          <span className="text-[#E46254] font-semibold bg-[#E46254]/8 px-2 py-0.5 rounded-lg border border-[#E46254]/20">
                            Saved ₹{inv.discountAmount.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Bar inside dropdown */}
                    <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {/* Switch Payment Mode (Toggle between UPI and Cash) */}
                        <button
                          type="button"
                          onClick={() => {
                            const newMethod = inv.paymentMethod === "UPI" ? "CASH" : "UPI";
                            setEditingPaymentInvoice(inv);
                            handleUpdatePaymentMethod(newMethod);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          {inv.paymentMethod === "UPI" ? (
                            <Banknote size={13} className="text-[#E46254]" />
                          ) : (
                            <QrCode size={13} className="text-[#E46254]" />
                          )}
                          <span>Switch to {inv.paymentMethod === "UPI" ? "Cash" : "UPI"}</span>
                        </button>
                      </div>

                      {/* View Full Thermal Slip */}
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#E46254]/10 hover:bg-[#E46254]/15 active:bg-[#E46254]/20 text-[#E46254] border border-[#E46254]/25 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Receipt size={14} />
                        <span>Open Bill Slip</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── STREAMLINED THERMAL POS RECEIPT MODAL ─── */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-[#E46254]" strokeWidth={2.2} />
                <span className="font-mono font-semibold text-zinc-900 text-xs">
                  {selectedInvoice.invoiceNumber}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                  PAID
                </span>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Printable Thermal Receipt Slip */}
            <div className="p-4 overflow-y-auto flex-1 bg-white">
              <div
                id="printable-receipt"
                className="bg-white p-4 rounded-xl border border-zinc-200 font-mono text-zinc-800 text-[11px]"
              >
                {/* Restaurant Brand Header */}
                <div className="text-center pb-2.5 border-b border-dashed border-zinc-300">
                  <h2 className="text-[13px] font-semibold text-zinc-900 tracking-tight uppercase">
                    {restaurant?.name || "The Daily Cafe"}
                  </h2>
                  {restaurant?.address && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">{restaurant.address}</p>
                  )}
                  {restaurant?.phone && (
                    <p className="text-[10px] text-zinc-500">Ph: {restaurant.phone}</p>
                  )}
                  {restaurant?.gstin && (
                    <p className="text-[9.5px] text-zinc-600 font-medium mt-0.5">
                      GSTIN: {restaurant.gstin}
                    </p>
                  )}
                  {restaurant?.fssai && (
                    <p className="text-[9.5px] text-zinc-500">FSSAI: {restaurant.fssai}</p>
                  )}
                </div>

                {/* Meta Details */}
                <div className="py-2 border-b border-dashed border-zinc-300 text-[10.5px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Bill No:</span>
                    <span className="font-semibold">{selectedInvoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Table:</span>
                    <span className="font-semibold">
                      {selectedInvoice.tableNo} ({formatDuration(selectedInvoice.diningDurationMinutes)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Date:</span>
                    <span>
                      {new Date(selectedInvoice.settledAt).toLocaleDateString("en-IN")}{" "}
                      {new Date(selectedInvoice.settledAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {selectedInvoice.customerName !== "Dine-in Guest" && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Guest:</span>
                      <span>{selectedInvoice.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Items Breakdown */}
                <div className="py-2 border-b border-dashed border-zinc-300">
                  <div className="flex justify-between font-semibold text-[10.5px] mb-1 text-zinc-900">
                    <span>ITEM</span>
                    <div className="flex gap-2">
                      <span>QTY</span>
                      <span>AMT</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-[10.5px]">
                    {selectedInvoice.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-start">
                        <span className="flex-1 pr-2 truncate">
                          {it.name}
                          {it.notes && (
                            <span className="block text-[9px] text-zinc-400 italic">
                              ({it.notes})
                            </span>
                          )}
                        </span>
                        <div className="flex gap-2 tabular-nums">
                          <span className="w-4 text-center">{it.count}</span>
                          <span className="w-10 text-right">₹{it.totalPrice.toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subtotals & Taxes */}
                <div className="py-2 space-y-0.5 text-[10.5px] border-b border-dashed border-zinc-300">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums">₹{selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>

                  {selectedInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-[#E46254] font-medium">
                      <span>Discount</span>
                      <span className="tabular-nums">-₹{selectedInvoice.discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-zinc-500 text-[10px]">
                    <span>CGST (2.5%)</span>
                    <span className="tabular-nums">₹{selectedInvoice.cgst.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-zinc-500 text-[10px]">
                    <span>SGST (2.5%)</span>
                    <span className="tabular-nums">₹{selectedInvoice.sgst.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-baseline pt-1.5 border-t border-zinc-200 text-xs font-semibold text-zinc-900">
                    <span>GRAND TOTAL</span>
                    <span className="tabular-nums text-sm">₹{selectedInvoice.grandTotal.toFixed(0)}</span>
                  </div>
                </div>

                {/* Payment Badge Footer */}
                <div className="pt-2.5 text-center text-[10px] text-zinc-500">
                  <p className="font-semibold text-zinc-800 uppercase tracking-wider">
                    PAID VIA {selectedInvoice.paymentMethod}
                  </p>
                  <p className="mt-0.5">Thank you for dining with us!</p>
                  <p className="text-[8.5px] text-zinc-400 mt-0.5">Powered by Tabletapy POS</p>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-3.5 border-t border-zinc-100 bg-white flex items-center justify-end">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Printer size={14} className="text-[#E46254]" />
                <span>Print Thermal Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENT METHOD AUDIT SWITCHER MODAL (UPI vs CASH ONLY) ─── */}
      {editingPaymentInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
            <Receipt size={24} className="text-[#E46254] mx-auto mb-2" strokeWidth={2.2} />
            <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">
              Switch Payment Mode
            </h4>
            <p className="text-[12.5px] text-zinc-600 mt-1">
              Invoice: <strong>{editingPaymentInvoice.invoiceNumber}</strong> (₹
              {editingPaymentInvoice.grandTotal.toFixed(0)})
            </p>
            <p className="text-[11.5px] text-zinc-400 mt-0.5">
              Current: <strong className="text-zinc-700">{editingPaymentInvoice.paymentMethod}</strong>
            </p>

            <div className="mt-4 space-y-2">
              {(["UPI", "CASH"] as const).map((method) => (
                <button
                  key={method}
                  disabled={updatingPayment}
                  onClick={() => handleUpdatePaymentMethod(method)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-between ${
                    editingPaymentInvoice.paymentMethod === method
                      ? "bg-[#E46254]/10 text-[#E46254] border-[#E46254]/30 font-bold"
                      : "bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {method === "UPI" ? (
                      <QrCode size={15} className="text-[#E46254]" />
                    ) : (
                      <Banknote size={15} className="text-[#E46254]" />
                    )}
                    <span>{method === "UPI" ? "UPI Payment" : "Cash in Drawer"}</span>
                  </div>
                  {editingPaymentInvoice.paymentMethod === method && <Check size={14} className="text-[#E46254]" />}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setEditingPaymentInvoice(null)}
                className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DEDICATED THERMAL PRINT STYLES ─── */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-receipt,
          #printable-receipt * {
            visibility: visible !important;
          }
          #printable-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
