'use client';

import { useEffect, useRef, useState } from "react";
import { Bell, Check, ChevronRight, MapPin, Plus, Printer, Search, Smartphone, UtensilsCrossed, Wifi } from "lucide-react";

type Step = 0 | 1 | 2;

const stages = [
  { label: "1. Customer Scans QR & Orders", icon: Smartphone },
  { label: "2. Table 04 Turns Red on Floor Plan", icon: UtensilsCrossed },
  { label: "3. POS Fires Dual Thermal Print", icon: Printer },
] as const;

export function RestaurantJourneyStage() {
  const [cycleTime, setCycleTime] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const mobileRail = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const step = Math.floor(cycleTime / 4) as Step;
  const elapsed = cycleTime % 4;

  useEffect(() => {
    const target = stageRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.6);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) setCycleTime(0);
    }, { threshold: [0, 0.6] });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const timer = window.setInterval(() => setCycleTime((time) => Number(((time + 0.1) % 12).toFixed(1))), 100);
    return () => window.clearInterval(timer);
  }, [isVisible]);

  useEffect(() => {
    if (mobileRail.current) mobileRail.current.scrollTo({ left: mobileRail.current.clientWidth * step, behavior: "smooth" });
  }, [step]);

  const progress = (index: number) => index < step ? 100 : index === step ? Math.min(100, (elapsed / 4) * 100) : 0;
  const handleTouchEnd = (x: number) => {
    if (touchStart === null) return;
    const delta = touchStart - x;
    if (Math.abs(delta) > 44) setCycleTime((delta > 0 ? Math.min(11.9, (step + 1) * 4 + 0.1) : Math.max(0, (step - 1) * 4 + 0.1)));
    setTouchStart(null);
  };

  return (
    <section ref={stageRef} className="overflow-x-clip rounded-[32px] border border-zinc-200/80 bg-white p-3 shadow-[0_20px_70px_-28px_rgba(15,23,42,0.24)] sm:p-5">
      <div className="grid gap-2 rounded-2xl bg-slate-50 p-2 sm:grid-cols-3">
        {stages.map(({ label, icon: Icon }, index) => <div key={label} aria-current={step === index ? "step" : undefined} className={`relative min-h-12 overflow-hidden rounded-xl px-3 text-left text-[11px] font-semibold transition sm:text-xs ${step === index ? "bg-white text-zinc-900 shadow-sm" : "text-slate-500"}`}>
          <span className="relative z-10 flex items-center gap-2"><Icon size={15} className={step === index ? "text-[#E46254]" : ""} />{label}</span>
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-100"><span className="block h-full bg-[#E46254] transition-[width] duration-100" style={{ width: `${progress(index)}%` }} /></span>
        </div>)}
      </div>

      <div className="relative mt-5 hidden min-h-[590px] items-center gap-10 px-6 py-8 lg:flex">
        <div className="absolute left-[27%] right-[35%] top-[49%] h-px overflow-hidden bg-gradient-to-r from-transparent via-[#E46254]/35 to-transparent"><span className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#E46254] shadow-[0_0_0_6px_rgba(228,98,84,0.13)] ${isVisible && step === 1 ? "tt-data-pulse" : "hidden"}`} /></div>
        <div className="w-[32%] min-w-0"><PhoneMockup step={step} elapsed={elapsed} /></div>
        <div className="flex-1 min-w-0"><TerminalMockup step={step} elapsed={elapsed} /></div>
      </div>

      <div ref={mobileRail} onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)} onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)} className="-mx-3 mt-4 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] sm:-mx-5 lg:hidden">
        <div className="w-full shrink-0 snap-center px-3 sm:px-5"><PhoneMockup step={step} elapsed={elapsed} mobile /></div>
        <div className="w-full shrink-0 snap-center px-3 sm:px-5"><TerminalMockup step={1} elapsed={elapsed} mobile /></div>
        <div className="w-full shrink-0 snap-center px-3 sm:px-5"><TerminalMockup step={2} elapsed={elapsed} mobile /></div>
        <div className="hidden" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 lg:hidden">{stages.map((_, index) => <span key={index} className={`block h-2 rounded-full transition-all ${step === index ? "w-6 bg-[#E46254]" : "w-2 bg-zinc-300"}`} />)}</div>
      <p className="mt-2 text-center text-[11px] text-slate-400">{isVisible ? "Watch the customer order flow through the restaurant automatically." : "Scroll here to watch a customer order move through the restaurant."}</p>
    </section>
  );
}

