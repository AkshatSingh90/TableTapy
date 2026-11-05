"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Search, Plus, Minus, Trash2, Receipt, Printer, ShoppingBag, Send, RotateCcw, CheckCircle2, ChevronRight, ChevronLeft, ArrowRightLeft, Copy, Tag, Pencil, X, Check, UtensilsCrossed, User, Phone, Clock, Users, Sparkles, CreditCard, ArrowUpRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  ItemVariantsConfig,
  extractVariantsFromDescription,
  PortionOption,
  AddonOption,
  COMMON_PREP_TAGS,
} from "@/utils/menuItemVariants";
import { resolveTablePinAndSeed, normalizeTableIdentifier } from "@/utils/tableSessionPin";
import {
  TaxSettings,
  DEFAULT_TAX_SETTINGS,
  RestaurantConfig,
  DEFAULT_RESTAURANT_CONFIG,
  parseConfigFromRestaurant,
  getStoredRestaurantConfig,
  saveRestaurantConfig,
  calculateBillTaxes,
  BillTaxCalculation,
} from "@/utils/tax";
import { playNewOrderChime, playBillRequestChime } from "@/utils/audioAlerts";
import { printThermalChit } from "@/lib/thermalPrinterBridge";
import { LocalSqliteStore, getCanonicalRestaurantId } from "@/lib/localSqliteStore";
import { OfflineSyncEngine } from "@/lib/offlineSyncEngine";
import { LocalCache } from "@/utils/localCache";
import { SyncBus } from "@/utils/syncBus";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ─── Domain Models ────────────────────────────────────────────────── */
interface Location {
  id: string;
  name: string;
  type?: string;
  capacity?: number;
  restaurant_id?: string;
  zone?: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  base_price: number;
  is_veg: boolean;
  is_available: boolean;
  description?: string;
  variantsConfig?: ItemVariantsConfig;
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

interface TableRound {
  orderId: string;
  roundNumber: number;
  status: string;
  source: "QR" | "STAFF" | "CAPTAIN";
  createdAt: string;
  items: Array<{
    itemIndex: number;
    name: string;
    quantity: number;
    price: number;
    isVeg?: boolean;
    notes?: string;
    rawItem?: any;
  }>;
}

interface TableSessionData {
  status: "COOKING" | "BILLED" | "VACANT";
  orders: OrderRecord[];
  rounds: TableRound[];
  allItems: Array<{
    itemIndex: number;
    name: string;
    quantity: number;
    price: number;
    isVeg?: boolean;
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
  hasBillRequest: boolean;
  hasUpiVerifyRequest: boolean;
  isPaid: boolean;
}

type TerminalMode = "DINE_IN" | "TAKEAWAY";

interface NewStaffItem {
  id: string;
  dishId: string;
  name: string;
  portionName?: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  category: string;
  notes?: string;
  addons?: { name: string; price: number }[];
  prepTags?: string[];
}

interface EditingRoundItemState {
  orderId: string;
  roundNumber: number;
  itemIndex: number;
  name: string;
  quantity: number;
  price: number;
  notes: string;
  isVeg?: boolean;
  dishId?: string;
  matchedMenuItem?: MenuItem | null;
}

/* ─── Main Terminal Component ─────────────────────────────────────── */
export default function PosPage() {
  const supabase = useMemo(() => createClient(), []);

  // Restaurant Context
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("My Restaurant");
  const [restaurantAddress, setRestaurantAddress] = useState<string>("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderRecord[]>([]);
  const [pastOrdersHistory, setPastOrdersHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Terminal Navigation & Floor Filters
  const [terminalMode, setTerminalMode] = useState<TerminalMode>("DINE_IN");

  // Sync mode with top header toggle in layout
  useEffect(() => {
    const handleModeChange = (e: any) => {
      if (e.detail) {
        setTerminalMode(e.detail);
        if (e.detail === "TAKEAWAY") {
          setActiveTableModal(null);
        }
      }
    };
    window.addEventListener("pos_mode_change", handleModeChange);
    return () => window.removeEventListener("pos_mode_change", handleModeChange);
  }, []);

  const switchMode = (mode: TerminalMode) => {
    setTerminalMode(mode);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos_mode_sync", { detail: mode }));
    }
  };
  const [tableFilter, setTableFilter] = useState<"ALL" | "OCCUPIED" | "VACANT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live Clock Tick (30s interval for accurate table duration badges)
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Full-Screen Dine-In Modal: Active Table
  const [activeTableModal, setActiveTableModal] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  // Floor Zones State
  const [tableZones, setTableZones] = useState<Record<string, string>>({});
  const [selectedZone, setSelectedZone] = useState<string>("ALL");

  // Set of dismissed/acknowledged order IDs for floor card alert
  const [acknowledgedOrderIds, setAcknowledgedOrderIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("tabletapy_pos_ack_orders");
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {}
    }
    return new Set();
  });

  // Command Station Menu Catalog State
  const [dishSearchQuery, setDishSearchQuery] = useState("");
  const [selectedDrawerCat, setSelectedDrawerCat] = useState("ALL");

  // Manual Punching / Staged Cart (Lives directly on the Unified Ticket Stream)
  const [manualCart, setManualCart] = useState<NewStaffItem[]>([]);
  const [batchNote, setBatchNote] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");
  const [isGuestInfoModalOpen, setIsGuestInfoModalOpen] = useState(false);

  // Quick Dish Customizer Popover (For staged cart add-ons / instructions)
  const [customizingDish, setCustomizingDish] = useState<MenuItem | null>(null);
  const [selectedPortion, setSelectedPortion] = useState<PortionOption | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<AddonOption[]>([]);
  const [selectedPrepTags, setSelectedPrepTags] = useState<string[]>([]);
  const [customDishNote, setCustomDishNote] = useState<string>("");

  // Editing Fired Round Item Modal State
  const [editingRoundItem, setEditingRoundItem] = useState<EditingRoundItemState | null>(null);
  const [editItemQty, setEditItemQty] = useState<number>(1);
  const [editItemPortion, setEditItemPortion] = useState<PortionOption | null>(null);
  const [editItemAddons, setEditItemAddons] = useState<AddonOption[]>([]);
  const [editItemPrepTags, setEditItemPrepTags] = useState<string[]>([]);
  const [editItemNotes, setEditItemNotes] = useState<string>("");

