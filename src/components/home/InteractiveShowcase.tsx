'use client';

import { useState } from "react";
import { 
  Printer, 
  Flame, 
  QrCode, 
  Layers, 
  Smartphone, 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  Sparkles, 
  Zap, 
  ShieldAlert, 
  IndianRupee,
  Receipt,
  UtensilsCrossed,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  Bell
} from "lucide-react";

export function InteractiveShowcase() {
  const [activeTab, setActiveTab] = useState<'pos' | 'tables' | 'delivery' | 'kds'>('pos');
  const [selectedItem, setSelectedItem] = useState<string>('all');
  const [dualPrintSimulated, setDualPrintSimulated] = useState<boolean>(false);

  return (
    <div className="w-full relative">
      {/* Tab Navigation Pill Bar with Frosted Glass & Refraction */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1.5 rounded-2xl backdrop-blur-3xl bg-zinc-950/70 border border-white/[0.08] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12),inset_0_-1px_1px_0_rgba(0,0,0,0.6)] overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'pos'
                ? 'bg-gradient-to-r from-[#E46254] to-[#C2410C] text-white shadow-lg shadow-[#E46254]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Zap size={15} /> Quick POS &amp; Dual Print
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'tables'
                ? 'bg-gradient-to-r from-[#E46254] to-[#C2410C] text-white shadow-lg shadow-[#E46254]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <UtensilsCrossed size={15} /> Floor &amp; Table Cockpit
          </button>

          <button
            onClick={() => setActiveTab('delivery')}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'delivery'
                ? 'bg-gradient-to-r from-[#E46254] to-[#C2410C] text-white shadow-lg shadow-[#E46254]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Smartphone size={15} /> UrbanPiper Delivery Hub
          </button>

          <button
            onClick={() => setActiveTab('kds')}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'kds'
                ? 'bg-gradient-to-r from-[#E46254] to-[#C2410C] text-white shadow-lg shadow-[#E46254]/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <ChefHat size={15} /> Kitchen Display (KDS)
          </button>
        </div>
      </div>

      {/* Main Terminal Frame with Deep Layered Glassmorphism & Caustic Glow */}
      <div className="relative rounded-3xl p-1 bg-gradient-to-b from-white/[0.14] via-white/[0.03] to-white/[0.08] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)]">
        
        {/* Glow backdrop behind frame */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#E46254]/20 via-amber-500/10 to-[#E46254]/20 blur-2xl opacity-60 pointer-events-none -z-10" />

        <div className="relative rounded-[22px] backdrop-blur-3xl bg-zinc-950/85 border border-white/[0.06] p-4 sm:p-6 overflow-hidden min-h-[580px] flex flex-col justify-between">
          
          {/* Mock Window Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-3 text-xs font-mono text-zinc-400 font-medium">
                tabletapy-terminal.internal // {activeTab.toUpperCase()}_ENGINE
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                EDGE SYNC: 18ms
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.04] text-zinc-300 border border-white/[0.06] font-mono text-[11px]">
                <Printer size={12} className="text-[#E46254]" /> ESC/POS AUTO-CUT READY
              </span>
            </div>
          </div>

          {/* TAB 1: QUICK POS & DUAL PRINT */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
              {/* Left Column: POS Item Grid */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {/* Search & Mode Toggles */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs">
                    <span className="px-3 py-1 rounded-lg bg-[#E46254] text-white font-medium shadow-sm">
                      ⚡ QSR Counter (Token #042)
                    </span>
                    <span className="px-3 py-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer">
                      🍽️ Dine-In (Table)
                    </span>
                  </div>

                  <span className="text-xs font-mono text-zinc-400">
                    Category: <strong className="text-white">Starters &amp; Mains</strong>
                  </span>
                </div>

                {/* Grid of Real Items */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: '1', name: 'Paneer Butter Masala', price: 290, veg: true, tag: 'Chef Special' },
                    { id: '2', name: 'Chicken Dum Biryani', price: 340, veg: false, tag: 'Bestseller' },
                    { id: '3', name: 'Crispy Zinger Roll', price: 180, veg: false, tag: 'Fast Prep' },
                    { id: '4', name: 'Butter Garlic Naan', price: 65, veg: true, tag: 'Tandoor' },
                    { id: '5', name: 'Cold Brew Hazelnut', price: 160, veg: true, tag: 'Beverage' },
                    { id: '6', name: 'Sizzling Brownie', price: 210, veg: true, tag: 'Dessert' },
                  ].map((dish) => (
                    <div
                      key={dish.id}
                      className="p-3.5 rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:border-[#E46254]/40 hover:bg-white/[0.05] transition-all cursor-pointer group flex flex-col justify-between h-28 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.06)]"
                    >
                      <div className="flex items-start justify-between">
                        <span className={`w-3 h-3 rounded-sm border flex items-center justify-center ${dish.veg ? 'border-emerald-500' : 'border-rose-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dish.veg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        </span>
                        <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-white/[0.04]">
                          {dish.tag}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-[#E46254] transition-colors line-clamp-1">
                          {dish.name}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-mono font-bold text-zinc-200">
                            ₹{dish.price}
                          </span>
                          <span className="w-5 h-5 rounded-md bg-[#E46254]/20 group-hover:bg-[#E46254] text-[#E46254] group-hover:text-white flex items-center justify-center text-xs font-bold transition-colors">
                            +
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Instant Cash Tenders Bar */}
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-medium">Quick Cash Tender:</span>
                  <div className="flex gap-2">
                    <button className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 font-mono border border-white/[0.06]">Exact (₹795)</button>
                    <button className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 font-mono border border-white/[0.06]">₹800 (Change ₹5)</button>
                    <button className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 font-mono border border-white/[0.06]">₹1000 (Change ₹205)</button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Order Summary & Dual Chits Preview */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="rounded-2xl backdrop-blur-2xl bg-zinc-900/60 border border-white/[0.08] p-4 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                      <div>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Current Ticket</span>
                        <p className="text-[11px] text-[#E46254] font-mono">TOKEN #042 • QSR WALK-IN</p>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">19:42 PM</span>
                    </div>

                    <div className="py-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-zinc-300">
                        <span>1x Chicken Dum Biryani</span>
                        <span className="font-mono">₹340</span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-300">
                        <span>1x Paneer Butter Masala</span>
                        <span className="font-mono">₹290</span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-300">
                        <span>1x Cold Brew Hazelnut</span>
                        <span className="font-mono">₹160</span>
                      </div>
                      <div className="pt-2 border-t border-dashed border-white/[0.08] flex justify-between items-center text-zinc-400 text-[11px]">
                        <span>GST (5%)</span>
                        <span className="font-mono">₹39.75</span>
                      </div>
                      <div className="flex justify-between items-center text-white font-bold text-sm pt-1">
                        <span>Total Payable</span>
                        <span className="font-mono text-[#E46254]">₹829.75</span>
                      </div>
                    </div>
                  </div>

                  {/* Dual Print Action Button */}
                  <div className="pt-3 border-t border-white/[0.06] space-y-2">
                    <button
                      onClick={() => setDualPrintSimulated(!dualPrintSimulated)}
                      className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#E46254] to-[#C2410C] hover:brightness-110 shadow-lg shadow-[#E46254]/30 flex items-center justify-center gap-2 transition-all"
                    >
                      <Printer size={15} />
                      {dualPrintSimulated ? '✓ Both Chits Dispatched' : 'Charge ₹830 & Dual Print (Bill + KOT)'}
                    </button>
                    <p className="text-[10px] text-center text-zinc-500 font-mono">
                      Single thermal stream • Hardware ESC/POS auto-cut sequence
                    </p>
                  </div>
                </div>

                {/* Visual Representation of the Dual Cut Chits */}
                <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                  {/* Chit 1: Customer Invoice */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between text-zinc-300 leading-tight">
                    <div>
                      <div className="flex justify-between items-center text-[9px] text-[#E46254] font-bold">
                        <span>CHIT 1 • TAX INVOICE</span>
                        <span>*CUT*</span>
                      </div>
                      <p className="text-center font-bold text-white text-xs mt-1">TOKEN #042</p>
                      <p className="text-center text-[9px] text-zinc-400">Customer Receipt</p>
                      <div className="border-b border-dashed border-zinc-700 my-1" />
                      <p>Subtotal: ₹790.00</p>
                      <p>Taxes (CGST+SGST): ₹39.75</p>
                      <p className="text-white font-bold mt-1">Paid: ₹830 (Cash)</p>
                    </div>
                    <span className="text-[9px] text-emerald-400 mt-2 block">✓ Hand to Customer</span>
                  </div>

                  {/* Chit 2: Kitchen KOT */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-amber-500/20 flex flex-col justify-between text-zinc-300 leading-tight">
                    <div>
                      <div className="flex justify-between items-center text-[9px] text-amber-400 font-bold">
                        <span>CHIT 2 • KITCHEN KOT</span>
                        <span>*CUT*</span>
                      </div>
                      <p className="text-center font-bold text-amber-300 text-xs mt-1">TOKEN #042</p>
                      <p className="text-center text-[9px] text-zinc-400">Order: Takeaway/QSR</p>
                      <div className="border-b border-dashed border-zinc-700 my-1" />
                      <p className="font-semibold text-white">[ ] 1x Biryani (Dum)</p>
                      <p className="font-semibold text-white">[ ] 1x Paneer Butter</p>
                      <p className="font-semibold text-white">[ ] 1x Cold Brew</p>
                    </div>
                    <span className="text-[9px] text-amber-400 mt-2 block">✓ Direct to Chef Pass</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FLOOR & TABLE COCKPIT */}
          {activeTab === 'tables' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Vacant (8)
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Dining / KOT Active (4)
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Bill Requested (2)
                  </span>
                </div>

                <div className="text-zinc-400 font-mono">
                  Floor: <strong className="text-white">Ground Hall &amp; Terrace Deck</strong>
                </div>
              </div>

              {/* Interactive Floor Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  { id: 'T-01', cap: '4 Pax', status: 'vacant', time: '0m', bill: '₹0' },
                  { id: 'T-02', cap: '2 Pax', status: 'vacant', time: '0m', bill: '₹0' },
                  { id: 'T-03', cap: '6 Pax', status: 'dining', time: '28m', bill: '₹1,420', kotCount: 2 },
                  { id: 'T-04', cap: '4 Pax', status: 'dining', time: '41m', bill: '₹2,890', kotCount: 3 },
                  { id: 'T-05', cap: '2 Pax', status: 'billed', time: '55m', bill: '₹950', kotCount: 1 },
                  { id: 'T-06', cap: '8 Pax', status: 'vacant', time: '0m', bill: '₹0' },
                  { id: 'T-07', cap: '4 Pax', status: 'billed', time: '49m', bill: '₹3,120', kotCount: 2 },
                  { id: 'T-08', cap: '2 Pax', status: 'dining', time: '14m', bill: '₹680', kotCount: 1 },
                ].map((table) => (
                  <div
                    key={table.id}
                    className={`p-4 rounded-2xl border backdrop-blur-xl transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-32 ${
                      table.status === 'dining'
                        ? 'bg-amber-500/[0.04] border-amber-500/30 shadow-[0_0_24px_rgba(245,158,11,0.08)]'
                        : table.status === 'billed'
                        ? 'bg-rose-500/[0.04] border-rose-500/30 shadow-[0_0_24px_rgba(244,63,94,0.08)]'
                        : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-base text-white">{table.id}</span>
                        <span className="text-[10px] text-zinc-400 block">{table.cap}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        table.status === 'dining'
                          ? 'bg-amber-500/20 text-amber-300'
                          : table.status === 'billed'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {table.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-end text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                          <Clock size={10} /> {table.time}
                        </span>
                        {table.kotCount && (
                          <span className="text-[10px] text-[#E46254] font-medium block">
                            {table.kotCount} KOTs Fired
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-white text-sm">
                        {table.bill}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: URBANPIPER DELIVERY HUB */}
          {activeTab === 'delivery' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
              {/* Left Column: Real-time Online Orders */}
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-white">Live Aggregator Stream</span>
                    <span className="text-zinc-500 font-mono">(Atlas Webhook v2)</span>
                  </div>
                  <span className="text-xs text-[#E46254] font-mono">2 Active Orders</span>
                </div>

                {/* Swiggy Card */}
                <div className="p-4 rounded-2xl backdrop-blur-2xl bg-white/[0.03] border border-orange-500/30 relative overflow-hidden shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#FC8019] text-white text-[11px] font-bold tracking-wider">
                        SWIGGY
                      </span>
                      <span className="font-mono text-xs text-white font-semibold">#SW-9842</span>
                      <span className="text-[11px] text-zinc-400 font-mono">• 2 Items</span>
                    </div>
                    <span className="text-xs font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 animate-pulse">
                      ⏱ Accept in 01:42
                    </span>
                  </div>

                  <div className="text-xs text-zinc-300 space-y-1 mb-4 font-sans">
                    <p>• 2x Hyderabadi Mutton Dum Biryani (Spicy)</p>
                    <p>• 1x Mirchi Ka Salan (Extra)</p>
                    <p className="text-[11px] text-amber-300 italic">Note: Please do not add cutlery / napkins.</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <div className="text-xs font-mono">
                      <span className="text-zinc-500">Order Total: </span>
                      <strong className="text-white">₹840.00</strong>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20">
                        Reject (86 Out)
                      </button>
                      <button className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 shadow-md">
                        Accept (Est. 20m) &amp; Print KOT
                      </button>
                    </div>
                  </div>
                </div>

                {/* Zomato Card */}
                <div className="p-4 rounded-2xl backdrop-blur-2xl bg-white/[0.03] border border-rose-500/30 relative overflow-hidden shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#E23744] text-white text-[11px] font-bold tracking-wider">
                        ZOMATO
                      </span>
                      <span className="font-mono text-xs text-white font-semibold">#ZM-4109</span>
                      <span className="text-[11px] text-zinc-400 font-mono">• 3 Items</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Food Ready • Rider Arrived
                    </span>
                  </div>

                  <div className="text-xs text-zinc-300 space-y-1 mb-4">
                    <p>• 1x Paneer Tikka Masala</p>
                    <p>• 3x Roomali Roti</p>
                    <p>• 1x Virgin Mojito</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <div className="text-xs">
                      <span className="text-zinc-400">Rider: </span>
                      <strong className="text-zinc-200">Sanjay Kumar (KA 05 EQ 8812)</strong>
                    </div>
                    <button className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#E46254] to-[#C2410C]">
                      Handover to Rider
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Instant 86 Inventory Lock */}
              <div className="lg:col-span-4 rounded-2xl backdrop-blur-2xl bg-zinc-900/60 border border-white/[0.08] p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                    <ShieldAlert size={16} className="text-[#E46254]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Instant 86 Stock Lock</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                    Toggle an item OFF in TableTapy, and UrbanPiper marks it unavailable on both Swiggy &amp; Zomato in &lt;10 seconds.
                  </p>

                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span className="text-white font-medium">Chicken Dum Biryani</span>
                      <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">In Stock</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/[0.05] border border-rose-500/20">
                      <span className="text-zinc-300 font-medium">Cold Brew Hazelnut</span>
                      <span className="text-[10px] font-mono text-rose-400 px-2 py-0.5 rounded bg-rose-500/10">86 Locked</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span className="text-white font-medium">Butter Garlic Naan</span>
                      <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">In Stock</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] font-mono text-zinc-500 block text-center">
                    Auto-sync active via UrbanPiper Partner Cloud
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KITCHEN DISPLAY SYSTEM (KDS) */}
          {activeTab === 'kds' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Flame size={15} className="text-[#E46254]" />
                  <span className="font-semibold text-white">Live Kitchen Prep Line</span>
                  <span className="text-zinc-500 font-mono">(Station: Main Cookery &amp; Tandoor)</span>
                </div>
                <span className="text-xs text-zinc-400 font-mono">Average Ticket Time: <strong className="text-emerald-400">11m 40s</strong></span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Ticket 1 */}
                <div className="p-4 rounded-2xl backdrop-blur-2xl bg-zinc-900/80 border border-amber-500/40 relative">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-white/[0.06]">
                    <span className="font-bold text-white">TABLE 04 • KOT #3</span>
                    <span className="text-amber-400 font-mono text-[11px] font-bold">⏱ 07m 14s</span>
                  </div>
                  <div className="py-3 space-y-2 text-xs text-zinc-200">
                    <p className="flex justify-between"><span>2x Paneer Tikka</span> <span className="font-mono text-zinc-400">Tandoor</span></p>
                    <p className="flex justify-between"><span>4x Butter Naan</span> <span className="font-mono text-zinc-400">Tandoor</span></p>
                    <p className="flex justify-between"><span>1x Dal Makhani</span> <span className="font-mono text-zinc-400">Curry</span></p>
                  </div>
                  <button className="w-full py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors">
                    Mark Station Done
                  </button>
                </div>

                {/* Ticket 2 */}
                <div className="p-4 rounded-2xl backdrop-blur-2xl bg-zinc-900/80 border border-emerald-500/40 relative">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-white/[0.06]">
                    <span className="font-bold text-white">TOKEN #042 • QSR WALK-IN</span>
                    <span className="text-emerald-400 font-mono text-[11px] font-bold">⏱ 02m 01s</span>
                  </div>
                  <div className="py-3 space-y-2 text-xs text-zinc-200">
                    <p className="flex justify-between"><span>1x Zinger Burger</span> <span className="font-mono text-zinc-400">Fryer</span></p>
                    <p className="flex justify-between"><span>1x Peri Peri Fries</span> <span className="font-mono text-zinc-400">Fryer</span></p>
                  </div>
                  <button className="w-full py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors">
                    Ready for Pickup Pass
                  </button>
                </div>

                {/* Ticket 3 */}
                <div className="p-4 rounded-2xl backdrop-blur-2xl bg-zinc-900/80 border border-white/[0.08] relative">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-white/[0.06]">
                    <span className="font-bold text-white">SWIGGY #SW-9842</span>
                    <span className="text-zinc-400 font-mono text-[11px]">⏱ 00m 45s</span>
                  </div>
                  <div className="py-3 space-y-2 text-xs text-zinc-200">
                    <p className="flex justify-between"><span>2x Chicken Dum Biryani</span> <span className="font-mono text-zinc-400">Biryani Pot</span></p>
                    <p className="text-[11px] text-amber-300 italic">Chef Note: Pack Gravy Separately</p>
                  </div>
                  <button className="w-full py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-white/[0.08]">
                    In Cooking
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Footer Info Strip inside Mock Window */}
          <div className="pt-4 border-t border-white/[0.06] mt-5 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E46254]" />
              <span>Real-time Supabase Realtime Channel: <code className="text-zinc-300 font-mono">pos_sync_v1</code></span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-500">
              <span>ZERO POLLING</span>
              <span>•</span>
              <span>SUB-100MS LATENCY</span>
              <span>•</span>
              <span>ESC/POS DRIVERS</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
