"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const nextUrl = urlParams.get('next');
      if (nextUrl) {
        window.location.href = nextUrl;
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950">
      
      {/* LEFT PANEL: The Engine (Form) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative z-10">
        <div className="max-w-md w-full space-y-8">
          
          <div className="mb-10 lg:hidden relative h-24 overflow-hidden rounded-xl bg-zinc-900/50 border border-zinc-800">
            <img src="/logo.png" alt="TableTapy" className="w-[220px] max-w-none h-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ imageRendering: '-webkit-optimize-contrast' }} />
          </div>

          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Welcome back</h2>
            <p className="text-zinc-500 mt-2">Enter your credentials to access your restaurant dashboard.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@restaurant.com" 
                required 
                autoFocus
                className="w-full bg-zinc-900/50 border border-zinc-800 text-white rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-[#E46254]/50 focus:border-[#E46254] transition-all" 
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                 <label className="block text-sm font-medium text-zinc-300">Password</label>
                 <a href="#" className="text-sm text-[#E46254] hover:text-[#D35546] font-medium transition-colors">Forgot password?</a>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                required 
                minLength={6} 
                className="w-full bg-zinc-900/50 border border-zinc-800 text-white rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-[#E46254]/50 focus:border-[#E46254] transition-all" 
              />
            </div>
            
            {/* Contextual Inline Error Handling */}
            {error && (
              <div className="flex items-center gap-2 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle size={16} className="shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3.5 bg-white text-zinc-950 rounded-xl font-semibold hover:bg-zinc-200 transition-colors mt-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin text-zinc-600" /> : "Sign In"}
            </button>
          </form>
          
          <p className="text-center text-sm text-zinc-500 mt-8">
            Don't have an account? <Link href="/signup" className="text-white hover:underline font-medium">Create one now</Link>
          </p>
        </div>
      </div>

      {/* RIGHT PANEL: The Vibe (Branding) */}
      <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center border-l border-zinc-800">
        {/* Cinematic Orbs */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-[#E46254]/20 to-[#912739]/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-[#F5B86F]/10 to-transparent blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <img src="/logo.png" alt="TableTapy" className="w-[320px] max-w-none -mb-10" style={{ imageRendering: '-webkit-optimize-contrast' }} />
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl max-w-sm text-center shadow-2xl">
            <h3 className="text-white font-semibold mb-2">The Ultimate Restaurant OS</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Join top restaurants using TableTapy to manage digital menus, automate NFC ordering, and increase table turnover.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