function PhoneMockup({ step, elapsed, mobile = false }: { step: Step; elapsed: number; mobile?: boolean }) {
  const phase = step === 0 ? elapsed : 3.2;
  const sent = phase >= 2.8;
  const hasBiryani = phase >= 0.8;
  const naanQty = phase >= 2.2 ? 2 : phase >= 1.6 ? 1 : 0;
  const showCart = phase >= 2.2 && !sent;
  return <div className={`relative mx-auto aspect-[9/19.5] w-full max-w-[280px] rounded-[42px] border-[7px] border-zinc-900 bg-zinc-900 p-[3px] shadow-[0_20px_40px_-18px_rgba(15,23,42,0.45)] ${mobile ? "max-w-[310px]" : ""}`}>
    <div className="absolute top-2 left-1/2 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-zinc-900" />
    <div className="h-full overflow-hidden rounded-[34px] bg-slate-50 text-zinc-900">
      <div className="flex h-8 items-center justify-between px-5 pt-1 font-mono text-[9px]"><span>19:42</span><span className="flex items-center gap-1"><Wifi size={10} /> 92%</span></div>
      {sent ? <div className="grid h-[calc(100%-2rem)] place-items-center px-6 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={28} strokeWidth={3} /></div><h3 className="mt-5 text-lg font-bold">Order #104 Sent to Kitchen!</h3><p className="mt-2 text-xs leading-5 text-slate-500">Table 04 session active. Your order is now with the restaurant.</p><span className="mt-5 inline-flex rounded-full bg-emerald-50 px-3 py-2 font-mono text-[10px] text-emerald-700">3 ITEMS · ₹470.00</span></div></div> : <>
        <div className="border-b border-zinc-200 bg-white px-4 pb-3"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">The TableTapy Bistro</p><p className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500"><MapPin size={9} /> Table 04 · Ground Hall</p></div><span className="grid h-7 w-7 place-items-center rounded-full bg-[#E46254]/10 text-[#E46254]"><UtensilsCrossed size={13} /></span></div><div className="mt-3 flex h-7 items-center gap-2 rounded-lg bg-slate-100 px-2 text-[9px] text-slate-400"><Search size={11} /> Search dishes</div></div>
        <div className="flex gap-1.5 overflow-hidden px-4 py-3 text-[9px]">{["All", "Starters", "Main Course", "Tandoor & Breads", "Beverages"].map((category, index) => <span key={category} className={`shrink-0 rounded-full px-2 py-1 ${index === 0 ? "bg-zinc-900 text-white" : "bg-white text-slate-500"}`}>{category}</span>)}</div>
        <div className="space-y-2 px-4 pb-20"><PhoneDish name="Chicken Dum Biryani" price="₹340.00" tag="Bestseller" meta="Full · 750g" veg={false} qty={hasBiryani ? 1 : 0} /><PhoneDish name="Paneer Butter Masala" price="₹290.00" tag="Chef Special" veg qty={0} /><PhoneDish name="Butter Garlic Naan" price="₹65.00" veg qty={naanQty} /><PhoneDish name="Cold Brew Coffee" price="₹160.00" veg qty={0} /></div>
        {showCart && <div className="absolute inset-x-2 bottom-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg"><div className="flex items-center justify-between text-[10px]"><span className="font-medium">3 items in cart</span><span className="font-mono font-bold">₹470.00</span></div><button onClick={onOrder} className="mt-2 flex min-h-9 w-full items-center justify-center gap-1 rounded-xl bg-[#E46254] text-[10px] font-bold text-white">Place Table Order <ChevronRight size={12} /></button></div>}
      </>}
    </div>
  </div>;
}

