"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, ArrowLeft, Loader2, X, Edit2, Trash2, ChefHat } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  recipeUsages?: any[];
}

export default function MenuManagerPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const defaultForm = { name: '', category: 'Main Course', subcategory: '', base_price: '', description: '', is_veg: true };
  const [form, setForm] = useState(defaultForm);
  const [recipeIngredients, setRecipeIngredients] = useState<{ inventory_item_id: string; amount: string; name?: string; cost?: number }[]>([]);

  // Quick Add Material State
  const [isQuickAddMaterial, setIsQuickAddMaterial] = useState(false);
  const [quickMaterial, setQuickMaterial] = useState({ name: '', category: 'Meat & Poultry', vendorUnit: 'carton', storageUnit: 'kg', costPerVendorUnit: '', vendorToStorage: '', prepLoss: '0', stock: '', threshold: '' });
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    // Load Inventory for recipe builder
    const { data: invData } = await supabase.from('inventory_items').select('*').order('name');
    if (invData) {
      setInventory(invData.map((row: any) => ({
        id: row.id, name: row.name, stock: Number(row.stock), recipeUnit: row.recipe_unit, costPerVendorUnit: Number(row.cost_per_vendor_unit), vendorToStorage: Number(row.vendor_to_storage), storageUnit: row.storage_unit, yieldPercentage: Number(row.yield_percentage || 100)
      })));
    }
    
    // Load Menu Items
    const { data: menuData } = await supabase.from('menu_items_v2').select('*').order('created_at', { ascending: false });
    if (menuData) {
       // Manual join to avoid strict foreign key errors if schema isn't perfect
       const { data: usages } = await supabase.from('inventory_recipe_usage').select('*');
       
       setMenuItems(menuData.map((row: any) => {
         const itemUsages = usages?.filter(u => u.name === row.name) || [];
         // Attach ingredient names manually if FK is missing
         const enrichedUsages = itemUsages.map(u => {
           const invMatch = invData?.find(inv => inv.id === u.inventory_item_id);
           return { ...u, inventory_name: invMatch?.name || 'Unknown Ingredient' };
         });

         return {
           id: row.id, name: row.name, category: row.category, subcategory: row.subcategory || '', base_price: Number(row.base_price), description: row.description, is_veg: row.is_veg, is_available: row.is_available !== false, recipeUsages: enrichedUsages
         };
       }));
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
    
    const { data: insertedMenu, error: menuErr } = await supabase.from('menu_items_v2').insert([{
      name: form.name,
      category: form.category,
      base_price: Number(form.base_price),
      description: form.description,
      is_veg: form.is_veg
    }]).select().single();

    if (menuErr) {
      alert("Error saving dish: " + menuErr.message);
      setIsSubmitting(false);
      return;
    }

    if (recipeIngredients.length > 0) {
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
                   <p className="text-[12px] text-gray-500 font-medium">Create a new offering</p>
                 </div>
               </div>
               
               <div className="flex items-center gap-2">
                  <button type="submit" form="menu-form" disabled={isSubmitting} className="px-5 py-2.5 bg-[#E46254] text-white text-[13px] font-medium rounded-xl hover:bg-[#D35546] disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm">
                     {isSubmitting && <Loader2 size={14} className="animate-spin"/>} Publish to Menu
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

                   {/* Pricing */}
                   <div className="flex flex-col gap-4">
                      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Pricing Structure</h3>
                      
                      <div className="w-1/2">
                        <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Retail Price (₹)</label>
                        <input required type="number" value={form.base_price} onChange={e=>setForm({...form, base_price: e.target.value})} placeholder="0.00" className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50/50 rounded-xl text-[13px] font-medium focus:border-[#E46254] focus:bg-white outline-none transition-colors" />
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
            <button onClick={() => setIsAddingMode(true)} className="shrink-0 bg-[#E46254] hover:bg-[#D35546] text-white px-4 py-2 rounded-xl transition-all font-medium text-[13px] tracking-tight flex items-center justify-center gap-2 shadow-sm">
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
            <button onClick={() => setIsAddingMode(true)} className="bg-[#E46254] text-white px-5 py-2.5 rounded-xl font-medium text-[13px] shadow-sm hover:bg-[#D35546] transition-colors">
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
                                     <div className="flex items-center gap-1.5">
                                        <span className="text-[14px] font-semibold text-gray-900 tracking-tight">{item.name}</span>
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
                    <button className="p-2 bg-white/80 hover:bg-white text-gray-500 hover:text-[#E46254] rounded-full shadow-sm transition-all">
                      <Edit2 size={16}/>
                    </button>
                    <button onClick={() => setSelectedItem(null)} className="p-2 bg-white/80 hover:bg-white text-gray-500 hover:text-gray-900 rounded-full shadow-sm transition-all">
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
                  </div>
                  
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
                     <button className="text-[13px] font-semibold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors">
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
