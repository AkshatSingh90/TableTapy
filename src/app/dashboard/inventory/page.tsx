  "use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, ChevronDown, ChevronRight, Activity, ChefHat, ArrowLeft, Calendar, Download, ArrowUpRight, ArrowDownRight, RefreshCw, FileText, TrendingUp, TrendingDown, Clock, ArrowRight, ShoppingCart, Loader2, AlertCircle, CheckCircle2, Layers, ShieldCheck, PackagePlus, Trash2, Sliders, X, Check } from 'lucide-react';
import { Sparkles, Box } from 'lucide-react';
import IntelligenceDashboard from './IntelligenceDashboard';
import { supabase } from "@/lib/supabase";

// --- DATA MODEL ---
interface StockLog {
  id: string;
  date: string;
  type: 'POS_DEDUCTION' | 'DELIVERY' | 'WASTE' | 'MANUAL_COUNT';
  amount: number;
  note?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;         
  threshold: number;     
  vendorUnit: string;
    storageUnit: string;
    yieldPercentage: number;
    isSemiFinished: boolean;
    expiryDate: string;   
  
  // Cost & Purchasing
  costPerVendorUnit: number;
  priceLastMonth: number; 
  lastOrderedDate: string;
  nextOrderDate: string;

  // Core Metrics
  dailyBurnRate: number;     
  estimatedDaysLeft: number; 
  vendorToStorage: number;
  recipeUnit: string;
  
  // Audit
  lastCountedAt: string;     
  posExpected: number;
  actualCounted: number;
  
