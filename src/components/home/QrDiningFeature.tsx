import { Image, Palette, QrCode, Search, ShoppingBag, SlidersHorizontal, SlidersVertical } from "lucide-react";

const features = [
  {
    icon: Palette,
    title: "Your brand, up front",
    detail: "Logo · colours · type",
  },
  {
    icon: Image,
    title: "Photos your way",
    detail: "On or off · 1×1 or 2×2",
  },
  {
    icon: SlidersVertical,
    title: "Dishes with options",
    detail: "Portions · add-ons · extras",
  },
  {
    icon: QrCode,
    title: "Scan. Find. Add.",
    detail: "No app · dietary clarity · live cart",
  },
];

const menuItems = [
  { name: "Shawarma", category: "MAIN COURSE", price: "₹230", veg: false },
  { name: "Truffle Riosto", category: "ICE CREAMS", price: "₹65", veg: true },
  { name: "aa", category: "DRINKS", price: "₹200", veg: true },
  { name: "svb", category: "BURGERS", price: "₹1234", veg: true },
  { name: "Fries", category: "DRINKS", price: "₹12", veg: true },
];

function DietaryMark({ veg }: { veg: boolean }) {
  return (
    <span
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      className={`mt-0.5 inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[3px] border ${veg ? "border-emerald-600" : "border-rose-600"}`}
    >
      <span className={`h-[5px] w-[5px] ${veg ? "rounded-full bg-emerald-600" : "bg-rose-600"}`} />
    </span>
  );
}

