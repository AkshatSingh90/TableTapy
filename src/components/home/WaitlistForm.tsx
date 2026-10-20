'use client';

import { useState } from "react";
import { Sparkles, CheckCircle, ArrowRight, Building2, Phone, Mail } from "lucide-react";

export function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    restaurantName: "",
    email: "",
    phone: "",
    outlets: "1-2 Outlets",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.restaurantName || !formData.email) return;
    setSubmitted(true);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {submitted ? (
        <div className="p-8 rounded-3xl backdrop-blur-3xl bg-white/[0.04] border border-emerald-500/30 text-center shadow-[0_20px_50px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center mb-4">
            <CheckCircle size={28} />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Priority Onboarding Reserved</h3>
          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
            Thank you, <strong className="text-white">{formData.restaurantName}</strong>. Our founding team at FlowTalk will contact you within 24 hours to schedule your pilot hardware integration.
          </p>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20">
            Cohort 1 • Private Beta Priority Access
          </span>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="relative p-6 sm:p-8 rounded-3xl backdrop-blur-3xl bg-zinc-950/70 border border-white/[0.1] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.15),inset_0_-1px_1px_0_rgba(0,0,0,0.6),0_24px_64px_-12px_rgba(0,0,0,0.8)] space-y-4"
        >
          {/* Subtle refraction highlight */}
          <div className="absolute top-0 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-[#E46254]/50 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div>
              <span className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles size={14} className="text-[#E46254]" /> Request Pilot Deployment
              </span>
              <p className="text-xs text-zinc-400">Join our founding cohort of Indian restaurants</p>
            </div>
            <span className="text-[10px] font-mono text-[#E46254] bg-[#E46254]/10 px-2.5 py-1 rounded-full border border-[#E46254]/20 font-semibold">
              Q1 2026 ROLLOUT
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Restaurant / Brand Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Copper Chimney"
                  value={formData.restaurantName}
                  onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-[#E46254] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Number of Outlets</label>
              <select
                value={formData.outlets}
                onChange={(e) => setFormData({ ...formData, outlets: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#E46254] transition-colors"
              >
                <option value="1-2 Outlets">1 - 2 Outlets (Single / Twin Branch)</option>
                <option value="3-10 Outlets">3 - 10 Outlets (Regional Chain)</option>
                <option value="10+ Outlets">10+ Outlets (Enterprise Food Chain)</option>
                <option value="Cloud Kitchen">Cloud Kitchen / QSR Counter Only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Work Email</label>
              <input
                type="email"
                required
                placeholder="founder@restaurant.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-[#E46254] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">WhatsApp / Phone</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-[#E46254] transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#E46254] via-[#ea580c] to-[#C2410C] hover:brightness-110 shadow-lg shadow-[#E46254]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Submit Early Access Request</span>
              <ArrowRight size={14} />
            </button>
            <p className="text-[10px] text-zinc-500 text-center mt-2.5">
              Zero upfront commitment. Includes complimentary hardware audit for thermal printers and tablets.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
