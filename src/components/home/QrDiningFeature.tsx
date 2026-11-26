import {
  Check,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";

const features = [
  {
    number: "01",
    title: "Make it feel like your restaurant.",
    body: "Add your logo, set an accent colour, and choose a type style that fits your brand.",
  },
  {
    number: "02",
    title: "Choose how dishes look.",
    body: "Show dish photography or keep the menu compact. Pick a one-column list or a two-column grid.",
  },
  {
    number: "03",
    title: "Let guests make it their own.",
    body: "Offer portions, add-ons, and extras on each dish before it goes into the table cart.",
  },
  {
    number: "04",
    title: "Keep ordering clear and quick.",
    body: "Dietary markers, category jumps, and dish search help guests find and add what they want.",
  },
];

const menuItems = [
  { name: "Classic Burger", category: "BURGERS", price: "₹249", veg: true, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=180&q=80" },
  { name: "Double Smash", category: "BURGERS", price: "₹349", veg: false, image: "https://images.unsplash.com/photo-1594212848116-b8db20577184?w=180&q=80" },
  { name: "Loaded Fries", category: "SNACKS", price: "₹199", veg: true, image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=180&q=80" },
  { name: "Craft Soda", category: "DRINKS", price: "₹149", veg: true, image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=180&q=80" },
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
              <img src="/tap-bite-logo.svg" alt="Tap Bite" className="h-[52px] w-[52px] shrink-0 rounded-[14px] object-cover" />
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
            <div className="space-y-3 pb-4">
              {menuItems.map((item) => (
                <article key={item.name} className="flex h-[78px] items-center gap-2 rounded-[19px] border border-zinc-100 bg-white p-2 shadow-[0_3px_12px_rgba(15,23,42,0.035)]">
                  <img src={item.image} alt="" className="h-[58px] w-[52px] shrink-0 rounded-[13px] object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold tracking-[-0.04em]">{item.name}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <DietaryMark veg={item.veg} />
                      <span className="truncate text-[8px] font-bold tracking-[0.08em] text-zinc-500">{item.category}</span>
                    </div>
                    <p className="mt-1 truncate text-[8px] font-medium text-[#B78620]">Choose size · add-ons</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] font-bold tracking-tight">{item.price}</span>
                    <button type="button" className="h-[25px] rounded-full bg-[#CC1118] px-2.5 text-[9px] font-extrabold text-white">ADD +</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="absolute inset-x-2 bottom-2 z-20 rounded-[23px] border border-zinc-200/80 bg-white px-3.5 pb-3 pt-2 shadow-[0_12px_35px_rgba(15,23,42,0.2)]">
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-zinc-200" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold">Make it yours</p>
                <p className="mt-0.5 text-[9px] text-zinc-500">Classic Burger · choose extras</p>
              </div>
              <span className="pt-1 text-[9px] font-semibold tracking-[0.12em] text-zinc-400">OPTIONAL</span>
            </div>
            <div className="mt-2 divide-y divide-zinc-100 border-y border-zinc-100">
              {["Extra cheese", "Double patty"].map((extra, index) => (
                <div key={extra} className="flex items-center justify-between py-2 text-[10px]">
                  <span className="text-zinc-700">{extra}</span>
                  <span className="flex items-center gap-2 font-semibold text-zinc-800">+₹{index === 0 ? "40" : "75"}<span className="grid h-4 w-4 place-items-center rounded-[4px] border border-[#CC3333] bg-[#CC3333] text-white"><Check size={11} strokeWidth={3} /></span></span>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2.5 h-9 w-full rounded-xl bg-[#CC3333] text-[10px] font-bold text-white">Add to order · ₹289</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QrDiningFeature() {
  return (
    <section className="border-t border-zinc-200/80 bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] px-4 py-[60px] sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-x-12 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-[#E46254]">CUSTOMIZABLE QR DINING</p>
          <h2 className="max-w-[650px] text-4xl font-semibold leading-[1.15] tracking-[-0.04em] text-[#09090b] lg:text-5xl">
            A Digital Menu That Actually Looks Like Your Restaurant.
          </h2>
          <p className="mt-5 max-w-[640px] text-[16px] leading-[1.65] text-slate-600 sm:text-[17px]">
            No clunky PDF downloads. No third-party aggregator templates. When guests sit at Table 04 and scan, they open your branded web menu with your colors, your logo, and instant dietary clarity.
          </p>
          <div className="mt-9 grid gap-x-8 gap-y-0 sm:grid-cols-2">
            {features.map(({ number, title, body }) => (
              <article key={number} className="border-t border-zinc-200/80 py-4">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-[#E46254]">{number}</p>
                <h3 className="mt-1 text-sm font-semibold leading-5 text-zinc-900">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-[1.65] text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5">
          <MenuPhone />
        </div>
      </div>
    </section>
  );
}
