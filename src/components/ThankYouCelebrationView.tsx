"use client";

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Star, 
  Receipt, 
  Printer, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  Sparkles,
  Download
} from 'lucide-react';

export interface SettlementData {
  settledAt: number;
  tableNo: string;
  restaurantId: string;
  restaurantName: string;
  logoUrl?: string;
  grandTotal: number;
  subtotal: number;
  discount: number;
  taxAmount: number;
  serviceChargeAmount?: number;
  earnedCoins: number;
  totalCoins: number;
  previousCoins?: number;
  isPayer?: boolean;
  payerName?: string;
  payerPhone?: string;
  customerPhone?: string;
  customerName?: string;
  items: { name: string; count: number; price: number }[];
  invoiceNumber: string;
  upiId?: string;
}

interface ThankYouCelebrationViewProps {
  settlement: SettlementData;
  primaryColor?: string;
  onClose?: () => void;
  onNewScan?: () => void;
}

export function ThankYouCelebrationView({ 
  settlement, 
  primaryColor = "#E46254", 
  onClose, 
  onNewScan 
}: ThankYouCelebrationViewProps) {
  const [showDetailedReceipt, setShowDetailedReceipt] = useState(true);

  const formatCurrency = (val: number) => `₹${val.toFixed(2)}`;
  const handleReturnToMenu = onClose || onNewScan;

  const handlePrintOrSave = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const isPayer = settlement.isPayer !== false;
  const earnedStars = settlement.earnedCoins || 0;
  const totalStars = settlement.totalCoins || 0;
  const previousStars = settlement.previousCoins !== undefined 
    ? settlement.previousCoins 
    : Math.max(0, totalStars - (isPayer ? earnedStars : 0));

  const cleanPhone = (settlement.customerPhone || '').replace(/\D/g, '');
  const payerCleanPhone = (settlement.payerPhone || settlement.customerPhone || '').replace(/\D/g, '');
  const payerDisplayName = settlement.payerName || settlement.customerName || 'Table Guest';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col justify-between font-sans animate-in fade-in duration-300">
      
      {/* TOP HEADER */}
      <header className="p-4 border-b border-zinc-200/80 bg-white/95 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-md mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {settlement.logoUrl ? (
              <img 
                src={settlement.logoUrl} 
                alt={settlement.restaurantName} 
                className="w-8 h-8 rounded-full object-cover border border-zinc-200 shrink-0" 
              />
            ) : (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                style={{ 
                  backgroundColor: `${primaryColor}15`, 
                  color: primaryColor,
                  border: `1px solid ${primaryColor}30`
                }}
              >
                {(settlement.restaurantName || 'R')[0]}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-xs font-bold tracking-tight text-zinc-900 truncate">
                {settlement.restaurantName || "Restaurant"}
              </h3>
              <p className="text-[11px] text-zinc-500 font-medium truncate">
                Table {settlement.tableNo} • {new Date(settlement.settledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Paid
            </span>
          </div>
        </div>
      </header>

      {/* MAIN BODY CONTAINER */}
      <main className="max-w-md mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        
        {/* PAYMENT CONFIRMED HERO CARD */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200/90 shadow-sm text-center relative overflow-hidden">
          {/* Subtle brand tint bar on top */}
          <div 
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: primaryColor }}
          />

          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
            <CheckCircle2 size={30} strokeWidth={2.5} />
          </div>

          <h2 className="text-xl font-black tracking-tight text-zinc-900">
            {isPayer ? "Payment Confirmed!" : `Bill Settled by ${payerDisplayName}!`}
          </h2>
          <p className="text-[13px] text-zinc-600 mt-1 max-w-sm mx-auto leading-relaxed">
            {isPayer ? (
              settlement.customerName ? (
                <>Thank you, <strong className="text-zinc-900 font-semibold">{settlement.customerName}</strong>! We loved serving you today at Table {settlement.tableNo}. Hope you enjoyed every bite!</>
              ) : (
                <>Thank you for dining with us! We loved serving you today at Table {settlement.tableNo}. Hope you enjoyed every bite!</>
              )
            ) : (
              <>The bill for <strong className="text-zinc-900 font-semibold">Table {settlement.tableNo}</strong> was paid by <strong className="text-zinc-900 font-semibold">{payerDisplayName}</strong>. Thank you for dining with us!</>
            )}
          </p>

          <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-col items-center">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
              Total Amount Paid
            </span>
            <span className="text-3xl font-black text-zinc-900 mt-1 tabular-nums">
              {formatCurrency(settlement.grandTotal)}
            </span>
            <span className="text-[11px] text-zinc-400 mt-1 font-mono">
              Invoice #{settlement.invoiceNumber}
            </span>
          </div>

          {/* REWARDS & STARS BREAKDOWN (ONLY PAYER RECEIVES REWARDS) */}
          {isPayer ? (
            (totalStars > 0 || earnedStars > 0 || cleanPhone.length === 10) && (
              <div 
                className="mt-5 p-4 rounded-2xl text-left border"
                style={{ 
                  backgroundColor: `${primaryColor}06`, 
                  borderColor: `${primaryColor}20` 
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200/60">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                    >
                      <Star size={14} className="fill-current" />
                    </div>
                    <div>
                      <h4 className="text-[12.5px] font-bold text-zinc-900">
                        TableTapy Stars & Rewards
                      </h4>
                      <p className="text-[10.5px] text-zinc-500">
                        {cleanPhone.length === 10 ? `Credited to your number: +91 ${cleanPhone}` : 'Redeemable on future dining'}
                      </p>
                    </div>
                  </div>

                  <span 
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full border tabular-nums"
                    style={{ 
                      backgroundColor: 'white', 
                      color: primaryColor,
                      borderColor: `${primaryColor}30`
                    }}
                  >
                    Worth ₹{totalStars}
                  </span>
                </div>

                {/* 3-Column Balance Breakdown */}
                <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-zinc-200/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Previous
                    </span>
                    <span className="text-[14px] font-bold text-zinc-700 tabular-nums mt-0.5 block">
                      {previousStars}
                    </span>
                    <span className="text-[9.5px] text-zinc-400 font-medium">Stars</span>
                  </div>

                  <div 
                    className="bg-white p-2.5 rounded-xl border"
                    style={{ borderColor: `${primaryColor}40` }}
                  >
                    <span 
                      className="text-[10px] font-bold uppercase tracking-wider block"
                      style={{ color: primaryColor }}
                    >
                      Earned Today
                    </span>
                    <span 
                      className="text-[14px] font-black tabular-nums mt-0.5 block"
                      style={{ color: primaryColor }}
                    >
                      +{earnedStars}
                    </span>
                    <span className="text-[9.5px] font-medium" style={{ color: primaryColor }}>Stars</span>
                  </div>

                  <div className="bg-emerald-50/90 p-2.5 rounded-xl border border-emerald-200/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      Total Now
                    </span>
                    <span className="text-[14px] font-black text-emerald-800 tabular-nums mt-0.5 block">
                      {totalStars}
                    </span>
                    <span className="text-[9.5px] text-emerald-600 font-medium">Stars</span>
                  </div>
                </div>

                {settlement.discount > 0 && (
                  <p className="text-[11px] text-zinc-600 mt-2.5 text-center font-medium">
                    Redeemed <strong>{Math.round(settlement.discount)} stars</strong> on this bill (Saved {formatCurrency(settlement.discount)})
                  </p>
                )}
              </div>
            )
          ) : (
            /* COMPANION VIEW: Rewards credited strictly to the paying guest */
            <div className="mt-5 p-4 rounded-2xl text-left border border-zinc-200/80 bg-zinc-50/80 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Star size={14} className="fill-current" />
                  </div>
                  <div>
                    <h4 className="text-[12.5px] font-bold text-zinc-900">
                      Rewards Credited to {payerDisplayName}
                    </h4>
                    <p className="text-[10.5px] text-zinc-500">
                      {payerCleanPhone ? `Saved to +91 ${payerCleanPhone}` : 'Payer account updated'}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-zinc-200 text-zinc-700 tabular-nums">
                  +{earnedStars} Stars
                </span>
              </div>
              <p className="text-[11.5px] text-zinc-500 leading-normal">
                Only the diner settling the bill receives today&apos;s rewards. Your personal stars balance remains safe in your account.
              </p>
              <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-[12px]">
                <span className="text-zinc-600 font-medium">Your Current Balance</span>
                <span className="font-bold text-zinc-900 tabular-nums">★ {totalStars} Stars</span>
              </div>
            </div>
          )}
        </div>

        {/* ITEMIZED RECEIPT CARD */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200/90 shadow-sm flex flex-col gap-3">
          <div 
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowDetailedReceipt(prev => !prev)}
          >
            <div className="flex items-center gap-2">
              <Receipt size={16} className="text-zinc-500" />
              <h4 className="text-[13px] font-bold text-zinc-900 tracking-tight">
                Tax Invoice & Dishes ({settlement.items.length})
              </h4>
            </div>
            <button 
              type="button" 
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {showDetailedReceipt ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {showDetailedReceipt && (
            <div className="pt-2 border-t border-zinc-100 flex flex-col gap-2.5 animate-in fade-in duration-200">
              {/* Itemized List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {settlement.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[12.5px] py-1 border-b border-zinc-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-5 h-5 rounded-md bg-zinc-100 text-zinc-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {item.count}x
                      </span>
                      <span className="font-semibold text-zinc-800 truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-bold text-zinc-900 shrink-0 tabular-nums">
                      {formatCurrency(item.price * item.count)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tax & Discount Breakdown */}
              <div className="pt-2 border-t border-zinc-100 space-y-1 text-[11.5px] text-zinc-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium tabular-nums">{formatCurrency(settlement.subtotal)}</span>
                </div>
                {settlement.discount > 0 && (
                  <div className="flex justify-between font-semibold" style={{ color: primaryColor }}>
                    <span>Stars Discount</span>
                    <span className="tabular-nums">-{formatCurrency(settlement.discount)}</span>
                  </div>
                )}
                {settlement.serviceChargeAmount && settlement.serviceChargeAmount > 0 ? (
                  <div className="flex justify-between">
                    <span>Service Charge</span>
                    <span className="font-medium tabular-nums">{formatCurrency(settlement.serviceChargeAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>GST</span>
                  <span className="font-medium tabular-nums">{formatCurrency(settlement.taxAmount)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-zinc-200 text-[13px] font-black text-zinc-900">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{formatCurrency(settlement.grandTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintOrSave}
              className="flex-1 py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-black active:bg-zinc-800 text-white font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
            >
              <Download size={15} />
              <span>Save Invoice</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-700 font-bold text-[13px] transition-all cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>

        {/* REFRESH NOTE */}
        <p className="text-[11.5px] text-zinc-400 text-center px-4 leading-normal">
          Need a physical paper receipt? Just ask your floor captain for a printed copy. Have a wonderful day!
        </p>
      </main>
    </div>
  );
}
