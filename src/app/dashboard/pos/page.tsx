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
  ChevronLeft,
  ArrowRightLeft,
  Copy,
  Percent,
  ChefHat,
  Tag,
} from "lucide-react";
import QRCode from "react-qr-code";
import { createClient } from "@/utils/supabase/client";
import {
  ItemVariantsConfig,
  extractVariantsFromDescription,
  PortionOption,
  AddonOption,
  COMMON_PREP_TAGS,
} from "@/utils/menuItemVariants";
import { resolveTablePinAndSeed } from "@/utils/tableSessionPin";

/* ─── Domain Models ────────────────────────────────────────────────── */
interface Location {
  id: string;
  name: string;
  type?: string;
  capacity?: number;
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
    name: string;
    quantity: number;
    price: number;
    isVeg?: boolean;
    notes?: string;
  }>;
}

interface TableSessionData {
  status: "COOKING" | "BILLED" | "VACANT";
  orders: OrderRecord[];
  rounds: TableRound[];
  allItems: Array<{
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
}

interface NewStaffItem {
  id: string;
  dishId?: string;
  name: string;
  portionName?: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  category?: string;
  notes?: string;
  addons?: { name: string; price: number }[];
  prepTags?: string[];
}

type TerminalMode = "DINE_IN" | "TAKEAWAY";
type PaymentMethod = "CASH" | "UPI" | "CARD";

export default function PosPage() {
  const supabase = createClient();

  // Core Platform Data
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("Restaurant");
  const [upiId, setUpiId] = useState<string>("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Terminal Navigation & Filters
  const [terminalMode, setTerminalMode] = useState<TerminalMode>("DINE_IN");
  const [tableFilter, setTableFilter] = useState<"ALL" | "OCCUPIED" | "VACANT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active Full-Screen Table Command Station
  const [activeTableModal, setActiveTableModal] = useState<string | null>(null);

  // Menu Search & Filter in Full-Screen View
  const [dishSearchQuery, setDishSearchQuery] = useState("");
  const [selectedDrawerCat, setSelectedDrawerCat] = useState("ALL");
  const [catalogVegFilter, setCatalogVegFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");

  // Manual Punching / Staged Cart
  const [manualCart, setManualCart] = useState<NewStaffItem[]>([]);
  const [batchNote, setBatchNote] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");

  // Dish Customizer State (Portions, Add-ons, Quick Prep Tags)
  const [customizingDish, setCustomizingDish] = useState<MenuItem | null>(null);
  const [selectedPortion, setSelectedPortion] = useState<PortionOption | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<AddonOption[]>([]);
  const [selectedPrepTags, setSelectedPrepTags] = useState<string[]>([]);
  const [customDishNote, setCustomDishNote] = useState<string>("");

  // Settlement & Discount State
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customDiscountRupees, setCustomDiscountRupees] = useState<string>("");
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Table Transfer State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetTable, setTransferTargetTable] = useState<string>("");

  // Split Tender State
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitUpiAmount, setSplitUpiAmount] = useState<string>("");
  const [splitCashAmount, setSplitCashAmount] = useState<string>("");

