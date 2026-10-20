"use client";

import React, { useState, useEffect } from "react";
import { GlassWater, AlertCircle, Plus, Check, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface WaterBottleItem {
  id?: string;
  name: string;
  size: string; // e.g., '1L' | '500ml' | '750ml' | '300ml'
  price: number;
  stock: number;
}

export function WaterBottleSetupModal() {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Form inputs
  const [bottles, setBottles] = useState<WaterBottleItem[]>([
    { name: "Packaged Drinking Water (1L)", size: "1L", price: 20, stock: 48 },
    { name: "Packaged Drinking Water (500ml)", size: "500ml", price: 10, stock: 48 }
  ]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const checkWaterConfig = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let restId = user?.user_metadata?.restaurant_id;

        if (!restId && user?.id) {
          const { data: r } = await supabase
            .from('restaurants')
            .select('id, business_type')
            .eq('owner_id', user.id)
            .limit(1)
            .maybeSingle();
          if (r?.id) restId = r.id;
        }

        if (!restId) {
          const { data: anyRest } = await supabase
            .from('restaurants')
            .select('id')
            .limit(1)
            .maybeSingle();
          if (anyRest?.id) restId = anyRest.id;
        }

        if (!restId) {
          setChecking(false);
          return;
        }

        setRestaurantId(restId);

        // Check if water bottle is already configured in menu_items_v2 or inventory_items
        const { data: menuWater } = await supabase
          .from('menu_items_v2')
          .select('id, name')
          .ilike('name', '%water%')
          .limit(1);

        const { data: invWater } = await supabase
          .from('inventory_items')
          .select('id, name')
          .ilike('name', '%water%')
          .limit(1);

        const localFlag = typeof window !== 'undefined' ? localStorage.getItem(`tabletapy_water_configured_${restId}`) : null;

        const hasWaterConfigured = (menuWater && menuWater.length > 0) || (invWater && invWater.length > 0) || localFlag === 'true';

        if (!hasWaterConfigured) {
          // Block navigation and show setup modal
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Water check error:", err);
      } finally {
        setChecking(false);
      }
    };

    checkWaterConfig();
  }, [supabase]);

  const handleAddBottleRow = () => {
    setBottles(prev => [
      ...prev,
      { name: `Mineral Water (${prev.length === 2 ? '750ml' : '300ml'})`, size: prev.length === 2 ? '750ml' : '300ml', price: 15, stock: 24 }
    ]);
  };

  const handleUpdateRow = (idx: number, field: keyof WaterBottleItem, val: any) => {
    setBottles(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleRemoveRow = (idx: number) => {
    if (bottles.length <= 1) return;
    setBottles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveWaterSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validation
    for (const b of bottles) {
      if (!b.name.trim()) {
        setErrorMsg("Please specify name for all water bottles.");
        return;
      }
      if (!b.size.trim()) {
        setErrorMsg("Please specify bottle volume/liter size (e.g. 1L, 500ml).");
        return;
      }
      if (b.price < 0 || isNaN(b.price)) {
        setErrorMsg("Please enter a valid price for all water bottles.");
        return;
      }
      if (b.stock < 0 || isNaN(b.stock)) {
        setErrorMsg("Please enter starting stock quantity for each bottle type.");
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Insert into menu_items_v2 so waiters & customers can add to order/bill
      for (const b of bottles) {
        const displayName = b.name.includes(b.size) ? b.name : `${b.name} (${b.size})`;
        
        // Add to menu
        await supabase.from('menu_items_v2').insert([{
          name: displayName,
          category: 'Beverages',
          subcategory: 'Water',
          base_price: Number(b.price),
          description: `Chilled Packaged Drinking Water (${b.size})`,
          is_veg: true,
          is_available: true
        }]);

        // Add to inventory_items
        await supabase.from('inventory_items').insert([{
          name: displayName,
          category: 'Beverages',
          storage_unit: 'bottle',
          vendor_unit: 'crate',
          vendor_to_storage: 24,
          cost_per_vendor_unit: Number(b.price) * 18,
          price_last_month: Number(b.price) * 18,
          yield_percentage: 100,
          is_semi_finished: false,
          recipe_unit: 'bottle',
          stock: Number(b.stock),
          threshold: 12
        }]);
      }

      if (restaurantId && typeof window !== 'undefined') {
        localStorage.setItem(`tabletapy_water_configured_${restaurantId}`, 'true');
      }

      setIsOpen(false);
    } catch (err: any) {
      console.error("Save water setup error:", err);
      setErrorMsg(err.message || "Failed to save water bottle setup.");
    } finally {
      setSaving(false);
    }
  };

  if (checking || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-sky-500 to-sky-600 text-white shrink-0 relative">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-3 shadow-inner">
            <GlassWater size={26} strokeWidth={2.4} />
          </div>
          <span className="text-[11px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-white/20 text-white inline-block mb-1">
            Mandatory Floor Setup
          </span>
          <h2 className="text-[20px] font-extrabold tracking-tight">
            Add Your Water Bottle Stock & Sizes
          </h2>
          <p className="text-[12.5px] text-white/85 mt-1 leading-snug">
            Before proceeding, please configure your restaurant's water bottles, sizes (e.g. 1L, 500ml), prices, and starting stock. These will automatically appear in customer menus, waiter orders, and bills.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveWaterSetup} className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px] font-semibold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <span>Water Bottle Options ({bottles.length})</span>
              <button
                type="button"
                onClick={handleAddBottleRow}
                className="text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1 cursor-pointer lowercase"
              >
                <Plus size={13} /> + add another size
              </button>
            </div>

            {bottles.map((bottle, idx) => (
              <div 
                key={idx}
                className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2.5 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-zinc-700 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-white border border-zinc-200 flex items-center justify-center text-[10px] text-zinc-900 font-black">
                      #{idx + 1}
                    </span>
                    Bottle Option
                  </span>
                  {bottles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="text-zinc-400 hover:text-red-600 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Bottle Label / Brand Name
                    </label>
                    <input
                      type="text"
                      required
                      value={bottle.name}
                      onChange={e => handleUpdateRow(idx, 'name', e.target.value)}
                      placeholder="e.g. Bisleri / Aquafina / Kinley"
                      className="w-full py-2 px-3 bg-white border border-zinc-200 rounded-xl text-[13px] font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Bottle Size (Liters / ml)
                    </label>
                    <select
                      value={bottle.size}
                      onChange={e => handleUpdateRow(idx, 'size', e.target.value)}
                      className="w-full py-2 px-2.5 bg-white border border-zinc-200 rounded-xl text-[13px] font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
                    >
                      <option value="1L">1 Liter (1L)</option>
                      <option value="500ml">500 ml</option>
                      <option value="750ml">750 ml</option>
                      <option value="300ml">300 ml</option>
                      <option value="2L">2 Liters (2L)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Menu Price (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-[13px] font-bold text-zinc-400">₹</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="1"
                        value={bottle.price}
                        onChange={e => handleUpdateRow(idx, 'price', parseFloat(e.target.value) || 0)}
                        className="w-full py-2 pl-7 pr-2.5 bg-white border border-zinc-200 rounded-xl text-[13px] font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Starting In-House Stock (Bottles available)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={bottle.stock}
                      onChange={e => handleUpdateRow(idx, 'stock', parseInt(e.target.value) || 0)}
                      placeholder="e.g. 48"
                      className="w-full py-2 px-3 bg-white border border-zinc-200 rounded-xl text-[13px] font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 tabular-nums"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving & Initializing Stock...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>Save Water Bottles & Continue to Dashboard</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-zinc-400 text-center mt-2">
              You can adjust stock anytime in the Inventory or Menu tabs.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
