"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  UploadCloud, 
  Pipette, 
  Check, 
  CreditCard, 
  Smartphone, 
  Receipt, 
  Banknote, 
  QrCode, 
  ShieldCheck, 
  Sparkles,
  Loader2,
  Percent,
  FileText,
  Wine,
  Building2,
  Info,
  Store,
  Printer
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { 
  TaxSettings, 
  DEFAULT_TAX_SETTINGS, 
  getStoredTaxSettings, 
  saveTaxSettings, 
  calculateBillTaxes 
} from "@/utils/tax";

export default function SettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'TAXES' | 'WORKFLOW' | 'BRAND'>('TAXES');
  
  // General & Brand Settings
  const [primaryColor, setPrimaryColor] = useState('#E46254');
  const [restaurantName, setRestaurantName] = useState('The Daily Café');
  const [restaurantSlug, setRestaurantSlug] = useState('dailycafe');
  const [upiId, setUpiId] = useState('');
  const [restaurantId, setRestaurantId] = useState<string>('');
  
  // Billing & Settlement Mode: 'STAFF_ASSISTED' or 'SELF_PAY'
  const [billingMode, setBillingMode] = useState<'STAFF_ASSISTED' | 'SELF_PAY'>('STAFF_ASSISTED');

  // Tax & Receipt Settings
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const restId = user?.user_metadata?.restaurant_id;

        if (restId) {
          setRestaurantId(restId);
          const { data: rest } = await supabase.from('restaurants').select('*').eq('id', restId).single();
          if (rest) {
            if (rest.name) setRestaurantName(rest.name);
            if (rest.slug) setRestaurantSlug(rest.slug);
            if (rest.primary_color) setPrimaryColor(rest.primary_color);
            if (rest.upi_id || rest.upi_vpa) setUpiId(rest.upi_id || rest.upi_vpa);
          }

          const savedMode = localStorage.getItem(`tabletapy_billing_mode_${restId}`);
          if (savedMode === 'SELF_PAY' || savedMode === 'STAFF_ASSISTED') {
            setBillingMode(savedMode);
          }

          const loadedTaxes = getStoredTaxSettings(restId);
          setTaxSettings(loadedTaxes);
        } else {
          const genericMode = localStorage.getItem('tabletapy_billing_mode_default');
          if (genericMode === 'SELF_PAY' || genericMode === 'STAFF_ASSISTED') {
            setBillingMode(genericMode);
          }
          const loadedTaxes = getStoredTaxSettings();
          setTaxSettings(loadedTaxes);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }

    loadSettings();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save Tax Settings locally
      saveTaxSettings(taxSettings, restaurantId);

      // 2. Save Billing Mode locally
      if (restaurantId) {
        localStorage.setItem(`tabletapy_billing_mode_${restaurantId}`, billingMode);
      }
      localStorage.setItem('tabletapy_billing_mode_default', billingMode);

      // 3. Update Supabase Restaurant Record
      if (restaurantId) {
        const updatePayload: Record<string, any> = {
          name: restaurantName,
          slug: restaurantSlug,
          primary_color: primaryColor,
          upi_id: upiId
        };

        // Try updating Supabase (handle safely if column doesn't exist)
        try {
          await supabase.from('restaurants').update(updatePayload).eq('id', restaurantId);
        } catch (dbErr) {
          console.warn("Database update partial notice:", dbErr);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Live Sample Chit Calculation for Receipt Preview
  const sampleCalc = useMemo(() => {
    const foodSubtotal = 400; // 180 + 220
    const alcoholSubtotal = taxSettings.alcoholVatEnabled ? 350 : 0;
    return calculateBillTaxes({
      subtotal: foodSubtotal + alcoholSubtotal,
      discountAmount: 0,
      packagingAmount: 0,
      isDineIn: true,
      hasAlcohol: taxSettings.alcoholVatEnabled,
      alcoholSubtotal: alcoholSubtotal,
      settings: taxSettings,
    });
  }, [taxSettings]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto min-h-screen text-white animate-in fade-in duration-300 font-sans">
      
      {/* ── HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 border-b border-zinc-800 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E46254]" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Restaurant Settings</h1>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Configure GST taxes, thermal receipt layouts, table payment workflows, and branding.
          </p>
        </div>

        <button 
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-[#E46254] hover:bg-[#d55345] text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-[0_0_20px_rgba(228,98,84,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-70 self-start sm:self-auto shrink-0"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : saveSuccess ? (
            <>
              <Check size={16} className="text-white" />
              <span>Settings Saved!</span>
            </>
          ) : (
            <span>Save All Changes</span>
          )}
        </button>
      </div>

      {/* ── HIGH-LEVEL NAVIGATION TABS ── */}
      <div className="mb-8">
        <div className="bg-[#121215] p-1.5 rounded-2xl border border-zinc-800 flex items-center gap-1.5 overflow-x-auto slim-scrollbar max-w-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('TAXES')}
            className={`flex-1 min-w-[150px] py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'TAXES'
                ? 'bg-[#E46254] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <Receipt size={14} />
            <span>Taxes & Thermal Bill</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('WORKFLOW')}
            className={`flex-1 min-w-[150px] py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'WORKFLOW'
                ? 'bg-[#E46254] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <CreditCard size={14} />
            <span>Billing Workflow</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BRAND')}
            className={`flex-1 min-w-[150px] py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'BRAND'
                ? 'bg-[#E46254] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <Sparkles size={14} />
            <span>Brand & Profile</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: TAXES, GST & THERMAL RECEIPT (STAR NEW SECTION) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'TAXES' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7 cols): The 3-Step Human Questionnaire */}
          <div className="xl:col-span-7 space-y-6">

            {/* 1. GST Registration Status */}
            <section className="bg-[#121215] p-5 sm:p-6 rounded-2xl border border-zinc-800/80 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#E46254]/10 text-[#E46254] text-[11px] font-black flex items-center justify-center border border-[#E46254]/30">
                    1
                  </span>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    GST Registration & Tax Status
                  </h2>
                </div>
                <p className="text-zinc-400 text-xs mt-1">
                  Indian law requires restaurants to choose their GST structure. TableTapy calculates CGST/SGST automatically.
                </p>
              </div>

              {/* 3 Status Cards */}
              <div className="grid grid-cols-1 gap-3">
                
                {/* Regular GST (5%) */}
                <div
                  onClick={() => setTaxSettings(prev => ({ ...prev, gstType: 'REGULAR', cgstRate: 2.5, sgstRate: 2.5 }))}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    taxSettings.gstType === 'REGULAR'
                      ? 'border-[#E46254] bg-[#E46254]/5'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Regular GST (5% Total)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        95% of Cafes & Restaurants
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Split as <strong>2.5% CGST + 2.5% SGST</strong>. Standard rate for all standalone food & beverage outlets.
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    taxSettings.gstType === 'REGULAR' ? 'border-[#E46254] bg-[#E46254]' : 'border-zinc-600'
                  }`}>
                    {taxSettings.gstType === 'REGULAR' && <Check size={12} className="text-white stroke-[3]" />}
                  </div>
                </div>

                {/* Composition Scheme / Non-GST (0%) */}
                <div
                  onClick={() => setTaxSettings(prev => ({ ...prev, gstType: 'COMPOSITION' }))}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    taxSettings.gstType === 'COMPOSITION'
                      ? 'border-[#E46254] bg-[#E46254]/5'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Composition Scheme / Non-GST (0%)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300">
                        Small Outlets
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Menu prices are net. Outlets under the Composition Scheme are legally forbidden from charging GST to diners.
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    taxSettings.gstType === 'COMPOSITION' ? 'border-[#E46254] bg-[#E46254]' : 'border-zinc-600'
                  }`}>
                    {taxSettings.gstType === 'COMPOSITION' && <Check size={12} className="text-white stroke-[3]" />}
                  </div>
                </div>

                {/* Luxury / Hotel-Attached (18%) */}
                <div
                  onClick={() => setTaxSettings(prev => ({ ...prev, gstType: 'CUSTOM', customGstRate: 18 }))}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    taxSettings.gstType === 'CUSTOM'
                      ? 'border-[#E46254] bg-[#E46254]/5'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Hotel-Attached Restaurant (18% GST)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Luxury / 5-Star
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Split as <strong>9% CGST + 9% SGST</strong>. For restaurants inside hotels with room tariff ₹7,500/night or higher.
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    taxSettings.gstType === 'CUSTOM' ? 'border-[#E46254] bg-[#E46254]' : 'border-zinc-600'
                  }`}>
                    {taxSettings.gstType === 'CUSTOM' && <Check size={12} className="text-white stroke-[3]" />}
                  </div>
                </div>

              </div>

              {/* Pricing Mode (Inclusive vs Exclusive) - Only for GST Registered */}
              {taxSettings.gstType !== 'COMPOSITION' && (
                <div className="pt-3 border-t border-zinc-800/80 space-y-2.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Menu Pricing Strategy
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTaxSettings(prev => ({ ...prev, pricingType: 'EXCLUSIVE' }))}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        taxSettings.pricingType === 'EXCLUSIVE'
                          ? 'border-[#E46254] bg-[#E46254]/10 text-white'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-xs block text-white">Exclusive (Add Tax on Top)</span>
                        <span className="text-[11px] text-zinc-400">₹200 dish + 5% GST = ₹210 bill</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Most Popular
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaxSettings(prev => ({ ...prev, pricingType: 'INCLUSIVE' }))}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        taxSettings.pricingType === 'INCLUSIVE'
                          ? 'border-[#E46254] bg-[#E46254]/10 text-white'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-xs block text-white">Inclusive (Tax in Price)</span>
                        <span className="text-[11px] text-zinc-400">₹200 dish = Exact ₹200 bill</span>
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                        Cafe / QSR
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tax & Legal Identifiers (GSTIN & FSSAI) */}
              <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    GSTIN Number (15 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    value={taxSettings.gstin}
                    onChange={(e) => setTaxSettings(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                    className="w-full p-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#E46254] bg-zinc-900 text-white font-mono text-xs uppercase"
                  />
                  <span className="text-[10.5px] text-zinc-500 mt-1 block">Printed on thermal receipts</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    FSSAI License Number (14 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={14}
                    placeholder="e.g. 11223344556677"
                    value={taxSettings.fssai}
                    onChange={(e) => setTaxSettings(prev => ({ ...prev, fssai: e.target.value.replace(/\D/g, '') }))}
                    className="w-full p-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#E46254] bg-zinc-900 text-white font-mono text-xs"
                  />
                  <span className="text-[10.5px] text-zinc-500 mt-1 block">Mandatory food safety license</span>
                </div>
              </div>
            </section>

            {/* 2. Service Charge (Dine-In Only) */}
            <section className="bg-[#121215] p-5 sm:p-6 rounded-2xl border border-zinc-800/80 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#E46254]/10 text-[#E46254] text-[11px] font-black flex items-center justify-center border border-[#E46254]/30">
                      2
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Dine-In Service Charge (Optional Staff Tip)
                    </h2>
                  </div>
                  <p className="text-zinc-400 text-xs mt-1">
                    Voluntary fee distributed to floor staff. Under CCPA rules, applies strictly to Dine-In and must be waived if a diner requests.
                  </p>
                </div>

                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setTaxSettings(prev => ({ ...prev, serviceChargeEnabled: !prev.serviceChargeEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 mt-1 ${
                    taxSettings.serviceChargeEnabled ? 'bg-[#E46254]' : 'bg-zinc-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    taxSettings.serviceChargeEnabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Service Charge Rate Options */}
              {taxSettings.serviceChargeEnabled && (
                <div className="pt-3 border-t border-zinc-800/80 space-y-2 animate-in fade-in duration-150">
                  <span className="text-xs font-semibold text-zinc-300 block">
                    Select Service Charge Rate:
                  </span>
                  <div className="flex items-center gap-2">
                    {[5, 7, 10].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, serviceChargeRate: rate }))}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          taxSettings.serviceChargeRate === rate
                            ? 'bg-[#E46254] text-white border-[#E46254] shadow-2xs'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                    <div className="relative w-28">
                      <input
                        type="number"
                        placeholder="Custom %"
                        value={taxSettings.serviceChargeRate}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, serviceChargeRate: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-3 pr-6 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono outline-none focus:border-[#E46254]"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">%</span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Alcohol & State Liquor VAT */}
            <section className="bg-[#121215] p-5 sm:p-6 rounded-2xl border border-zinc-800/80 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#E46254]/10 text-[#E46254] text-[11px] font-black flex items-center justify-center border border-[#E46254]/30">
                      3
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                      <Wine size={16} className="text-amber-400" />
                      Alcohol / Bar Menu State VAT
                    </h2>
                  </div>
                  <p className="text-zinc-400 text-xs mt-1">
                    Alcohol is outside Indian GST. Applies state VAT rate (typically 10%–20%) to liquor while food stays at 5% GST.
                  </p>
                </div>

                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setTaxSettings(prev => ({ ...prev, alcoholVatEnabled: !prev.alcoholVatEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 mt-1 ${
                    taxSettings.alcoholVatEnabled ? 'bg-[#E46254]' : 'bg-zinc-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    taxSettings.alcoholVatEnabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* Liquor VAT Rate Options */}
              {taxSettings.alcoholVatEnabled && (
                <div className="pt-3 border-t border-zinc-800/80 space-y-2 animate-in fade-in duration-150">
                  <span className="text-xs font-semibold text-zinc-300 block">
                    State Liquor VAT Percentage:
                  </span>
                  <div className="flex items-center gap-2">
                    {[10, 18, 20].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, alcoholVatRate: rate }))}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          taxSettings.alcoholVatRate === rate
                            ? 'bg-[#E46254] text-white border-[#E46254] shadow-2xs'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                    <div className="relative w-28">
                      <input
                        type="number"
                        placeholder="Custom %"
                        value={taxSettings.alcoholVatRate}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, alcoholVatRate: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-3 pr-6 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono outline-none focus:border-[#E46254]"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">%</span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 4. Thermal Receipt Header & Footer Customizer */}
            <section className="bg-[#121215] p-5 sm:p-6 rounded-2xl border border-zinc-800/80 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#E46254]/10 text-[#E46254] text-[11px] font-black flex items-center justify-center border border-[#E46254]/30">
                    4
                  </span>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Printer size={16} className="text-blue-400" />
                    Thermal Bill Header & Footer Customizer
                  </h2>
                </div>
                <p className="text-zinc-400 text-xs mt-1">
                  Text printed at the top and bottom of your 80mm and 58mm thermal receipts.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Address & Contact Line (Header)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 12th Main, Indiranagar, Bengaluru · Ph: +91 98765 43210"
                    value={taxSettings.receiptAddress}
                    onChange={(e) => setTaxSettings(prev => ({ ...prev, receiptAddress: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#E46254] bg-zinc-900 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Custom Footer Message
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Thank you for dining with us! Follow @dailycafe"
                    value={taxSettings.receiptFooter}
                    onChange={(e) => setTaxSettings(prev => ({ ...prev, receiptFooter: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#E46254] bg-zinc-900 text-white text-xs"
                  />
                </div>
              </div>
            </section>

          </div>

          {/* Right Column (5 cols): Dynamic Live 80mm Thermal Receipt Preview */}
          <div className="xl:col-span-5 sticky top-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Printer size={13} className="text-[#E46254]" />
                Live 80mm Thermal Preview
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                REALTIME
              </span>
            </div>

            {/* Thermal Receipt Paper Card */}
            <div className="bg-[#FFFDF9] text-zinc-800 rounded-2xl p-6 shadow-2xl border border-zinc-200/80 font-mono text-xs select-none relative overflow-hidden">
              
              {/* Paper Top Dashed Serration */}
              <div className="border-b border-dashed border-zinc-300 pb-4 text-center space-y-1">
                <h3 className="font-black text-sm uppercase tracking-wide text-zinc-900">
                  {restaurantName || 'TABLETAPY CAFE'}
                </h3>
                <p className="text-[10.5px] text-zinc-600 max-w-[280px] mx-auto leading-tight">
                  {taxSettings.receiptAddress || '12th Main, 100ft Road, Bengaluru · Ph: +91 98765 43210'}
                </p>
                
                {taxSettings.gstin && (
                  <p className="text-[10px] font-bold text-zinc-700 tracking-wider">
                    GSTIN: {taxSettings.gstin}
                  </p>
                )}

                {taxSettings.fssai && (
                  <p className="text-[10px] text-zinc-600">
                    FSSAI Lic: {taxSettings.fssai}
                  </p>
                )}
              </div>

              {/* Bill Meta */}
              <div className="py-2.5 border-b border-dashed border-zinc-300 text-[10.5px] flex items-center justify-between text-zinc-600">
                <div>
                  <span className="block font-bold text-zinc-800">BILL #1042</span>
                  <span>Table #04 (Dine-In)</span>
                </div>
                <div className="text-right">
                  <span>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span className="block">08:42 PM</span>
                </div>
              </div>

              {/* Sample Line Items */}
              <div className="py-3 border-b border-dashed border-zinc-300 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center text-zinc-900">
                  <div className="flex-1 pr-2 truncate">
                    <span>1x Artisanal Cappuccino</span>
                  </div>
                  <span className="font-bold">₹180.00</span>
                </div>

                <div className="flex justify-between items-center text-zinc-900">
                  <div className="flex-1 pr-2 truncate">
                    <span>1x Truffle Fries</span>
                  </div>
                  <span className="font-bold">₹220.00</span>
                </div>

                {taxSettings.alcoholVatEnabled && (
                  <div className="flex justify-between items-center text-zinc-900">
                    <div className="flex-1 pr-2 truncate flex items-center gap-1">
                      <span>1x Craft Draught Beer</span>
                      <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">VAT</span>
                    </div>
                    <span className="font-bold">₹350.00</span>
                  </div>
                )}
              </div>

              {/* Financial Calculations */}
              <div className="py-3 border-b border-dashed border-zinc-300 space-y-1 text-[11px] text-zinc-600">
                <div className="flex justify-between">
                  <span>Items Subtotal:</span>
                  <span>₹{sampleCalc.subtotal.toFixed(2)}</span>
                </div>

                {sampleCalc.serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-zinc-700">
                    <span>Service Charge ({taxSettings.serviceChargeRate}%):</span>
                    <span>₹{sampleCalc.serviceChargeAmount.toFixed(2)}</span>
                  </div>
                )}

                {/* GST Calculations */}
                {!sampleCalc.isComposition && sampleCalc.totalGst > 0 && (
                  <>
                    <div className="flex justify-between text-zinc-700">
                      <span>CGST ({sampleCalc.effectiveCgstRate}%):</span>
                      <span>₹{sampleCalc.cgstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-700">
                      <span>SGST ({sampleCalc.effectiveSgstRate}%):</span>
                      <span>₹{sampleCalc.sgstAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {/* Composition Scheme Disclaimer */}
                {sampleCalc.isComposition && (
                  <div className="flex justify-between text-zinc-500 italic text-[10px]">
                    <span>GST (Composition):</span>
                    <span>₹0.00</span>
                  </div>
                )}

                {/* State Liquor VAT */}
                {sampleCalc.alcoholVatAmount > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>State Liquor VAT ({taxSettings.alcoholVatRate}%):</span>
                    <span>₹{sampleCalc.alcoholVatAmount.toFixed(2)}</span>
                  </div>
                )}

                {/* Inclusive Tax Notice */}
                {sampleCalc.isInclusive && (
                  <div className="text-[9.5px] text-zinc-500 pt-0.5 italic">
                    *Taxes included in item prices (CGST ₹{sampleCalc.cgstAmount.toFixed(2)} + SGST ₹{sampleCalc.sgstAmount.toFixed(2)})
                  </div>
                )}
              </div>

              {/* Grand Total */}
              <div className="py-3 border-b-2 border-dashed border-zinc-800 flex justify-between items-baseline font-black text-sm text-zinc-950">
                <span>TOTAL PAYABLE:</span>
                <span className="text-base font-mono">₹{sampleCalc.grandTotal.toFixed(2)}</span>
              </div>

              {/* Composition Statutory Note */}
              {sampleCalc.isComposition && (
                <div className="pt-2 text-[9px] text-center text-zinc-500 italic">
                  Composition Taxable Person - Not eligible to collect tax on supplies
                </div>
              )}

              {/* Custom Footer */}
              <div className="pt-4 text-center space-y-2">
                <p className="text-[10px] text-zinc-500 leading-tight">
                  {taxSettings.receiptFooter || 'Thank you for dining with us! Visit again.'}
                </p>
                <div className="text-[9px] font-bold text-zinc-400 tracking-wider">
                  POWERED BY TABLETAPY POS
                </div>
              </div>

              {/* Realistic Bottom Paper Tear Visual Effect */}
              <div className="absolute -bottom-1 left-0 right-0 h-2 bg-radial from-transparent to-black/5" />
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: BILLING & PAYMENT WORKFLOW (PRESERVED & ENHANCED) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'WORKFLOW' && (
        <div className="space-y-6">
          <section className="bg-[#121215] p-6 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                  <Receipt size={19} className="text-[#E46254]" />
                  Billing & Payment Workflow
                </h2>
                <p className="text-zinc-400 text-sm mt-0.5">
                  Choose how guests at tables request and settle their bills.
                </p>
              </div>
              <span className="hidden sm:inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                0% Gateway Fees
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {/* Mode 1: Staff-Assisted Tabletop Settle (Koi Resto-Bar flow) */}
              <div 
                onClick={() => setBillingMode('STAFF_ASSISTED')}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  billingMode === 'STAFF_ASSISTED' 
                    ? 'border-[#E46254] bg-[#E46254]/5 shadow-[0_0_25px_rgba(228,98,84,0.12)]' 
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#E46254] text-white">
                      Recommended · Staff Flow
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      billingMode === 'STAFF_ASSISTED' ? 'border-[#E46254] bg-[#E46254]' : 'border-zinc-600'
                    }`}>
                      {billingMode === 'STAFF_ASSISTED' && <Check size={12} className="text-white stroke-[3]" />}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Banknote size={17} className="text-amber-400" />
                    Staff-Assisted Tabletop Settle
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Guests review itemized tab on their phone and tap <strong>&ldquo;Request Bill to Table&rdquo;</strong>. Floor captain arrives with your Paytm/Pine Labs EDC, cash folder, or collects via Captain app.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center gap-3 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1"><CreditCard size={12} /> Paytm / EDC Machine</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Banknote size={12} /> Cash Folder</span>
                </div>
              </div>

              {/* Mode 2: Guest Digital Self-Pay */}
              <div 
                onClick={() => setBillingMode('SELF_PAY')}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  billingMode === 'SELF_PAY' 
                    ? 'border-[#E46254] bg-[#E46254]/5 shadow-[0_0_25px_rgba(228,98,84,0.12)]' 
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                      Self-Service
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      billingMode === 'SELF_PAY' ? 'border-[#E46254] bg-[#E46254]' : 'border-zinc-600'
                    }`}>
                      {billingMode === 'SELF_PAY' && <Check size={12} className="text-white stroke-[3]" />}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Smartphone size={17} className="text-emerald-400" />
                    Guest Digital Self-Pay
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Guests pay directly in-browser via 1-tap UPI deep link (GPay, PhonePe, Paytm) with pre-filled bill amount, or scan on-screen QR. Staff verifies payment at table or soundbox.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center gap-3 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1"><Smartphone size={12} /> 1-Tap UPI App</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><QrCode size={12} /> Dynamic QR</span>
                </div>
              </div>
            </div>

            {/* UPI ID / Merchant VPA configuration */}
            <div className="mt-6 pt-5 border-t border-zinc-800/80">
              <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                Restaurant UPI VPA / Merchant ID (0% MDR)
              </label>
              <p className="text-xs text-zinc-500 mb-3">
                UPI payments and Dynamic QR codes will direct straight to your bank account without gateway cuts.
              </p>
              <input 
                type="text" 
                placeholder="e.g. restaurantname@okhdfcbank or 9876543210@paytm"
                value={upiId} 
                onChange={e => setUpiId(e.target.value)}
                className="w-full sm:max-w-md p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#E46254] bg-zinc-900 text-white text-sm" 
              />
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: BRAND IDENTITY & CORE INFO (PRESERVED & ENHANCED) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'BRAND' && (
        <div className="space-y-6">
          {/* BRAND IDENTITY */}
          <section className="bg-[#121215] p-6 rounded-2xl border border-zinc-800/80">
            <h2 className="text-lg font-bold mb-1">Brand Identity</h2>
            <p className="text-zinc-500 text-sm mb-6">Customize the look of your diner-facing menu.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Restaurant Logo</label>
                <button className="w-full h-32 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-white hover:border-zinc-500 transition-colors bg-zinc-900/50 cursor-pointer">
                  <UploadCloud size={24} />
                  <span className="text-sm font-medium">Click to upload transparent PNG</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Primary Brand Color</label>
                <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                  Applied to call-to-action buttons, prices, and interactive highlights.
                </p>
                
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-600 flex items-center justify-center hover:border-white transition-colors cursor-pointer shrink-0">
                      <Pipette size={18} className="text-zinc-300" />
                      <input 
                        type="color" 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150" 
                        value={primaryColor} 
                        onChange={(e) => setPrimaryColor(e.target.value)} 
                      />
                  </div>
                  <div className="w-px h-8 bg-zinc-800" />
                  <div className="flex flex-wrap gap-2">
                    {['#E46254', '#3b82f6', '#10b981', '#facc15', '#ec4899', '#ffffff'].map(color => (
                      <button 
                        key={color} 
                        onClick={() => setPrimaryColor(color)} 
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                          primaryColor === color ? 'border-white scale-110' : 'border-transparent'
                        }`} 
                        style={{ backgroundColor: color }} 
                      >
                          {primaryColor === color && <Check size={16} className={color === '#ffffff' || color === '#facc15' ? 'text-black' : 'text-white'} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RESTAURANT PROFILE */}
          <section className="bg-[#121215] p-6 rounded-2xl border border-zinc-800/80">
            <h2 className="text-lg font-bold mb-4">Core Store Information</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Restaurant Name</label>
                <input 
                  type="text" 
                  value={restaurantName} 
                  onChange={e => setRestaurantName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#E46254] bg-zinc-900 text-white text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Live Subdomain URL</label>
                <div className="flex">
                  <input 
                    type="text" 
                    value={restaurantSlug} 
                    onChange={e => setRestaurantSlug(e.target.value)}
                    className="flex-1 p-3 rounded-l-xl border border-zinc-800 border-r-0 focus:outline-none focus:border-[#E46254] bg-zinc-900 text-white text-sm" 
                  />
                  <div className="bg-zinc-800 p-3 rounded-r-xl border border-zinc-800 font-medium text-zinc-400 text-sm">.tabletapy.com</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
