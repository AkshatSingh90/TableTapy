"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Minus,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  X,
  Check,
  Bookmark,
  Tag
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

/* ─── Interfaces ─────────────────────────────────────────── */
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

type OrderType = "Dine In" | "Takeaway" | "Delivery";
type PaymentMethod = "CASH" | "UPI" | "CARD";

export default function PosTerminalPage() {
  const supabase = createClient();

  // Core Data State
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("My Restaurant");
  const [upiId, setUpiId] = useState<string>("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Category & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Cart / Ticket State
  const [orderType, setOrderType] = useState<OrderType>("Takeaway");
  const [selectedTable, setSelectedTable] = useState<string>("Table 1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Discount State
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Settlement & Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ─── 1. Fetch Real Restaurant, Categories, Dishes & Tables ─────────── */
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const restId = user?.user_metadata?.restaurant_id;

      if (restId) {
        const { data: r } = await supabase
          .from("restaurants")
          .select("id, name, upi_id")
          .eq("id", restId)
          .maybeSingle();
        if (r) {
          if (r.name) setRestaurantName(r.name);
          if (r.upi_id) setUpiId(r.upi_id);
        }
      }

      setRestaurantId(restId || null);

      if (restId) {
        const { data: menuData } = await supabase
          .from("menu_items_v2")
          .select("*")
          .order("category", { ascending: true })
          .order("name", { ascending: true });

        if (menuData && menuData.length > 0) {
          setMenuItems(
            menuData.map((row: any) => ({
              id: row.id,
              name: row.name,
              category: row.category || "General",
              subcategory: row.subcategory || "",
              base_price: Number(row.base_price || 0),
              description: row.description || "",
              is_veg: row.is_veg !== false,
              is_available: row.is_available !== false,
            }))
          );
        } else {
          setMenuItems([
            { id: "1", name: "Butter Chicken", category: "Main Course", base_price: 360, is_veg: false, is_available: true },
            { id: "2", name: "Paneer Butter Masala", category: "Main Course", base_price: 290, is_veg: true, is_available: true },
            { id: "3", name: "Dal Makhani", category: "Main Course", base_price: 240, is_veg: true, is_available: true },
            { id: "4", name: "Garlic Naan", category: "Breads", base_price: 65, is_veg: true, is_available: true },
            { id: "5", name: "Butter Roti", category: "Breads", base_price: 35, is_veg: true, is_available: true },
            { id: "6", name: "Jeera Rice", category: "Rice & Biryani", base_price: 180, is_veg: true, is_available: true },
            { id: "7", name: "Chicken Dum Biryani", category: "Rice & Biryani", base_price: 320, is_veg: false, is_available: true },
            { id: "8", name: "Paneer Tikka", category: "Starters", base_price: 260, is_veg: true, is_available: true },
            { id: "9", name: "Chicken 65", category: "Starters", base_price: 290, is_veg: false, is_available: true },
            { id: "10", name: "Cold Coffee", category: "Beverages", base_price: 120, is_veg: true, is_available: true },
            { id: "11", name: "Fresh Lime Soda", category: "Beverages", base_price: 80, is_veg: true, is_available: true },
            { id: "12", name: "Gulab Jamun (2 pcs)", category: "Desserts", base_price: 90, is_veg: true, is_available: true },
          ]);
        }

        const { data: locData } = await supabase
          .from("locations")
          .select("*")
          .eq("restaurant_id", restId)
          .order("name", { ascending: true });

        if (locData && locData.length > 0) {
          setLocations(locData.map((l: any) => ({ id: l.id, name: l.name, type: l.type })));
          setSelectedTable(locData[0].name);
        } else {
          setLocations([
            { id: "t1", name: "Table 1" },
            { id: "t2", name: "Table 2" },
            { id: "t3", name: "Table 3" },
            { id: "t4", name: "Table 4" },
            { id: "t5", name: "Table 5" },
            { id: "t6", name: "Table 6" },
          ]);
        }
      }
    } catch (err) {
      console.error("Error loading POS data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Realtime listener: Live 86 stock toggles reflect instantly in POS
    const channel = supabase
      .channel('pos_menu_availability_sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'menu_items_v2' },
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
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ─── 2. Categories with Item Counts ────────────────────────────────── */
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return ["ALL", ...Array.from(set)];
  }, [menuItems]);

  /* ─── 3. Filtered Items ─────────────────────────────────────────────── */
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // 86 Stock Filter: Do not show unavailable items on the POS terminal
      if (item.is_available === false) return false;
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

  /* ─── 4. Cart Operations ────────────────────────────────────────────── */
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

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setCustomerName("");
    setCustomerPhone("");
    setCashTendered("");
  };

  /* ─── 5. Billing Calculations ───────────────────────────────────────── */
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const effectiveDiscount = useMemo(() => {
    if (discountMode === "PERCENT") {
      return (subtotal * discountPercent) / 100;
    }
    return Math.min(subtotal, discountAmount);
  }, [subtotal, discountMode, discountPercent, discountAmount]);

  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const taxTotal = (taxableAmount * 5) / 100;
  const grandTotal = Math.round(taxableAmount + taxTotal);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - grandTotal);
  }, [cashTendered, grandTotal]);

  /* ─── 6. Hold / Save Order (Leaves ticket saved in KOT) ──────────────── */
  const handleHoldOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const targetTable = orderType === "Dine In" ? selectedTable : `Takeaway #${Date.now().toString().slice(-4)}`;
      const itemsPayload = cart.map((c) => ({
        item: { id: c.id, name: c.name, basePrice: c.price, category: c.category, isVeg: c.isVeg },
        price: c.price,
        quantity: c.quantity,
        notes: c.notes || "",
      }));

      const { error } = await supabase.from("orders").insert({
        restaurant_id: restaurantId,
        table_no: targetTable,
        total: grandTotal,
        status: "PREPARING",
        payment_status: "PENDING",
        customer_name: customerName.trim() || (orderType === "Dine In" ? "Dine-in Guest" : "Takeaway Guest"),
        customer_phone: customerPhone.trim() || null,
        items_json: itemsPayload,
        note: `[POS Ticket Saved on Hold]`,
      });

      if (error) throw error;
      showToast(`Saved order on hold for ${targetTable}`);
      clearCart();
    } catch (err: any) {
      showToast("Error saving ticket: " + (err.message || "Failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 7. Settle Order ───────────────────────────────────────────────── */
  const handleSettleAndPrint = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const targetTable = orderType === "Dine In" ? selectedTable : `Takeaway #${Date.now().toString().slice(-4)}`;
      const itemsPayload = cart.map((c) => ({
        item: { id: c.id, name: c.name, basePrice: c.price, category: c.category, isVeg: c.isVeg },
        price: c.price,
        quantity: c.quantity,
        notes: c.notes || "",
      }));

      const { error } = await supabase.from("orders").insert({
        restaurant_id: restaurantId,
        table_no: targetTable,
        total: grandTotal,
        status: "COMPLETED",
        payment_status: "PAID",
        payment_method: selectedPaymentMethod,
        customer_name: customerName.trim() || (orderType === "Dine In" ? "Dine-in Guest" : "Takeaway Guest"),
        customer_phone: customerPhone.trim() || null,
        items_json: itemsPayload,
        note: `[POS Settle ${selectedPaymentMethod}]`,
      });

      if (error) throw error;
      showToast(`Settled ₹${grandTotal} via ${selectedPaymentMethod}`);
      setShowPaymentModal(false);
      clearCart();

      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err: any) {
      showToast("Settlement failed: " + (err.message || "Error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden font-sans text-zinc-900 select-none">
      
      {/* ── Top Notification Toast ── */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[200] bg-zinc-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. ULTRA-MINIMAL TOP BAR (Heading only) ───────────── */}
      <header className="shrink-0 z-30 bg-white border-b border-zinc-100 px-6 py-3 flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-zinc-900 tracking-tight leading-none">
          Quick POS
        </h1>
        <span className="text-[11px] font-medium text-zinc-400">
          {restaurantName}
        </span>
      </header>

      {/* ─── 2. MAIN TERMINAL (Items Left, Compact Order Right) ── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ── Left Area: Search + Category Pills + 3x3 Dish Grid ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA]">
          
          {/* Prominent Search Bar Right Above Categories */}
          <div className="shrink-0 px-6 pt-4 pb-2 bg-white">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search dishes or categories... (Press '/' to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-zinc-50/80 border border-zinc-200 hover:border-zinc-300 focus:border-[#E46254] focus:bg-white focus:ring-2 focus:ring-[#E46254]/10 rounded-xl text-[13px] font-medium transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Clean Horizontal Category Pills (No Arrows, Smooth Scroll) */}
          <div className="shrink-0 px-6 pt-1 pb-3 flex items-center bg-white border-b border-zinc-100">
            <div
              ref={categoryScrollRef}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full py-0.5"
            >
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
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                      isSelected
                        ? "bg-[#E46254] text-white border-[#E46254] shadow-xs"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900"
                    }`}
                  >
                    <span>{cat === "ALL" ? "All Items" : cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold tabular-nums ${
                        isSelected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dish Grid: 3x3 layout with prioritized visual hierarchy for cashier */}
          <div className="flex-1 overflow-y-auto slim-scrollbar p-6">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-zinc-200">
                <Receipt size={32} className="text-zinc-300 mb-2" />
                <h3 className="text-sm font-bold text-zinc-800">No dishes in this category</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Try selecting All Items or clearing the search</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => {
                  const inCart = cart.find((c) => c.id === item.id);

                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`bg-white rounded-2xl p-4.5 border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden select-none active:scale-[0.99] min-h-[140px] ${
                        inCart
                          ? "border-[#E46254] ring-2 ring-[#E46254]/15 shadow-sm"
                          : "border-zinc-200 hover:border-zinc-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                      }`}
                    >
                      {/* Priority 1 & 2: Veg Tag + Dish Name */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={`w-3.5 h-3.5 border flex items-center justify-center rounded-[3px] shrink-0 ${
                              item.is_veg ? "border-emerald-600" : "border-rose-600"
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.is_veg ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            />
                          </div>

                          {inCart ? (
                            <span className="text-[10.5px] font-extrabold bg-[#E46254] text-white px-2 py-0.5 rounded-md tabular-nums shadow-2xs">
                              {inCart.quantity} in order
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400 font-medium">
                              {item.category}
                            </span>
                          )}
                        </div>

                        {/* Prominent Dish Name - Highest Visual Priority */}
                        <h4 className="text-[15px] font-bold text-zinc-900 group-hover:text-[#E46254] transition-colors leading-snug">
                          {item.name}
                        </h4>
                      </div>

                      {/* Priority 3: Price + Immediate Add Action */}
                      <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                        <span className="text-[16px] font-extrabold text-zinc-900 tabular-nums">
                          ₹{item.base_price}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item);
                          }}
                          className={`h-8 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all ${
                            inCart
                              ? "bg-[#E46254] text-white shadow-2xs"
                              : "bg-[#E46254] text-white hover:bg-[#D35546]"
                          }`}
                        >
                          <Plus size={13} strokeWidth={2.5} />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── Right Area: Compact Current Order Sidebar (Reduced Horizontal Width: w-72 md:w-80) ── */}
        <div className="w-72 lg:w-80 shrink-0 bg-white border-l border-zinc-100 flex flex-col z-20">
          
          {/* Header & Order Type Segment */}
          <div className="p-4 border-b border-zinc-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
                <Receipt size={16} className="text-[#E46254]" /> Current order
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Segmented Pill */}
            <div className="flex bg-white p-1 rounded-xl border border-zinc-200 text-xs font-semibold">
              {(["Dine In", "Takeaway", "Delivery"] as OrderType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`flex-1 py-1 rounded-lg text-center transition-all cursor-pointer text-[11.5px] ${
                    orderType === type
                      ? "bg-[#E46254] text-white font-bold shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Compact Details (Table or Name/Phone) */}
            {orderType === "Dine In" ? (
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-400 text-[11px]">Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="py-1 px-2.5 bg-white border border-zinc-200 rounded-lg font-semibold text-zinc-800 outline-none focus:border-[#E46254] text-xs"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Name (Optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full py-1.5 px-2 bg-white border border-zinc-200 rounded-lg text-[11px] outline-none focus:border-[#E46254]"
                />
                <input
                  type="tel"
                  placeholder="Mobile (Optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full py-1.5 px-2 bg-white border border-zinc-200 rounded-lg text-[11px] outline-none focus:border-[#E46254]"
                />
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto slim-scrollbar p-3 space-y-2 bg-white">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                <p className="text-xs font-semibold text-zinc-600">No items selected</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Click any dish to add</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-2.5 border border-zinc-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            item.isVeg ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        />
                        <h5 className="text-[12.5px] font-bold text-zinc-900 truncate">{item.name}</h5>
                      </div>
                      <span className="text-[10.5px] text-zinc-400 font-medium pl-3.5 block">
                        ₹{item.price} each
                      </span>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-0.5 bg-white border border-zinc-200 rounded-lg p-0.5 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 hover:text-zinc-900 cursor-pointer"
                      >
                        <Minus size={10} strokeWidth={2.5} />
                      </button>
                      <span className="text-[11px] font-bold w-4 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-[#E46254] text-white hover:bg-[#D35546] cursor-pointer"
                      >
                        <Plus size={10} strokeWidth={2.5} />
                      </button>
                    </div>

                    <span className="text-xs font-bold text-zinc-900 tabular-nums w-12 text-right">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>

                  {/* Clean Cooking Note */}
                  <input
                    type="text"
                    placeholder="Note (e.g. less spicy)..."
                    value={item.notes || ""}
                    onChange={(e) => {
                      const noteVal = e.target.value;
                      setCart((prev) => prev.map((i) => (i.id === item.id ? { ...i, notes: noteVal } : i)));
                    }}
                    className="w-full text-[10.5px] bg-white border border-zinc-100 rounded px-2 py-0.5 outline-none text-zinc-600 focus:border-zinc-300"
                  />
                </div>
              ))
            )}
          </div>

          {/* Clean Order Summary & Bottom Actions */}
          <div className="p-4 border-t border-zinc-100 bg-white space-y-3">
            
            {/* Discount Trigger */}
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={() => setShowDiscountModal(true)}
                className="text-[11.5px] font-semibold text-[#E46254] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Tag size={12} />
                <span>
                  {effectiveDiscount > 0
                    ? `Discount: ₹${effectiveDiscount.toFixed(0)}`
                    : "Add Discount"}
                </span>
              </button>
              {effectiveDiscount > 0 && (
                <button
                  onClick={() => {
                    setDiscountPercent(0);
                    setDiscountAmount(0);
                  }}
                  className="text-[10px] text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Breakdown */}
            <div className="space-y-1 text-xs text-zinc-500 pt-1 border-t border-zinc-100">
              <div className="flex justify-between text-[11.5px]">
                <span>Subtotal</span>
                <span className="font-semibold text-zinc-800 tabular-nums">₹{subtotal.toFixed(2)}</span>
              </div>
              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium text-[11.5px]">
                  <span>Discount</span>
                  <span className="tabular-nums">-₹{effectiveDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11.5px]">
                <span>GST (5%)</span>
                <span className="font-semibold text-zinc-800 tabular-nums">₹{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-zinc-200">
                <span className="font-bold text-zinc-900 text-xs">Grand Total</span>
                <span className="text-xl font-black text-[#E46254] tabular-nums">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons: Save/Hold & Charge */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleHoldOrder}
                className="py-2.5 px-2 rounded-xl bg-white border border-zinc-300 hover:border-zinc-400 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <Bookmark size={13} />
                <span>Hold</span>
              </button>

              <button
                disabled={cart.length === 0 || isSubmitting}
                onClick={() => setShowPaymentModal(true)}
                className="py-2.5 px-2 rounded-xl bg-[#E46254] hover:bg-[#D35546] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(228,98,84,0.25)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <CreditCard size={13} />
                <span>Charge ₹{grandTotal}</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* ─── 3. DISCOUNT & COUPON MODAL ──────────────────────────────────── */}
      {showDiscountModal && (
        <div
          onClick={() => setShowDiscountModal(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <Tag size={15} className="text-[#E46254]" /> Add Bill Discount
              </h3>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex bg-white p-1 rounded-xl border border-zinc-200 text-xs font-semibold">
              <button
                onClick={() => setDiscountMode("PERCENT")}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  discountMode === "PERCENT" ? "bg-[#E46254] text-white font-bold" : "text-zinc-500"
                }`}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setDiscountMode("FLAT")}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  discountMode === "FLAT" ? "bg-[#E46254] text-white font-bold" : "text-zinc-500"
                }`}
              >
                Flat Amount (₹)
              </button>
            </div>

            {discountMode === "PERCENT" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setDiscountPercent(pct)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        discountPercent === pct
                          ? "bg-[#E46254] text-white border-[#E46254]"
                          : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Custom percent..."
                  value={discountPercent || ""}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none focus:border-[#E46254]"
                />
              </div>
            ) : (
              <input
                type="number"
                placeholder="Enter flat discount in ₹..."
                value={discountAmount || ""}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none focus:border-[#E46254]"
              />
            )}

            <button
              onClick={() => setShowDiscountModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-xs hover:bg-black transition-colors cursor-pointer"
            >
              Apply Discount
            </button>
          </div>
        </div>
      )}

      {/* ─── 4. SETTLEMENT & PAYMENT MODAL ───────────────────────────────── */}
      {showPaymentModal && (
        <div
          onClick={() => setShowPaymentModal(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Settle & Print Receipt</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Order Total: <strong className="text-zinc-900 text-sm">₹{grandTotal}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: "CASH", label: "Cash", icon: Banknote },
                { id: "UPI", label: "UPI QR", icon: QrCode },
                { id: "CARD", label: "Card / EDC", icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = selectedPaymentMethod === m.id;

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedPaymentMethod(m.id as PaymentMethod)}
                    className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#E46254]/10 border-[#E46254] text-[#E46254] font-bold shadow-2xs"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                    <span className="text-xs">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedPaymentMethod === "CASH" && (
              <div className="p-4 rounded-2xl bg-white border border-zinc-200 space-y-3 text-xs shadow-2xs">
                <label className="font-semibold text-zinc-700 block">Cash Tendered by Customer</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Enter cash given..."
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="flex-1 p-2.5 bg-white border border-zinc-200 rounded-xl font-bold text-sm text-zinc-900 outline-none focus:border-[#E46254]"
                  />
                  <button
                    onClick={() => setCashTendered(grandTotal.toString())}
                    className="px-3 rounded-xl bg-zinc-100 font-bold text-zinc-700 hover:bg-zinc-200 cursor-pointer"
                  >
                    Exact
                  </button>
                </div>

                <div className="flex gap-1.5">
                  {[100, 200, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCashTendered(amt.toString())}
                      className="flex-1 py-1.5 rounded-xl bg-white border border-zinc-200 font-semibold text-zinc-600 hover:border-zinc-300 text-xs cursor-pointer"
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                {parseFloat(cashTendered) > grandTotal && (
                  <div className="pt-2 border-t border-zinc-100 flex justify-between items-center font-bold text-emerald-700">
                    <span>Return Change:</span>
                    <span className="text-base tabular-nums">₹{changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {selectedPaymentMethod === "UPI" && (
              <div className="p-4 rounded-2xl bg-white border border-zinc-200 text-center space-y-2.5 shadow-2xs">
                <div className="w-40 h-40 bg-white p-2 rounded-2xl mx-auto border border-zinc-200 flex items-center justify-center shadow-xs">
                  {upiId ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
                          restaurantName
                        )}&am=${grandTotal}&cu=INR&tn=TableTapy_POS`
                      )}`}
                      alt="UPI QR"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-zinc-400 text-xs">
                      <QrCode size={32} className="mx-auto mb-1 text-zinc-300" />
                      <span>Configure UPI ID in Settings</span>
                    </div>
                  )}
                </div>
                <p className="text-[11.5px] text-zinc-500 font-medium">
                  Scan with Paytm, PhonePe, or Google Pay to pay ₹{grandTotal}
                </p>
              </div>
            )}

            <button
              disabled={isSubmitting}
              onClick={handleSettleAndPrint}
              className="w-full py-3.5 rounded-xl bg-[#E46254] hover:bg-[#D35546] text-white font-bold text-sm shadow-[0_4px_16px_rgba(228,98,84,0.3)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Receipt size={16} />
              <span>Complete Settlement & Print</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
