"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Coins,
  Star,
  Flame,
  Clock,
  Check,
  Plus,
  Trash2,
  Percent,
  Search,
  ChefHat,
  ShieldCheck,
  Smartphone,
  Save,
  RefreshCw,
  Tag,
  Gift,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

/* ─── Interfaces ─────────────────────────────────────────── */
interface MenuItem {
  id: string;
  name: string;
  category: string;
  base_price: number;
  is_veg: boolean;
  is_available: boolean;
  badge?: "CHEF_SIGNATURE" | "BESTSELLER" | "SPECIAL" | "MUST_TRY" | null;
}

interface LoyaltyMilestone {
  id: string;
  minSpend: number;
  coinsEarned: number;
}

interface PromotionsConfig {
  loyaltyEnabled: boolean;
  coinValueInRupees: number;
  milestones: LoyaltyMilestone[];
  minOrderToRedeem: number;
  maxCoinsPerOrder: number;
  happyHourEnabled: boolean;
  happyHourDiscountPct: number;
  happyHourStartTime: string;
  happyHourEndTime: string;
  happyHourDays: string[];
  cartBoosterEnabled: boolean;
  cartBoosterMinSpend: number;
  cartBoosterDiscount: number;
}

const DEFAULT_CONFIG: PromotionsConfig = {
  loyaltyEnabled: true,
  coinValueInRupees: 1.0,
  milestones: [
    { id: "m-1", minSpend: 200, coinsEarned: 2 },
    { id: "m-2", minSpend: 400, coinsEarned: 6 },
    { id: "m-3", minSpend: 800, coinsEarned: 12 },
    { id: "m-4", minSpend: 1500, coinsEarned: 25 },
  ],
  minOrderToRedeem: 800,
  maxCoinsPerOrder: 100,
  happyHourEnabled: true,
  happyHourDiscountPct: 20,
  happyHourStartTime: "15:30",
  happyHourEndTime: "18:30",
  happyHourDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  cartBoosterEnabled: true,
  cartBoosterMinSpend: 1000,
  cartBoosterDiscount: 100,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PromotionsPage() {
  const supabase = createClient();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [restaurantName, setRestaurantName] = useState<string>("My Restaurant");
  // Active Sub-View
  const [activeSection, setActiveSection] = useState<"LOYALTY" | "HAPPY_HOURS">("LOYALTY");

  // Configuration
  const [config, setConfig] = useState<PromotionsConfig>(DEFAULT_CONFIG);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /* ─── Load Initial Data ─────────────────────────────────── */
  const loadData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const restId = user.user_metadata?.restaurant_id;

      if (restId) {
        setRestaurantId(restId);
        const { data: rData } = await supabase.from("restaurants").select("name").eq("id", restId).maybeSingle();
        if (rData?.name) {
          setRestaurantName(rData.name);
        }

        // Load Saved Configuration from localStorage or restaurant metadata
        const savedConfig = localStorage.getItem(`tabletapy_promotions_config_${restId}`);
        if (savedConfig) {
          try {
            setConfig(JSON.parse(savedConfig));
          } catch {}
        }
      }
    } catch (err) {
      console.error("Error loading promotions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ─── Save All Changes ──────────────────────────────────── */
  const handleSaveConfig = () => {
    if (!restaurantId) return;
    setSaving(true);

    try {
      // 1. Save config to local storage
      localStorage.setItem(`tabletapy_promotions_config_${restaurantId}`, JSON.stringify(config));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
      }

      showToast("All promotions & coin rules saved successfully!");
    } catch (err) {
      showToast("Error saving changes. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  /* ─── Manage Loyalty Milestones ─────────────────────────── */
  const handleUpdateMilestone = (id: string, field: "minSpend" | "coinsEarned", val: number) => {
    setConfig((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) => (m.id === id ? { ...m, [field]: val } : m)),
    }));
  };

  const handleAddMilestone = () => {
    const lastMilestone = config.milestones[config.milestones.length - 1];
    const nextSpend = lastMilestone ? lastMilestone.minSpend + 500 : 1000;
    const nextCoins = lastMilestone ? lastMilestone.coinsEarned + 10 : 15;

    const newMilestone: LoyaltyMilestone = {
      id: `m-${Date.now()}`,
      minSpend: nextSpend,
      coinsEarned: nextCoins,
    };

    setConfig((prev) => ({
      ...prev,
      milestones: [...prev.milestones, newMilestone],
    }));
    showToast("Added new reward tier!");
  };

  const handleRemoveMilestone = (id: string) => {
    if (config.milestones.length <= 1) {
      showToast("You need at least one reward tier!");
      return;
    }
    setConfig((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m) => m.id !== id),
    }));
  };

  /* ─── Render Loading State ──────────────────────────────── */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-[#E46254] rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium text-[13px]">Loading promotions studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden font-sans text-zinc-900">
      {/* ─── Top Floating Notification Toast ─── */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[150] bg-zinc-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-zinc-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. PHYSICALLY FIXED TOP NAVBAR (Pure SVG Brand Icon, Zero Circle Wrappers) ─── */}
      <header className="shrink-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-6 md:px-10 py-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <Sparkles size={22} className="text-[#E46254] shrink-0" strokeWidth={2.2} />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[19px] md:text-[21px] font-bold tracking-tight text-zinc-900 leading-none">
                  Promotions & TableTapy Coin Rewards
                </h1>
                <span className="text-[11.5px] font-semibold bg-[#E46254]/8 text-[#E46254] px-2.5 py-0.5 rounded-full border border-[#E46254]/20">
                  {config.loyaltyEnabled ? "Coins Active" : "Coins Paused"}
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-1 font-medium hidden md:block">
                Zero-friction guest loyalty: TableTapy coins, signature dish badges, and automated happy hours.
              </p>
            </div>
          </div>

          {/* Top Actions: Refresh & Save */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={loadData}
              className="p-2 rounded-xl border border-zinc-200 text-zinc-600 hover:text-[#E46254] hover:border-[#E46254]/30 hover:bg-[#E46254]/5 active:bg-[#E46254]/10 transition-all cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw size={14.5} />
            </button>

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-[12.5px] font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save size={14} className="text-[#E46254]" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. PHYSICALLY FIXED SECTION TABS ─── */}
      <div className="shrink-0 z-20 bg-zinc-50/60 border-b border-zinc-200/70 px-6 md:px-10 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Sub-View Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {(
              [
                { id: "LOYALTY", label: "TableTapy Coin Engine", icon: Coins },
                { id: "HAPPY_HOURS", label: "Happy Hours & Cart Boosters", icon: Clock },
              ] as const
            ).map((tab) => {
              const active = activeSection === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "bg-white text-zinc-900 border border-zinc-300 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/70 border border-transparent"
                  }`}
                >
                  <Icon size={13.5} className={active ? "text-[#E46254]" : "text-zinc-400"} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Automatic QR menu synchronization</span>
          </div>
        </div>
      </div>

      {/* ─── 3. SCROLLABLE PROMOTIONS WORKSPACE ─── */}
      <main className="flex-1 overflow-y-auto px-6 md:px-10 py-5 space-y-4 md:space-y-5 bg-[#FAFAFA]">
        {/* =========================================================================
            VIEW 1: TABLETAPY COIN REWARDS ENGINE
           ========================================================================= */}
        {activeSection === "LOYALTY" && (
          <div className="space-y-4 md:space-y-5">
            {/* Top Overview & Master Switch Card */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-[#E46254]" />
                  <h2 className="text-[16px] font-bold text-zinc-900 tracking-tight">
                    TableTapy Special Coins Program
                  </h2>
                </div>
                <p className="text-zinc-400 text-xs font-medium">
                  Guests earn coins tied directly to their mobile number on every order. Zero customer app required.
                </p>
              </div>

              {/* Master Active Switch */}
              <div className="flex items-center gap-3 self-start sm:self-auto bg-zinc-50 border border-zinc-200/80 px-3.5 py-2 rounded-xl">
                <span className="text-xs font-semibold text-zinc-700">Program Status:</span>
                <button
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, loyaltyEnabled: !prev.loyaltyEnabled }))
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    config.loyaltyEnabled
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {config.loyaltyEnabled ? "Active" : "Paused"}
                </button>
              </div>
            </section>

            {/* Coin Value Rule Card */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-[14.5px] font-bold text-zinc-900 tracking-tight">
                    1. Coin Conversion Rate (Real Money Clarity)
                  </h3>
                  <p className="text-zinc-400 text-xs font-medium">
                    Set the exact rupee value of 1 TableTapy Coin so customers immediately know what they saved.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                  1 Coin = ₹{config.coinValueInRupees.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {[
                  { label: "1 Coin = ₹1.00 (Recommended)", val: 1.0 },
                  { label: "1 Coin = ₹0.50 (Conservative)", val: 0.5 },
                  { label: "1 Coin = ₹2.00 (Generous VIP)", val: 2.0 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setConfig((prev) => ({ ...prev, coinValueInRupees: opt.val }))}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      config.coinValueInRupees === opt.val
                        ? "border-[#E46254] bg-[#E46254]/5 ring-1 ring-[#E46254]/30"
                        : "border-zinc-200/70 bg-zinc-50/50 hover:bg-zinc-50"
                    }`}
                  >
                    <div className="text-xs font-semibold text-zinc-900">{opt.label}</div>
                    <span className="text-[11px] text-zinc-400 mt-1 block">
                      10 Coins = {formatCurrency(10 * opt.val)}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Milestone Reward Tiers (Spend ₹200 -> 2 coins, ₹400 -> 6 coins...) */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-[14.5px] font-bold text-zinc-900 tracking-tight">
                    2. Order Spend Milestones (Tiered Reward Rules)
                  </h3>
                  <p className="text-zinc-400 text-xs font-medium">
                    Reward higher bill spenders with more coins to encourage diners to add an extra drink or appetizer.
                  </p>
                </div>

                <button
                  onClick={handleAddMilestone}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 text-xs font-semibold text-zinc-800 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Plus size={13} className="text-[#E46254]" />
                  <span>Add Reward Tier</span>
                </button>
              </div>

              {/* Milestone Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
                {config.milestones.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/60 flex flex-col justify-between space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#E46254]">Tier #{idx + 1}</span>
                      {config.milestones.length > 1 && (
                        <button
                          onClick={() => handleRemoveMilestone(m.id)}
                          className="text-zinc-300 hover:text-zinc-600 transition-colors p-1"
                          title="Remove tier"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Spend Threshold Input */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Min Order Spend
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-zinc-400 font-semibold text-xs">
                          ₹
                        </span>
                        <input
                          type="number"
                          value={m.minSpend}
                          onChange={(e) =>
                            handleUpdateMilestone(m.id, "minSpend", parseFloat(e.target.value) || 0)
                          }
                          className="w-full pl-6 pr-2 py-1 text-sm font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-[#E46254]"
                        />
                      </div>
                    </div>

                    {/* Coins Awarded Input */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        Coins Earned
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={m.coinsEarned}
                          onChange={(e) =>
                            handleUpdateMilestone(
                              m.id,
                              "coinsEarned",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2.5 py-1 text-sm font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-[#E46254]"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-200/70 text-[11px] text-zinc-500 font-medium flex items-center justify-between">
                      <span>Reward Value:</span>
                      <span className="font-semibold text-zinc-900">
                        {formatCurrency(m.coinsEarned * config.coinValueInRupees)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Redemption Safeguards (Owner Margin Shield) */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#E46254]" />
                <div>
                  <h3 className="text-[14.5px] font-bold text-zinc-900 tracking-tight">
                    3. Redemption Guardrails (Owner Margin Protection)
                  </h3>
                  <p className="text-zinc-400 text-xs font-medium">
                    Ensure coins are only redeemable on high-ticket orders so you never lose margin on small chai/snack bills.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Minimum Bill to Redeem */}
                {/* Max Coins per Order (Owner-chosen limit X) */}
                <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 space-y-2.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                        Max Coins Redeemable Per Bill (Limit X)
                      </span>
                      <p className="text-[11.5px] text-zinc-500 mt-0.5">
                        Customers can redeem their coins on <strong>any order size</strong>, up to this maximum limit per bill.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Zero Minimum Spend
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={config.maxCoinsPerOrder}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            maxCoinsPerOrder: parseFloat(e.target.value) || 0,
                            minOrderToRedeem: 0,
                          }))
                        }
                        className="w-32 px-3 py-1.5 text-sm font-bold rounded-xl border border-zinc-200 bg-white text-zinc-900 focus:outline-none focus:border-[#E46254]"
                      />
                      <span className="text-xs font-bold text-zinc-600">Coins</span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      = Max discount of {formatCurrency(config.maxCoinsPerOrder * (config.coinValueInRupees || 1))} per bill
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            VIEW 3: HAPPY HOURS & AUTOMATED CART BOOSTERS
           ========================================================================= */}
        {activeSection === "HAPPY_HOURS" && (
          <div className="space-y-4 md:space-y-5">
            {/* Happy Hour Automation Card */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-[#E46254]" />
                    <h3 className="text-[15px] font-bold text-zinc-900 tracking-tight">
                      Afternoon Slump & Happy Hour Automation
                    </h3>
                  </div>
                  <p className="text-zinc-400 text-xs font-medium">
                    Automatically applies a discount on customer QR menus during sluggish afternoon hours (3:30 PM - 6:30 PM).
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, happyHourEnabled: !prev.happyHourEnabled }))
                    }
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      config.happyHourEnabled
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {config.happyHourEnabled ? "Auto-Active" : "Disabled"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {/* Discount Percentage */}
                <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-700">Happy Hour Discount</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={config.happyHourDiscountPct}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          happyHourDiscountPct: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-24 px-2 py-1 text-sm font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:border-[#E46254]"
                    />
                    <span className="text-xs font-bold text-zinc-500">% Off</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Applies across drinks & appetizers</p>
                </div>

                {/* Timing Window */}
                <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-700">Active Time Window</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <input
                      type="time"
                      value={config.happyHourStartTime}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, happyHourStartTime: e.target.value }))
                      }
                      className="px-2 py-1 rounded-lg border border-zinc-300 bg-white"
                    />
                    <span className="text-zinc-400">to</span>
                    <input
                      type="time"
                      value={config.happyHourEndTime}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, happyHourEndTime: e.target.value }))
                      }
                      className="px-2 py-1 rounded-lg border border-zinc-300 bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400">Turns on & off automatically</p>
                </div>

                {/* Active Days */}
                <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-700">Scheduled Days</span>
                  <div className="flex flex-wrap gap-1 text-[11px] font-semibold">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                      const isSel = config.happyHourDays.includes(day);
                      return (
                        <button
                          key={day}
                          onClick={() => {
                            const next = isSel
                              ? config.happyHourDays.filter((d) => d !== day)
                              : [...config.happyHourDays, day];
                            setConfig((prev) => ({ ...prev, happyHourDays: next }));
                          }}
                          className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                            isSel
                              ? "bg-zinc-900 text-white"
                              : "bg-zinc-200/70 text-zinc-600 hover:bg-zinc-200"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Cart Value Booster (Minimum Order Threshold Discount) */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 md:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-[#E46254]" />
                    <h3 className="text-[15px] font-bold text-zinc-900 tracking-tight">
                      Cart Value Booster (Bill Size Motivator)
                    </h3>
                  </div>
                  <p className="text-zinc-400 text-xs font-medium">
                    Shows an interactive progress bar in the customer's cart: "Add ₹150 more to get Flat ₹100 Off!"
                  </p>
                </div>

                <button
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      cartBoosterEnabled: !prev.cartBoosterEnabled,
                    }))
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    config.cartBoosterEnabled
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {config.cartBoosterEnabled ? "Active" : "Disabled"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 space-y-2">
                  <span className="text-xs font-semibold text-zinc-700">
                    Minimum Bill Threshold to Unlock
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-400">₹</span>
                    <input
                      type="number"
                      value={config.cartBoosterMinSpend}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cartBoosterMinSpend: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-32 px-2.5 py-1 text-sm font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:border-[#E46254]"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400">Example: ₹1,000</p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200/70 bg-zinc-50/50 space-y-2">
                  <span className="text-xs font-semibold text-zinc-700">
                    Discount Amount Given (Flat ₹)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-400">₹</span>
                    <input
                      type="number"
                      value={config.cartBoosterDiscount}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cartBoosterDiscount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-32 px-2.5 py-1 text-sm font-semibold rounded-lg border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:border-[#E46254]"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400">Example: Flat ₹100 Off</p>
                </div>
              </div>

              {/* Live Preview Bar */}
              <div className="p-3.5 rounded-xl border border-[#E46254]/20 bg-[#E46254]/4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Gift size={15} className="text-[#E46254]" />
                  <span>
                    What guest sees in cart:{" "}
                    <strong className="text-zinc-900">
                      "Add ₹180 more to unlock Flat {formatCurrency(config.cartBoosterDiscount)} off your bill!"
                    </strong>
                  </span>
                </div>
                <span className="text-[11px] font-bold text-[#E46254]">Live Cart Preview</span>
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            BOTTOM LIVE PHONE PREVIEW ROW (Instant Customer Feedback)
           ========================================================================= */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-[#E46254] shrink-0" />
            <div>
              <div className="text-sm font-bold text-zinc-900">
                Customer Mobile Experience
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                All rules are instantly applied on QR table menus without needing customer app downloads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={13.5} className="text-[#E46254]" />
              <span>Save & Publish to Floor</span>
            </button>
          </div>
        </section>

        {/* Footer */}
        <div className="py-3 text-center">
          <p className="text-zinc-400 text-xs font-medium">
            TableTapy Revenue & Merchandising Studio • Zero App Guest Experience
          </p>
        </div>
      </main>
    </div>
  );
}
