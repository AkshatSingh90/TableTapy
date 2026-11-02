"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Palette,
  Menu,
  Settings,
  LogOut,
  QrCode,
  Users,
  UtensilsCrossed,
  MonitorPlay,
  BarChart3,
  Package,
  Megaphone,
  Receipt,
  ShoppingBag,
  Search,
  Plus,
  X,
  Sparkles,
  Box,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState, useRef } from "react";
import { WaterBottleSetupModal } from "@/components/WaterBottleSetupModal";
import { getCanonicalRestaurantId } from "@/lib/localSqliteStore";
import { OfflineSyncEngine } from "@/lib/offlineSyncEngine";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [businessType, setBusinessType] = useState("RESTAURANT");
  const [hasRestaurant, setHasRestaurant] = useState<boolean | null>(null);
  const [posMode, setPosMode] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");

  // Menu Search & Add Dish State (Scoped to /dashboard/menu)
  const [menuSearch, setMenuSearch] = useState("");
  const menuSearchInputRef = useRef<HTMLInputElement>(null);

  // Tab State for Inventory and Customers pages
  const [inventoryTab, setInventoryTab] = useState<"Materials" | "Intelligence">("Intelligence");
  const [customersTab, setCustomersTab] = useState<"Intelligence" | "All Customers">("Intelligence");

  // Sync tab events from child pages
  useEffect(() => {
    const handleInvSync = (e: any) => {
      if (e.detail) setInventoryTab(e.detail);
    };
    const handleCustSync = (e: any) => {
      if (e.detail) setCustomersTab(e.detail);
    };
    window.addEventListener("inventory_tab_sync", handleInvSync);
    window.addEventListener("customers_tab_sync", handleCustSync);
    return () => {
      window.removeEventListener("inventory_tab_sync", handleInvSync);
      window.removeEventListener("customers_tab_sync", handleCustSync);
    };
  }, []);

  const handleSwitchInventoryTab = (tab: "Materials" | "Intelligence") => {
    setInventoryTab(tab);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("inventory_tab_change", { detail: tab }));
    }
  };

  const handleSwitchCustomersTab = (tab: "Intelligence" | "All Customers") => {
    setCustomersTab(tab);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("customers_tab_change", { detail: tab }));
    }
  };

  // Sync POS mode from POS terminal events
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) setPosMode(e.detail);
    };
    window.addEventListener("pos_mode_sync", handler);
    return () => window.removeEventListener("pos_mode_sync", handler);
  }, []);

  const handleSwitchPosMode = (mode: "DINE_IN" | "TAKEAWAY") => {
    setPosMode(mode);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pos_mode_change", { detail: mode }));
    }
  };

  const handleMenuSearchChange = (query: string) => {
    setMenuSearch(query);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("menu_search_change", { detail: query }));
    }
  };

  const handleOpenAddDish = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("menu_open_add_modal"));
    }
  };

  // Keyboard shortcut '/' to focus search on menu page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        pathname === "/dashboard/menu" &&
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        menuSearchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname]);

  // Reset menu search on route change
  useEffect(() => {
    if (pathname !== "/dashboard/menu") {
      setMenuSearch("");
    }
  }, [pathname]);

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Start Background Outbox & Auto-Sync Engine
  useEffect(() => {
    OfflineSyncEngine.start();
    return () => {
      OfflineSyncEngine.stop();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    const fetchUserRestaurant = async () => {
      // 1. Resolve canonical restaurant ID locally first (0ms, 0 network needed)
      let restId = await getCanonicalRestaurantId(supabase);

      // Check session locally without blocking network call
      let sessionUser: any = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        sessionUser = sessionData?.session?.user;
      } catch {}

      // If online and session user not found locally, try network getUser
      if (!sessionUser && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          sessionUser = user;
        } catch {}
      }

      if (!restId) {
        // If we have an active internet connection and no session or restaurant, redirect to login.
        // If OFFLINE, NEVER redirect to login (prevents kicking users during network drops).
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
        if (!sessionUser && !isOffline) {
          router.push("/login");
          return;
        }
        setHasRestaurant(false);
        return;
      }

      setHasRestaurant(true);
      // Fetch restaurant settings/business type in background without blocking
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const { data } = await supabase
            .from("restaurants")
            .select("business_type")
            .eq("id", restId)
            .single();
          if (data?.business_type) {
            setBusinessType(data.business_type);
          }
        } catch {}
      }
    };
    fetchUserRestaurant();
  }, []);

  // Isolate preview-header if accessed directly
  if (pathname === "/dashboard/preview-header") {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  const navGroups =
    businessType === "HOTEL"
      ? [
          {
            title: "OVERVIEW",
            items: [
              { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            ],
          },
          {
            title: "OPERATIONS",
            items: [
              { name: "Guest Catalog", href: "/dashboard/menu", icon: Menu },
              { name: "Rooms & QR", href: "/dashboard/locations", icon: QrCode },
              { name: "Menu Designer", href: "/designer_app", icon: Sparkles },
            ],
          },
          {
            title: "BACK OFFICE",
            items: [
              { name: "Hardware Studio", href: "/dashboard/studio", icon: Palette },
              { name: "Settings", href: "/dashboard/settings", icon: Settings },
            ],
          },
        ]
      : [
          {
            title: "OVERVIEW",
            items: [
              { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
              { name: "POS", href: "/dashboard/pos", icon: MonitorPlay },
            ],
          },
          {
            title: "OPERATIONS",
            items: [
              { name: "Kitchen (KDS)", href: "/dashboard/kds", icon: UtensilsCrossed },
              { name: "Staffs", href: "/dashboard/staffs", icon: Users },
              { name: "Table Orders", href: "/dashboard/locations", icon: QrCode },
              { name: "Menu Availability", href: "/dashboard/menu", icon: Menu },
              { name: "Menu Designer", href: "/designer_app", icon: Sparkles },
            ],
          },
          {
            title: "CRM & MARKETING",
            items: [
              { name: "Customers", href: "/dashboard/customers", icon: Users },
              { name: "Promotions", href: "/dashboard/promotions", icon: Megaphone },
            ],
          },
          {
            title: "BACK OFFICE",
            items: [
              { name: "Inventory", href: "/dashboard/inventory", icon: Package },
              { name: "Invoices", href: "/dashboard/invoices", icon: Receipt },
              { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
              { name: "Hardware Studio", href: "/dashboard/studio", icon: Palette },
              { name: "Settings", href: "/dashboard/settings", icon: Settings },
            ],
          },
        ];

  return (
    <div className="h-screen flex flex-col bg-[#FBFBFC] text-zinc-900 overflow-hidden relative">
      {/* Precision Scrollbar Styles for the Drawer */}
      <style jsx global>{`
        .aesthetic-bar::-webkit-scrollbar-button,
        .aesthetic-bar::-webkit-scrollbar-button:single-button,
        .aesthetic-bar::-webkit-scrollbar-button:vertical:decrement,
        .aesthetic-bar::-webkit-scrollbar-button:vertical:increment,
        .aesthetic-bar::-webkit-scrollbar-corner {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
        }

        .aesthetic-bar::-webkit-scrollbar {
          width: 4px !important;
          height: 4px !important;
        }

        .aesthetic-bar::-webkit-scrollbar-track {
          background: rgba(244, 244, 245, 0.6) !important;
          border-radius: 9999px !important;
          margin: 4px 0 !important;
        }

        .aesthetic-bar::-webkit-scrollbar-thumb {
          background-color: #d4d4d8 !important;
          border-radius: 9999px !important;
        }

        .aesthetic-bar::-webkit-scrollbar-thumb:hover {
          background-color: #a1a1aa !important;
        }

        .aesthetic-bar {
          scrollbar-width: thin;
          scrollbar-color: #d4d4d8 rgba(244, 244, 245, 0.6);
        }
      `}</style>

      {/* Multi-layered Atmospheric Lighting (Homepage Caustics & Grid in Dark Mode) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 hidden">
        <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-gradient-to-br from-[#E46254]/18 via-[#C2410C]/10 to-transparent rounded-full blur-[140px] transform-gpu" />
        <div className="absolute top-20 -right-24 w-[38rem] h-[38rem] bg-gradient-to-bl from-amber-500/12 via-[#E46254]/08 to-transparent rounded-full blur-[160px] transform-gpu" />
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-[45rem] h-[45rem] bg-gradient-to-tr from-[#E46254]/08 via-rose-600/06 to-transparent rounded-full blur-[180px] transform-gpu" />
        <div className="absolute -bottom-40 right-10 w-[36rem] h-[36rem] bg-gradient-to-tl from-[#E46254]/12 via-orange-600/08 to-transparent rounded-full blur-[150px] transform-gpu" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-80" />
      </div>

      {/* Clean Aesthetic Top Header */}
      <header className="h-14 px-4 sm:px-6 border-b border-zinc-200/70 bg-white/95 backdrop-blur-2xl shrink-0 z-30 flex items-center justify-between overflow-hidden">
        {/* Left Side: 2-Line Minimalist Toggle + Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="group relative w-9 h-9 -ml-1.5 rounded-lg flex items-center justify-center hover:bg-zinc-100/80 active:bg-zinc-200/70 transition-colors duration-150 cursor-pointer outline-none"
            title="Toggle Menu"
            aria-label="Toggle navigation menu"
          >
            <div className="w-[18px] h-[10px] relative flex flex-col justify-between">
              <span
                className={`h-[1.75px] bg-zinc-700 group-hover:bg-zinc-950 rounded-full transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isOpen
                    ? "w-[18px] translate-y-[4.25px] rotate-45"
                    : "w-[18px] group-hover:w-[14px]"
                }`}
              />
              <span
                className={`h-[1.75px] bg-zinc-700 group-hover:bg-zinc-950 rounded-full transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isOpen
                    ? "w-[18px] -translate-y-[4px] -rotate-45"
                    : "w-[12px] group-hover:w-[18px]"
                }`}
              />
            </div>
          </button>

          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center shrink-0 cursor-pointer select-none"
          >
            <img
              src="/logo-header.png"
              alt="TableTapy"
              className="h-7 sm:h-8 w-auto max-w-[160px] object-contain select-none pointer-events-none"
              style={{ imageRendering: "-webkit-optimize-contrast" }}
            />
          </Link>
        </div>

        {/* Center: Dine-In / Takeaway Toggle (ONLY for /dashboard/pos) */}
        {pathname === "/dashboard/pos" && (
          <div className="backdrop-blur-2xl bg-zinc-100/90 p-1 rounded-xl flex items-center gap-1 border border-zinc-200/60">
            <button
              type="button"
              onClick={() => handleSwitchPosMode("DINE_IN")}
              className={`py-1 px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                posMode === "DINE_IN"
                  ? "bg-white shadow-xs text-zinc-900 font-bold "
                  : "text-zinc-500 hover:text-zinc-800 font-medium hover:bg-white/[0.04]"
              }`}
            >
              <UtensilsCrossed size={13} className={posMode === "DINE_IN" ? "text-[#E46254] " : "text-zinc-400"} />
              <span>Dine-In</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchPosMode("TAKEAWAY")}
              className={`py-1 px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                posMode === "TAKEAWAY"
                  ? "bg-white shadow-xs text-zinc-900 font-bold "
                  : "text-zinc-500 hover:text-zinc-800 font-medium hover:bg-white/[0.04]"
              }`}
            >
              <ShoppingBag size={13} className={posMode === "TAKEAWAY" ? "text-[#E46254] " : "text-zinc-400"} />
              <span>Takeaway</span>
            </button>
          </div>
        )}

        {/* Center: Inventory Nav Toggle (ONLY for /dashboard/inventory) */}
        {pathname === "/dashboard/inventory" && (
          <div className="backdrop-blur-2xl bg-zinc-100/90 p-1 rounded-xl flex items-center gap-1 border border-zinc-200/60">
            <button
              type="button"
              onClick={() => handleSwitchInventoryTab("Intelligence")}
              className={`py-1 px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                inventoryTab === "Intelligence"
                  ? "bg-white shadow-xs text-zinc-900 font-bold "
                  : "text-zinc-500 hover:text-zinc-800 font-medium hover:bg-white/[0.04]"
              }`}
            >
              <Sparkles size={13} className={inventoryTab === "Intelligence" ? "text-[#E46254] " : "text-zinc-400"} />
              <span>Intelligence</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchInventoryTab("Materials")}
              className={`py-1 px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                inventoryTab === "Materials"
                  ? "bg-white shadow-xs text-zinc-900 font-bold "
                  : "text-zinc-500 hover:text-zinc-800 font-medium hover:bg-white/[0.04]"
              }`}
            >
              <Box size={13} className={inventoryTab === "Materials" ? "text-[#E46254] " : "text-zinc-400"} />
              <span>Materials Data</span>
            </button>
          </div>
        )}

        {/* Center: Customers Nav Toggle (ONLY for /dashboard/customers) */}
        {pathname === "/dashboard/customers" && (
          <div className="backdrop-blur-2xl bg-zinc-100/90 p-1 rounded-xl flex items-center gap-1 border border-zinc-200/60">
            <button
              type="button"
              onClick={() => handleSwitchCustomersTab("Intelligence")}
              className={`py-1 px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                customersTab === "Intelligence"
                  ? "bg-white shadow-xs text-zinc-900 font-bold "
                  : "text-zinc-500 hover:text-zinc-800 font-medium hover:bg-white/[0.04]"
              }`}
            >
              <Sparkles size={13} className={customersTab === "Intelligence" ? "text-[#E46254] " : "text-zinc-400"} />
              <span>Intelligence</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchCustomersTab("All Customers")}
              className={`py-1 px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                customersTab === "All Customers"
                  ? "bg-white shadow-xs text-zinc-900 font-bold "
                  : "text-zinc-500 hover:text-zinc-800 font-medium hover:bg-white/[0.04]"
              }`}
            >
              <Users size={13} className={customersTab === "All Customers" ? "text-[#E46254] " : "text-zinc-400"} />
              <span>All Customers</span>
            </button>
          </div>
        )}

        {/* Center/Right Actions: Search & Add Dish (ONLY for /dashboard/menu) */}
        {pathname === "/dashboard/menu" && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative w-40 sm:w-64 md:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#E46254] transition-colors" size={14} />
              <input
                ref={menuSearchInputRef}
                type="text"
                value={menuSearch}
                onChange={(e) => handleMenuSearchChange(e.target.value)}
                placeholder="Search dishes... (/)"
                className="w-full bg-zinc-100/90 hover:bg-zinc-100 focus:bg-white border border-zinc-200/70 focus:border-[#E46254] rounded-xl pl-8.5 pr-7 py-1.5 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 outline-none transition-all shadow-2xs"
              />
              {menuSearch && (
                <button
                  type="button"
                  onClick={() => handleMenuSearchChange("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleOpenAddDish}
              className="px-3 sm:px-3.5 py-1.5 bg-gradient-to-r from-[#E46254] via-[#ea580c] to-[#C2410C] hover:brightness-110 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#E46254]/30 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">Add Dish</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        )}

        {/* Right Side: Status Pill & Sign Out */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          

          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100/70 border border-transparent rounded-full text-[12px] text-zinc-600 font-semibold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden xs:inline">Live</span>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100/80 rounded-lg transition-colors cursor-pointer border border-transparent"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Backdrop overlay */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 bg-black/25 backdrop-blur-[4px] z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-out Sidebar Drawer (240px width) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[240px] bg-white backdrop-blur-3xl border-r border-zinc-200/80 text-zinc-900 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        }`}
      >
        {/* Sidebar Header with Original Logo */}
        <div className="h-16 flex items-center justify-between px-4 shrink-0 overflow-hidden relative border-b border-zinc-100">
          <img
            src="/logo.png"
            alt="TableTapy"
            className="w-[170px] max-w-none h-auto select-none"
            style={{ imageRendering: "-webkit-optimize-contrast" }}
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Navigation Links with Aesthetic Hover & Active States */}
        <nav className="px-3 py-3 flex-1 overflow-y-auto aesthetic-bar">
          {navGroups.map((group, idx) => (
            <div key={group.title} className={idx !== 0 ? "mt-5" : ""}>
              <h3 className="px-2.5 text-[11px] font-semibold text-zinc-400 tracking-wider mb-1 uppercase">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const isDisabled = hasRestaurant === false && item.href !== "/dashboard";

                  if (isDisabled) {
                    return (
                      <span
                        key={item.name}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-zinc-300 cursor-not-allowed opacity-40 select-none"
                        title="Complete store setup first"
                      >
                        <item.icon size={15} strokeWidth={1.5} className="text-zinc-300" />
                        {item.name}
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer text-left relative ${
                        isActive
                          ? "bg-[#E46254]/[0.08] text-[#E46254] font-bold "
                          : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 "
                      }`}
                    >
                      <item.icon
                        size={15}
                        strokeWidth={isActive ? 2.1 : 1.75}
                        className={`transition-colors duration-150 ${
                          isActive
                            ? "text-[#E46254] "
                            : "text-zinc-400 group-hover:text-[#E46254] "
                        }`}
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="h-4" />
        </nav>

        
      </aside>

      {/* Main Content Area */}
      <main
        className={`flex-1 min-h-0 relative w-full ${
          pathname === "/dashboard/pos" ? "overflow-hidden bg-[#FAFAFA] " : "overflow-y-auto bg-[#FAFAFA] "
        }`}
      >
        {children}
      </main>

      {/* Mandatory Owner Water Bottle Setup Blocker */}
      {hasRestaurant && <WaterBottleSetupModal />}
    </div>
  );
}