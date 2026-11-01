"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, Theme } from "./ThemeProvider";

interface ThemeToggleProps {
  variant?: "pill" | "sidebar" | "settings";
  className?: string;
}

export function ThemeToggle({ variant = "pill", className = "" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === "sidebar") {
      return (
        <div className={`h-11 rounded-xl bg-zinc-100 dark:bg-white/[0.03] animate-pulse ${className}`} />
      );
    }
    if (variant === "settings") {
      return (
        <div className={`h-9 w-60 rounded-xl bg-zinc-100 dark:bg-white/[0.03] animate-pulse ${className}`} />
      );
    }
    return (
      <div className={`h-8 w-20 rounded-full bg-zinc-100 dark:bg-white/[0.03] animate-pulse ${className}`} />
    );
  }

  // 1. Sidebar Footer Toggle
  if (variant === "sidebar") {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100/90 dark:bg-white/[0.03] border border-zinc-200/70 dark:border-white/[0.08] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/[0.08] flex items-center justify-center text-zinc-700 dark:text-[#E46254] shadow-xs">
              {resolvedTheme === "dark" ? <Moon size={14} /> : <Sun size={14} className="text-amber-500" />}
            </div>
            <div>
              <div className="text-[12px] font-semibold text-zinc-800 dark:text-white leading-tight">
                {resolvedTheme === "dark" ? "Obsidian Dark" : "Clean Light"}
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-none">
                {theme === "system" ? "Sync with OS" : "Manual Mode"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              resolvedTheme === "dark" ? "bg-gradient-to-r from-[#E46254] to-[#C2410C] shadow-md shadow-[#E46254]/30" : "bg-zinc-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                resolvedTheme === "dark" ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* 3-way quick select */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100/60 dark:bg-zinc-950/80 border border-zinc-200/50 dark:border-white/[0.06] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.06)]">
          {(
            [
              { id: "light", label: "Light", icon: Sun },
              { id: "system", label: "Auto", icon: Monitor },
              { id: "dark", label: "Dark", icon: Moon },
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            const isSelected = theme === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setTheme(m.id)}
                className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-gradient-to-r dark:from-[#E46254] dark:to-[#C2410C] text-zinc-900 dark:text-white shadow-xs dark:shadow-md dark:shadow-[#E46254]/30 font-bold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={11} className={isSelected ? (resolvedTheme === "dark" ? "text-white" : "text-[#E46254]") : ""} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Settings Segmented 3-Way Selector (Light, System, Dark)
  if (variant === "settings") {
    const options: { value: Theme; label: string; icon: any; desc: string }[] = [
      { value: "light", label: "Clean Light", icon: Sun, desc: "Classic white paper canvas" },
      { value: "system", label: "System Sync", icon: Monitor, desc: "Auto follow device OS theme" },
      { value: "dark", label: "Obsidian Luxury", icon: Moon, desc: "Atmospheric glassmorphism & zero glare" },
    ];

    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? "bg-[#E46254]/5 dark:bg-gradient-to-br dark:from-[#E46254]/15 dark:via-[#C2410C]/08 dark:to-transparent border-[#E46254] ring-1 ring-[#E46254]/30 dark:shadow-[0_0_24px_rgba(228,98,84,0.18),inset_0_1px_1px_0_rgba(255,255,255,0.1)]"
                  : "bg-white dark:bg-white/[0.025] backdrop-blur-xl border-zinc-200/80 dark:border-white/[0.08] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.06)] hover:border-zinc-300 dark:hover:border-white/[0.2] hover:bg-zinc-50 dark:hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs transition-colors ${
                      isSelected
                        ? "bg-gradient-to-r from-[#E46254] to-[#C2410C] text-white shadow-md shadow-[#E46254]/30"
                        : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    {opt.label}
                  </span>
                </div>
                {isSelected && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E46254] shadow-[0_0_10px_#E46254]" />
                )}
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {opt.desc}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // 3. Compact Header Pill Toggle (Prominent & Clear with Glowing Coral)
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={`group flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100/90 dark:bg-zinc-950/70 hover:bg-zinc-200/80 dark:hover:bg-zinc-900 border border-zinc-200/80 dark:border-white/[0.1] text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer shadow-2xs hover:border-[#E46254]/50 dark:hover:border-[#E46254]/60 active:scale-95 dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.1),0_0_12px_rgba(0,0,0,0.5)] ${className}`}
      title={
        resolvedTheme === "dark"
          ? "Switch to Clean Light mode"
          : "Switch to Obsidian Luxury Dark mode"
      }
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {resolvedTheme === "dark" ? (
          <Moon size={14} className="text-[#E46254] transition-transform group-hover:rotate-12 drop-shadow-[0_0_6px_rgba(228,98,84,0.6)]" />
        ) : (
          <Sun size={14} className="text-amber-500 transition-transform group-hover:rotate-45" />
        )}
      </div>
      <span className="font-semibold text-[12px] select-none text-zinc-800 dark:text-white">
        {resolvedTheme === "dark" ? "Dark" : "Light"}
      </span>
    </button>
  );
}
