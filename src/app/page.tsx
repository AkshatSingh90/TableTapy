import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { HomeNavbar } from "@/components/home/HomeNavbar";
import { InteractiveShowcase } from "@/components/home/InteractiveShowcase";
import { WaitlistForm } from "@/components/home/WaitlistForm";
import { 
  Zap, 
  Printer, 
  Smartphone, 
  ChefHat, 
  TrendingUp, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Clock, 
  Building2, 
  Flame, 
  IndianRupee, 
  QrCode, 
  FileText,
  ChevronRight,
  Shield,
  Layers,
  Utensils
} from "lucide-react";

export const metadata = {
  title: "TableTapy — The Zero-Latency Restaurant Operating System & POS",
  description: "Next-generation cloud POS, dual-cut thermal KOT printing, UrbanPiper Swiggy/Zomato aggregator relay, and contactless QR dining. Built for Indian restaurants and cafes by FlowTalk Enterprise.",
};

export default async function MarketingHomepage() {
  // Fetch active user session safely on server side
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 antialiased selection:bg-[#E46254]/30 font-sans relative overflow-x-hidden">
      
      {/* ========================================================
          MULTI-LAYERED AMBIENT REFRACTION ORBS & CAUSTIC LIGHTS
          ======================================================== */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-Left Signature Coral Flare */}
        <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-gradient-to-br from-[#E46254]/25 via-[#C2410C]/15 to-transparent rounded-full blur-[140px] transform-gpu" />
        {/* Top-Right Warm Amber Caustic */}
        <div className="absolute top-20 -right-24 w-[38rem] h-[38rem] bg-gradient-to-bl from-amber-500/15 via-[#E46254]/10 to-transparent rounded-full blur-[160px] transform-gpu" />
        {/* Mid-Page Deep Rose Refraction */}
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[45rem] h-[45rem] bg-gradient-to-tr from-[#E46254]/10 via-rose-600/10 to-transparent rounded-full blur-[180px] transform-gpu" />
        {/* Bottom Ambient Glow */}
        <div className="absolute -bottom-40 right-10 w-[36rem] h-[36rem] bg-gradient-to-tl from-[#E46254]/15 via-orange-600/10 to-transparent rounded-full blur-[150px] transform-gpu" />
        {/* Micro-grid overlay texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Glass Sticky Navigation Bar */}
      <HomeNavbar user={user} />

      {/* ========================================================
          HERO SECTION
          ======================================================== */}
      <section className="relative z-10 pt-32 sm:pt-40 pb-20 px-4 sm:px-6 max-w-7xl mx-auto text-center">
        
        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.08] mb-6">
          The Operating System for Modern{" "}
          <span className="bg-gradient-to-r from-white via-zinc-100 to-[#E46254] bg-clip-text text-transparent">
            Indian Restaurants.
          </span>
        </h1>

        {/* Value Proposition Subheadline */}
        <p className="text-base sm:text-lg lg:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
          Zero-lag Counter POS. Single-tap simultaneous dual thermal printing (Tax Invoice + Kitchen KOT). Real-time UrbanPiper Swiggy/Zomato order relay. Dynamic contactless QR table dining. Built to thrive in chaotic peak-hour rushes.
        </p>

        {/* Primary Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <a
            href="#waitlist"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-[#E46254] via-[#ea580c] to-[#C2410C] hover:brightness-110 shadow-2xl shadow-[#E46254]/30 transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Request Early Access</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </a>

          <a
            href="#terminal"
            className="w-full sm:w-auto px-7 py-4 rounded-2xl font-semibold text-sm text-zinc-200 hover:text-white backdrop-blur-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.2] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1)] transition-all flex items-center justify-center gap-2"
          >
            <span>Explore Interactive Terminal</span>
            <ChevronRight size={16} className="text-zinc-500" />
          </a>
        </div>

        {/* Real-world Operational Trust Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
          <div className="p-3.5 rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E46254]/10 border border-[#E46254]/20 flex items-center justify-center text-[#E46254] shrink-0">
              <Zap size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">Sub-100ms</p>
              <p className="text-[11px] text-zinc-500 leading-tight">Kitchen KOT Latency</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Printer size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">Dual-Cut Printing</p>
              <p className="text-[11px] text-zinc-500 leading-tight">Bill + KOT on 1 Roll</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
              <Smartphone size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">UrbanPiper Atlas</p>
              <p className="text-[11px] text-zinc-500 leading-tight">Swiggy &amp; Zomato Hub</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">FlowTalk MSME</p>
              <p className="text-[11px] text-zinc-500 leading-tight">Govt. Registered Entity</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          LIVE INTERACTIVE COCKPIT / SHOWCASE FRAME
          ======================================================== */}
      <section id="terminal" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E46254] font-semibold">
            Live Software Cockpit
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2">
            Engineered for Speed, Not Paperwork.
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto mt-2">
            Switch between the four critical modules that power high-volume Indian restaurants daily.
          </p>
        </div>

        {/* Centerpiece Interactive Glass Terminal */}
        <InteractiveShowcase />
      </section>

      {/* ========================================================
          DETAILED 6-FEATURE ARCHITECTURAL BREAKDOWN
          ======================================================== */}
      <section id="pos" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono text-[#E46254] bg-[#E46254]/10 border border-[#E46254]/20 mb-3">
            <Layers size={12} /> Complete F&amp;B Operating Stack
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            Six Engines. One Cohesive System.
          </h2>
          <p className="text-base text-zinc-400 max-w-2xl mx-auto mt-3">
            Every feature in TableTapy is purpose-built to solve a real bottleneck observed in Indian quick-service counters, cafes, and multi-floor dining halls.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Feature 1: Quick POS Terminal */}
          <div className="relative p-7 rounded-3xl backdrop-blur-3xl bg-white/[0.02] border border-white/[0.08] hover:border-[#E46254]/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)] transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#E46254]/10 border border-[#E46254]/20 text-[#E46254] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Zap size={22} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                High-Speed Counter POS
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tapping the entire card punches items in 1 millisecond. Supports auto-incrementing daily tokens (Token #042), Dine-In table bills, instant cash denominations with change calculation, and dynamic UPI QR generation.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Touchscreen Optimized</span>
              <span className="text-[#E46254]">2-Click Checkout</span>
            </div>
          </div>

          {/* Feature 2: Simultaneous Dual-Cut Thermal Printing */}
          <div id="kds" className="relative p-7 rounded-3xl backdrop-blur-3xl bg-white/[0.02] border border-white/[0.08] hover:border-amber-500/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)] transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Printer size={22} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                Dual-Cut Thermal Printing
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                KFC-style automated dual printing. The POS fires a single combined ESC/POS stream: Chit 1 (Customer Tax Invoice) rolls out and auto-cuts, followed immediately by Chit 2 (Kitchen KOT with Token Number) and auto-cuts. Zero cashier running.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>ESC/POS Hardware Cut</span>
              <span className="text-amber-400">0.2s Spooling</span>
            </div>
          </div>

          {/* Feature 3: UrbanPiper Delivery Relay */}
          <div id="aggregators" className="relative p-7 rounded-3xl backdrop-blur-3xl bg-white/[0.02] border border-white/[0.08] hover:border-orange-500/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)] transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Smartphone size={22} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                UrbanPiper Aggregator Hub
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Funnels incoming Swiggy and Zomato orders straight to your POS screen with acoustic audio chimes and a strict 2-minute countdown timer. Instant 86 stock sync: toggling an item off in TableTapy marks it unavailable online within seconds.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Atlas API Ready</span>
              <span className="text-orange-400">Live Rider Tracking</span>
            </div>
          </div>

          {/* Feature 4: Dynamic Contactless QR Dining */}
          <div className="relative p-7 rounded-3xl backdrop-blur-3xl bg-white/[0.02] border border-white/[0.08] hover:border-emerald-500/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)] transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <QrCode size={22} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                QR &amp; NFC Table Experience
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                No app installation required. Guests scan the wooden acrylic QR standee or tap their phone via NFC. Browse rich photo menus, customize spices/portions, place direct table orders, and trigger &quot;Call Captain&quot; or request the bill.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Zero App Download</span>
              <span className="text-emerald-400">Direct KOT Link</span>
            </div>
          </div>

          {/* Feature 5: Multi-Station Kitchen Display */}
          <div className="relative p-7 rounded-3xl backdrop-blur-3xl bg-white/[0.02] border border-white/[0.08] hover:border-rose-500/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)] transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <ChefHat size={22} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                Kitchen Routing &amp; Station KDS
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Split incoming orders automatically across preparation stations: Biryani Station, Tandoor &amp; Naan Section, Fryer Pass, and Mocktail Bar. Color-coded ticket aging alerts chefs before an order exceeds prep thresholds.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Multi-Station KDS</span>
              <span className="text-rose-400">Prep Timers</span>
            </div>
          </div>

          {/* Feature 6: Floor Map & Cashier Reconciliation */}
          <div className="relative p-7 rounded-3xl backdrop-blur-3xl bg-white/[0.02] border border-white/[0.08] hover:border-indigo-500/30 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.6)] transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <TrendingUp size={22} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                Day-End Z-Reports &amp; Auditing
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Automated cashier drawer balancing at shift handovers. Breakdowns across Cash, UPI QR, and Card settlements. Comprehensive GST tax summaries (CGST, SGST) ready for one-click accountant export.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Shift Handover</span>
              <span className="text-indigo-400">GST Ready</span>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          BENCHMARK COMPARISON TABLE (TableTapy vs Legacy POS)
          ======================================================== */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E46254] font-semibold">
            Industry Benchmark
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2">
            Why Modern Restaurateurs Leave Legacy Software
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto mt-2">
            See how TableTapy replaces bloated, 15-year-old desktop software with modern cloud-edge agility.
          </p>
        </div>

        <div className="rounded-3xl p-1 bg-gradient-to-b from-white/[0.1] to-white/[0.02] shadow-2xl">
          <div className="rounded-[22px] backdrop-blur-3xl bg-zinc-950/90 border border-white/[0.06] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-400 text-[11px] font-mono uppercase tracking-wider">
                  <th className="p-4 sm:p-5 font-medium">Operational Capability</th>
                  <th className="p-4 sm:p-5 font-semibold text-[#E46254] bg-[#E46254]/[0.06]">TableTapy Cloud</th>
                  <th className="p-4 sm:p-5 font-medium">Petpooja / Posist</th>
                  <th className="p-4 sm:p-5 font-medium">Legacy Desktop POS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-zinc-300">
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Punch &amp; Billing Speed</td>
                  <td className="p-4 sm:p-5 font-bold text-white bg-[#E46254]/[0.06] flex items-center gap-2">
                    <Check size={16} className="text-[#E46254]" /> 1-Tap Touch Target
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-400">Multi-click popups</td>
                  <td className="p-4 sm:p-5 text-zinc-500">Slow Windows dropdowns</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Dual-Cut Thermal Printing</td>
                  <td className="p-4 sm:p-5 font-bold text-white bg-[#E46254]/[0.06] flex items-center gap-2">
                    <Check size={16} className="text-[#E46254]" /> Native 1-Roll Dual-Cut
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-400">Requires separate printers</td>
                  <td className="p-4 sm:p-5 text-zinc-500">Manual reprinting</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Swiggy &amp; Zomato Sync</td>
                  <td className="p-4 sm:p-5 font-bold text-white bg-[#E46254]/[0.06] flex items-center gap-2">
                    <Check size={16} className="text-[#E46254]" /> Built-in UrbanPiper Atlas
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-400">Paid separate add-on</td>
                  <td className="p-4 sm:p-5 text-zinc-500">Requires dedicated tablets</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Contactless Table QR</td>
                  <td className="p-4 sm:p-5 font-bold text-white bg-[#E46254]/[0.06] flex items-center gap-2">
                    <Check size={16} className="text-[#E46254]" /> Real-time Direct KOT
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-400">Read-only PDF menu or third-party</td>
                  <td className="p-4 sm:p-5 text-zinc-500">Not supported</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Cloud Realtime Sync</td>
                  <td className="p-4 sm:p-5 font-bold text-white bg-[#E46254]/[0.06] flex items-center gap-2">
                    <Check size={16} className="text-[#E46254]" /> Sub-100ms Supabase
                  </td>
                  <td className="p-4 sm:p-5 text-zinc-400">10-15s background batch</td>
                  <td className="p-4 sm:p-5 text-zinc-500">Local PC only (Data loss risk)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================
          OUR VISION & PHILOSOPHY (FlowTalk Enterprise)
          ======================================================== */}
      <section id="vision" className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="relative rounded-3xl p-8 sm:p-14 backdrop-blur-3xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.08] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.15),0_24px_64px_-12px_rgba(0,0,0,0.8)]">
          
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E46254] to-[#C2410C] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#E46254]/30">
            <Sparkles size={24} className="text-white" />
          </div>

          <span className="text-xs font-mono uppercase tracking-widest text-[#E46254] font-semibold">
            Our Vision &amp; Philosophy
          </span>

          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-3 mb-6">
            Empowering the Unsung Heroes of Indian Hospitality
          </h2>

          <div className="space-y-4 text-zinc-300 text-sm sm:text-base leading-relaxed text-left max-w-2xl mx-auto">
            <p>
              Dining in India is electric, fragrant, and chaotic. On any given Saturday night, a restaurant manager juggles 40 dining guests, 15 delivery riders buzzing outside for Swiggy orders, and a hot kitchen firing naan and tandoor chits every 20 seconds.
            </p>
            <p>
              Yet most restaurants are held hostage by clunky, 15-year-old desktop software with grey Windows XP buttons that freeze during rush hours or require confusing workarounds just to split a bill.
            </p>
            <p className="text-white font-medium">
              We built <strong className="text-[#E46254]">TableTapy</strong> under <strong className="text-white">FlowTalk Enterprise</strong> with an uncompromising mandate: zero-lag engineering, single-tap tactile speed, and seamless hardware-to-cloud synergy. 
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.08] inline-flex items-center gap-3 text-xs text-zinc-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>FLOWTALK ENTERPRISE • REGISTERED MSME • GOVT. OF INDIA</span>
          </div>

        </div>
      </section>

      {/* ========================================================
          EARLY ACCESS WAITLIST SECTION
          ======================================================== */}
      <section id="waitlist" className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-8">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E46254] font-semibold">
            Join Cohort 1
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2">
            Ready to Accelerate Your Floor?
          </h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mt-2">
            We are deploying TableTapy across 50 select restaurants in Q1 2026. Reserve your priority setup today.
          </p>
        </div>

        {/* Interactive Client Form */}
        <WaitlistForm />
      </section>

      {/* ========================================================
          FOOTER WITH BRAND, LEGAL, AND COMPLIANCE LINKS
          ======================================================== */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-black/60 backdrop-blur-2xl py-14 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          
          {/* Brand Info */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <Link href="/" className="mb-3 block">
              <img 
                src="/logo-clean.png" 
                alt="TableTapy" 
                className="h-8 w-auto object-contain" 
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
            </Link>
            <p className="text-xs text-zinc-500 max-w-xs leading-normal">
              High-speed cloud POS, dual-cut thermal printing, and omnichannel delivery relay for modern Indian restaurants.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap justify-center gap-6 text-xs text-zinc-400 font-medium">
            <a href="#pos" className="hover:text-white transition-colors">Quick POS</a>
            <a href="#kds" className="hover:text-white transition-colors">Dual-Cut KOT</a>
            <a href="#aggregators" className="hover:text-white transition-colors">UrbanPiper Hub</a>
            <a href="#vision" className="hover:text-white transition-colors">Our Vision</a>
            <Link href="/terms" className="hover:text-[#E46254] transition-colors">Terms &amp; Conditions</Link>
            <Link href="/privacy" className="hover:text-[#E46254] transition-colors">Privacy Policy</Link>
          </div>

          {/* Legal Entity & Auth Actions */}
          <div className="flex flex-col items-center md:items-end text-xs text-zinc-500 font-mono text-center md:text-right gap-2">
            <p>A product of <strong className="text-zinc-400">FlowTalk Enterprise</strong></p>
            <p>Registered MSME (Micro Enterprise) • Govt. of India</p>
            <div className="flex gap-4 pt-1 font-sans text-xs">
              <Link href="/login" className="text-zinc-400 hover:text-white transition-colors">Staff Login</Link>
              <span>•</span>
              <Link href="/signup" className="text-[#E46254] hover:brightness-125 transition-colors font-medium">Register Outlet</Link>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/[0.04] text-center text-[11px] text-zinc-600">
          © 2026 TableTapy. All proprietary software rights reserved under FlowTalk Enterprise.
        </div>
      </footer>

    </div>
  );
}