  // Table Bill Printed State (In-Memory tracking per session)
  const [printedTables, setPrintedTables] = useState<Set<string>>(new Set());

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
    customerPhone?: string;
    items: Array<{ name: string; quantity: number; price?: number; notes?: string }>;
    subtotal?: number;
    discount?: number;
    tax?: number;
    grandTotal?: number;
    paymentMethod?: string;
    time: string;
  } | null>(null);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  /* ─── 1. Load Initial Core POS Data ──────────────────────────────── */
  const loadInitialData = async () => {
    try {
      setLoading(true);
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

      // Menu Catalog
      const { data: menuData } = await supabase
        .from("menu_items_v2")
        .select("*")
        .eq("restaurant_id", restId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (menuData) {
        setMenuItems(
          menuData.map((row: any) => {
            const { cleanDescription, config } = extractVariantsFromDescription(row.description, Number(row.base_price || 0));
            return {
              id: row.id,
              name: row.name,
              category: row.category || "General",
              subcategory: row.subcategory || "",
              base_price: Number(row.base_price || 0),
              is_veg: row.is_veg !== false,
              is_available: row.is_available !== false,
              description: cleanDescription,
              variantsConfig: config,
            };
          })
        );
      }

      await fetchActiveOrders(restId);
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

  useEffect(() => {
    loadInitialData();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (customizingDish) {
          setCustomizingDish(null);
        } else if (isTransferModalOpen) {
          setIsTransferModalOpen(false);
        } else if (isPaymentDrawerOpen) {
          setIsPaymentDrawerOpen(false);
        } else {
          setActiveTableModal(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [customizingDish, isTransferModalOpen, isPaymentDrawerOpen]);

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
        rounds: [],
        allItems: [],
        totalBill: 0,
        hasNewRound: false,
        hasBillRequest: false,
        hasUpiVerifyRequest: false,
      };

      existing.orders.push(order);
      existing.totalBill += Number(order.total || 0);

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
      const roundItems: Array<{ name: string; quantity: number; price: number; isVeg?: boolean; notes?: string }> = [];

      if (Array.isArray(order.items_json)) {
        order.items_json.forEach((raw: any) => {
          const itemObj = raw.item || raw;
          const parsedItem = {
            name: itemObj.name || "Custom Item",
            price: Number(raw.price || itemObj.basePrice || itemObj.base_price || 0),
            quantity: Number(raw.quantity || 1),
            isVeg: itemObj.isVeg ?? itemObj.is_veg ?? true,
            notes: raw.notes || raw.specialInstructions || "",
          };

          roundItems.push(parsedItem);

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

  const occupiedCount = Array.from(tableSessionMap.values()).filter(
    (s) => s.status !== "VACANT"
  ).length;
  const vacantCount = locations.length - occupiedCount;

  // Filtered Tables for Floor Grid
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
        session?.customerPhone?.includes(q) ||
        session?.allItems.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [locations, tableSessionMap, tableFilter, searchQuery]);

  // Selected Table Session
  const activeSession = useMemo(() => {
    if (!activeTableModal) return null;
    return tableSessionMap.get(activeTableModal) || null;
  }, [activeTableModal, tableSessionMap]);

  const isVacantTable = !activeSession || activeSession.status === "VACANT" || activeSession.rounds.length === 0;

  // Table PIN derived deterministically
  const currentTablePin = useMemo(() => {
    if (!activeTableModal) return "1234";
    const { pin } = resolveTablePinAndSeed(activeTableModal, activeSession?.orders || []);
    return pin;
  }, [activeTableModal, activeSession]);

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
    setIsPaymentDrawerOpen(false);
    setIsSplitMode(false);
    setSplitUpiAmount("");
    setSplitCashAmount("");
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
      const matchVeg =
        catalogVegFilter === "ALL" ||
        (catalogVegFilter === "VEG" && m.is_veg) ||
        (catalogVegFilter === "NON_VEG" && !m.is_veg);
      return matchCat && matchSearch && matchVeg;
    });
  }, [menuItems, selectedDrawerCat, dishSearchQuery, catalogVegFilter]);

  const handleDishClick = (dish: MenuItem) => {
    const hasVariants = Boolean(
      dish.variantsConfig?.hasPortions ||
      dish.variantsConfig?.hasAddons ||
      (dish.variantsConfig?.prepTags && dish.variantsConfig.prepTags.length > 0)
    );

    if (hasVariants) {
      const defaultPortion =
        dish.variantsConfig?.portions?.find(
          (p) => p.isDefault || p.name.toLowerCase() === "full"
        ) ||
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
    } else {
      addToManualCartDirect(dish);
    }
  };

  const addToManualCartDirect = (dish: MenuItem) => {
    setManualCart((prev) => {
      const idx = prev.findIndex(
        (i) =>
          (i.dishId === dish.id || i.id === dish.id) &&
          !i.portionName &&
          (!i.notes || i.notes === "")
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
    });
  };

  const handleConfirmCustomDish = () => {
    if (!customizingDish) return;

    const portionPrice = selectedPortion
      ? selectedPortion.price
      : customizingDish.base_price;
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

    setManualCart((prev) => {
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
    });

    setCustomizingDish(null);
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

  /* ─── 4. Financial Calculations ─────────────────────────────────── */
  const subtotal = useMemo(() => {
    const existingTotal = activeSession
      ? activeSession.allItems.reduce((s, it) => s + it.price * it.quantity, 0)
      : 0;
    const manualTotal = manualCart.reduce((s, it) => s + it.price * it.quantity, 0);
    return existingTotal + manualTotal;
  }, [activeSession, manualCart]);

  const effectiveDiscount = useMemo(() => {
    if (customDiscountRupees && !isNaN(parseFloat(customDiscountRupees))) {
      return Math.min(subtotal, parseFloat(customDiscountRupees));
    }
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent, customDiscountRupees]);

  const taxTotal = useMemo(() => {
    return Math.max(0, (subtotal - effectiveDiscount) * 0.05); // 5% GST
  }, [subtotal, effectiveDiscount]);

  const grandTotal = useMemo(() => {
    return Math.round(subtotal - effectiveDiscount + taxTotal);
  }, [subtotal, effectiveDiscount, taxTotal]);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered);
    if (isNaN(tendered) || tendered < grandTotal) return 0;
    return Math.round(tendered - grandTotal);
  }, [cashTendered, grandTotal]);

  /* ─── 5. Actions: Send KOT, Print Bill, Settle ──────────────────── */
  const handleSendManualKOT = async () => {
    if (manualCart.length === 0 || !activeTableModal) return;

    setIsSubmitting(true);
    try {
      const itemsPayload = manualCart.map((c) => ({
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

      const roundNum = (activeSession?.rounds.length || 0) + 1;
      const noteParts: string[] = [`[POS Fired Round #${roundNum}]`];
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

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order round?")) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "CANCELLED" })
        .eq("id", orderId);

      if (error) throw error;
      showToast("Order round cancelled");
      if (restaurantId) fetchActiveOrders(restaurantId);
    } catch (err: any) {
      showToast("Failed to cancel: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferTable = async (targetTable: string) => {
    if (!activeTableModal || !targetTable || targetTable === activeTableModal) return;
    const activeOrdersForTable = activeSession?.orders || [];
    if (activeOrdersForTable.length === 0) {
      setActiveTableModal(targetTable);
      showToast(`Switched to ${targetTable}`);
      setIsTransferModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const orderIds = activeOrdersForTable.map((o) => o.id);
      const { error } = await supabase
        .from("orders")
        .update({ table_no: targetTable })
        .in("id", orderIds);

      if (error) throw error;

      showToast(`Transferred active orders to ${targetTable}`);
      setActiveTableModal(targetTable);
      setIsTransferModalOpen(false);
      if (restaurantId) fetchActiveOrders(restaurantId);
    } catch (err: any) {
      showToast("Failed to transfer table: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintGuestBill = () => {
    if (!activeTableModal) return;
    const combinedItems = [
      ...(activeSession?.allItems || []),
      ...manualCart.map((c) => ({
        name: c.name,
        quantity: c.quantity,
        price: c.price,
      })),
    ];

    if (combinedItems.length === 0) {
      showToast("No active items on this table");
      return;
    }

    // Mark table as Check Printed in state
    setPrintedTables((prev) => new Set(prev).add(activeTableModal));

    setPrintChit({
      type: "BILL",
      mode: "DINE_IN",
      tableOrToken: activeTableModal,
      customerName: manualCustomerName.trim() || activeSession?.customerName || "Dine-in Guest",
      customerPhone: manualCustomerPhone.trim() || activeSession?.customerPhone,
      items: combinedItems,
      subtotal,
      discount: effectiveDiscount,
      tax: taxTotal,
      grandTotal,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    showToast(`Bill printed for Table ${activeTableModal}`);

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleReprintKOT = (round: TableRound) => {
    if (!activeTableModal || round.items.length === 0) return;

    setPrintChit({
      type: "KOT",
      mode: "DINE_IN",
      tableOrToken: activeTableModal,
      kotNumber: round.roundNumber,
      customerName: activeSession?.customerName,
      customerPhone: activeSession?.customerPhone,
      items: round.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        notes: `REPRINT - Round #${round.roundNumber}`,
      })),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleSettleTable = async (method: PaymentMethod, splitDetails?: { upi: number; cash: number }) => {
    if (!activeTableModal || subtotal === 0) {
      showToast("No items to settle");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderIds = (activeSession?.orders || []).map((o) => o.id);
      const settleNote = splitDetails 
        ? `[POS Settled: Split UPI ₹${splitDetails.upi} + Cash ₹${splitDetails.cash}]`
        : `[POS Settled: ${method}]`;

      if (orderIds.length > 0) {
        await supabase
          .from("orders")
          .update({
            status: "COMPLETED",
            payment_status: "PAID",
            payment_method: splitDetails ? "UPI" : method,
            total: grandTotal,
            note: settleNote,
          })
          .in("id", orderIds);
      }

      // If manual items were left in cart, commit them directly as settled
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
          payment_method: splitDetails ? "UPI" : method,
          customer_name: manualCustomerName.trim() || activeSession?.customerName || "Dine-in Guest",
          customer_phone: manualCustomerPhone.trim() || activeSession?.customerPhone || null,
          items_json: unsavedPayload,
          note: settleNote,
        });
      }

      // Clear from printed list
      setPrintedTables((prev) => {
        const copy = new Set(prev);
        copy.delete(activeTableModal);
        return copy;
      });

      const methodLabel = splitDetails 
        ? `Split (UPI ₹${splitDetails.upi} + Cash ₹${splitDetails.cash})` 
        : method;

      showToast(`Table ${activeTableModal} settled ₹${grandTotal} via ${methodLabel}`);

      const combinedItems = [
        ...(activeSession?.allItems || []),
        ...manualCart.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          price: c.price,
        })),
      ];

      setPrintChit({
        type: "BILL",
        mode: "DINE_IN",
        tableOrToken: activeTableModal,
        customerName: manualCustomerName.trim() || activeSession?.customerName,
        customerPhone: manualCustomerPhone.trim() || activeSession?.customerPhone,
        paymentMethod: method,
        items: combinedItems,
        subtotal,
        discount: effectiveDiscount,
        tax: taxTotal,
        grandTotal,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      setActiveTableModal(null);
      setIsPaymentDrawerOpen(false);
      setManualCart([]);
      setBatchNote("");
      setDiscountPercent(0);
      setCustomDiscountRupees("");

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
    <div className="flex h-screen flex-col bg-[#FCFAF8] font-sans text-zinc-900 select-none overflow-hidden">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-6 z-[300] bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2 border border-zinc-800 animate-in fade-in slide-in-from-top-2">
          <Check size={14} className="text-[#E46254]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── TOP BAR: Floor Tables Header ── */}
      <div className="shrink-0 bg-white border-b border-zinc-200/80 px-6 py-3.5 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-zinc-900 tracking-tight">Floor Tables</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E46254]/10 text-[#C2410C] text-[11px] font-semibold border border-[#E46254]/20">
              Live Floor
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-200 mx-1" />

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#FAF8F7] p-0.5 rounded-xl border border-zinc-200/80">
            <button
              onClick={() => setTerminalMode("DINE_IN")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
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

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative w-64 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tables, guests, phone... (Press '/')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF8F7] border border-zinc-200/80 rounded-xl pl-9 pr-8 py-1.5 text-[12.5px] placeholder:text-zinc-400 outline-none focus:border-[#E46254] focus:bg-white transition-all font-medium"
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
            className="p-2 border border-zinc-200/80 bg-white hover:bg-zinc-50 rounded-xl text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors shadow-2xs"
            title="Refresh floor"
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
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              tableFilter === "ALL"
                ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                : "bg-white text-zinc-600 border-zinc-200/80 hover:bg-[#E46254]/5 hover:border-[#E46254]/30"
            }`}
          >
            All Tables ({locations.length})
          </button>

          <button
            onClick={() => setTableFilter("OCCUPIED")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
              tableFilter === "OCCUPIED"
                ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                : "bg-white text-[#C2410C] border-zinc-200/80 hover:bg-[#E46254]/5 hover:border-[#E46254]/30"
            }`}
          >
            <span>Active / Seated ({occupiedCount})</span>
          </button>

          <button
            onClick={() => setTableFilter("VACANT")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
              tableFilter === "VACANT"
                ? "bg-zinc-800 text-white border-zinc-800 shadow-2xs"
                : "bg-white text-zinc-700 border-zinc-200/80 hover:bg-zinc-50"
            }`}
          >
            <span>Vacant Tables ({vacantCount})</span>
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

      {/* ── FLOOR TABLES GRID ── */}
      <div className="flex-1 overflow-y-auto p-6 slim-scrollbar bg-[#FCFAF8]">
        {locations.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-zinc-200/80 max-w-md mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-[#E46254]/10 text-[#E46254] flex items-center justify-center mb-3">
              <UtensilsCrossed size={22} />
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
          <div className="h-[50vh] flex flex-col items-center justify-center text-center p-8 text-zinc-400">
            <UtensilsCrossed size={24} className="mb-2 text-zinc-300" />
            <h3 className="text-sm font-semibold text-zinc-700">No tables matching this filter</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Try switching between All, Active, or Vacant</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filteredTables.map((loc) => {
              const session = tableSessionMap.get(loc.name);
              const isOccupied = session && session.status !== "VACANT";

              const elapsedMinutes = session?.firstOrderAt
                ? Math.max(0, Math.floor((Date.now() - new Date(session.firstOrderAt).getTime()) / 60000))
                : 0;

              const isBillPrinted = printedTables.has(loc.name);
              const hasBillRequest = session?.hasBillRequest || false;
              const hasUpiVerifyRequest = session?.hasUpiVerifyRequest || false;

              return (
                <div
                  key={loc.id}
                  onClick={() => setActiveTableModal(loc.name)}
                  className={`relative rounded-2xl p-5 border transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-md select-none group bg-white ${
                    hasBillRequest || hasUpiVerifyRequest
                      ? "border-[#E46254] ring-2 ring-[#E46254]/20"
                      : isBillPrinted
                      ? "border-purple-300 bg-[#FAF7FB]"
                      : isOccupied
                      ? "border-[#E46254]/30 hover:border-[#E46254]"
                      : "border-zinc-200/80 hover:border-[#E46254]/40"
                  }`}
                >
                  <div>
                    {/* Header: Table Name & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h2 className="text-base font-bold text-zinc-900 tracking-tight group-hover:text-[#E46254] transition-colors">
                          {loc.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                          <Users size={12} className="shrink-0" />
                          <span>{loc.capacity || 4} Seats</span>
                        </div>
                      </div>

                      {/* Status Indicator (Clean, No Harsh Pulsing Dots) */}
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {hasBillRequest ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#E46254] text-white text-[10.5px] font-bold shadow-2xs">
                            Bill Call
                          </span>
                        ) : hasUpiVerifyRequest ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-white text-[10.5px] font-bold shadow-2xs">
                            Verify UPI
                          </span>
                        ) : isBillPrinted ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10.5px] font-bold border border-purple-200">
                            Billed
                          </span>
                        ) : isOccupied ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#E46254]/10 text-[#C2410C] text-[10.5px] font-bold border border-[#E46254]/20">
                            Running
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10.5px] font-medium border border-zinc-200/60">
                            Vacant
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Active Session Details or Vacant State */}
                    {isOccupied ? (
                      <div className="space-y-2 mt-3 pt-3 border-t border-zinc-100">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 truncate text-zinc-700 font-medium">
                            <User size={12} className="text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {session?.customerName || "Dine-in Guest"}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1 shrink-0">
                            <Clock size={11} />
                            {elapsedMinutes}m
                          </span>
                        </div>

                        {session?.customerPhone && (
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
                            <Phone size={10} className="text-zinc-400" />
                            <span>{session.customerPhone}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5 font-medium">
                          <span>{session?.rounds.length} {session?.rounds.length === 1 ? "round" : "rounds"} fired</span>
                          <span className="font-mono font-semibold text-zinc-700">₹{session?.totalBill || 0}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-5 flex flex-col items-center justify-center text-center">
                        <div className="w-8 h-8 rounded-full bg-[#FAF8F7] border border-zinc-200/60 flex items-center justify-center text-zinc-400 mb-1.5">
                          <UtensilsCrossed size={14} />
                        </div>
                        <span className="text-[11.5px] text-zinc-400 font-medium">Ready for guests</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action */}
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
                        <span className="px-3 py-1.5 rounded-xl bg-[#E46254] hover:bg-[#d55345] text-white text-xs font-semibold transition-all shadow-2xs">
                          Command Deck
                        </span>
                      </>
                    ) : (
                      <span className="w-full text-center py-2 rounded-xl bg-white hover:bg-[#E46254]/5 border border-zinc-200/80 hover:border-[#E46254]/30 text-zinc-700 hover:text-[#E46254] text-xs font-semibold transition-colors">
                        + Open & Order
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PURE FULL-SCREEN TABLE COMMAND STATION ── */}
      {activeTableModal && (
        <div className="fixed inset-0 z-50 bg-[#FCFAF8] flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-150">
          
          {/* 1. Command Station Header Deck */}
          <div className="shrink-0 bg-white border-b border-zinc-200/80 px-6 py-3.5 flex items-center justify-between gap-4 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveTableModal(null);
                  setIsPaymentDrawerOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
              >
                <ChevronLeft size={15} />
                <span>Floor</span>
                <kbd className="ml-1 text-[10px] text-zinc-400 font-mono bg-zinc-100 px-1.5 py-0.5 rounded">Esc</kbd>
              </button>

              <div className="h-5 w-px bg-zinc-200 mx-1" />

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E46254]/10 text-[#E46254] flex items-center justify-center font-bold text-sm">
                  {activeTableModal.replace(/[^0-9]/g, "") || "T"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight leading-none">
                      {activeTableModal}
                    </h2>
                    {!isVacantTable ? (
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
            </div>

            {/* Center: Guest info, Seated time, and Table PIN */}
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-zinc-600">
              {!isVacantTable && activeSession?.firstOrderAt && (
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Clock size={13} className="text-[#E46254]" />
                  <span>Seated {Math.max(0, Math.floor((Date.now() - new Date(activeSession.firstOrderAt).getTime()) / 60000))}m ago</span>
                </div>
              )}

              {/* Table PIN Badge */}
              <div className="flex items-center gap-1.5 bg-[#E46254]/5 border border-[#E46254]/20 px-3 py-1 rounded-xl">
                <span className="text-[11px] text-[#C2410C] font-semibold">PIN:</span>
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

              {/* Guest Name & Phone Quick Edit */}
              <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
                <div className="flex items-center gap-1">
                  <User size={12} className="text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Guest Name..."
                    value={manualCustomerName}
                    onChange={(e) => setManualCustomerName(e.target.value)}
                    className="bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#E46254] outline-none text-xs font-semibold text-zinc-800 w-28 placeholder:text-zinc-400 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Phone size={12} className="text-zinc-400" />
                  <input
                    type="tel"
                    placeholder="Phone..."
                    value={manualCustomerPhone}
                    onChange={(e) => setManualCustomerPhone(e.target.value)}
                    className="bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#E46254] outline-none text-xs font-mono text-zinc-700 w-24 placeholder:text-zinc-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Right: Quick Switcher & Table Transfer & Close */}
            <div className="flex items-center gap-2">
              <select
                value={activeTableModal}
                onChange={(e) => setActiveTableModal(e.target.value)}
                className="bg-white border border-zinc-200/80 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-zinc-800 outline-none hover:border-[#E46254]/40 cursor-pointer shadow-2xs"
              >
                {locations.map((loc) => {
                  const s = tableSessionMap.get(loc.name);
                  const isOcc = s && s.status !== "VACANT";
                  return (
                    <option key={loc.id} value={loc.name}>
                      {loc.name} {isOcc ? "• Running" : "• Vacant"}
                    </option>
                  );
                })}
              </select>

              {!isVacantTable && (
                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  title="Transfer orders to another table"
                >
                  <ArrowRightLeft size={13} className="text-[#E46254]" />
                  <span className="hidden sm:inline">Transfer</span>
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTableModal(null);
                  setIsPaymentDrawerOpen(false);
                }}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer transition-colors"
                title="Close Command Deck (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 2. Command Station Body: Two Spacious Panels */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* ── LEFT PANEL (42%): Table Orders & Bill Breakdown ── */}
            <div className="w-full lg:w-[42%] flex flex-col border-r border-zinc-200/80 bg-white overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 slim-scrollbar">
                
                {/* Header status bar */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Table Orders & Rounds</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {!isVacantTable
                        ? `${activeSession?.rounds.length} ${activeSession?.rounds.length === 1 ? 'round' : 'rounds'} fired so far`
                        : "No active orders yet"}
                    </p>
                  </div>
                  {!isVacantTable && (
                    <span className="font-mono font-bold text-sm text-zinc-900">
                      Running: ₹{activeSession?.totalBill}
                    </span>
                  )}
                </div>

                {/* Stream of Rounds */}
                {!isVacantTable && activeSession && activeSession.rounds.length > 0 ? (
                  <div className="space-y-3">
                    {activeSession.rounds.map((round) => (
                      <div
                        key={round.orderId}
                        className="bg-white rounded-2xl border border-zinc-200/80 p-4 space-y-3 shadow-2xs hover:border-[#E46254]/25 transition-all"
                      >
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 font-mono text-xs">
                              Round #{round.roundNumber}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E46254]/5 text-[#C2410C] border border-[#E46254]/15">
                              {round.source === "QR" ? "Customer QR" : round.source === "CAPTAIN" ? "Captain App" : "POS Counter"}
                            </span>
                            <span className="text-[10.5px] text-zinc-400">
                              {new Date(round.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleReprintKOT(round)}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-zinc-600 bg-white hover:bg-zinc-50 border border-zinc-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Reprint KOT"
                            >
                              <Printer size={11} />
                              <span>KOT</span>
                            </button>
                            <button
                              onClick={() => handleCancelOrder(round.orderId)}
                              className="p-1 text-zinc-300 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Cancel round"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="divide-y divide-zinc-50">
                          {round.items.map((it, idx) => (
                            <div key={idx} className="py-2 flex items-center justify-between text-xs">
                              <div className="flex items-start gap-2.5">
                                <span className="font-bold font-mono text-zinc-400 w-5 shrink-0 mt-0.5">{it.quantity}×</span>
                                <div>
                                  <span className="font-medium text-zinc-900 leading-snug block">{it.name}</span>
                                  {it.notes && (
                                    <span className="text-[11px] text-[#C2410C]/80 mt-0.5 block font-medium">
                                      {it.notes}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-bold font-mono tabular-nums text-zinc-800 ml-3 shrink-0">
                                ₹{it.price * it.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 bg-[#FAF8F7] rounded-2xl border border-dashed border-zinc-200 text-center space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-[#E46254]/10 text-[#E46254] flex items-center justify-center mx-auto mb-1">
                      <UtensilsCrossed size={18} />
                    </div>
                    <p className="text-xs font-bold text-zinc-800">Table is currently vacant</p>
                    <p className="text-[11.5px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                      Select dishes from the menu catalog on the right to start this table and fire Round #1 to the kitchen.
                    </p>
                  </div>
                )}

                {/* Financial Summary & Discounts */}
                {subtotal > 0 && (
                  <div className="bg-white rounded-2xl p-4.5 border border-zinc-200/80 space-y-3 text-xs shadow-2xs">
                    <div className="flex justify-between text-zinc-500">
                      <span>Subtotal</span>
                      <span className="font-semibold text-zinc-800 font-mono">₹{subtotal}</span>
                    </div>

                    {/* Discount Selector */}
                    <div className="space-y-1.5 pt-1.5 border-t border-zinc-100">
                      <div className="flex items-center justify-between text-zinc-600">
                        <span className="flex items-center gap-1 font-medium">
                          <Tag size={12} className="text-[#E46254]" />
                          <span>Discount</span>
                        </span>
                        {effectiveDiscount > 0 && (
                          <span className="font-bold text-emerald-600 font-mono">
                            -₹{effectiveDiscount.toFixed(1)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {[0, 5, 10, 15, 20].map((pct) => (
                          <button
                            key={pct}
                            onClick={() => {
                              setDiscountPercent(pct);
                              setCustomDiscountRupees("");
                            }}
                            className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                              discountPercent === pct && !customDiscountRupees
                                ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                                : "bg-white text-zinc-600 border-zinc-200 hover:bg-[#E46254]/5"
                            }`}
                          >
                            {pct === 0 ? "None" : `${pct}%`}
                          </button>
                        ))}

                        <input
                          type="number"
                          placeholder="₹ Off"
                          value={customDiscountRupees}
                          onChange={(e) => {
                            setCustomDiscountRupees(e.target.value);
                            setDiscountPercent(0);
                          }}
                          className="w-16 px-1.5 py-1 bg-white border border-zinc-200 rounded-lg text-[11px] font-mono outline-none text-center focus:border-[#E46254]"
                        />
                      </div>
                    </div>

                    {/* Taxes (5% GST) */}
                    <div className="flex justify-between text-zinc-500 pt-1.5 border-t border-zinc-100">
                      <span>Taxes (5% GST)</span>
                      <span className="font-semibold text-zinc-800 font-mono">₹{taxTotal.toFixed(1)}</span>
                    </div>

                    {/* Grand Total */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 block">Total Due</span>
                        <span className="text-[10.5px] text-zinc-400">Includes all taxes & discounts</span>
                      </div>
                      <span className="text-xl font-black text-zinc-900 font-mono tabular-nums">
                        ₹{grandTotal}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Left Panel Action Dock (Print & Settle or Payment Drawer) */}
              <div className="p-4 bg-[#FAF8F7] border-t border-zinc-200/80 space-y-2.5 shrink-0">
                {isVacantTable ? (
                  /* VACANT TABLE: START TABLE AND FIRE */
                  <button
                    disabled={manualCart.length === 0 || isSubmitting}
                    onClick={handleSendManualKOT}
                    className="w-full py-3 px-4 rounded-xl bg-[#E46254] hover:bg-[#D35546] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-all"
                  >
                    <Send size={14} />
                    <span>
                      {manualCart.length === 0
                        ? "Select dishes from menu on right to start"
                        : `Fire KOT to Kitchen & Seat Table (₹${manualCart.reduce((s, it) => s + it.price * it.quantity, 0)})`}
                    </span>
                  </button>
                ) : !isPaymentDrawerOpen ? (
                  /* OCCUPIED TABLE: PRINT BILL OR SETTLE (PLUS EXTRA ROUND IF STAGED) */
                  <div className="space-y-2">
                    {manualCart.length > 0 && (
                      <button
                        disabled={isSubmitting}
                        onClick={handleSendManualKOT}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#E46254] hover:bg-[#d55345] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                      >
                        <Send size={13} />
                        <span>Fire New KOT Round (Round #{(activeSession?.rounds.length || 0) + 1})</span>
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handlePrintGuestBill}
                        className="py-2.5 px-3 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Printer size={14} />
                        <span>Print Bill</span>
                      </button>

                      <button
                        onClick={() => setIsPaymentDrawerOpen(true)}
                        className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <CreditCard size={14} />
                        <span>Settle (₹{grandTotal})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* SETTLE VIEW: CASH / UPI / CARD / SPLIT */
                  <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 space-y-3 shadow-2xs animate-in fade-in duration-100">
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100">
                      <span className="text-xs font-bold text-zinc-900">
                        Settle ₹{grandTotal} • Select Payment Mode:
                      </span>
                      <button
                        onClick={() => {
                          setIsPaymentDrawerOpen(false);
                          setIsSplitMode(false);
                        }}
                        className="text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {!isSplitMode ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            disabled={isSubmitting}
                            onClick={() => handleSettleTable("CASH")}
                            className="py-2.5 px-2 bg-white hover:bg-[#E46254]/5 border border-zinc-200/80 hover:border-[#E46254]/30 text-zinc-900 rounded-xl font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Banknote size={16} className="text-[#E46254]" />
                            <span>Cash</span>
                          </button>

                          <button
                            disabled={isSubmitting}
                            onClick={() => handleSettleTable("UPI")}
                            className="py-2.5 px-2 bg-[#E46254]/10 hover:bg-[#E46254]/15 border border-[#E46254]/25 text-[#C2410C] rounded-xl font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors"
                          >
                            <QrCode size={16} className="text-[#E46254]" />
                            <span>UPI QR</span>
                          </button>

                          <button
                            disabled={isSubmitting}
                            onClick={() => handleSettleTable("CARD")}
                            className="py-2.5 px-2 bg-white hover:bg-[#E46254]/5 border border-zinc-200/80 hover:border-[#E46254]/30 text-zinc-900 rounded-xl font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors"
                          >
                            <CreditCard size={16} className="text-[#E46254]" />
                            <span>Card</span>
                          </button>
                        </div>

                        {/* Cash Tendered & Split Mode */}
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Cash given..."
                              value={cashTendered}
                              onChange={(e) => setCashTendered(e.target.value)}
                              className="w-24 px-2 py-1 bg-white border border-zinc-200 rounded-lg text-xs font-mono outline-none focus:border-[#E46254]"
                            />
                            {parseFloat(cashTendered) > grandTotal && (
                              <span className="text-xs font-bold text-emerald-600 font-mono">
                                Change: ₹{changeDue}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setIsSplitMode(true);
                              setSplitUpiAmount(Math.floor(grandTotal / 2).toString());
                              setSplitCashAmount(Math.ceil(grandTotal / 2).toString());
                            }}
                            className="text-[11px] font-semibold text-[#E46254] hover:underline cursor-pointer"
                          >
                            Split Tender?
                          </button>
                        </div>
                      </>
                    ) : (
                      /* SPLIT TENDER SUB-PANEL */
                      <div className="space-y-2.5 pt-1">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10.5px] font-medium text-zinc-500 block mb-1">
                              UPI Portion (₹)
                            </label>
                            <input
                              type="number"
                              value={splitUpiAmount}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSplitUpiAmount(val);
                                const numVal = parseFloat(val) || 0;
                                setSplitCashAmount(Math.max(0, grandTotal - numVal).toString());
                              }}
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg font-mono font-bold text-zinc-900 outline-none focus:border-[#E46254]"
                              placeholder="0"
                            />
                          </div>

                          <div>
                            <label className="text-[10.5px] font-medium text-zinc-500 block mb-1">
                              Cash Portion (₹)
                            </label>
                            <input
                              type="number"
                              value={splitCashAmount}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSplitCashAmount(val);
                                const numVal = parseFloat(val) || 0;
                                setSplitUpiAmount(Math.max(0, grandTotal - numVal).toString());
                              }}
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg font-mono font-bold text-zinc-900 outline-none focus:border-[#E46254]"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100">
                          <button
                            type="button"
                            onClick={() => setIsSplitMode(false)}
                            className="text-zinc-500 hover:text-zinc-800 text-[11px] font-medium cursor-pointer"
                          >
                            Cancel Split
                          </button>

                          <button
                            disabled={isSubmitting || (parseFloat(splitUpiAmount || "0") + parseFloat(splitCashAmount || "0")) !== grandTotal}
                            onClick={() =>
                              handleSettleTable("UPI", {
                                upi: parseFloat(splitUpiAmount || "0"),
                                cash: parseFloat(splitCashAmount || "0"),
                              })
                            }
                            className="py-1.5 px-3 bg-zinc-900 hover:bg-black disabled:opacity-40 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs"
                          >
                            Confirm Split Settle
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT PANEL (58%): High-Speed Menu & Staged Round Dock ── */}
            <div className="w-full lg:w-[58%] flex flex-col bg-[#FAF8F7] overflow-hidden">
              
              {/* Search, Veg Filter, and Categories */}
              <div className="p-4 bg-white border-b border-zinc-200/80 space-y-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search menu dishes, code, category... (press '/' to focus)"
                      value={dishSearchQuery}
                      onChange={(e) => setDishSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-[#FAF8F7] border border-zinc-200/80 rounded-xl text-xs font-medium outline-none focus:border-[#E46254] focus:bg-white transition-all"
                    />
                    {dishSearchQuery && (
                      <button
                        onClick={() => setDishSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Veg / Non-Veg Toggle */}
                  <div className="flex items-center bg-[#FAF8F7] p-0.5 rounded-xl border border-zinc-200/80 shrink-0">
                    <button
                      onClick={() => setCatalogVegFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        catalogVegFilter === "ALL"
                          ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCatalogVegFilter("VEG")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        catalogVegFilter === "VEG"
                          ? "bg-white text-emerald-800 border border-emerald-200 shadow-2xs font-semibold"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Veg</span>
                    </button>
                    <button
                      onClick={() => setCatalogVegFilter("NON_VEG")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        catalogVegFilter === "NON_VEG"
                          ? "bg-white text-[#C2410C] border border-[#E46254]/30 shadow-2xs font-semibold"
                          : "text-zinc-500 hover:text-zinc-800"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E46254]" />
                      <span>Non-Veg</span>
                    </button>
                  </div>
                </div>

                {/* Categories Horizontal Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto slim-scrollbar py-0.5">
                  {drawerCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedDrawerCat(cat)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                        selectedDrawerCat.toLowerCase() === cat.toLowerCase()
                          ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs"
                          : "bg-white text-zinc-600 border-zinc-200/80 hover:bg-[#E46254]/5 hover:border-[#E46254]/20"
                      }`}
                    >
                      {cat === "ALL" ? "All Dishes" : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dish Catalog Grid */}
              <div className="flex-1 overflow-y-auto p-4 slim-scrollbar">
                {filteredCatalog.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400">
                    <UtensilsCrossed size={24} className="mb-2 text-zinc-300" />
                    <p className="text-xs font-semibold text-zinc-600">No dishes found</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Try searching or picking a different category</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredCatalog.map((dish) => {
                      const qtyInCart = manualCart
                        .filter((c) => c.dishId === dish.id || c.id === dish.id)
                        .reduce((s, c) => s + c.quantity, 0);

                      const hasVariants = Boolean(
                        dish.variantsConfig?.hasPortions ||
                        dish.variantsConfig?.hasAddons ||
                        (dish.variantsConfig?.prepTags && dish.variantsConfig.prepTags.length > 0)
                      );

                      return (
                        <div
                          key={dish.id}
                          onClick={() => handleDishClick(dish)}
                          className="bg-white rounded-2xl border border-zinc-200/80 p-3.5 hover:border-[#E46254]/30 hover:shadow-xs transition-all flex flex-col justify-between cursor-pointer group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    dish.is_veg ? "bg-emerald-500" : "bg-[#E46254]"
                                  }`}
                                />
                                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                                  {dish.category}
                                </span>
                              </div>
                              {hasVariants && (
                                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-[#E46254]/5 text-[#C2410C] border border-[#E46254]/15">
                                  Variants
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#E46254] transition-colors line-clamp-1">
                              {dish.name}
                            </h4>
                            {dish.description && (
                              <p className="text-[10.5px] text-zinc-400 line-clamp-1 mt-0.5">
                                {dish.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                            <span className="font-mono font-bold text-xs text-zinc-900">
                              ₹{dish.base_price}
                            </span>

                            {hasVariants ? (
                              <button
                                onClick={() => handleDishClick(dish)}
                                className="px-2.5 py-1 bg-white hover:bg-[#E46254] text-zinc-800 hover:text-white border border-zinc-200 hover:border-[#E46254] rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              >
                                <span>Customize</span>
                                {qtyInCart > 0 && (
                                  <span className="w-4 h-4 rounded-full bg-[#E46254] group-hover:bg-white group-hover:text-[#E46254] text-white text-[9.5px] flex items-center justify-center font-mono font-bold">
                                    {qtyInCart}
                                  </span>
                                )}
                              </button>
                            ) : qtyInCart > 0 ? (
                              <div className="flex items-center bg-white rounded-lg border border-zinc-200">
                                <button
                                  onClick={() => updateManualQty(dish.id, -1)}
                                  className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-black cursor-pointer"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className="w-5 text-center font-mono font-bold text-xs">
                                  {qtyInCart}
                                </span>
                                <button
                                  onClick={() => addToManualCartDirect(dish)}
                                  className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-black cursor-pointer"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToManualCartDirect(dish)}
                                className="px-2.5 py-1 bg-[#E46254]/10 hover:bg-[#E46254] text-[#C2410C] hover:text-white rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Staged Batch Dock (Active when manualCart.length > 0) */}
              {manualCart.length > 0 && (
                <div className="bg-white border-t border-zinc-200/80 p-4 space-y-3 shrink-0 shadow-lg animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-zinc-900">
                      <ChefHat size={15} className="text-[#E46254]" />
                      <span>
                        Staged Round Batch ({manualCart.reduce((s, it) => s + it.quantity, 0)} items)
                      </span>
                      <span className="font-mono font-bold text-[#E46254]">
                        • ₹{manualCart.reduce((s, it) => s + it.price * it.quantity, 0)}
                      </span>
                    </div>
                    <button
                      onClick={() => setManualCart([])}
                      className="text-[11px] text-zinc-400 hover:text-rose-600 font-medium cursor-pointer"
                    >
                      Clear Batch
                    </button>
                  </div>

                  {/* Staged Items List */}
                  <div className="max-h-36 overflow-y-auto slim-scrollbar divide-y divide-zinc-100 border border-zinc-100 rounded-xl">
                    {manualCart.map((it) => (
                      <div key={it.id} className="p-2 flex items-center justify-between text-xs bg-white">
                        <div className="flex-1 pr-2">
                          <span className="font-bold text-zinc-900 leading-tight block">{it.name}</span>
                          {it.notes && (
                            <span className="text-[10.5px] text-[#C2410C] font-medium leading-tight block">
                              {it.notes}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-white rounded-lg border border-zinc-200">
                            <button
                              onClick={() => updateManualQty(it.id, -1)}
                              className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-black cursor-pointer"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="w-5 text-center font-mono font-bold text-xs">
                              {it.quantity}
                            </span>
                            <button
                              onClick={() => updateManualQty(it.id, 1)}
                              className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-black cursor-pointer"
                            >
                              <Plus size={10} />
                            </button>
                          </div>

                          <span className="w-14 text-right font-mono font-bold text-zinc-900 tabular-nums">
                            ₹{it.price * it.quantity}
                          </span>

                          <button
                            onClick={() => setManualCart((prev) => prev.filter((i) => i.id !== it.id))}
                            className="text-zinc-300 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cooking Instructions & Fire Button */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Chef instructions for this round (e.g. Serve with Round 1, less spicy)..."
                      value={batchNote}
                      onChange={(e) => setBatchNote(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#FAF8F7] border border-zinc-200/80 rounded-xl text-xs font-medium outline-none focus:border-[#E46254] focus:bg-white transition-all"
                    />

                    <button
                      disabled={isSubmitting}
                      onClick={handleSendManualKOT}
                      className="py-2.5 px-5 bg-[#E46254] hover:bg-[#d55345] disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all shrink-0"
                    >
                      <Send size={13} />
                      <span>
                        Fire Round #{(activeSession?.rounds.length || 0) + 1} (₹{manualCart.reduce((s, it) => s + it.price * it.quantity, 0)})
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSFER TABLE MODAL ── */}
      {isTransferModalOpen && activeTableModal && (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-zinc-200/80 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-[#E46254]" />
                <h3 className="font-bold text-sm text-zinc-900">Transfer {activeTableModal}</h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              Move all active orders and running bill to another dining table on the floor.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-700 block">Select Target Table</label>
              <select
                value={transferTargetTable}
                onChange={(e) => setTransferTargetTable(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#E46254]"
              >
                <option value="">-- Choose destination table --</option>
                {locations
                  .filter((loc) => loc.name !== activeTableModal)
                  .map((loc) => {
                    const s = tableSessionMap.get(loc.name);
                    const isOcc = s && s.status !== "VACANT";
                    return (
                      <option key={loc.id} value={loc.name}>
                        {loc.name} {isOcc ? "(Currently Occupied)" : "(Vacant)"}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!transferTargetTable || isSubmitting}
                onClick={() => handleTransferTable(transferTargetTable)}
                className="px-4 py-1.5 bg-[#E46254] hover:bg-[#d55345] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
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
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    customizingDish.is_veg ? "bg-emerald-500" : "bg-[#E46254]"
                  }`}
                />
                <div className="truncate">
                  <h3 className="font-bold text-zinc-900 text-sm truncate">
                    {customizingDish.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span>{customizingDish.category}</span>
                    <span>•</span>
                    <span className="font-mono font-semibold text-zinc-700">
                      Base: ₹{customizingDish.base_price}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCustomizingDish(null)}
                className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto slim-scrollbar text-xs">
              {/* Portions / Sizes */}
              {customizingDish.variantsConfig?.hasPortions &&
                customizingDish.variantsConfig.portions &&
                customizingDish.variantsConfig.portions.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                      Portion Size <span className="text-[#E46254]">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {customizingDish.variantsConfig.portions.map((portion) => {
                        const isSel = selectedPortion?.name === portion.name;
                        const isFull = portion.name.toLowerCase() === "full";
                        return (
                          <button
                            key={portion.name}
                            type="button"
                            onClick={() => setSelectedPortion(portion)}
                            className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                              isSel
                                ? "bg-[#E46254] border-[#E46254] text-white shadow-2xs"
                                : "bg-white border-zinc-200/80 text-zinc-700 hover:border-[#E46254]/30"
                            }`}
                          >
                            <div>
                              <p className="font-bold text-xs">{portion.name}</p>
                              {isFull && (
                                <p className={`text-[9.5px] ${isSel ? "text-white/80" : "text-zinc-400"}`}>
                                  Base Price
                                </p>
                              )}
                            </div>
                            <span
                              className={`font-mono font-bold text-xs ${
                                isSel ? "text-white" : "text-zinc-900"
                              }`}
                            >
                              ₹{portion.price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Add-ons & Extras */}
              {customizingDish.variantsConfig?.hasAddons &&
                customizingDish.variantsConfig.addons &&
                customizingDish.variantsConfig.addons.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                      Add-ons & Extras
                    </label>
                    <div className="space-y-1.5">
                      {customizingDish.variantsConfig.addons.map((addon) => {
                        const isSel = selectedAddons.some(
                          (a) => a.name === addon.name || a.id === addon.id
                        );
                        return (
                          <button
                            key={addon.id || addon.name}
                            type="button"
                            onClick={() => {
                              if (isSel) {
                                setSelectedAddons((prev) =>
                                  prev.filter((a) => a.name !== addon.name)
                                );
                              } else {
                                setSelectedAddons((prev) => [...prev, addon]);
                              }
                            }}
                            className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                              isSel
                                ? "bg-[#E46254]/5 border-[#E46254]/30 text-zinc-900 font-medium"
                                : "bg-white border-zinc-200/80 text-zinc-700 hover:border-[#E46254]/20"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                                  isSel ? "bg-[#E46254] text-white" : "border border-zinc-300"
                                }`}
                              >
                                {isSel && <Check size={10} strokeWidth={3} />}
                              </div>
                              <span className="text-xs">{addon.name}</span>
                            </div>
                            <span className="font-mono text-xs text-zinc-600 font-semibold">
                              +₹{addon.price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Quick Kitchen Prep Tags */}
              <div>
                <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <ChefHat size={13} className="text-[#E46254]" />
                  <span>Kitchen Instructions (1-Tap)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(customizingDish.variantsConfig?.prepTags?.length
                    ? customizingDish.variantsConfig.prepTags
                    : COMMON_PREP_TAGS
                  ).map((tag) => {
                    const isSel = selectedPrepTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (isSel) {
                            setSelectedPrepTags((prev) => prev.filter((t) => t !== tag));
                          } else {
                            setSelectedPrepTags((prev) => [...prev, tag]);
                          }
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                          isSel
                            ? "bg-[#E46254] text-white border-[#E46254] shadow-2xs font-semibold"
                            : "bg-white hover:border-[#E46254]/30 border-zinc-200/80 text-zinc-700"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Special Note */}
              <div>
                <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block mb-1">
                  Custom Special Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Serve hot, no salt on fries, extra napkins..."
                  value={customDishNote}
                  onChange={(e) => setCustomDishNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-200/80 rounded-xl focus:outline-none focus:border-[#E46254] bg-[#FAF8F7]"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-100 bg-[#FAF8F7] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase font-bold tracking-wider">
                  Item Total
                </span>
                <span className="text-base font-bold font-mono text-zinc-900">
                  ₹
                  {(selectedPortion ? selectedPortion.price : customizingDish.base_price) +
                    selectedAddons.reduce((s, a) => s + (a.price || 0), 0)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomizingDish(null)}
                  className="px-3 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCustomDish}
                  className="px-4 py-2 bg-[#E46254] hover:bg-[#d55345] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} strokeWidth={3} />
                  <span>Add to Table</span>
                </button>
              </div>
            </div>
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
                {printChit.customerPhone && <div>PHONE: {printChit.customerPhone}</div>}
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
                {printChit.customerPhone && <div>Phone: {printChit.customerPhone}</div>}
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
