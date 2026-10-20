"use client";

import { useState, useEffect } from "react";
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
  Loader2
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function SettingsPage() {
  const supabase = createClient();
  const [primaryColor, setPrimaryColor] = useState('#E46254');
  const [restaurantName, setRestaurantName] = useState('The Daily Café');
  const [restaurantSlug, setRestaurantSlug] = useState('dailycafe');
  const [upiId, setUpiId] = useState('');
  const [restaurantId, setRestaurantId] = useState<string>('');
  
  // Billing & Settlement Mode: 'STAFF_ASSISTED' (Koi Resto-Bar flow) or 'SELF_PAY' (Guest In-App)
  const [billingMode, setBillingMode] = useState<'STAFF_ASSISTED' | 'SELF_PAY'>('STAFF_ASSISTED');
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
        } else {
          const genericMode = localStorage.getItem('tabletapy_billing_mode_default');
          if (genericMode === 'SELF_PAY' || genericMode === 'STAFF_ASSISTED') {
            setBillingMode(genericMode);
          }
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
      if (restaurantId) {
        localStorage.setItem(`tabletapy_billing_mode_${restaurantId}`, billingMode);
        await supabase.from('restaurants').update({
          name: restaurantName,
          slug: restaurantSlug,
          primary_color: primaryColor,
          upi_id: upiId
        }).eq('id', restaurantId);
      }
      localStorage.setItem('tabletapy_billing_mode_default', billingMode);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto min-h-screen text-white animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Restaurant Settings</h1>
          <p className="text-zinc-400 text-sm">Configure your dining workflows, payment methods, and brand identity.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-[#E46254] text-white font-bold rounded-xl text-sm hover:bg-[#c95346] transition-all shadow-[0_0_20px_rgba(228,98,84,0.3)] flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-70"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : saveSuccess ? (
            <>
              <Check size={16} className="text-white" />
              <span>Saved!</span>
            </>
          ) : (
            <span>Save Changes</span>
          )}
        </button>
      </div>
      
      <div className="space-y-8">

        {/* ── BILLING & PAYMENT MODES (NEW: STAFF-ASSISTED VS SELF-PAY) ── */}
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
                    Recommended · Koi Flow
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
          <h2 className="text-lg font-bold mb-4">Core Information</h2>
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
    </div>
  );
}