function PhoneDish({ name, price, tag, meta, veg, qty }: { name: string; price: string; tag?: string; meta?: string; veg: boolean; qty: number }) {
  return <article className={`rounded-xl border bg-white p-2.5 transition ${qty ? "border-[#E46254]/50 ring-1 ring-[#E46254]/15" : "border-zinc-200"}`}><div className="flex gap-2"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px]">🍽️</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-1"><p className="text-[10px] font-semibold leading-4">{name}</p><span className={`mt-0.5 grid h-2.5 w-2.5 place-items-center border ${veg ? "border-emerald-500" : "border-rose-500"}`}><span className={`h-1 w-1 rounded-full ${veg ? "bg-emerald-500" : "bg-rose-500"}`} /></span></div><p className="mt-0.5 font-mono text-[9px] text-slate-500">{price} {meta && `· ${meta}`}</p>{tag && <span className="mt-1 inline-block rounded bg-amber-50 px-1 py-0.5 text-[8px] font-medium text-amber-700">{tag}</span>}</div><button className={`grid h-6 w-6 place-items-center self-center rounded-md text-white ${qty ? "bg-[#E46254]" : "bg-zinc-900"}`}>{qty || <Plus size={12} />}</button></div></article>;
}

function TerminalMockup({ step, elapsed, mobile = false }: { step: Step; elapsed: number; mobile?: boolean }) {
  const receiptVisible = step === 2 && elapsed >= 1.3;
  return <div className={`relative mx-auto w-full ${mobile ? "max-w-[680px]" : ""}`}><div className="aspect-[16/10] overflow-hidden rounded-[22px] border-[7px] border-zinc-800 bg-white shadow-[0_22px_46px_-20px_rgba(15,23,42,0.5)]"><div className="flex h-8 items-center justify-between border-b border-zinc-200 bg-slate-50 px-3 text-[9px] text-slate-500"><div className="flex items-center gap-1.5"><img src="/logo-clean.png" alt="" className="h-4 w-auto" /><span className="font-semibold text-zinc-800">Point of Sale</span></div><span className="font-mono">STAFF STATION · 19:42</span></div>{step === 2 ? <PosTicket receiptVisible={receiptVisible} /> : <FloorPlan active={step === 1} />}</div><div className="relative z-10 mx-auto flex h-4 w-[42%] items-center justify-center rounded-b-2xl border-x border-b border-zinc-400 bg-gradient-to-b from-zinc-200 to-zinc-100"><span className="h-1 w-[72%] rounded-full bg-zinc-500" /></div><div className="mx-auto h-5 w-[24%] rounded-b-lg bg-zinc-300" />{receiptVisible && <ThermalReceipt />}</div>;
}

function FloorPlan({ active }: { active: boolean }) {
  const tables = [
    ["T-01", "4 Pax", "Vacant", "emerald"], ["T-02", "2 Pax", "Vacant", "emerald"], ["T-03", "6 Pax", "Dining · 28m · ₹1,420", "amber"], ["T-04", "4 Pax", active ? "NEW QR ORDER · 3 items · ₹470" : "Vacant", active ? "rose" : "emerald"], ["T-05", "8 Pax", "Vacant", "emerald"], ["T-06", "4 Pax", "Dining · 14m · ₹890", "rose"], ["T-07", "4 Pax", "Vacant", "emerald"], ["T-08", "2 Pax", "Vacant", "emerald"],
  ] as const;
  return <div className="h-[calc(100%-2rem)] bg-slate-50 p-3 text-zinc-900"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">Main Floor Dining Hall</p><p className="text-[8px] text-slate-500">8 Tables active</p></div><div className="flex gap-1 text-[8px]"><span className="rounded-md bg-zinc-900 px-2 py-1 text-white">All Zones</span><span className="rounded-md border border-zinc-200 bg-white px-2 py-1">Main Hall (6)</span><span className="rounded-md border border-zinc-200 bg-white px-2 py-1">Rooftop (2)</span></div></div>{active && <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#E46254]/25 bg-[#E46254]/10 px-2 py-1.5 text-[8px] font-medium text-[#c64b3f]"><Bell size={10} /> New QR Order received from Table 04! (1x Biryani, 2x Naan)</div>}<div className="mt-3 grid grid-cols-4 gap-2">{tables.map(([name, capacity, status, color]) => <div key={name} className={`min-h-20 rounded-xl border p-2 text-left transition ${color === "emerald" ? "border-emerald-300 bg-emerald-50" : color === "amber" ? "border-amber-300 bg-amber-50" : "border-rose-400 bg-rose-50"} ${name === "T-04" && active ? "animate-pulse ring-2 ring-rose-300" : ""}`}><p className="font-mono text-[11px] font-bold">{name}</p><p className="mt-1 text-[8px] text-slate-500">{capacity}</p><p className={`mt-2 text-[8px] font-semibold ${color === "emerald" ? "text-emerald-700" : color === "amber" ? "text-amber-700" : "text-rose-700"}`}>{status}</p></div>)}</div></div>;
}

