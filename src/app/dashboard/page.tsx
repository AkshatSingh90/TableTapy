"use client";
import Link from "next/link";
import { ArrowRight, Activity, Plus, Loader2, Store, ExternalLink, Building, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function DashboardOverview() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasRestaurant, setHasRestaurant] = useState(false);
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState<'RESTAURANT'|'HOTEL'>('RESTAURANT');
  const [restaurantData, setRestaurantData] = useState<any>(null);
  
  // Onboarding Form State
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [todaysOrders, setTodaysOrders] = useState(0);
  const [todaysRevenue, setTodaysRevenue] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setEmail(user.email ?? "");

      const restId = user.user_metadata?.restaurant_id;
      if (restId) {
        // Fetch their specific restaurant
        const { data: rData } = await supabase.from('restaurants').select('*').eq('id', restId).single();
        if (rData) {
          setRestaurantData(rData);
          setHasRestaurant(true);
        }
        // Fetch Today's Orders
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: ordersData } = await supabase
          .from('orders')
          .select('total, status')
          .eq('restaurant_id', restId)
          .gte('created_at', today.toISOString());
          
        if (ordersData) {
          setTodaysOrders(ordersData.length);
          const revenue = ordersData.reduce((sum, order) => sum + (order.total || 0), 0);
          setTodaysRevenue(revenue);
          
          const active = ordersData.filter(o => ['NEW', 'PREPARING', 'PENDING_UPI'].includes(o.status)).length;
          setActiveOrders(active);
        }

      }
      setLoading(false);
    }
    init();
  }, [supabase, router]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError("");

    try {
      // 1. Create the restaurant row
      const { data: newRest, error: insertError } = await supabase
        .from('restaurants')
        .insert({
          name: storeName,
          slug: storeSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          primary_color: '#111827',
          font: 'Inter, sans-serif',
          radius: 'rounded',
          business_type: businessType
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      // 2. Save the restaurant ID to the user's metadata so they "own" it
      const { error: updateError } = await supabase.auth.updateUser({
        data: { restaurant_id: newRest.id, slug: newRest.slug }
      });

      if (updateError) throw new Error(updateError.message);

      setRestaurantData(newRest);
      setHasRestaurant(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create store. Slug might be taken.");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500"><Loader2 className="animate-spin" size={32} /></div>;
  }

  // ONBOARDING SCREEN
  if (!hasRestaurant) {
    if (step === 1) {
      return (
        <div className="p-8 max-w-2xl mx-auto text-zinc-50 mt-12 sm:mt-20">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-3 tracking-tight">Welcome to TableTapy</h1>
            <p className="text-zinc-400 text-lg">What type of business are you running?</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button 
              onClick={() => { setBusinessType('RESTAURANT'); setStep(2); }}
              className="bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-[#E46254]/50 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all group"
            >
              <div className="w-20 h-20 rounded-full bg-[#E46254]/10 text-[#E46254] flex items-center justify-center group-hover:scale-110 transition-transform">
                <UtensilsCrossed size={40} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Restaurant / Cafe</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">Dine-in ordering, digital menus, and kitchen display systems.</p>
              </div>
            </button>
            
            <button 
              onClick={() => { setBusinessType('HOTEL'); setStep(2); }}
              className="bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-[#E46254]/50 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all group"
            >
              <div className="w-20 h-20 rounded-full bg-[#E46254]/10 text-[#E46254] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building size={40} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Hotel / Resort</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">In-room dining, guest amenities, and room charge billing.</p>
              </div>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 max-w-xl mx-auto text-zinc-50 mt-20">
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-2xl shadow-xl relative">
          <button onClick={() => setStep(1)} className="absolute top-6 left-6 text-zinc-500 hover:text-white transition-colors text-sm font-medium">
            &larr; Back
          </button>
          <div className="w-16 h-16 bg-[#E46254]/20 text-[#E46254] rounded-full flex items-center justify-center mb-6 mx-auto">
            {businessType === 'HOTEL' ? <Building size={32} /> : <Store size={32} />}
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Create Your {businessType === 'HOTEL' ? 'Hotel' : 'Restaurant'}</h1>
          <p className="text-zinc-400 text-center mb-8 text-sm">Let's set up your digital storefront.</p>
          
          <form onSubmit={handleCreateStore} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">{businessType === 'HOTEL' ? 'Hotel' : 'Restaurant'} Name</label>
              <input required type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm outline-none focus:border-[#E46254] text-white transition-colors" placeholder={businessType === 'HOTEL' ? "e.g. The Grand Plaza" : "e.g. Burger Palace"} />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Subdomain (URL)</label>
              <div className="flex">
                <input required type="text" value={storeSlug} onChange={e => setStoreSlug(e.target.value)} className="flex-1 bg-zinc-950 border border-r-0 border-zinc-800 rounded-l-lg p-3 text-sm outline-none focus:border-[#E46254] text-white transition-colors text-right" placeholder={businessType === 'HOTEL' ? "grand-plaza" : "burger-palace"} />
                <div className="bg-zinc-900 border border-zinc-800 rounded-r-lg p-3 text-sm text-zinc-500 flex items-center">
                  .localhost:3000
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">This will be your customers' link.</p>
            </div>

            {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}

            <button type="submit" disabled={isCreating} className="w-full py-3.5 bg-[#E46254] text-white font-bold rounded-xl hover:bg-[#c95346] transition-colors flex justify-center items-center gap-2 mt-4 disabled:opacity-50">
              {isCreating ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD (They have a restaurant)
  return (
    <div className="p-8 max-w-6xl mx-auto text-zinc-50">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Managing <strong className="text-zinc-300">{restaurantData?.name}</strong> as {email}
          </p>
        </div>
        <a href={`http://${restaurantData?.slug}.localhost:3000`} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-zinc-800 text-white text-sm font-semibold rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2 border border-zinc-700">
          View Live Site <ArrowRight size={16} />
        </a>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/dashboard/locations" className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-xl hover:border-zinc-600 transition-all group">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-zinc-400 text-sm font-medium group-hover:text-zinc-300 transition-colors">{restaurantData?.business_type === 'HOTEL' ? 'Manage Rooms' : 'Manage Tables'}</h3>
            <ArrowRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
          </div>
          <p className="text-3xl font-semibold text-white flex items-center gap-2">Locations <span className="text-xs px-2 py-1 bg-white/10 rounded-md text-zinc-400">QR Codes</span></p>
        </Link>
        
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-zinc-400 text-sm font-medium">Today's Orders</h3>
          </div>
          <p className="text-3xl font-semibold text-white">48</p>
        </div>
        
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-zinc-400 text-sm font-medium">Store URL</h3>
          </div>
          <p className="text-lg font-semibold text-[#E46254] truncate">{restaurantData?.slug}.localhost</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LIVE ORDERS DASHBOARD LINK */}
        <section className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-xl min-h-[400px] flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-6">
            <Activity size={32} />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-white">Live Kitchen Display</h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mb-6">
            Access your real-time Kitchen Display System (KDS) on a dedicated, full-screen subdomain designed for kitchen tablets.
          </p>
          <a href={typeof window !== 'undefined' && window.location.hostname.includes('localhost') ? '/orders_app' : 'https://orders.tabletapy.com'} target="_blank" rel="noreferrer" className="px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500 transition-colors flex items-center gap-2">
            Open Orders App <ExternalLink size={16} />
          </a>
          <p className="text-xs text-zinc-600 mt-4 font-mono">orders.tabletapy.com</p>
        </section>
        
        {/* Upsell Card */}
        {restaurantData?.business_type === 'HOTEL' ? (
          <section className="bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-xl flex flex-col justify-between min-h-[400px]">
            <div>
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-6">
                <Store size={32} />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-white">Room Service Catalog</h2>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
                Add amenities, toiletries, and late-night snacks to your digital room catalog for guests to order instantly.
              </p>
            </div>
            <Link href="/dashboard/menu" className="mt-6 px-5 py-2.5 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors w-max flex items-center gap-2 border border-zinc-700">
              Manage Catalog <ArrowRight size={16} />
            </Link>
          </section>
        ) : (
          <section className="bg-[#1A1110] border border-[#E46254]/20 p-8 rounded-xl flex flex-col justify-between min-h-[400px]">
            <div>
              <h2 className="text-xl font-semibold mb-2 text-[#F5B86F]">Design Your Theme</h2>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
                Open the Visual Designer to customize your menu's colors, fonts, and branding to perfectly match your restaurant's vibe.
              </p>
            </div>
            <Link href="/designer_app" className="mt-6 px-5 py-2.5 bg-[#E46254] text-white text-sm font-medium rounded-lg hover:bg-[#D35546] transition-colors w-max flex items-center gap-2">
              Open Theme Designer <ArrowRight size={16} />
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
