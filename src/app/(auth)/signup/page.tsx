"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic password strength evaluation
  const isLengthValid = password.length >= 6;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLengthValid) return; // Prevent submission if weak
    
    setError("");
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
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
            <h2 className="text-3xl font-bold text-white tracking-tight">Create an account</h2>
            <p className="text-zinc-500 mt-2">Start managing your restaurant faster and smarter today.</p>
          </div>
          
          <form onSubmit={handleSignup} className="space-y-5">
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
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a secure password" 
                required 
                className="w-full bg-zinc-900/50 border border-zinc-800 text-white rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-[#E46254]/50 focus:border-[#E46254] transition-all" 
              />
              
              {/* Dynamic Inline Password Checklist */}
              {password.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2 text-xs font-medium animate-in fade-in">
                  <CheckCircle2 size={14} className={isLengthValid ? "text-green-500" : "text-zinc-600"} />
                  <span className={isLengthValid ? "text-green-500" : "text-zinc-500"}>At least 6 characters</span>
                </div>
              )}
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
              disabled={isLoading || (password.length > 0 && !isLengthValid)}
              className="w-full flex items-center justify-center py-3.5 bg-[#E46254] text-white rounded-xl font-semibold hover:bg-[#D35546] transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(228,98,84,0.3)]"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin text-white" /> : "Create Account"}
            </button>
          </form>
          
          <p className="text-center text-sm text-zinc-500 mt-8">
            Already have an account? <Link href="/login" className="text-white hover:underline font-medium">Log in instead</Link>
          </p>
        </div>
      </div>

      {/* RIGHT PANEL: The Vibe (Branding) */}
      <div className="hidden lg:flex w-1/2 bg-zinc-900 relative overflow-hidden items-center justify-center border-l border-zinc-800">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-[#F5B86F]/10 to-[#912739]/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-[#E46254]/20 to-transparent blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <img src="/logo.png" alt="TableTapy" className="w-[320px] max-w-none -mb-10" style={{ imageRendering: '-webkit-optimize-contrast' }} />
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-xl shadow-xl">
              <div className="text-[#F5B86F] font-bold text-lg mb-1">Instant Orders</div>
              <p className="text-zinc-400 text-xs leading-relaxed">Diners tap to order. Kitchen receives it instantly.</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-xl shadow-xl">
              <div className="text-[#E46254] font-bold text-lg mb-1">Live Analytics</div>
              <p className="text-zinc-400 text-xs leading-relaxed">Track your revenue and table turnover in real-time.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
