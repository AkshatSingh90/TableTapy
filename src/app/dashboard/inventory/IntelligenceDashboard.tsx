import React from 'react';
import { TrendingDown, PackageOpen, AlertTriangle, Search } from 'lucide-react';

export default function IntelligenceDashboard() {
  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto mt-6 font-sans">
      <div className="mb-8">
        <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Tabletapy Inventory Intelligence</h1>
        <p className="text-[13px] text-gray-500 mt-1">Smart insights, ordering recommendations, and variance tracking.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1 */}
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <TrendingDown size={22} className="text-[#E46254] transition-transform group-hover:-translate-y-0.5" />
            <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">Ingredient Price Rising</h2>
          </div>
          <p className="text-[13px] text-gray-500 font-medium pl-[34px]">See which dishes are losing margins</p>
        </div>

        {/* Card 2 */}
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <PackageOpen size={22} className="text-[#E46254] transition-transform group-hover:-translate-y-0.5" />
            <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">Order Recommendations</h2>
          </div>
          <p className="text-[13px] text-gray-500 font-medium pl-[34px]">Review suggested quantities</p>
        </div>

        {/* Card 3 */}
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} className="text-[#E46254] transition-transform group-hover:-translate-y-0.5" />
            <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">Stock at Risk</h2>
          </div>
          <p className="text-[13px] text-gray-500 font-medium pl-[34px]">Prioritise expiring ingredients</p>
        </div>

        {/* Card 4 */}
        <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all cursor-pointer group flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Search size={22} className="text-[#E46254] transition-transform group-hover:-translate-y-0.5" />
            <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">Investigate Variances</h2>
          </div>
          <p className="text-[13px] text-gray-500 font-medium pl-[34px]">Find unexplained consumption</p>
        </div>
      </div>
    </div>
  );
}