function PosTicket({ receiptVisible }: { receiptVisible: boolean }) {
  return <div className="h-[calc(100%-2rem)] grid grid-cols-[1.2fr_.8fr] bg-slate-50 text-zinc-900"><div className="p-3"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">TABLE T-04 · DINE-IN</p><p className="text-[8px] text-slate-500">4 PAX · Order #104 · Staff Station</p></div><span className="rounded-md bg-rose-50 px-2 py-1 font-mono text-[8px] text-rose-600">LIVE TICKET</span></div><div className="mt-4 space-y-2">{[["1x", "Chicken Dum Biryani", "₹340.00", "Less spicy"], ["2x", "Butter Garlic Naan", "₹130.00", ""]].map(([qty, item, amount, note]) => <div key={item} className="flex items-start justify-between border-b border-zinc-200 pb-2 text-[9px]"><div><p className="font-semibold">{qty} {item}</p>{note && <p className="mt-0.5 text-[8px] text-amber-600">Note: {note}</p>}</div><span className="font-mono">{amount}</span></div>)}</div></div><div className="border-l border-zinc-200 bg-white p-3"><p className="text-[9px] font-semibold">Payment</p><div className="mt-3 space-y-1.5 font-mono text-[8px] text-slate-500"><p className="flex justify-between"><span>Subtotal</span><span>₹470.00</span></p><p className="flex justify-between"><span>CGST 2.5%</span><span>₹11.75</span></p><p className="flex justify-between"><span>SGST 2.5%</span><span>₹11.75</span></p><p className="flex justify-between border-t border-zinc-200 pt-2 text-xs font-bold text-[#E46254]"><span>Payable</span><span>₹493.50</span></p></div><div className="mt-3 grid gap-1 text-[8px]"><span className="grid min-h-7 place-items-center rounded border border-zinc-200">Exact ₹493.50</span><span className="grid min-h-7 place-items-center rounded border border-zinc-200">₹500 · ₹6.50</span><span className="grid min-h-7 place-items-center rounded border border-zinc-200">₹1,000 · ₹506.50</span></div><div className={`mt-3 flex min-h-9 w-full items-center justify-center gap-1 rounded-lg text-[8px] font-bold text-white ${receiptVisible ? "bg-emerald-500" : "bg-[#E46254]"}`}><Printer size={10} />{receiptVisible ? "Printing complete" : "Settle Bill & Dual Print"}</div></div></div>;
}

function ThermalReceipt() {
  return <div className="tt-receipt-feed absolute left-[26%] top-[calc(100%-1rem)] z-10 w-[48%] border-x border-b border-zinc-300 bg-[#FDFCF7] p-3 font-mono text-[7px] leading-relaxed text-zinc-800 shadow-xl"><div className="text-center"><p className="font-bold">THE TABLETAPY BISTRO</p><p>TAX INVOICE</p><p className="text-zinc-500">GSTIN: 29ABCDE1234F1Z5 · FSSAI: 11223344556677</p></div><div className="my-2 border-t border-dashed border-zinc-400" /><p>TABLE: T-04 · 19:43</p><p>1x Biryani (Dum) ........ ₹340.00</p><p>2x Butter Garlic Naan ... ₹130.00</p><p className="mt-1 text-right font-bold">PAID TOTAL: ₹493.50 CASH</p><p className="text-center">Thank you! Visit again.</p><p className="my-2 text-center text-zinc-400">✂ ---------------- GS V AUTO CUT ----------------</p><div className="text-center font-bold"><p>KITCHEN ORDER TICKET</p><p>KOT #104 · TABLE T-04 · DINE-IN</p></div><p className="mt-2 font-bold">[ ] 1x Biryani (Dum)</p><p>NOTE: Less spicy</p><p className="font-bold">[ ] 2x Butter Garlic Naan</p><p className="mt-2 text-center">♩ Acoustic Kitchen Buzzer Alert Fired!</p></div>;
}