  // Settlement & Discount State (Suppressed by default)
  const [showDiscountControls, setShowDiscountControls] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customDiscountRupees, setCustomDiscountRupees] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Table Transfer State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetTable, setTransferTargetTable] = useState<string>("");

  // Round Highlight (auto-scroll + premium flash for newest round)
  const [highlightRoundId, setHighlightRoundId] = useState<string | null>(null);
  const newestRoundRef = useRef<HTMLDivElement>(null);
  // Bill breakdown toggle
  const [showBillBreakdown, setShowBillBreakdown] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Restaurant Configuration State (Synced via Supabase + localStorage)
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);
  const [qrOrderMode, setQrOrderMode] = useState<'PIN_DIRECT_FIRE' | 'OPEN_STAFF_APPROVAL'>('PIN_DIRECT_FIRE');
  const [paperWidth, setPaperWidth] = useState<'80MM' | '58MM'>('80MM');
  const [printCopies, setPrintCopies] = useState<1 | 2>(1);
  const [autoPrintOnSettle, setAutoPrintOnSettle] = useState(false);

  // Printable Thermal Chit State
  const [printChit, setPrintChit] = useState<{
    type: "KOT" | "BILL";
    mode: "DINE_IN" | "TAKEAWAY";
    tableOrToken: string;
    kotNumber?: number;
    customerName?: string;
    customerPhone?: string;
    items: Array<{ name: string; quantity: number; notes?: string; price?: number }>;
    subtotal?: number;
    packaging?: number;
    discount?: number;
    serviceCharge?: number;
    serviceChargeRate?: number;
    cgst?: number;
    sgst?: number;
    cgstRate?: number;
    sgstRate?: number;
    tax?: number;
    roundOff?: number;
    grandTotal?: number;
    isInclusive?: boolean;
    isComposition?: boolean;
    time: string;
  } | null>(null);

  // Takeaway Mode State (Independent high-speed counter workflow)
  const [takeawayCart, setTakeawayCart] = useState<NewStaffItem[]>([]);
  const [takeawayCustomerName, setTakeawayCustomerName] = useState("");
  const [takeawayCustomerPhone, setTakeawayCustomerPhone] = useState("");
  const [showGuestDetails, setShowGuestDetails] = useState(false);
  const [takeawayPackagingTier, setTakeawayPackagingTier] = useState<"NONE" | "BAG_5" | "BOX_15">("NONE");
  const [takeawayPaymentMethod, setTakeawayPaymentMethod] = useState<"CASH" | "UPI" | "CARD">("UPI");
  const [cashTenderAmount, setCashTenderAmount] = useState<string>("");
  const [showCashTenderModal, setShowCashTenderModal] = useState(false);
  const [showTakeawayBreakdown, setShowTakeawayBreakdown] = useState(false);
  // Function to generate unique 4-digit token (1000 - 9999)
  const generate4DigitToken = () => Math.floor(1000 + Math.random() * 9000);
  const [randomToken, setRandomToken] = useState<number>(() => Math.floor(1000 + Math.random() * 9000));
  const [tokenOverride, setTokenOverride] = useState<number | null>(null);
  const [takeawayShowDiscount, setTakeawayShowDiscount] = useState(false);
  const [takeawayDiscountPercent, setTakeawayDiscountPercent] = useState<number>(0);
  const [takeawayDiscountRupees, setTakeawayDiscountRupees] = useState<string>("");
  const [takeawayBatchNote, setTakeawayBatchNote] = useState("");
  const [takeawayTab, setTakeawayTab] = useState<"CURRENT_ORDER" | "READY_ORDERS">("CURRENT_ORDER");
  const takeawaySearchInputRef = useRef<HTMLInputElement>(null);

  /* ─── 1. Load Floor, Catalog & Realtime Orders (100% Offline-First via Local SQLite) ─── */
  const loadInitialData = async () => {
    try {
      // 1. Resolve restaurantId without waiting for external network
      let restId = await getCanonicalRestaurantId(supabase);
      if (restId) {
        setRestaurantId(restId);
      }

      // 2. Load cached zones
      let loadedTableZones: Record<string, string> = {};
      if (typeof window !== "undefined" && restId) {
        try {
          const rawZones = localStorage.getItem(`tabletapy_table_zones_${restId}`);
          if (rawZones) loadedTableZones = JSON.parse(rawZones);
        } catch {}
      }

      // 3. ⚡ INSTANT 0ms HYDRATION FROM LOCAL SQLITE (Dishes, Tables, Settings)
      if (restId) {
        // A. Settings from SQLite
        const localSettings = await LocalSqliteStore.getSettings(restId);
        if (localSettings) {
          if (localSettings.name) setRestaurantName(localSettings.name);
          if (localSettings.address) setRestaurantAddress(localSettings.address);
          if (localSettings.taxSettings) setTaxSettings(localSettings.taxSettings);
          if (localSettings.paperWidth) setPaperWidth(localSettings.paperWidth.toUpperCase() as "80MM" | "58MM");
          if (localSettings.printCopies === 1 || localSettings.printCopies === 2) setPrintCopies(localSettings.printCopies as 1 | 2);
          if (localSettings.autoPrintOnSettle !== undefined) setAutoPrintOnSettle(localSettings.autoPrintOnSettle);
          if (localSettings.qrOrderMode) setQrOrderMode(localSettings.qrOrderMode as any);
          if (localSettings.tableZones && Object.keys(loadedTableZones).length === 0) {
            loadedTableZones = localSettings.tableZones;
          }
        } else {
          const storedCfg = getStoredRestaurantConfig(restId);
          setTaxSettings(storedCfg.taxSettings);
          setQrOrderMode(storedCfg.qrOrderMode);
          setPaperWidth(storedCfg.paperWidth);
          setPrintCopies(storedCfg.printCopies);
          setAutoPrintOnSettle(storedCfg.autoPrintOnSettle);
        }

        setTableZones(loadedTableZones);

        // B. Tables from SQLite
        const localTables = await LocalSqliteStore.getTables(restId);
        if (localTables && localTables.length > 0) {
          const validTables = localTables.filter((loc) => !loc.restaurant_id || loc.restaurant_id === restId);
          const enriched = validTables.map((loc) => ({
            ...loc,
            zone: loadedTableZones[loc.id] || loc.zone || "Main Floor",
          }));
          const sorted = enriched.sort((a, b) => {
            const numA = parseInt(a.name.replace(/\D/g, ""), 10);
            const numB = parseInt(b.name.replace(/\D/g, ""), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.name.localeCompare(b.name);
          });
          setLocations(sorted);
        }

        // C. Dishes from SQLite (Available items)
        let localDishes = await LocalSqliteStore.getMenuItems(restId, true);
        if (!localDishes || localDishes.length === 0) {
          localDishes = await LocalSqliteStore.getMenuItems(restId, false);
        }
        if (localDishes && localDishes.length > 0) {
          setMenuItems((prev) => {
            if (prev.length > 0) return prev;
            return localDishes.map((dish) => ({
              ...dish,
              variantsConfig: dish.variantsConfig || extractVariantsFromDescription(dish.description, Number(dish.base_price || 0)).config,
            }));
          });
        }

        // D. Active Orders from SQLite (Loaded only when offline; when online, background sync loads smoothly)
        const localOrders = await LocalSqliteStore.getLocalOrders(restId);
        if (localOrders && localOrders.length > 0) {
          const isOnline = typeof navigator !== "undefined" && navigator.onLine;
          if (!isOnline) {
            const activeLocal = localOrders.filter((o) => {
              return ["NEW", "PREPARING", "SERVED"].includes(o.status) || o.payment_status === "UNPAID" || o.payment_status === "PENDING";
            });
            if (activeLocal.length > 0) {
              setActiveOrders(activeLocal as any);
            }
          }
        }

        // Stop loading spinner immediately - Screen is live!
        setLoading(false);
      }

      // 4. 🌐 SILENT BACKGROUND CLOUD SYNC (If online, updates SQLite quietly without disrupting UI)
      if (typeof navigator !== "undefined" && navigator.onLine && restId) {
        syncFromCloudInBackground(restId, loadedTableZones);
      }
    } catch (err) {
      console.error("Failed to load POS floor:", err);
    } finally {
      setLoading(false);
    }
  };

  const syncFromCloudInBackground = async (restId: string, currentZones: Record<string, string>) => {
    try {
      // 1. Revalidate restaurant profile & settings
      const { data: restRec } = await supabase
        .from("restaurants")
        .select("id, name, address, bg_image")
        .eq("id", restId)
        .maybeSingle();

      if (restRec) {
        setRestaurantName(restRec.name || "My Restaurant");
        setRestaurantAddress(restRec.address || "");
        if (restRec.bg_image) {
          const cloudCfg = parseConfigFromRestaurant(restRec);
          setTaxSettings(cloudCfg.taxSettings);
          setQrOrderMode(cloudCfg.qrOrderMode);
          setPaperWidth(cloudCfg.paperWidth);
          setPrintCopies(cloudCfg.printCopies);
          setAutoPrintOnSettle(cloudCfg.autoPrintOnSettle);
          saveRestaurantConfig(cloudCfg, restId);

          let parsedZones = currentZones;
          try {
            const parsed = typeof restRec.bg_image === "string" ? JSON.parse(restRec.bg_image) : restRec.bg_image;
            if (parsed?.tableZones) {
              parsedZones = parsed.tableZones;
              setTableZones(parsedZones);
            }
          } catch {}

          await LocalSqliteStore.saveSettings({
            restaurant_id: restId,
            name: restRec.name || "",
            address: restRec.address || "",
            taxSettings: cloudCfg.taxSettings,
            paperWidth: cloudCfg.paperWidth,
            printCopies: cloudCfg.printCopies,
            autoPrintOnSettle: cloudCfg.autoPrintOnSettle,
            qrOrderMode: cloudCfg.qrOrderMode,
            tableZones: parsedZones,
            last_synced_at: new Date().toISOString(),
          });
        }
      }

      // 2. Revalidate Tables
      const { data: locData } = await supabase
        .from("locations")
        .select("id, name, type, restaurant_id")
        .eq("restaurant_id", restId)
        .order("name", { ascending: true });

      if (locData && locData.length > 0) {
        const enriched = locData.map((loc) => ({
          ...loc,
          zone: currentZones[loc.id] || (loc as any).zone || "Main Floor",
        }));
        const sorted = enriched.sort((a, b) => {
          const numA = parseInt(a.name.replace(/\D/g, ""), 10);
          const numB = parseInt(b.name.replace(/\D/g, ""), 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.name.localeCompare(b.name);
        });
        setLocations(sorted);

        await LocalSqliteStore.saveTables(
          restId,
          locData.map((l) => ({
            id: l.id,
            restaurant_id: restId,
            name: l.name,
            type: l.type,
            zone: currentZones[l.id] || "Main Floor",
          })),
          true // replaceAll = true to flush out old stale/demo tables
        );
      }

      // 3. Revalidate Menu Items
      const { data: allMenu } = await supabase
        .from("menu_items_v2")
        .select("id, name, category, subcategory, base_price, is_veg, is_available, description, restaurant_id")
        .eq("is_available", true)
        .eq("restaurant_id", restId)
        .order("name", { ascending: true });

      if (allMenu && allMenu.length > 0) {
        setMenuItems((prev) => {
          if (
            prev.length === allMenu.length &&
            prev.every((p, idx) => p.id === allMenu[idx].id && p.name === allMenu[idx].name && p.base_price === allMenu[idx].base_price)
          ) {
            return prev;
          }
          return allMenu.map((dish) => ({
            ...dish,
            variantsConfig: extractVariantsFromDescription(dish.description, Number(dish.base_price || 0)).config,
          }));
        });

        await LocalSqliteStore.saveMenuItems(
          restId,
          allMenu.map((d) => ({
            id: d.id,
            restaurant_id: restId,
            name: d.name,
            category: d.category,
            subcategory: d.subcategory,
            base_price: Number(d.base_price || 0),
            is_veg: Boolean(d.is_veg),
            is_available: Boolean(d.is_available),
            description: d.description,
            variantsConfig: extractVariantsFromDescription(d.description, Number(d.base_price || 0)).config,
            updated_at: new Date().toISOString(),
          })),
          true // replaceAll = true to flush out old stale/demo items
        );
      }

      // 4. Revalidate Active Orders & Push any unsynced offline orders
      await fetchActiveOrders(restId);
      await fetchPastOrders(restId);

      // Auto-flush any pending offline orders
      const unsyncedOrders = await LocalSqliteStore.getUnsyncedOrders(restId);
      for (const unsynced of unsyncedOrders) {
        try {
          const { error: pushErr } = await supabase.from("orders").insert({
            restaurant_id: unsynced.restaurant_id,
            table_no: unsynced.table_no,
            total: unsynced.total,
            status: unsynced.status,
            payment_status: unsynced.payment_status,
            payment_method: unsynced.payment_method,
            customer_name: unsynced.customer_name || null,
            customer_phone: unsynced.customer_phone || null,
            items_json: unsynced.items_json,
            created_at: unsynced.created_at,
          });
          if (!pushErr) {
            await LocalSqliteStore.markOrderSynced(unsynced.id);
          }
        } catch {}
      }
    } catch (syncErr) {
      console.warn("[POS] Background sync deferred:", syncErr);
    }
  };

  const fetchActiveOrders = async (restId: string) => {
    if (!restId) return;
    const isOnline = typeof navigator !== "undefined" && navigator.onLine;

    // 1. If offline, load active orders directly from local SQLite
    if (!isOnline) {
      const localOrders = await LocalSqliteStore.getLocalOrders(restId);
      if (localOrders && localOrders.length > 0) {
        const active = localOrders.filter((o) => {
          return ["NEW", "PREPARING", "SERVED"].includes(o.status) || o.payment_status === "UNPAID" || o.payment_status === "PENDING";
        });
        setActiveOrders(active as any);
      }
      return;
    }

    // 2. If online, fetch from Supabase and merge any unsynced offline mutations
    try {
      const { data: orderData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restId)
        .in("status", ["NEW", "PREPARING", "SERVED"])
        .order("created_at", { ascending: true });

      if (!error && orderData) {
        const localOrders = await LocalSqliteStore.getLocalOrders(restId);
        const unsyncedLocals = (localOrders || []).filter(
          (o) =>
            o.synced === 0 &&
            !orderData.some((c: any) => c.id === o.id) &&
            (["NEW", "PREPARING", "SERVED"].includes(o.status) ||
              o.payment_status === "UNPAID" ||
              o.payment_status === "PENDING")
        );

        const merged = [...orderData, ...unsyncedLocals].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        setActiveOrders(merged as OrderRecord[]);

        // Sync into SQLite in background (preserving unsynced offline records)
        await LocalSqliteStore.syncActiveOrders(
          restId,
          orderData.map((ord: any) => ({
            id: ord.id,
            restaurant_id: ord.restaurant_id,
            table_no: ord.table_no,
            customer_name: ord.customer_name,
            customer_phone: ord.customer_phone,
            total: Number(ord.total || 0),
            items_json: ord.items_json,
            status: ord.status,
            payment_status: ord.payment_status,
            payment_method: ord.payment_method,
            note: ord.note || "",
            created_at: ord.created_at,
            synced: 1,
          })),
          true // replaceAll = true to flush out old completed/ghost orders from SQLite!
        );
      }
    } catch (err) {
      console.warn("[POS] fetchActiveOrders offline fallback:", err);
    }
  };

  const fetchPastOrders = async (restId: string) => {
    // 1. Instant local read
    const localInvoices = await LocalSqliteStore.getInvoices(restId, 250);
    if (localInvoices && localInvoices.length > 0) {
      setPastOrdersHistory(
        localInvoices.map((inv) => ({
          id: inv.id,
          table_no: String(inv.table_name || inv.order_number),
          customer_name: inv.customer_name,
          customer_phone: inv.customer_phone,
          total: inv.total_amount,
          items_json: inv.items_json,
          note: "",
          created_at: inv.created_at,
          status: "COMPLETED",
          payment_status: "PAID",
        }))
      );
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    try {
      const { data: pastData } = await supabase
        .from("orders")
        .select("id, table_no, customer_name, customer_phone, total, items_json, note, created_at, status, payment_status")
        .eq("restaurant_id", restId)
        .eq("payment_status", "PAID")
        .order("created_at", { ascending: false })
        .limit(250);

      if (pastData) {
        setPastOrdersHistory(pastData);
      }
    } catch (err) {
      console.warn("[POS] fetchPastOrders offline fallback:", err);
    }
  };

  // Track bill requests to chime when a guest asks for the bill
  const knownBillRequestedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    let hasNewBillRequest = false;
    activeOrders.forEach((o) => {
      const payStatus = (o.payment_status || "").toUpperCase();
      if (payStatus === "BILL_REQUESTED" || payStatus === "CASH_REQUESTED") {
        if (!knownBillRequestedIds.current.has(o.id)) {
          knownBillRequestedIds.current.add(o.id);
          hasNewBillRequest = true;
        }
      }
    });
    if (hasNewBillRequest) {
      playBillRequestChime(true);
    }
  }, [activeOrders]);

  useEffect(() => {
    loadInitialData();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement !== searchInputRef.current &&
        document.activeElement !== takeawaySearchInputRef.current &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        if (terminalMode === "TAKEAWAY") {
          takeawaySearchInputRef.current?.focus();
        } else {
          searchInputRef.current?.focus();
        }
      }
      if (e.key === "Escape") {
        if (editingRoundItem) {
          setEditingRoundItem(null);
        } else if (customizingDish) {
          setCustomizingDish(null);
        } else if (isTransferModalOpen) {
          setIsTransferModalOpen(false);
        } else if (isGuestInfoModalOpen) {
          setIsGuestInfoModalOpen(false);
        } else if (activeTableModal) {
          setActiveTableModal(null);
        } else if (dishSearchQuery) {
          setDishSearchQuery("");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingRoundItem, customizingDish, isTransferModalOpen, isGuestInfoModalOpen, terminalMode, activeTableModal, dishSearchQuery]);

  // Handle opening table command modal, acknowledging alerts, and auto-scrolling to newest round
  const handleOpenTableCommand = (tableName: string, tableId?: string) => {
    setActiveTableModal(tableName);
    setDishSearchQuery("");
    setSelectedDrawerCat("ALL");
    setManualCart([]);
    setBatchNote("");

    const targetId = tableId || locations.find((l) => l.name === tableName)?.id;
    if (targetId) {
      setActiveTableId(targetId);
    }

    // Find unacknowledged NEW round on this table to highlight & auto-scroll
    const session = tableSessionMap.get(targetId || "") || tableSessionMap.get(tableName);
    const targetRound = session?.rounds?.find((r) => r.status === "NEW" && !acknowledgedOrderIds.has(r.orderId));

    if (targetRound) {
      setHighlightRoundId(targetRound.orderId);
      setTimeout(() => {
        if (newestRoundRef.current) {
          newestRoundRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200);
      // Keep showcase highlight active for 4 seconds
      setTimeout(() => setHighlightRoundId(null), 4000);
    }

    // Acknowledge all active orders on this table so shaking stops
    const norm = normalizeTableIdentifier(tableName);
    const tableOrders = activeOrders.filter((o) => {
      if (targetId && o.note && o.note.includes(`[tid:${targetId}]`)) return true;
      return (
        normalizeTableIdentifier(o.table_no) === norm ||
        o.table_no.toLowerCase().trim() === tableName.toLowerCase().trim()
      );
    });

    if (tableOrders.length > 0) {
      setAcknowledgedOrderIds((prev) => {
        const next = new Set(prev);
        let changed = false;
        tableOrders.forEach((o) => {
          if (!next.has(o.id)) {
            next.add(o.id);
            changed = true;
          }
        });
        if (changed && typeof window !== "undefined") {
          try {
            localStorage.setItem("tabletapy_pos_ack_orders", JSON.stringify(Array.from(next)));
          } catch {}
        }
        return next;
      });
    }
  };

  // Realtime Configuration & Locations synchronization across tabs/devices
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key && (e.key.includes("tabletapy_full_config") || e.key.includes("tabletapy_tax_settings") || e.key.includes("tabletapy_paper_width") || e.key.includes("tabletapy_print_copies") || e.key.includes("tabletapy_autoprint") || e.key.includes("tabletapy_table_zones"))) {
        const updated = getStoredRestaurantConfig(restaurantId || undefined);
        setTaxSettings(updated.taxSettings);
        setQrOrderMode(updated.qrOrderMode);
        setPaperWidth(updated.paperWidth);
        setPrintCopies(updated.printCopies);
        setAutoPrintOnSettle(updated.autoPrintOnSettle);
        loadInitialData();
      }
    };
    const handleConfigUpdated = (e: any) => {
      if (e.detail?.config) {
        const cfg = e.detail.config;
        setTaxSettings(cfg.taxSettings);
        setQrOrderMode(cfg.qrOrderMode);
        setPaperWidth(cfg.paperWidth);
        setPrintCopies(cfg.printCopies);
        setAutoPrintOnSettle(cfg.autoPrintOnSettle);
      }
    };
    const handleLocationsUpdated = () => {
      loadInitialData();
    };
    const handleSyncComplete = () => {
      if (restaurantId) {
        fetchActiveOrders(restaurantId);
        fetchPastOrders(restaurantId);
      }
    };
    // Cross-tab instant synchronization without Supabase egress
    const unsubscribeSyncBus = SyncBus.subscribe((msg) => {
      if (msg.restaurantId !== restaurantId) return;
      if (msg.type === "MENU_UPDATED") {
        LocalSqliteStore.getMenuItems(restaurantId, true).then((items) => {
          if (items && items.length > 0) {
            setMenuItems(
              items.map((dish) => ({
                ...dish,
                variantsConfig: dish.variantsConfig || extractVariantsFromDescription(dish.description, Number(dish.base_price || 0)).config,
              }))
            );
          }
        });
      } else if (msg.type === "LOCATIONS_UPDATED") {
        LocalSqliteStore.getTables(restaurantId).then((tables) => {
          if (tables && tables.length > 0) {
            const enriched = tables.map((loc) => ({
              ...loc,
              zone: tableZones[loc.id] || (loc as any).zone || "Main Floor",
            }));
            const sorted = enriched.sort((a, b) => {
              const numA = parseInt(a.name.replace(/\D/g, ""), 10);
              const numB = parseInt(b.name.replace(/\D/g, ""), 10);
              if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
              return a.name.localeCompare(b.name);
            });
            setLocations(sorted);
          }
        });
      }
    });

    window.addEventListener("storage", handleStorage);
    window.addEventListener("tabletapy_config_updated", handleConfigUpdated);
    window.addEventListener("tabletapy_locations_updated", handleLocationsUpdated);
    window.addEventListener("tabletapy_sync_completed", handleSyncComplete);
    return () => {
      unsubscribeSyncBus();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("tabletapy_config_updated", handleConfigUpdated);
      window.removeEventListener("tabletapy_locations_updated", handleLocationsUpdated);
      window.removeEventListener("tabletapy_sync_completed", handleSyncComplete);
    };
  }, [restaurantId]);

  // Supabase Realtime Subscription (Orders + Config Broadcast + Restaurant Cloud Updates)
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`pos_floor_sync_${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT" || (payload.new && payload.new.status === "NEW")) {
            playNewOrderChime(true);
          }
          if (payload.new && (payload.new.payment_status === "BILL_REQUESTED" || payload.new.payment_status === "CASH_REQUESTED")) {
            playBillRequestChime(true);
          }
          fetchActiveOrders(restaurantId);
          fetchPastOrders(restaurantId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "restaurants",
          filter: `id=eq.${restaurantId}`,
        },
        (payload: any) => {
          if (payload.new?.bg_image) {
            const cloudCfg = parseConfigFromRestaurant(payload.new);
            setTaxSettings(cloudCfg.taxSettings);
            setQrOrderMode(cloudCfg.qrOrderMode);
            setPaperWidth(cloudCfg.paperWidth);
            setPrintCopies(cloudCfg.printCopies);
            setAutoPrintOnSettle(cloudCfg.autoPrintOnSettle);
            saveRestaurantConfig(cloudCfg, restaurantId);
          }
        }
      )
      .on("broadcast", { event: "config_updated" }, (payload: any) => {
        if (payload?.payload?.config) {
          const cfg = payload.payload.config;
          setTaxSettings(cfg.taxSettings);
          setQrOrderMode(cfg.qrOrderMode);
          setPaperWidth(cfg.paperWidth);
          setPrintCopies(cfg.printCopies);
          setAutoPrintOnSettle(cfg.autoPrintOnSettle);
          saveRestaurantConfig(cfg, restaurantId);
        }
      })
      .subscribe();

    const configGlobalChannel = supabase
      .channel("restaurant_config_global")
      .on("broadcast", { event: "config_updated" }, (payload: any) => {
        if (payload?.payload?.config && (!payload.payload.restaurantId || payload.payload.restaurantId === restaurantId)) {
          const cfg = payload.payload.config;
          setTaxSettings(cfg.taxSettings);
          setQrOrderMode(cfg.qrOrderMode);
          setPaperWidth(cfg.paperWidth);
          setPrintCopies(cfg.printCopies);
          setAutoPrintOnSettle(cfg.autoPrintOnSettle);
          saveRestaurantConfig(cfg, restaurantId);
        }
      })
      .subscribe();

    const configScopedChannel = supabase
      .channel(`restaurant_config_${restaurantId}`)
      .on("broadcast", { event: "config_updated" }, (payload: any) => {
        if (payload?.payload?.config) {
          const cfg = payload.payload.config;
          setTaxSettings(cfg.taxSettings);
          setQrOrderMode(cfg.qrOrderMode);
          setPaperWidth(cfg.paperWidth);
          setPrintCopies(cfg.printCopies);
          setAutoPrintOnSettle(cfg.autoPrintOnSettle);
          saveRestaurantConfig(cfg, restaurantId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(configGlobalChannel);
      supabase.removeChannel(configScopedChannel);
    };
  }, [restaurantId]);

  /* ─── 2. Compute Table State Map ────────────────────────────────── */
  const tableSessionMap = useMemo(() => {
    const map = new Map<string, TableSessionData>();

    const createEmptySession = (): TableSessionData => ({
      status: "VACANT",
      orders: [],
      rounds: [],
      allItems: [],
      totalBill: 0,
      hasNewRound: false,
      hasBillRequest: false,
      hasUpiVerifyRequest: false,
      isPaid: false,
    });

    locations.forEach((loc) => {
      const session = createEmptySession();
      // Primary key: table UUID (isolates alerts to the exact physical table)
      map.set(loc.id, session);
      // Secondary key: table name (only if unique among tables)
      const sameNameCount = locations.filter(
        (l) => l.name.trim().toLowerCase() === loc.name.trim().toLowerCase()
      ).length;
      if (sameNameCount === 1) {
        map.set(loc.name, session);
      }
    });

    const findLocationIdForOrder = (order: OrderRecord): string => {
      // 1. Try matching [tid:UUID] inside order.note
      if (order.note) {
        const tidMatch = order.note.match(/\[tid:([a-f0-9\-]+)\]/i);
        if (tidMatch && tidMatch[1]) {
          const matched = locations.find(
            (l) => l.id.toLowerCase() === tidMatch[1].toLowerCase()
          );
          if (matched) return matched.id;
        }
      }

      // 2. Check if order.table_no is directly a location ID
      const directIdMatch = locations.find((l) => l.id === order.table_no);
      if (directIdMatch) return directIdMatch.id;

      // 3. Match exact location name
      const exactNameMatch = locations.find(
        (l) => l.name.trim().toLowerCase() === order.table_no.trim().toLowerCase()
      );
      if (exactNameMatch) return exactNameMatch.id;

      // 4. Match normalized name
      const normOrder = normalizeTableIdentifier(order.table_no);
      const normMatch = locations.find((l) => normalizeTableIdentifier(l.name) === normOrder);
      if (normMatch) return normMatch.id;

      return order.table_no;
    };

    const sortedOrders = [...activeOrders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedOrders.forEach((order) => {
      const isTakeaway =
        order.table_no.toLowerCase().includes("takeaway") ||
        order.table_no.toLowerCase().includes("token");

      if (isTakeaway) return;

      const locKey = findLocationIdForOrder(order);
      let existing = map.get(locKey);
      if (!existing) {
        existing = createEmptySession();
        map.set(locKey, existing);
      }

      existing.orders.push(order);

      // Order Origin Attribution
      let orderSource: "QR" | "STAFF" | "CAPTAIN" = "QR";
      const noteLower = (order.note || "").toLowerCase();
      const customerLower = (order.customer_name || "").toLowerCase();

      if (
        noteLower.includes("pos") ||
        noteLower.includes("counter") ||
        order.payment_method === "COUNTER" ||
        noteLower.includes("pos fired round")
      ) {
        orderSource = "STAFF";
      } else if (
        noteLower.includes("captain") ||
        customerLower.includes("captain") ||
        customerLower.includes("waiter")
      ) {
        orderSource = "CAPTAIN";
      }

      // Attention shake triggers ONLY if order is genuinely unacknowledged
      const isUnack = (order.status === "NEW" || orderSource === "QR") && !acknowledgedOrderIds.has(order.id);
      if (isUnack) {
        existing.hasNewRound = true;
      }

      // Check payment status alerts
      const payStatus = (order.payment_status || "").toUpperCase();
      if (payStatus === "CASH_REQUESTED" || payStatus === "BILL_REQUESTED") {
        existing.hasBillRequest = true;
      } else if (payStatus === "UPI_VERIFICATION_PENDING" || payStatus === "VERIFY_UPI") {
        existing.hasUpiVerifyRequest = true;
      }

      if (order.customer_name && !existing.customerName) {
        const cleanName = order.customer_name.trim();
        if (!cleanName.toLowerCase().startsWith("table ")) {
          existing.customerName = cleanName;
        }
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

      // Extract original round number if recorded in note, e.g. [POS Fired Round #2]
      const roundNumMatch = (order.note || "").match(/Round #(\d+)/i);
      const parsedRoundNum = roundNumMatch ? parseInt(roundNumMatch[1], 10) : null;
      const roundIndex = parsedRoundNum || (existing.rounds.length + 1);
      const roundItems: Array<{
        itemIndex: number;
        name: string;
        quantity: number;
        price: number;
        isVeg?: boolean;
        notes?: string;
        rawItem?: any;
      }> = [];

      if (Array.isArray(order.items_json)) {
        order.items_json.forEach((raw: any, idx: number) => {
          const itemObj = raw.item || raw;
          const isVoided = Boolean(raw.isVoided || raw.is_voided || raw.voided);
          if (isVoided) return; // exclude voided items from bill

          const parsedItem = {
            itemIndex: idx,
            name: itemObj.name || "Custom Item",
            price: Number(raw.price || itemObj.basePrice || itemObj.base_price || 0),
            quantity: Number(raw.quantity || 1),
            isVeg: itemObj.isVeg ?? itemObj.is_veg ?? true,
            notes: raw.notes || raw.specialInstructions || "",
            rawItem: raw,
          };

          roundItems.push(parsedItem);
          existing.totalBill += parsedItem.price * parsedItem.quantity;

          existing.allItems.push({
            ...parsedItem,
            source: orderSource,
            roundNumber: roundIndex,
            orderId: order.id,
          });
        });
      }

      existing.rounds.push({
        orderId: order.id,
        roundNumber: roundIndex,
        status: order.status,
        source: orderSource,
        createdAt: order.created_at,
        items: roundItems,
      });

      if (order.status === "SERVED") {
        existing.status = "BILLED";
      } else if (existing.status !== "BILLED") {
        existing.status = "COOKING";
      }
    });

    // Check if table's active orders are paid
    map.forEach((session) => {
      if (session.orders.length > 0) {
        session.isPaid = session.orders.every((o) => o.payment_status === "PAID");
      }
    });

    return map;
  }, [locations, activeOrders, acknowledgedOrderIds]);

  // Floor Stats
  const floorStats = useMemo(() => {
    let occupied = 0;
    let vacant = 0;
    let billed = 0;
    let totalRevenue = 0;

    locations.forEach((loc) => {
      const session = tableSessionMap.get(loc.id) || tableSessionMap.get(loc.name);
      if (!session || session.status === "VACANT") {
        vacant += 1;
      } else {
        occupied += 1;
        totalRevenue += session.totalBill;
        if (session.status === "BILLED") billed += 1;
      }
    });

    return { occupied, vacant, billed, totalRevenue, totalTables: locations.length };
  }, [tableSessionMap, locations]);

  // Distinct Zones
  const allZones = useMemo(() => {
    const zoneSet = new Set<string>();
    locations.forEach((l) => {
      const z = tableZones[l.id] || l.zone;
      if (z && z.trim()) zoneSet.add(z.trim());
    });
    if (zoneSet.size === 0) zoneSet.add("Main Floor");
    return Array.from(zoneSet);
  }, [locations, tableZones]);

  // Selected Table Session
  const activeSession = useMemo(() => {
    if (!activeTableModal && !activeTableId) return null;
    if (activeTableId && tableSessionMap.has(activeTableId)) {
      return tableSessionMap.get(activeTableId) || null;
    }
    if (activeTableModal && tableSessionMap.has(activeTableModal)) {
      return tableSessionMap.get(activeTableModal) || null;
    }
    return null;
  }, [activeTableModal, activeTableId, tableSessionMap]);

  // Priority Sorter for Tables in Zones: Alerting Tables FIRST
  const sortTablesByAlertAndName = (tables: Location[]) => {
    const getUrgencyScore = (session?: TableSessionData) => {
      if (!session) return 0;
      if (session.hasNewRound) return 40; // New Order - Top alert
      if (session.hasBillRequest) return 30; // Bill Requested - 2nd alert
      if (session.hasUpiVerifyRequest) return 20; // UPI Verification - 3rd alert
      if (session.status !== "VACANT" && !session.isPaid) return 10; // Running
      if (session.status !== "VACANT" && session.isPaid) return 5; // Paid
      return 0; // Vacant
    };

    return [...tables].sort((a, b) => {
      const sessionA = tableSessionMap.get(a.id) || tableSessionMap.get(a.name);
      const sessionB = tableSessionMap.get(b.id) || tableSessionMap.get(b.name);

      const scoreA = getUrgencyScore(sessionA);
      const scoreB = getUrgencyScore(sessionB);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Alerting tables first
      }

      const numA = parseInt(a.name.replace(/\D/g, ""), 10);
      const numB = parseInt(b.name.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.name.localeCompare(b.name);
    });
  };

  const isVacantTable = !activeSession || activeSession.status === "VACANT" || activeSession.rounds.length === 0;

  // Has payment been collected for this seated table?
  const isTablePaid = useMemo(() => {
    if (!activeSession || activeSession.orders.length === 0) return false;
    const nonCancelled = activeSession.orders.filter((o) => o.status !== "CANCELLED");
    if (nonCancelled.length === 0) return false;
    return nonCancelled.every((o) => o.payment_status === "PAID");
  }, [activeSession]);

  // Rock-Solid Table PIN sync (Matches Captain & Customer Phone views bit-for-bit)
  const currentTablePin = useMemo(() => {
    if (!activeTableModal) return "1234";
    const normTable = normalizeTableIdentifier(activeTableModal);
    const tableActive = activeOrders.filter(
      (o) => normalizeTableIdentifier(o.table_no) === normTable && o.status !== "CANCELLED"
    );
    const tablePast = pastOrdersHistory.filter(
      (o) => normalizeTableIdentifier(o.table_no) === normTable && o.payment_status === "PAID"
    );
    const { pin } = resolveTablePinAndSeed(activeTableModal, tableActive, tablePast);
    return pin;
  }, [activeTableModal, activeOrders, pastOrdersHistory]);

  const handleCopyPin = (pin: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(pin);
      showToast(`Table PIN ${pin} copied`);
    }
  };

  // Synchronize customer name & phone into edit inputs when table changes
  useEffect(() => {
    if (activeSession && activeSession.status !== "VACANT") {
      setManualCustomerName(activeSession.customerName || "");
      setManualCustomerPhone(activeSession.customerPhone || "");
    } else {
      setManualCustomerName("");
      setManualCustomerPhone("");
    }
    setManualCart([]);
    setBatchNote("");
    setShowDiscountControls(false);
    setDiscountPercent(0);
    setCustomDiscountRupees("");
    setSelectedDrawerCat("ALL");
    setDishSearchQuery("");
  }, [activeTableModal]);

  /* ─── 3. Menu Categories & Filter ───────────────────────────────── */
  const drawerCategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [menuItems]);

  const filteredCatalog = useMemo(() => {
    return menuItems.filter((m) => {
      const matchCat =
        selectedDrawerCat === "ALL" ||
        m.category.toLowerCase() === selectedDrawerCat.toLowerCase();
      const q = dishSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedDrawerCat, dishSearchQuery]);

  /* ─── 4. Quick Punching (Inline Portions & Base Dish) ───────────── */
  const handleQuickAddPortion = (dish: MenuItem, portion: PortionOption) => {
    const isFull = portion.name.toLowerCase() === "full";
    const displayName = isFull ? dish.name : `${dish.name} (${portion.name})`;
    const cartEntryId = `${dish.id}_${portion.name}`;

    const updateCart = (prev: NewStaffItem[]) => {
      const idx = prev.findIndex((c) => c.id === cartEntryId);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: cartEntryId,
          dishId: dish.id,
          name: displayName,
          portionName: portion.name,
          price: portion.price,
          quantity: 1,
          isVeg: dish.is_veg,
          category: dish.category,
          notes: "",
        },
      ];
    };

    if (terminalMode === "TAKEAWAY") {
      setTakeawayCart(updateCart);
    } else {
      setManualCart(updateCart);
    }
  };

  const handleQuickAddBase = (dish: MenuItem) => {
    const updateCart = (prev: NewStaffItem[]) => {
      const idx = prev.findIndex(
        (i) => (i.dishId === dish.id || i.id === dish.id) && !i.portionName && (!i.notes || i.notes === "")
      );
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: dish.id,
          dishId: dish.id,
          name: dish.name,
          price: dish.base_price,
          quantity: 1,
          isVeg: dish.is_veg,
          category: dish.category,
          notes: "",
        },
      ];
    };

    if (terminalMode === "TAKEAWAY") {
      setTakeawayCart(updateCart);
    } else {
      setManualCart(updateCart);
    }
  };

  // Dedicated strictly immutable stepper handlers for catalog cards (1 2 3 4 5...)
  const handleIncrementDish = (dish: MenuItem) => {
    handleQuickAddBase(dish);
  };

  const handleDecrementDish = (dish: MenuItem) => {
    if (terminalMode === "TAKEAWAY") {
      setTakeawayCart((prev) => {
        const idx = prev.findIndex((i) => i.dishId === dish.id || i.id === dish.id);
        if (idx < 0) return prev;
        if (prev[idx].quantity > 1) {
          return prev.map((item, i) =>
            i === idx ? { ...item, quantity: item.quantity - 1 } : item
          );
        }
        return prev.filter((_, i) => i !== idx);
      });
    } else {
      setManualCart((prev) => {
        const idx = prev.findIndex((i) => i.dishId === dish.id || i.id === dish.id);
        if (idx < 0) return prev;
        if (prev[idx].quantity > 1) {
          return prev.map((item, i) =>
            i === idx ? { ...item, quantity: item.quantity - 1 } : item
          );
        }
        return prev.filter((_, i) => i !== idx);
      });
    }
  };

  const handleOpenCustomizer = (dish: MenuItem) => {
    const defaultPortion =
      dish.variantsConfig?.portions?.find((p) => p.isDefault || p.name.toLowerCase() === "full") ||
      dish.variantsConfig?.portions?.[0] || {
        name: "Full",
        price: dish.base_price,
        isDefault: true,
      };

    setCustomizingDish(dish);
    setSelectedPortion(defaultPortion);
    setSelectedAddons([]);
    setSelectedPrepTags([]);
    setCustomDishNote("");
  };

  const handleConfirmCustomDish = () => {
    if (!customizingDish) return;

    const portionPrice = selectedPortion ? selectedPortion.price : customizingDish.base_price;
    const addonsPrice = selectedAddons.reduce((s, a) => s + (a.price || 0), 0);
    const unitPrice = portionPrice + addonsPrice;

    const portionLabel =
      selectedPortion && selectedPortion.name.toLowerCase() !== "full"
        ? ` (${selectedPortion.name})`
        : "";
    const displayName = `${customizingDish.name}${portionLabel}`;

    const tagsStr = selectedPrepTags.join(", ");
    const addonsStr = selectedAddons.map((a) => a.name).join(", ");
    const noteParts: string[] = [];
    if (tagsStr) noteParts.push(tagsStr);
    if (addonsStr) noteParts.push(`Addons: ${addonsStr}`);
    if (customDishNote.trim()) noteParts.push(customDishNote.trim());
    const finalNotes = noteParts.join(" • ");

    const cartEntryId = `${customizingDish.id}_${selectedPortion?.name || "def"}_${selectedAddons
      .map((a) => a.name)
      .sort()
      .join("_")}_${selectedPrepTags.sort().join("_")}_${customDishNote.trim()}`;

    const updateCart = (prev: NewStaffItem[]) => {
      const idx = prev.findIndex((c) => c.id === cartEntryId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          id: cartEntryId,
          dishId: customizingDish.id,
          name: displayName,
          portionName: selectedPortion?.name,
          price: unitPrice,
          quantity: 1,
          isVeg: customizingDish.is_veg,
          category: customizingDish.category,
          notes: finalNotes,
          addons: selectedAddons.map((a) => ({ name: a.name, price: a.price })),
          prepTags: selectedPrepTags,
        },
      ];
    };

    if (terminalMode === "TAKEAWAY") {
      setTakeawayCart(updateCart);
    } else {
      setManualCart(updateCart);
    }

    setCustomizingDish(null);
  };

  // Edit an unfired staged cart item's customization
  const handleEditManualCartItem = (cartItem: NewStaffItem) => {
    const dish =
      menuItems.find((m) => m.id === cartItem.dishId || m.name.toLowerCase() === cartItem.name.toLowerCase()) ||
      null;

    if (!dish) return;

    setCustomizingDish(dish);

    if (cartItem.portionName && dish.variantsConfig?.portions) {
      const matchedP = dish.variantsConfig.portions.find(
        (p) => p.name.toLowerCase() === cartItem.portionName?.toLowerCase()
      );
      setSelectedPortion(matchedP || null);
    } else {
      setSelectedPortion(dish.variantsConfig?.portions?.[0] || null);
    }

    if (cartItem.addons && dish.variantsConfig?.addons) {
      const matchedA = dish.variantsConfig.addons.filter((a) =>
        cartItem.addons?.some((ca) => ca.name.toLowerCase() === a.name.toLowerCase())
      );
      setSelectedAddons(matchedA);
    } else {
      setSelectedAddons([]);
    }

    setSelectedPrepTags(cartItem.prepTags || []);
    setCustomDishNote(cartItem.notes || "");

    // Remove the old item so confirming replaces it with updated customizations
    setManualCart((prev) => prev.filter((i) => i.id !== cartItem.id));
  };

  const updateManualQty = (id: string, delta: number) => {
    setManualCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as NewStaffItem[]
    );
  };

  /* ─── 5. Edit and Remove Dishes in Fired Rounds ─────────────────── */
  const handleOpenEditRoundItem = (round: TableRound, it: TableRound["items"][number]) => {
    const order = activeOrders.find((o) => o.id === round.orderId);
    const rawItem = order?.items_json?.[it.itemIndex] || {};
    const rawItemObj = rawItem.item || rawItem;

    const matched =
      menuItems.find(
        (m) =>
          (rawItemObj.id && m.id === rawItemObj.id) ||
          m.name.toLowerCase() === (rawItemObj.name || it.name).toLowerCase() ||
          it.name.toLowerCase().startsWith(m.name.toLowerCase())
      ) || null;

    let initialPortion: PortionOption | null = null;
    if (matched?.variantsConfig?.portions?.length) {
      initialPortion =
        matched.variantsConfig.portions.find(
          (p) =>
            it.name.toLowerCase().includes(`(${p.name.toLowerCase()})`) ||
            (it.notes || "").toLowerCase().includes(p.name.toLowerCase())
        ) ||
        matched.variantsConfig.portions.find((p) => p.isDefault) ||
        matched.variantsConfig.portions[0];
    }

    const initialAddons: AddonOption[] = [];
    if (matched?.variantsConfig?.addons?.length) {
      matched.variantsConfig.addons.forEach((addon) => {
        if ((it.notes || "").toLowerCase().includes(addon.name.toLowerCase())) {
          initialAddons.push(addon);
        }
      });
    }

    const initialTags: string[] = [];
    COMMON_PREP_TAGS.forEach((tag) => {
      if ((it.notes || "").toLowerCase().includes(tag.toLowerCase())) {
        initialTags.push(tag);
      }
    });

    let cleanNotes = it.notes || "";
    if (initialPortion) {
      cleanNotes = cleanNotes.replace(new RegExp(`\\b${initialPortion.name}\\b`, "gi"), "");
    }
    initialAddons.forEach((a) => {
      cleanNotes = cleanNotes.replace(new RegExp(`\\b${a.name}\\b`, "gi"), "");
    });
    initialTags.forEach((t) => {
      cleanNotes = cleanNotes.replace(new RegExp(`\\b${t}\\b`, "gi"), "");
    });
    cleanNotes = cleanNotes.replace(/Addons:\s*/gi, "").replace(/[•,]/g, " ").replace(/\s+/g, " ").trim();

    setEditingRoundItem({
      orderId: round.orderId,
      roundNumber: round.roundNumber,
      itemIndex: it.itemIndex,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      notes: it.notes || "",
      isVeg: it.isVeg,
      dishId: rawItemObj.id || matched?.id,
      matchedMenuItem: matched,
    });

    setEditItemQty(it.quantity);
    setEditItemPortion(initialPortion);
    setEditItemAddons(initialAddons);
    setEditItemPrepTags(initialTags);
    setEditItemNotes(cleanNotes);
  };

  const handleSaveEditRoundItem = async () => {
    if (!editingRoundItem) return;
    const { orderId, itemIndex, matchedMenuItem } = editingRoundItem;

    const order = activeOrders.find((o) => o.id === orderId);
    if (!order || !Array.isArray(order.items_json)) {
      setEditingRoundItem(null);
      return;
    }

    setIsSubmitting(true);
    try {
      let unitPrice = editingRoundItem.price;
      if (matchedMenuItem) {
        const portionPrice = editItemPortion ? editItemPortion.price : matchedMenuItem.base_price;
        const addonsPrice = editItemAddons.reduce((s, a) => s + (a.price || 0), 0);
        unitPrice = portionPrice + addonsPrice;
      }

      const portionLabel =
        editItemPortion && editItemPortion.name.toLowerCase() !== "full"
          ? ` (${editItemPortion.name})`
          : "";
      const baseName = matchedMenuItem
        ? matchedMenuItem.name
        : editingRoundItem.name.replace(/\s*\([^)]*\)/g, "").trim();
      const finalName = `${baseName}${portionLabel}`;

      const tagsStr = editItemPrepTags.join(", ");
      const addonsStr = editItemAddons.map((a) => a.name).join(", ");
      const noteParts: string[] = [];
      if (tagsStr) noteParts.push(tagsStr);
      if (addonsStr) noteParts.push(`Addons: ${addonsStr}`);
      if (editItemNotes.trim()) noteParts.push(editItemNotes.trim());
      const finalNotes = noteParts.join(" • ");

      const updatedItems = [...order.items_json];
      const originalItem = updatedItems[itemIndex] || {};
      updatedItems[itemIndex] = {
        ...originalItem,
        price: unitPrice,
        quantity: editItemQty,
        notes: finalNotes,
        specialInstructions: finalNotes,
        item: {
          ...(originalItem.item || {}),
          name: finalName,
          basePrice: unitPrice,
          base_price: unitPrice,
        },
      };

      const newTotal = updatedItems.reduce(
        (sum: number, it: any) => sum + Number(it.price || it.basePrice || 0) * Number(it.quantity || 1),
        0
      );

      const { error } = await supabase
        .from("orders")
        .update({
          items_json: updatedItems,
          total: newTotal,
        })
        .eq("id", orderId);

      if (error) throw error;

      setActiveOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, items_json: updatedItems, total: newTotal } : o))
      );

      showToast(`Updated ${finalName}`);
      setEditingRoundItem(null);
    } catch (err: any) {
      showToast("Failed to update dish: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveRoundItem = async (
    orderId: string,
    itemIndex: number,
    itemName: string,
    roundNumber: number
  ) => {
    if (!confirm(`Remove "${itemName}" from Round #${roundNumber}?`)) {
      return;
    }

    const order = activeOrders.find((o) => o.id === orderId);
    if (!order || !Array.isArray(order.items_json)) return;

    setIsSubmitting(true);
    try {
      const updatedItems = order.items_json.filter((_: any, idx: number) => idx !== itemIndex);

      if (updatedItems.length === 0) {
        const { error } = await supabase
          .from("orders")
          .update({
            status: "CANCELLED",
            note: `${order.note || ""} [All items removed by staff]`.trim(),
          })
          .eq("id", orderId);

        if (error) throw error;

        setActiveOrders((prev) => prev.filter((o) => o.id !== orderId));
        showToast(`Removed ${itemName} & cancelled empty Round #${roundNumber}`);
      } else {
        const newTotal = updatedItems.reduce(
          (sum: number, it: any) => sum + Number(it.price || it.basePrice || 0) * Number(it.quantity || 1),
          0
        );

        const { error } = await supabase
          .from("orders")
          .update({
            items_json: updatedItems,
            total: newTotal,
          })
          .eq("id", orderId);

        if (error) throw error;

        setActiveOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, items_json: updatedItems, total: newTotal } : o))
        );
        showToast(`Removed ${itemName} from Round #${roundNumber}`);
      }

      if (editingRoundItem?.orderId === orderId && editingRoundItem?.itemIndex === itemIndex) {
        setEditingRoundItem(null);
      }
    } catch (err: any) {
      showToast("Failed to remove item: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 6. Financial Calculations (Bill Totals & Round-Off) ──────── */
  const subtotal = useMemo(() => {
    const firedTotal = activeSession?.totalBill || 0;
    const manualTotal = manualCart.reduce((s, it) => s + it.price * it.quantity, 0);
    return firedTotal + manualTotal;
  }, [activeSession, manualCart]);

  const effectiveDiscount = useMemo(() => {
    if (customDiscountRupees) {
      const val = parseFloat(customDiscountRupees);
      return isNaN(val) ? 0 : Math.min(val, subtotal);
    }
    if (discountPercent > 0) {
      return (subtotal * discountPercent) / 100;
    }
    return 0;
  }, [subtotal, discountPercent, customDiscountRupees]);

  const dineInBillCalc: BillTaxCalculation = useMemo(() => {
    return calculateBillTaxes({
      subtotal,
      discountAmount: effectiveDiscount,
      isDineIn: true,
      settings: taxSettings,
    });
  }, [subtotal, effectiveDiscount, taxSettings]);

  const {
    taxableAmount,
    cgstAmount,
    sgstAmount,
    totalGst: gstAmount,
    serviceChargeAmount,
    exactTotal,
    grandTotal,
    roundOff,
  } = dineInBillCalc;

  /* ─── 7. Fire Round / Send KOT to Kitchen ───────────────────────── */
  const handleSendManualKOT = async () => {
    if (manualCart.length === 0) return;
    if (!activeTableModal) {
      showToast("Please select a table first");
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = manualCart.map((c) => ({
        item: {
          id: c.dishId || c.id,
          name: c.name,
          basePrice: c.price,
          category: c.category,
          isVeg: c.isVeg,
        },
        price: c.price,
        quantity: c.quantity,
        notes: c.notes || "",
        specialInstructions: c.notes || "",
        isReady: false,
      }));

      const roundNum = (activeSession?.rounds.length || 0) + 1;
      const noteParts: string[] = [`[POS Fired Round #${roundNum}]`];
      if (activeTableId) {
        noteParts.push(`[tid:${activeTableId}]`);
      }
      if (currentTablePin && currentTablePin !== "----") {
        noteParts.push(`[PIN:${currentTablePin}]`);
      }
      if (batchNote.trim()) noteParts.push(batchNote.trim());
      const fullNote = noteParts.join(" ");

      // Generate a valid RFC4122 UUID so Supabase Postgres uuid column accepts it with 200 OK
      const localOrderId = generateUUID();

      const newOrderRecord: OrderRecord = {
        id: localOrderId,
        restaurant_id: restaurantId || '',
        table_no: activeTableModal,
        customer_name: manualCustomerName.trim() || activeSession?.customerName || "Dine-in Guest",
        customer_phone: manualCustomerPhone.trim() || activeSession?.customerPhone || undefined,
        total: manualCart.reduce((s, it) => s + it.price * it.quantity, 0),
        items_json: itemsPayload,
        status: 'PREPARING',
        payment_status: 'PENDING',
        payment_method: 'COUNTER',
        note: fullNote,
        created_at: new Date().toISOString(),
      };

      // 1. Instant Local SQLite persistence (Guaranteed offline safety)
      await LocalSqliteStore.saveOrderLocally({
        ...newOrderRecord,
        synced: 0,
      }).catch(e => console.warn('Local SQLite write error:', e));

      // 1b. OPTIMISTIC UPDATE: Add round immediately to activeOrders state so UI NEVER flashes or vanishes
      setActiveOrders((prev) => {
        if (prev.some((o) => o.id === localOrderId)) return prev;
        return [...prev, newOrderRecord];
      });

      // 2. Print Thermal KOT Chit
      const kotData = {
        type: "KOT" as const,
        mode: "DINE_IN" as const,
        tableOrToken: activeTableModal,
        kotNumber: roundNum,
        customerName: manualCustomerName.trim() || activeSession?.customerName,
        customerPhone: manualCustomerPhone.trim() || activeSession?.customerPhone,
        items: manualCart.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          notes: c.notes,
        })),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setPrintChit(kotData);

      printThermalChit({
        restaurantName,
        restaurantAddress,
        type: 'KOT',
        tableName: activeTableModal,
        orderType: 'DINE_IN',
        orderNumber: roundNum,
        timestamp: kotData.time,
        items: kotData.items.map(it => ({ name: it.name, quantity: it.quantity, notes: it.notes })),
      }, {
        fallbackCallback: () => {
          setTimeout(() => { if (typeof window !== 'undefined') window.print(); }, 100);
        }
      });

      showToast(`${activeTableModal}: Round #${roundNum} fired to kitchen`);
      setManualCart([]);
      setBatchNote("");

      // 3. Silent cloud push if online
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const { error } = await supabase.from("orders").insert({
            id: localOrderId,
            restaurant_id: restaurantId,
            table_no: activeTableModal,
            total: newOrderRecord.total,
            status: "PREPARING",
            payment_status: "PENDING",
            payment_method: "COUNTER",
            customer_name: newOrderRecord.customer_name,
            customer_phone: newOrderRecord.customer_phone || null,
            items_json: itemsPayload,
            note: fullNote,
          });
          if (!error) {
            await LocalSqliteStore.markOrderSynced(localOrderId);
            setActiveOrders((prev) =>
              prev.map((o) => (o.id === localOrderId ? { ...o, synced: 1 } : o))
            );
          } else {
            console.error("[POS] Supabase order insert error:", error);
          }
        } catch (netErr) {
          console.warn("[POS] Fired KOT offline, queued in SQLite:", netErr);
        }
      }
      OfflineSyncEngine.triggerSync();
    } catch (err: any) {
      showToast("Failed to fire KOT: " + (err.message || "Network Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 8. TWO-STAGE PAYMENT / SETTLE WORKFLOW ─────────────────────── */
  // STEP 1: PAYMENT COLLECTED (Triggers Thank You page on customer phone immediately)
  const handlePaymentCollected = async () => {
    if (!activeTableModal || subtotal === 0) {
      showToast("No active bill to collect payment for");
      return;
    }

    setIsSubmitting(true);
    try {
      const nonCancelledOrders = (activeSession?.orders || []).filter((o) => o.status !== "CANCELLED");
      const orderIds = nonCancelledOrders.map((o) => o.id);

      // 1. Commit any currently staged manual cart items as PAID
      if (manualCart.length > 0) {
        const unsavedPayload = manualCart.map((c) => ({
          item: { id: c.id, name: c.name, basePrice: c.price, category: c.category, isVeg: c.isVeg },
          price: c.price,
          quantity: c.quantity,
          notes: c.notes || "",
          isReady: true,
        }));
        const manualTotal = manualCart.reduce((s, it) => s + it.price * it.quantity, 0);
        const localOrderId = generateUUID();

        // 1a. Instant 0ms Local SQLite persistence
        await LocalSqliteStore.saveOrderLocally({
          id: localOrderId,
          restaurant_id: restaurantId || '',
          table_no: activeTableModal,
          customer_name: manualCustomerName.trim() || activeSession?.customerName || "Dine-in Guest",
          customer_phone: manualCustomerPhone.trim() || activeSession?.customerPhone || '',
          total: manualTotal,
          items_json: unsavedPayload,
          status: "COMPLETED",
          payment_status: "PAID",
          payment_method: "COUNTER",
          created_at: new Date().toISOString(),
          synced: 0,
        }).catch(e => console.warn('Local SQLite write error:', e));

        // 1b. Cloud push if online
        if (typeof navigator === 'undefined' || navigator.onLine) {
          try {
            const { error: insErr } = await supabase.from("orders").insert({
              id: localOrderId,
              restaurant_id: restaurantId,
              table_no: activeTableModal,
              total: manualTotal,
              status: "COMPLETED",
              payment_status: "PAID",
              payment_method: "COUNTER",
              customer_name: manualCustomerName.trim() || activeSession?.customerName || "Dine-in Guest",
              customer_phone: manualCustomerPhone.trim() || activeSession?.customerPhone || null,
              items_json: unsavedPayload,
              note: `[POS Final Round - PAID] ${activeTableId ? `[tid:${activeTableId}] ` : ''}[PIN:${currentTablePin}]`,
            });
            if (!insErr) {
              await LocalSqliteStore.markOrderSynced(localOrderId);
            }
          } catch (netErr) {
            console.warn("[POS] Staged cart paid offline:", netErr);
          }
        }

        setManualCart([]);
      }

      // 2. Mark existing active orders as PAID locally in SQLite
      if (orderIds.length > 0) {
        for (const ord of nonCancelledOrders) {
          await LocalSqliteStore.saveOrderLocally({
            id: ord.id,
            restaurant_id: restaurantId || '',
            table_no: ord.table_no,
            customer_name: ord.customer_name,
            customer_phone: ord.customer_phone,
            total: ord.total,
            items_json: ord.items_json,
            status: ord.status || "COMPLETED",
            payment_status: "PAID",
            payment_method: "COUNTER",
            created_at: ord.created_at || new Date().toISOString(),
            synced: 0,
          }).catch(() => {});
        }

        if (typeof navigator === 'undefined' || navigator.onLine) {
          try {
            const { error: updErr } = await supabase
              .from("orders")
              .update({
                payment_status: "PAID",
                payment_method: "COUNTER",
              })
              .in("id", orderIds);
            if (!updErr) {
              for (const oId of orderIds) {
                await LocalSqliteStore.markOrderSynced(oId);
              }
            }
          } catch (netErr) {
            console.warn("[POS] Mark paid offline:", netErr);
          }
        }
      }

      // 3. Save to local permanent invoice archive
      const localInvId = 'inv_' + Date.now();
      await LocalSqliteStore.saveInvoice({
        id: localInvId,
        restaurant_id: restaurantId || '',
        order_number: String(activeTableModal),
        table_name: String(activeTableModal),
        order_type: 'DINE_IN',
        customer_name: manualCustomerName.trim() || activeSession?.customerName || "Dine-in Guest",
        customer_phone: manualCustomerPhone.trim() || activeSession?.customerPhone || '',
        total_amount: subtotal || 0,
        payment_mode: 'COUNTER',
        payment_status: 'PAID',
        items_json: (activeSession?.orders || []).flatMap((o: any) => o.items_json || []),
        created_at: new Date().toISOString(),
        synced: 0,
      }).catch(e => console.warn('Local SQLite invoice error:', e));

      showToast(`${activeTableModal}: Payment collected! Thank you page shown on customer's phone.`);
      if (autoPrintOnSettle) {
        setTimeout(() => handlePrintGuestBill(), 120);
      }
      if (restaurantId) {
        await fetchActiveOrders(restaurantId);
        await fetchPastOrders(restaurantId);
      }
      OfflineSyncEngine.triggerSync();
    } catch (err: any) {
      showToast("Failed to mark payment: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: SETTLE (Guests have vacated table -> frees table & cycles PIN for next party)
  const handleSettleAndFreeTable = async () => {
    if (!activeTableModal) return;

    setIsSubmitting(true);
    try {
      const nonCancelledOrders = (activeSession?.orders || []).filter((o) => o.status !== "CANCELLED");
      const orderIds = nonCancelledOrders.map((o) => o.id);

      // Clean up acknowledged orders for settled orders
      if (orderIds.length > 0) {
        setAcknowledgedOrderIds((prev) => {
          const next = new Set(prev);
          orderIds.forEach((id) => next.delete(id));
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("tabletapy_pos_ack_orders", JSON.stringify(Array.from(next)));
            } catch {}
          }
          return next;
        });
      }

      // 1. Mark orders as COMPLETED and PAID locally in SQLite
      if (orderIds.length > 0) {
        for (const ord of nonCancelledOrders) {
          await LocalSqliteStore.saveOrderLocally({
            id: ord.id,
            restaurant_id: restaurantId || '',
            table_no: ord.table_no,
            customer_name: ord.customer_name,
            customer_phone: ord.customer_phone,
            total: ord.total,
            items_json: ord.items_json,
            status: "COMPLETED",
            payment_status: "PAID",
            payment_method: ord.payment_method || "COUNTER",
            created_at: ord.created_at || new Date().toISOString(),
            synced: 0,
          }).catch(() => {});
        }

        // 2. Cloud update if online
        if (typeof navigator === 'undefined' || navigator.onLine) {
          try {
            const { error } = await supabase
              .from("orders")
              .update({
                status: "COMPLETED",
                payment_status: "PAID",
              })
              .in("id", orderIds);
            if (!error) {
              for (const oId of orderIds) {
                await LocalSqliteStore.markOrderSynced(oId);
              }
            }
          } catch (netErr) {
            console.warn("[POS] Settle table offline:", netErr);
          }
        }
      }

      showToast(`${activeTableModal} has been settled and is now vacant. PIN cycled for next party.`);
      setActiveTableModal(null);
      setManualCart([]);
      setBatchNote("");

      if (restaurantId) {
        await fetchActiveOrders(restaurantId);
        await fetchPastOrders(restaurantId);
      }
      OfflineSyncEngine.triggerSync();
    } catch (err: any) {
      showToast("Failed to settle table: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    setIsSubmitting(true);
    try {
      const targetOrd = activeOrders.find((o) => o.id === orderId);
      if (targetOrd && restaurantId) {
        await LocalSqliteStore.saveOrderLocally({
          id: targetOrd.id,
          restaurant_id: restaurantId,
          table_no: targetOrd.table_no,
          customer_name: targetOrd.customer_name,
          customer_phone: targetOrd.customer_phone,
          total: targetOrd.total,
          items_json: targetOrd.items_json,
          status: "PREPARING",
          payment_status: targetOrd.payment_status,
          payment_method: targetOrd.payment_method,
          created_at: targetOrd.created_at || new Date().toISOString(),
          synced: 0,
        }).catch(() => {});
      }

      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const { error } = await supabase
            .from("orders")
            .update({ status: "PREPARING" })
            .eq("id", orderId);
          if (!error) {
            await LocalSqliteStore.markOrderSynced(orderId);
          }
        } catch (netErr) {
          console.warn("[POS] Approve order offline:", netErr);
        }
      }

      showToast("Order approved & fired to kitchen!");
      if (restaurantId) {
        fetchActiveOrders(restaurantId);
      }
      OfflineSyncEngine.triggerSync();
    } catch (err: any) {
      showToast("Failed to approve order: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    setIsSubmitting(true);
    try {
      const targetOrd = activeOrders.find((o) => o.id === orderId);
      if (targetOrd && restaurantId) {
        await LocalSqliteStore.saveOrderLocally({
          id: targetOrd.id,
          restaurant_id: restaurantId,
          table_no: targetOrd.table_no,
          customer_name: targetOrd.customer_name,
          customer_phone: targetOrd.customer_phone,
          total: targetOrd.total,
          items_json: targetOrd.items_json,
          status: "CANCELLED",
          payment_status: targetOrd.payment_status,
          payment_method: targetOrd.payment_method,
          created_at: targetOrd.created_at || new Date().toISOString(),
          synced: 0,
        }).catch(() => {});
      }

      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const { error } = await supabase
            .from("orders")
            .update({ status: "CANCELLED" })
            .eq("id", orderId);
          if (!error) {
            await LocalSqliteStore.markOrderSynced(orderId);
          }
        } catch (netErr) {
          console.warn("[POS] Reject order offline:", netErr);
        }
      }

      showToast("Order rejected / voided.");
      if (restaurantId) {
        fetchActiveOrders(restaurantId);
      }
      OfflineSyncEngine.triggerSync();
    } catch (err: any) {
      showToast("Failed to reject order: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 9. Print Guest Bill & Reprint KOT ──────────────────────────── */
  const handlePrintGuestBill = () => {
    if (!activeTableModal) return;

    const allBillItems: Array<{ name: string; quantity: number; notes?: string; price?: number }> = [];

    activeSession?.allItems.forEach((it) => {
      allBillItems.push({
        name: it.name,
        quantity: it.quantity,
        notes: it.notes,
        price: it.price,
      });
    });

    manualCart.forEach((it) => {
      allBillItems.push({
        name: it.name,
        quantity: it.quantity,
        notes: it.notes,
        price: it.price,
      });
    });

    const billChitData = {
      type: "BILL" as const,
      mode: "DINE_IN" as const,
      tableOrToken: activeTableModal,
      customerName: manualCustomerName || activeSession?.customerName,
      customerPhone: manualCustomerPhone || activeSession?.customerPhone,
      items: allBillItems,
      subtotal,
      discount: effectiveDiscount > 0 ? effectiveDiscount : undefined,
      serviceCharge: serviceChargeAmount > 0 ? serviceChargeAmount : undefined,
      serviceChargeRate: taxSettings.serviceChargeRate,
      cgst: cgstAmount,
      sgst: sgstAmount,
      cgstRate: dineInBillCalc.effectiveCgstRate,
      sgstRate: dineInBillCalc.effectiveSgstRate,
      tax: gstAmount,
      roundOff,
      grandTotal,
      isInclusive: dineInBillCalc.isInclusive,
      isComposition: dineInBillCalc.isComposition,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setPrintChit(billChitData);

    printThermalChit({
      restaurantName,
      restaurantAddress,
      gstin: taxSettings.gstin,
      fssai: taxSettings.fssai,
      type: 'BILL',
      tableName: activeTableModal,
      orderType: 'DINE_IN',
      timestamp: billChitData.time,
      items: allBillItems.map(it => ({ name: it.name, quantity: it.quantity, price: it.price, total: (it.price || 0) * (it.quantity || 1) })),
      subtotal,
      discount: effectiveDiscount > 0 ? effectiveDiscount : undefined,
      serviceCharge: serviceChargeAmount > 0 ? serviceChargeAmount : undefined,
      cgst: cgstAmount,
      sgst: sgstAmount,
      totalGst: gstAmount,
      grandTotal,
      footerMessage: "Thank you! Visit again.",
    }, {
      fallbackCallback: () => {
        setTimeout(() => { if (typeof window !== 'undefined') window.print(); }, 100);
      }
    });
  };

  const handleReprintKOT = (round: TableRound) => {
    const reprintKotData = {
      type: "KOT" as const,
      mode: "DINE_IN" as const,
      tableOrToken: activeTableModal || "Table",
      kotNumber: round.roundNumber,
      customerName: activeSession?.customerName,
      customerPhone: activeSession?.customerPhone,
      items: round.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        notes: it.notes,
      })),
      time: new Date(round.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setPrintChit(reprintKotData);

    printThermalChit({
      restaurantName,
      restaurantAddress,
      type: 'KOT',
      tableName: activeTableModal || "Table",
      orderType: 'DINE_IN',
      orderNumber: round.roundNumber,
      timestamp: reprintKotData.time,
      items: reprintKotData.items.map(it => ({ name: it.name, quantity: it.quantity, notes: it.notes })),
    }, {
      fallbackCallback: () => {
        setTimeout(() => { if (typeof window !== 'undefined') window.print(); }, 100);
      }
    });
  };

  /* ─── 10. Table Transfer ────────────────────────────────────────── */
  const handleExecuteTransfer = async () => {
    if (!activeTableModal || !transferTargetTable) return;
    const targetTable = transferTargetTable;

    const activeOrdersForTable = activeSession?.orders || [];
    if (activeOrdersForTable.length === 0) {
      showToast("No active orders on this table to transfer");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderIds = activeOrdersForTable.map((o) => o.id);

      const { error } = await supabase
        .from("orders")
        .update({
          table_no: targetTable,
        })
        .in("id", orderIds);

      if (error) throw error;

      showToast(`Transferred active orders to ${targetTable}`);
      setIsTransferModalOpen(false);
      setTransferTargetTable("");
      setActiveTableModal(targetTable);

      if (restaurantId) fetchActiveOrders(restaurantId);
    } catch (err: any) {
      showToast("Transfer failed: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 11. Takeaway Computations & Handlers ───────────────────────── */
  const activeTakeawayOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      const isTakeaway =
        (o.table_no || "").toLowerCase().includes("takeaway") ||
        (o.table_no || "").toLowerCase().includes("token");
      return isTakeaway && o.status !== "COMPLETED" && o.status !== "CANCELLED";
    });
  }, [activeOrders]);

  const todayTakeawayOrders = useMemo(() => {
    const todayStr = new Date().toDateString();
    return [...activeOrders, ...pastOrdersHistory].filter((o) => {
      const isTakeaway =
        (o.table_no || "").toLowerCase().includes("takeaway") ||
        (o.table_no || "").toLowerCase().includes("token");
      if (!isTakeaway) return false;
      const orderDate = new Date(o.created_at).toDateString();
      return orderDate === todayStr;
    });
  }, [activeOrders, pastOrdersHistory]);

  const todayTakeawayRevenue = useMemo(() => {
    return todayTakeawayOrders
      .filter((o) => o.payment_status === "PAID" && o.status !== "CANCELLED")
      .reduce((sum, o) => sum + (o.total || 0), 0);
  }, [todayTakeawayOrders]);

  const nextTokenNumber = useMemo(() => {
    let maxToken = 0;
    todayTakeawayOrders.forEach((o) => {
      const match = (o.table_no || "").match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxToken) maxToken = num;
      }
    });
    return maxToken > 0 ? maxToken + 1 : todayTakeawayOrders.length + 1;
  }, [todayTakeawayOrders]);

  const currentToken = tokenOverride ?? randomToken;

  const takeawaySubtotal = useMemo(() => {
    return takeawayCart.reduce((sum, it) => sum + it.price * it.quantity, 0);
  }, [takeawayCart]);

  const takeawayDiscountAmount = useMemo(() => {
    if (takeawayDiscountPercent > 0) {
      return (takeawaySubtotal * takeawayDiscountPercent) / 100;
    }
    const rup = parseFloat(takeawayDiscountRupees);
    if (!isNaN(rup) && rup > 0) {
      return Math.min(rup, takeawaySubtotal);
    }
    return 0;
  }, [takeawaySubtotal, takeawayDiscountPercent, takeawayDiscountRupees]);

  const takeawayPackagingAmount = useMemo(() => {
    if (takeawayPackagingTier === "BAG_5") return 5;
    if (takeawayPackagingTier === "BOX_15") return 15;
    return 0;
  }, [takeawayPackagingTier]);

  const takeawayBillCalc: BillTaxCalculation = useMemo(() => {
    return calculateBillTaxes({
      subtotal: takeawaySubtotal,
      discountAmount: takeawayDiscountAmount,
      packagingAmount: takeawayPackagingAmount,
      isDineIn: false,
      settings: taxSettings,
    });
  }, [takeawaySubtotal, takeawayDiscountAmount, takeawayPackagingAmount, taxSettings]);

  const takeawayTotal = takeawayBillCalc.grandTotal;

  const cashTenderPresets = useMemo(() => {
    if (takeawayTotal <= 0) return [];
    const presets = new Set<number>();
    presets.add(takeawayTotal);

    const next50 = Math.ceil(takeawayTotal / 50) * 50;
    if (next50 > takeawayTotal) presets.add(next50);

    const next100 = Math.ceil(takeawayTotal / 100) * 100;
    if (next100 > takeawayTotal) presets.add(next100);

    if (takeawayTotal < 500) presets.add(500);
    if (takeawayTotal >= 300 && takeawayTotal < 1000) presets.add(1000);

    return Array.from(presets).sort((a, b) => a - b);
  }, [takeawayTotal]);

  const cashChangeDue = useMemo(() => {
    if (takeawayPaymentMethod !== "CASH") return null;
    const tendered = parseFloat(cashTenderAmount);
    if (isNaN(tendered) || tendered <= 0) return null;
    return Math.round(tendered - takeawayTotal);
  }, [takeawayPaymentMethod, cashTenderAmount, takeawayTotal]);

  const handleUpdateTakeawayQty = (id: string, delta: number) => {
    setTakeawayCart((prev) => {
      return prev
        .map((it) => {
          if (it.id === id) {
            const nextQty = it.quantity + delta;
            return nextQty > 0 ? { ...it, quantity: nextQty } : null;
          }
          return it;
        })
        .filter(Boolean) as NewStaffItem[];
    });
  };

  const handleRemoveTakeawayItem = (id: string) => {
    setTakeawayCart((prev) => prev.filter((it) => it.id !== id));
  };

  const handleClearTakeawayCart = () => {
    setTakeawayCart([]);
    setTakeawayBatchNote("");
    setTakeawayDiscountPercent(0);
    setTakeawayDiscountRupees("");
    setTakeawayShowDiscount(false);
    setTakeawayPackagingTier("NONE");
    setCashTenderAmount("");
    setShowGuestDetails(false);
  };

  const handleCollectAndFireTakeaway = async () => {
    if (takeawayCart.length === 0) {
      showToast("Cannot fire empty token. Add dishes from catalog.");
      return;
    }

    setIsSubmitting(true);
    try {
      const tokenFormatted = `Token #${currentToken}`;
      const tokenIdentifier = `Takeaway #${currentToken}`;

      const itemsPayload = takeawayCart.map((c) => ({
        item: {
          id: c.dishId || c.id,
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

      const noteParts: string[] = [`[${tokenFormatted}]`];
      if (takeawayPackagingTier === "BAG_5") noteParts.push("[Paper Bag: ₹5]");
      if (takeawayPackagingTier === "BOX_15") noteParts.push("[Carrier/Box: ₹15]");
      if (takeawayDiscountAmount > 0) noteParts.push(`[Discount: ₹${takeawayDiscountAmount.toFixed(0)}]`);
      if (cashChangeDue !== null && cashChangeDue >= 0) noteParts.push(`[Tender: ₹${cashTenderAmount}, Change: ₹${cashChangeDue}]`);
      if (takeawayBatchNote.trim()) noteParts.push(takeawayBatchNote.trim());

      const localTakeawayId = generateUUID();

      // 1. Instant Local SQLite persistence
      await LocalSqliteStore.saveOrderLocally({
        id: localTakeawayId,
        restaurant_id: restaurantId || '',
        table_no: tokenIdentifier,
        customer_name: takeawayCustomerName || 'Takeaway Guest',
        customer_phone: takeawayCustomerPhone || '',
        total: takeawayTotal,
        items_json: takeawayCart.map((c: any) => ({ name: c.item?.name || c.name || 'Item', quantity: c.quantity, price: c.price, notes: c.notes })),
        status: 'COMPLETED',
        payment_status: 'PAID',
        payment_method: takeawayPaymentMethod,
        created_at: new Date().toISOString(),
        synced: 0,
      }).catch(e => console.warn('Local SQLite write error:', e));

      // Save to permanent local invoices archive
      await LocalSqliteStore.saveInvoice({
        id: 'inv_' + localTakeawayId,
        restaurant_id: restaurantId || '',
        order_number: tokenFormatted,
        table_name: tokenFormatted,
        order_type: 'TAKEAWAY',
        customer_name: takeawayCustomerName || 'Takeaway Guest',
        customer_phone: takeawayCustomerPhone || '',
        total_amount: takeawayTotal,
        payment_mode: takeawayPaymentMethod,
        payment_status: 'PAID',
        items_json: itemsPayload,
        created_at: new Date().toISOString(),
        synced: 0,
      }).catch(e => console.warn('Local SQLite invoice error:', e));

      // 2. Silent cloud push if online
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const { error } = await supabase.from("orders").insert({
            id: localTakeawayId,
            restaurant_id: restaurantId,
            table_no: tokenIdentifier,
            total: takeawayTotal,
            status: "PREPARING",
            payment_status: "PAID",
            payment_method: takeawayPaymentMethod,
            customer_name: takeawayCustomerName.trim() || "Takeaway Guest",
            customer_phone: takeawayCustomerPhone.trim() || null,
            items_json: itemsPayload,
            note: noteParts.join(" "),
          });
          if (!error) {
            await LocalSqliteStore.markOrderSynced(localTakeawayId);
            await LocalSqliteStore.markInvoiceSynced('inv_' + localTakeawayId);
          }
        } catch (netErr) {
          console.warn("[POS] Processed takeaway offline, queued in SQLite:", netErr);
        }
      }

      OfflineSyncEngine.triggerSync();

      // Set Thermal Print Chit
      setPrintChit({
        type: "BILL",
        mode: "TAKEAWAY",
        tableOrToken: tokenFormatted,
        kotNumber: currentToken,
        customerName: takeawayCustomerName.trim() || "Takeaway Guest",
        customerPhone: takeawayCustomerPhone.trim() || undefined,
        items: takeawayCart.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          notes: c.notes,
          price: c.price,
        })),
        subtotal: takeawaySubtotal,
        packaging: takeawayPackagingAmount > 0 ? takeawayPackagingAmount : undefined,
        discount: takeawayDiscountAmount > 0 ? takeawayDiscountAmount : undefined,
        cgst: takeawayBillCalc.cgstAmount,
        sgst: takeawayBillCalc.sgstAmount,
        cgstRate: takeawayBillCalc.effectiveCgstRate,
        sgstRate: takeawayBillCalc.effectiveSgstRate,
        tax: takeawayBillCalc.totalGst,
        roundOff: takeawayBillCalc.roundOff,
        grandTotal: takeawayTotal,
        isInclusive: takeawayBillCalc.isInclusive,
        isComposition: takeawayBillCalc.isComposition,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      showToast(`${tokenFormatted} punched & paid (₹${takeawayTotal})`);

      setTakeawayCart([]);
      setTakeawayCustomerName("");
      setTakeawayCustomerPhone("");
      setTakeawayBatchNote("");
      setTakeawayPackagingTier("NONE");
      setCashTenderAmount("");
      setShowGuestDetails(false);
      setTakeawayDiscountPercent(0);
      setTakeawayDiscountRupees("");
      setTakeawayShowDiscount(false);
      setRandomToken(generate4DigitToken());
      setTokenOverride(null);
      setShowCashTenderModal(false);

      if (restaurantId) {
        fetchActiveOrders(restaurantId);
        fetchPastOrders(restaurantId);
      }

      printThermalChit({
        restaurantName,
        restaurantAddress,
        gstin: taxSettings.gstin,
        fssai: taxSettings.fssai,
        type: 'TOKEN',
        tableName: tokenFormatted,
        orderType: 'TAKEAWAY',
        orderNumber: currentToken,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        items: takeawayCart.map(c => ({ name: c.name, quantity: c.quantity, price: c.price, notes: c.notes })),
        subtotal: takeawaySubtotal,
        packagingCharge: takeawayPackagingAmount,
        cgst: takeawayBillCalc.cgstAmount,
        sgst: takeawayBillCalc.sgstAmount,
        totalGst: takeawayBillCalc.totalGst,
        grandTotal: takeawayTotal,
        paymentMode: takeawayPaymentMethod,
        footerMessage: "Thank you! Visit again.",
      }, {
        fallbackCallback: () => {
          setTimeout(() => { if (typeof window !== 'undefined') window.print(); }, 100);
        }
      });
    } catch (err: any) {
      showToast("Failed to process token: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkTakeawayHandedOver = async (orderId: string, tokenName: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "COMPLETED",
          payment_status: "PAID",
        })
        .eq("id", orderId);

      if (error) throw error;
      showToast(`${tokenName.replace("Takeaway", "Token")} handed over`);
      if (restaurantId) {
        fetchActiveOrders(restaurantId);
        fetchPastOrders(restaurantId);
      }
    } catch (err: any) {
      showToast("Error updating order: " + err.message);
    }
  };

  const handleReprintTakeawayOrder = (order: OrderRecord) => {
    let items: any[] = [];
    if (Array.isArray(order.items_json)) {
      items = order.items_json.map((it: any) => ({
        name: it.item?.name || it.name || "Item",
        quantity: it.quantity || 1,
        notes: it.notes,
        price: it.price || it.item?.basePrice,
      }));
    }

    const tokenFormatted = order.table_no.replace("Takeaway", "Token");

    const reprintCalc = calculateBillTaxes({
      subtotal: order.total,
      isDineIn: false,
      settings: taxSettings,
    });

    const reprintTakeawayChit = {
      type: "BILL" as const,
      mode: "TAKEAWAY" as const,
      tableOrToken: tokenFormatted,
      customerName: order.customer_name || "Takeaway Guest",
      customerPhone: order.customer_phone || undefined,
      items,
      subtotal: order.total,
      cgst: reprintCalc.cgstAmount,
      sgst: reprintCalc.sgstAmount,
      cgstRate: reprintCalc.effectiveCgstRate,
      sgstRate: reprintCalc.effectiveSgstRate,
      tax: reprintCalc.totalGst,
      roundOff: reprintCalc.roundOff,
      grandTotal: order.total,
      isInclusive: reprintCalc.isInclusive,
      isComposition: reprintCalc.isComposition,
      time: new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setPrintChit(reprintTakeawayChit);

    printThermalChit({
      restaurantName,
      restaurantAddress,
      gstin: taxSettings.gstin,
      fssai: taxSettings.fssai,
      type: 'BILL',
      tableName: tokenFormatted,
      orderType: 'TAKEAWAY',
      timestamp: reprintTakeawayChit.time,
      items: items.map(it => ({ name: it.name, quantity: it.quantity, price: it.price })),
      subtotal: order.total,
      cgst: reprintCalc.cgstAmount,
      sgst: reprintCalc.sgstAmount,
      totalGst: reprintCalc.totalGst,
      grandTotal: order.total,
      footerMessage: "Thank you! Visit again.",
    }, {
      fallbackCallback: () => {
        setTimeout(() => { if (typeof window !== 'undefined') window.print(); }, 100);
      }
    });
  };

  /* ─── Render View ────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full bg-white text-zinc-900 select-none overflow-hidden font-sans">
      
      {/* ── FLOOR GRID VIEW ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 slim-scrollbar bg-[#FAF8F7]/40">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <div className="w-8 h-8 border-2 border-zinc-200 border-t-[#E46254] rounded-full animate-spin" />
            <p className="text-xs font-medium">Loading tables...</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-zinc-200/80 max-w-md mx-auto my-12 shadow-2xs">
            <h3 className="font-bold text-sm text-zinc-800">No tables configured</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Add your dining tables in Locations to view your floor.
            </p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-4">
            {/* ── Floor Zone Filter Bar (Apple Milled Glass Dock) ── */}
            {allZones.length > 1 && (
              <div className="flex items-center overflow-x-auto pb-2 scrollbar-none">
                <div className="p-1 rounded-2xl bg-zinc-200/60 backdrop-blur-2xl border border-zinc-200/80 inline-flex items-center gap-1 max-w-full">
                  <button
                    onClick={() => setSelectedZone("ALL")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedZone === "ALL"
                        ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/60 "
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60 "
                    }`}
                  >
                    All Zones ({locations.length})
                  </button>
                  {allZones.map((z) => {
                    const count = locations.filter(
                      (l) => (tableZones[l.id] || l.zone || "Main Floor") === z
                    ).length;
                    return (
                      <button
                        key={z}
                        onClick={() => setSelectedZone(z)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          selectedZone === z
                            ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/60 "
                            : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60 "
                        }`}
                      >
                        {z} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Floor Table Cards (Grouped by Zone when ALL, or Filtered by Zone) ── */}
            {selectedZone === "ALL" && allZones.length > 1 ? (
              <div className="space-y-6">
                {allZones.map((zoneName) => {
                  const zoneTables = locations.filter(
                    (t) => (tableZones[t.id] || t.zone || "Main Floor") === zoneName
                  );
                  if (zoneTables.length === 0) return null;

                  const sortedZoneTables = sortTablesByAlertAndName(zoneTables);
                  const zoneAlertCount = sortedZoneTables.filter((t) => {
                    const s = tableSessionMap.get(t.id) || tableSessionMap.get(t.name);
                    return s?.hasNewRound || s?.hasBillRequest || s?.hasUpiVerifyRequest;
                  }).length;

                  return (
                    <div key={zoneName} className="space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/70">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#E46254]" />
                          <h3 className="text-xs sm:text-sm font-bold tracking-tight text-zinc-900 uppercase">
                            {zoneName}
                          </h3>
                          <span className="text-[11px] font-semibold text-zinc-400">
                            ({sortedZoneTables.length} {sortedZoneTables.length === 1 ? "table" : "tables"})
                          </span>
                        </div>
                        {zoneAlertCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#E46254]/10 text-[#E46254] border border-[#E46254]/20 animate-pulse">
                            {zoneAlertCount} {zoneAlertCount === 1 ? "Alert" : "Alerts"}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                        {sortedZoneTables.map((table) => {
                          const session = tableSessionMap.get(table.id) || tableSessionMap.get(table.name);
                          const isOccupied = session && session.status !== "VACANT";
                          const hasNewRound = session?.hasNewRound;
                          const hasBillRequest = session?.hasBillRequest;
                          const hasUpiVerifyRequest = session?.hasUpiVerifyRequest;
                          const isPaid = session?.isPaid;
                          const elapsedMinutes = session?.firstOrderAt
                            ? Math.max(0, Math.floor((currentTimeTick - new Date(session.firstOrderAt).getTime()) / 60000))
                            : 0;

                          const totalFormatted = session?.totalBill 
                            ? `₹${Math.round(session.totalBill).toLocaleString("en-IN")}`
                            : "₹0";

                          const capacityCount = table.capacity || 4;

                          return (
<div
                                key={table.id}
                                onClick={() => handleOpenTableCommand(table.name, table.id)}
                                className={`group relative rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer min-h-[140px] transition-all duration-200 select-none active:scale-[0.98] ${
                                  hasNewRound
                                    ? "bg-white border-2 border-[#E46254] shadow-lg shadow-[#E46254]/20 ring-2 ring-[#E46254]/30 table-attention-shake"
                                    : hasBillRequest
                                    ? "bg-white border-2 border-amber-400 shadow-md shadow-amber-400/20 table-attention-shake"
                                    : isPaid
                                    ? "bg-white border-2 border-emerald-500/80 shadow-xs hover:border-emerald-600 hover:shadow-md "
                                    : hasUpiVerifyRequest
                                    ? "bg-white border-2 border-blue-400 shadow-xs hover:border-blue-500 hover:shadow-md "
                                    : isOccupied
                                    ? "bg-white border border-[#E46254]/75 shadow-[0_2px_12px_-2px_rgba(228,98,84,0.18),0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-[#E46254]/25 hover:border-[#E46254] hover:shadow-[0_4px_18px_-2px_rgba(228,98,84,0.25)]"
                                    : "bg-white/90 backdrop-blur-2xl border border-zinc-200/80 shadow-xs hover:bg-white hover:border-zinc-300 hover:shadow-md "
                                }`}
                              >
                                {/* Top Specular Edge Glow for Running & Alert Cards */}
                                {hasNewRound && (
                                  <div className="absolute top-0 left-4 right-4 h-1 bg-[#E46254] rounded-b-full shadow-xs" />
                                )}
                                {hasBillRequest && !hasNewRound && (
                                  <div className="absolute top-0 left-4 right-4 h-1 bg-amber-400 rounded-b-full shadow-xs" />
                                )}
                                {isPaid && !hasNewRound && (
                                  <div className="absolute top-0 left-4 right-4 h-1 bg-emerald-500 rounded-b-full shadow-xs" />
                                )}
                                {isOccupied && !hasNewRound && !hasBillRequest && !isPaid && (
                                  <div className="absolute top-0 left-3 right-3 h-[2px] bg-gradient-to-r from-transparent via-[#E46254] to-transparent rounded-full opacity-90" />
                                )}

                                {/* ── 1. Top Row: Table Name + Capacity & Status Chip ── */}
                                <div className="flex items-start justify-between gap-1.5">
                                  <div>
                                    <span className="font-black text-lg sm:text-xl tracking-tight text-zinc-900 group-hover:text-[#E46254] transition-colors leading-none">
                                      {table.name}
                                    </span>
                                    <div className="flex items-center gap-1 mt-1 text-zinc-400">
                                      <Users size={11} strokeWidth={2} />
                                      <span className="text-[11px] font-semibold tracking-tight">{capacityCount}</span>
                                    </div>
                                  </div>

                                  {/* Status Badges: True Translucent Crystal Badges */}
                                  <div>
                                    {hasNewRound ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E46254] text-white text-[10px] font-black tracking-wider shadow-xs animate-pulse">
                                        New Order
                                      </span>
                                    ) : isPaid ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold tracking-wide">
                                        <CheckCircle2 size={10} />
                                        <span>Paid</span>
                                      </span>
                                    ) : hasBillRequest ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold tracking-wide">
                                        <Receipt size={10} />
                                        <span>Bill</span>
                                      </span>
                                    ) : hasUpiVerifyRequest ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-bold tracking-wide">
                                        <CreditCard size={10} />
                                        <span>UPI</span>
                                      </span>
                                    ) : isOccupied ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#E46254] bg-[#E46254]/10 border border-[#E46254]/20">
                                        Running
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100/80 text-zinc-500 border border-zinc-200/60 text-[10px] font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                        <span>Free</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* ── 2. Middle Row: Guest / Order Insights or Vacant Prompt ── */}
                                <div className="my-2">
                                  {isOccupied ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 text-zinc-800">
                                        <User size={11} className="text-zinc-400 shrink-0" />
                                        <span className="text-[12px] font-bold truncate">
                                          {session?.customerName || `Seated Guest`}
                                        </span>
                                      </div>
                                      <p className="text-[11px] font-medium text-zinc-400 pl-4">
                                        {session?.rounds?.length || 0} {(session?.rounds?.length || 0) === 1 ? "round" : "rounds"} · {session?.allItems?.length || 0} items
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="py-1">
                                      <span className="text-[11.5px] font-medium text-zinc-400 group-hover:text-zinc-700 transition-colors flex items-center gap-1">
                                        <Plus size={12} className="text-zinc-300 group-hover:text-[#E46254] transition-colors" />
                                        <span>Tap to Seat</span>
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* ── 3. Bottom Row: Bill Total + Live Elapsed Time ── */}
                                <div className="pt-2 flex items-baseline justify-between border-t border-zinc-100/80">
                                  {isOccupied ? (
                                    <>
                                      <span className="text-[17px] font-black text-zinc-900 font-mono tracking-tight tabular-nums">
                                        {totalFormatted}
                                      </span>
                                      {elapsedMinutes > 0 ? (
                                        <span className="flex items-center gap-1 text-[10.5px] font-mono text-zinc-600 font-semibold bg-zinc-100/90 px-1.5 py-0.5 rounded-md border border-zinc-200/60">
                                          <Clock size={10} className="text-zinc-400" />
                                          <span>{elapsedMinutes}m</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                                          Just in
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs font-mono text-zinc-400 font-medium">Ready</span>
                                      <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-700 flex items-center gap-0.5 transition-colors">
                                        <span>Open</span>
                                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {(() => {
                  const targetTables = selectedZone === "ALL"
                    ? locations
                    : locations.filter((t) => (tableZones[t.id] || t.zone || "Main Floor") === selectedZone);
                  const sorted = sortTablesByAlertAndName(targetTables);

                  return sorted.map((table) => {
                    const session = tableSessionMap.get(table.id) || tableSessionMap.get(table.name);
                    const isOccupied = session && session.status !== "VACANT";
                    const hasNewRound = session?.hasNewRound;
                    const hasBillRequest = session?.hasBillRequest;
                    const hasUpiVerifyRequest = session?.hasUpiVerifyRequest;
                    const isPaid = session?.isPaid;
                    const elapsedMinutes = session?.firstOrderAt
                      ? Math.max(0, Math.floor((currentTimeTick - new Date(session.firstOrderAt).getTime()) / 60000))
                      : 0;

                    const totalFormatted = session?.totalBill 
                      ? `₹${Math.round(session.totalBill).toLocaleString("en-IN")}`
                      : "₹0";

                    const capacityCount = table.capacity || 4;

                    return (
<div
                                key={table.id}
                                onClick={() => handleOpenTableCommand(table.name, table.id)}
                                className={`group relative rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer min-h-[140px] transition-all duration-200 select-none active:scale-[0.98] ${
                                  hasNewRound
                                    ? "bg-white border-2 border-[#E46254] shadow-lg shadow-[#E46254]/20 ring-2 ring-[#E46254]/30 table-attention-shake"
                                    : hasBillRequest
                                    ? "bg-white border-2 border-amber-400 shadow-md shadow-amber-400/20 table-attention-shake"
                                    : isPaid
                                    ? "bg-white border-2 border-emerald-500/80 shadow-xs hover:border-emerald-600 hover:shadow-md "
                                    : hasUpiVerifyRequest
                                    ? "bg-white border-2 border-blue-400 shadow-xs hover:border-blue-500 hover:shadow-md "
                                    : isOccupied
                                    ? "bg-white border border-[#E46254]/75 shadow-[0_2px_12px_-2px_rgba(228,98,84,0.18),0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-[#E46254]/25 hover:border-[#E46254] hover:shadow-[0_4px_18px_-2px_rgba(228,98,84,0.25)]"
                                    : "bg-white/90 backdrop-blur-2xl border border-zinc-200/80 shadow-xs hover:bg-white hover:border-zinc-300 hover:shadow-md "
                                }`}
                              >
                                {/* Top Specular Edge Glow for Running & Alert Cards */}
                                {hasNewRound && (
                                  <div className="absolute top-0 left-4 right-4 h-1 bg-[#E46254] rounded-b-full shadow-xs" />
                                )}
                                {hasBillRequest && !hasNewRound && (
                                  <div className="absolute top-0 left-4 right-4 h-1 bg-amber-400 rounded-b-full shadow-xs" />
                                )}
                                {isPaid && !hasNewRound && (
                                  <div className="absolute top-0 left-4 right-4 h-1 bg-emerald-500 rounded-b-full shadow-xs" />
                                )}
                                {isOccupied && !hasNewRound && !hasBillRequest && !isPaid && (
                                  <div className="absolute top-0 left-3 right-3 h-[2px] bg-gradient-to-r from-transparent via-[#E46254] to-transparent rounded-full opacity-90" />
                                )}

                                {/* ── 1. Top Row: Table Name + Capacity & Status Chip ── */}
                                <div className="flex items-start justify-between gap-1.5">
                                  <div>
                                    <span className="font-black text-lg sm:text-xl tracking-tight text-zinc-900 group-hover:text-[#E46254] transition-colors leading-none">
                                      {table.name}
                                    </span>
                                    <div className="flex items-center gap-1 mt-1 text-zinc-400">
                                      <Users size={11} strokeWidth={2} />
                                      <span className="text-[11px] font-semibold tracking-tight">{capacityCount}</span>
                                    </div>
                                  </div>

                                  {/* Status Badges: True Translucent Crystal Badges */}
                                  <div>
                                    {hasNewRound ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E46254] text-white text-[10px] font-black tracking-wider shadow-xs animate-pulse">
                                        New Order
                                      </span>
                                    ) : isPaid ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold tracking-wide">
                                        <CheckCircle2 size={10} />
                                        <span>Paid</span>
                                      </span>
                                    ) : hasBillRequest ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold tracking-wide">
                                        <Receipt size={10} />
                                        <span>Bill</span>
                                      </span>
                                    ) : hasUpiVerifyRequest ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-bold tracking-wide">
                                        <CreditCard size={10} />
                                        <span>UPI</span>
                                      </span>
                                    ) : isOccupied ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#E46254] bg-[#E46254]/10 border border-[#E46254]/20">
                                        Running
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100/80 text-zinc-500 border border-zinc-200/60 text-[10px] font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                        <span>Free</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* ── 2. Middle Row: Guest / Order Insights or Vacant Prompt ── */}
                                <div className="my-2">
                                  {isOccupied ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 text-zinc-800">
                                        <User size={11} className="text-zinc-400 shrink-0" />
                                        <span className="text-[12px] font-bold truncate">
                                          {session?.customerName || `Seated Guest`}
                                        </span>
                                      </div>
                                      <p className="text-[11px] font-medium text-zinc-400 pl-4">
                                        {session?.rounds?.length || 0} {(session?.rounds?.length || 0) === 1 ? "round" : "rounds"} · {session?.allItems?.length || 0} items
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="py-1">
                                      <span className="text-[11.5px] font-medium text-zinc-400 group-hover:text-zinc-700 transition-colors flex items-center gap-1">
                                        <Plus size={12} className="text-zinc-300 group-hover:text-[#E46254] transition-colors" />
                                        <span>Tap to Seat</span>
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* ── 3. Bottom Row: Bill Total + Live Elapsed Time ── */}
                                <div className="pt-2 flex items-baseline justify-between border-t border-zinc-100/80">
                                  {isOccupied ? (
                                    <>
                                      <span className="text-[17px] font-black text-zinc-900 font-mono tracking-tight tabular-nums">
                                        {totalFormatted}
                                      </span>
                                      {elapsedMinutes > 0 ? (
                                        <span className="flex items-center gap-1 text-[10.5px] font-mono text-zinc-600 font-semibold bg-zinc-100/90 px-1.5 py-0.5 rounded-md border border-zinc-200/60">
                                          <Clock size={10} className="text-zinc-400" />
                                          <span>{elapsedMinutes}m</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                                          Just in
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs font-mono text-zinc-400 font-medium">Ready</span>
                                      <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-700 flex items-center gap-0.5 transition-colors">
                                        <span>Open</span>
                                        <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </div>
      {/* ── TAKEAWAY / QUICK-BILL COMMAND STATION (FULL-SCREEN SMOOTH ANIMATED OVERLAY) ── */}
      <div
        className={`fixed inset-0 z-50 bg-[#FAF8F7] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          terminalMode === "TAKEAWAY"
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-4 scale-[0.99] pointer-events-none"
        }`}
      >
        {/* Top Header Bar: Clean, Minimal, No Emojis */}
        <header className="h-14 bg-white border-b border-zinc-200/80 px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => switchMode("DINE_IN")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-black font-semibold text-xs transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span>Dine-In Floor</span>
            </button>

            <span className="text-zinc-300">|</span>

            <span className="font-bold text-sm text-zinc-900 tracking-tight">
              Takeaway Terminal
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
            <span className="hidden sm:inline">Punched Today:</span>
            <span className="font-mono font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
              {todayTakeawayOrders.length}
            </span>
          </div>
        </header>

        {/* Main Workspace: Catalog (62%) + Active Counter Ticket (38%) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-white">
          
          {/* ── LEFT PANEL (62%): High-Speed Menu Catalog ── */}
          <div className="w-full lg:w-[62%] flex flex-col border-r border-zinc-200/80 bg-[#FAF8F7] overflow-hidden">
            
            {/* Top Search Bar & Category Tabs */}
            <div className="p-4 bg-white border-b border-zinc-200/80 space-y-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                <input
                  ref={takeawaySearchInputRef}
                  type="text"
                  placeholder="Search dishes or categories (Press '/' to search)..."
                  value={dishSearchQuery}
                  onChange={(e) => setDishSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-[#FAF8F7] border border-zinc-200/80 rounded-xl text-xs font-medium outline-none focus:border-[#E46254] focus:bg-white transition-all placeholder:text-zinc-400"
                />
                {dishSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDishSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Category Tab Bar with Full Mouse Wheel Scroll */}
              <div
                id="takeaway-category-scroll"
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                className="flex items-center gap-2 overflow-x-auto pb-2 slim-scrollbar scroll-smooth"
                style={{ scrollbarWidth: "none" }}
              >
                {drawerCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    ref={(el) => {
                      if (selectedDrawerCat === cat && el) {
                        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                      }
                    }}
                    onClick={() => setSelectedDrawerCat(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap select-none ${
                      selectedDrawerCat === cat
                        ? "bg-[#E46254] text-white shadow-xs shadow-[#E46254]/25 scale-[1.02]"
                        : "bg-white hover:bg-[#E46254]/10 text-zinc-700 hover:text-[#E46254] border border-zinc-200/80 hover:border-[#E46254]/30 shadow-2xs"
                    }`}
                  >
                    {cat === "ALL" ? "All Items" : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* High-Speed Food Catalog Grid */}
            <div className="flex-1 overflow-y-auto p-4 slim-scrollbar">
              {filteredCatalog.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-center">
                  <UtensilsCrossed size={20} className="mb-2 opacity-50" />
                  <p className="text-xs font-medium">No dishes found matching search</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredCatalog.map((dish) => {
                    const hasPortions = Boolean(
                      dish.variantsConfig?.hasPortions &&
                      dish.variantsConfig.portions &&
                      dish.variantsConfig.portions.length > 0
                    );
                    const portions = hasPortions ? dish.variantsConfig!.portions : [];
                    const hasAddons = Boolean(dish.variantsConfig?.hasAddons);

                    const cartMatches = takeawayCart.filter((c) => c.dishId === dish.id || c.name === dish.name);
                    const totalSelectedQty = cartMatches.reduce((s, it) => s + it.quantity, 0);

                    return (
                      <div
                        key={dish.id}
                        className={`rounded-2xl p-3 border transition-all flex flex-col justify-between group shadow-2xs ${
                          totalSelectedQty > 0
                            ? "bg-white border-[#E46254]/50 shadow-sm shadow-[#E46254]/10 ring-1 ring-[#E46254]/25"
                            : "bg-white border-zinc-200/70 hover:border-[#E46254]/30 hover:shadow-md"
                        }`}
                      >
                        {/* Card Header: Veg dot + Clean Name with Ellipsis & Title */}
                        <div className="flex items-start gap-1.5 mb-2">
                          <span
                            className={`mt-1 w-2.5 h-2.5 rounded-sm border-[1.5px] shrink-0 ${
                              dish.is_veg
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-rose-500 bg-rose-50"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <span
                              title={dish.name}
                              className="font-bold text-[11.5px] text-zinc-900 group-hover:text-[#E46254] transition-colors leading-snug line-clamp-2 break-words"
                            >
                              {dish.name}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium block truncate mt-0.5">
                              {dish.category}
                            </span>
                          </div>
                        </div>

                        {/* Bottom: Price + Stepper or Add Button */}
                        <div className="mt-auto pt-1">
                          {hasPortions ? (
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-2 gap-1">
                                {portions.map((portion, pIdx) => (
                                  <button
                                    key={portion.name || pIdx}
                                    type="button"
                                    onClick={() => handleQuickAddPortion(dish, portion)}
                                    className="py-1 px-1.5 rounded-xl bg-white hover:bg-[#E46254] hover:text-white text-zinc-800 text-[10px] font-bold border border-zinc-200/80 transition-colors flex items-center justify-between cursor-pointer shadow-2xs"
                                  >
                                    <span className="truncate">{portion.name}</span>
                                    <span className="font-mono text-[10px] ml-1">₹{portion.price}</span>
                                  </button>
                                ))}
                              </div>

                              {hasAddons && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCustomizer(dish)}
                                  className="w-full text-[10px] font-bold text-[#E46254] hover:underline text-center py-0.5 cursor-pointer block"
                                >
                                  + Addons
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Standard Dish with Single Price */
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-black text-sm text-zinc-900 tracking-tight">
                                ₹{dish.base_price}
                              </span>

                              <div className="flex items-center gap-1">
                                {hasAddons && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCustomizer(dish)}
                                    className="px-1.5 py-0.5 rounded-lg bg-zinc-100/80 hover:bg-zinc-200 text-zinc-600 text-[10px] font-bold cursor-pointer transition-colors"
                                    title="Customise addons"
                                  >
                                    Addons
                                  </button>
                                )}

                                {totalSelectedQty > 0 ? (
                                  /* Aesthetic - 1 + Stepper directly on card */
                                  <div className="flex items-center bg-[#E46254] text-white rounded-xl shadow-xs p-0.5 animate-in zoom-in-95 duration-150">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDecrementDish(dish);
                                      }}
                                      className="w-5 h-5 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors cursor-pointer active:scale-90"
                                      title="Decrease"
                                    >
                                      <Minus size={11} strokeWidth={3} />
                                    </button>
                                    <span className="w-5 text-center font-mono font-black text-xs">
                                      {totalSelectedQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleIncrementDish(dish);
                                      }}
                                      className="w-5 h-5 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors cursor-pointer active:scale-90"
                                      title="Increase"
                                    >
                                      <Plus size={11} strokeWidth={3} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleIncrementDish(dish)}
                                    className="h-7 px-2.5 rounded-xl bg-[#E46254]/10 hover:bg-[#E46254] text-[#E46254] hover:text-white border border-[#E46254]/25 hover:border-[#E46254] flex items-center justify-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
                                    title="Add to Ticket"
                                  >
                                    <Plus size={12} strokeWidth={3} />
                                    <span>Add</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT PANEL (38%): Takeaway Counter Ticket & Billing ── */}
          <div className="w-full lg:w-[38%] flex flex-col bg-white overflow-hidden shadow-sm">
            
            {/* Right Panel Header: 2-Tab Segmented Control (Current Order vs Ready Orders) */}
            <div className="p-2.5 bg-white border-b border-zinc-200/80 flex items-center justify-between gap-2 shrink-0">
              <div className="bg-zinc-100 p-1 rounded-xl flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setTakeawayTab("CURRENT_ORDER")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    takeawayTab === "CURRENT_ORDER"
                      ? "bg-white text-zinc-900 shadow-2xs font-bold"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <span>Current Order</span>
                  <span suppressHydrationWarning className="font-mono text-[11px] text-[#E46254] font-bold">
                    #{currentToken}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTakeawayTab("READY_ORDERS")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    takeawayTab === "READY_ORDERS"
                      ? "bg-white text-zinc-900 shadow-2xs font-bold"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <span>Ready Orders</span>
                  {activeTakeawayOrders.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#E46254] text-white text-[10px] font-bold font-mono">
                      {activeTakeawayOrders.length}
                    </span>
                  )}
                </button>
              </div>

              {takeawayTab === "CURRENT_ORDER" && takeawayCart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearTakeawayCart}
                  className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                  title="Clear Current Cart"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {takeawayTab === "CURRENT_ORDER" ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Streamlined Customer Information Trigger (Collapsible) */}
                <div className="px-4 py-2 bg-[#FAF8F7] border-b border-zinc-200/80 shrink-0">
                  {!showGuestDetails && !takeawayCustomerName && !takeawayCustomerPhone ? (
                    <button
                      type="button"
                      onClick={() => setShowGuestDetails(true)}
                      className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 font-medium py-0.5 transition-colors cursor-pointer"
                    >
                      {/* Icon removed */}
                      <span>+ Add Customer Details (Optional)</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Guest Details
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowGuestDetails(false)}
                          className="text-[10.5px] font-semibold text-zinc-400 hover:text-zinc-700 cursor-pointer"
                        >
                          Hide
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={12} />
                          <input
                            type="text"
                            placeholder="Customer name"
                            value={takeawayCustomerName}
                            onChange={(e) => setTakeawayCustomerName(e.target.value)}
                            className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-zinc-200/80 rounded-lg text-xs font-medium outline-none focus:border-[#E46254] placeholder:text-zinc-400"
                          />
                        </div>
                        <div className="relative w-36">
                          <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={12} />
                          <input
                            type="tel"
                            placeholder="Phone"
                            value={takeawayCustomerPhone}
                            onChange={(e) => setTakeawayCustomerPhone(e.target.value)}
                            className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-zinc-200/80 rounded-lg text-xs font-mono font-medium outline-none focus:border-[#E46254] placeholder:text-zinc-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ticket Cart Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 slim-scrollbar">
                  {takeawayCart.length === 0 ? (
                    <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center text-zinc-400 p-6">
                      <div className="w-12 h-12 rounded-2xl bg-[#FAF8F7] border border-zinc-200/80 flex items-center justify-center text-[#E46254] mb-3">
                        <ShoppingBag size={20} />
                      </div>
                      <h4 className="font-bold text-xs text-zinc-700">Ticket is empty</h4>
                      <p className="text-[11px] text-zinc-400 mt-1 max-w-[200px]">
                        Tap any dish from the catalog on the left to start billing Token #{currentToken}.
                      </p>
                    </div>
                  ) : (
                    takeawayCart.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white rounded-2xl border border-zinc-200/80 hover:border-zinc-300 transition-all flex items-start justify-between gap-3 group shadow-2xs"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-xs text-zinc-900 block truncate">
                            {item.name}
                          </span>
                          {item.notes && (
                            <span className="text-[10px] text-zinc-500 italic block mt-0.5 line-clamp-1">
                              {item.notes}
                            </span>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs font-bold text-zinc-700">
                              ₹{item.price * item.quantity}
                            </span>
                            <span className="text-[10.5px] text-zinc-400 font-mono">
                              (₹{item.price} each)
                            </span>
                          </div>
                        </div>

                        {/* Quantity Stepper & Remove */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center bg-white border border-zinc-200/80 rounded-lg p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateTakeawayQty(item.id, -1)}
                              className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded cursor-pointer"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-6 text-center font-mono font-bold text-xs text-zinc-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateTakeawayQty(item.id, 1)}
                              className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveTakeawayItem(item.id)}
                            className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Compact Luxury Takeaway Dock — Ultra-clean 1-Row Controls & Space Reclaimed */}
                <div className="p-3.5 bg-white border-t border-zinc-100 space-y-2.5 shrink-0">
                  {/* Row 1: Packaging Capsule + Payment Mode Pills + Discount Toggle */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Packaging Selector Capsule */}
                    <div className="flex items-center bg-zinc-50 border border-zinc-200/70 p-0.5 rounded-xl">
                      {(
                        [
                          { id: "NONE", label: "No Bag", price: 0 },
                          { id: "BAG_5", label: "Paper Bag", price: 5 },
                          { id: "BOX_15", label: "Box", price: 15 },
                        ] as const
                      ).map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setTakeawayPackagingTier(pkg.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                            takeawayPackagingTier === pkg.id
                              ? "bg-white text-zinc-900 shadow-2xs border border-zinc-200/80"
                              : "text-zinc-500 hover:text-zinc-800"
                          }`}
                        >
                          {pkg.label} {pkg.price > 0 && <span className="font-mono text-[10px] text-[#E46254]">+₹{pkg.price}</span>}
                        </button>
                      ))}
                    </div>

                    {/* Payment Mode Pills */}
                    <div className="flex items-center gap-1">
                      {(["UPI", "CASH", "CARD"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setTakeawayPaymentMethod(mode);
                            if (mode === "CASH") setShowCashTenderModal(true);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            takeawayPaymentMethod === mode
                              ? "bg-[#E46254] text-white border-[#E46254] shadow-xs"
                              : "bg-white text-zinc-600 border-zinc-200/80 hover:bg-zinc-50"
                          }`}
                        >
                          {mode === "UPI" ? "UPI / QR" : mode === "CASH" ? "Cash" : "Card"}
                        </button>
                      ))}
                    </div>

                    {/* Discount Button */}
                    <button
                      type="button"
                      onClick={() => setTakeawayShowDiscount((v) => !v)}
                      className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                        takeawayDiscountAmount > 0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-zinc-400 hover:text-[#E46254]"
                      }`}
                    >
                      <Tag size={10} />
                      <span>{takeawayDiscountAmount > 0 ? `-₹${takeawayDiscountAmount.toFixed(0)}` : "+ Discount"}</span>
                    </button>
                  </div>

                  {/* Popdown Discount Slider */}
                  {takeawayShowDiscount && (
                    <div className="p-2.5 bg-zinc-50/70 rounded-xl border border-zinc-100 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1">
                        {[5, 10, 15, 20].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setTakeawayDiscountPercent(takeawayDiscountPercent === pct ? 0 : pct);
                              setTakeawayDiscountRupees("");
                            }}
                            className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              takeawayDiscountPercent === pct && !takeawayDiscountRupees
                                ? "bg-[#E46254] text-white border-[#E46254]"
                                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        placeholder="₹ Flat"
                        value={takeawayDiscountRupees}
                        onChange={(e) => {
                          setTakeawayDiscountRupees(e.target.value);
                          setTakeawayDiscountPercent(0);
                        }}
                        className="w-20 px-2 py-0.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-bold outline-none focus:border-[#E46254]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setTakeawayShowDiscount(false);
                          setTakeawayDiscountPercent(0);
                          setTakeawayDiscountRupees("");
                        }}
                        className="text-[10px] text-zinc-400 hover:text-zinc-700 cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  )}

                  {/* Row 2: Live Total & Breakdown Toggle Bar */}
                  <div className="px-3.5 py-2 rounded-xl bg-zinc-50/60 border border-zinc-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowTakeawayBreakdown((v) => !v)}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showTakeawayBreakdown ? "Hide Taxes" : "Taxes & Breakdown"}</span>
                      <span className="text-[10px] text-zinc-400">({takeawayCart.reduce((s, it) => s + it.quantity, 0)} items)</span>
                    </button>

                    <div className="text-right">
                      <div className="flex items-baseline justify-end gap-1">
                        <span className="text-[11px] font-bold text-zinc-400">Total:</span>
                        <span className="font-mono font-black text-lg text-zinc-900 tracking-tight">₹{takeawayTotal}</span>
                      </div>
                      <span className="text-[9.5px] text-emerald-600 font-medium block -mt-0.5">Taxes included</span>
                    </div>
                  </div>

                  {/* Expandable Tax Breakdown */}
                  {showTakeawayBreakdown && (
                    <div className="p-3 bg-white rounded-xl border border-zinc-100 space-y-1.5 text-[11px] animate-in fade-in duration-150">
                      <div className="flex justify-between text-zinc-500">
                        <span>Items Subtotal:</span>
                        <span className="font-mono text-zinc-700">₹{takeawaySubtotal}</span>
                      </div>
                      {takeawayPackagingAmount > 0 && (
                        <div className="flex justify-between text-zinc-500">
                          <span>Packaging:</span>
                          <span className="font-mono text-zinc-700">+₹{takeawayPackagingAmount}</span>
                        </div>
                      )}
                      {takeawayDiscountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Discount:</span>
                          <span className="font-mono">-₹{takeawayDiscountAmount.toFixed(0)}</span>
                        </div>
                      )}
                      {takeawayBillCalc.totalGst > 0 && (
                        <>
                          <div className="flex justify-between text-zinc-500">
                            <span>CGST ({takeawayBillCalc.effectiveCgstRate}%):</span>
                            <span className="font-mono text-zinc-700">₹{takeawayBillCalc.cgstAmount.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between text-zinc-500">
                            <span>SGST ({takeawayBillCalc.effectiveSgstRate}%):</span>
                            <span className="font-mono text-zinc-700">₹{takeawayBillCalc.sgstAmount.toFixed(1)}</span>
                          </div>
                        </>
                      )}
                      {takeawayBillCalc.roundOff !== 0 && (
                        <div className="flex justify-between text-zinc-400 text-[10px]">
                          <span>Round-off:</span>
                          <span className="font-mono">
                            {takeawayBillCalc.roundOff > 0 ? `+₹${takeawayBillCalc.roundOff}` : `-₹${Math.abs(takeawayBillCalc.roundOff)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cash Change Indicator if Tender entered */}
                  {takeawayPaymentMethod === "CASH" && cashTenderAmount && cashChangeDue !== null && (
                    <div
                      onClick={() => setShowCashTenderModal(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer border ${
                        cashChangeDue >= 0
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      <span className="text-[11px] font-semibold">
                        Cash: ₹{cashTenderAmount} • {cashChangeDue >= 0 ? "Change to Return:" : "Short:"}
                      </span>
                      <span className="font-mono font-black text-sm">₹{Math.abs(cashChangeDue)}</span>
                    </div>
                  )}

                  {/* Big Action Punch Button */}
                  <button
                    type="button"
                    disabled={takeawayCart.length === 0 || isSubmitting}
                    onClick={() => {
                      if (takeawayPaymentMethod === "CASH" && (!cashTenderAmount || Number(cashTenderAmount) < takeawayTotal)) {
                        setShowCashTenderModal(true);
                        return;
                      }
                      handleCollectAndFireTakeaway();
                    }}
                    className={`w-full py-3 rounded-2xl font-black text-sm tracking-wide shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      takeawayCart.length === 0 || isSubmitting
                        ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                        : "bg-[#E46254] hover:bg-[#d55345] text-white active:scale-[0.99]"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Punching Token #{currentToken}...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>COLLECT & FIRE TOKEN #{currentToken} (₹{takeawayTotal})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* TAB 2: READY ORDERS & ACTIVE QUEUE */
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 slim-scrollbar bg-[#FAF8F7]">
                {activeTakeawayOrders.length === 0 ? (
                  <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-zinc-400 p-6">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200/80 flex items-center justify-center text-zinc-400 mb-3 shadow-2xs">
                      <Clock size={20} />
                    </div>
                    <h4 className="font-bold text-xs text-zinc-700">No active orders in queue</h4>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-[220px]">
                      When orders are fired to kitchen, they appear here. Ready orders can be handed over to guests.
                    </p>
                  </div>
                ) : (
                  activeTakeawayOrders.map((order) => {
                    const elapsed = Math.max(
                      0,
                      Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                    );
                    const isReady = (order.status as string) === "READY";
                    const tokenNum = order.table_no.replace("Takeaway", "Token #");
                    const itemsSummary = Array.isArray(order.items_json)
                      ? order.items_json.map((it: any) => `${it.quantity}x ${it.item?.name || it.name}`).join(", ")
                      : "";

                    return (
                      <div
                        key={order.id}
                        className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                          isReady
                            ? "bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-300/40"
                            : "bg-white border-zinc-200 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-zinc-900">
                                {tokenNum}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                                  isReady
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {isReady ? "Ready for Pickup" : "Kitchen Preparing"}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
                              <span>{elapsed}m ago</span>
                              {order.customer_name && <span>· {order.customer_name}</span>}
                              {order.customer_phone && <span className="font-mono text-zinc-400">({order.customer_phone})</span>}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-sm text-zinc-900 block">
                              ₹{order.total}
                            </span>
                            <span className="text-[10px] font-semibold text-zinc-500">
                              {order.payment_method || "Paid"}
                            </span>
                          </div>
                        </div>

                        {itemsSummary && (
                          <p className="text-[11px] text-zinc-600 line-clamp-2 bg-white/70 p-2 rounded-lg border border-zinc-200/60 font-medium">
                            {itemsSummary}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/60">
                          <button
                            type="button"
                            onClick={() => handleMarkTakeawayHandedOver(order.id, order.table_no)}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            <span>Hand Over to Customer</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReprintTakeawayOrder(order)}
                            className="px-3 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                            title="Reprint Receipt"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── ZERO-FRICTION CASH TENDER CALCULATOR MODAL ── */}
      {showCashTenderModal && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-zinc-200/80 shadow-2xl overflow-hidden p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div>
                <h3 className="font-black text-base text-zinc-900 tracking-tight">Cash Payment Calculator</h3>
                <p className="text-[11px] text-zinc-400 font-mono">Token #{currentToken} • Total Due: ₹{takeawayTotal}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCashTenderModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Quick Cash Presets */}
            <div className="space-y-1.5">
              <span className="text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider block">
                Quick Preset Notes
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  takeawayTotal,
                  Math.ceil(takeawayTotal / 100) * 100,
                  500,
                  2000,
                ]
                  .filter((v, i, a) => a.indexOf(v) === i && v >= takeawayTotal)
                  .map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setCashTenderAmount(String(amount))}
                      className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer text-center ${
                        cashTenderAmount === String(amount)
                          ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                          : "bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      {amount === takeawayTotal ? `Exact` : `₹${amount}`}
                    </button>
                  ))}
              </div>
            </div>

            {/* Cash Received Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-700">Cash Received from Customer</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold text-sm">₹</span>
                <input
                  type="number"
                  autoFocus
                  placeholder="e.g. 500"
                  value={cashTenderAmount}
                  onChange={(e) => setCashTenderAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-base font-mono font-black outline-none focus:border-[#E46254] focus:bg-white"
                />
              </div>
            </div>

            {/* Change to Return Banner */}
            {cashChangeDue !== null && (
              <div
                className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
                  cashChangeDue >= 0
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : "bg-amber-50 text-amber-900 border-amber-200"
                }`}
              >
                <div>
                  <span className="text-[11px] uppercase tracking-wider block">
                    {cashChangeDue >= 0 ? "Change to Return" : "Short Amount"}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-normal">
                    {cashChangeDue >= 0 ? "Return this exact balance" : "Customer still owes"}
                  </span>
                </div>
                <span className="font-mono text-xl font-black">
                  ₹{Math.abs(cashChangeDue)}
                </span>
              </div>
            )}

            {/* Confirm & Punch */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCashTenderModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-bold text-xs hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={takeawayCart.length === 0 || isSubmitting || (cashChangeDue !== null && cashChangeDue < 0)}
                onClick={() => {
                  setShowCashTenderModal(false);
                  handleCollectAndFireTakeaway();
                }}
                className="flex-2 py-2.5 rounded-xl bg-[#E46254] hover:bg-[#d55345] disabled:opacity-40 text-white font-black text-xs shadow-xs cursor-pointer active:scale-98 transition-all"
              >
                Confirm & Fire Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FULL-SCREEN TABLE COMMAND STATION MODAL ── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTableModal && (
        <div className="fixed inset-0 z-50 bg-white text-zinc-900 flex flex-col animate-in fade-in duration-100">
          
          {/* 1. Command Station Header Deck (Luxury Architectural Minimalist) */}
          <div className="h-16 bg-white backdrop-blur-2xl border-b border-zinc-100 px-4 sm:px-6 flex items-center justify-between shrink-0">
            
            {/* Left: Back button + Table identification with typography luxury */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setActiveTableModal(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-50 hover:bg-[#E46254]/10 text-zinc-600 hover:text-[#E46254] text-xs font-bold transition-all cursor-pointer border border-zinc-200/60 active:scale-95 shadow-2xs"
                title="Return to floor overview (Esc)"
              >
                <ChevronLeft size={15} />
                <span>Floor</span>
              </button>

              <div className="h-5 w-px bg-zinc-200/60" />

              <div className="flex items-center gap-2.5">
                <span className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight">
                  {activeTableModal}
                </span>

                <div className="flex items-center gap-1.5">
                  {isTablePaid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200/70">
                      <CheckCircle2 size={11} />
                      <span>Settled & Paid</span>
                    </span>
                  ) : !isVacantTable ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E46254]/10 text-[#E46254] text-[11px] font-bold border border-[#E46254]/20 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E46254] animate-pulse" />
                      <span>Active • Round {activeSession?.rounds.length}</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[11px] font-semibold border border-zinc-200/60">
                      Vacant Table
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Operational Info (Clean Pills) */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-medium">
              {!isVacantTable && activeSession?.firstOrderAt && (
                <div className="hidden sm:flex items-center gap-1.5 text-zinc-500 bg-zinc-50 px-3 py-1 rounded-full border border-zinc-200/60 font-mono text-[11.5px]">
                  <Clock size={12} className="text-[#E46254]" />
                  <span>{Math.max(0, Math.floor((Date.now() - new Date(activeSession.firstOrderAt).getTime()) / 60000))}m seated</span>
                </div>
              )}

              {/* Table PIN Badge */}
              <div className="flex items-center gap-1.5 bg-[#E46254]/5 border border-[#E46254]/15 px-3 py-1 rounded-full">
                <span className="text-[11px] text-[#E46254] font-semibold">PIN:</span>
                <span className="font-mono font-bold text-zinc-900 text-xs tracking-wider">{currentTablePin}</span>
                <button
                  type="button"
                  onClick={() => handleCopyPin(currentTablePin)}
                  className="p-0.5 text-zinc-400 hover:text-[#E46254] cursor-pointer transition-colors"
                  title="Copy Table PIN"
                >
                  <Copy size={11} />
                </button>
              </div>

              {/* Guest CRM Button */}
              <button
                type="button"
                onClick={() => setIsGuestInfoModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 text-xs font-semibold border border-zinc-200/70 transition-all cursor-pointer shadow-2xs"
                title="Edit Guest Name / Phone"
              >
                <User size={12} className="text-zinc-400" />
                <span className="truncate max-w-[120px]">{manualCustomerName || activeSession?.customerName || "Guest Details"}</span>
              </button>

              {!isVacantTable && (
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-white hover:bg-[#E46254]/10 text-zinc-700 hover:text-[#E46254] text-xs font-semibold transition-all cursor-pointer border border-zinc-200/70 shadow-2xs"
                  title="Transfer orders to another table"
                >
                  <ArrowRightLeft size={12} className="text-[#E46254]" />
                  <span>Transfer</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Command Station Body: ITEMS/MENU ON LEFT (63%), TICKET ON RIGHT (37%) */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* ── LEFT PANEL (63%): High-Speed Menu Catalog ── */}
            <div className="w-full lg:w-[63%] flex flex-col border-r border-zinc-100 bg-zinc-50/40 overflow-hidden">
              
              {/* Top Search Bar & Category Tabs */}
              <div className="bg-white/95 backdrop-blur-2xl border-b border-zinc-100 shrink-0">
                {/* Search Row */}
                <div className="px-4 pt-3.5 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
                    <input
                      type="text"
                      placeholder="Search dishes..."
                      value={dishSearchQuery}
                      onChange={(e) => setDishSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 bg-zinc-50 border border-zinc-200/70 rounded-xl text-xs font-medium outline-none focus:border-[#E46254]/60 focus:bg-white text-zinc-900 transition-all placeholder-zinc-400"
                    />
                    {dishSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDishSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Bar with Full Mouse Wheel Scroll + Left/Right Chevron Controls */}
                <div className="relative px-4 pb-3">
                  <div
                    id="dinein-category-scroll"
                    onWheel={(e) => {
                      if (e.deltaY !== 0) {
                        e.currentTarget.scrollLeft += e.deltaY;
                      }
                    }}
                    className="flex items-center gap-2 overflow-x-auto slim-scrollbar scroll-smooth"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {drawerCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        ref={(el) => {
                          if (selectedDrawerCat === cat && el) {
                            el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                          }
                        }}
                        onClick={() => setSelectedDrawerCat(cat)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap select-none ${
                          selectedDrawerCat === cat
                            ? "bg-[#E46254] text-white shadow-xs shadow-[#E46254]/25 scale-[1.02]"
                            : "bg-white hover:bg-[#E46254]/10 text-zinc-700 hover:text-[#E46254] border border-zinc-200/80 hover:border-[#E46254]/30 shadow-2xs"
                        }`}
                      >
                        {cat === "ALL" ? "All Items" : cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* High-Speed Food Catalog Grid */}
              <div className="flex-1 overflow-y-auto p-4 slim-scrollbar">
                {filteredCatalog.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-center">
                    <UtensilsCrossed size={20} className="mb-2 opacity-50" />
                    <p className="text-xs font-medium">No dishes found matching search</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredCatalog.map((dish) => {
                      const hasPortions = Boolean(
                        dish.variantsConfig?.hasPortions &&
                        dish.variantsConfig.portions &&
                        dish.variantsConfig.portions.length > 0
                      );
                      const portions = hasPortions ? dish.variantsConfig!.portions : [];
                      const hasAddons = Boolean(dish.variantsConfig?.hasAddons);

                      const cartMatches = manualCart.filter((c) => c.dishId === dish.id || c.name === dish.name);
                      const totalSelectedQty = cartMatches.reduce((s, it) => s + it.quantity, 0);
                      const firstCartItem = cartMatches[0];

                      return (
                        <div
                          key={dish.id}
                          className={`rounded-2xl p-3 border transition-all flex flex-col justify-between group shadow-2xs ${
                            totalSelectedQty > 0
                              ? "bg-white border-[#E46254]/50 shadow-sm shadow-[#E46254]/10 ring-1 ring-[#E46254]/25"
                              : "bg-white border-zinc-200/70 hover:border-[#E46254]/30 hover:shadow-md"
                          }`}
                        >
                          {/* Card Header: Veg dot + Clean Name with Ellipsis & Title */}
                          <div className="flex items-start gap-1.5 mb-2">
                            <span
                              className={`mt-1 w-2.5 h-2.5 rounded-sm border-[1.5px] shrink-0 ${
                                dish.is_veg
                                  ? "border-emerald-500 bg-emerald-50"
                                  : "border-rose-500 bg-rose-50"
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              <span
                                title={dish.name}
                                className="font-bold text-[11.5px] text-zinc-900 group-hover:text-[#E46254] transition-colors leading-snug line-clamp-2 break-words"
                              >
                                {dish.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-medium block truncate mt-0.5">
                                {dish.category}
                              </span>
                            </div>
                          </div>

                          {/* Bottom: Price + Stepper or Add Button */}
                          <div className="mt-auto pt-1">
                            {hasPortions ? (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-2 gap-1">
                                  {portions.map((portion, pIdx) => (
                                    <button
                                      key={portion.name || pIdx}
                                      type="button"
                                      onClick={() => handleQuickAddPortion(dish, portion)}
                                      className="py-1 px-1.5 rounded-xl bg-white hover:bg-[#E46254] hover:text-white text-zinc-800 text-[10px] font-bold border border-zinc-200/80 transition-colors flex items-center justify-between cursor-pointer shadow-2xs"
                                    >
                                      <span className="truncate">{portion.name}</span>
                                      <span className="font-mono text-[10px] ml-1">₹{portion.price}</span>
                                    </button>
                                  ))}
                                </div>

                                {hasAddons && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCustomizer(dish)}
                                    className="w-full text-[10px] font-bold text-[#E46254] hover:underline text-center py-0.5 cursor-pointer block"
                                  >
                                    + Addons
                                  </button>
                                )}
                              </div>
                            ) : (
                              /* Standard Dish with Single Price */
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono font-black text-sm text-zinc-900 tracking-tight">
                                  ₹{dish.base_price}
                                </span>

                                <div className="flex items-center gap-1">
                                  {hasAddons && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCustomizer(dish)}
                                      className="px-1.5 py-0.5 rounded-lg bg-zinc-100/80 hover:bg-zinc-200 text-zinc-600 text-[10px] font-bold cursor-pointer transition-colors"
                                      title="Customise addons"
                                    >
                                      Addons
                                    </button>
                                  )}

                                  {totalSelectedQty > 0 ? (
                                    /* Aesthetic - 1 + Stepper directly on card (Gradual 1 2 3 4 5...) */
                                    <div className="flex items-center bg-[#E46254] text-white rounded-xl shadow-xs p-0.5 animate-in zoom-in-95 duration-150">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDecrementDish(dish);
                                        }}
                                        className="w-5 h-5 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors cursor-pointer active:scale-90"
                                        title="Decrease"
                                      >
                                        <Minus size={11} strokeWidth={3} />
                                      </button>
                                      <span className="w-5 text-center font-mono font-black text-xs">
                                        {totalSelectedQty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleIncrementDish(dish);
                                        }}
                                        className="w-5 h-5 flex items-center justify-center hover:bg-black/20 rounded-lg transition-colors cursor-pointer active:scale-90"
                                        title="Increase"
                                      >
                                        <Plus size={11} strokeWidth={3} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleIncrementDish(dish)}
                                      className="h-7 px-2.5 rounded-xl bg-[#E46254]/10 hover:bg-[#E46254] text-[#E46254] hover:text-white border border-[#E46254]/25 hover:border-[#E46254] flex items-center justify-center gap-1 font-bold text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
                                      title="Add to Ticket"
                                    >
                                      <Plus size={12} strokeWidth={3} />
                                      <span>Add</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT PANEL (37%): Table Ticket, Unfired Batch, Rounds & Payment / Settle Button ── */}
            <div className="w-full lg:w-[37%] flex flex-col bg-white border-l border-zinc-100 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 slim-scrollbar">
                
                {/* Header status bar */}
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 tracking-tight">Ticket</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {!isVacantTable
                        ? `${activeSession?.rounds.length} ${activeSession?.rounds.length === 1 ? 'round' : 'rounds'} fired`
                        : "Vacant — add dishes to start"}
                    </p>
                  </div>
                  {!isVacantTable && (
                    <div className="text-right">
                      <span className="font-mono font-black text-base text-zinc-900">₹{grandTotal}</span>
                      <p className="text-[10px] text-zinc-400 mt-0.5">incl. taxes</p>
                    </div>
                  )}
                </div>

                {/* 1. CURRENT UNFIRED STAGED ITEMS (At the top of ticket) */}
                {manualCart.length > 0 && (
                  <div className="bg-[#FAF8F7] border-2 border-dashed border-[#E46254]/40 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#E46254]/15">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E46254]" />
                        <span className="font-bold text-xs text-[#C2410C] uppercase tracking-wide">
                          Unfired Round #{(activeSession?.rounds.length || 0) + 1}
                        </span>
                        <span className="text-[11px] text-zinc-400">({manualCart.reduce((s, it) => s + it.quantity, 0)} items)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setManualCart([])}
                        className="text-[11px] text-zinc-400 hover:text-rose-600 font-medium cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="space-y-1">
                      {manualCart.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-xl bg-white/60 hover:bg-white transition-colors">
                          <div className="flex items-start gap-2 flex-1 pr-2 min-w-0">
                            <span className="font-mono font-bold text-[#E46254] w-5 shrink-0 mt-0.5">
                              {it.quantity}×
                            </span>
                            <div className="min-w-0">
                              <span className="font-semibold text-zinc-900 block leading-tight truncate">{it.name}</span>
                              {it.notes && (
                                <span className="text-[10px] text-[#C2410C] font-medium block mt-0.5 truncate max-w-[190px]">
                                  {it.notes}
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-400 font-mono">₹{it.price} each</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-white rounded-lg border border-zinc-200">
                              <button
                                type="button"
                                onClick={() => updateManualQty(it.id, -1)}
                                className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-black cursor-pointer"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="w-4 text-center font-mono font-bold text-xs">
                                {it.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateManualQty(it.id, 1)}
                                className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-black cursor-pointer"
                              >
                                <Plus size={10} />
                              </button>
                            </div>

                            <span className="w-12 text-right font-mono font-bold text-zinc-900 tabular-nums text-xs">
                              ₹{it.price * it.quantity}
                            </span>

                            {/* Edit customizations on staged item */}
                            <button
                              type="button"
                              onClick={() => handleEditManualCartItem(it)}
                              className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
                              title="Edit item customization"
                            >
                              <Pencil size={11} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setManualCart((prev) => prev.filter((i) => i.id !== it.id))}
                              className="text-zinc-300 hover:text-rose-600 p-1 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Batch Instructions & Fire Button */}
                    <div className="pt-2 border-t border-[#E46254]/15 space-y-2">
                      <input
                        type="text"
                        placeholder="Kitchen notes (e.g. Serve starters first)..."
                        value={batchNote}
                        onChange={(e) => setBatchNote(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:border-[#E46254]"
                      />

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleSendManualKOT}
                        className="w-full py-2.5 px-4 bg-[#E46254] hover:bg-[#d55345] disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Send size={13} />
                        <span>
                          Fire Round #{(activeSession?.rounds.length || 0) + 1} to Kitchen (₹{manualCart.reduce((s, it) => s + it.price * it.quantity, 0)})
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. CHRONOLOGICAL FIRED ROUNDS STREAM */}
                {activeSession && activeSession.rounds.length > 0 ? (
                  <div className="space-y-3">
                    {activeSession.rounds.map((round, roundIdx) => {
                    const isNewest = roundIdx === activeSession.rounds.length - 1;
                    const isHighlighted = highlightRoundId === round.orderId;
                    return (
                      <div
                        key={round.orderId}
                        ref={isNewest ? newestRoundRef : undefined}
                        className={`rounded-2xl p-3.5 space-y-2.5 transition-all duration-500 relative ${
                          isHighlighted
                            ? "bg-gradient-to-br from-amber-50/70 via-white to-[#E46254]/5 border-2 border-[#E46254] shadow-lg shadow-[#E46254]/15 ring-4 ring-[#E46254]/20 scale-[1.01]"
                            : "bg-white border border-zinc-200/70 shadow-2xs hover:border-zinc-300"
                        }`}
                      >
                        {/* Round Header */}
                        <div className="flex items-center justify-between text-xs pb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-zinc-900 font-mono text-xs">
                              Round #{round.roundNumber}
                            </span>
                            {isHighlighted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E46254] text-white text-[10px] font-black tracking-wide animate-pulse shadow-xs">
                                <Sparkles size={10} />
                                <span>NEW ROUND</span>
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              round.source === "STAFF"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : round.source === "CAPTAIN"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-orange-50 text-orange-700 border-orange-200"
                            }`}>
                              {round.source === "STAFF" ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                  <span>POS Counter</span>
                                </>
                              ) : round.source === "CAPTAIN" ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
                                  <span>Captain App</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                                  <span>Customer QR</span>
                                </>
                              )}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {new Date(round.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleReprintKOT(round)}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-zinc-600 bg-white hover:bg-zinc-50 border border-zinc-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Reprint KOT"
                            >
                              <Printer size={11} />
                              <span>KOT</span>
                            </button>
                          </div>
                        </div>

                        {/* QR Approval Banner for Pending Orders */}
                        {round.status === "NEW" && (
                          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 animate-in fade-in">
                            <div>
                              <div className="text-[11px] font-bold text-amber-900">
                                Guest QR Order Pending Approval
                              </div>
                              <div className="text-[10px] text-amber-700">
                                Confirm table & fire to kitchen
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleApproveOrder(round.orderId)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer flex items-center gap-1 transition-colors active:scale-95"
                              >
                                <Check size={12} strokeWidth={2.5} />
                                <span>Accept & Fire</span>
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleRejectOrder(round.orderId)}
                                className="px-2 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-600 text-[11px] font-medium border border-zinc-200 cursor-pointer transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Round Items with Clean Edit & Remove controls */}
                        <div className="space-y-1.5">
                          {round.items.map((it) => (
                            <div
                              key={it.itemIndex}
                              className="py-2 px-3 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-100 flex items-center justify-between text-xs transition-all shadow-2xs"
                            >
                              <div className="flex items-start gap-2.5 flex-1 pr-2 min-w-0">
                                <span className="font-mono font-black text-[#E46254] bg-[#E46254]/10 border border-[#E46254]/20 px-1.5 py-0.5 rounded-md text-[11px] shrink-0 mt-0.5">
                                  {it.quantity}×
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-zinc-900 leading-snug truncate" title={it.name}>{it.name}</span>
                                  </div>
                                  {it.notes && (
                                    <span className="text-[10.5px] text-[#C2410C] mt-0.5 block font-medium truncate max-w-[200px]">
                                      {it.notes}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-bold font-mono tabular-nums text-zinc-900 text-xs mr-0.5">
                                  ₹{it.price * it.quantity}
                                </span>

                                {/* Clean Edit Button: Adjust quantity, portion, addons, or notes */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditRoundItem(round, it)}
                                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                                  title="Edit dish portion, addons, or notes"
                                >
                                  <Pencil size={11.5} />
                                </button>

                                {/* Clean Remove Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveRoundItem(round.orderId, it.itemIndex, it.name, round.roundNumber)
                                  }
                                  className="p-1 rounded-lg text-zinc-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Remove dish from this round"
                                >
                                  <Trash2 size={11.5} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                ) : manualCart.length === 0 ? (
                  <div className="p-8 bg-zinc-50/40 rounded-2xl border border-dashed border-zinc-200/70 text-center space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-[#E46254]/10 text-[#E46254] flex items-center justify-center mx-auto mb-1">
                      <UtensilsCrossed size={18} />
                    </div>
                    <p className="text-xs font-bold text-zinc-800">Table is vacant</p>
                    <p className="text-[11.5px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                      Select dishes from the menu on the left to start this table and fire Round #1.
                    </p>
                  </div>
                ) : null}

{/* 3. PREMIUM EDITORIAL BILL SUMMARY (No Grey Dullness) */}
                {subtotal > 0 && (
                  <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden text-xs shadow-xs transition-all">
                    {/* Compact Primary Bar — Clean Luxury White & Soft Brand */}
                    <div className="px-4 py-3 flex items-center justify-between gap-3 bg-gradient-to-r from-white via-zinc-50/30 to-white">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowBillBreakdown((v) => !v)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#E46254]/5 text-zinc-800 hover:text-[#E46254] text-[11px] font-bold border border-zinc-200/80 cursor-pointer transition-all shadow-2xs active:scale-95"
                        >
                          <span>{showBillBreakdown ? "Hide Taxes" : "Taxes & Breakdown"}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">({activeSession?.allItems?.length || 0})</span>
                        </button>

                        {effectiveDiscount > 0 ? (
                          <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 shadow-2xs">
                            <Tag size={10} />
                            <span>-₹{effectiveDiscount.toFixed(0)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setDiscountPercent(0);
                                setCustomDiscountRupees("");
                                setShowDiscountControls(false);
                              }}
                              className="text-[10px] text-zinc-400 hover:text-rose-600 underline ml-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowDiscountControls((v) => !v)}
                            className="text-[11px] text-zinc-500 hover:text-[#E46254] flex items-center gap-1 cursor-pointer font-bold px-2 py-1 rounded-full hover:bg-[#E46254]/5 transition-colors"
                          >
                            <Tag size={10} />
                            <span>+ Discount</span>
                          </button>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1.5">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total</span>
                          <span className="font-mono font-black text-lg text-zinc-900 tracking-tight">₹{grandTotal}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium block">All taxes included</span>
                      </div>
                    </div>

                    {/* Discount Input Popdown */}
                    {showDiscountControls && (
                      <div className="px-4 py-3 bg-zinc-50/50 border-t border-zinc-100 space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between text-zinc-700 text-[11px]">
                          <span className="font-bold">Apply Bill Discount</span>
                          <button
                            type="button"
                            onClick={() => setShowDiscountControls(false)}
                            className="text-zinc-400 hover:text-zinc-700 text-[10px] font-semibold cursor-pointer"
                          >
                            Close
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          {[5, 10, 15, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                setDiscountPercent(pct);
                                setCustomDiscountRupees("");
                              }}
                              className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer transition-all ${
                                discountPercent === pct && !customDiscountRupees
                                  ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                                  : "bg-white text-zinc-700 border-zinc-200 hover:border-[#E46254]/40 hover:bg-[#E46254]/5"
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                          <input
                            type="number"
                            placeholder="Flat ₹"
                            value={customDiscountRupees}
                            onChange={(e) => {
                              setCustomDiscountRupees(e.target.value);
                              setDiscountPercent(0);
                            }}
                            className="w-24 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-[#E46254] shadow-2xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Expandable Breakdown Drawer */}
                    {showBillBreakdown && (
                      <div className="px-4 py-3 bg-white border-t border-zinc-100 space-y-2 animate-in fade-in duration-150 text-[11.5px]">
                        <div className="flex justify-between text-zinc-600">
                          <span>Items Subtotal</span>
                          <span className="font-mono font-bold text-zinc-800">₹{subtotal}</span>
                        </div>

                        {serviceChargeAmount > 0 && (
                          <div className="flex justify-between text-zinc-500">
                            <span>Service Charge ({taxSettings.serviceChargeRate}%)</span>
                            <span className="font-mono font-medium text-zinc-700">₹{serviceChargeAmount.toFixed(1)}</span>
                          </div>
                        )}

                        {dineInBillCalc.isComposition ? (
                          <div className="flex justify-between text-zinc-400 italic">
                            <span>GST (Composition — 0%)</span>
                            <span className="font-mono">₹0.00</span>
                          </div>
                        ) : dineInBillCalc.isInclusive ? (
                          <div className="flex justify-between text-zinc-500">
                            <span>GST ({dineInBillCalc.effectiveCgstRate + dineInBillCalc.effectiveSgstRate}%)</span>
                            <span className="font-mono text-zinc-700 font-semibold">Included</span>
                          </div>
                        ) : (
                          gstAmount > 0 && (
                            <>
                              <div className="flex justify-between text-zinc-500">
                                <span>CGST ({dineInBillCalc.effectiveCgstRate}%)</span>
                                <span className="font-mono text-zinc-700">₹{cgstAmount.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-zinc-500">
                                <span>SGST ({dineInBillCalc.effectiveSgstRate}%)</span>
                                <span className="font-mono text-zinc-700">₹{sgstAmount.toFixed(1)}</span>
                              </div>
                            </>
                          )
                        )}

                        {roundOff !== 0 && (
                          <div className="flex justify-between text-zinc-400 text-[10.5px]">
                            <span>Round-off</span>
                            <span className="font-mono">
                              {roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── ACTION DOCK: PRINT BILL & SIMPLE SETTLE BUTTON (NO EMOJI, NO DESCRIPTION) ── */}
              <div className="p-4 bg-white border-t border-zinc-100 space-y-2 shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handlePrintGuestBill}
                    className="py-3 px-3 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Printer size={14} />
                    <span>Print Bill</span>
                  </button>

                  {!isTablePaid ? (
                    <button
                      type="button"
                      disabled={
                        subtotal === 0 ||
                        isSubmitting ||
                        !activeSession ||
                        activeSession.rounds.length === 0
                      }
                      onClick={handlePaymentCollected}
                      className="sm:col-span-2 py-3 px-4 rounded-xl bg-[#E46254] hover:bg-[#d55345] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs"
                      title={
                        !activeSession || activeSession.rounds.length === 0
                          ? "Fire round to kitchen (KOT) before collecting payment"
                          : "Record payment for this table"
                      }
                    >
                      {!activeSession || activeSession.rounds.length === 0
                        ? "Fire KOT First to Collect"
                        : "Payment Collected"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSettleAndFreeTable}
                      className="sm:col-span-2 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-black disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs"
                    >
                      Settle
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT DISH IN FIRED ROUND MODAL ── */}
      {editingRoundItem && (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full border border-zinc-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-[#FAF8F7] border-b border-zinc-200/80 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">{editingRoundItem.name}</h3>
                <span className="text-[11px] text-zinc-400 font-medium">
                  Round #{editingRoundItem.roundNumber} • Dish #{editingRoundItem.itemIndex + 1}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingRoundItem(null)}
                className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 slim-scrollbar">
              {/* Quantity Selector */}
              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-[#FAF8F7] rounded-xl border border-zinc-200 p-1">
                    <button
                      type="button"
                      disabled={editItemQty <= 1}
                      onClick={() => setEditItemQty((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-lg bg-white border border-zinc-200/80 flex items-center justify-center text-zinc-700 disabled:opacity-40 cursor-pointer shadow-2xs"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-12 text-center font-mono font-bold text-sm">
                      {editItemQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditItemQty((q) => q + 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-zinc-200/80 flex items-center justify-center text-zinc-700 cursor-pointer shadow-2xs"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <span className="text-xs text-zinc-400">servings</span>
                </div>
              </div>

              {/* Portions (if configured on menu item) */}
              {editingRoundItem.matchedMenuItem?.variantsConfig?.portions &&
                editingRoundItem.matchedMenuItem.variantsConfig.portions.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                      Portion Size
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {editingRoundItem.matchedMenuItem.variantsConfig.portions.map((portion, pIdx) => {
                        const isSelected = editItemPortion?.name === portion.name;
                        return (
                          <button
                            key={portion.name || pIdx}
                            type="button"
                            onClick={() => setEditItemPortion(portion)}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? "bg-[#E46254]/10 border-[#E46254] text-[#C2410C]"
                                : "bg-[#FAF8F7] border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            <span>{portion.name}</span>
                            <span className="font-mono">₹{portion.price}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Add-ons (if configured) */}
              {editingRoundItem.matchedMenuItem?.variantsConfig?.addons &&
                editingRoundItem.matchedMenuItem.variantsConfig.addons.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                      Add-ons
                    </label>
                    <div className="space-y-1.5">
                      {editingRoundItem.matchedMenuItem.variantsConfig.addons.map((addon) => {
                        const isChecked = editItemAddons.some((a) => a.id === addon.id || a.name === addon.name);
                        return (
                          <div
                            key={addon.id}
                            onClick={() => {
                              setEditItemAddons((prev) =>
                                isChecked
                                  ? prev.filter((a) => a.id !== addon.id && a.name !== addon.name)
                                  : [...prev, addon]
                              );
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-[#E46254]/10 border-[#E46254] text-[#C2410C]"
                                : "bg-[#FAF8F7] border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-bold ${
                                  isChecked ? "bg-[#E46254] border-[#E46254] text-white" : "border-zinc-300 bg-white"
                                }`}
                              >
                                {isChecked && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span>{addon.name}</span>
                            </div>
                            <span className="font-mono font-bold">+₹{addon.price}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Cooking Instructions / Notes */}
              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                  Special Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Less spicy, no onion, extra crispy..."
                  value={editItemNotes}
                  onChange={(e) => setEditItemNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F7] border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:border-[#E46254] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAF8F7] border-t border-zinc-200/80 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleRemoveRoundItem(
                    editingRoundItem.orderId,
                    editingRoundItem.itemIndex,
                    editingRoundItem.name,
                    editingRoundItem.roundNumber
                  )
                }
                className="px-3 py-2 text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 hover:border-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Remove Item</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRoundItem(null)}
                  className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSaveEditRoundItem}
                  className="px-4 py-2 bg-[#E46254] hover:bg-[#d55345] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={13} strokeWidth={2.5} />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GUEST INFO / CRM MODAL ── */}
      {isGuestInfoModalOpen && (
        <div className="fixed inset-0 z-[75] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-zinc-200/80 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-[#E46254]" />
                <h3 className="font-bold text-sm text-zinc-900">Guest Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGuestInfoModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Guest Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={manualCustomerName}
                  onChange={(e) => setManualCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F7] border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:border-[#E46254]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={manualCustomerPhone}
                  onChange={(e) => setManualCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F7] border border-zinc-200 rounded-xl text-xs font-mono outline-none focus:border-[#E46254]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsGuestInfoModalOpen(false)}
                className="px-4 py-2 bg-[#E46254] hover:bg-[#d55345] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TABLE TRANSFER MODAL ── */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[75] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full border border-zinc-200/80 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-[#E46254]" />
                <h3 className="font-bold text-sm text-zinc-900">Transfer {activeTableModal}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Move all active orders and running bill to another dining table on the floor.
            </p>

            <div className="space-y-1.5 max-h-60 overflow-y-auto slim-scrollbar pr-1">
              {locations
                .filter((loc) => loc.name !== activeTableModal)
                .map((loc) => {
                  const isTargetOccupied =
                    tableSessionMap.get(loc.name)?.status !== "VACANT";
                  const isSelected = transferTargetTable === loc.name;

                  return (
                    <div
                      key={loc.id}
                      onClick={() => setTransferTargetTable(loc.name)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#E46254]/10 border-[#E46254] text-[#C2410C]"
                          : isTargetOccupied
                          ? "bg-amber-50/50 border-amber-200 text-zinc-700"
                          : "bg-[#FAF8F7] border-zinc-200/80 text-zinc-800 hover:bg-zinc-100"
                      }`}
                    >
                      <span className="font-bold text-xs">{loc.name}</span>
                      <span className="text-[10.5px] font-semibold text-zinc-400">
                        {isTargetOccupied ? "Occupied (Merge)" : "Vacant"}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transferTargetTable || isSubmitting}
                onClick={handleExecuteTransfer}
                className="px-4 py-2 bg-[#E46254] hover:bg-[#d55345] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DISH CUSTOMIZATION MODAL (PORTIONS, ADD-ONS, QUICK PREP TAGS) ── */}
      {customizingDish && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-zinc-200/80 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-[#FAF8F7] border-b border-zinc-200/80 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">
                  {customizingDish.name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
                  <span>{customizingDish.category}</span>
                  <span>•</span>
                  <span className="font-mono">
                    Base: ₹{customizingDish.base_price}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCustomizingDish(null)}
                className="w-8 h-8 rounded-full bg-white border border-zinc-200/80 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors shadow-2xs cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Customization Options */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 slim-scrollbar">
              {/* 1. Portions */}
              {customizingDish.variantsConfig?.hasPortions &&
                customizingDish.variantsConfig.portions &&
                customizingDish.variantsConfig.portions.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                      Portion Size
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {customizingDish.variantsConfig.portions.map((portion, pIdx) => {
                        const isSelected = selectedPortion?.name === portion.name;
                        return (
                          <div
                            key={portion.name || pIdx}
                            onClick={() => setSelectedPortion(portion)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? "bg-[#E46254]/10 border-[#E46254] text-[#C2410C] font-bold shadow-2xs"
                                : "bg-[#FAF8F7] border-zinc-200/80 text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            <span className="text-xs">{portion.name}</span>
                            <span className="font-mono text-xs font-bold">
                              ₹{portion.price}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* 2. Add-ons */}
              {customizingDish.variantsConfig?.hasAddons &&
                customizingDish.variantsConfig.addons &&
                customizingDish.variantsConfig.addons.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                      Custom Add-ons
                    </label>
                    <div className="space-y-1.5">
                      {customizingDish.variantsConfig.addons.map((addon) => {
                        const isChecked = selectedAddons.some((a) => a.id === addon.id);
                        return (
                          <div
                            key={addon.id}
                            onClick={() => {
                              setSelectedAddons((prev) =>
                                isChecked
                                  ? prev.filter((a) => a.id !== addon.id)
                                  : [...prev, addon]
                              );
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isChecked
                                ? "bg-[#E46254]/10 border-[#E46254] text-[#C2410C] font-semibold"
                                : "bg-[#FAF8F7] border-zinc-200/80 text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                  isChecked
                                    ? "bg-[#E46254] border-[#E46254] text-white"
                                    : "border-zinc-300 bg-white"
                                }`}
                              >
                                {isChecked && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span className="text-xs">{addon.name}</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-zinc-900">
                              +₹{addon.price}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* 3. Prep Tags */}
              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                  Kitchen Notes & Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(customizingDish.variantsConfig?.prepTags?.length
                    ? customizingDish.variantsConfig.prepTags
                    : COMMON_PREP_TAGS
                  ).map((tag) => {
                    const isSelected = selectedPrepTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedPrepTags((prev) =>
                            isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                            : "bg-[#FAF8F7] text-zinc-600 border-zinc-200/80 hover:bg-zinc-100"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Custom Chef Note */}
              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-1.5">
                  Chef Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Extra hot, no garlic, serve with lime..."
                  value={customDishNote}
                  onChange={(e) => setCustomDishNote(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F7] border border-zinc-200/80 rounded-xl text-xs font-medium outline-none focus:border-[#E46254] focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Footer Summary & Confirm */}
            <div className="p-4 bg-[#FAF8F7] border-t border-zinc-200/80 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
                  Unit Price
                </span>
                <span className="text-base font-black text-zinc-900 font-mono">
                  ₹
                  {(selectedPortion ? selectedPortion.price : customizingDish.base_price) +
                    selectedAddons.reduce((s, a) => s + (a.price || 0), 0)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomizingDish(null)}
                  className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCustomDish}
                  className="px-4 py-2 bg-[#E46254] hover:bg-[#d55345] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} strokeWidth={3} />
                  <span>Add to Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-zinc-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 size={14} className="text-[#E46254]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── THERMAL CHIT PRINT COMPONENT (Hidden from screen, visible during window.print()) ── */}
      {printChit && (
        <div id="thermal-chit" className="hidden print:block fixed inset-0 bg-white p-4 font-mono text-black text-xs">
          <div className={`${paperWidth === '58MM' ? 'max-w-[58mm] text-[10px]' : 'max-w-[80mm] text-xs'} mx-auto space-y-2`}>
            <div className="text-center border-b pb-2">
              <h2 className="text-base font-black uppercase tracking-tight">{restaurantName}</h2>
              {(taxSettings.receiptAddress || restaurantAddress) && (
                <p className="text-[10px] leading-tight whitespace-pre-line mt-0.5">
                  {taxSettings.receiptAddress || restaurantAddress}
                </p>
              )}
              {taxSettings.gstin && (
                <p className="text-[10px] font-bold mt-0.5 tracking-wider">GSTIN: {taxSettings.gstin}</p>
              )}
              {taxSettings.fssai && (
                <p className="text-[10px] text-zinc-600">FSSAI: {taxSettings.fssai}</p>
              )}
              <p className="font-bold mt-1 text-sm tracking-wider">
                {printChit.type === "KOT"
                  ? `*** KOT #${printChit.kotNumber || 1} ***`
                  : printChit.isComposition
                  ? "*** BILL OF SUPPLY ***"
                  : printCopies === 2
                  ? "*** GUEST TAX INVOICE ***"
                  : "*** TAX INVOICE ***"}
              </p>
              {printChit.type === "BILL" && printChit.isComposition && (
                <p className="text-[8.5px] leading-tight uppercase font-medium mt-0.5">
                  Composition Taxable Person, Not Eligible To Collect Tax On Supplies
                </p>
              )}
              <div className="flex justify-between text-[11px] mt-1 font-bold">
                <span>{printChit.tableOrToken}</span>
                <span>{printChit.time}</span>
              </div>
              {printChit.customerName && (
                <div className="text-left text-[10px] mt-0.5">
                  Guest: {printChit.customerName} {printChit.customerPhone ? `(${printChit.customerPhone})` : ""}
                </div>
              )}
            </div>

            <table className="w-full text-left text-xs my-2">
              <thead>
                <tr className="border-b">
                  <th className="py-1">Qty</th>
                  <th className="py-1">Item</th>
                  {printChit.type === "BILL" && <th className="py-1 text-right">Amt</th>}
                </tr>
              </thead>
              <tbody>
                {printChit.items.map((it, idx) => (
                  <tr key={idx} className="border-b border-dashed border-zinc-300">
                    <td className="py-1 font-bold align-top">{it.quantity}×</td>
                    <td className="py-1 align-top">
                      <span className="font-bold">{it.name}</span>
                      {it.notes && <div className="text-[10px] italic">{it.notes}</div>}
                    </td>
                    {printChit.type === "BILL" && (
                      <td className="py-1 text-right font-bold align-top">
                        ₹{(it.price || 0) * it.quantity}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {printChit.type === "BILL" && (
              <div className="border-t pt-1 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{printChit.subtotal}</span>
                </div>
                {printChit.packaging && printChit.packaging > 0 ? (
                  <div className="flex justify-between">
                    <span>Packaging:</span>
                    <span>₹{printChit.packaging}</span>
                  </div>
                ) : null}
                {printChit.discount && printChit.discount > 0 ? (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₹{printChit.discount.toFixed(1)}</span>
                  </div>
                ) : null}
                {printChit.serviceCharge && printChit.serviceCharge > 0 ? (
                  <div className="flex justify-between">
                    <span>Service Charge ({printChit.serviceChargeRate || 5}%):</span>
                    <span>₹{printChit.serviceCharge.toFixed(2)}</span>
                  </div>
                ) : null}

                {/* Dynamic Tax Lines */}
                {printChit.isComposition ? (
                  <div className="flex justify-between text-[10px] italic text-zinc-600">
                    <span>GST (Composition):</span>
                    <span>₹0.00</span>
                  </div>
                ) : printChit.isInclusive ? (
                  <>
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>Taxes:</span>
                      <span>Included in Price</span>
                    </div>
                    <div className="text-[9.5px] text-zinc-500 pl-2">
                      (CGST {printChit.cgstRate}%: ₹{printChit.cgst?.toFixed(2)} + SGST {printChit.sgstRate}%: ₹{printChit.sgst?.toFixed(2)})
                    </div>
                  </>
                ) : (
                  (printChit.cgst !== undefined || printChit.sgst !== undefined) && (
                    <>
                      <div className="flex justify-between">
                        <span>CGST ({printChit.cgstRate || 2.5}%):</span>
                        <span>₹{printChit.cgst?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST ({printChit.sgstRate || 2.5}%):</span>
                        <span>₹{printChit.sgst?.toFixed(2)}</span>
                      </div>
                    </>
                  )
                )}

                {printChit.roundOff !== undefined && printChit.roundOff !== 0 && (
                  <div className="flex justify-between text-[10px]">
                    <span>Round-off:</span>
                    <span>{printChit.roundOff > 0 ? `+₹${printChit.roundOff}` : `-₹${Math.abs(printChit.roundOff)}`}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm border-t pt-1">
                  <span>Grand Total:</span>
                  <span>₹{printChit.grandTotal}</span>
                </div>
              </div>
            )}

            <div className="text-center pt-3 text-[10px] border-t mt-3 whitespace-pre-line leading-tight">
              {printChit.type === "KOT"
                ? "KITCHEN PRODUCTION ORDER"
                : (taxSettings.receiptFooter || "Thank you for dining with us! Visit again.")}
            </div>

            {/* Merchant / Store Audit Copy (If 2 Copies Configured) */}
            {printCopies === 2 && printChit.type === "BILL" && (
              <div className="pt-6 border-t-2 border-dashed border-zinc-400 mt-6">
                <div className="text-center font-bold text-[11px] mb-2 tracking-wider">
                  *** MERCHANT AUDIT COPY ***
                </div>
                <div className="text-center pb-2 border-b">
                  <h2 className="text-sm font-black uppercase">{restaurantName}</h2>
                  <div className="flex justify-between text-[10px] mt-1 font-bold">
                    <span>{printChit.tableOrToken}</span>
                    <span>{printChit.time}</span>
                  </div>
                  {printChit.customerName && (
                    <div className="text-left text-[10px] mt-0.5">
                      Guest: {printChit.customerName} {printChit.customerPhone ? `(${printChit.customerPhone})` : ""}
                    </div>
                  )}
                </div>
                <div className="py-2 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Items Total ({printChit.items.reduce((s, i) => s + i.quantity, 0)} items):</span>
                    <span>₹{printChit.subtotal}</span>
                  </div>
                  {printChit.discount && printChit.discount > 0 ? (
                    <div className="flex justify-between text-zinc-600">
                      <span>Discount:</span>
                      <span>-₹{printChit.discount.toFixed(1)}</span>
                    </div>
                  ) : null}
                  {printChit.tax && printChit.tax > 0 ? (
                    <div className="flex justify-between">
                      <span>GST:</span>
                      <span>₹{printChit.tax.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-bold text-xs border-t pt-1">
                    <span>Settled Total:</span>
                    <span>₹{printChit.grandTotal}</span>
                  </div>
                </div>
                <div className="text-center text-[9px] pt-1 text-zinc-500 uppercase tracking-widest">
                  --- STORE RETENTION COPY ---
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
