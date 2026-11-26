import Link from "next/link";
import { MessageCircle, MonitorDown, Printer } from "lucide-react";
import { RestaurantJourneyStage } from "@/components/home/RestaurantJourneyStage";

export const metadata = {
  title: "TableTapy — Restaurant POS from QR to Kitchen",
  description: "A restaurant operating system for QR dining, table floor plans, counter billing, and direct thermal kitchen printing.",
};

export default function MarketingHomepage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-white text-zinc-900">
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="TableTapy home"><img src="/logo-header.png" alt="TableTapy" className="h-7 w-auto" /></Link>
          <div className="hidden items-center gap-6 text-xs font-medium text-slate-500 md:flex"><a href="#journey" className="hover:text-zinc-900">Product journey</a><a href="#hardware" className="hover:text-zinc-900">Hardware ready</a><Link href="/login" className="hover:text-zinc-900">Sign in</Link></div>
          <Link href="/signup" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#E46254] px-3 text-xs font-semibold text-white sm:px-4"><MonitorDown size={14} /><span className="hidden sm:inline">Download for Windows</span><span className="sm:hidden">Download</span></Link>
        </div>
      </header>
      <section className="bg-slate-50 px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20">
        <div className="mx-auto max-w-6xl text-center"><p className="text-[11px] font-semibold tracking-[0.18em] text-[#E46254] sm:text-xs">THE COMPLETE RESTAURANT OPERATING SYSTEM</p><h1 className="mx-auto mt-5 max-w-5xl text-4xl font-semibold leading-[1.06] tracking-[-0.055em] text-[#09090b] sm:text-6xl lg:text-7xl">From Table QR to Kitchen Ticket in <span className="text-[#E46254]">3 Seconds.</span></h1><p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">Watch a Table 04 order reach your floor plan, cashier counter, and kitchen printer.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E46254] px-5 text-sm font-semibold text-white"><MonitorDown size={17} />Download TableTapy for Windows <span className="text-xs font-normal text-white/80">· 64-bit</span></Link><Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800"><MessageCircle size={17} className="text-emerald-600" />Book a 10-Minute Live Demo</Link></div><div id="hardware" className="mx-auto mt-6 flex max-w-2xl items-start justify-center gap-2 text-left text-xs leading-5 text-slate-500 sm:items-center"><Printer size={15} className="mt-0.5 shrink-0 text-slate-500 sm:mt-0" /><span>Works with standard thermal printers from Epson, TVS, Rugtek, and Posiflex, plus RJ11 cash drawers.</span></div></div>
      </section>
      <section id="journey" className="scroll-mt-20 bg-white px-4 pb-20 sm:px-6"><div className="mx-auto max-w-6xl"><RestaurantJourneyStage /></div></section>
      <footer className="border-t border-zinc-200 bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-center text-xs text-slate-500 sm:flex-row sm:text-left"><p>TableTapy · FlowTalk Enterprise</p><div className="flex gap-4"><Link href="/terms" className="hover:text-zinc-900">Terms</Link><Link href="/privacy" className="hover:text-zinc-900">Privacy</Link></div></div></footer>
    </main>
  );
}
