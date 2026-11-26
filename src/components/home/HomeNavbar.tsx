'use client';

import { useState } from "react";
import Link from "next/link";
import { Menu, MonitorDown, X } from "lucide-react";

const links = [
  ["Terminal", "#cockpit"], ["Floor Plan", "#cockpit"], ["Features", "#features"],
  ["Hardware", "#hardware"], ["Pricing", "#pricing"], ["FAQ", "#faq"],
];

export function HomeNavbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-6xl px-4 sm:px-6">
      <nav className="relative flex min-h-14 items-center justify-between rounded-full border border-white/[0.08] bg-zinc-950/80 px-4 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:px-5">
        <Link href="/" className="flex min-h-11 items-center gap-2" aria-label="TableTapy home">
          <img src="/logo-clean.png" alt="TableTapy" className="h-7 w-auto" />
          <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 font-mono text-[10px] text-emerald-300 sm:inline-flex"><span className="mr-1 text-emerald-400">●</span> POS v0.1</span>
        </Link>
        <div className="hidden items-center gap-5 text-xs font-medium text-zinc-400 lg:flex">
          {links.map(([label, href]) => <a key={label} href={href} className="hover:text-white">{label}</a>)}
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/login" className="min-h-11 px-3 py-3 text-xs font-medium text-zinc-300 hover:text-white">Sign In</Link>
          <Link href="/signup" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#E46254] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#f27668]"><MonitorDown size={14} /> Download for Windows</Link>
        </div>
        <button onClick={() => setOpen(!open)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-300 hover:bg-white/[0.06] sm:hidden" aria-label="Toggle menu">{open ? <X size={19} /> : <Menu size={19} />}</button>
        {open && <div className="absolute top-[calc(100%+0.5rem)] right-0 left-0 rounded-3xl border border-white/[0.08] bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-2xl sm:hidden">
          {links.map(([label, href]) => <a key={label} href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-2xl px-3 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white">{label}</a>)}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3"><Link href="/login" className="flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] text-xs text-zinc-200">Sign In</Link><Link href="/signup" className="flex min-h-11 items-center justify-center rounded-xl bg-[#E46254] px-2 text-center text-xs font-semibold text-white">Download for Windows</Link></div>
        </div>}
      </nav>
    </header>
  );
}
