"use client";

import React, { useState } from 'react';
import { KeyRound, User, Phone, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';

interface TableUnlockModalProps {
  isOpen: boolean;
  tableNo: string;
  expectedPin: string;
  restaurantName?: string;
  primaryColor?: string;
  onUnlock: (details: { name: string; phone: string; pin: string }) => void;
}

export function TableUnlockModal({
  isOpen,
  tableNo,
  expectedPin,
  restaurantName = "Restaurant",
  primaryColor = "#E46254",
  onUnlock
}: TableUnlockModalProps) {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPin = pin.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanName = name.trim();

    if (!cleanPin || cleanPin.length !== 4) {
      setError("Please enter the 4-digit Table PIN from your captain.");
      return;
    }

    console.log("[Table Security Check]", {
      tableNo,
      enteredPin: cleanPin,
      expectedPin
    });

    // Verify PIN against active expected PIN
    if (expectedPin && cleanPin !== expectedPin) {
      setError("Incorrect Table PIN. Please ask your floor captain for the code.");
      return;
    }

    if (!cleanName || cleanName.length < 2) {
      setError("Please enter your name.");
      return;
    }

    if (!cleanPhone || cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsSubmitting(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }

    onUnlock({
      name: cleanName,
      phone: cleanPhone,
      pin: cleanPin
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-zinc-200/90 text-left animate-in zoom-in-95 duration-200 relative overflow-hidden">
        
        {/* Subtle Brand Color Accent Line on Top */}
        <div 
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: primaryColor }}
        />

        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-4 mt-1">
          <div className="flex items-center gap-2">
            <span 
              className="text-[11px] font-black tracking-wide uppercase px-2.5 py-1 rounded-full border"
              style={{ 
                backgroundColor: `${primaryColor}12`, 
                color: primaryColor,
                borderColor: `${primaryColor}28`
              }}
            >
              Table {tableNo}
            </span>
            <span className="text-[12px] font-medium text-zinc-400">· {restaurantName}</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
            <ShieldCheck size={15} />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[20px] font-black text-zinc-900 tracking-tight leading-snug">
          Welcome to Table {tableNo}!
        </h3>
        <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed">
          Ask your captain for today&apos;s Table PIN to start ordering.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          
          {/* 4-Digit Table PIN Input */}
          <div>
            <label className="block text-[11.5px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
              4-Digit Table PIN
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setError(null);
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                }}
                placeholder="••••"
                className="w-full text-center text-2xl font-black tracking-[0.4em] py-2.5 px-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:bg-white transition-all tabular-nums"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                autoFocus
              />
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {/* Customer Name */}
          <div>
            <label className="block text-[11.5px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
              Your Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setError(null);
                  setName(e.target.value);
                }}
                placeholder="e.g. Rahul Sharma"
                className="w-full text-[14px] font-semibold py-2.5 pl-10 pr-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:bg-white transition-all"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {/* Customer Phone (10 digits) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11.5px] font-bold uppercase tracking-wider text-zinc-600">
                Mobile Number
              </label>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                <Sparkles size={11} />
                <span>Earn Stars & Live Bill</span>
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-[13px] font-bold text-zinc-400 pointer-events-none">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  setError(null);
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                }}
                placeholder="10-digit number"
                className="w-full text-[14px] font-semibold py-2.5 pl-12 pr-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:bg-white transition-all tabular-nums"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
              <Phone size={15} className="absolute right-3.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-[12px] font-medium text-red-700 flex items-center gap-2 animate-in shake duration-150">
              <AlertCircle size={15} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !expectedPin}
            className="w-full py-3.5 px-4 text-white font-black text-[14px] rounded-2xl shadow-md transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mt-4 hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {isSubmitting ? (
              <span>Unlocking Menu...</span>
            ) : !expectedPin ? (
              <span>Connecting Table...</span>
            ) : (
              <>
                <span>Unlock Menu & Start Ordering</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-zinc-400 text-center mt-4">
          Multiple friends at Table {tableNo} can scan and add dishes together in real time.
        </p>
      </div>
    </div>
  );
}
