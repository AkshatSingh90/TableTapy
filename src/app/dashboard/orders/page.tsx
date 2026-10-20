"use client";

import React, { useState, useEffect } from "react";
import {
  Search, Clock, CheckCircle2, ChefHat, Printer,
  RotateCcw, Volume2, VolumeX, Loader2, Receipt,
  ShoppingBag, X, IndianRupee, Trash2, Percent, Tag, UserCheck, AlertTriangle, Edit3,
  Minus, Plus, GlassWater, Smartphone, AlertOctagon, Octagon, Flame, ShieldAlert
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  playNewOrderChime,
  playFoodReadyBell,
  playUpiNotificationChime,
  playKitchenHoldUrgentAlert
} from "@/utils/audioAlerts";
import { groupOrdersIntoSessions, extractSessionId, extractUserNote } from "@/utils/orderSession";

interface OrderItem {
  item: { id: string; name: string; basePrice?: number; category?: string; isVeg?: boolean; notes?: string };
  price: number;
  quantity?: number;
  notes?: string;
}

interface Order {
  id: string;
  restaurant_id: string;
  table_no: string;
  total: number;
  status: 'NEW' | 'PREPARING' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  note?: string;
  items_json: OrderItem[];
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  payment_method?: string;
  payment_status?: string;
}

interface TableSession {
  table_no: string;
  customer_name?: string;
  customer_phone?: string;
  first_order_at: string;
  latest_order_at: string;
  rounds: Order[];
  totalBill: number;
  hasNewRound: boolean;
  hasCookingRound: boolean;
  allServed: boolean;
  isCashRequested: boolean;
  isUpiVerificationPending: boolean;
  earliestNewOrderAt?: string;
  isPaid: boolean;
  sessionStatus: 'ACTIVE' | 'SETTLED';
}

