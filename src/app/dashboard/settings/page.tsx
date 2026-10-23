"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Receipt, 
  CreditCard, 
  Sparkles, 
  Check, 
  Loader2, 
  Percent, 
  Wine, 
  Store, 
  Printer,
  ShieldCheck,
  KeyRound,
  UserCheck,
  Smartphone,
  Monitor,
  Info,
  CheckCircle2,
  Lock,
  ArrowRight
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
  const [activeTab, setActiveTab] = useState<'TAXES' | 'SECURITY' | 'HARDWARE' | 'BRAND'>('TAXES');
  
  // General & Brand Settings
  const [primaryColor, setPrimaryColor] = useState('#E46254');
  const [restaurantName, setRestaurantName] = useState('The Daily Café');
  const [restaurantSlug, setRestaurantSlug] = useState('dailycafe');
  const [upiId, setUpiId] = useState('');
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [phone, setPhone] = useState('');
  
  // QR Menu Order Security Mode: 'PIN_DIRECT_FIRE' vs 'OPEN_STAFF_APPROVAL'
  const [qrOrderMode, setQrOrderMode] = useState<'PIN_DIRECT_FIRE' | 'OPEN_STAFF_APPROVAL'>('PIN_DIRECT_FIRE');

  // Billing & Settlement Mode: 'STAFF_ASSISTED' or 'SELF_PAY'
  const [billingMode, setBillingMode] = useState<'STAFF_ASSISTED' | 'SELF_PAY'>('STAFF_ASSISTED');

  // Hardware & Printing
  const [paperWidth, setPaperWidth] = useState<'80MM' | '58MM'>('80MM');
  const [printCopies, setPrintCopies] = useState<1 | 2>(1);
  const [autoPrintOnSettle, setAutoPrintOnSettle] = useState(false);

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
            if (rest.phone) setPhone(rest.phone);
          }

          // Load QR Order Security Mode
          const savedQrMode = localStorage.getItem(`tabletapy_qr_order_mode_${restId}`);
          if (savedQrMode === 'PIN_DIRECT_FIRE' || savedQrMode === 'OPEN_STAFF_APPROVAL') {
            setQrOrderMode(savedQrMode);
          }

          // Load Billing Mode
          const savedMode = localStorage.getItem(`tabletapy_billing_mode_${restId}`);
          if (savedMode === 'SELF_PAY' || savedMode === 'STAFF_ASSISTED') {
            setBillingMode(savedMode);
          }

          // Load Hardware settings
          const savedPaper = localStorage.getItem(`tabletapy_paper_width_${restId}`);
          if (savedPaper === '80MM' || savedPaper === '58MM') {
            setPaperWidth(savedPaper);
          }
          const savedCopies = localStorage.getItem(`tabletapy_print_copies_${restId}`);
          if (savedCopies === '2') {
            setPrintCopies(2);
          }
          const savedAutoPrint = localStorage.getItem(`tabletapy_autoprint_${restId}`);
          if (savedAutoPrint === 'true') {
            setAutoPrintOnSettle(true);
          }

          const loadedTaxes = getStoredTaxSettings(restId);
          setTaxSettings(loadedTaxes);
        } else {
          const genericQrMode = localStorage.getItem('tabletapy_qr_order_mode_default');
          if (genericQrMode === 'PIN_DIRECT_FIRE' || genericQrMode === 'OPEN_STAFF_APPROVAL') {
            setQrOrderMode(genericQrMode);
          }

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

      // 2. Save QR Order Security Mode & Billing Mode
      if (restaurantId) {
        localStorage.setItem(`tabletapy_qr_order_mode_${restaurantId}`, qrOrderMode);
        localStorage.setItem(`tabletapy_billing_mode_${restaurantId}`, billingMode);
        localStorage.setItem(`tabletapy_paper_width_${restaurantId}`, paperWidth);
        localStorage.setItem(`tabletapy_print_copies_${restaurantId}`, String(printCopies));
        localStorage.setItem(`tabletapy_autoprint_${restaurantId}`, String(autoPrintOnSettle));
      }
      localStorage.setItem('tabletapy_qr_order_mode_default', qrOrderMode);
      localStorage.setItem('tabletapy_billing_mode_default', billingMode);
      localStorage.setItem('tabletapy_paper_width_default', paperWidth);
      localStorage.setItem('tabletapy_print_copies_default', String(printCopies));
      localStorage.setItem('tabletapy_autoprint_default', String(autoPrintOnSettle));

      // 3. Update Supabase Restaurant Record
      if (restaurantId) {
        const updatePayload: Record<string, any> = {
          name: restaurantName,
          slug: restaurantSlug,
          primary_color: primaryColor,
          upi_id: upiId
        };

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

  // Live Sample Calculation for Receipt Preview
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
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-24">
      
      {/* ── STICKY TOP NAVIGATION DOCK (APPLE STYLE) ── */}
      <header className="sticky top-0 z-30 bg-[#FAFAFA]/90 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              Settings
            </h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
              Taxes, order security, POS hardware, and restaurant branding.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {saveSuccess && (
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 size={14} />
                <span>Saved successfully</span>
              </span>
            )}
            <button 
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>

        </div>

        {/* Apple-Style Segmented Tab Pills */}
        <div className="max-w-6xl mx-auto mt-3">
          <div className="inline-flex p-1 bg-zinc-200/60 rounded-xl overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('TAXES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'TAXES'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Receipt size={13} strokeWidth={1.75} />
              <span>Taxes & Thermal Bill</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SECURITY')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'SECURITY'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ShieldCheck size={13} strokeWidth={1.75} />
              <span>QR Menu & Security</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('HARDWARE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'HARDWARE'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Printer size={13} strokeWidth={1.75} />
              <span>POS & Hardware</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BRAND')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'BRAND'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Store size={13} strokeWidth={1.75} />
              <span>Brand Profile</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 mt-8">

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 1: TAXES, GST & THERMAL RECEIPT ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'TAXES' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            
            {/* Left Column (7 cols): Clean Questionnaire */}
            <div className="xl:col-span-7 space-y-6">

              {/* 1. GST Registration Status */}
              <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                    GST Registration Scheme
                  </h2>
                  <p className="text-zinc-500 text-xs mt-1">
                    Select your cafe or restaurant taxation category under Indian GST law.
                  </p>
                </div>

                {/* 2 Focused Cards (Regular 5% vs Composition 0%) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  
                  {/* Regular GST (5%) */}
                  <div
                    onClick={() => setTaxSettings(prev => ({ ...prev, gstType: 'REGULAR', cgstRate: 2.5, sgstRate: 2.5 }))}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      taxSettings.gstType === 'REGULAR'
                        ? 'border-zinc-900 bg-zinc-50/70'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900">Regular GST (5%)</span>
                        {taxSettings.gstType === 'REGULAR' && (
                          <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Check size={10} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                        2.5% CGST + 2.5% SGST. Standard scheme for independent restaurants and cafes.
                      </p>
                    </div>
                    <span className="text-[10.5px] font-mono font-semibold text-zinc-600 mt-3 pt-2 border-t border-zinc-100">
                      Standard 5% Rate
                    </span>
                  </div>

                  {/* Composition Scheme (0%) */}
                  <div
                    onClick={() => setTaxSettings(prev => ({ ...prev, gstType: 'COMPOSITION', cgstRate: 0, sgstRate: 0 }))}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      taxSettings.gstType === 'COMPOSITION'
                        ? 'border-zinc-900 bg-zinc-50/70'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900">Composition (0%)</span>
                        {taxSettings.gstType === 'COMPOSITION' && (
                          <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Check size={10} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                        Zero tax collected on guest bills. Issues statutory "Bill of Supply" per GST section 10.
                      </p>
                    </div>
                    <span className="text-[10.5px] font-mono font-semibold text-zinc-600 mt-3 pt-2 border-t border-zinc-100">
                      0% on Guest Bill
                    </span>
                  </div>

                </div>

                {/* Exclusive vs Inclusive Pricing Mode */}
                {taxSettings.gstType === 'REGULAR' && (
                  <div className="pt-4 border-t border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-700 block mb-2">
                      Menu Price Display Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, pricingType: 'EXCLUSIVE' }))}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          taxSettings.pricingType === 'EXCLUSIVE'
                            ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        Exclusive (Add tax on top)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, pricingType: 'INCLUSIVE' }))}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          taxSettings.pricingType === 'INCLUSIVE'
                            ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        Inclusive (Tax baked into MRP)
                      </button>
                    </div>
                  </div>
                )}

                {/* Statutory Identifiers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      GSTIN (15 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g. 29AAAAA0000A1Z5"
                      value={taxSettings.gstin}
                      onChange={(e) => setTaxSettings(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all uppercase placeholder:text-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      FSSAI License (14 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={14}
                      placeholder="e.g. 11223344556677"
                      value={taxSettings.fssai}
                      onChange={(e) => setTaxSettings(prev => ({ ...prev, fssai: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>
              </section>

              {/* 2. Dine-In Service Charge */}
              <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Dine-In Service Charge
                    </h2>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      Optional staff fee strictly applied on Dine-In orders. Never charged on Takeaway.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTaxSettings(prev => ({ ...prev, serviceChargeEnabled: !prev.serviceChargeEnabled }))}
                    className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                      taxSettings.serviceChargeEnabled ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      taxSettings.serviceChargeEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {taxSettings.serviceChargeEnabled && (
                  <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600">Rate:</span>
                    {[5, 7, 10].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, serviceChargeRate: rate }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          taxSettings.serviceChargeRate === rate
                            ? 'bg-zinc-900 text-white font-semibold'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={25}
                        value={taxSettings.serviceChargeRate}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, serviceChargeRate: Math.max(0, parseFloat(e.target.value) || 0) }))}
                        className="w-16 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900"
                      />
                      <span className="text-xs text-zinc-400 ml-1.5 font-mono">%</span>
                    </div>
                  </div>
                )}
              </section>

              {/* 3. Alcohol Liquor VAT */}
              <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Alcohol & Liquor State VAT
                    </h2>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      State alcohol tax billed separately from GST if serving beer, cocktails, or spirits.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTaxSettings(prev => ({ ...prev, alcoholVatEnabled: !prev.alcoholVatEnabled }))}
                    className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                      taxSettings.alcoholVatEnabled ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      taxSettings.alcoholVatEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {taxSettings.alcoholVatEnabled && (
                  <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600">VAT Rate:</span>
                    {[10, 18, 20].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, alcoholVatRate: rate }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          taxSettings.alcoholVatRate === rate
                            ? 'bg-zinc-900 text-white font-semibold'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={taxSettings.alcoholVatRate}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, alcoholVatRate: Math.max(0, parseFloat(e.target.value) || 0) }))}
                        className="w-16 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900"
                      />
                      <span className="text-xs text-zinc-400 ml-1.5 font-mono">%</span>
                    </div>
                  </div>
                )}
              </section>

              {/* 4. Thermal Receipt Content */}
              <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                    Thermal Chit Header & Footer
                  </h2>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Printed address, phone number, and closing message on thermal slips.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Store Address & Contact (Header)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 104 Indiranagar 100ft Road, Bengaluru&#10;Ph: +91 98765 43210"
                      value={taxSettings.receiptAddress}
                      onChange={(e) => setTaxSettings(prev => ({ ...prev, receiptAddress: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder:text-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Custom Footer Greeting
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Thank you for dining with us! Tag @yourcafe on Instagram"
                      value={taxSettings.receiptFooter}
                      onChange={(e) => setTaxSettings(prev => ({ ...prev, receiptFooter: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>
              </section>

            </div>

            {/* Right Column (5 cols): Live 80mm Thermal Receipt Preview */}
            <div className="xl:col-span-5 sticky top-28">
              <div className="bg-[#FFFDF9] border border-zinc-300 rounded-2xl p-6 shadow-sm text-zinc-900 font-mono text-xs relative">
                
                {/* Paper Header Pin */}
                <div className="text-center pb-3 border-b border-dashed border-zinc-300 space-y-1">
                  <h3 className="font-bold text-sm tracking-wider uppercase text-zinc-900">
                    {restaurantName}
                  </h3>
                  {taxSettings.receiptAddress ? (
                    <p className="text-[10px] text-zinc-600 whitespace-pre-line leading-tight">
                      {taxSettings.receiptAddress}
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-400 italic">Address printed here</p>
                  )}

                  {taxSettings.gstin && (
                    <div className="text-[10px] font-bold text-zinc-800 pt-0.5">
                      GSTIN: {taxSettings.gstin}
                    </div>
                  )}

                  {taxSettings.fssai && (
                    <div className="text-[9.5px] text-zinc-600">
                      FSSAI: {taxSettings.fssai}
                    </div>
                  )}

                  <div className="pt-1.5">
                    <span className="font-bold text-xs uppercase tracking-wide">
                      {taxSettings.gstType === 'COMPOSITION' ? '*** BILL OF SUPPLY ***' : '*** TAX INVOICE ***'}
                    </span>
                    {taxSettings.gstType === 'COMPOSITION' && (
                      <p className="text-[8.5px] text-zinc-600 uppercase font-sans mt-0.5">
                        Composition Taxable Person, Not Eligible To Collect Tax On Supplies
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between text-[10px] text-zinc-600 pt-1 font-sans">
                    <span>Table 04 (Dine-In)</span>
                    <span>12:45 PM</span>
                  </div>
                </div>

                {/* Sample Items Table */}
                <div className="py-2.5 border-b border-dashed border-zinc-300 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span>1x Truffle Pasta</span>
                    <span className="font-semibold">₹220.00</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>1x Artisan Cold Brew</span>
                    <span className="font-semibold">₹180.00</span>
                  </div>
                  {taxSettings.alcoholVatEnabled && (
                    <div className="flex justify-between text-[11px]">
                      <span>1x Craft Draught Pint</span>
                      <span className="font-semibold">₹350.00</span>
                    </div>
                  )}
                </div>

                {/* Calculation Breakdown */}
                <div className="py-2.5 border-b border-dashed border-zinc-300 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{sampleCalc.subtotal.toFixed(2)}</span>
                  </div>

                  {taxSettings.serviceChargeEnabled && sampleCalc.serviceChargeAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Service Charge ({taxSettings.serviceChargeRate}%)</span>
                      <span>₹{sampleCalc.serviceChargeAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {sampleCalc.isComposition ? (
                    <div className="flex justify-between text-[10px] italic text-zinc-500">
                      <span>GST (Composition 0%)</span>
                      <span>₹0.00</span>
                    </div>
                  ) : sampleCalc.isInclusive ? (
                    <>
                      <div className="flex justify-between text-[10px] text-zinc-600">
                        <span>GST ({sampleCalc.effectiveCgstRate + sampleCalc.effectiveSgstRate}%)</span>
                        <span className="font-sans font-medium text-zinc-600">Included in Price</span>
                      </div>
                      <div className="text-[9.5px] text-zinc-500 pl-2">
                        (CGST {sampleCalc.effectiveCgstRate}%: ₹{sampleCalc.cgstAmount.toFixed(2)} + SGST {sampleCalc.effectiveSgstRate}%: ₹{sampleCalc.sgstAmount.toFixed(2)})
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>CGST ({sampleCalc.effectiveCgstRate}%)</span>
                        <span>₹{sampleCalc.cgstAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST ({sampleCalc.effectiveSgstRate}%)</span>
                        <span>₹{sampleCalc.sgstAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {sampleCalc.alcoholVatAmount > 0 && (
                    <div className="flex justify-between text-zinc-700">
                      <span>State Alcohol VAT ({taxSettings.alcoholVatRate}%)</span>
                      <span>₹{sampleCalc.alcoholVatAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {sampleCalc.roundOff !== 0 && (
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>Round-off</span>
                      <span>{sampleCalc.roundOff > 0 ? `+₹${sampleCalc.roundOff}` : `-₹${Math.abs(sampleCalc.roundOff)}`}</span>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="pt-2 flex justify-between items-baseline font-bold text-sm">
                  <span>Grand Total</span>
                  <span className="text-base font-black">₹{sampleCalc.grandTotal}</span>
                </div>

                {/* Footer Message */}
                <div className="text-center pt-4 text-[10px] text-zinc-600 font-sans leading-tight">
                  {taxSettings.receiptFooter || "Thank you for dining with us! Visit again."}
                </div>

                {/* Paper Tear Serration Visual */}
                <div className="mt-4 pt-2 border-t border-dotted border-zinc-300 flex justify-center text-[9px] text-zinc-400 font-sans tracking-widest uppercase">
                  80mm Live Thermal Preview
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 2: QR MENU & ORDER SECURITY ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'SECURITY' && (
          <div className="max-w-3xl space-y-6">
            
            {/* 1. Menu Ordering Mode: PIN vs Staff Approval */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 sm:p-7 shadow-xs space-y-5">
              <div>
                <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                  QR Menu Ordering & Prank-Protection Mode
                </h2>
                <p className="text-zinc-500 text-xs mt-1">
                  Choose how guest table orders are verified before items reach the kitchen.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Option 1: 4-Digit Table PIN (Direct Fire) */}
                <div
                  onClick={() => setQrOrderMode('PIN_DIRECT_FIRE')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    qrOrderMode === 'PIN_DIRECT_FIRE'
                      ? 'border-zinc-900 bg-zinc-50/70 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                        <KeyRound size={16} strokeWidth={2} />
                      </div>
                      {qrOrderMode === 'PIN_DIRECT_FIRE' && (
                        <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">
                        4-Digit Table PIN
                      </h3>
                      <span className="inline-block mt-0.5 text-[10.5px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Direct Kitchen Fire
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests enter the 4-digit PIN printed on their table stand. Confirms physical presence and fires items instantly to Kitchen KDS with zero staff delay.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] font-medium text-zinc-600">
                    Recommended for busy dining rush
                  </div>
                </div>

                {/* Option 2: Open Menu (Staff Approval Queue) */}
                <div
                  onClick={() => setQrOrderMode('OPEN_STAFF_APPROVAL')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    qrOrderMode === 'OPEN_STAFF_APPROVAL'
                      ? 'border-zinc-900 bg-zinc-50/70 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                        <UserCheck size={16} strokeWidth={2} />
                      </div>
                      {qrOrderMode === 'OPEN_STAFF_APPROVAL' && (
                        <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">
                        Open Menu
                      </h3>
                      <span className="inline-block mt-0.5 text-[10.5px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                        Staff Approval Queue
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests order instantly without entering a PIN. Orders enter a pending queue on POS & Captain screens where staff click Accept or Reject to prevent prank orders.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] font-medium text-zinc-600">
                    Ideal for patio & zero-barrier cafes
                  </div>
                </div>

              </div>
            </section>

            {/* 2. Guest Payment & Settlement Flow */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 sm:p-7 shadow-xs space-y-5">
              <div>
                <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                  Guest Billing & Payment Workflow
                </h2>
                <p className="text-zinc-500 text-xs mt-1">
                  Choose how table guests settle their check.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Staff-Assisted */}
                <div
                  onClick={() => setBillingMode('STAFF_ASSISTED')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    billingMode === 'STAFF_ASSISTED'
                      ? 'border-zinc-900 bg-zinc-50/70 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                        <CreditCard size={16} strokeWidth={2} />
                      </div>
                      {billingMode === 'STAFF_ASSISTED' && (
                        <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">
                        Staff-Assisted Checkout
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Guest taps "Request Bill" from their phone. Floor captain brings the paper check or collects Cash / Card / UPI at the counter.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Self-Pay UPI */}
                <div
                  onClick={() => setBillingMode('SELF_PAY')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    billingMode === 'SELF_PAY'
                      ? 'border-zinc-900 bg-zinc-50/70 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                        <Smartphone size={16} strokeWidth={2} />
                      </div>
                      {billingMode === 'SELF_PAY' && (
                        <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">
                        Self-Pay Digital UPI
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Guest scans dynamic UPI QR from their phone via Google Pay or PhonePe. Order auto-clears once payment is verified.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </section>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 3: POS & HARDWARE (TOUCHSCREEN PLACEHOLDER) ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'HARDWARE' && (
          <div className="max-w-3xl space-y-6">

            {/* 1. Touchscreen Monitor & On-Screen Numpad Placeholder */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Touchscreen Monitor & On-Screen Numpad
                    </h2>
                    <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                      Desktop App Preview
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                    Designed for touch all-in-one monitors where cashiers don't use a physical keyboard. Automatically opens an on-screen touch dial for entering quantities, table numbers, phone digits, and cash tender amounts.
                  </p>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
                  <Monitor size={20} strokeWidth={1.75} />
                </div>
              </div>

              {/* Realistic Touchscreen Numpad Preview (Apple-style clean mockup) */}
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-left">
                  <div className="text-xs font-semibold text-zinc-800">
                    Touch Keypad Ergonomics
                  </div>
                  <p className="text-[11.5px] text-zinc-500 max-w-sm leading-relaxed">
                    When active in the upcoming TableTapy Desktop App, clicking any numeric field on POS immediately floats this large touch numpad to eliminate keyboard reach.
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[11px] font-medium text-zinc-400">
                    <Info size={13} />
                    <span>Included in TableTapy Desktop App release</span>
                  </div>
                </div>

                {/* The Dummy Touch Numpad */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-xs shrink-0 w-48 space-y-2 select-none pointer-events-none opacity-85">
                  <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-xs text-zinc-800">
                    Qty: 2
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold font-mono text-zinc-700">
                    {['1','2','3','4','5','6','7','8','9','C','0','00'].map((btn) => (
                      <div
                        key={btn}
                        className="h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shadow-2xs"
                      >
                        {btn}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Thermal Printer Paper Width & Copies */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 sm:p-7 shadow-xs space-y-5">
              <div>
                <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                  Thermal Chit Printing Preferences
                </h2>
                <p className="text-zinc-500 text-xs mt-1">
                  Configure ESC/POS thermal receipt paper roll and copies.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 80mm standard */}
                <div
                  onClick={() => setPaperWidth('80MM')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    paperWidth === '80MM'
                      ? 'border-zinc-900 bg-zinc-50/70'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">80mm (3-Inch Standard)</span>
                    {paperWidth === '80MM' && (
                      <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Standard high-speed desktop receipt printer (Epson, TVS, Rugtek).
                  </p>
                </div>

                {/* 58mm compact */}
                <div
                  onClick={() => setPaperWidth('58MM')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    paperWidth === '58MM'
                      ? 'border-zinc-900 bg-zinc-50/70'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">58mm (2-Inch Mobile)</span>
                    {paperWidth === '58MM' && (
                      <div className="w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Compact portable Bluetooth or pocket handheld thermal printer.
                  </p>
                </div>

              </div>

              <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Print Copies</span>
                  <span className="text-[11px] text-zinc-500">Number of chit copies generated per table bill</span>
                </div>

                <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPrintCopies(1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      printCopies === 1
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    1 Copy (Guest Bill)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintCopies(2)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      printCopies === 2
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    2 Copies (Guest + Store)
                  </button>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 4: BRAND & PROFILE ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'BRAND' && (
          <div className="max-w-2xl bg-white rounded-2xl border border-zinc-200/80 p-6 sm:p-7 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                Restaurant Brand Identity
              </h2>
              <p className="text-zinc-500 text-xs mt-1">
                Name, menu slug, accent color, and UPI settlement details.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Restaurant Display Name
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="e.g. The Daily Café"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Digital Menu Slug URL
                </label>
                <div className="flex items-center">
                  <span className="px-3.5 py-2.5 bg-zinc-100 border border-r-0 border-zinc-200 rounded-l-xl text-xs text-zinc-500 select-none">
                    tabletapy.com/r/
                  </span>
                  <input
                    type="text"
                    value={restaurantSlug}
                    onChange={(e) => setRestaurantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="dailycafe"
                    className="flex-1 px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-r-xl text-xs sm:text-sm text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Merchant UPI VPA ID (For Direct Payments)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. businessname@okaxis or merchant@hdfcbank"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Theme Brand Color
                </label>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-xl border border-zinc-300 shadow-2xs shrink-0 cursor-pointer overflow-hidden relative"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <input 
                      type="color" 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-32 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all uppercase"
                  />
                  <div className="flex items-center gap-1.5">
                    {['#E46254', '#2563EB', '#16A34A', '#D97706', '#9333EA', '#18181B'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPrimaryColor(c)}
                        className={`w-6 h-6 rounded-lg transition-transform cursor-pointer border ${
                          primaryColor === c ? 'scale-110 border-zinc-900 ring-2 ring-zinc-400/30' : 'border-zinc-200'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
