"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Palette, Menu, Settings, LogOut, Bell, QrCode, ShoppingCart, Users, ClipboardList, UtensilsCrossed, MonitorPlay, BarChart3, Package, FileText, Megaphone, CalendarCheck, Receipt, MessageSquare, ConciergeBell } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { WaterBottleSetupModal } from "@/components/WaterBottleSetupModal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh(); // Clear server cache
  };

  
  const [businessType, setBusinessType] = useState('RESTAURANT');
  const [hasRestaurant, setHasRestaurant] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchUserRestaurant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const restId = user.user_metadata?.restaurant_id;
      if (!restId) {
        setHasRestaurant(false);
        // If user hasn't created a restaurant yet, force them to stay on /dashboard onboarding
        if (pathname !== '/dashboard') {
          router.replace('/dashboard');
        }
        return;
      }

      setHasRestaurant(true);
      const { data } = await supabase.from('restaurants').select('business_type').eq('id', restId).single();
      if (data?.business_type) {
        setBusinessType(data.business_type);
      }
    };
    fetchUserRestaurant();
  }, [supabase, pathname, router]);

  const navGroups = businessType === 'HOTEL' ? [
    {
      title: "OVERVIEW",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ]
    },
    {
      title: "OPERATIONS",
      items: [
        { name: "Guest Catalog", href: "/dashboard/menu", icon: Menu },
        { name: "Rooms & QR", href: "/dashboard/locations", icon: QrCode },
      ]
    },
    {
      title: "BACK OFFICE",
      items: [
        { name: "Hardware Studio", href: "/dashboard/studio", icon: Palette },
        { name: "Settings", href: "/dashboard/settings", icon: Settings },
      ]
    }
  ] : [
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
        { name: "Orders", href: "/dashboard/orders", icon: ClipboardList },
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
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-gray-900 relative pb-20 md:pb-0">
      
      {/* Desktop Sidebar - Sleek Apple-style Look */}
      <aside className="w-[220px] shrink-0 bg-white border-r border-zinc-200/80 flex-col hidden md:flex h-screen sticky top-0">
        <div className="h-16 flex items-center px-4 shrink-0 relative overflow-hidden">
          <img src="/logo.png" alt="TableTapy" className="w-[180px] max-w-none h-auto absolute top-1/2 -translate-y-1/2 left-2 mt-1.5" style={{ imageRendering: '-webkit-optimize-contrast' }} />
        </div>
        
        <nav className="px-3 py-3 flex-1 overflow-y-auto slim-scrollbar">
          {navGroups.map((group, idx) => (
            <div key={group.title} className={idx !== 0 ? "mt-5" : ""}>
              <h3 className="px-2.5 text-[11px] font-semibold text-zinc-400 tracking-wider mb-1 uppercase">{group.title}</h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const isDisabled = hasRestaurant === false && item.href !== '/dashboard';

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
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                        isActive 
                          ? 'bg-[#E46254]/8 text-[#E46254] font-semibold' 
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                      }`}
                    >
                      <item.icon size={15} strokeWidth={isActive ? 2.2 : 1.75} className={isActive ? "text-[#E46254]" : "text-zinc-400"} /> 
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-zinc-200/80 shrink-0">
           <button onClick={handleSignOut} className="flex items-center gap-2.5 px-2.5 py-1.5 w-full rounded-lg text-[13px] font-medium text-zinc-500 hover:bg-zinc-100/70 hover:text-zinc-900 transition-colors cursor-pointer">
             <LogOut size={15} className="text-zinc-400" /> Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[#FAFAFA] relative w-full">
        <div className="md:hidden h-16 flex items-center justify-center border-b border-zinc-200 bg-white sticky top-0 z-40 relative overflow-hidden">
          <img src="/logo.png" alt="TableTapy" className="w-[180px] max-w-none h-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-1.5" style={{ imageRendering: '-webkit-optimize-contrast' }} />
        </div>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {hasRestaurant && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 z-50 flex justify-around items-center px-2 py-2.5 pb-safe shadow-lg">
          {navGroups.flatMap(g => g.items).slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`flex flex-col items-center justify-center w-16 p-1 rounded-lg transition-colors ${
                  isActive ? 'text-[#E46254]' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <item.icon size={19} className="mb-0.5" />
                <span className="text-[11px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {/* Mandatory Owner Water Bottle Setup Blocker */}
      {hasRestaurant && <WaterBottleSetupModal />}

    </div>
  );
}