/* ─── KOT Modal ─────────────────────────────────────────── */
function KotModal({
  round, roundIndex, session, onConfirm, onClose, loading, onUpdateQuantity, onUpdateItemNote
}: {
  round: Order;
  roundIndex: number;
  session: TableSession;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  onUpdateQuantity: (roundId: string, itemName: string, delta: number) => Promise<void>;
  onUpdateItemNote?: (roundId: string, itemName: string, note: string) => Promise<void>;
}) {
  const grouped = getGroupedItems(round.items_json);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [itemToRemove, setItemToRemove] = useState<{ itemName: string; currentCount: number; delta: number } | null>(null);

  const handleStepInKot = async (itemName: string, currentCount: number, delta: number) => {
    if (delta < 0 && currentCount <= 1) {
      setItemToRemove({ itemName, currentCount, delta });
      return;
    }
    setActionLoading(`${itemName}_${delta}`);
    try {
      await onUpdateQuantity(round.id, itemName, delta);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-zinc-200 overflow-hidden">
        {/* Header - clean text without circular icons */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-1.5">
              <ChefHat size={16} className="text-[#E46254]" />
              <h3 className="text-[15px] font-bold text-zinc-900 tracking-tight">KOT · Round {roundIndex + 1}</h3>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {session.table_no} · Review or adjust items before dispatch
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Items with Stepper & Cooking Notes */}
        <div className="px-5 py-3 space-y-2.5 max-h-80 overflow-y-auto">
          {grouped.length === 0 ? (
            <p className="text-[12px] text-zinc-400 text-center py-4">No items left in this round.</p>
          ) : (
            grouped.map((entry, i) => {
              const itemName = entry.item?.name || 'Item';
              const isDec = actionLoading === `${itemName}_-1`;
              const isInc = actionLoading === `${itemName}_1`;

              return (
                <div key={i} className="py-2 border-b border-zinc-100 last:border-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold text-zinc-800 block truncate">
                          {itemName}
                        </span>
                        {entry.notes && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            ⚡ {entry.notes}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 tabular-nums">
                        ₹{((entry.price || 0) * entry.count).toFixed(0)}
                      </span>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        disabled={isDec}
                        onClick={() => handleStepInKot(itemName, entry.count, -1)}
                        className="w-6 h-6 rounded-md border border-zinc-200 hover:border-red-300 text-zinc-600 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                        title={entry.count > 1 ? "Reduce by 1" : "Remove item"}
                      >
                        {isDec ? (
                          <Loader2 size={10} className="animate-spin text-red-500" />
                        ) : entry.count === 1 ? (
                          <Trash2 size={10} className="text-red-500" />
                        ) : (
                          <Minus size={10} strokeWidth={2.5} />
                        )}
                      </button>

                      <span className="w-5 text-center text-[12px] font-bold text-zinc-900 tabular-nums">
                        {entry.count}
                      </span>

                      <button
                        disabled={isInc}
                        onClick={() => handleStepInKot(itemName, entry.count, 1)}
                        className="w-6 h-6 rounded-md border border-zinc-200 hover:border-emerald-300 text-zinc-600 hover:text-emerald-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                        title="Add 1 more"
                      >
                        {isInc ? (
                          <Loader2 size={10} className="animate-spin text-emerald-600" />
                        ) : (
                          <Plus size={10} strokeWidth={2.5} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Quick Cooking Modifier / Note Bar in KOT modal */}
                  {onUpdateItemNote && (
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {["No Onion", "Extra Spicy", "Less Spicy", "Less Ice", "Sugar-Free"].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const next = entry.notes === tag ? "" : tag;
                            onUpdateItemNote(round.id, itemName, next);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                            entry.notes === tag
                              ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                              : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600'
                          }`}
                        >
                          {entry.notes === tag ? `✓ ${tag}` : `+ ${tag}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {(() => {
            const cleanNote = extractUserNote(round.note);
            if (!cleanNote) return null;
            return (
              <p className="text-[11px] text-[#E46254] italic pt-1">
                Note: {cleanNote}
              </p>
            );
          })()}
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 pt-2 border-t border-zinc-100 flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={13} /> Print
          </button>
          <button
            disabled={loading || grouped.length === 0}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#E46254] hover:bg-[#d04e41] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <ChefHat size={13} />}
            <span>Send to Kitchen</span>
          </button>
        </div>

        {/* In-Modal Item Removal Confirmation */}
        {itemToRemove && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-20 p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2.5">
                <Trash2 size={20} />
              </div>
              <h4 className="text-[15px] font-bold text-zinc-900 tracking-tight">Remove Item?</h4>
              <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
                Remove <strong>&ldquo;{itemToRemove.itemName}&rdquo;</strong> before sending Round {roundIndex + 1} to the kitchen?
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setItemToRemove(null)}
                  className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-xl text-[12px] transition-colors cursor-pointer"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { itemName, delta } = itemToRemove;
                    setItemToRemove(null);
                    setActionLoading(`${itemName}_${delta}`);
                    try {
                      await onUpdateQuantity(round.id, itemName, delta);
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-[12px] transition-colors cursor-pointer shadow-xs"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Bill Modal ─────────────────────────────────────────── */
interface CustomerVisitStats {
  visitCount: number;
  totalSpent: number;
}

/* ─── Bill Modal ─────────────────────────────────────────── */
function BillModal({
  session, restaurantName, onSettle, onClose, settling, onUpdateQuantity, onAddWater, customerStats, modalMode = 'view', onFireKot, menuCatalog = [], onAddMenuItem, onUpdateItemNote
}: {
  session: TableSession;
  restaurantName: string;
  onSettle?: (finalDiscountAmount: number) => void;
  onClose: () => void;
  settling: boolean;
  onUpdateQuantity: (roundId: string, itemName: string, delta: number) => Promise<void>;
  onAddWater: (session: TableSession, bottle: { name: string; price: number }) => Promise<void>;
  customerStats?: CustomerVisitStats;
  modalMode?: 'view' | 'edit';
  onFireKot?: (round: Order, roundIndex: number) => void;
  menuCatalog?: any[];
  onAddMenuItem?: (session: TableSession, item: any) => Promise<void>;
  onUpdateItemNote?: (roundId: string, itemName: string, note: string) => Promise<void>;
}) {
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customDiscountRupees, setCustomDiscountRupees] = useState<string>("");
  const [itemActionLoading, setItemActionLoading] = useState<string | null>(null);
  const [waterLoading, setWaterLoading] = useState<string | null>(null);
  const [dishSearchQuery, setDishSearchQuery] = useState("");
  const [addingDishId, setAddingDishId] = useState<string | null>(null);

  // In-app modals replacing all window.confirm and alert dialogs
  const [itemCancelConfirm, setItemCancelConfirm] = useState<{
    round: Order;
    roundIndex: number;
    itemName: string;
    currentCount: number;
    delta: number;
    isFired: boolean;
  } | null>(null);
  const [showUnfiredAlert, setShowUnfiredAlert] = useState(false);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);

  const filteredMenuItems = React.useMemo(() => {
    if (!dishSearchQuery.trim()) return [];
    const q = dishSearchQuery.toLowerCase().trim();
    return (menuCatalog || []).filter(m => 
      m.name?.toLowerCase().includes(q) || 
      m.category?.toLowerCase().includes(q)
    );
  }, [menuCatalog, dishSearchQuery]);

  const handleAddDish = async (menuItem: any) => {
    if (!onAddMenuItem) return;
    setAddingDishId(menuItem.id);
    try {
      await onAddMenuItem(session, menuItem);
      setDishSearchQuery("");
    } finally {
      setAddingDishId(null);
    }
  };

  const allThermalItems = React.useMemo(() => {
    const map = new Map<string, { name: string; count: number; price: number }>();
    session.rounds.forEach(r => {
      const grouped = getGroupedItems(r.items_json);
      grouped.forEach(g => {
        const dName = g.item?.name || 'Dish';
        const existing = map.get(dName);
        if (existing) {
          existing.count += g.count;
        } else {
          map.set(dName, {
            name: dName,
            count: g.count,
            price: g.price || 0
          });
        }
      });
    });
    return Array.from(map.values());
  }, [session.rounds]);

  // Check if any rounds have not yet been sent to kitchen
  const unfiredRounds = session.rounds.filter(r => r.status === 'NEW');
  const hasUnfiredRounds = unfiredRounds.length > 0;

  // Calculate live subtotal based on current session rounds
  const subtotal = session.rounds.reduce((sum, r) => {
    const grouped = getGroupedItems(r.items_json);
    return sum + grouped.reduce((s, e) => s + (e.price || 0) * e.count, 0);
  }, 0);

  // Compute discount
  let computedDiscount = 0;
  if (customDiscountRupees.trim() !== "") {
    computedDiscount = Math.min(subtotal, Math.max(0, Number(customDiscountRupees) || 0));
  } else if (discountPercent > 0) {
    computedDiscount = Math.round((subtotal * discountPercent) / 100);
  }

  const discountedSubtotal = Math.max(0, subtotal - computedDiscount);
  const gst = Number((discountedSubtotal * 0.05).toFixed(2));
  const finalGrandTotal = Math.max(0, Math.round(discountedSubtotal + gst));

  const handleApplyQuickDiscount = (pct: number) => {
    setCustomDiscountRupees("");
    setDiscountPercent(prev => prev === pct ? 0 : pct);
  };

  const handleStepQuantity = async (round: Order, itemName: string, currentCount: number, delta: number) => {
    const isFired = round.status === 'PREPARING' || round.status === 'SERVED';
    
    // If reducing quantity or cancelling, show custom in-app warning popup
    if (delta < 0) {
      const rIndex = session.rounds.indexOf(round);
      setItemCancelConfirm({
        round,
        roundIndex: rIndex >= 0 ? rIndex : 0,
        itemName,
        currentCount,
        delta,
        isFired
      });
      return;
    }

    // Direct increment
    setItemActionLoading(`${round.id}_${itemName}_${delta}`);
    try {
      await onUpdateQuantity(round.id, itemName, delta);
    } finally {
      setItemActionLoading(null);
    }
  };

  const handleExecuteCancelItem = async () => {
    if (!itemCancelConfirm) return;
    const { round, itemName, delta } = itemCancelConfirm;
    setItemActionLoading(`${round.id}_${itemName}_${delta}`);
    setItemCancelConfirm(null);
    try {
      await onUpdateQuantity(round.id, itemName, delta);
    } finally {
      setItemActionLoading(null);
    }
  };

  const handleQuickAddWater = async (bottle: { name: string; price: number }) => {
    setWaterLoading(bottle.name);
    try {
      await onAddWater(session, bottle);
    } finally {
      setWaterLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200/90 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-100 shrink-0 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {modalMode === 'edit' ? (
                  <Edit3 size={17} className="text-[#E46254]" />
                ) : (
                  <Receipt size={17} className="text-[#E46254]" />
                )}
                <h3 className="text-[17px] font-bold text-zinc-900 tracking-tight">
                  {modalMode === 'edit' ? `Edit Table ${session.table_no} Orders` : `Table ${session.table_no} Bill`}
                </h3>
              </div>

              {/* Customer Info & Factual Visit Count */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[12px] font-semibold text-zinc-800">
                  {session.customer_name || 'Dine-in Guest'}
                </span>
                {customerStats && customerStats.visitCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-zinc-50 text-zinc-600 text-[11px] font-medium border border-zinc-200">
                    <span>{customerStats.visitCount} visits</span>
                    {customerStats.totalSpent > 0 && (
                      <span className="text-zinc-400 font-normal">· ₹{customerStats.totalSpent.toFixed(0)} total spend</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Bill body with step quantity adjustment & rounds */}
        <div className="px-5 py-4 overflow-y-auto slim-scrollbar flex-1 space-y-4">
          
          {/* Warning banner if unfired rounds exist */}
          {hasUnfiredRounds && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-2.5 text-[12px] text-amber-900">
              <ChefHat size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Unsent orders detected: </span>
                {unfiredRounds.length} round{unfiredRounds.length > 1 ? 's are' : ' is'} still marked "New" and not sent to kitchen yet. Send orders to kitchen before settling the bill.
              </div>
            </div>
          )}
          
          {/* Quick Add Section for Edit Mode */}
          {!session.isPaid && modalMode === 'edit' && (
            <div className="space-y-3">
              {/* Search & Add Menu Dish */}
              <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-zinc-900 text-[12px] font-bold">
                    <Search size={14} className="text-[#E46254]" />
                    <span>Add Dish to Table</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">Quick POS Add</span>
                </div>

                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search menu (e.g. Burger, Fries, Coffee)..."
                    value={dishSearchQuery}
                    onChange={e => setDishSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 text-[12px] bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 font-medium"
                  />
                  {dishSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDishSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {dishSearchQuery.trim() !== '' && (
                  <div className="max-h-48 overflow-y-auto slim-scrollbar divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-xs">
                    {filteredMenuItems.length === 0 ? (
                      <p className="p-3 text-center text-[11.5px] text-zinc-400">No dishes found matching "{dishSearchQuery}"</p>
                    ) : (
                      filteredMenuItems.slice(0, 8).map(mItem => (
                        <div key={mItem.id} className="p-2 flex items-center justify-between gap-2 hover:bg-zinc-50 transition-colors">
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${mItem.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-[12px] font-semibold text-zinc-800 truncate">{mItem.name}</span>
                            <span className="text-[10px] text-zinc-400 truncate">({mItem.category})</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[12px] font-bold text-zinc-900 tabular-nums">₹{mItem.base_price}</span>
                            <button
                              type="button"
                              disabled={addingDishId === mItem.id}
                              onClick={() => handleAddDish(mItem)}
                              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-black text-white text-[11px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50 flex items-center gap-1"
                            >
                              {addingDishId === mItem.id ? <Loader2 size={10} className="animate-spin" /> : <Plus size={11} strokeWidth={2.5} />}
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Quick Water Bottles Section */}
              <div className="p-3.5 rounded-2xl bg-white border border-sky-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sky-950 text-[12px] font-bold">
                    <GlassWater size={14} className="text-sky-600" />
                    <span>Add Water to Table</span>
                  </div>
                  <span className="text-[10px] text-sky-600 font-semibold tracking-wider">Instant Add</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  {[
                    { name: "Packaged Water (1L)", price: 20 },
                    { name: "Packaged Water (500ml)", price: 10 }
                  ].map(bottle => (
                    <button
                      key={bottle.name}
                      type="button"
                      disabled={waterLoading === bottle.name}
                      onClick={() => handleQuickAddWater(bottle)}
                      className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-sky-50 border border-sky-200 text-sky-950 text-[11.5px] font-bold flex items-center justify-between transition-all cursor-pointer disabled:opacity-50 shadow-2xs active:scale-95"
                    >
                      <span className="truncate pr-1">+ {bottle.name.replace('Packaged Water ', '')}</span>
                      <span className="text-sky-700 font-extrabold tabular-nums">₹{bottle.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Rounds list with +/- Quantity Steppers */}
          {session.rounds.map((round, rIdx) => {
            const grouped = getGroupedItems(round.items_json);
            const roundTotal = grouped.reduce((s, e) => s + (e.price || 0) * e.count, 0);

            return (
              <div key={round.id} className="p-3.5 rounded-2xl bg-white border border-zinc-200">
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-bold text-zinc-700 uppercase tracking-wide">
                      Round {rIdx + 1}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                      round.status === 'PREPARING'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : round.status === 'SERVED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {round.status === 'PREPARING' ? 'Cooking' : round.status === 'SERVED' ? 'Plated' : 'Not Sent to Kitchen'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {round.status === 'NEW' && onFireKot && (
                      <button
                        onClick={() => {
                          onClose();
                          onFireKot(round, rIdx);
                        }}
                        className="text-[11px] font-bold text-[#E46254] hover:bg-[#E46254]/10 px-2 py-0.5 rounded-lg border border-[#E46254]/25 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <ChefHat size={12} /> Send KOT
                      </button>
                    )}
                    <span className="text-[12.5px] font-bold text-zinc-800 tabular-nums">
                      ₹{roundTotal.toFixed(0)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {grouped.map((entry, i) => {
                    const itemName = entry.item?.name || 'Dish Item';
                    const isDecLoading = itemActionLoading === `${round.id}_${itemName}_-1`;
                    const isIncLoading = itemActionLoading === `${round.id}_${itemName}_1`;

                    return (
                      <div key={i} className="py-2 px-2.5 rounded-xl border border-zinc-100 hover:border-zinc-200 bg-white transition-colors space-y-1.5">
                        <div className="flex items-center justify-between text-[13px]">
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-zinc-800 font-semibold truncate text-[12.5px]">
                                {itemName}
                              </h4>
                              {entry.notes && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                  ⚡ {entry.notes}
                                </span>
                              )}
                            </div>
                            <span className="text-zinc-400 text-[11px] tabular-nums font-medium">
                              ₹{(entry.price || 0).toFixed(0)} each
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Unit Total */}
                            <span className="text-zinc-800 font-bold tabular-nums text-[13px] min-w-[45px] text-right">
                              ₹{((entry.price || 0) * entry.count).toFixed(0)}
                            </span>

                            {/* Stepper (- / count / +) */}
                            {!session.isPaid ? (
                              <div className="flex items-center gap-1.5 bg-zinc-50 p-1 rounded-xl border border-zinc-200">
                                <button
                                  disabled={isDecLoading}
                                  onClick={() => handleStepQuantity(round, itemName, entry.count, -1)}
                                  title={entry.count > 1 ? "Reduce quantity by 1" : "Cancel and remove from bill"}
                                  className="w-6 h-6 rounded-lg bg-white hover:bg-red-50 text-zinc-600 hover:text-red-600 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isDecLoading ? (
                                     <Loader2 size={11} className="animate-spin text-red-500" />
                                  ) : entry.count === 1 ? (
                                     <Trash2 size={11} className="text-red-500" />
                                  ) : (
                                     <Minus size={11} strokeWidth={2.5} />
                                  )}
                                </button>

                                <span className="text-[12px] font-bold text-zinc-900 w-5 text-center tabular-nums">
                                  {entry.count}
                                </span>

                                <button
                                  disabled={isIncLoading}
                                  onClick={() => handleStepQuantity(round, itemName, entry.count, 1)}
                                  title="Add 1 more to order"
                                  className="w-6 h-6 rounded-lg bg-white hover:bg-emerald-50 text-zinc-600 hover:text-emerald-700 border border-zinc-200 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isIncLoading ? (
                                     <Loader2 size={11} className="animate-spin text-emerald-600" />
                                  ) : (
                                     <Plus size={11} strokeWidth={2.5} />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[12px] font-bold text-zinc-600 bg-zinc-50 px-2 py-0.5 rounded-md border border-zinc-200 tabular-nums">
                                {entry.count}×
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Cooking Modifier / Note Bar in Edit Mode */}
                        {modalMode === 'edit' && !session.isPaid && onUpdateItemNote && (
                          <div className="flex items-center gap-1 flex-wrap pt-0.5 border-t border-zinc-50">
                            {["No Onion", "Extra Spicy", "Less Spicy", "Less Ice", "Sugar-Free"].map(tag => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const next = entry.notes === tag ? "" : tag;
                                  onUpdateItemNote(round.id, itemName, next);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                                  entry.notes === tag
                                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                                    : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600'
                                }`}
                              >
                                {entry.notes === tag ? `✓ ${tag}` : `+ ${tag}`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Quick Discretionary Discount Controls (Only in View Bill mode) */}
          {!session.isPaid && modalMode === 'view' && (
            <div className="p-3.5 rounded-2xl bg-white border border-amber-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-amber-950 flex items-center gap-1.5">
                  <Tag size={12} className="text-amber-600" />
                  Discretionary Customer Discount
                </span>
                {computedDiscount > 0 && (
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    -₹{computedDiscount.toFixed(0)} Off
                  </span>
                )}
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[5, 10, 15, 20].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleApplyQuickDiscount(pct)}
                    className={`py-1.5 rounded-xl text-[11.5px] font-bold transition-all cursor-pointer border ${
                      discountPercent === pct && customDiscountRupees === ""
                        ? 'bg-[#E46254] text-white border-[#E46254] shadow-xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Custom Rupee input */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px] font-bold">₹</span>
                  <input
                    type="number"
                    placeholder="Custom Flat Discount (₹)"
                    value={customDiscountRupees}
                    onChange={e => {
                      setCustomDiscountRupees(e.target.value);
                      setDiscountPercent(0);
                    }}
                    className="w-full pl-6 pr-3 py-1.5 text-[12px] bg-white border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 font-medium"
                  />
                </div>
                {computedDiscount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setDiscountPercent(0); setCustomDiscountRupees(""); }}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 bg-white border border-zinc-200 rounded-xl cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {modalMode === 'edit' ? (
          /* ── When Owner is in Edit Mode: Pure Done button to close without ANY settlement action! ── */
          <div className="px-5 pb-5 pt-3.5 border-t border-zinc-100 shrink-0 bg-white">
            <div className="flex items-center justify-between mb-3 text-[13px]">
              <span className="font-semibold text-zinc-500">Order Subtotal</span>
              <span className="text-[20px] font-black text-zinc-900 tabular-nums">
                ₹{subtotal.toFixed(0)}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl text-[13.5px] font-bold flex items-center justify-center gap-2 bg-zinc-900 hover:bg-black text-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <CheckCircle2 size={16} strokeWidth={2.5} />
              <span>Done</span>
            </button>
          </div>
        ) : (
          /* ── When Owner clicks "View Bill / Collect Cash" ── */
          <div className="px-5 pb-5 pt-3.5 border-t border-zinc-100 shrink-0 bg-white">
            <div className="space-y-1 mb-3 text-[12px] text-zinc-500">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums text-zinc-700 font-medium">₹{subtotal.toFixed(0)}</span>
              </div>

              {computedDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span className="tabular-nums">-₹{computedDiscount.toFixed(0)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Taxes & GST (5%)</span>
                <span className="tabular-nums text-zinc-700 font-medium">₹{gst.toFixed(0)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 pt-2 border-t border-zinc-100">
              <span className="text-[13px] font-bold text-zinc-700">Grand Total</span>
              <span className="text-[23px] font-black text-zinc-950 tabular-nums">
                ₹{finalGrandTotal.toFixed(0)}
              </span>
            </div>

            {session.isPaid ? (
              <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 rounded-2xl text-emerald-700 text-[13px] font-bold border border-emerald-200/60">
                <CheckCircle2 size={15} /> Settled & Paid
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {hasUnfiredRounds && (
                  <div className="py-2.5 px-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11.5px] font-semibold flex items-center justify-center text-center">
                    <span>Send Round {session.rounds.findIndex(r => r.status === 'NEW') + 1} to kitchen before settling</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2.5 rounded-2xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-[12.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer size={14} /> Print
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 bg-zinc-900 hover:bg-black text-white transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <CheckCircle2 size={15} strokeWidth={2.5} />
                    <span>Done</span>
                  </button>

                  {!session.isPaid && onSettle && (
                    <button
                      type="button"
                      disabled={settling || hasUnfiredRounds}
                      onClick={() => {
                        if (hasUnfiredRounds) {
                          setShowUnfiredAlert(true);
                          return;
                        }
                        setShowSettleConfirm(true);
                      }}
                      className={`px-4 py-3 rounded-2xl text-[12.5px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 ${
                        session.isUpiVerificationPending
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : session.isCashRequested
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-[#E46254] hover:bg-[#d04e41] text-white'
                      }`}
                    >
                      {settling ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                      <span>
                        {session.isUpiVerificationPending
                          ? `Settle UPI (₹${finalGrandTotal.toFixed(0)})`
                          : session.isCashRequested
                          ? `Settle Cash (₹${finalGrandTotal.toFixed(0)})`
                          : `Settle (₹${finalGrandTotal.toFixed(0)})`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 58mm / 80mm ESC/POS Compact Thermal Receipt Layout (Invisible on screen, visible exclusively on print) */}
        <div id="thermal-receipt" className="hidden print:block text-black bg-white">
          <div className="text-center pb-2 border-b border-dashed border-black">
            <h2 className="text-[15px] font-bold tracking-tight uppercase">{restaurantName || 'RESTAURANT'}</h2>
            <p className="text-[10px] uppercase">Dine-In Guest Receipt</p>
            <p className="text-[9.5px] mt-0.5">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-[12px] font-black mt-1">TABLE: {session.table_no}</p>
            {session.customer_name && <p className="text-[10px]">Guest: {session.customer_name}</p>}
          </div>

          <div className="py-2 border-b border-dashed border-black text-[11px]">
            <div className="flex justify-between font-bold pb-1 text-[10px] uppercase">
              <span>Item</span>
              <span className="text-right">Qty &nbsp; Amt</span>
            </div>
            {allThermalItems.map((item, idx) => (
              <div key={idx} className="flex justify-between py-0.5">
                <span className="truncate pr-2">{item.name}</span>
                <span className="text-right shrink-0 tabular-nums">
                  {item.count} &times; ₹{item.price} &nbsp; ₹{(item.count * item.price).toFixed(0)}
                </span>
              </div>
            ))}
          </div>

          <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="tabular-nums">₹{subtotal.toFixed(0)}</span>
            </div>
            {computedDiscount > 0 && (
              <div className="flex justify-between font-bold">
                <span>Discount:</span>
                <span className="tabular-nums">-₹{computedDiscount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Taxes & GST (5%):</span>
              <span className="tabular-nums">₹{gst.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-[13px] font-black pt-1 border-t border-dotted border-black">
              <span>TOTAL DUE:</span>
              <span className="tabular-nums">₹{finalGrandTotal.toFixed(0)}</span>
            </div>
          </div>

          <div className="text-center pt-2 text-[10px]">
            <p className="font-bold">STATUS: {session.isPaid ? 'PAID / SETTLED' : 'DUE / PENDING'}</p>
            <p className="mt-1">Thank you for dining with us!</p>
            <p className="text-[9px] text-zinc-500">Powered by Tabletapy POS</p>
          </div>

          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #thermal-receipt, #thermal-receipt * {
                visibility: visible !important;
              }
              #thermal-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 76mm !important;
                padding: 4mm !important;
                margin: 0 !important;
                background: white !important;
                color: black !important;
                font-family: 'Courier New', Courier, monospace !important;
                display: block !important;
              }
            }
          `}</style>
        </div>

        {/* ── MODAL 1: Item Cancellation / Reduction Warning (Kitchen Sync) ── */}
        {itemCancelConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner ${
                itemCancelConfirm.isFired ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-zinc-100 text-zinc-700'
              }`}>
                {itemCancelConfirm.isFired ? <Flame size={24} /> : <Trash2 size={22} />}
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mb-2 uppercase tracking-wider"
                style={{
                  backgroundColor: itemCancelConfirm.isFired ? '#FEE2E2' : '#F4F4F5',
                  color: itemCancelConfirm.isFired ? '#DC2626' : '#52525B'
                }}
              >
                {itemCancelConfirm.isFired ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                    <span>Kitchen Active ({itemCancelConfirm.round.status})</span>
                  </>
                ) : (
                  <span>Round {itemCancelConfirm.roundIndex + 1} (Unfired)</span>
                )}
              </div>

              <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">
                {itemCancelConfirm.isFired ? "Halt Kitchen & Cancel Dish?" : "Remove Item from Order?"}
              </h4>

              <p className="text-[14px] font-bold text-zinc-800 mt-2">
                {itemCancelConfirm.currentCount <= 1
                  ? `Cancel 1× "${itemCancelConfirm.itemName}"`
                  : `Reduce "${itemCancelConfirm.itemName}" (${itemCancelConfirm.currentCount} → ${itemCancelConfirm.currentCount - 1})`}
              </p>

              {itemCancelConfirm.isFired ? (
                <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200/90 text-[12px] text-rose-900 text-left leading-relaxed">
                  <p className="font-bold flex items-center gap-1.5 text-rose-950 mb-1">
                    <AlertOctagon size={14} className="shrink-0 text-rose-600" />
                    KDS Alert & Siren will be fired
                  </p>
                  Confirming notifies the kitchen KDS screen immediately and sounds the urgent hold siren to stop cooking and prevent food waste.
                </div>
              ) : (
                <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
                  This dish has not been sent to the kitchen yet. It will be removed cleanly from Table {session.table_no}.
                </p>
              )}

              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setItemCancelConfirm(null)}
                  className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
                >
                  Keep Item
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCancelItem}
                  className={`flex-1 py-3 font-bold rounded-2xl text-[12.5px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 text-white ${
                    itemCancelConfirm.isFired
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                      : 'bg-zinc-900 hover:bg-black'
                  }`}
                >
                  {itemCancelConfirm.isFired ? (
                    <>
                      <Octagon size={14} />
                      <span>Halt & Cancel</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 2: Unfired Rounds Warning ── */}
        {showUnfiredAlert && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-amber-200 text-center animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <AlertTriangle size={24} />
              </div>
              <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">Send Rounds to Kitchen First</h4>
              <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
                Cannot settle <strong>Table {session.table_no}</strong> because Round {session.rounds.findIndex(r => r.status === 'NEW') + 1} has not been dispatched to the kitchen yet.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                {onFireKot && unfiredRounds[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnfiredAlert(false);
                      const unfiredIdx = session.rounds.findIndex(r => r.status === 'NEW');
                      onFireKot(unfiredRounds[0], unfiredIdx >= 0 ? unfiredIdx : 0);
                    }}
                    className="w-full py-3 bg-[#E46254] hover:bg-[#d04e41] text-white font-bold rounded-2xl text-[13px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                  >
                    <ChefHat size={16} />
                    <span>Send KOT to Kitchen First</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowUnfiredAlert(false)}
                  className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
                >
                  Got it / Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 3: Settle Table Confirmation ── */}
        {showSettleConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Receipt size={24} />
              </div>
              <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">Settle Table {session.table_no}?</h4>
              <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
                Total to collect: <strong className="text-zinc-900 text-[15px]">₹{finalGrandTotal.toFixed(0)}</strong>
                {computedDiscount > 0 && <span className="block text-emerald-600 text-xs font-semibold mt-1">Includes ₹{computedDiscount.toFixed(0)} discount</span>}
              </p>
              <p className="text-[11.5px] text-zinc-400 mt-1">
                This will mark all rounds as paid, record the transaction, and close Table {session.table_no}.
              </p>
              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSettleConfirm(false)}
                  className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
                >
                  Keep Open
                </button>
                <button
                  type="button"
                  disabled={settling}
                  onClick={() => {
                    setShowSettleConfirm(false);
                    onSettle && onSettle(computedDiscount);
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-[12.5px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {settling ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  <span>Confirm & Settle</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────── */
function getGroupedItems(items: OrderItem[]) {
  const map = new Map<string, { item: any; count: number; price: number; notes?: string }>();
  (items || []).forEach(entry => {
    const name = entry?.item?.name || 'Dish Item';
    const existing = map.get(name);
    if (existing) { 
      existing.count += (entry.quantity || 1); 
      if (entry.notes && !existing.notes) existing.notes = entry.notes;
    }
    else { 
      map.set(name, { 
        item: entry.item, 
        count: entry.quantity || 1, 
        price: entry.price || entry.item?.basePrice || 0,
        notes: entry.notes 
      }); 
    }
  });
  return Array.from(map.values());
}

function getTimeAgo(dateStr: string) {
  const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ─── Table Card (Refined Apple Minimalist Design - No Scrollbars) ─── */
function TableCard({
  session,
  actionLoadingId,
  onFireKot,
  onViewBill,
  onEditBill,
  onReopenTable,
}: {
  session: TableSession;
  actionLoadingId: string | null;
  onFireKot: (round: Order, roundIndex: number) => void;
  onViewBill: (session: TableSession) => void;
  onEditBill: (session: TableSession) => void;
  onReopenTable: (session: TableSession) => void;
}) {
  // Select newest round if any is new, otherwise latest round
  const newestRoundIdx = session.rounds.findIndex(r => r.status === 'NEW');
  const [selectedRoundIdx, setSelectedRoundIdx] = useState<number>(
    newestRoundIdx !== -1 ? newestRoundIdx : Math.max(0, session.rounds.length - 1)
  );

  const activeRoundIndex = Math.min(selectedRoundIdx, Math.max(0, session.rounds.length - 1));
  const activeRound = session.rounds[activeRoundIndex] || session.rounds[0];

  const isFiring = (roundId: string) => actionLoadingId === `kot_${roundId}`;

  const newRounds = session.rounds.filter(r => r.status === 'NEW');
  const hasNewItems = newRounds.length > 0;
  const isSelectedRoundNew = activeRound?.status === 'NEW';

  // Calculate wait time for new orders in minutes
  const waitMins = session.earliestNewOrderAt
    ? Math.max(0, Math.floor((Date.now() - new Date(session.earliestNewOrderAt).getTime()) / 60000))
    : 0;

  const activeRoundGrouped = activeRound ? getGroupedItems(activeRound.items_json) : [];

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.05)] ${
        session.isUpiVerificationPending
          ? 'border-emerald-400/80 ring-2 ring-emerald-500/10'
          : session.isCashRequested
          ? 'border-amber-300/80 ring-2 ring-amber-500/10'
          : hasNewItems
          ? 'border-[#E46254]/30 ring-2 ring-[#E46254]/10'
          : 'border-zinc-200/80 hover:border-zinc-300'
      } ${session.sessionStatus === 'SETTLED' ? 'opacity-65 bg-zinc-50/40' : ''}`}
    >
      <div>
        {/* HEADER: Table Name, Guest, & Simple Status Capsule */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-[19px] font-bold text-zinc-900 tracking-tight leading-none">
                {session.table_no}
              </h2>
              {session.customer_name && (
                <span className="text-[13px] text-zinc-500 font-medium truncate max-w-[120px]">
                  · {session.customer_name}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-zinc-400 mt-1 font-medium">
              {new Date(session.latest_order_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              <span className="mx-1.5 text-zinc-300">•</span>
              <span>{session.rounds.length} {session.rounds.length === 1 ? 'order' : 'orders'}</span>
            </p>
          </div>

          {/* Clean Soft Badge */}
          {session.isUpiVerificationPending ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 bg-emerald-50 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              UPI Paid • Verify
            </span>
          ) : session.isCashRequested ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Cash Call
            </span>
          ) : hasNewItems ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 bg-[#E46254]/8 text-[#E46254] border border-[#E46254]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E46254] animate-pulse" />
              {waitMins >= 3 ? `Waiting ${waitMins}m` : 'New Round'}
            </span>
          ) : session.allServed && session.sessionStatus === 'ACTIVE' ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={12} className="text-emerald-600" />
              Plated & Served
            </span>
          ) : session.hasCookingRound && session.sessionStatus === 'ACTIVE' ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 bg-[#E46254]/10 text-[#E46254] border border-[#E46254]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E46254] animate-pulse" />
              Cooking in Kitchen
            </span>
          ) : session.sessionStatus === 'ACTIVE' ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 bg-zinc-100 text-zinc-600 border border-zinc-200">
              Active Session
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 bg-zinc-100 text-zinc-400">
              Settled
            </span>
          )}
        </div>

        {/* CLEAN ROUND PILLS (Wrap naturally without ugly scrollbars) */}
        {session.rounds.length > 1 && (
          <div className="pt-3 pb-1 flex flex-wrap items-center gap-1.5">
            {session.rounds.map((round, rIdx) => {
              const isSelected = activeRoundIndex === rIdx;
              const isRoundNew = round.status === 'NEW';
              const isRoundCooking = round.status === 'PREPARING';
              const isRoundServed = round.status === 'SERVED' || round.status === 'COMPLETED';

              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => setSelectedRoundIdx(rIdx)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? isRoundNew
                        ? 'bg-[#E46254]/12 text-[#E46254] font-semibold border border-[#E46254]/30 shadow-xs'
                        : isRoundCooking
                        ? 'bg-[#E46254]/8 text-[#E46254] font-semibold border border-[#E46254]/25 shadow-xs'
                        : 'bg-zinc-100 text-zinc-900 font-semibold border border-zinc-300 shadow-xs'
                      : isRoundNew
                      ? 'bg-[#E46254]/6 text-[#E46254] border border-[#E46254]/15 hover:bg-[#E46254]/10'
                      : 'bg-zinc-50 text-zinc-500 border border-transparent hover:bg-zinc-100 hover:text-zinc-700'
                  }`}
                >
                  <span>Round {rIdx + 1}</span>
                  {isRoundNew ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E46254] animate-pulse" />
                  ) : isRoundCooking ? (
                    <span className="text-[10px] text-[#E46254] font-bold">Cooking</span>
                  ) : isRoundServed ? (
                    <CheckCircle2 size={12} className={isSelected ? 'text-emerald-600' : 'text-zinc-400'} />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {/* ITEMS LIST (Clean and natural, no scrollbar) */}
        <div className="py-2.5 space-y-1.5">
          {activeRound && (
            <>
              {activeRoundGrouped.slice(0, 4).map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-[13px] py-0.5">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-[11.5px] font-semibold text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded tabular-nums shrink-0">
                      {entry.count}×
                    </span>
                    <span className="text-zinc-800 font-medium truncate">
                      {entry.item?.name || 'Dish'}
                    </span>
                    {entry.notes && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9.5px] font-bold shrink-0">
                        ⚡ {entry.notes}
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-400 tabular-nums text-[12px] shrink-0 font-medium">
                    ₹{((entry.price || 0) * entry.count).toFixed(0)}
                  </span>
                </div>
              ))}

              {activeRoundGrouped.length > 4 && (
                <p className="text-[11px] text-zinc-400 pt-0.5 font-medium">
                  + {activeRoundGrouped.length - 4} more items in this round
                </p>
              )}

              {(() => {
                const cleanNote = extractUserNote(activeRound.note);
                if (!cleanNote) return null;
                return (
                  <p className="text-[11px] text-[#E46254] bg-[#E46254]/5 border-l-2 border-[#E46254]/40 px-2.5 py-1 rounded-r-lg italic mt-1.5 font-medium">
                    Note: {cleanNote}
                  </p>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* FOOTER: Total & Aesthetic Soft Buttons (No harsh black) */}
      <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3 mt-2">
        <div>
          <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider block">
            Total
          </span>
          <span className="text-[20px] font-bold text-zinc-900 tabular-nums leading-none">
            ₹{session.totalBill.toFixed(0)}
          </span>
        </div>

        {session.sessionStatus === 'ACTIVE' ? (
          <div className="flex items-center gap-2">
            {/* Soft Brand KOT Button with Proportionate Icon */}
            {isSelectedRoundNew ? (
              <button
                disabled={isFiring(activeRound.id)}
                onClick={() => onFireKot(activeRound, activeRoundIndex)}
                className="py-2 px-3.5 rounded-xl bg-[#E46254]/10 hover:bg-[#E46254]/15 active:bg-[#E46254]/20 text-[#E46254] border border-[#E46254]/25 text-[12.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isFiring(activeRound.id) ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ChefHat size={15} strokeWidth={2} />
                )}
                <span>Send KOT</span>
              </button>
            ) : hasNewItems ? (
              <button
                onClick={() => {
                  if (newestRoundIdx !== -1) setSelectedRoundIdx(newestRoundIdx);
                }}
                className="py-2 px-3 rounded-xl bg-[#E46254]/8 hover:bg-[#E46254]/12 text-[#E46254] border border-[#E46254]/20 text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#E46254] animate-pulse" />
                <span>Round {newestRoundIdx + 1} Waiting</span>
              </button>
            ) : null}

            {/* Edit Bill Button (Only for Owner) */}
            <button
              onClick={() => onEditBill(session)}
              className="py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-200 text-zinc-700 text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-200"
              title="Edit items, cancel dishes, apply discounts, and manage bill"
            >
              <Edit3 size={13} className="text-zinc-600" />
              <span>Edit Bill</span>
            </button>

            {/* Premium Soft View Bill / Collect Cash Button */}
            <button
              onClick={() => onViewBill(session)}
              className={`py-2 px-3.5 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                session.isUpiVerificationPending
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : session.isCashRequested
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                  : 'bg-zinc-900 hover:bg-black text-white shadow-xs'
              }`}
            >
              <Receipt size={14} className={
                session.isUpiVerificationPending || session.isCashRequested
                  ? "text-white"
                  : "text-zinc-300"
              } />
              <span>
                {session.isUpiVerificationPending
                  ? 'Verify UPI'
                  : session.isCashRequested
                  ? 'Collect Cash'
                  : 'View Bill'}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReopenTable(session)}
              className="py-1.5 px-3 rounded-xl border border-zinc-200/90 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 text-[12px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>Reopen Table</span>
            </button>
            <button
              onClick={() => onViewBill(session)}
              className="py-1.5 px-3 rounded-xl border border-zinc-200/80 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 text-[12px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Receipt size={14} />
              <span>Receipt</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function LiveOrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const ordersRef = React.useRef<Order[]>([]);
  ordersRef.current = orders;

  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'NEW_ROUNDS' | 'SETTLED' | 'ALL'>('ACTIVE');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [menuCatalog, setMenuCatalog] = useState<any[]>([]);
  const [upiAlert, setUpiAlert] = useState<{ tableNo: string; amount: number; orderId?: string } | null>(null);

  // Modals & In-App Popups (replacing browser alerts & confirms)
  const [kotModal, setKotModal] = useState<{ round: Order; roundIndex: number; session: TableSession } | null>(null);
  const [billModal, setBillModal] = useState<{ session: TableSession; mode: 'view' | 'edit' } | null>(null);
  const [unfiredWarningModal, setUnfiredWarningModal] = useState<{ session: TableSession; roundIndex: number; round: Order } | null>(null);
  const [reopenConfirmModal, setReopenConfirmModal] = useState<TableSession | null>(null);
  const [dashboardErrorToast, setDashboardErrorToast] = useState<string | null>(null);
  
  // Expediter notification banner when kitchen bumps a ticket to Ready/Served
  const [readyForPickupNotice, setReadyForPickupNotice] = useState<string | null>(null);

  useEffect(() => {
    let ch: any = null;
    let restIdLocal: string | null = null;

    const init = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      let restId = user?.user_metadata?.restaurant_id;

      if (!restId && user?.id) {
        const { data: r } = await supabase.from('restaurants').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
        if (r?.id) restId = r.id;
      }
      if (!restId) {
        const { data: r } = await supabase.from('orders').select('restaurant_id').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (r?.restaurant_id) restId = r.restaurant_id;
      }

      setRestaurantId(restId || null);
      restIdLocal = restId || null;

      if (restId) {
        const { data: ri } = await supabase.from('restaurants').select('name').eq('id', restId).maybeSingle();
        if (ri?.name) setRestaurantName(ri.name);

        const { data } = await supabase.from('orders').select('*').eq('restaurant_id', restId).order('created_at', { ascending: false }).limit(150);
        if (data) {
          setOrders(data as Order[]);
          ordersRef.current = data as Order[];
        }

        // Fetch menu catalog for quick add in BillModal / POS
        const { data: menuData } = await supabase
          .from('menu_items_v2')
          .select('id, name, base_price, category, is_veg')
          .eq('restaurant_id', restId)
          .eq('is_available', true)
          .order('name');
        if (menuData && menuData.length > 0) {
          setMenuCatalog(menuData);
        } else {
          const { data: legacyMenu } = await supabase
            .from('menu_items')
            .select('id, name, base_price, category, is_veg')
            .eq('restaurant_id', restId)
            .order('name');
          if (legacyMenu) setMenuCatalog(legacyMenu);
        }

        ch = supabase.channel(`orders_${restId}_${Date.now()}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restId}` }, p => {
            const o = p.new as Order;
            if (o.restaurant_id === restId) {
              setOrders(prev => {
                const next = [o, ...prev.filter(x => x.id !== o.id)];
                ordersRef.current = next;
                return next;
              });
              playNewOrderChime(soundEnabled);
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restId}` }, p => {
            const o = p.new as Order;
            if (o.restaurant_id === restId) {
              const prevOrder = ordersRef.current.find(x => x.id === o.id);

              // UPI Payment Verification alert
              if (prevOrder && prevOrder.payment_status !== 'UPI_VERIFICATION_PENDING' && o.payment_status === 'UPI_VERIFICATION_PENDING') {
                setUpiAlert({ tableNo: o.table_no, amount: Number(o.total) || 0, orderId: o.id });
                playUpiNotificationChime(soundEnabled);
              }

              // When kitchen marks food ready/served or plates dishes, notify staff!
              if (prevOrder && prevOrder.status !== 'SERVED' && o.status === 'SERVED') {
                setReadyForPickupNotice(`Table ${o.table_no} Plated & Ready for Server Pickup!`);
                playFoodReadyBell(soundEnabled);
                setTimeout(() => setReadyForPickupNotice(null), 6000);
              } else if (prevOrder && (prevOrder.items_json?.length || 0) > (o.items_json?.length || 0)) {
                // Partial dish(es) marked ready for pickup
                setReadyForPickupNotice(`Table ${o.table_no}: Dishes Plated & Ready for Pickup!`);
                playFoodReadyBell(soundEnabled);
                setTimeout(() => setReadyForPickupNotice(null), 6000);
              }

              setOrders(prev => {
                const next = prev.map(x => x.id === o.id ? o : x);
                ordersRef.current = next;
                return next;
              });
            }
          })
          .subscribe();

        // Auto-reconnect / sync when screen wakes up from sleep or tab regains focus
        const syncOwnerOrders = async () => {
          if (!restIdLocal) return;
          const { data } = await supabase.from('orders').select('*').eq('restaurant_id', restIdLocal).order('created_at', { ascending: false }).limit(150);
          if (data) {
            setOrders(data as Order[]);
            ordersRef.current = data as Order[];
          }
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            syncOwnerOrders();
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);
        window.addEventListener('online', syncOwnerOrders);
      }
      setLoading(false);
    };

    init();

    return () => { 
      if (ch) supabase.removeChannel(ch); 
    };
  }, [soundEnabled]);

  const handleRefresh = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(150);
    if (data) setOrders(data as Order[]);
    setLoading(false);
  };

  // Send a specific round's KOT to kitchen
  const handleSendKot = async (round: Order) => {
    setActionLoadingId(`kot_${round.id}`);
    const { error } = await supabase.from('orders').update({ status: 'PREPARING' }).eq('id', round.id);
    if (error) {
      setDashboardErrorToast("Error sending KOT: " + error.message);
      setTimeout(() => setDashboardErrorToast(null), 5000);
    } else {
      setOrders(prev => prev.map(o => o.id === round.id ? { ...o, status: 'PREPARING' } : o));
    }
    setActionLoadingId(null);
    setKotModal(null);
  };

  // Adjust quantity or remove an item (e.g., reduce 3x to 2x or cancel completely)
  const handleUpdateItemQuantity = async (roundId: string, itemName: string, delta: number) => {
    const targetRound = orders.find(o => o.id === roundId);
    if (!targetRound) return;

    const currentItems = Array.isArray(targetRound.items_json) ? [...targetRound.items_json] : [];
    const itemIdx = currentItems.findIndex(it => (it.item?.name || 'Dish Item') === itemName);
    if (itemIdx === -1) return;

    const existing = currentItems[itemIdx];
    const currentQty = existing.quantity || 1;
    const newQty = currentQty + delta;

    if (newQty <= 0) {
      // Remove completely
      currentItems.splice(itemIdx, 1);
    } else {
      // Decrement or increment count
      currentItems[itemIdx] = {
        ...existing,
        quantity: newQty
      };
    }

    // Compute updated round total
    const updatedRoundTotal = currentItems.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
    const isRoundEmpty = currentItems.length === 0;

    let updatePayload: any = {
      items_json: currentItems,
      total: updatedRoundTotal,
    };
    if (isRoundEmpty) {
      updatePayload.status = 'CANCELLED';
    } else {
      // If table was previously marked paid or completed, editing items puts it in active pending payment
      if (targetRound.payment_status === 'PAID') {
        updatePayload.payment_status = 'PENDING';
      }
      if (targetRound.status === 'COMPLETED') {
        updatePayload.status = 'SERVED';
      }
    }

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', roundId);

    if (error) {
      setDashboardErrorToast("Error updating item: " + error.message);
      setTimeout(() => setDashboardErrorToast(null), 5000);
      return;
    }

    // Update local state
    setOrders(prev => prev.map(o => o.id === roundId ? { ...o, ...updatePayload } : o));

    // Also update billModal's internal round session so modal UI updates immediately
    setBillModal(prev => {
      if (!prev) return null;
      const updatedRounds = prev.session.rounds
        .map(r => r.id === roundId ? { ...r, ...updatePayload } : r)
        .filter(r => r.status !== 'CANCELLED');
      const updatedTotal = updatedRounds.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
      return {
        ...prev,
        session: {
          ...prev.session,
          rounds: updatedRounds,
          totalBill: updatedTotal,
          isPaid: false,
          sessionStatus: 'ACTIVE',
        }
      };
    });

    // If order is cooking or plated, notify kitchen immediately of deductions or additions!
    if (targetRound.status === 'PREPARING' || targetRound.status === 'SERVED') {
      try {
        const kdsChannel = supabase.channel(`kds_stream_${restaurantId}`);
        kdsChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            if (delta < 0) {
              kdsChannel.send({
                type: 'broadcast',
                event: 'item_cancelled',
                payload: {
                  tableName: targetRound.table_no,
                  itemName,
                  quantity: Math.abs(delta),
                  cancelledAt: Date.now()
                }
              });
            } else if (delta > 0) {
              kdsChannel.send({
                type: 'broadcast',
                event: 'item_added',
                payload: {
                  tableName: targetRound.table_no,
                  itemName,
                  quantity: delta,
                  addedAt: Date.now()
                }
              });
            }
            setTimeout(() => supabase.removeChannel(kdsChannel), 1500);
          }
        });
      } catch (kErr) {
        console.warn("KDS broadcast error:", kErr);
      }

      if (delta < 0) {
        setReadyForPickupNotice(`🛑 KITCHEN HOLD: Cancelled ${Math.abs(delta)}× "${itemName}" on Table ${targetRound.table_no}. KDS Hold Alert fired!`);
        playKitchenHoldUrgentAlert(soundEnabled);
      } else {
        setReadyForPickupNotice(`🔔 Added +${delta}× "${itemName}" on Table ${targetRound.table_no}. Kitchen notified.`);
        playNewOrderChime(soundEnabled);
      }
      setTimeout(() => setReadyForPickupNotice(null), 7000);
    }
  };

  // Add water bottle directly to table session from bill modal
  const handleAddWaterToSession = async (session: TableSession, bottleType: { name: string; price: number }) => {
    // Pick the most recent active round or create a new order
    const activeRound = session.rounds.find(r => r.status !== 'CANCELLED');
    if (activeRound) {
      const currentItems = Array.isArray(activeRound.items_json) ? [...activeRound.items_json] : [];
      const waterIdx = currentItems.findIndex(it => (it.item?.name || '').toLowerCase() === bottleType.name.toLowerCase());

      if (waterIdx > -1) {
        currentItems[waterIdx] = {
          ...currentItems[waterIdx],
          quantity: (currentItems[waterIdx].quantity || 1) + 1
        };
      } else {
        currentItems.push({
          item: {
            id: `water_${Date.now()}`,
            name: bottleType.name,
            category: 'Beverages',
            isVeg: true
          },
          price: bottleType.price,
          quantity: 1
        });
      }

      const updatedRoundTotal = currentItems.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
      const updatePayload: any = {
        items_json: currentItems,
        total: updatedRoundTotal,
        payment_status: 'PENDING',
      };
      if (activeRound.status === 'COMPLETED') {
        updatePayload.status = 'SERVED';
      }

      const { error } = await supabase.from('orders').update(updatePayload).eq('id', activeRound.id);
      if (!error) {
        setOrders(prev => prev.map(o => o.id === activeRound.id ? { ...o, ...updatePayload } : o));
        setBillModal(prev => {
          if (!prev) return null;
          const updatedRounds = prev.session.rounds.map(r => r.id === activeRound.id ? { ...r, ...updatePayload } : r);
          const updatedTotal = updatedRounds.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
          return {
            ...prev,
            session: {
              ...prev.session,
              rounds: updatedRounds,
              totalBill: updatedTotal,
              isPaid: false,
              sessionStatus: 'ACTIVE',
            }
          };
        });
        setReadyForPickupNotice(`💧 Added ${bottleType.name} to Table ${session.table_no}!`);
        setTimeout(() => setReadyForPickupNotice(null), 4000);
      }
    } else if (restaurantId) {
      // Create new served round with water bottle
      const itemsPayload = [{
        item: {
          id: `water_${Date.now()}`,
          name: bottleType.name,
          category: 'Beverages',
          isVeg: true
        },
        price: bottleType.price,
        quantity: 1
      }];

      const { data, error } = await supabase.from('orders').insert({
        restaurant_id: restaurantId,
        table_no: session.table_no,
        total: bottleType.price,
        status: 'SERVED',
        items_json: itemsPayload,
        customer_name: session.customer_name || 'Dine-in Guest',
        payment_status: 'PENDING'
      }).select().single();

      if (!error && data) {
        setOrders(prev => [data, ...prev]);
        setBillModal(prev => {
          if (!prev) return null;
          return {
            ...prev,
            session: {
              ...prev.session,
              rounds: [...prev.session.rounds, data],
              totalBill: prev.session.totalBill + bottleType.price
            }
          };
        });
      }
    }
  };

  // Add any menu dish directly to table session from BillModal in 2 taps
  const handleAddMenuItemToSession = async (session: TableSession, menuItem: any) => {
    // If there is an active round with status 'NEW', add item to that round; otherwise active round
    const targetRound = session.rounds.find(r => r.status === 'NEW') || session.rounds.find(r => r.status !== 'CANCELLED');
    
    if (targetRound) {
      const currentItems = Array.isArray(targetRound.items_json) ? [...targetRound.items_json] : [];
      const itemIdx = currentItems.findIndex(it => (it.item?.name || '').toLowerCase() === menuItem.name.toLowerCase());

      if (itemIdx > -1) {
        currentItems[itemIdx] = {
          ...currentItems[itemIdx],
          quantity: (currentItems[itemIdx].quantity || 1) + 1
        };
      } else {
        currentItems.push({
          item: {
            id: menuItem.id,
            name: menuItem.name,
            category: menuItem.category || 'Dishes',
            isVeg: menuItem.is_veg
          },
          price: menuItem.base_price,
          quantity: 1
        });
      }

      const updatedRoundTotal = currentItems.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
      const updatePayload: any = {
        items_json: currentItems,
        total: updatedRoundTotal,
        payment_status: 'PENDING',
      };
      if (targetRound.status === 'COMPLETED') {
        updatePayload.status = 'SERVED';
      }

      const { error } = await supabase.from('orders').update(updatePayload).eq('id', targetRound.id);
      if (!error) {
        setOrders(prev => prev.map(o => o.id === targetRound.id ? { ...o, ...updatePayload } : o));
        setBillModal(prev => {
          if (!prev) return null;
          const updatedRounds = prev.session.rounds.map(r => r.id === targetRound.id ? { ...r, ...updatePayload } : r);
          const updatedTotal = updatedRounds.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
          return {
            ...prev,
            session: {
              ...prev.session,
              rounds: updatedRounds,
              totalBill: updatedTotal,
              isPaid: false,
              sessionStatus: 'ACTIVE',
            }
          };
        });
        setReadyForPickupNotice(`✅ Added 1× "${menuItem.name}" to Table ${session.table_no}!`);
        setTimeout(() => setReadyForPickupNotice(null), 4000);
      }
    } else if (restaurantId) {
      // Create new NEW round with this dish
      const itemsPayload = [{
        item: {
          id: menuItem.id,
          name: menuItem.name,
          category: menuItem.category || 'Dishes',
          isVeg: menuItem.is_veg
        },
        price: menuItem.base_price,
        quantity: 1
      }];

      const { data, error } = await supabase.from('orders').insert({
        restaurant_id: restaurantId,
        table_no: session.table_no,
        total: menuItem.base_price,
        status: 'NEW',
        items_json: itemsPayload,
        customer_name: session.customer_name || 'Dine-in Guest',
        payment_status: 'PENDING'
      }).select().single();

      if (!error && data) {
        setOrders(prev => [data, ...prev]);
        setBillModal(prev => {
          if (!prev) return null;
          return {
            ...prev,
            session: {
              ...prev.session,
              rounds: [...prev.session.rounds, data],
              totalBill: prev.session.totalBill + menuItem.base_price,
              hasNewRound: true,
              isPaid: false,
              sessionStatus: 'ACTIVE',
            }
          };
        });
        setReadyForPickupNotice(`✅ Created new order with 1× "${menuItem.name}" for Table ${session.table_no}!`);
        setTimeout(() => setReadyForPickupNotice(null), 4000);
      }
    }
  };

  // Update item cooking notes / modifiers (e.g., [No Onion], [Extra Spicy])
  const handleUpdateItemNote = async (roundId: string, itemName: string, note: string) => {
    const targetRound = orders.find(o => o.id === roundId);
    if (!targetRound) return;
    const currentItems = Array.isArray(targetRound.items_json) ? [...targetRound.items_json] : [];
    const itemIdx = currentItems.findIndex(it => (it.item?.name || 'Dish Item') === itemName);
    if (itemIdx === -1) return;
    
    currentItems[itemIdx] = {
      ...currentItems[itemIdx],
      notes: note
    };

    const { error } = await supabase.from('orders').update({ items_json: currentItems }).eq('id', roundId);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === roundId ? { ...o, items_json: currentItems } : o));
      setBillModal(prev => {
        if (!prev) return null;
        const updatedRounds = prev.session.rounds.map(r => r.id === roundId ? { ...r, items_json: currentItems } : r);
        return {
          ...prev,
          session: {
            ...prev.session,
            rounds: updatedRounds
          }
        };
      });

      // Broadcast note update to kitchen display in real-time
      try {
        const kdsChannel = supabase.channel(`kds_stream_${restaurantId}`);
        kdsChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            kdsChannel.send({
              type: 'broadcast',
              event: 'item_note_updated',
              payload: {
                tableName: targetRound.table_no,
                itemName,
                note,
                updatedAt: Date.now()
              }
            });
            setTimeout(() => supabase.removeChannel(kdsChannel), 1500);
          }
        });
      } catch {}
    }
  };

  // Settle entire table (called from bill modal with optional discount)
  const handleSettleTable = async (session: TableSession, discountAmount: number = 0) => {
    // 🛡️ HARD SAFETY GUARD 1: Cannot settle if table is already settled or paid
    if (session.isPaid || session.sessionStatus === 'SETTLED') {
      return;
    }

    // 🛡️ HARD SAFETY GUARD 2: Under NO condition can a table be settled if any round is still 'NEW'
    const hasUnfired = session.rounds.some(r => r.status === 'NEW');
    if (hasUnfired) {
      const unfiredRoundIdx = session.rounds.findIndex(r => r.status === 'NEW');
      setUnfiredWarningModal({
        session,
        roundIndex: unfiredRoundIdx >= 0 ? unfiredRoundIdx : 0,
        round: session.rounds[unfiredRoundIdx >= 0 ? unfiredRoundIdx : 0]
      });
      return;
    }

    setActionLoadingId(`table_${session.table_no}`);
    const ids = session.rounds.map(r => r.id);
    
    // Update local state immediately so UI updates instantaneously
    setOrders(prev => prev.map(o => {
      const match = ids.includes(o.id) || (session.table_no && o.table_no?.toLowerCase().trim() === session.table_no.toLowerCase().trim());
      return match ? { ...o, status: 'COMPLETED', payment_status: 'PAID' } : o;
    }));

    // Update in Supabase (both by round IDs and by restaurant table_no to ensure 100% coverage)
    const validIds = session.rounds.map(r => r.id).filter(Boolean);
    if (validIds.length > 0) {
      await supabase.from('orders').update({ status: 'COMPLETED', payment_status: 'PAID' }).in('id', validIds);
    }
    if (restaurantId && session.table_no) {
      await supabase
        .from('orders')
        .update({ status: 'COMPLETED', payment_status: 'PAID' })
        .eq('restaurant_id', restaurantId)
        .ilike('table_no', session.table_no)
        .neq('payment_status', 'PAID');
    }

    // Broadcast table settlement to customer devices and captain terminals immediately
    if (restaurantId && session.table_no) {
      try {
        const cleanTable = (session.table_no || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const normTable = cleanTable.replace(/^table0*([0-9]+)$/, 'table$1');

        // Broadcast to all channel variations (normalized and raw) so all customer devices receive it
        const channelTargets = Array.from(new Set([
          `table_session_${restaurantId}_${cleanTable}`,
          `table_session_${restaurantId}_${normTable}`,
          `table_session_${restaurantId}_${encodeURIComponent(session.table_no)}`
        ]));

        channelTargets.forEach(chName => {
          const tableChannel = supabase.channel(chName);
          tableChannel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              tableChannel.send({
                type: 'broadcast',
                event: 'payment_confirmed',
                payload: {
                  tableName: session.table_no,
                  action: 'payment_confirmed',
                  settledAt: Date.now()
                }
              });
              tableChannel.send({
                type: 'broadcast',
                event: 'table_cleared',
                payload: {
                  tableName: session.table_no,
                  settledAt: Date.now(),
                  action: 'settled',
                  discount: discountAmount
                }
              });
              setTimeout(() => supabase.removeChannel(tableChannel), 1500);
            }
          });
        });
      } catch (bErr) {
        console.warn("Table settlement broadcast notice:", bErr);
      }
    }

    const finalPaid = Math.max(0, session.totalBill - discountAmount);
    setReadyForPickupNotice(`✅ Table ${session.table_no} settled (₹${finalPaid.toFixed(0)}) & closed.`);
    setTimeout(() => setReadyForPickupNotice(null), 5000);

    setActionLoadingId(null);
    setBillModal(null);
  };

  // Reopen table (reactivate settled orders) - triggers in-app confirmation modal
  const handleReopenTable = (session: TableSession) => {
    setReopenConfirmModal(session);
  };

  const handleExecuteReopen = async (session: TableSession) => {
    setReopenConfirmModal(null);
    setActionLoadingId(`table_${session.table_no}`);
    const ids = session.rounds.map(r => r.id);
    const { error } = await supabase.from('orders').update({ status: 'SERVED', payment_status: 'PENDING' }).in('id', ids);
    if (error) {
      setDashboardErrorToast("Error reopening table: " + error.message);
      setTimeout(() => setDashboardErrorToast(null), 5000);
    } else {
      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: 'SERVED', payment_status: 'PENDING' } : o));
      setReadyForPickupNotice(`Table ${session.table_no} restored to active status.`);
      setTimeout(() => setReadyForPickupNotice(null), 4000);
    }
    setActionLoadingId(null);
  };

  const tableGroups = React.useMemo(() => {
    // 1. Group orders by normalized table key
    const map = new Map<string, { displayName: string; rounds: Order[] }>();
    orders.forEach(o => {
      const rawKey = (o.table_no || 'Counter').trim();
      const normKey = rawKey.toLowerCase();
      if (!map.has(normKey)) {
        map.set(normKey, { displayName: rawKey, rounds: [] });
      }
      map.get(normKey)!.rounds.push(o);
    });

    const sessions: TableSession[] = [];

    map.forEach(({ displayName, rounds }) => {
      // Find active orders (currently dining, not yet paid, not cancelled)
      const activeOrders = rounds.filter(r => r.status !== 'CANCELLED' && r.payment_status !== 'PAID');

      if (activeOrders.length > 0) {
        // ─── ACTIVE TABLE SESSION ───
        const sortedActive = [...activeOrders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const newRounds = sortedActive.filter(r => r.status === 'NEW');
        const earliestNewOrderAt = newRounds.length > 0
          ? newRounds.reduce((min, r) => new Date(r.created_at) < new Date(min) ? r.created_at : min, newRounds[0].created_at)
          : undefined;

        const totalBill = sortedActive.reduce((s, r) => s + (Number(r.total) || 0), 0);
        const latestGuestName = sortedActive.slice().reverse().find(r => r.customer_name)?.customer_name;
        const latestGuestPhone = sortedActive.slice().reverse().find(r => r.customer_phone)?.customer_phone;

        sessions.push({
          table_no: displayName,
          customer_name: latestGuestName,
          customer_phone: latestGuestPhone,
          first_order_at: sortedActive[0].created_at,
          latest_order_at: sortedActive[sortedActive.length - 1].created_at,
          rounds: sortedActive,
          totalBill,
          hasNewRound: newRounds.length > 0,
          hasCookingRound: sortedActive.some(r => r.status === 'PREPARING'),
          allServed: sortedActive.every(r => r.status === 'SERVED' || r.status === 'COMPLETED'),
          isCashRequested: sortedActive.some(r => r.payment_status === 'CASH_REQUESTED'),
          isUpiVerificationPending: sortedActive.some(r => r.payment_status === 'UPI_VERIFICATION_PENDING'),
          earliestNewOrderAt,
          isPaid: false,
          sessionStatus: 'ACTIVE',
        });
      }

      // ─── SETTLED TABLE SESSIONS ───
      // Push each distinct settled dining session for this table so all settled orders appear in 'SETTLED' tab!
      const paidOrders = rounds.filter(r => r.payment_status === 'PAID' && r.status !== 'CANCELLED');
      if (paidOrders.length > 0) {
        const settledBatches = groupOrdersIntoSessions(paidOrders);
        settledBatches.forEach(batch => {
          const totalBill = batch.reduce((s, r) => s + (Number(r.total) || 0), 0);
          const guestName = batch.slice().reverse().find(r => r.customer_name)?.customer_name;
          const guestPhone = batch.slice().reverse().find(r => r.customer_phone)?.customer_phone;

          sessions.push({
            table_no: displayName,
            customer_name: guestName,
            customer_phone: guestPhone,
            first_order_at: batch[0].created_at,
            latest_order_at: batch[batch.length - 1].created_at,
            rounds: batch,
            totalBill,
            hasNewRound: false,
            hasCookingRound: false,
            allServed: true,
            isCashRequested: false,
            isUpiVerificationPending: false,
            earliestNewOrderAt: undefined,
            isPaid: true,
            sessionStatus: 'SETTLED',
          });
        });
      }
    });

    return sessions.sort((a, b) => {
      if (a.isUpiVerificationPending && !b.isUpiVerificationPending) return -1;
      if (!a.isUpiVerificationPending && b.isUpiVerificationPending) return 1;
      if (a.isCashRequested && !b.isCashRequested) return -1;
      if (!a.isCashRequested && b.isCashRequested) return 1;
      if (a.hasNewRound && !b.hasNewRound) return -1;
      if (!a.hasNewRound && b.hasNewRound) return 1;
      if (a.sessionStatus === 'ACTIVE' && b.sessionStatus === 'SETTLED') return -1;
      if (a.sessionStatus === 'SETTLED' && b.sessionStatus === 'ACTIVE') return 1;
      return new Date(b.latest_order_at).getTime() - new Date(a.latest_order_at).getTime();
    });
  }, [orders]);

  const filteredSessions = tableGroups.filter(s => {
    if (activeTab === 'ACTIVE' && s.sessionStatus !== 'ACTIVE') return false;
    if (activeTab === 'NEW_ROUNDS' && (!s.hasNewRound || s.sessionStatus !== 'ACTIVE')) return false;
    if (activeTab === 'SETTLED' && s.sessionStatus !== 'SETTLED') return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return s.table_no.toLowerCase().includes(q) ||
      s.customer_name?.toLowerCase().includes(q) ||
      s.rounds.some(r => r.items_json?.some(i => i.item?.name?.toLowerCase().includes(q)));
  });

  const activeCount = tableGroups.filter(s => s.sessionStatus === 'ACTIVE').length;
  const newCount = tableGroups.filter(s => s.hasNewRound && s.sessionStatus === 'ACTIVE').length;
  const settledCount = tableGroups.filter(s => s.sessionStatus === 'SETTLED').length;

  const tabs = [
    { id: 'ACTIVE' as const, label: 'Active', count: activeCount },
    { id: 'NEW_ROUNDS' as const, label: 'New Orders', count: newCount },
    { id: 'SETTLED' as const, label: 'Settled', count: settledCount },
    { id: 'ALL' as const, label: 'All', count: tableGroups.length },
  ];

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto slim-scrollbar px-5 md:px-8 pb-20">

        {/* ── Header ── */}
        <div className="sticky top-0 z-20 pt-5 pb-3 bg-white/95 backdrop-blur-md border-b border-zinc-100">
          {/* UPI VERIFICATION ALERT BANNER */}
          {upiAlert && (
            <div className="mb-3 p-3.5 rounded-2xl bg-emerald-600 text-white shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top-2 border border-emerald-500">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Smartphone size={18} className="text-white animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold uppercase tracking-wide">UPI Payment Submitted</span>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  </div>
                  <p className="text-[12px] text-emerald-50">
                    Table <strong className="text-white font-bold">{upiAlert.tableNo}</strong> submitted UPI payment of <strong className="text-white font-bold">₹{upiAlert.amount}</strong>. Please go to Table {upiAlert.tableNo} or verify on soundbox / UPI app!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const targetSession = tableGroups.find(s => s.table_no.toLowerCase().trim() === upiAlert.tableNo.toLowerCase().trim());
                    if (targetSession) {
                      setBillModal({ session: targetSession, mode: 'view' });
                    }
                    setUpiAlert(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white text-emerald-800 text-[12px] font-black hover:bg-emerald-50 transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>Verify & Settle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUpiAlert(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* EXPEDITER WAITER PICKUP BANNER */}
          {readyForPickupNotice && (
            <div className="mb-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[13px] font-semibold flex items-center justify-between animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>🛎️ {readyForPickupNotice}</span>
              </div>
              <button
                onClick={() => setReadyForPickupNotice(null)}
                className="text-[11.5px] text-emerald-700 hover:text-emerald-900 bg-white/60 hover:bg-white px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[18px] font-bold text-zinc-900 tracking-tight">Live Tables</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10.5px] font-bold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
                </span>
                {newCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#E46254]/10 text-[#E46254] text-[10.5px] font-bold border border-[#E46254]/20">
                    {newCount} new
                  </span>
                )}
              </div>
              {restaurantName && <p className="text-[11.5px] text-zinc-400 mt-0.5">{restaurantName}</p>}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
                <input
                  type="text"
                  placeholder="Table, dish, customer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-xl pl-8 pr-3 py-1.5 text-[12.5px] placeholder:text-zinc-400 outline-none focus:border-zinc-400 transition-all"
                />
              </div>
              <button onClick={() => setSoundEnabled(v => !v)} className={`p-2 rounded-xl border transition-all cursor-pointer ${soundEnabled ? 'border-zinc-200 bg-white text-zinc-500' : 'border-zinc-200 bg-zinc-100 text-zinc-300'}`}>
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button onClick={handleRefresh} className="p-2 border border-zinc-200 bg-white rounded-xl text-zinc-500 hover:text-zinc-900 cursor-pointer">
                <RotateCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-3 overflow-x-auto">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer shrink-0 ${isActive ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${tab.id === 'NEW_ROUNDS' && !isActive ? 'bg-[#E46254]/12 text-[#E46254]' : isActive ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-100 text-zinc-400'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Cards Grid ── */}
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 size={22} className="animate-spin text-zinc-300 mb-3" />
            <p className="text-[13px] text-zinc-400">Loading live tables...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-200 rounded-2xl bg-white mt-5">
            <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-3">
              <ShoppingBag size={16} className="text-zinc-400" />
            </div>
            <h3 className="text-[13.5px] font-semibold text-zinc-700">No tables right now</h3>
            <p className="text-[12px] text-zinc-400 mt-1 text-center max-w-xs">
              When guests scan a QR and order, their table card appears here in real-time.
            </p>
          </div>
        ) : (
          /* overflow-visible so the hover expand can overlay cards below */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5" style={{ overflow: 'visible' }}>
            {filteredSessions.map(session => (
              <TableCard
                key={session.table_no}
                session={session}
                actionLoadingId={actionLoadingId}
                onFireKot={(round, roundIndex) => setKotModal({ round, roundIndex, session })}
                onViewBill={s => setBillModal({ session: s, mode: 'view' })}
                onEditBill={s => setBillModal({ session: s, mode: 'edit' })}
                onReopenTable={handleReopenTable}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── KOT Modal ── */}
      {kotModal && (
        <KotModal
          round={kotModal.round}
          roundIndex={kotModal.roundIndex}
          session={kotModal.session}
          loading={actionLoadingId === `kot_${kotModal.round.id}`}
          onConfirm={() => handleSendKot(kotModal.round)}
          onClose={() => setKotModal(null)}
          onUpdateQuantity={handleUpdateItemQuantity}
          onUpdateItemNote={handleUpdateItemNote}
        />
      )}

      {/* ── Bill Modal ── */}
      {billModal && (() => {
        // Calculate customer visit loyalty stats from past orders
        let customerStats: CustomerVisitStats | undefined = undefined;
        if (billModal.session.customer_phone || billModal.session.customer_name) {
          const matchPhone = billModal.session.customer_phone?.trim();
          const matchName = billModal.session.customer_name?.trim().toLowerCase();

          const pastMatches = orders.filter(o => {
            if (o.status === 'CANCELLED') return false;
            if (matchPhone && o.customer_phone && o.customer_phone.trim() === matchPhone) return true;
            if (matchName && o.customer_name && o.customer_name.trim().toLowerCase() === matchName && matchName !== 'dine-in guest') return true;
            return false;
          });

          if (pastMatches.length > 0) {
            const totalSpent = pastMatches.reduce((s, o) => s + (Number(o.total) || 0), 0);
            customerStats = {
              visitCount: pastMatches.length,
              totalSpent
            };
          }
        }

        return (
          <BillModal
            session={billModal.session}
            modalMode={billModal.mode}
            restaurantName={restaurantName}
            settling={actionLoadingId === `table_${billModal.session.table_no}`}
            onSettle={billModal.mode === 'view' ? (discount) => handleSettleTable(billModal.session, discount) : undefined}
            onClose={() => setBillModal(null)}
            onUpdateQuantity={handleUpdateItemQuantity}
            onAddWater={handleAddWaterToSession}
            customerStats={customerStats}
            onFireKot={(round, roundIndex) => setKotModal({ round, roundIndex, session: billModal.session })}
            menuCatalog={menuCatalog}
            onAddMenuItem={handleAddMenuItemToSession}
            onUpdateItemNote={handleUpdateItemNote}
          />
        );
      })()}

      {/* ── Unfired Rounds Hard Warning Modal ── */}
      {unfiredWarningModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-amber-200 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <AlertTriangle size={24} />
            </div>
            <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">Cannot Settle Table {unfiredWarningModal.session.table_no}</h4>
            <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
              Round {unfiredWarningModal.roundIndex + 1} has not been dispatched to the kitchen yet. All rounds must be sent to the kitchen before settling the bill.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = unfiredWarningModal;
                  setUnfiredWarningModal(null);
                  setKotModal({ round: target.round, roundIndex: target.roundIndex, session: target.session });
                }}
                className="w-full py-3 bg-[#E46254] hover:bg-[#d04e41] text-white font-bold rounded-2xl text-[13px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                <ChefHat size={16} />
                <span>Review & Send KOT</span>
              </button>
              <button
                type="button"
                onClick={() => setUnfiredWarningModal(null)}
                className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen Table Confirmation Modal ── */}
      {reopenConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <RotateCcw size={22} />
            </div>
            <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">Reopen Table {reopenConfirmModal.table_no}?</h4>
            <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
              This table is currently settled. Reopening will restore it to active dine-in status so you can add more rounds or make changes.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setReopenConfirmModal(null)}
                className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-2xl text-[12.5px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoadingId === `table_${reopenConfirmModal.table_no}`}
                onClick={() => handleExecuteReopen(reopenConfirmModal)}
                className="flex-1 py-3 bg-zinc-900 hover:bg-black text-white font-bold rounded-2xl text-[12.5px] shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                {actionLoadingId === `table_${reopenConfirmModal.table_no}` ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                <span>Reopen Table</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard Error Toast ── */}
      {dashboardErrorToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[140] animate-in slide-in-from-bottom-2 duration-200">
          <div className="bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-[13px] font-semibold border border-rose-500">
            <AlertOctagon size={16} className="shrink-0" />
            <span>{dashboardErrorToast}</span>
            <button
              onClick={() => setDashboardErrorToast(null)}
              className="ml-2 text-rose-200 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
