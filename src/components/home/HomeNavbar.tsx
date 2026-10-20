'use client';

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LogIn, LogOut, LayoutDashboard, Sparkles, Menu, X } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

interface HomeNavbarProps {
  user: {
    email?: string;
  } | null;
}

export function HomeNavbar({ user }: HomeNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      {/* Main Glass Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <nav className="relative rounded-2xl backdrop-blur-2xl bg-zinc-950/70 border border-white/[0.08] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12),inset_0_-1px_1px_0_rgba(0,0,0,0.4),0_12px_32px_-4px_rgba(0,0,0,0.6)] px-4 sm:px-6 py-3 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center group py-0.5">
            <img 
              src="/logo-clean.png" 
              alt="TableTapy" 
              className="h-8 sm:h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#pos" className="hover:text-white transition-colors">Quick POS</a>
            <a href="#kds" className="hover:text-white transition-colors">Kitchen &amp; KOT</a>
            <a href="#aggregators" className="hover:text-white transition-colors">UrbanPiper Sync</a>
            <a href="#vision" className="hover:text-white transition-colors">Vision</a>
          </div>

          {/* Auth State & Call to Actions */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#E46254] to-[#C2410C] hover:brightness-110 shadow-md shadow-[#E46254]/20 flex items-center gap-2 transition-all"
                >
                  <LayoutDashboard size={14} /> Open Dashboard
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="p-2 rounded-xl text-zinc-400 hover:text-white border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.06] transition-all"
                    title="Log Out"
                  >
                    <LogOut size={16} />
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.06] transition-all flex items-center gap-1.5"
                >
                  <LogIn size={13} /> Log In
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#E46254] via-[#ea580c] to-[#C2410C] hover:brightness-110 shadow-lg shadow-[#E46254]/25 transition-all flex items-center gap-1.5"
                >
                  Early Access <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-zinc-400 hover:text-white rounded-lg border border-white/[0.08]"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="sm:hidden mt-2 rounded-2xl backdrop-blur-3xl bg-zinc-950/95 border border-white/[0.08] p-5 shadow-2xl flex flex-col gap-4 text-sm animate-in fade-in slide-in-from-top-2">
            <a 
              href="#pos" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-zinc-300 hover:text-white py-1"
            >
              Quick POS Terminal
            </a>
            <a 
              href="#kds" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-zinc-300 hover:text-white py-1"
            >
              Kitchen &amp; KOT Dual Print
            </a>
            <a 
              href="#aggregators" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-zinc-300 hover:text-white py-1"
            >
              UrbanPiper Delivery Sync
            </a>
            <a 
              href="#vision" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-zinc-300 hover:text-white py-1"
            >
              Our Vision
            </a>

            <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="w-full text-center py-2.5 rounded-xl font-semibold text-xs text-white bg-[#E46254]"
                  >
                    Go to Dashboard
                  </Link>
                  <form action={signOut} className="w-full">
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl text-xs text-zinc-400 hover:text-white border border-white/[0.08]"
                    >
                      Sign Out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="w-full text-center py-2.5 rounded-xl font-medium text-xs text-zinc-200 border border-white/[0.08]"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    className="w-full text-center py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-[#E46254] to-[#C2410C]"
                  >
                    Request Early Access
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
