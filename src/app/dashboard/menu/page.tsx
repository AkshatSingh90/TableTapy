"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, ArrowLeft, Loader2, X, Edit2, Trash2, ChefHat, Check, Layers } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  ItemVariantsConfig,
  getDefaultVariantsConfig,
  extractVariantsFromDescription,
  buildTaggedDescription,
  COMMON_PREP_TAGS,
} from "@/utils/menuItemVariants";

interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  recipeUnit: string;
  costPerVendorUnit: number;
  vendorToStorage: number;
  storageUnit: string;
  yieldPercentage: number;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  base_price: number;
  description: string;
  is_veg: boolean;
  is_available: boolean;
  badge?: "CHEF_SIGNATURE" | "BESTSELLER" | "SPECIAL" | "MUST_TRY" | null;
  recipeUsages?: any[];
  variantsConfig?: ItemVariantsConfig;
}

export default function MenuManagerPage() {
  const supabase = createClient();
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const defaultForm = { name: '', category: 'Main Course', subcategory: '', base_price: '', description: '', is_veg: true, badge: null as ("CHEF_SIGNATURE" | "BESTSELLER" | "SPECIAL" | "MUST_TRY" | null) };
  const [form, setForm] = useState(defaultForm);
  const [variantsConfig, setVariantsConfig] = useState<ItemVariantsConfig>(getDefaultVariantsConfig(0));
  const [recipeIngredients, setRecipeIngredients] = useState<{ inventory_item_id: string; amount: string; name?: string; cost?: number }[]>([]);

  // Keep the 'Full' portion in sync with base_price
  useEffect(() => {
    const num = Number(form.base_price) || 0;
    setVariantsConfig(prev => ({
      ...prev,
      portions: prev.portions.map(p => p.name.toLowerCase() === 'full' ? { ...p, price: num } : p)
    }));
  }, [form.base_price]);

  const handleOpenCreateModal = () => {
    setEditingItemId(null);
    setForm(defaultForm);
    setVariantsConfig(getDefaultVariantsConfig(0));
    setRecipeIngredients([]);
    setIsAddingMode(true);
  };

  // Quick Add Material State
  const [isQuickAddMaterial, setIsQuickAddMaterial] = useState(false);
  const [quickMaterial, setQuickMaterial] = useState({ name: '', category: 'Meat & Poultry', vendorUnit: 'carton', storageUnit: 'kg', costPerVendorUnit: '', vendorToStorage: '', prepLoss: '0', stock: '', threshold: '' });
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const restId = user?.user_metadata?.restaurant_id;

    if (!restId) {
      setMenuItems([]);
      setInventory([]);
      setIsLoading(false);
      return;
    }
    setRestaurantId(restId);

    // 1. Load Inventory for recipe builder (isolated per restaurant)
    let invRows: any[] | null = null;
    const { data: restInv, error: invErr } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('restaurant_id', restId)
      .order('name');

    if (!invErr && restInv) {
      invRows = restInv;
    } else {
      const { data: allInv } = await supabase.from('inventory_items').select('*').order('name');
      if (allInv) {
        invRows = allInv.filter((row: any) => {
          if (row.category === 'STAFF_ROSTER') return false;
          if (row.restaurant_id) return row.restaurant_id === restId;
          const savedCustomIds = localStorage.getItem(`tabletapy_inventory_${restId}`);
          if (savedCustomIds) {
            try {
              const ids: string[] = JSON.parse(savedCustomIds);
              if (ids.includes(row.id)) return true;
            } catch {}
          }
          return row.name && row.name.startsWith(`[REST:${restId}]`);
        });
      }
    }

    if (invRows) {
      setInventory(invRows.map((row: any) => ({
        id: row.id,
        name: row.name.replace(/^\[REST:[^\]]+\]\s*/, ''),
        stock: Number(row.stock),
        recipeUnit: row.recipe_unit,
        costPerVendorUnit: Number(row.cost_per_vendor_unit),
        vendorToStorage: Number(row.vendor_to_storage),
        storageUnit: row.storage_unit,
        yieldPercentage: Number(row.yield_percentage || 100)
      })));
    }
    
    // 2. Load Menu Items (supports native restaurant_id + metadata isolation + shared catalog fallback)
    let menuRows: any[] | null = null;
    const { data: restMenu, error: menuScopeErr } = await supabase
      .from('menu_items_v2')
      .select('*')
      .eq('restaurant_id', restId)
      .order('created_at', { ascending: false });

    if (!menuScopeErr && restMenu && restMenu.length > 0) {
      menuRows = restMenu;
    } else {
      const { data: allMenu } = await supabase.from('menu_items_v2').select('*').order('created_at', { ascending: false });
      if (allMenu) {
        menuRows = allMenu.filter((row: any) => {
          if (row.restaurant_id) return row.restaurant_id === restId;
          const savedCustomMenuIds = localStorage.getItem(`tabletapy_menu_${restId}`);
          if (savedCustomMenuIds) {
            try {
              const ids: string[] = JSON.parse(savedCustomMenuIds);
              if (ids.includes(row.id)) return true;
            } catch {}
          }
          if (row.description && row.description.includes(`[REST:${restId}]`)) return true;
          // Show general items if no restaurant_id attached (matching POS behavior)
          if (!row.restaurant_id && (!row.description || !row.description.includes('[REST:'))) return true;
          return false;
        });
      }
    }

    if (menuRows) {
       const { data: usages } = await supabase.from('inventory_recipe_usage').select('*');
       
       setMenuItems(menuRows.map((row: any) => {
         const { cleanDescription, config } = extractVariantsFromDescription(row.description, Number(row.base_price || 0));
         const itemUsages = usages?.filter(u => u.name === row.name) || [];
         const enrichedUsages = itemUsages.map(u => {
           const invMatch = invRows?.find(inv => inv.id === u.inventory_item_id);
           return { ...u, inventory_name: invMatch?.name?.replace(/^\[REST:[^\]]+\]\s*/, '') || 'Unknown Ingredient' };
         });

         // Load saved badges from restaurant storage or row
         let itemBadge = row.badge || null;
         if (!itemBadge && restId) {
           try {
             const savedBadges = localStorage.getItem(`tabletapy_dish_badges_${restId}`);
             if (savedBadges) {
               const parsed = JSON.parse(savedBadges);
               itemBadge = parsed[row.id] || null;
             }
           } catch {}
         }

         return {
           id: row.id,
           name: row.name,
           category: row.category,
           subcategory: row.subcategory || '',
           base_price: Number(row.base_price),
           description: cleanDescription,
           is_veg: row.is_veg,
           is_available: row.is_available !== false,
           badge: itemBadge,
           recipeUsages: enrichedUsages,
           variantsConfig: config,
         };
       }));
    } else {
      setMenuItems([]);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const formatCurrency = (amount: number, showDecimals: boolean = false) => {
    if (isNaN(amount) || !isFinite(amount)) return '₹0';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: showDecimals ? 2 : 0,
      minimumFractionDigits: showDecimals ? 2 : 0
    }).format(amount);
  };

  const toggleAvailability = async (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !item.is_available;
    setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: newStatus } : i));
    if (selectedItem?.id === item.id) setSelectedItem({ ...selectedItem, is_available: newStatus });
    
    const { error } = await supabase.from('menu_items_v2').update({ is_available: newStatus }).eq('id', item.id);
    if (error) console.warn("Could not save availability to DB, state updated locally. Add 'is_available' column to fix.");
  };

  const toggleCategoryAvailability = async (itemsToToggle: MenuItem[]) => {
    const anyAvailable = itemsToToggle.some(i => i.is_available);
    const newStatus = !anyAvailable;
    const ids = itemsToToggle.map(i => i.id);
    setMenuItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, is_available: newStatus } : i));
    
    const { error } = await supabase.from('menu_items_v2').update({ is_available: newStatus }).in('id', ids);
    if (error) console.warn("Could not save category availability to DB, state updated locally. Add 'is_available' column to fix.");
  };

  const handleAddIngredientToRecipe = (invId: string) => {
    if (!invId) return;
    if (invId === 'NEW_MATERIAL') {
      setIsQuickAddMaterial(true);
      return;
    }
    const inv = inventory.find(i => i.id === invId);
    if (!inv || recipeIngredients.some(r => r.inventory_item_id === invId)) return;
    
    // Safely calculate cost per recipe unit factoring in usable yield / prep loss
    const conversionFactor = inv.vendorToStorage && inv.vendorToStorage > 0 ? inv.vendorToStorage : 1;
    const rawCostPerStorage = inv.costPerVendorUnit / conversionFactor;
    const yieldPct = inv.yieldPercentage > 0 ? inv.yieldPercentage : 100;
    const usableCostPerStorage = rawCostPerStorage / (yieldPct / 100);
    let costPerRecipeUnit = usableCostPerStorage;
    if (inv.storageUnit === 'kg' && inv.recipeUnit === 'g') costPerRecipeUnit /= 1000;
    if (inv.storageUnit === 'L' && inv.recipeUnit === 'ml') costPerRecipeUnit /= 1000;


    setRecipeIngredients([...recipeIngredients, { 
      inventory_item_id: invId, 
      amount: '1', 
      name: inv.name, 
      cost: costPerRecipeUnit 
    }]);
  };

  const handleQuickSaveMaterial = async () => {
    if (!quickMaterial.name.trim() || !quickMaterial.costPerVendorUnit || !quickMaterial.vendorToStorage) return;
    setIsQuickSaving(true);
    
    const conversion = parseFloat(quickMaterial.vendorToStorage) || 1;
    const lossPct = parseFloat(quickMaterial.prepLoss) || 0;
    const yieldPct = Math.max(0.1, 100 - lossPct);
    const price = parseFloat(quickMaterial.costPerVendorUnit) || 0;
    const stockNum = parseFloat(quickMaterial.stock) || 0;
    const threshNum = parseFloat(quickMaterial.threshold);

    const { data, error } = await supabase.from('inventory_items').insert([{
      name: quickMaterial.name.trim(),
      category: quickMaterial.category,
      storage_unit: quickMaterial.storageUnit,
      vendor_unit: quickMaterial.vendorUnit,
      vendor_to_storage: conversion,
      cost_per_vendor_unit: price,
      price_last_month: price,
      yield_percentage: yieldPct,
      is_semi_finished: false,
      recipe_unit: quickMaterial.storageUnit === 'kg' ? 'g' : quickMaterial.storageUnit === 'L' ? 'ml' : quickMaterial.storageUnit,
      stock: stockNum,
      threshold: !isNaN(threshNum) ? threshNum : null,
      daily_burn_rate: 0,
      estimated_days_left: 999,
      pos_expected: stockNum,
      actual_counted: stockNum
    }]).select().single();

    if (error) {
      console.error(error);
      alert("Error saving material");
      setIsQuickSaving(false);
      return;
    }

    if (data) {
      if (stockNum > 0) {
        await supabase.from('inventory_ledgers').insert([{
          inventory_item_id: data.id,
          date: new Date().toISOString().split('T')[0],
          type: 'DELIVERY',
          amount: stockNum,
          note: 'Opening Stock Initialisation'
        }]);
      }
      setRecipeIngredients(prev => [...prev, { inventory_item_id: data.id, amount: '0', name: data.name, cost: 0 }]);
    }
    
    setQuickMaterial({ name: '', category: 'Meat & Poultry', vendorUnit: 'carton', storageUnit: 'kg', costPerVendorUnit: '', vendorToStorage: '', prepLoss: '0', stock: '', threshold: '' });
    setIsQuickAddMaterial(false);
    setIsQuickSaving(false);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const taggedDesc = buildTaggedDescription(form.description, variantsConfig, restaurantId);
    let menuErr: any = null;
    let savedMenuId: string | null = editingItemId;

    if (editingItemId) {
      const { error } = await supabase.from('menu_items_v2').update({
        name: form.name,
        category: form.category,
        subcategory: form.subcategory || '',
        base_price: Number(form.base_price),
        description: taggedDesc,
        is_veg: form.is_veg,
      }).eq('id', editingItemId);
      menuErr = error;
    } else {
      const { data: insertedMenu, error } = await supabase.from('menu_items_v2').insert([{
        name: form.name,
        category: form.category,
        subcategory: form.subcategory || '',
        base_price: Number(form.base_price),
        description: taggedDesc,
        is_veg: form.is_veg,
        restaurant_id: restaurantId || null
      }]).select().single();
      menuErr = error;
      savedMenuId = insertedMenu?.id || null;
    }

    // Persist badge to dish badges storage
    if (savedMenuId && restaurantId) {
      try {
        const savedBadges = localStorage.getItem(`tabletapy_dish_badges_${restaurantId}`);
        const parsed = savedBadges ? JSON.parse(savedBadges) : {};
        if (form.badge) {
          parsed[savedMenuId] = form.badge;
        } else {
          delete parsed[savedMenuId];
        }
        localStorage.setItem(`tabletapy_dish_badges_${restaurantId}`, JSON.stringify(parsed));
      } catch {}
    }

    if (savedMenuId && restaurantId) {
      try {
        const savedIds = localStorage.getItem(`tabletapy_menu_${restaurantId}`);
        const list: string[] = savedIds ? JSON.parse(savedIds) : [];
        if (!list.includes(savedMenuId)) {
          list.push(savedMenuId);
          localStorage.setItem(`tabletapy_menu_${restaurantId}`, JSON.stringify(list));
        }
      } catch {}
    }

    if (menuErr) {
      alert("Error saving dish: " + menuErr.message);
      setIsSubmitting(false);
      return;
    }

    if (recipeIngredients.length > 0) {
      // Clear old usages if editing
      if (editingItemId) {
        await supabase.from('inventory_recipe_usage').delete().eq('name', form.name);
      }

      const usageInserts = recipeIngredients.map(ing => {
        const inv = inventory.find(i => i.id === ing.inventory_item_id);
        const conversion = inv && inv.vendorToStorage > 0 ? inv.vendorToStorage : 1;
        const rawCost = inv ? (inv.costPerVendorUnit / conversion) : 0;
        const yieldPct = inv && inv.yieldPercentage > 0 ? inv.yieldPercentage : 100;
        const usableCostPerStorage = rawCost / (yieldPct / 100);
        let costPerRecipeUnit = usableCostPerStorage;
        if (inv && inv.storageUnit === 'kg' && inv.recipeUnit === 'g') costPerRecipeUnit /= 1000;
        if (inv && inv.storageUnit === 'L' && inv.recipeUnit === 'ml') costPerRecipeUnit /= 1000;
        const totalIngredientCost = Number(ing.amount) * costPerRecipeUnit;

        return {
          name: form.name,
          inventory_item_id: ing.inventory_item_id,
          amount_per_order: Number(ing.amount),
          ingredient_cost_per_order: totalIngredientCost,
          times_ordered: 0,
          dish_price: Number(form.base_price) || 0,
          profit_impact: form.base_price && Number(form.base_price) > 0 ? `${((totalIngredientCost / Number(form.base_price)) * 100).toFixed(1)}%` : '0%'
        };
      });
      const { error: usageErr } = await supabase.from('inventory_recipe_usage').insert(usageInserts);
      if (usageErr) alert('Recipe save error: ' + usageErr.message);
    }

    await loadData();
    setForm(defaultForm);
    setVariantsConfig(getDefaultVariantsConfig(0));
    setEditingItemId(null);
    setRecipeIngredients([]);
    setIsAddingMode(false);
    setIsSubmitting(false);
  };

  // --- HIERARCHY LOGIC ---
  const filteredItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.category.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.subcategory?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedHierarchy = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = {};
    const sub = item.subcategory || 'EMPTY';
    if (!acc[item.category][sub]) acc[item.category][sub] = [];
    acc[item.category][sub].push(item);
    return acc;
  }, {} as Record<string, Record<string, MenuItem[]>>);

  const categoryOrder = ["Soups", "Quick Start", "Appetizers", "Main Course", "Breads", "Desserts", "Beverages"];
  const sortedCategories = Object.keys(groupedHierarchy).sort((a, b) => {
    const idxA = categoryOrder.indexOf(a); const idxB = categoryOrder.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1; if (idxB === -1) return -1;
    return idxA - idxB;
  });

  const IOSToggle = ({ active, onClick }: { active: boolean, onClick: (e: React.MouseEvent) => void }) => (
    <button onClick={onClick} className={`relative inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${active ? 'bg-[#34C759]' : 'bg-gray-200'}`}>
      <span className={`pointer-events-none inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${active ? 'translate-x-[16px]' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="flex h-screen flex-col bg-[#F9FAFB] overflow-hidden text-gray-900 font-sans relative">
      
      {/* CENTERED POPUP FOR ADDING NEW OFFERING */}
      {isAddingMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsAddingMode(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-[24px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
             
             {/* Modal Header (Back to Menu style) */}
             <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10 relative">
               <div className="flex items-center gap-3">
                 <button type="button" onClick={() => setIsAddingMode(false)} className="p-2 -ml-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full transition-colors flex items-center justify-center">
                   <ArrowLeft size={18} /> 
                 </button>
                 <div>
                   <h2 className="text-[17px] font-bold text-gray-900 tracking-tight leading-tight">Back to Menu</h2>
                   <p className="text-[12px] text-gray-500 font-medium">{editingItemId ? `Editing "${form.name || 'Dish'}"` : "Create a new offering"}</p>
                 </div>
               </div>
               
               <div className="flex items-center gap-2">
                  <button type="submit" form="menu-form" disabled={isSubmitting} className="px-5 py-2.5 bg-[#E46254] text-white text-[13px] font-medium rounded-xl hover:bg-[#D35546] disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm cursor-pointer">
                     {isSubmitting && <Loader2 size={14} className="animate-spin"/>} {editingItemId ? "Save Changes" : "Publish to Menu"}
                  </button>
               </div>
             </div>

             {/* Modal Body */}
             <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50/50">
                <form id="menu-form" onSubmit={handleSubmit} className="flex flex-col gap-8 bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm max-w-xl mx-auto">
                   
                   {/* General Info */}
                   <div className="flex flex-col gap-4">
                      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">General Information</h3>
                      
                      <div>
                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Item Title</label>
                        <input required type="text" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="e.g. Signature Truffle Risotto" className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50/50 rounded-xl text-[13px] font-medium focus:border-[#E46254] focus:bg-white outline-none transition-colors" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Primary Category</label>
                          <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50/50 rounded-xl text-[13px] font-medium focus:border-[#E46254] outline-none">
                            {categoryOrder.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          </div>
                        <div>
                          <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Sub-Category (Optional)</label>
                          <input type="text" value={form.subcategory} onChange={e=>setForm({...form, subcategory: e.target.value})} placeholder="e.g. Vegetarian" className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50/50 rounded-xl text-[13px] font-medium focus:border-[#E46254] focus:bg-white outline-none transition-colors" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Menu Description (Customer Facing)</label>
                        <textarea rows={2} value={form.description} onChange={e=>setForm({...form, description: e.target.value})} placeholder="Brief enticing description for the customer menu..." className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50/50 rounded-xl text-[13px] font-medium focus:border-[#E46254] focus:bg-white outline-none transition-colors resize-none" />
                      </div>
                   </div>

                   {/* Pricing, Portions & Quick Modifiers */}
                   <div className="flex flex-col gap-5">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                         <div>
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Pricing & Portions</h3>
                            <p className="text-[11.5px] text-gray-500 mt-0.5">Base price acts as the default Full portion.</p>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                        <div>
                          <label className="block text-[13px] font-medium text-gray-700 mb-1.5">
                            Retail Price / Full (₹) <span className="text-[#E46254]">*</span>
                          </label>
                          <input
                            required
                            type="number"
                            value={form.base_price}
                            onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                            placeholder="e.g. 320"
                            className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50/50 rounded-xl text-[13px] font-medium focus:border-[#E46254] focus:bg-white outline-none transition-colors font-mono"
                          />
                        </div>

                        {/* Veg / Non-Veg Selector */}
                        <div>
                          <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Dietary Type</label>
                          <div className="flex items-center gap-2 p-1 bg-gray-100/70 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, is_veg: true })}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                form.is_veg
                                  ? "bg-white text-emerald-700 shadow-2xs"
                                  : "text-gray-500 hover:text-gray-900"
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>Vegetarian</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, is_veg: false })}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                !form.is_veg
                                  ? "bg-white text-[#C2410C] shadow-2xs"
                                  : "text-gray-500 hover:text-gray-900"
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full bg-[#E46254]" />
                              <span>Non-Veg</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Dish Highlight Badge Selector */}
                      <div>
                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Dish Highlight Badge (Optional)</label>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { key: null, label: "None" },
                            { key: "BESTSELLER", label: "Bestseller", color: "text-amber-700 bg-amber-50 border-amber-300" },
                            { key: "CHEF_SIGNATURE", label: "Chef's Signature", color: "text-purple-700 bg-purple-50 border-purple-300" },
                            { key: "SPECIAL", label: "Special", color: "text-blue-700 bg-blue-50 border-blue-300" },
                            { key: "MUST_TRY", label: "Must Try", color: "text-rose-700 bg-rose-50 border-rose-300" }
                          ] as const).map((b) => (
                            <button
                              key={b.label}
                              type="button"
                              onClick={() => setForm({ ...form, badge: b.key as any })}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                form.badge === b.key
                                  ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* TOGGLE 1: PORTIONS / SIZES (HALF / FULL) */}
                      <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[13px] font-semibold text-gray-800 block">
                              Portion Sizes (e.g. Half / Full)
                            </span>
                            <span className="text-[11.5px] text-gray-500">
                              Offer portion sizes like Half, Full, Quarter, or Large.
                            </span>
                          </div>
                          <IOSToggle
                            active={variantsConfig.hasPortions}
                            onClick={(e) => {
                              e.preventDefault();
                              setVariantsConfig((prev) => ({
                                ...prev,
                                hasPortions: !prev.hasPortions,
                              }));
                            }}
                          />
                        </div>

                        {variantsConfig.hasPortions && (
                          <div className="space-y-2 pt-2 border-t border-gray-200/60 animate-in fade-in duration-200">
                            <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                              <div className="col-span-6">Portion Name</div>
                              <div className="col-span-5">Price (₹)</div>
                              <div className="col-span-1"></div>
                            </div>

                            {variantsConfig.portions.map((portion, idx) => {
                              const isFull = portion.name.toLowerCase() === "full";
                              return (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-6 relative">
                                    <input
                                      type="text"
                                      value={portion.name}
                                      disabled={isFull}
                                      onChange={(e) => {
                                        const next = [...variantsConfig.portions];
                                        next[idx].name = e.target.value;
                                        setVariantsConfig({ ...variantsConfig, portions: next });
                                      }}
                                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:border-[#E46254] disabled:bg-gray-100 disabled:text-gray-500"
                                      placeholder="e.g. Half"
                                    />
                                    {isFull && (
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-gray-400 uppercase bg-gray-200/60 px-1.5 py-0.5 rounded">
                                        Base
                                      </span>
                                    )}
                                  </div>

                                  <div className="col-span-5">
                                    <input
                                      type="number"
                                      value={isFull ? form.base_price : portion.price}
                                      disabled={isFull}
                                      onChange={(e) => {
                                        const next = [...variantsConfig.portions];
                                        next[idx].price = Number(e.target.value) || 0;
                                        setVariantsConfig({ ...variantsConfig, portions: next });
                                      }}
                                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-semibold text-gray-800 outline-none focus:border-[#E46254] disabled:bg-gray-100 disabled:text-gray-500"
                                      placeholder="0"
                                    />
                                  </div>

                                  <div className="col-span-1 flex justify-center">
                                    {!isFull && variantsConfig.portions.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setVariantsConfig({
                                            ...variantsConfig,
                                            portions: variantsConfig.portions.filter((_, i) => i !== idx),
                                          });
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => {
                                setVariantsConfig({
                                  ...variantsConfig,
                                  portions: [
                                    ...variantsConfig.portions,
                                    { name: "Quarter", price: Math.round(Number(form.base_price || 0) * 0.4), isDefault: false },
                                  ],
                                });
                              }}
                              className="text-[11.5px] font-semibold text-[#E46254] hover:text-[#C2410C] flex items-center gap-1 pt-1 cursor-pointer transition-colors"
                            >
                              <Plus size={13} /> + Add Another Size (e.g. Quarter, Large)
                            </button>
                          </div>
                        )}
                      </div>

                      {/* TOGGLE 2: ADD-ONS & EXTRAS */}
                      <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[13px] font-semibold text-gray-800 block">
                              Add-ons & Extras
                            </span>
                            <span className="text-[11.5px] text-gray-500">
                              Optional paid upgrades like Extra Butter, Extra Cheese, or Dip.
                            </span>
                          </div>
                          <IOSToggle
                            active={variantsConfig.hasAddons}
                            onClick={(e) => {
                              e.preventDefault();
                              setVariantsConfig((prev) => ({
                                ...prev,
                                hasAddons: !prev.hasAddons,
                              }));
                            }}
                          />
                        </div>

                        {variantsConfig.hasAddons && (
                          <div className="space-y-2 pt-2 border-t border-gray-200/60 animate-in fade-in duration-200">
                            <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                              <div className="col-span-7">Add-on Name</div>
                              <div className="col-span-4">Extra Price (₹)</div>
                              <div className="col-span-1"></div>
                            </div>

                            {variantsConfig.addons.map((addon, idx) => (
                              <div key={addon.id || idx} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-7">
                                  <input
                                    type="text"
                                    value={addon.name}
                                    onChange={(e) => {
                                      const next = [...variantsConfig.addons];
                                      next[idx].name = e.target.value;
                                      setVariantsConfig({ ...variantsConfig, addons: next });
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:border-[#E46254]"
                                    placeholder="e.g. Extra Butter"
                                  />
                                </div>
                                <div className="col-span-4">
                                  <input
                                    type="number"
                                    value={addon.price || ""}
                                    onChange={(e) => {
                                      const next = [...variantsConfig.addons];
                                      next[idx].price = Number(e.target.value) || 0;
                                      setVariantsConfig({ ...variantsConfig, addons: next });
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-semibold text-gray-800 outline-none focus:border-[#E46254]"
                                    placeholder="0"
                                  />
                                </div>
                                <div className="col-span-1 flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVariantsConfig({
                                        ...variantsConfig,
                                        addons: variantsConfig.addons.filter((_, i) => i !== idx),
                                      });
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => {
                                setVariantsConfig({
                                  ...variantsConfig,
                                  addons: [
                                    ...variantsConfig.addons,
                                    { id: `addon_${Date.now()}`, name: "", price: 20 },
                                  ],
                                });
                              }}
                              className="text-[11.5px] font-semibold text-[#E46254] hover:text-[#C2410C] flex items-center gap-1 pt-1 cursor-pointer transition-colors"
                            >
                              <Plus size={13} /> + Add Another Add-on
                            </button>
                          </div>
                        )}
                      </div>

                      {/* TOGGLE 3: QUICK KITCHEN PREP TAGS */}
                      <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-4 space-y-3">
                        <div>
                          <span className="text-[13px] font-semibold text-gray-800 block">
                            Quick Prep Tags (1-Tap Chef Notes)
                          </span>
                          <span className="text-[11.5px] text-gray-500">
                            Pre-configured tags available to staff so they don't have to type.
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {COMMON_PREP_TAGS.map((tag) => {
                            const isSelected = variantsConfig.prepTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  setVariantsConfig((prev) => ({
                                    ...prev,
                                    prepTags: isSelected
                                      ? prev.prepTags.filter((t) => t !== tag)
                                      : [...prev.prepTags, tag],
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                {isSelected && <span className="mr-1">✓</span>}
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                   </div>

                   {/* Recipe Builder */}
                   <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                         <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Recipe & Cost Economics</h3>
                         {recipeIngredients.length > 0 && (
                           <span className="text-[12px] font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-md">Total Cost: {formatCurrency(recipeIngredients.reduce((s, r) => s + (Number(r.amount) * (r.cost||0)), 0), true)}</span>
                         )}
                      </div>

                      <div className="bg-gray-50/50 rounded-2xl border border-gray-200/60 p-5">
                          <div className="relative mb-4 group font-satoshi">
                            <select defaultValue="" onChange={(e) => { handleAddIngredientToRecipe(e.target.value); e.target.value = ''; }} className="w-full px-4 py-3 border-2 border-gray-100 hover:border-[#E46254]/30 bg-white rounded-2xl text-[14px] font-medium text-gray-700 focus:border-[#E46254] focus:ring-4 focus:ring-[#E46254]/10 outline-none transition-all cursor-pointer appearance-none shadow-sm">
                                <option value="" disabled hidden>Search or add material...</option>
                                <option value="NEW_MATERIAL" className="font-bold text-[#E46254] py-2">✨ Create New Material...</option>
                                {inventory.map(inv => {
                                  const conversionFactor = inv.vendorToStorage && inv.vendorToStorage > 0 ? inv.vendorToStorage : 1;
                                  let costPerRecipeUnit = inv.costPerVendorUnit / conversionFactor;
                                  if (inv.storageUnit === 'kg' && inv.recipeUnit === 'g') costPerRecipeUnit /= 1000;
                                  if (inv.storageUnit === 'L' && inv.recipeUnit === 'ml') costPerRecipeUnit /= 1000;
                                  return (
                                    <option key={inv.id} value={inv.id} className="py-2 text-gray-700">
                                      {inv.name} • {formatCurrency(costPerRecipeUnit, true)} / {inv.recipeUnit}
                                    </option>
                                  );
                                })}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-[#E46254] transition-colors">
                              <Plus size={18} />
                            </div>
                          </div>

                          {recipeIngredients.length > 0 ? (
                           <div className="flex flex-col gap-2.5">
                             {recipeIngredients.map((ing, idx) => (
                               <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                                 <span className="text-[13px] font-semibold text-gray-900 flex-1 truncate">{ing.name}</span>
                                 <div className="flex items-center gap-2">
                                   <input type="number" step="0.01" value={ing.amount} onChange={(e) => {
                                      const newArr = [...recipeIngredients]; newArr[idx].amount = e.target.value; setRecipeIngredients(newArr);
                                   }} className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-[13px] font-medium outline-none focus:border-[#E46254]" />
                                   <span className="text-[12px] font-medium text-gray-500 w-8">{inventory.find(i => i.id === ing.inventory_item_id)?.recipeUnit}</span>
                                 </div>
                                 <span className="text-[13px] font-semibold text-gray-900 w-16 text-right tabular-nums">{formatCurrency(Number(ing.amount) * (ing.cost || 0), true)}</span>
                                 <button type="button" onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 p-1 ml-1 transition-colors"><X size={14}/></button>
                               </div>
                             ))}
                           </div>
                         ) : (
                           <div className="text-center py-6 px-4 border border-dashed border-gray-200 rounded-xl bg-white">
                             <span className="text-[13px] text-gray-500 font-medium">No materials added. Select from the dropdown to start building the recipe and calculating margins.</span>
                           </div>
                         )}
                      </div>
                   </div>
                </form>
             </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 md:px-12 w-full pb-20">
        
        {/* TOP HEADER */}
        <div className="sticky top-0 z-20 pt-8 pb-4 bg-[#F9FAFB]/95 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-200/60">
          <div className="flex items-end gap-3 w-full">
             <h1 className="text-[24px] font-bold text-gray-900 tracking-tight">Menu Availability</h1>
             <span className="text-[12px] text-gray-500 mb-1.5 font-medium">Toggle item availability</span>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#E46254] transition-colors" size={16} />
              <input 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search dishes..."
                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-[13px] font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#E46254] transition-all shadow-sm"
              />
            </div>
            <button onClick={handleOpenCreateModal} className="shrink-0 bg-[#E46254] hover:bg-[#D35546] text-white px-4 py-2 rounded-xl transition-all font-medium text-[13px] tracking-tight flex items-center justify-center gap-2 shadow-sm cursor-pointer">
              <Plus size={16} /> New Offering
            </button>
          </div>
        </div>

        {/* EMPTY STATE */}
        {!isLoading && sortedCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <span className="text-[32px] opacity-50 filter grayscale">🍽️</span>
            </div>
            <h3 className="text-[18px] font-bold text-gray-900 mb-2">No menu offerings found</h3>
            <p className="text-[14px] text-gray-500 max-w-sm mb-6">Your menu is currently empty or no dishes match your search query.</p>
            <button onClick={handleOpenCreateModal} className="bg-[#E46254] text-white px-5 py-2.5 rounded-xl font-medium text-[13px] shadow-sm hover:bg-[#D35546] transition-colors cursor-pointer">
              Create your first offering
            </button>
          </div>
        )}

        {/* MENU LIST */}
        <div className="flex flex-col gap-8 mt-6">
          {sortedCategories.map(category => {
            const subCategories = groupedHierarchy[category];
            const allItemsInCategory = Object.values(subCategories).flat();
            const isCatAvailable = allItemsInCategory.some(i => i.is_available);
            
            return (
              <div key={category} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-[17px] font-semibold text-gray-900 tracking-tight">{category}</h2>
                  <IOSToggle active={isCatAvailable} onClick={() => toggleCategoryAvailability(allItemsInCategory)} />
                </div>

                <div className="flex flex-col gap-5">
                  {Object.keys(subCategories).map(subcat => {
                    const items = subCategories[subcat];
                    const isSubAvailable = items.some(i => i.is_available);
                    const showSubcatHeader = subcat && subcat !== 'General' && subcat !== 'EMPTY';
                    
                    return (
                      <div key={subcat} className="flex flex-col gap-3">
                         {showSubcatHeader && (
                           <div className="flex items-center gap-3 pl-1">
                              <h3 className="text-[13px] font-medium text-gray-600">{subcat}</h3>
                              <IOSToggle active={isSubAvailable} onClick={() => toggleCategoryAvailability(items)} />
                           </div>
                         )}
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5">
                           {items.map(item => {
                             let cost = 0;
                             item.recipeUsages?.forEach(r => cost += r.ingredient_cost_per_order);
                             const marginVal = item.base_price > 0 ? ((item.base_price - cost) / item.base_price) * 100 : 0;
                             
                             return (
                               <div key={item.id} onClick={() => setSelectedItem(item)} className={`cursor-pointer flex items-center p-3.5 bg-white rounded-2xl transition-all duration-300 ${item.is_available ? 'shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-200/60 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5' : 'border border-gray-200/40 opacity-60 hover:opacity-100'}`}>
                                  <div className="shrink-0 mr-4 flex items-center justify-center">
                                     <span className="text-[32px] drop-shadow-sm filter">🍽️</span>
                                  </div>
                                  <div className="flex flex-col flex-1">
                                     <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[14px] font-semibold text-gray-900 tracking-tight">{item.name}</span>
                                        {item.badge && (
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            item.badge === 'BESTSELLER' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                            item.badge === 'CHEF_SIGNATURE' ? 'bg-purple-50 text-purple-700 border-purple-300' :
                                            item.badge === 'SPECIAL' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                            'bg-rose-50 text-rose-700 border-rose-300'
                                          }`}>
                                            {item.badge.replace('_', ' ')}
                                          </span>
                                        )}
                                        <span className="text-[14px] font-semibold text-gray-600">- {formatCurrency(item.base_price)}</span>
                                     </div>
                                     {item.recipeUsages && item.recipeUsages.length > 0 ? (
                                       <span className="text-[12px] font-medium text-gray-400 mt-0.5">Linked to {item.recipeUsages.length} ingredients</span>
                                     ) : (
                                       <span className="text-[12px] font-medium text-amber-500/80 mt-0.5">No Recipe Linked</span>
                                     )}
                                     <div className="flex items-center gap-1.5 mt-1.5">
                                        <span className="text-[12px] font-medium text-gray-500">Status:</span>
                                        <span className={`text-[12px] font-semibold ${item.is_available ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>{item.is_available ? 'Available' : 'Unavailable'}</span>
                                     </div>
                                     <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[11px] font-medium text-gray-400">Margin: {marginVal.toFixed(1)}%</span>
                                        <span className="text-[11px] font-medium text-gray-400">Cost: {formatCurrency(cost, true)}</span>
                                     </div>
                                  </div>
                                  <div className="shrink-0 pl-2">
                                     <IOSToggle active={item.is_available} onClick={(e) => toggleAvailability(item, e)} />
                                  </div>
                               </div>
                             );
                           })}
                         </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* ANIMATED INFO POPUP WITH EDIT/DELETE UX */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedItem(null)} />
            <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-bottom-8 duration-300">
               
               <div className="relative h-32 bg-gradient-to-b from-gray-50 to-white flex items-center justify-center border-b border-gray-100">
                  <span className="text-[72px] drop-shadow-md animate-in zoom-in duration-500 delay-100">🍽️</span>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(selectedItem.id);
                        setForm({
                          name: selectedItem.name,
                          category: selectedItem.category,
                          subcategory: selectedItem.subcategory || '',
                          base_price: selectedItem.base_price.toString(),
                          description: selectedItem.description || '',
                          is_veg: selectedItem.is_veg,
                          badge: selectedItem.badge || null,
                        });
                        setVariantsConfig(selectedItem.variantsConfig || getDefaultVariantsConfig(selectedItem.base_price));
                        setRecipeIngredients(
                          selectedItem.recipeUsages?.map((u) => ({
                            inventory_item_id: u.inventory_item_id,
                            amount: u.amount_per_order.toString(),
                            name: u.inventory_name,
                            cost: u.ingredient_cost_per_order / (u.amount_per_order || 1),
                          })) || []
                        );
                        setIsAddingMode(true);
                        setSelectedItem(null);
                      }}
                      className="p-2 bg-white/80 hover:bg-white text-gray-500 hover:text-[#E46254] rounded-full shadow-sm transition-all cursor-pointer"
                      title="Edit Dish"
                    >
                      <Edit2 size={16}/>
                    </button>
                    <button onClick={() => setSelectedItem(null)} className="p-2 bg-white/80 hover:bg-white text-gray-500 hover:text-gray-900 rounded-full shadow-sm transition-all cursor-pointer">
                      <X size={16}/>
                    </button>
                  </div>
               </div>
               
               <div className="p-7">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                       <h2 className="text-[22px] font-bold text-gray-900 tracking-tight leading-tight">{selectedItem.name}</h2>
                       <p className="text-[13px] text-gray-500 font-medium mt-1">
                         {selectedItem.category} {selectedItem.subcategory && selectedItem.subcategory !== 'General' && selectedItem.subcategory !== 'EMPTY' ? ` • ${selectedItem.subcategory}` : ''}
                       </p>
                     </div>
                     <span className="text-[22px] font-bold text-gray-900 tabular-nums">{formatCurrency(selectedItem.base_price)}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-6">
                     <div className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${selectedItem.is_available ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {selectedItem.is_available ? 'Active on Menu' : '86\'d (Unavailable)'}
                     </div>
                     <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 ${selectedItem.is_veg ? 'bg-emerald-50 text-emerald-700' : 'bg-[#E46254]/10 text-[#C2410C]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedItem.is_veg ? 'bg-emerald-500' : 'bg-[#E46254]'}`} />
                        <span>{selectedItem.is_veg ? 'Veg' : 'Non-Veg'}</span>
                     </div>
                  </div>

                  {/* Portions breakdown if present */}
                  {selectedItem.variantsConfig?.hasPortions && (
                    <div className="mb-5 bg-gray-50 rounded-2xl border border-gray-100 p-4">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2.5">
                        Available Portions
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.variantsConfig.portions.map((p, idx) => (
                          <div key={idx} className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-800 flex items-center gap-2 shadow-2xs">
                            <span>{p.name}</span>
                            <span className="font-mono text-[#E46254]">₹{p.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add-ons breakdown if present */}
                  {selectedItem.variantsConfig?.hasAddons && selectedItem.variantsConfig.addons.length > 0 && (
                    <div className="mb-5 bg-gray-50 rounded-2xl border border-gray-100 p-4">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2.5">
                        Add-ons & Extras
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.variantsConfig.addons.map((a, idx) => (
                          <div key={idx} className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 flex items-center gap-2 shadow-2xs">
                            <span>{a.name}</span>
                            <span className="font-mono text-emerald-600 font-semibold">+₹{a.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prep tags if present */}
                  {selectedItem.variantsConfig?.prepTags && selectedItem.variantsConfig.prepTags.length > 0 && (
                    <div className="mb-5">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                        Quick Kitchen Prep Notes
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedItem.variantsConfig.prepTags.map((tag, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div>
                     <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Recipe & Economics</h3>
                     {selectedItem.recipeUsages && selectedItem.recipeUsages.length > 0 ? (
                       <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                         <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
                            <span className="text-[13px] font-semibold text-gray-600">Total Ingredient Cost</span>
                            <span className="text-[15px] font-bold text-gray-900 tabular-nums">
                               {formatCurrency(selectedItem.recipeUsages.reduce((sum, r) => sum + r.ingredient_cost_per_order, 0), true)}
                            </span>
                         </div>
                         <div className="space-y-2.5">
                            {selectedItem.recipeUsages.map((usage, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[13px]">
                                 <span className="text-gray-600 font-medium">{usage.amount_per_order}x <span className="text-gray-900">{usage.inventory_name || 'Ingredient'}</span></span>
                                 <span className="text-gray-900 font-semibold tabular-nums">{formatCurrency(usage.ingredient_cost_per_order, true)}</span>
                              </div>
                            ))}
                         </div>
                       </div>
                     ) : (
                       <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
                         <p className="text-[13px] font-medium text-amber-700">No recipe linked. Edit this dish to add raw materials and track margins.</p>
                       </div>
                     )}
                  </div>

                  <div className="mt-8 pt-4 border-t border-gray-100 flex justify-center">
                     <button
                       type="button"
                       onClick={async () => {
                         if (!confirm(`Are you sure you want to delete "${selectedItem.name}" from the menu?`)) return;
                         try {
                           await supabase.from('menu_items_v2').delete().eq('id', selectedItem.id);
                           setSelectedItem(null);
                           await loadData();
                         } catch (err: any) {
                           alert("Failed to delete dish: " + err.message);
                         }
                       }}
                       className="text-[13px] font-semibold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                     >
                       <Trash2 size={14}/> Delete Dish from Menu
                     </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      
      {/* Quick Add Material Modal */}
      {isQuickAddMaterial && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-800 text-[14px]">Create Cost-Ready Material</h3>
              <button type="button" onClick={() => setIsQuickAddMaterial(false)} className="text-gray-400 hover:text-gray-600 p-1 transition-colors"><X size={16} /></button>
            </div>
            
            <form className="p-5 flex flex-col gap-5">
              {/* Identity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Material Name <span className="text-[#E46254]">*</span></label>
                  <input type="text" autoFocus value={quickMaterial.name || ''} onChange={e => setQuickMaterial({...quickMaterial, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none transition-all" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Category <span className="text-[#E46254]">*</span></label>
                  <select value={quickMaterial.category || 'Meat & Poultry'} onChange={e => setQuickMaterial({...quickMaterial, category: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none bg-white cursor-pointer transition-all">
                    <option>Meat & Poultry</option><option>Seafood</option><option>Dairy & Eggs</option><option>Vegetables & Produce</option><option>Dry Goods</option>
                  </select>
                </div>
              </div>

              {/* Costing */}
              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Purchase Unit <span className="text-[#E46254]">*</span></label>
                  <input type="text" placeholder="e.g. carton" value={quickMaterial.vendorUnit || ''} onChange={e => {
                    const isSame = e.target.value.toLowerCase() === (quickMaterial.storageUnit || '').toLowerCase();
                    setQuickMaterial({...quickMaterial, vendorUnit: e.target.value, vendorToStorage: isSame ? '1' : quickMaterial.vendorToStorage});
                  }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Base Stock Unit <span className="text-[#E46254]">*</span></label>
                  <select value={quickMaterial.storageUnit || 'kg'} onChange={e => {
                    const isSame = e.target.value.toLowerCase() === (quickMaterial.vendorUnit || '').toLowerCase();
                    setQuickMaterial({...quickMaterial, storageUnit: e.target.value, vendorToStorage: isSame ? '1' : quickMaterial.vendorToStorage});
                  }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none bg-white cursor-pointer transition-all">
                    <option value="kg">Kilograms (kg)</option><option value="g">Grams (g)</option><option value="L">Liters (L)</option><option value="ml">Milliliters (ml)</option><option value="pcs">Pieces (pcs)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Purchase Price <span className="text-[#E46254]">*</span></label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-gray-500 font-medium text-[12px]">₹</span>
                    <input type="number" step="any" min="0" value={quickMaterial.costPerVendorUnit || ''} onChange={e => setQuickMaterial({...quickMaterial, costPerVendorUnit: e.target.value})} className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-lg text-[13px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none transition-all" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Prep Loss % <span className="text-[#E46254]">*</span></label>
                  <div className="relative">
                    <input type="number" step="any" min="0" max="99" value={quickMaterial.prepLoss || '0'} onChange={e => setQuickMaterial({...quickMaterial, prepLoss: e.target.value})} className="w-full pl-3 pr-6 py-2 border border-gray-200 rounded-lg text-[13px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none transition-all" />
                    <span className="absolute right-2.5 top-2 text-gray-400 font-bold text-[12px]">%</span>
                  </div>
                </div>
                
                <div className="col-span-2 bg-red-50/50 p-3 rounded-lg border border-red-100 mt-1">
                   <div className="flex items-center justify-between">
                     <span className="font-semibold text-gray-700 text-[12px]">Conversion:</span>
                     <div className="flex items-center gap-2">
                       <span className="font-semibold text-gray-700 text-[12px]">1 {quickMaterial.vendorUnit || '[Unit]'} =</span>
                       <input type="number" step="any" min="0.001" value={quickMaterial.vendorToStorage || ''} onChange={e => setQuickMaterial({...quickMaterial, vendorToStorage: e.target.value})} className="w-16 text-center text-[13px] border-b-2 border-gray-300 px-1 py-0.5 focus:border-[#E46254] font-bold focus:outline-none bg-transparent" />
                       <span className="font-semibold text-[#E46254] text-[12px]">{quickMaterial.storageUnit}</span>
                     </div>
                   </div>
                </div>
              </div>
              
              {(() => {
                  const lossPct = parseFloat(quickMaterial.prepLoss) || 0;
                  const yieldPct = Math.max(0.1, 100 - lossPct);
                  const conversion = parseFloat(quickMaterial.vendorToStorage) || 0;
                  const price = parseFloat(quickMaterial.costPerVendorUnit) || 0;
                  const rawCost = conversion > 0 ? price / conversion : 0;
                  const usableCost = yieldPct > 0 ? rawCost / (yieldPct / 100) : 0;
                  
                  if (price > 0 && conversion > 0) {
                      return (
                          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                             <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Raw Cost</p>
                                <p className="text-[12px] font-semibold text-gray-600">₹{rawCost.toFixed(2)} / {quickMaterial.storageUnit}</p>
                             </div>
                             <div className="h-6 w-px bg-gray-200"></div>
                             <div className="text-right">
                                <p className="text-[10px] font-bold text-[#E46254] uppercase tracking-widest mb-0.5">True Usable Cost</p>
                                <p className="text-[14px] font-bold text-gray-900">₹{usableCost.toFixed(2)} <span className="text-[11px] text-gray-500 font-medium normal-case">/ {quickMaterial.storageUnit}</span></p>
                             </div>
                          </div>
                      );
                  }
                  return null;
              })()}

              {/* Optional */}
              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Opening Stock (Opt)</label>
                  <div className="relative">
                    <input type="number" step="any" min="0" value={quickMaterial.stock || ''} onChange={e => setQuickMaterial({...quickMaterial, stock: e.target.value})} placeholder="0" className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg text-[13px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none transition-all" />
                    <span className="absolute right-3 top-2 text-[11px] text-gray-400 font-bold">{quickMaterial.storageUnit}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1">Low Alert (Opt)</label>
                  <div className="relative">
                    <input type="number" step="any" min="0" value={quickMaterial.threshold || ''} onChange={e => setQuickMaterial({...quickMaterial, threshold: e.target.value})} placeholder="0" className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg text-[13px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none transition-all" />
                    <span className="absolute right-3 top-2 text-[11px] text-gray-400 font-bold">{quickMaterial.storageUnit}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-gray-100 sticky bottom-0 bg-white z-10">
                <button type="button" onClick={() => setIsQuickAddMaterial(false)} className="px-4 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button type="button" onClick={() => { handleQuickSaveMaterial(); }} disabled={isQuickSaving || !quickMaterial.name || !quickMaterial.costPerVendorUnit || !quickMaterial.vendorToStorage} className="px-5 py-2 bg-[#E46254] text-white text-[12px] font-semibold rounded-lg hover:bg-[#D35546] disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm shadow-[#E46254]/20">
                  {isQuickSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Save & Use in Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}
