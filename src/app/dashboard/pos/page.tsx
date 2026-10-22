"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Printer,
  UtensilsCrossed,
  ShoppingBag,
  Send,
  Clock,
  User,
  Phone,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowRightLeft,
  Copy,
  Tag,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  ItemVariantsConfig,
  extractVariantsFromDescription,
  PortionOption,
  AddonOption,
  COMMON_PREP_TAGS,
} from "@/utils/menuItemVariants";
import { resolveTablePinAndSeed, normalizeTableIdentifier } from "@/utils/tableSessionPin";

/* ─── Domain Models ────────────────────────────────────────────────── */
interface Location {
  id: string;
  name: string;
  type?: string;
  capacity?: number;
  restaurant_id?: string;
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
  const [tableFilter, setTableFilter] = useState<"ALL" | "OCCUPIED" | "VACANT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Full-Screen Dine-In Modal: Active Table
  const [activeTableModal, setActiveTableModal] = useState<string | null>(null);

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

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
    tax?: number;
    roundOff?: number;
    grandTotal?: number;
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
  const [tokenOverride, setTokenOverride] = useState<number | null>(null);
  const [takeawayShowDiscount, setTakeawayShowDiscount] = useState(false);
  const [takeawayDiscountPercent, setTakeawayDiscountPercent] = useState<number>(0);
  const [takeawayDiscountRupees, setTakeawayDiscountRupees] = useState<string>("");
  const [takeawayBatchNote, setTakeawayBatchNote] = useState("");
  const [takeawayTab, setTakeawayTab] = useState<"CURRENT_ORDER" | "READY_ORDERS">("CURRENT_ORDER");
  const takeawaySearchInputRef = useRef<HTMLInputElement>(null);

  /* ─── 1. Load Floor, Catalog & Realtime Orders ─────────────────────── */
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let restId = user?.user_metadata?.restaurant_id || user?.id;

      // Check localStorage captain restaurant as well if present
      if (typeof window !== "undefined") {
        try {
          const savedCaptainRest = localStorage.getItem("tabletapy_captain_restaurant");
          if (savedCaptainRest) {
            const parsed = JSON.parse(savedCaptainRest);
            if (parsed?.id) {
              restId = parsed.id;
            }
          }
        } catch {}
      }

      // If still no restId or not found, find the restaurant that has active orders/locations
      if (!restId) {
        // Check latest active orders to get active restaurant
        const { data: latestOrd } = await supabase
          .from("orders")
          .select("restaurant_id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestOrd?.restaurant_id) {
          restId = latestOrd.restaurant_id;
        } else {
          // Check locations table for active restaurant
          const { data: latestLoc } = await supabase
            .from("locations")
            .select("restaurant_id")
            .limit(1)
            .maybeSingle();
          if (latestLoc?.restaurant_id) {
            restId = latestLoc.restaurant_id;
          }
        }
      }

      if (restId) {
        const { data: restRec } = await supabase
          .from("restaurants")
          .select("id, name, address")
          .eq("id", restId)
          .maybeSingle();
        if (restRec) {
          setRestaurantName(restRec.name || "My Restaurant");
          setRestaurantAddress(restRec.address || "");
        }
      }

      // Fetch Locations (Tables)
      let loadedLocations: Location[] = [];
      if (restId) {
        const { data: locData } = await supabase
          .from("locations")
          .select("id, name, type, restaurant_id")
          .eq("restaurant_id", restId)
          .order("name", { ascending: true });

        if (locData && locData.length > 0) {
          loadedLocations = locData as Location[];
        }
      }

      // If still empty, check user.id fallback
      if (loadedLocations.length === 0 && user?.id && user.id !== restId) {
        const { data: userLocs } = await supabase
          .from("locations")
          .select("id, name, type, restaurant_id")
          .eq("restaurant_id", user.id)
          .order("name", { ascending: true });

        if (userLocs && userLocs.length > 0) {
          loadedLocations = userLocs as Location[];
          restId = user.id;
        }
      }

      // If STILL empty, dynamically query all active tables in locations so POS is 100% operational
      if (loadedLocations.length === 0) {
        const { data: anyLocs } = await supabase
          .from("locations")
          .select("id, name, type, restaurant_id")
          .order("name", { ascending: true });

        if (anyLocs && anyLocs.length > 0) {
          loadedLocations = anyLocs as Location[];
          if (!restId && anyLocs[0]?.restaurant_id) {
            restId = anyLocs[0].restaurant_id;
          }
        }
      }

      if (!restId && loadedLocations[0]?.restaurant_id) {
        restId = loadedLocations[0].restaurant_id;
      }

      if (restId) {
        setRestaurantId(restId);
      }