function MenuPhone() {
  return (
    <div className="mx-auto w-full max-w-[315px]">
      <div className="aspect-[9/19.5] rounded-[46px] bg-zinc-950 p-[7px] shadow-[0_28px_70px_-28px_rgba(15,23,42,0.38),0_5px_16px_-8px_rgba(15,23,42,0.2)] ring-1 ring-black/10">
        <div className="relative h-full overflow-hidden rounded-[39px] bg-[#FDFBF7] text-zinc-950">
          <div className="absolute left-1/2 top-[9px] z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-zinc-950" />

          <div className="flex h-[102px] items-end justify-between px-4 pb-3">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/tap-bite-logo.png" alt="Tap Bite" className="h-[52px] w-[52px] shrink-0 rounded-[14px] object-cover" />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-bold tracking-[-0.04em]">Tap Bite</p>
                <p className="mt-1 text-[9px] font-semibold tracking-[0.2em] text-zinc-500">DINE-IN</p>
              </div>
            </div>
            <button type="button" aria-label="Shopping bag" className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-zinc-200 bg-white text-zinc-600 shadow-sm">
              <ShoppingBag size={17} strokeWidth={1.8} />
            </button>
          </div>

          <div className="flex items-center gap-2 px-3.5 pt-2">
            <div className="flex h-[42px] min-w-0 flex-1 items-center gap-2 rounded-full border border-zinc-200 bg-[#F5F5F5] px-3 text-zinc-400">
              <Search size={16} className="shrink-0" />
              <span className="truncate text-[11px]">Search dishes, drinks, desserts...</span>
            </div>
            <button type="button" aria-label="Filter menu" className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border border-zinc-200 bg-[#F5F5F5] text-zinc-600">
              <SlidersHorizontal size={16} />
            </button>
          </div>

          <div className="relative mt-3">
            <div className="flex gap-2 overflow-x-auto px-3.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                ["ALL", true],
                ["Main Course", false],
                ["Ice Creams", false],
                ["DRINKS", false],
                ["BURGERS", false],
              ].map(([label, active]) => (
                <span
                  key={label as string}
                  className={`shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-bold ${active ? "border-[#CC1118] bg-[#CC1118] text-white shadow-[0_3px_8px_rgba(204,17,24,0.15)]" : "border-zinc-200 bg-white/80 text-zinc-600"}`}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-0 top-0 w-7 bg-gradient-to-l from-[#FDFBF7] to-transparent" />
          </div>

          <div className="absolute inset-x-0 bottom-0 top-[207px] overflow-hidden bg-[#FAF9F7] px-3.5 pt-3.5">
            <div className="space-y-2.5 pb-4">
              {menuItems.map((item) => (
                <article key={item.name} className="flex h-[72px] items-center gap-2.5 rounded-[19px] border border-zinc-100 bg-white px-3 shadow-[0_3px_12px_rgba(15,23,42,0.035)]">
                  <DietaryMark veg={item.veg} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold tracking-[-0.04em]">{item.name}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="truncate text-[8px] font-bold tracking-[0.08em] text-zinc-500">{item.category}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[12px] font-bold tracking-tight">{item.price}</span>
                    <button type="button" className="h-[28px] rounded-full bg-[#CC1118] px-3 text-[9px] font-extrabold text-white">ADD +</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <button type="button" className="absolute bottom-2 left-3 right-3 z-20 h-12 rounded-full bg-[#CC1118] text-[12px] font-bold text-white shadow-[0_8px_24px_rgba(204,17,24,0.24)]">Add to order</button>
        </div>
      </div>
    </div>
  );
}

function MenuSettingsPreview() {
  return (
    <aside className="hidden w-[calc(38%-12px)] max-w-[220px] shrink-0 rounded-[20px] border border-zinc-200 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.34)] lg:block" aria-label="QR menu customization preview">
      <div className="border-b border-zinc-100 pb-3.5">
        <p className="text-[9px] font-semibold tracking-[0.17em] text-[#E46254]">MENU SETTINGS</p>
        <h3 className="mt-1.5 text-[15px] font-semibold leading-5 tracking-[-0.03em] text-zinc-900">Set the look.<br />Keep the choice.</h3>
      </div>

      <div className="border-b border-zinc-100 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-zinc-800">Brand colour</p>
          <span className="text-[9px] font-mono text-zinc-500">#CC1118</span>
        </div>
        <div className="mt-3 flex items-center gap-3" aria-label="Tap Bite red selected">
          <span className="h-5 w-5 rounded-full bg-[#CC1118] ring-2 ring-[#CC1118]/25 ring-offset-2" />
          <span className="h-5 w-5 rounded-full bg-[#F5BD3D]" />
          <span className="h-5 w-5 rounded-full bg-[#242424]" />
          <span className="h-5 w-5 rounded-full bg-[#D9C7B3]" />
        </div>
      </div>

      <div className="border-b border-zinc-100 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-zinc-800">Dish photos</p>
            <p className="mt-0.5 text-[9px] text-zinc-500">Hidden from guests</p>
          </div>
          <span className="relative h-5 w-9 shrink-0 rounded-full bg-zinc-200" aria-label="Off">
            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
          </span>
        </div>
      </div>

      <div className="pt-3.5">
        <p className="text-[11px] font-semibold text-zinc-800">Menu layout</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2" aria-label="One or two column layout options">
          <div className="rounded-xl border border-[#CC1118] bg-[#CC1118]/[0.045] px-2 py-2 text-center">
            <div className="mx-auto flex h-5 w-5 flex-col gap-0.5 rounded-[3px] border border-[#CC1118]/70 p-0.5">
              <span className="h-1 flex-1 rounded-[1px] bg-[#CC1118]/70" />
              <span className="h-1 flex-1 rounded-[1px] bg-[#CC1118]/35" />
            </div>
            <p className="mt-1.5 text-[10px] font-semibold text-zinc-900">1×1</p>
            <p className="text-[8px] tracking-[0.08em] text-zinc-500">LIST</p>
          </div>
          <div className="rounded-xl border border-zinc-200 px-2 py-2 text-center">
            <div className="mx-auto grid h-5 w-5 grid-cols-2 gap-0.5 rounded-[3px] border border-zinc-300 p-0.5">
              <span className="rounded-[1px] bg-zinc-300" /><span className="rounded-[1px] bg-zinc-300" />
              <span className="rounded-[1px] bg-zinc-300" /><span className="rounded-[1px] bg-zinc-300" />
            </div>
            <p className="mt-1.5 text-[10px] font-semibold text-zinc-800">2×2</p>
            <p className="text-[8px] tracking-[0.08em] text-zinc-500">GRID</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function QrDiningFeature() {
  return (
    <section className="border-t border-zinc-200/80 bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] px-4 py-[60px] sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-x-12 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="mb-4 flex items-center gap-3 text-[10px] font-semibold tracking-[0.18em] text-[#CC1118]"><span className="h-px w-8 bg-[#CC1118]" />QR MENU, YOUR WAY</p>
          <h2 className="max-w-[560px] text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-[#09090b] lg:text-[44px]">
            A menu that looks like <span className="text-[#CC1118]">your restaurant.</span>
          </h2>
          <p className="mt-4 flex items-center gap-3 text-[11px] font-bold tracking-[0.12em] text-[#CC1118] sm:text-xs">
            <span className="h-5 w-0.5 rounded-full bg-[#F5BD3D]" />YOUR BRAND. THEIR TABLE. READY IN ONE SCAN.
          </p>
          <p className="mt-3 max-w-[520px] text-[15px] leading-6 text-slate-600">
            No PDF. No app. Just your menu, opened by QR and made to match your restaurant.
          </p>
          <div className="mt-7 grid gap-x-6 gap-y-0 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, detail }) => (
              <article key={title} className="flex items-center gap-3 border-t border-zinc-200/80 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#CC1118]/[0.06] text-[#CC1118]">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold leading-5 text-zinc-900">{title}</h3>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 lg:col-span-6 lg:justify-end">
          <div className="mx-auto w-full max-w-[315px] shrink-0 lg:mx-0 lg:w-[62%]">
            <MenuPhone />
          </div>
          <MenuSettingsPreview />
        </div>
      </div>
    </section>
  );
}