  // Detailed Menu Impact
  usedInRecipes: { 
    name: string; 
    amountPerOrder: number; 
    timesOrdered: number;
    ingredientCostPerOrder: number;
    dishPrice: number;
    profitImpact: string; 
  }[];
  ledger: StockLog[];
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMasterProfile, setSelectedMasterProfile] = useState<InventoryItem | null>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('Intelligence');

  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Stock Adjustment Modal State
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<'DELIVERY' | 'WASTE' | 'MANUAL_COUNT'>('DELIVERY');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Form State
  const [newMaterial, setNewMaterial] = useState({
    name: '', category: 'Meat & Poultry', stock: '', threshold: '',
    storageUnit: 'kg', vendorUnit: 'carton', vendorToStorage: '20', costPerVendorUnit: '4800', prepLoss: '10',
    expiryDate: '', isSemiFinished: false
  });

  // Fetch Inventory from Supabase
  const fetchInventory = async () => {
    setIsLoadingData(true);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, ledger:inventory_ledgers(*), usedInRecipes:inventory_recipe_usage(*)');

    if (error) {
      console.error("Error fetching inventory:", error);
    } else if (data) {
      const mapped: InventoryItem[] = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        stock: Number(row.stock),
        threshold: Number(row.threshold),
        vendorUnit: row.vendor_unit,
        storageUnit: row.storage_unit,
        yieldPercentage: Number(row.yield_percentage || 100),
        isSemiFinished: Boolean(row.is_semi_finished),
        expiryDate: row.expiry_date || '',
        costPerVendorUnit: Number(row.cost_per_vendor_unit),
        priceLastMonth: Number(row.price_last_month),
        lastOrderedDate: row.last_ordered_date || 'Today',
        nextOrderDate: row.next_order_date || 'Not Scheduled',
        dailyBurnRate: Number(row.daily_burn_rate),
        estimatedDaysLeft: Number(row.estimated_days_left),
        vendorToStorage: Number(row.vendor_to_storage),
        recipeUnit: row.recipe_unit,
        lastCountedAt: row.last_counted_at || 'Just Now',
        posExpected: Number(row.pos_expected),
        actualCounted: Number(row.actual_counted),
        usedInRecipes: (row.usedInRecipes || []).map((r: any) => ({
          name: r.name,
          amountPerOrder: Number(r.amount_per_order),
          timesOrdered: Number(r.times_ordered),
          ingredientCostPerOrder: Number(r.ingredient_cost_per_order),
          dishPrice: Number(r.dish_price),
          profitImpact: r.profit_impact
        })),
        ledger: (row.ledger || []).map((l: any) => ({
          id: l.id,
          date: l.date,
          type: l.type as any,
          amount: Number(l.amount),
          note: l.note
        }))
      }));
      setItems(mapped);
      
      // Update selected profile if it's currently open
      if (selectedMasterProfile) {
        const updatedProfile = mapped.find(i => i.id === selectedMasterProfile.id);
        if (updatedProfile) setSelectedMasterProfile(updatedProfile);
      }
    }
    setIsLoadingData(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const lowStockCount = items.filter(i => i.threshold != null && i.stock <= i.threshold).length;

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLowStock = filterLowStockOnly ? (item.threshold != null && item.stock <= item.threshold) : true;
    return matchesSearch && matchesLowStock;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    const qty = parseFloat(adjustAmount);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    setIsAdjusting(true);
    let newStock = adjustingItem.stock;
    let ledgerAmount = 0;
    let defaultNote = '';

    if (adjustType === 'DELIVERY') {
      newStock = adjustingItem.stock + qty;
      ledgerAmount = qty;
      defaultNote = `Stock Received / Delivery (+${qty} ${adjustingItem.storageUnit})`;
    } else if (adjustType === 'WASTE') {
      newStock = adjustingItem.stock - qty;
      ledgerAmount = -qty;
      defaultNote = `Waste / Spoilage Logged (-${qty} ${adjustingItem.storageUnit})`;
    } else if (adjustType === 'MANUAL_COUNT') {
      const difference = qty - adjustingItem.stock;
      newStock = qty;
      ledgerAmount = difference;
      defaultNote = `Physical Count Adjustment (${adjustingItem.stock} → ${qty} ${adjustingItem.storageUnit})`;
    }

    // 1. Update inventory_items stock
    const { error: stockErr } = await supabase
      .from('inventory_items')
      .update({ 
        stock: newStock,
        last_counted_at: new Date().toISOString()
      })
      .eq('id', adjustingItem.id);

    if (stockErr) {
      alert("Failed to update stock: " + stockErr.message);
      setIsAdjusting(false);
      return;
    }

    // 2. Insert into inventory_ledgers
    const { error: ledgerErr } = await supabase
      .from('inventory_ledgers')
      .insert([{
        inventory_item_id: adjustingItem.id,
        date: new Date().toISOString().split('T')[0],
        type: adjustType,
        amount: ledgerAmount,
        note: adjustNote.trim() || defaultNote
      }]);

    if (ledgerErr) {
      console.error("Ledger error:", ledgerErr);
    }

    // Reset and reload
    setIsAdjusting(false);
    setAdjustingItem(null);
    setAdjustAmount('');
    setAdjustNote('');
    await fetchInventory();
  };

  const handleExportCSV = () => {
    if (!selectedMasterProfile) return;
    const headers = ["Date", "Type", "Amount", "Unit", "Note"];
    const rows = (selectedMasterProfile.ledger || []).map(l => [
      l.date,
      l.type,
      l.amount,
      selectedMasterProfile.storageUnit,
      `"${(l.note || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedMasterProfile.name.toLowerCase().replace(/\\s+/g, '_')}_ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const trimmedName = newMaterial.name.trim();
    if (!trimmedName) {
       alert("Item name is required.");
       setIsSubmitting(false);
       return;
    }
    
    const conversion = parseFloat(newMaterial.vendorToStorage) || 0;
    if (conversion <= 0) {
      alert("Conversion factor must be greater than 0.");
      setIsSubmitting(false);
      return;
    }
    
    const lossPct = parseFloat(newMaterial.prepLoss) || 0;
    const yieldPct = 100 - lossPct;
    if (lossPct < 0 || lossPct >= 100) {
      alert("Preparation loss must be between 0 and 99.");
      setIsSubmitting(false);
      return;
    }

    const price = parseFloat(newMaterial.costPerVendorUnit) || 0;
    if (price < 0) {
      alert("Purchase price cannot be negative.");
      setIsSubmitting(false);
      return;
    }

    const stockNum = parseFloat(newMaterial.stock) || 0;
    const threshNum = parseFloat(newMaterial.threshold);
    
    const { data: itemData, error: itemError } = await supabase
      .from('inventory_items')
      .insert([{
        name: trimmedName,
        category: newMaterial.category,
        stock: stockNum,
        threshold: !isNaN(threshNum) ? threshNum : null,
        storage_unit: newMaterial.storageUnit,
        vendor_unit: newMaterial.vendorUnit,
        vendor_to_storage: conversion,
        cost_per_vendor_unit: price,
        price_last_month: price,
        yield_percentage: yieldPct,
        is_semi_finished: newMaterial.isSemiFinished,
        expiry_date: newMaterial.expiryDate || null,
        last_ordered_date: 'Today',
        next_order_date: 'Not Scheduled',
        daily_burn_rate: 0,
        estimated_days_left: 999,
        recipe_unit: newMaterial.storageUnit === 'kg' ? 'g' : newMaterial.storageUnit === 'L' ? 'ml' : newMaterial.storageUnit,
        last_counted_at: new Date().toISOString(),
        pos_expected: stockNum,
        actual_counted: stockNum
      }])
      .select()
      .single();

    if (itemError) {
      console.error("Insert error details:", itemError);
      alert(`Database Error: ${itemError.message || JSON.stringify(itemError)}`);
      setIsSubmitting(false);
      return;
    }

    if (stockNum > 0) {
      await supabase
        .from('inventory_ledgers')
        .insert([{
          inventory_item_id: itemData.id,
          date: new Date().toISOString().split('T')[0],
          type: 'DELIVERY',
          amount: stockNum,
          note: 'Opening Stock Initialisation'
        }]);
    }

    setNewMaterial({
      name: '', category: 'Meat & Poultry', stock: '', threshold: '',
      storageUnit: 'kg', vendorUnit: 'carton', vendorToStorage: '20', costPerVendorUnit: '4800', prepLoss: '10',
      expiryDate: '', isSemiFinished: false
    });
    
    setIsAddingMode(false);
    setIsSubmitting(false);
    await fetchInventory();
  };

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden text-gray-900 font-sans relative">
      <div className="flex-1 overflow-y-auto slim-scrollbar px-6 md:px-10 w-full pb-10">
        
        
          {/* TOP NAV TABS */}
          <div className="pt-6 pb-2 w-full flex items-center justify-center">
            <div className="bg-gray-100/80 p-1 rounded-xl flex items-center gap-1 w-full max-w-sm mx-auto shadow-inner border border-gray-200/50">
              <button 
                onClick={() => setActiveTab('Intelligence')}
                className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-[13px] font-medium transition-all ${activeTab === 'Intelligence' ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Sparkles size={14} className={activeTab === 'Intelligence' ? 'text-[#E46254]' : ''} />
                Intelligence
              </button>
              <button 
                onClick={() => setActiveTab('Materials')}
                className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-[13px] font-medium transition-all ${activeTab === 'Materials' ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Box size={14} className={activeTab === 'Materials' ? 'text-[#E46254]' : ''} />
                Materials Data
              </button>
            </div>
          </div>
          
          {activeTab === 'Intelligence' ? (
            <IntelligenceDashboard />
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* DYNAMIC TOP HEADER */}
        <div className="sticky top-0 z-20 pt-6 pb-1 bg-white/95 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-100">
          
          {isAddingMode ? (
            // HEADER - ADD MATERIAL VIEW
            <div className="flex items-center gap-4 w-full justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsAddingMode(false)}
                  className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft size={16} />
                  <span className="text-[13px] font-medium">Back to List</span>
                </button>
              </div>
            </div>
          ) : selectedMasterProfile ? (
            // HEADER - DETAILED VIEW
            <div className="flex items-center gap-4 w-full justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedMasterProfile(null)}
                  className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft size={16} />
                  <span className="text-[13px] font-medium">Back to List</span>
                </button>
                <div className="h-4 w-[1px] bg-gray-200 hidden md:block"></div>
                <div className="hidden md:flex items-center gap-3">
                  <h1 className="text-[13px] font-semibold text-gray-900">{selectedMasterProfile.name}</h1>
                  <span className="px-2 py-0.5 border border-gray-200 text-gray-500 rounded text-[11px] font-medium bg-white">
                    {selectedMasterProfile.id ? `ID: INV-${selectedMasterProfile.id.substring(0, 4)}` : 'Loading...'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <button 
                    onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-md bg-white hover:border-[#E46254] transition-colors group"
                  >
                    <Calendar size={14} className="text-gray-500 group-hover:text-[#E46254] transition-colors"/>
                    <span className="text-[13px] font-medium text-gray-700">{dateRange}</span>
                    <ChevronDown size={14} className="text-gray-500"/>
                  </button>
                  
                  {isDateDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Oct 1 - Oct 15'].map(range => (
                        <div 
                          key={range}
                          onClick={() => { setDateRange(range); setIsDateDropdownOpen(false); }}
                          className={`px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors ${dateRange === range ? 'bg-[#E46254]/5 text-[#E46254]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                          {range}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => {
                    setAdjustingItem(selectedMasterProfile);
                    setAdjustType('DELIVERY');
                    setAdjustAmount('');
                    setAdjustNote('');
                  }} 
                  className="px-3 py-1.5 bg-[#E46254] hover:bg-[#D35546] text-white text-[13px] font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Sliders size={14} /> Adjust Stock
                </button>

                <button onClick={handleExportCSV} className="px-3 py-1.5 border border-gray-200 text-[13px] font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 rounded-md transition-all flex items-center gap-1.5 cursor-pointer">
                  <Download size={14} className="text-gray-500" /> Export CSV
                </button>
              </div>
            </div>
          ) : (
            // HEADER - LIST VIEW
            <>
              <div className="flex items-center gap-3">
                 <h1 className="text-[13px] font-semibold text-gray-900 tracking-tight">Inventory OS</h1>
                 {!isLoadingData && (
                   <span className="px-2 py-0.5 border border-gray-200 text-gray-500 rounded text-[11px] font-medium bg-white">{items.length} Items</span>
                 )}
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#E46254] transition-colors" size={16} />
                  <input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search raw materials..."
                    className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-[13px] font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#E46254] transition-all"
                  />
                </div>
                <button onClick={() => setIsAddingMode(true)} className="shrink-0 bg-[#E46254] hover:bg-[#D35546] text-white px-3.5 py-1.5 rounded-lg active:scale-95 transition-all font-medium text-[13px] flex items-center justify-center gap-1.5">
                  <Plus size={16} /> Add Material
                </button>
              </div>
            </>
          )}
        </div>

        {/* MAIN CONTENT AREA */}
        {isAddingMode ? (
          
          /* --- ADD MATERIAL VIEW --- */
          <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full pb-10 max-w-3xl mx-auto">
            <form onSubmit={handleAddMaterial} className="bg-gray-50/50 p-4 md:p-6">
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      
      {/* 1. Identity */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
         <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">1. Material Identity</h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="md:col-span-2">
             <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Material Name <span className="text-[#E46254]">*</span></label>
             <input required type="text" autoFocus value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} placeholder="e.g. Chicken breast" className="w-full text-[14px] font-medium border border-gray-200 rounded-lg px-3 py-2 focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 focus:outline-none transition-all" />
           </div>
           <div>
             <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Category <span className="text-[#E46254]">*</span></label>
             <select required value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})} className="w-full text-[14px] font-medium border border-gray-200 rounded-lg px-3 py-2 focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 focus:outline-none bg-white cursor-pointer transition-all">
               <option>Meat & Poultry</option><option>Seafood</option><option>Dairy & Eggs</option><option>Vegetables & Produce</option><option>Dry Goods</option>
             </select>
           </div>
         </div>
      </div>

      {/* 2. Costing Profile */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
         <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">2. Costing & Conversion</h3>
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Purchase Unit <span className="text-[#E46254]">*</span></label>
              <input required type="text" value={newMaterial.vendorUnit} onChange={e => {
                const isSame = e.target.value.toLowerCase() === newMaterial.storageUnit.toLowerCase();
                setNewMaterial({...newMaterial, vendorUnit: e.target.value, vendorToStorage: isSame ? '1' : newMaterial.vendorToStorage});
              }} placeholder="e.g. carton" className="w-full text-[14px] font-medium border border-gray-200 rounded-lg px-3 py-2 focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Base Stock Unit <span className="text-[#E46254]">*</span></label>
              <select required value={newMaterial.storageUnit} onChange={e => {
                const isSame = e.target.value.toLowerCase() === newMaterial.vendorUnit.toLowerCase();
                setNewMaterial({...newMaterial, storageUnit: e.target.value, vendorToStorage: isSame ? '1' : newMaterial.vendorToStorage});
              }} className="w-full text-[14px] font-medium border border-gray-200 rounded-lg px-3 py-2 focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 focus:outline-none bg-white cursor-pointer transition-all">
                <option value="kg">Kilograms (kg)</option><option value="g">Grams (g)</option><option value="L">Liters (L)</option><option value="ml">Milliliters (ml)</option><option value="pcs">Pieces (pcs)</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Purchase Price <span className="text-[#E46254]">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 font-medium text-[13px]">₹</span>
                <input required type="number" step="any" min="0" value={newMaterial.costPerVendorUnit} onChange={e => setNewMaterial({...newMaterial, costPerVendorUnit: e.target.value})} className="w-full pl-7 text-[14px] font-medium border border-gray-200 rounded-lg px-3 py-2 focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 focus:outline-none transition-all" />
              </div>
            </div>
            
            <div className="md:col-span-3 flex items-center gap-3 bg-red-50/50 p-3 rounded-lg border border-red-100">
               <div className="flex-1">
                 <label className="block text-[12px] font-bold text-gray-800 mb-0.5">Conversion Factor <span className="text-[#E46254]">*</span></label>
                 <p className="text-[11px] text-gray-500 font-medium">How many base units are in one purchase unit?</p>
               </div>
               <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">
                 <span className="font-semibold text-gray-700 text-[13px]">1 {newMaterial.vendorUnit || '[Unit]'} =</span>
                 <input required type="number" step="any" min="0.001" value={newMaterial.vendorToStorage} onChange={e => setNewMaterial({...newMaterial, vendorToStorage: e.target.value})} className="w-16 text-center text-[14px] border-b-2 border-gray-300 px-1 py-1 focus:border-[#E46254] font-bold focus:outline-none bg-transparent" />
                 <span className="font-semibold text-[#E46254] text-[13px]">{newMaterial.storageUnit}</span>
               </div>
            </div>
         </div>

         {/* Preparation Loss & Live Cost */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end border-t border-gray-100 pt-5">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Preparation Loss % <span className="text-[#E46254]">*</span></label>
              <div className="relative">
                <input required type="number" step="any" min="0" max="99" value={newMaterial.prepLoss} onChange={e => setNewMaterial({...newMaterial, prepLoss: e.target.value})} className="w-full text-[14px] font-medium border border-gray-200 rounded-lg px-3 py-2 focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 focus:outline-none transition-all" />
                <span className="absolute right-3 top-2.5 text-gray-400 font-bold text-[13px]">%</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 font-medium">Yield will be {100 - (parseFloat(newMaterial.prepLoss) || 0)}%</p>
            </div>
            
            <div className="md:col-span-2">
               {(() => {
                  const lossPct = parseFloat(newMaterial.prepLoss) || 0;
                  const yieldPct = Math.max(0.1, 100 - lossPct);
                  const conversion = parseFloat(newMaterial.vendorToStorage) || 0;
                  const price = parseFloat(newMaterial.costPerVendorUnit) || 0;
                  
                  const rawCost = conversion > 0 ? price / conversion : 0;
                  const usableCost = yieldPct > 0 ? rawCost / (yieldPct / 100) : 0;
                  
                  return (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                       <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Raw Cost</p>
                          <p className="text-[13px] font-semibold text-gray-600">₹{rawCost.toFixed(2)} / {newMaterial.storageUnit}</p>
                       </div>
                       <div className="h-6 w-px bg-gray-200"></div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-[#E46254] uppercase tracking-widest mb-0.5">True Usable Cost</p>
                          <p className="text-[15px] font-bold text-gray-900">₹{usableCost.toFixed(2)} <span className="text-[12px] text-gray-500 font-medium normal-case">/ {newMaterial.storageUnit}</span></p>
                       </div>
                    </div>
                  );
               })()}
            </div>
         </div>
      </div>

      {/* 3. Optional Settings */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
         <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">3. Optional Tracking</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Opening Stock</label>
              <div className="relative">
                <input type="number" step="any" min="0" value={newMaterial.stock} onChange={e => setNewMaterial({...newMaterial, stock: e.target.value})} placeholder="0" className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg text-[14px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none transition-all" />
                <span className="absolute right-3 top-2.5 text-[12px] text-gray-400 font-bold">{newMaterial.storageUnit}</span>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Low Stock Threshold</label>
              <div className="relative">
                <input type="number" step="any" min="0" value={newMaterial.threshold} onChange={e => setNewMaterial({...newMaterial, threshold: e.target.value})} placeholder="Alert threshold" className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg text-[14px] font-medium focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254]/20 outline-none transition-all" />
                <span className="absolute right-3 top-2.5 text-[12px] text-gray-400 font-bold">{newMaterial.storageUnit}</span>
              </div>
            </div>
         </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" onClick={() => setIsAddingMode(false)} className="px-5 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
        <button disabled={isSubmitting || !newMaterial.name.trim()} type="submit" className="bg-[#E46254] text-white px-6 py-2 rounded-lg font-semibold text-[13px] shadow-sm shadow-[#E46254]/20 hover:bg-[#D35546] disabled:opacity-50 flex items-center gap-2 transition-all">
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
          {isSubmitting ? 'Saving...' : 'Save Cost-Ready Material'}
        </button>
      </div>
    </div>
  </form>
          </div>

        ) : selectedMasterProfile ? (
          
          /* --- DETAILED PAGE VIEW (100% REAL RESTAURANT METRICS) --- */
          (() => {
            const conversion = selectedMasterProfile.vendorToStorage > 0 ? selectedMasterProfile.vendorToStorage : 1;
            const rawCostPerStorageUnit = selectedMasterProfile.costPerVendorUnit / conversion;
            const yieldPct = selectedMasterProfile.yieldPercentage > 0 ? selectedMasterProfile.yieldPercentage : 100;
            const prepLossPct = Math.max(0, 100 - yieldPct);
            const trueUsableCost = yieldPct > 0 ? rawCostPerStorageUnit / (yieldPct / 100) : rawCostPerStorageUnit;
            const capitalLocked = selectedMasterProfile.stock * rawCostPerStorageUnit;
            const isLowStock = selectedMasterProfile.threshold != null && selectedMasterProfile.stock <= selectedMasterProfile.threshold;

            const totalConsumed = (selectedMasterProfile.ledger || [])
              .filter(log => log.type === 'POS_DEDUCTION' || (log.type as string) === 'CONSUMPTION' || (log.amount < 0 && log.type !== 'WASTE'))
              .reduce((sum, log) => sum + Math.abs(log.amount), 0);

            const totalDelivered = (selectedMasterProfile.ledger || [])
              .filter(log => log.type === 'DELIVERY' || (log.amount > 0 && log.type !== 'MANUAL_COUNT'))
              .reduce((sum, log) => sum + log.amount, 0);

            const totalOrdersCount = selectedMasterProfile.usedInRecipes.reduce((sum, r) => sum + r.timesOrdered, 0);

            return (
              <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 w-full pb-10">
                <div className="border border-gray-200 bg-white overflow-hidden rounded-xl shadow-sm">
                   
                   {/* 1. MASTER KPI RIBBON */}
                   <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-gray-200 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 bg-white">
                     <div className="p-4 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-medium text-gray-500 mb-1">Live Stock Level</span>
                          <button 
                            onClick={() => {
                              setAdjustingItem(selectedMasterProfile);
                              setAdjustType('DELIVERY');
                              setAdjustAmount('');
                              setAdjustNote('');
                            }}
                            className="text-[11px] font-semibold text-[#E46254] hover:text-[#D35546] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sliders size={11} /> Quick Adjust
                          </button>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-[15px] font-bold tabular-nums ${isLowStock ? 'text-[#E46254]' : 'text-gray-900'}`}>
                            {selectedMasterProfile.stock} {selectedMasterProfile.storageUnit}
                          </span>
                        </div>
                        <div className="mt-1">
                          {isLowStock ? (
                            <span className="text-[11px] font-semibold text-[#E46254] flex items-center gap-1">
                              <AlertCircle size={12} /> Low Stock (Limit: {selectedMasterProfile.threshold} {selectedMasterProfile.storageUnit})
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Optimal Level
                            </span>
                          )}
                        </div>
                     </div>

                     <div className="p-4 flex flex-col justify-center bg-gray-50/30">
                        <span className="text-[12px] font-medium text-gray-500 mb-1">True Usable Cost</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[15px] font-bold text-gray-900 tabular-nums">
                            ₹{trueUsableCost.toFixed(2)}
                          </span>
                          <span className="text-[11px] font-medium text-gray-500">/ {selectedMasterProfile.storageUnit}</span>
                        </div>
                        <span className="text-[11px] font-medium text-gray-400 mt-1">
                          Raw: ₹{rawCostPerStorageUnit.toFixed(2)} ({prepLossPct}% prep loss)
                        </span>
                     </div>

                     <div className="p-4 flex flex-col justify-center">
                        <span className="text-[12px] font-medium text-gray-500 mb-1">Total Consumed</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[15px] font-bold text-gray-900 tabular-nums">
                            {totalConsumed.toFixed(2)} {selectedMasterProfile.storageUnit}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-gray-400 mt-1">
                          Ordered {totalOrdersCount} times across menu
                        </span>
                     </div>

                     <div className="p-4 flex flex-col justify-center bg-gray-50/30">
                        <span className="text-[12px] font-medium text-gray-500 mb-1">Capital Locked</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[15px] font-bold text-gray-900 tabular-nums">
                            {formatCurrency(capitalLocked)}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-gray-400 mt-1">
                          On-hand stock valuation
                        </span>
                     </div>
                   </div>

                   {/* 2. SPECIFICATIONS & COSTING PROFILE (REPLACED DUMMY AUDIT SNAPSHOT) */}
                   <div className="border-b border-gray-200 p-5 bg-white">
                     <div className="flex items-center gap-2 mb-4">
                       <Layers size={15} className="text-[#E46254]" />
                       <h3 className="text-[13px] font-semibold text-gray-900 tracking-tight">Material Specifications & Costing Profile</h3>
                     </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/60 p-4 rounded-xl border border-gray-100">
                       <div>
                         <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Category</p>
                         <p className="text-[13px] font-medium text-gray-900">{selectedMasterProfile.category}</p>
                       </div>

                       <div>
                         <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Purchase Unit & Price</p>
                         <p className="text-[13px] font-medium text-gray-900">{formatCurrency(selectedMasterProfile.costPerVendorUnit)} / {selectedMasterProfile.vendorUnit}</p>
                       </div>

                       <div>
                         <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Unit Conversion</p>
                         <p className="text-[13px] font-medium text-gray-900">1 {selectedMasterProfile.vendorUnit} = {conversion} {selectedMasterProfile.storageUnit}</p>
                       </div>

                       <div>
                         <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Raw Unit Cost</p>
                         <p className="text-[13px] font-medium text-gray-900">₹{rawCostPerStorageUnit.toFixed(2)} / {selectedMasterProfile.storageUnit}</p>
                       </div>

                       <div>
                         <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Usable Yield / Prep Loss</p>
                         <p className="text-[13px] font-medium text-gray-900">{yieldPct}% Yield ({prepLossPct}% Prep Loss)</p>
                       </div>

                       <div>
                         <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Low Stock Threshold</p>
                         <p className="text-[13px] font-medium text-gray-900">{selectedMasterProfile.threshold != null ? `${selectedMasterProfile.threshold} ${selectedMasterProfile.storageUnit}` : 'Not configured'}</p>
                       </div>

                       <div>
                         <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Material Classification</p>
                         <p className="text-[13px] font-medium text-gray-900">{selectedMasterProfile.isSemiFinished ? 'Semi-Finished / Prepared' : 'Raw Ingredient'}</p>
                       </div>

                       <div>
                         <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Shelf Life / Expiry</p>
                         <p className="text-[13px] font-medium text-gray-900">{selectedMasterProfile.expiryDate || 'Standard / Non-perishable'}</p>
                       </div>
                     </div>
                   </div>

                   {/* 3. MENU PROFITABILITY STUDY (FULL WIDTH, CLEAN MATH) */}
                   <div className="border-b border-gray-200 flex flex-col bg-white">
                      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                         <div className="flex items-center gap-2">
                           <ChefHat size={15} className="text-[#E46254]"/>
                           <h3 className="text-[13px] font-semibold text-gray-900">Menu Profitability & Recipe Usage</h3>
                         </div>
                         <span className="text-[12px] font-medium text-gray-500">{selectedMasterProfile.usedInRecipes.length} dishes linked</span>
                      </div>
                      
                      <div className="overflow-x-auto">
                         <div className="grid grid-cols-7 bg-white border-b border-gray-100 px-5 py-2 text-[12px] font-semibold text-gray-500 min-w-[720px]">
                           <div className="col-span-2">Dish / Recipe Name</div>
                           <div className="text-right">Times Ordered</div>
                           <div className="text-right">Portion per Order</div>
                           <div className="text-right">Total Consumed</div>
                           <div className="text-right">Ingredient Cost</div>
                           <div className="text-right">Cost Share of Price</div>
                         </div>
                         
                         <div className="divide-y divide-gray-100 min-w-[720px]">
                            {selectedMasterProfile.usedInRecipes.map((r, i) => {
                               let costPerRecipeUnit = trueUsableCost;
                               if (selectedMasterProfile.storageUnit === 'kg' && selectedMasterProfile.recipeUnit === 'g') costPerRecipeUnit /= 1000;
                               if (selectedMasterProfile.storageUnit === 'L' && selectedMasterProfile.recipeUnit === 'ml') costPerRecipeUnit /= 1000;
                               const portionCost = r.amountPerOrder * costPerRecipeUnit;
                               const costSharePct = r.dishPrice > 0 ? ((portionCost / r.dishPrice) * 100).toFixed(1) : null;
                               return (
                                 <div key={i} className="grid grid-cols-7 px-5 py-3 items-center hover:bg-gray-50/50 transition-colors">
                                    <div className="col-span-2 text-[13px] font-medium text-gray-900 truncate pr-2">
                                      {r.name} 
                                    </div>
                                    <div className="text-right text-[13px] font-medium text-gray-600 tabular-nums">
                                      {r.timesOrdered}
                                    </div>
                                    <div className="text-right text-[13px] font-medium text-gray-600 tabular-nums">
                                      {r.amountPerOrder} {selectedMasterProfile.recipeUnit}
                                    </div>
                                    <div className="text-right text-[13px] font-medium text-gray-900 tabular-nums">
                                      {(r.amountPerOrder * r.timesOrdered).toFixed(1)} {selectedMasterProfile.recipeUnit}
                                    </div>
                                    <div className="text-right text-[13px] font-semibold text-gray-900 tabular-nums">
                                      {formatCurrency(portionCost)}
                                    </div>
                                    <div className="text-right flex justify-end">
                                      {costSharePct ? (
                                        <span className="text-[12px] font-medium text-[#E46254] bg-[#E46254]/5 px-2 py-0.5 rounded">
                                          {costSharePct}% of ₹{r.dishPrice}
                                        </span>
                                      ) : (
                                        <span className="text-[12px] font-medium text-gray-500">
                                          {formatCurrency(portionCost)}/order
                                        </span>
                                      )}
                                    </div>
                                 </div>
                               );
                            })}
                            {selectedMasterProfile.usedInRecipes.length === 0 && (
                              <div className="px-5 py-8 text-center text-[13px] text-gray-500 font-medium">
                                No menu items are currently linked to this ingredient. Add it to a recipe in the Menu Builder.
                              </div>
                            )}
                         </div>
                      </div>
                   </div>

                   {/* 4. STOCK LEDGER / AUDIT TRAIL */}
                   <div className="flex flex-col bg-white">
                      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                         <div className="flex items-center gap-2">
                           <Activity size={15} className="text-[#E46254]" />
                           <h3 className="text-[13px] font-semibold text-gray-900">Live Inventory Audit Trail</h3>
                         </div>
                         <div className="flex items-center gap-3 text-[11px] font-semibold">
                           <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                             Inbound: +{totalDelivered.toFixed(2)} {selectedMasterProfile.storageUnit}
                           </span>
                           <span className="text-[#E46254] bg-red-50 px-2 py-0.5 rounded border border-red-100">
                             Consumed: -{totalConsumed.toFixed(2)} {selectedMasterProfile.storageUnit}
                           </span>
                         </div>
                      </div>
                      
                      <div className="flex flex-col divide-y divide-gray-100 bg-white">
                         {selectedMasterProfile.ledger?.map((log) => (
                           <div key={log.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors cursor-default">
                             <div className="flex items-center gap-3">
                               <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200/60 flex items-center justify-center shrink-0">
                                  {log.type === 'DELIVERY' ? <ArrowDownRight size={14} className="text-emerald-600" /> : 
                                   log.type === 'WASTE' ? <ArrowUpRight size={14} className="text-[#E46254]" /> :
                                   log.type === 'MANUAL_COUNT' ? <RefreshCw size={12} className="text-blue-500" /> :
                                   <Activity size={12} className="text-[#E46254]" />}
                               </div>
                               <div className="flex items-center gap-3">
                                 <p className="text-[13px] font-medium text-gray-900 leading-none">{log.note || 'Inventory Event'}</p>
                                 <p className="text-[12px] font-medium text-gray-400">{log.date}</p>
                               </div>
                             </div>
                             <div className="text-right">
                               <span className={`text-[13px] font-bold tabular-nums ${log.amount > 0 ? 'text-emerald-600' : 'text-[#E46254]'}`}>
                                 {log.amount > 0 ? '+' : ''}{log.amount} {selectedMasterProfile.storageUnit}
                               </span>
                             </div>
                           </div>
                         ))}
                         {(!selectedMasterProfile.ledger || selectedMasterProfile.ledger.length === 0) && (
                            <div className="px-5 py-8 text-center text-[13px] text-gray-500 font-medium">
                              No inventory ledger events recorded yet.
                            </div>
                         )}
                      </div>
                   </div>

                </div>
              </div>
            );
          })()

        ) : (

          /* --- LIST PAGE VIEW --- */
          <div className="flex flex-col mt-6 animate-in fade-in duration-300">

            {/* PROACTIVE LOW STOCK ALERT BANNER */}
            {lowStockCount > 0 && (
              <div className="mb-4 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-amber-900 leading-tight">
                      {lowStockCount} {lowStockCount === 1 ? 'material is' : 'materials are'} below reorder threshold
                    </h3>
                    <p className="text-[12px] text-amber-700/80 font-medium mt-0.5">
                      Review stock quantities and schedule deliveries to prevent recipe stock-outs.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${
                    filterLowStockOnly 
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                      : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  {filterLowStockOnly ? 'Show All Materials' : 'Filter Low Stock Items'}
                </button>
              </div>
            )}

            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden relative min-h-[300px]">
            
            {isLoadingData ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                <Loader2 size={24} className="animate-spin text-gray-400 mb-3" />
                <p className="text-[12px] font-medium text-gray-500">Syncing with database...</p>
              </div>
            ) : null}

            <div className="flex items-center px-6 py-3 bg-gray-50/50 border-b border-gray-200 text-[12px] font-medium text-gray-500">
              <div className="flex-1">Material</div>
              <div className="w-32 text-right">Live Stock</div>
              <div className="w-32 text-right">Threshold</div>
              <div className="w-32 text-right">Total Consumed</div>
              <div className="w-32 text-right">Value</div>
              <div className="w-8 shrink-0"></div>
            </div>

            <div className="divide-y divide-gray-100 flex flex-col bg-white">
              {filteredItems.length === 0 && !isLoadingData ? (
                <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                    <Activity size={20} className="text-gray-300" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-gray-900 mb-1">
                    {filterLowStockOnly ? 'No Low Stock Items Found' : 'No Inventory Found'}
                  </h3>
                  <p className="text-[12px] text-gray-500 font-medium max-w-sm">
                    {filterLowStockOnly 
                      ? 'All inventory items are currently at or above their configured thresholds.'
                      : 'Your database is currently empty. Click "Add Material" above to start building your master inventory list.'
                    }
                  </p>
                </div>
              ) : null}

              {filteredItems.map((item) => {
                const isLow = item.threshold != null && item.stock <= item.threshold;
                const conversion = item.vendorToStorage > 0 ? item.vendorToStorage : 1;
                const unitCost = item.costPerVendorUnit / conversion;
                const totalValue = item.stock * unitCost; 
                const isExpanded = expandedId === item.id;
                const itemTotalConsumed = (item.ledger || [])
                  .filter(l => l.type === 'POS_DEDUCTION' || (l.type as string) === 'CONSUMPTION' || (l.amount < 0 && l.type !== 'WASTE'))
                  .reduce((sum, l) => sum + Math.abs(l.amount), 0);

                return (
                  <div key={item.id} className="flex flex-col">
                    
                    <div 
                      onClick={() => toggleExpand(item.id)}
                      className={`flex items-center px-3 py-1.5 transition-all cursor-pointer group ${isExpanded ? 'bg-[#E46254]/[0.02]' : 'hover:bg-[#E46254]/[0.02]'}`}
                    >
                      <div className="flex-1 flex items-center gap-3">
                        <span className="text-[13px] font-medium text-gray-900 tracking-tight">{item.name}</span>
                        <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-[11px] font-medium text-gray-600">
                          {item.category}
                        </span>
                      </div>
                      <div className="w-32 text-right flex items-center justify-end gap-1.5">
                        <span className={`text-[13px] font-semibold tabular-nums ${isLow ? 'text-[#E46254]' : 'text-gray-900'}`}>
                          {item.stock} <span className={`text-[12px] font-medium ml-0.5 ${isLow ? 'text-[#E46254]/70' : 'text-gray-400'}`}>{item.storageUnit}</span>
                        </span>
                      </div>
                      <div className="w-32 text-right">
                         <span className="text-[13px] font-medium text-gray-600 tabular-nums">
                           {item.threshold != null ? `${item.threshold} ${item.storageUnit}` : '—'}
                         </span>
                      </div>
                      <div className="w-32 text-right">
                         <span className="text-[13px] font-medium text-gray-900 tabular-nums">
                           {itemTotalConsumed.toFixed(1)} <span className="text-[11px] text-gray-500">{item.storageUnit}</span>
                         </span>
                      </div>
                      <div className="w-32 text-right">
                        <span className="text-[13px] font-semibold text-gray-900 tracking-tight tabular-nums">{formatCurrency(totalValue)}</span>
                      </div>
                      <div className="w-8 shrink-0 flex justify-end text-gray-400 group-hover:text-[#E46254] transition-colors">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/50 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#E46254]" />
                        <div className="px-6 py-3.5 flex justify-between items-center">
                          <p className="text-[12px] text-gray-500 font-medium tracking-wide">
                            {isLow ? (
                              <span className="text-[#E46254] font-semibold flex items-center gap-1">
                                <AlertCircle size={13} /> Current stock ({item.stock} {item.storageUnit}) is at or below threshold ({item.threshold} {item.storageUnit})
                              </span>
                            ) : (
                              <span>Summary preview. Adjust stock directly or open Master Profile for detailed recipe economics.</span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setAdjustingItem(item);
                                setAdjustType('DELIVERY');
                                setAdjustAmount('');
                                setAdjustNote('');
                              }}
                              className="text-[12px] font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md shadow-xs cursor-pointer"
                            >
                              <Sliders size={13} className="text-gray-500" />
                              Adjust Stock
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMasterProfile(item);
                              }}
                              className="text-[12px] font-medium text-white flex items-center gap-1.5 transition-colors px-4 py-1.5 bg-[#E46254] rounded-md hover:bg-[#D35546] shadow-xs cursor-pointer"
                            >
                              Open Master Profile
                              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        )}
            </div>
          )}
      </div>

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {adjustingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E46254]/10 text-[#E46254] flex items-center justify-center font-bold">
                  <Sliders size={16} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-gray-900 leading-tight">Adjust Stock Level</h3>
                  <p className="text-[12px] text-gray-500 font-medium">
                    {adjustingItem.name} <span className="text-gray-400">({adjustingItem.category})</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingItem(null)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleStockAdjustment} className="p-6 flex flex-col gap-5">
              
              {/* Current Stock Banner */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Current Live Stock</span>
                  <span className="text-[16px] font-bold text-gray-900 tabular-nums">
                    {adjustingItem.stock} {adjustingItem.storageUnit}
                  </span>
                </div>
                {adjustingItem.threshold != null && (
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Reorder Limit</span>
                    <span className="text-[13px] font-medium text-gray-600 tabular-nums">
                      {adjustingItem.threshold} {adjustingItem.storageUnit}
                    </span>
                  </div>
                )}
              </div>

              {/* Adjustment Mode Selector */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-2">Operation Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('DELIVERY')}
                    className={`py-2 px-3 rounded-xl border text-[12px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      adjustType === 'DELIVERY'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <PackagePlus size={16} className={adjustType === 'DELIVERY' ? 'text-emerald-600' : 'text-gray-400'} />
                    <span>Receive (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('WASTE')}
                    className={`py-2 px-3 rounded-xl border text-[12px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      adjustType === 'WASTE'
                        ? 'border-[#E46254] bg-red-50 text-red-800 shadow-xs'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Trash2 size={16} className={adjustType === 'WASTE' ? 'text-[#E46254]' : 'text-gray-400'} />
                    <span>Waste (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('MANUAL_COUNT')}
                    className={`py-2 px-3 rounded-xl border text-[12px] font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      adjustType === 'MANUAL_COUNT'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-xs'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <RefreshCw size={16} className={adjustType === 'MANUAL_COUNT' ? 'text-blue-600' : 'text-gray-400'} />
                    <span>Set Exact (=)</span>
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  {adjustType === 'DELIVERY' && `Quantity Received (Add to stock)`}
                  {adjustType === 'WASTE' && `Quantity Spoiled / Wasted (Deduct from stock)`}
                  {adjustType === 'MANUAL_COUNT' && `New Physical Verified Stock (Exact count)`}
                  <span className="text-[#E46254] ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    required
                    type="number"
                    step="any"
                    min="0.001"
                    autoFocus
                    placeholder="e.g. 10"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full text-[15px] font-bold border border-gray-200 rounded-xl px-3.5 py-2.5 focus:border-[#E46254] focus:ring-2 focus:ring-[#E46254]/10 focus:outline-none transition-all tabular-nums"
                  />
                  <span className="absolute right-3.5 top-2.5 text-[13px] font-bold text-gray-400 pointer-events-none">
                    {adjustingItem.storageUnit}
                  </span>
                </div>

                {/* Calculation Preview */}
                {adjustAmount && !isNaN(parseFloat(adjustAmount)) && parseFloat(adjustAmount) > 0 && (
                  <p className="text-[12px] font-medium text-gray-500 mt-1.5">
                    Resulting stock will be:{' '}
                    <span className="font-bold text-gray-900">
                      {adjustType === 'DELIVERY' && `${(adjustingItem.stock + parseFloat(adjustAmount)).toFixed(2)} ${adjustingItem.storageUnit}`}
                      {adjustType === 'WASTE' && `${(adjustingItem.stock - parseFloat(adjustAmount)).toFixed(2)} ${adjustingItem.storageUnit}`}
                      {adjustType === 'MANUAL_COUNT' && `${parseFloat(adjustAmount).toFixed(2)} ${adjustingItem.storageUnit}`}
                    </span>
                  </p>
                )}
              </div>

              {/* Note / Reason */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Reason / Audit Note (Optional)</label>
                <input
                  type="text"
                  placeholder={
                    adjustType === 'DELIVERY' ? 'e.g. Morning delivery from Metro vendor' :
                    adjustType === 'WASTE' ? 'e.g. Prep spoilage / dropped on floor' :
                    'e.g. End of day physical stock count'
                  }
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full text-[13px] font-medium border border-gray-200 rounded-xl px-3 py-2 focus:border-[#E46254] focus:ring-2 focus:ring-[#E46254]/10 focus:outline-none transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isAdjusting || !adjustAmount || parseFloat(adjustAmount) <= 0}
                  type="submit"
                  className="px-5 py-2 bg-[#E46254] hover:bg-[#D35546] disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {isAdjusting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {isAdjusting ? 'Updating Stock...' : 'Confirm Stock Adjustment'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