      if (loadedLocations.length > 0) {
        const sorted = loadedLocations.sort((a, b) => {
          const numA = parseInt(a.name.replace(/\D/g, ""), 10);
          const numB = parseInt(b.name.replace(/\D/g, ""), 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.name.localeCompare(b.name);
        });
        setLocations(sorted);
      }

      // Catalog Items (scoped to restId, or fetch available items if restId has none)
      let menuRows: MenuItem[] = [];
      if (restId) {
        const { data: menuData } = await supabase
          .from("menu_items_v2")
          .select("id, name, category, subcategory, base_price, is_veg, is_available, description")
          .eq("restaurant_id", restId)
          .eq("is_available", true)
          .order("name", { ascending: true });

        if (menuData && menuData.length > 0) {
          menuRows = menuData as MenuItem[];
        }
      }

      if (menuRows.length === 0) {
        const { data: fallbackMenu } = await supabase
          .from("menu_items_v2")
          .select("id, name, category, subcategory, base_price, is_veg, is_available, description")
          .eq("is_available", true)
          .order("name", { ascending: true });

        if (fallbackMenu && fallbackMenu.length > 0) {
          menuRows = fallbackMenu as MenuItem[];
        }
      }

      if (menuRows.length > 0) {
        setMenuItems(
          menuRows.map((dish) => ({
            ...dish,
            variantsConfig: extractVariantsFromDescription(dish.description, Number(dish.base_price || 0)).config,
          }))
        );
      }

      // Past Orders & Active Orders
      if (restId) {
        await fetchPastOrders(restId);
        await fetchActiveOrders(restId);
      }
    } catch (err) {
      console.error("Failed to load POS floor:", err);
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

  const fetchPastOrders = async (restId: string) => {
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
  };

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

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel("pos_floor_sync")
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
          fetchPastOrders(restaurantId);
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

    locations.forEach((loc) => {
      map.set(loc.name, {
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
    });

    const findLocationKey = (tableNo: string) => {
      const norm = normalizeTableIdentifier(tableNo);
      for (const loc of locations) {
        if (normalizeTableIdentifier(loc.name) === norm) {
          return loc.name;
        }
      }
      return tableNo;
    };

    activeOrders.forEach((order) => {
      const isTakeaway =
        order.table_no.toLowerCase().includes("takeaway") ||
        order.table_no.toLowerCase().includes("token");

      if (isTakeaway) return;

      const locKey = findLocationKey(order.table_no);
      const existing = map.get(locKey) || {
        status: "VACANT",
        orders: [],
        rounds: [],
        allItems: [],
        totalBill: 0,
        hasNewRound: false,
        hasBillRequest: false,
        hasUpiVerifyRequest: false,
        isPaid: false,
      };
      if (!map.has(locKey)) map.set(locKey, existing);

      existing.orders.push(order);

      if (order.status === "NEW") {
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

      const roundIndex = existing.rounds.length + 1;
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
  }, [locations, activeOrders]);

  // Floor Stats
  const floorStats = useMemo(() => {
    let occupied = 0;
    let vacant = 0;
    let billed = 0;
    let totalRevenue = 0;

    tableSessionMap.forEach((session) => {
      if (session.status === "VACANT") {
        vacant += 1;
      } else {
        occupied += 1;
        totalRevenue += session.totalBill;
        if (session.status === "BILLED") billed += 1;
      }
    });

    return { occupied, vacant, billed, totalRevenue, totalTables: locations.length };
  }, [tableSessionMap, locations]);

  // Filtered Tables for Grid
  const filteredTables = useMemo(() => {
    return locations.filter((loc) => {
      const session = tableSessionMap.get(loc.name);
      const isOccupied = session && session.status !== "VACANT";

      if (tableFilter === "OCCUPIED" && !isOccupied) return false;
      if (tableFilter === "VACANT" && isOccupied) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = loc.name.toLowerCase().includes(q);
        const matchesGuest = session?.customerName?.toLowerCase().includes(q);
        const matchesPhone = session?.customerPhone?.toLowerCase().includes(q);
        return matchesName || matchesGuest || matchesPhone;
      }

      return true;
    });
  }, [locations, tableSessionMap, tableFilter, searchQuery]);

  // Selected Table Session
  const activeSession = useMemo(() => {
    if (!activeTableModal) return null;
    return tableSessionMap.get(activeTableModal) || null;
  }, [activeTableModal, tableSessionMap]);

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
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
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
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
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

  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const gstAmount = taxableAmount * 0.05; // 5% GST
  const exactTotal = taxableAmount + gstAmount;
  const grandTotal = Math.round(exactTotal);
  const roundOff = Math.round((grandTotal - exactTotal) * 100) / 100;

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
      if (currentTablePin && currentTablePin !== "----") {
        noteParts.push(`[PIN:${currentTablePin}]`);
      }
      if (batchNote.trim()) noteParts.push(batchNote.trim());

      const { error } = await supabase.from("orders").insert({
        restaurant_id: restaurantId,
        table_no: activeTableModal,
        total: manualCart.reduce((s, it) => s + it.price * it.quantity, 0),
        status: "PREPARING",
        payment_status: "PENDING",
        customer_name: manualCustomerName.trim() || activeSession?.customerName || "Dine-in Guest",
        customer_phone: manualCustomerPhone.trim() || activeSession?.customerPhone || null,
        items_json: itemsPayload,
        note: noteParts.join(" "),
      });

      if (error) throw error;

      // Print Thermal KOT Chit
      setPrintChit({
        type: "KOT",
        mode: "DINE_IN",
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
      });

      showToast(`${activeTableModal}: Round #${roundNum} fired to kitchen`);
      setManualCart([]);
      setBatchNote("");

      if (restaurantId) fetchActiveOrders(restaurantId);

      setTimeout(() => {
        window.print();
      }, 100);
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

        await supabase.from("orders").insert({
          restaurant_id: restaurantId,
          table_no: activeTableModal,
          total: manualCart.reduce((s, it) => s + it.price * it.quantity, 0),
          status: "COMPLETED",
          payment_status: "PAID",
          payment_method: "COUNTER",
          customer_name: manualCustomerName.trim() || activeSession?.customerName || "Dine-in Guest",
          customer_phone: manualCustomerPhone.trim() || activeSession?.customerPhone || null,
          items_json: unsavedPayload,
          note: `[POS Final Round - PAID] [PIN:${currentTablePin}]`,
        });

        setManualCart([]);
      }

      // 2. Mark existing active orders as PAID (Triggers Thank You View on customer device via Supabase Realtime!)
      if (orderIds.length > 0) {
        const { error } = await supabase
          .from("orders")
          .update({
            payment_status: "PAID",
            payment_method: "COUNTER",
          })
          .in("id", orderIds);

        if (error) throw error;
      }

      showToast(`${activeTableModal}: Payment collected! Thank you page shown on customer's phone.`);
      if (restaurantId) {
        fetchActiveOrders(restaurantId);
        fetchPastOrders(restaurantId);
      }
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

      if (orderIds.length > 0) {
        const { error } = await supabase
          .from("orders")
          .update({
            status: "COMPLETED",
            payment_status: "PAID",
          })
          .in("id", orderIds);

        if (error) throw error;
      }

      showToast(`${activeTableModal} has been settled and is now vacant. PIN cycled for next party.`);
      setActiveTableModal(null);
      setManualCart([]);
      setBatchNote("");

      if (restaurantId) {
        fetchActiveOrders(restaurantId);
        fetchPastOrders(restaurantId);
      }
    } catch (err: any) {
      showToast("Failed to settle table: " + (err.message || "Error"));
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

    setPrintChit({
      type: "BILL",
      mode: "DINE_IN",
      tableOrToken: activeTableModal,
      customerName: manualCustomerName || activeSession?.customerName,
      customerPhone: manualCustomerPhone || activeSession?.customerPhone,
      items: allBillItems,
      subtotal,
      discount: effectiveDiscount,
      tax: gstAmount,
      roundOff,
      grandTotal,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleReprintKOT = (round: TableRound) => {
    setPrintChit({
      type: "KOT",
      mode: "DINE_IN",
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
    });

    setTimeout(() => {
      window.print();
    }, 100);
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

  const currentToken = tokenOverride ?? nextTokenNumber;

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

  const takeawayTotal = useMemo(() => {
    return Math.max(0, Math.round(takeawaySubtotal + takeawayPackagingAmount - takeawayDiscountAmount));
  }, [takeawaySubtotal, takeawayPackagingAmount, takeawayDiscountAmount]);

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
      const tokenFormatted = `Token #${String(currentToken).padStart(2, "0")}`;
      const tokenIdentifier = `Takeaway #${String(currentToken).padStart(2, "0")}`;

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

      const { error } = await supabase.from("orders").insert({
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

      if (error) throw error;

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
        grandTotal: takeawayTotal,
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
      setTokenOverride(currentToken + 1);

      if (restaurantId) {
        fetchActiveOrders(restaurantId);
        fetchPastOrders(restaurantId);
      }

      setTimeout(() => {
        window.print();
      }, 100);
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

    setPrintChit({
      type: "BILL",
      mode: "TAKEAWAY",
      tableOrToken: tokenFormatted,
      customerName: order.customer_name || "Takeaway Guest",
      customerPhone: order.customer_phone || undefined,
      items,
      subtotal: order.total,
      grandTotal: order.total,
      time: new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setTimeout(() => {
      window.print();
    }, 100);
  };

  /* ─── Render View ────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-[#FAF8F7] text-zinc-900 select-none overflow-hidden font-sans">
      
      {/* ── TOP DECK / NAVIGATION BAR ── */}
      <header className="h-14 bg-white px-4 sm:px-6 flex items-center justify-between shrink-0 z-40 relative">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-zinc-700 hover:text-black font-semibold text-xs tracking-tight transition-colors shrink-0"
        >
          <span className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600">
            <ChevronLeft size={16} />
          </span>
          <span className="hidden sm:inline">Back to Dashboard</span>
        </Link>

        {/* Inventory-style Tab Switcher */}
        <div className="bg-gray-100/80 p-1 rounded-xl flex items-center gap-1 w-full max-w-xs shadow-inner border border-gray-200/50">
          <button 
            type="button"
            onClick={() => setTerminalMode("DINE_IN")}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-[13px] font-medium transition-all cursor-pointer ${
              terminalMode === "DINE_IN" 
                ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-gray-900 font-semibold" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <UtensilsCrossed size={14} className={terminalMode === "DINE_IN" ? "text-[#E46254]" : ""} />
            Dine-In
          </button>
          <button 
            type="button"
            onClick={() => {
              setTerminalMode("TAKEAWAY");
              setActiveTableModal(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-[13px] font-medium transition-all cursor-pointer ${
              terminalMode === "TAKEAWAY" 
                ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-gray-900 font-semibold" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ShoppingBag size={14} className={terminalMode === "TAKEAWAY" ? "text-[#E46254]" : ""} />
            Takeaway
          </button>
        </div>

        {/* Empty Balancer for True Center Alignment */}
        <div className="w-7 sm:w-28 shrink-0" />
      </header>

      {/* ── FLOOR FILTER TOOLBAR ── */}
      <div className="px-6 py-3 bg-white border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search table, guest name or phone... (Press '/')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-[#FAF8F7] border border-zinc-200/80 rounded-xl text-xs font-medium outline-none focus:border-[#E46254] focus:bg-white transition-all placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Table Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#FAF8F7] p-1 rounded-xl border border-zinc-200/80 text-xs">
          {(["ALL", "OCCUPIED", "VACANT"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTableFilter(tab)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                tableFilter === tab
                  ? "bg-white text-zinc-900 shadow-2xs border border-zinc-200/60"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {tab === "ALL" && `All Tables (${locations.length})`}
              {tab === "OCCUPIED" && `Running (${floorStats.occupied})`}
              {tab === "VACANT" && `Vacant (${floorStats.vacant})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── FLOOR GRID VIEW ── */}
      <div className="flex-1 overflow-y-auto p-6 slim-scrollbar">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <div className="w-8 h-8 border-2 border-zinc-200 border-t-[#E46254] rounded-full animate-spin" />
            <p className="text-xs font-medium">Loading restaurant dining floor...</p>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-zinc-200/80 max-w-md mx-auto my-12">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF8F7] border border-zinc-200/80 flex items-center justify-center text-zinc-400 mb-3">
              <UtensilsCrossed size={20} />
            </div>
            <h3 className="font-bold text-sm text-zinc-800">No tables found</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              {searchQuery
                ? `No tables matching "${searchQuery}"`
                : "Create your dining tables in Locations to start taking orders and viewing your floor layout."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredTables.map((table) => {
              const session = tableSessionMap.get(table.name);
              const isOccupied = session && session.status !== "VACANT";
              const hasBillRequest = session?.hasBillRequest;
              const hasUpiVerifyRequest = session?.hasUpiVerifyRequest;
              const isPaid = session?.isPaid;
              const isBillPrinted = session?.status === "BILLED";
              const elapsedMinutes = session?.firstOrderAt
                ? Math.max(0, Math.floor((Date.now() - new Date(session.firstOrderAt).getTime()) / 60000))
                : 0;

              const normTbl = normalizeTableIdentifier(table.name);
              const cardActive = activeOrders.filter(
                (o) => normalizeTableIdentifier(o.table_no) === normTbl && o.status !== "CANCELLED"
              );
              const cardPast = pastOrdersHistory.filter(
                (o) => normalizeTableIdentifier(o.table_no) === normTbl && o.payment_status === "PAID"
              );
              const { pin: cardPin } = resolveTablePinAndSeed(table.name, cardActive, cardPast);

              return (
                <div
                  key={table.id}
                  onClick={() => setActiveTableModal(table.name)}
                  className={`rounded-2xl border p-4 transition-all flex flex-col justify-between cursor-pointer min-h-[175px] group shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
                    hasBillRequest
                      ? "bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20"
                      : hasUpiVerifyRequest
                      ? "bg-blue-50/60 border-blue-300 ring-2 ring-blue-400/20"
                      : isPaid
                      ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300/40"
                      : isOccupied
                      ? "bg-white border-[#E46254]/40 ring-1 ring-[#E46254]/20"
                      : "bg-white border-zinc-200/80 hover:border-zinc-300"
                  }`}
                >
                  {/* Top Bar: Table Identifier & PIN & Status */}
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="font-black text-base text-zinc-900 group-hover:text-[#E46254] transition-colors tracking-tight">
                          {table.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {table.capacity && (
                            <span className="text-[10px] text-zinc-400 font-medium">
                              {table.capacity}p
                            </span>
                          )}
                          <span className="text-[10px] font-mono font-bold text-zinc-600 bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200/60">
                            PIN: {cardPin}
                          </span>
                        </div>
                      </div>

                      {/* Status Indicator */}
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {hasBillRequest ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#E46254] text-white text-[10px] font-bold shadow-2xs">
                            Bill Call
                          </span>
                        ) : hasUpiVerifyRequest ? (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-white text-[10px] font-bold shadow-2xs">
                            Verify UPI
                          </span>
                        ) : isPaid ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            Paid • Seated
                          </span>
                        ) : isBillPrinted ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                            Billed
                          </span>
                        ) : isOccupied ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#E46254]/10 text-[#C2410C] text-[10px] font-bold border border-[#E46254]/20">
                            Running
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-medium border border-zinc-200/60">
                            Vacant
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Active Session Details or Vacant State */}
                    {isOccupied ? (
                      <div className="space-y-1.5 mt-3 pt-3 border-t border-zinc-100">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 truncate text-zinc-700 font-medium">
                            <User size={12} className="text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[110px]">
                              {session?.customerName || "Dine-in Guest"}
                            </span>
                          </div>
                          <span className="text-[10.5px] text-zinc-400 font-mono flex items-center gap-1 shrink-0">
                            <Clock size={10} />
                            {elapsedMinutes}m
                          </span>
                        </div>

                        {session?.customerPhone && (
                          <div className="flex items-center gap-1 text-[10.5px] text-zinc-500 font-mono">
                            <Phone size={10} className="text-zinc-400" />
                            <span>{session.customerPhone}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10.5px] text-zinc-400 pt-0.5 font-medium">
                          <span>
                            {session?.rounds.length} {session?.rounds.length === 1 ? "round" : "rounds"}
                          </span>
                          <span className="font-mono font-semibold text-zinc-700">₹{session?.totalBill || 0}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-5 flex flex-col items-center justify-center text-center">
                        <div className="w-8 h-8 rounded-full bg-[#FAF8F7] border border-zinc-200/60 flex items-center justify-center text-zinc-400 mb-1.5">
                          <UtensilsCrossed size={14} />
                        </div>
                        <span className="text-[11px] text-zinc-400 font-medium">Ready for guests</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between">
                    {isOccupied ? (
                      <>
                        <div>
                          <span className="text-[9.5px] text-zinc-400 uppercase tracking-wider font-semibold block">
                            Bill Total
                          </span>
                          <span className="text-base font-black text-zinc-900 font-mono tabular-nums">
                            ₹{session?.totalBill || 0}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-[#E46254] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          <span>Open</span>
                          <ChevronRight size={13} />
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] font-bold text-zinc-600 group-hover:text-black flex items-center gap-1 w-full justify-center py-0.5">
                        <Plus size={12} />
                        <span>Seat Table</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
              onClick={() => setTerminalMode("DINE_IN")}
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

              {/* Horizontal Category Pill Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 slim-scrollbar">
                {drawerCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedDrawerCat(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedDrawerCat === cat
                        ? "bg-[#E46254]/10 text-[#C2410C] border border-[#E46254]/30 shadow-2xs"
                        : "bg-[#FAF8F7] hover:bg-[#E46254]/5 text-zinc-600 border border-zinc-200/60"
                    }`}
                  >
                    {cat === "ALL" ? "All Categories" : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* High-Speed Food Catalog Grid */}
            <div className="flex-1 overflow-y-auto p-4 slim-scrollbar">
              {filteredCatalog.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-center">
                  <UtensilsCrossed size={20} className="mb-2 opacity-50 text-zinc-400" />
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

                    return (
                      <div
                        key={dish.id}
                        className="bg-white rounded-2xl p-3.5 border border-zinc-200/80 hover:border-zinc-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <span className="font-bold text-xs text-zinc-900 group-hover:text-[#E46254] transition-colors leading-snug line-clamp-2">
                              {dish.name}
                            </span>
                          </div>

                          <span className="text-[10.5px] text-zinc-400 font-medium block">
                            {dish.category}
                          </span>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-zinc-100">
                          {hasPortions ? (
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-2 gap-1">
                                {portions.map((portion, pIdx) => (
                                  <button
                                    key={portion.name || pIdx}
                                    type="button"
                                    onClick={() => handleQuickAddPortion(dish, portion)}
                                    className="py-1 px-1.5 rounded-lg bg-[#FAF8F7] hover:bg-[#E46254] hover:text-white text-zinc-800 text-[10.5px] font-bold border border-zinc-200/80 transition-colors flex items-center justify-between cursor-pointer"
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
                                  + Addons / Instructions
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-xs text-zinc-900">
                                ₹{dish.base_price}
                              </span>

                              <div className="flex items-center gap-1">
                                {hasAddons && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCustomizer(dish)}
                                    className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[10.5px] font-bold cursor-pointer"
                                    title="Customise addons"
                                  >
                                    Custom
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleQuickAddBase(dish)}
                                  className="w-7 h-7 rounded-lg bg-[#FAF8F7] hover:bg-[#E46254] hover:text-white text-zinc-800 border border-zinc-200/80 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Add to Ticket"
                                >
                                  <Plus size={13} strokeWidth={2.5} />
                                </button>
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
                  <span className="font-mono text-[11px] text-[#E46254] font-bold">
                    #{String(currentToken).padStart(2, "0")}
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
                      <User size={12} className="text-zinc-400" />
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
                        Tap any dish from the catalog on the left to start billing Token #{String(currentToken).padStart(2, "0")}.
                      </p>
                    </div>
                  ) : (
                    takeawayCart.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-[#FAF8F7] rounded-xl border border-zinc-200/80 hover:border-zinc-300 transition-all flex items-start justify-between gap-3 group"
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

                {/* Bill Footer & Quick Checkout */}
                <div className="p-4 bg-white border-t border-zinc-200/80 space-y-3 shrink-0">
                  
                  {/* Packaging Selector (3 Tiers) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Packaging Option
                      </span>
                      {takeawayPackagingAmount > 0 && (
                        <span className="text-[11px] font-mono font-bold text-[#C2410C]">
                          +₹{takeawayPackagingAmount}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTakeawayPackagingTier("NONE")}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          takeawayPackagingTier === "NONE"
                            ? "bg-white text-zinc-900 border-zinc-400 shadow-2xs"
                            : "bg-[#FAF8F7] text-zinc-500 border-zinc-200/80 hover:bg-zinc-100"
                        }`}
                      >
                        No Bag (₹0)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTakeawayPackagingTier("BAG_5")}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          takeawayPackagingTier === "BAG_5"
                            ? "bg-[#E46254]/10 text-[#C2410C] border-[#E46254]/40 shadow-2xs"
                            : "bg-[#FAF8F7] text-zinc-500 border-zinc-200/80 hover:bg-zinc-100"
                        }`}
                      >
                        Paper Bag (+₹5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTakeawayPackagingTier("BOX_15")}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          takeawayPackagingTier === "BOX_15"
                            ? "bg-[#E46254]/10 text-[#C2410C] border-[#E46254]/40 shadow-2xs"
                            : "bg-[#FAF8F7] text-zinc-500 border-zinc-200/80 hover:bg-zinc-100"
                        }`}
                      >
                        Box/Carrier (+₹15)
                      </button>
                    </div>
                  </div>

                  {/* Suppressed Discount Toggle */}
                  {!takeawayShowDiscount ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setTakeawayShowDiscount(true)}
                        className="text-[11px] font-bold text-[#E46254] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Tag size={11} />
                        <span>+ Add discount</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-[#FAF8F7] border border-zinc-200/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                          Discount
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTakeawayShowDiscount(false);
                            setTakeawayDiscountPercent(0);
                            setTakeawayDiscountRupees("");
                          }}
                          className="text-[10px] text-zinc-400 hover:text-zinc-600 font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[5, 10, 15].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setTakeawayDiscountPercent(takeawayDiscountPercent === pct ? 0 : pct);
                              setTakeawayDiscountRupees("");
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              takeawayDiscountPercent === pct
                                ? "bg-[#E46254]/10 text-[#C2410C] border-[#E46254]/40"
                                : "bg-white text-zinc-700 border-zinc-200/80 hover:bg-zinc-50"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">₹</span>
                          <input
                            type="number"
                            placeholder="Custom"
                            value={takeawayDiscountRupees}
                            onChange={(e) => {
                              setTakeawayDiscountRupees(e.target.value);
                              setTakeawayDiscountPercent(0);
                            }}
                            className="w-full pl-5 pr-2 py-1 bg-white border border-zinc-200/80 rounded-lg text-xs font-mono outline-none focus:border-[#E46254]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bill Calculations */}
                  <div className="space-y-1 text-xs pt-1 border-t border-zinc-100">
                    <div className="flex justify-between text-zinc-500 font-medium">
                      <span>Items Subtotal:</span>
                      <span className="font-mono text-zinc-800">₹{takeawaySubtotal}</span>
                    </div>

                    {takeawayPackagingAmount > 0 && (
                      <div className="flex justify-between text-zinc-500 font-medium">
                        <span>Packaging:</span>
                        <span className="font-mono text-zinc-800">+₹{takeawayPackagingAmount}</span>
                      </div>
                    )}

                    {takeawayDiscountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Discount:</span>
                        <span className="font-mono">-₹{takeawayDiscountAmount.toFixed(0)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-baseline pt-1.5 border-t border-zinc-200">
                      <span className="font-bold text-sm text-zinc-900">Total Payable:</span>
                      <span className="font-mono font-black text-xl text-zinc-900">
                        ₹{takeawayTotal}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Payment Mode
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "UPI", label: "📱 UPI / QR" },
                        { id: "CASH", label: "💵 Cash" },
                        { id: "CARD", label: "💳 Card" },
                      ].map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setTakeawayPaymentMethod(pm.id as any)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            takeawayPaymentMethod === pm.id
                              ? "bg-[#E46254]/10 text-[#C2410C] border-[#E46254]/40 shadow-2xs"
                              : "bg-[#FAF8F7] text-zinc-600 border-zinc-200/80 hover:bg-zinc-100"
                          }`}
                        >
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Cash Tender Presets & Change Due Calculator */}
                  {takeawayPaymentMethod === "CASH" && (
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                          Cash Tender
                        </span>
                        <span className="text-[10.5px] text-zinc-400 font-mono">
                          Payable: ₹{takeawayTotal}
                        </span>
                      </div>

                      {/* Preset chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {cashTenderPresets.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setCashTenderAmount(String(amount))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                              cashTenderAmount === String(amount)
                                ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                                : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                            }`}
                          >
                            {amount === takeawayTotal ? `Exact (₹${amount})` : `₹${amount}`}
                          </button>
                        ))}
                      </div>

                      {/* Manual Tender Input */}
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-mono">₹</span>
                        <input
                          type="number"
                          placeholder="Enter tendered cash..."
                          value={cashTenderAmount}
                          onChange={(e) => setCashTenderAmount(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-semibold outline-none focus:border-[#E46254]"
                        />
                      </div>

                      {/* Change Due Indicator */}
                      {cashChangeDue !== null && (
                        <div
                          className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between border ${
                            cashChangeDue >= 0
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          <span>{cashChangeDue >= 0 ? "Change to return:" : "Short amount:"}</span>
                          <span className="font-mono text-sm font-black">
                            ₹{Math.abs(cashChangeDue)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Big Action Button */}
                  <button
                    type="button"
                    disabled={takeawayCart.length === 0 || isSubmitting}
                    onClick={handleCollectAndFireTakeaway}
                    className={`w-full py-3 rounded-2xl font-black text-sm tracking-wide shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      takeawayCart.length === 0 || isSubmitting
                        ? "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                        : "bg-[#E46254] hover:bg-[#d55345] text-white active:scale-[0.99]"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Punching Token...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>COLLECT & FIRE TOKEN (₹{takeawayTotal})</span>
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
      {/* ── FULL-SCREEN TABLE COMMAND STATION MODAL ── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTableModal && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-100">
          
          {/* 1. Command Station Header Deck */}
          <div className="h-14 bg-white border-b border-zinc-200/80 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs">
            
            {/* Left: Return to Floor + Table Status Badge */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTableModal(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Return to floor overview (Esc)"
              >
                <ChevronLeft size={16} />
                <span>Floor (Esc)</span>
              </button>

              <div className="h-4 w-px bg-zinc-200" />

              <div className="flex items-center gap-2">
                <span className="text-base font-black text-zinc-900 tracking-tight">
                  {activeTableModal}
                </span>

                <div className="flex items-center gap-1.5">
                  {isTablePaid ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                      Paid • Seated
                    </span>
                  ) : !isVacantTable ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E46254]/10 text-[#C2410C] text-[11px] font-bold border border-[#E46254]/20">
                      Running • {activeSession?.rounds.length} {activeSession?.rounds.length === 1 ? "Round" : "Rounds"}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold border border-zinc-200">
                      Vacant Table
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Operational Info (Elapsed Timer, Table PIN, Guest CRM & Transfer) */}
            <div className="flex items-center gap-3 text-xs font-medium text-zinc-600">
              {!isVacantTable && activeSession?.firstOrderAt && (
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Clock size={13} className="text-[#E46254]" />
                  <span>Seated {Math.max(0, Math.floor((Date.now() - new Date(activeSession.firstOrderAt).getTime()) / 60000))}m ago</span>
                </div>
              )}

              {/* Table PIN Badge */}
              <div className="flex items-center gap-1.5 bg-[#E46254]/5 border border-[#E46254]/20 px-3 py-1 rounded-xl">
                <span className="text-[11px] text-[#C2410C] font-semibold">Table PIN:</span>
                <span className="font-mono font-bold text-zinc-900 text-xs tracking-wider">{currentTablePin}</span>
                <button
                  type="button"
                  onClick={() => handleCopyPin(currentTablePin)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  title="Copy Table PIN"
                >
                  <Copy size={11} />
                </button>
              </div>

              {/* Optional Guest CRM Button */}
              <button
                type="button"
                onClick={() => setIsGuestInfoModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-600 text-xs transition-colors cursor-pointer"
                title="Edit Guest Name / Phone"
              >
                <User size={12} className="text-zinc-400" />
                <span>{manualCustomerName || activeSession?.customerName || "Guest Details"}</span>
              </button>

              {!isVacantTable && (
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  title="Transfer orders to another table"
                >
                  <ArrowRightLeft size={13} className="text-[#E46254]" />
                  <span>Transfer Table</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Command Station Body: ITEMS/MENU ON LEFT (63%), TICKET ON RIGHT (37%) */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* ── LEFT PANEL (63%): High-Speed Menu Catalog ── */}
            <div className="w-full lg:w-[63%] flex flex-col border-r border-zinc-200/80 bg-[#FAF8F7] overflow-hidden">
              
              {/* Top Search Bar & Category Tabs */}
              <div className="p-4 bg-white border-b border-zinc-200/80 space-y-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search dishes (Press '/' to focus)..."
                    value={dishSearchQuery}
                    onChange={(e) => setDishSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-[#FAF8F7] border border-zinc-200/80 rounded-xl text-xs font-medium outline-none focus:border-[#E46254] focus:bg-white transition-all"
                  />
                  {dishSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDishSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Horizontal Category Pill Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 slim-scrollbar">
                  {drawerCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedDrawerCat(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        selectedDrawerCat === cat
                          ? "bg-[#E46254]/10 text-[#C2410C] border border-[#E46254]/30 shadow-2xs"
                          : "bg-[#FAF8F7] hover:bg-[#E46254]/5 text-zinc-600 border border-zinc-200/60"
                      }`}
                    >
                      {cat === "ALL" ? "All Categories" : cat}
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

                      return (
                        <div
                          key={dish.id}
                          className="bg-white rounded-2xl p-3.5 border border-zinc-200/80 hover:border-zinc-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1 mb-1.5">
                              <span className="font-bold text-xs text-zinc-900 group-hover:text-[#E46254] transition-colors leading-snug line-clamp-2">
                                {dish.name}
                              </span>
                            </div>

                            <span className="text-[10.5px] text-zinc-400 font-medium block">
                              {dish.category}
                            </span>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-zinc-100">
                            {/* Inline Portions Buttons */}
                            {hasPortions ? (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-2 gap-1">
                                  {portions.map((portion, pIdx) => (
                                    <button
                                      key={portion.name || pIdx}
                                      type="button"
                                      onClick={() => handleQuickAddPortion(dish, portion)}
                                      className="py-1 px-1.5 rounded-lg bg-[#FAF8F7] hover:bg-[#E46254] hover:text-white text-zinc-800 text-[10.5px] font-bold border border-zinc-200/80 transition-colors flex items-center justify-between cursor-pointer"
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
                                    + Addons / Instructions
                                  </button>
                                )}
                              </div>
                            ) : (
                              /* Standard Dish with Single Price */
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-xs text-zinc-900">
                                  ₹{dish.base_price}
                                </span>

                                <div className="flex items-center gap-1">
                                  {hasAddons && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCustomizer(dish)}
                                      className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[10.5px] font-bold cursor-pointer"
                                      title="Customise addons"
                                    >
                                      Custom
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleQuickAddBase(dish)}
                                    className="w-7 h-7 rounded-lg bg-[#FAF8F7] hover:bg-[#E46254] hover:text-white text-zinc-800 border border-zinc-200/80 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Add to Ticket"
                                  >
                                    <Plus size={13} strokeWidth={2.5} />
                                  </button>
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
            <div className="w-full lg:w-[37%] flex flex-col bg-white overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 slim-scrollbar">
                
                {/* Header status bar */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Active Table Ticket</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {!isVacantTable
                        ? `${activeSession?.rounds.length} ${activeSession?.rounds.length === 1 ? 'round' : 'rounds'} fired`
                        : "No orders fired yet"}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-sm text-zinc-900">
                    Live Total: ₹{grandTotal}
                  </span>
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

                    <div className="divide-y divide-[#E46254]/10">
                      {manualCart.map((it) => (
                        <div key={it.id} className="py-2 flex items-center justify-between text-xs">
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
                    {activeSession.rounds.map((round) => (
                      <div
                        key={round.orderId}
                        className="bg-white rounded-2xl border border-zinc-200/80 p-3.5 space-y-2.5 shadow-2xs hover:border-zinc-300 transition-all"
                      >
                        {/* Round Header (No Void Round Button) */}
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 font-mono text-xs">
                              Round #{round.roundNumber}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E46254]/5 text-[#C2410C] border border-[#E46254]/15">
                              {round.source === "QR" ? "Customer QR" : round.source === "CAPTAIN" ? "Captain App" : "POS Counter"}
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

                        {/* Round Items with Clean Edit & Remove controls */}
                        <div className="space-y-1.5">
                          {round.items.map((it) => (
                            <div
                              key={it.itemIndex}
                              className="py-2 px-2.5 rounded-xl bg-zinc-50/70 hover:bg-zinc-50 border border-zinc-100/90 flex items-center justify-between text-xs transition-colors"
                            >
                              <div className="flex items-start gap-2 flex-1 pr-2 min-w-0">
                                <span className="font-mono font-bold text-zinc-600 bg-white border border-zinc-200/80 px-1.5 py-0.2 rounded text-[11px] shrink-0 mt-0.5">
                                  {it.quantity}×
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-zinc-900 leading-snug truncate max-w-[170px]">{it.name}</span>
                                  </div>
                                  {it.notes && (
                                    <span className="text-[10.5px] text-[#C2410C] mt-0.5 block font-medium truncate max-w-[190px]">
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
                    ))}
                  </div>
                ) : manualCart.length === 0 ? (
                  <div className="p-8 bg-[#FAF8F7] rounded-2xl border border-dashed border-zinc-200 text-center space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-[#E46254]/10 text-[#E46254] flex items-center justify-center mx-auto mb-1">
                      <UtensilsCrossed size={18} />
                    </div>
                    <p className="text-xs font-bold text-zinc-800">Table is vacant</p>
                    <p className="text-[11.5px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                      Select dishes from the menu on the left to start this table and fire Round #1.
                    </p>
                  </div>
                ) : null}

                {/* 3. FINANCIAL SUMMARY WITH ROUND-OFF (Discount suppressed by default) */}
                {subtotal > 0 && (
                  <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 space-y-2.5 text-xs shadow-2xs">
                    <div className="flex justify-between text-zinc-500">
                      <span>Item Subtotal</span>
                      <span className="font-semibold text-zinc-800 font-mono">₹{subtotal}</span>
                    </div>

                    {/* Suppressed Discount Section: Not openly shown */}
                    {effectiveDiscount > 0 ? (
                      <div className="flex items-center justify-between text-emerald-600 font-medium pt-1.5 border-t border-zinc-100">
                        <span className="flex items-center gap-1">
                          <Tag size={11} />
                          <span>Discount ({discountPercent > 0 ? `${discountPercent}%` : "Flat"})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono">-₹{effectiveDiscount.toFixed(1)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountPercent(0);
                              setCustomDiscountRupees("");
                              setShowDiscountControls(false);
                            }}
                            className="text-[10px] text-zinc-400 hover:text-rose-600 underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : showDiscountControls ? (
                      <div className="pt-2 border-t border-zinc-100 space-y-2">
                        <div className="flex items-center justify-between text-zinc-600 text-[11px]">
                          <span className="font-semibold">Apply Discount</span>
                          <button
                            type="button"
                            onClick={() => setShowDiscountControls(false)}
                            className="text-zinc-400 hover:text-zinc-700 text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {[5, 10, 15, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                setDiscountPercent(pct);
                                setCustomDiscountRupees("");
                              }}
                              className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                                discountPercent === pct && !customDiscountRupees
                                  ? "bg-[#E46254] text-white border-[#E46254]"
                                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                          <input
                            type="number"
                            placeholder="₹ Flat"
                            value={customDiscountRupees}
                            onChange={(e) => {
                              setCustomDiscountRupees(e.target.value);
                              setDiscountPercent(0);
                            }}
                            className="w-16 px-2 py-1 bg-[#FAF8F7] border border-zinc-200 rounded-lg text-xs font-mono outline-none focus:border-[#E46254]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowDiscountControls(true)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-600 flex items-center gap-1 cursor-pointer"
                        >
                          <Tag size={10} />
                          <span>+ Add discount</span>
                        </button>
                      </div>
                    )}

                    {gstAmount > 0 && (
                      <div className="flex justify-between text-zinc-500">
                        <span>GST (5%)</span>
                        <span className="font-semibold text-zinc-800 font-mono">₹{gstAmount.toFixed(1)}</span>
                      </div>
                    )}

                    {roundOff !== 0 && (
                      <div className="flex justify-between text-zinc-400 text-[10.5px]">
                        <span>Round-off</span>
                        <span className="font-mono">
                          {roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-zinc-900 font-bold text-sm pt-2 border-t border-zinc-200">
                      <span>Grand Total</span>
                      <span className="font-mono text-base font-black">₹{grandTotal}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── ACTION DOCK: PRINT BILL & SIMPLE SETTLE BUTTON (NO EMOJI, NO DESCRIPTION) ── */}
              <div className="p-4 bg-[#FAF8F7] border-t border-zinc-200/80 space-y-2 shrink-0">
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
                      disabled={subtotal === 0 || isSubmitting}
                      onClick={handlePaymentCollected}
                      className="sm:col-span-2 py-3 px-4 rounded-xl bg-[#E46254] hover:bg-[#d55345] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center cursor-pointer transition-all shadow-xs"
                    >
                      Payment Collected
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
          <div className="max-w-[80mm] mx-auto space-y-2">
            <div className="text-center border-b pb-2">
              <h2 className="text-base font-black uppercase tracking-tight">{restaurantName}</h2>
              {restaurantAddress && <p className="text-[10px]">{restaurantAddress}</p>}
              <p className="font-bold mt-1 text-sm tracking-wider">
                {printChit.type === "KOT" ? `*** KOT #${printChit.kotNumber || 1} ***` : "*** TAX INVOICE ***"}
              </p>
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
                <div className="flex justify-between">
                  <span>GST (5%):</span>
                  <span>₹{printChit.tax?.toFixed(2)}</span>
                </div>
                {printChit.roundOff !== 0 && (
                  <div className="flex justify-between text-[10px]">
                    <span>Round-off:</span>
                    <span>{printChit.roundOff! > 0 ? `+₹${printChit.roundOff}` : `-₹${Math.abs(printChit.roundOff!)}`}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm border-t pt-1">
                  <span>Grand Total:</span>
                  <span>₹{printChit.grandTotal}</span>
                </div>
              </div>
            )}

            <div className="text-center pt-3 text-[10px] border-t mt-3">
              {printChit.type === "KOT"
                ? "KITCHEN PRODUCTION ORDER"
                : printChit.mode === "TAKEAWAY"
                ? "Thank you for ordering with us! Visit again."
                : "Thank you for dining with us! Visit again."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
