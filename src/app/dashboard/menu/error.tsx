"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function MenuErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Menu page error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 text-[#E46254] flex items-center justify-center mb-4 border border-rose-100 shadow-inner">
        <AlertCircle size={28} />
      </div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1">Menu Catalog Notice</h2>
      <p className="text-xs text-zinc-500 max-w-md mb-5 leading-relaxed">
        {error?.message || "There was an issue rendering this menu category view."}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-[#E46254] hover:bg-[#d04e41] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
      >
        <RotateCcw size={14} /> Reload Menu
      </button>
    </div>
  );
}
