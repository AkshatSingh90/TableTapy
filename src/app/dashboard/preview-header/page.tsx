"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import POSPage from "../pos/page";
import {
  LayoutDashboard,
  Palette,
  Menu,
  Settings,
  QrCode,
  Users,
  UtensilsCrossed,
  MonitorPlay,
  BarChart3,
  Package,
  Megaphone,
  Receipt,
} from "lucide-react";

export default function HeaderPreviewPage() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const [activeHref, setActiveHref] = useState("/dashboard/pos");

  const navGroups = [
    {
      title: "OVERVIEW",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "POS", href: "/dashboard/pos", icon: MonitorPlay },
      ]
    },
    {
      title: "OPERATIONS",
      items: [
        { name: "Kitchen (KDS)", href: "/dashboard/kds", icon: UtensilsCrossed },
        { name: "Staffs", href: "/dashboard/staffs", icon: Users },
        { name: "Table Orders", href: "/dashboard/locations", icon: QrCode },
        { name: "Menu Availability", href: "/dashboard/menu", icon: Menu },
      ]
    },
    {
      title: "CRM & MARKETING",
      items: [
        { name: "Customers", href: "/dashboard/customers", icon: Users },
        { name: "Promotions", href: "/dashboard/promotions", icon: Megaphone },
      ]
    },
    {
      title: "BACK OFFICE",
      items: [
        { name: "Inventory", href: "/dashboard/inventory", icon: Package },
        { name: "Invoices", href: "/dashboard/invoices", icon: Receipt },
        { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
        { name: "Hardware Studio", href: "/dashboard/studio", icon: Palette },
        { name: "Settings", href: "/dashboard/settings", icon: Settings },
      ]
    }
  ];

  return (
    <div className="h-screen flex flex-col bg-[#FBFBFC] overflow-hidden">
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

      {/* Clean Aesthetic Header */}
      <header className="h-14 px-4 sm:px-6 border-b border-zinc-200/70 bg-white/95 backdrop-blur-md shrink-0 z-30 flex items-center justify-between">
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
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="TableTapy"
              className="w-[160px] max-w-none h-auto select-none"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </div>
        </div>

        {/* Right Side: Subtle Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100/70 rounded-full text-[12px] text-zinc-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live POS
          </div>
        </div>
      </header>

      {/* Backdrop overlay */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-out Sidebar Drawer (220px width) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[220px] bg-white border-r border-zinc-200/80 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header with Logo */}
        <div className="h-16 flex items-center px-4 shrink-0 overflow-hidden relative">
          <img
            src="/logo.png"
            alt="TableTapy"
            className="w-[180px] max-w-none h-auto select-none"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
          />
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
                  const isActive = activeHref === item.href;
                  return (
                    <button
                      key={item.name}
                      onClick={() => setActiveHref(item.href)}
                      className={`group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer text-left relative ${
                        isActive
                          ? "bg-[#E46254]/[0.08] text-[#E46254] font-semibold"
                          : "text-zinc-600 hover:text-[#E46254] hover:bg-transparent"
                      }`}
                    >
                      <item.icon
                        size={15}
                        strokeWidth={isActive ? 2.1 : 1.75}
                        className={`transition-colors duration-150 ${
                          isActive
                            ? "text-[#E46254]"
                            : "text-zinc-400 group-hover:text-[#E46254]"
                        }`}
                      />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="h-4" />
        </nav>
      </aside>

      {/* Embedded Live POS Page in Full Screen (Direct Component Mount) */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        <POSPage />
      </main>
    </div>
  );
}