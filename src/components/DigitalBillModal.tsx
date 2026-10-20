"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import { 
  X, 
  Receipt, 
  Clock, 
  CheckCircle2, 
  Smartphone, 
  Banknote, 
  ArrowLeft, 
  Printer, 
  Loader2, 
  UtensilsCrossed,
  Sparkles,
  ExternalLink,
  ChefHat,
  Coins,
  Star,
  Check,
  ChevronDown,
  ChevronUp,
  Bell,
  QrCode,
  ShieldCheck,
  CreditCard,
  RotateCcw
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { extractSessionId } from "@/utils/orderSession";

interface OrderItem {
  item: {
    id?: string;
    name: string;
    basePrice?: number;
    category?: string;
    isVeg?: boolean;
  };
  price: number;
  quantity?: number;
}

interface OrderRound {
  id: string;
  created_at: string;
  status: 'NEW' | 'PREPARING' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  total: number;
  note?: string;
  items_json: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
  payment_method?: string;
  payment_status?: string;
}

export interface PaymentLock {
  lockedByClientId: string;
  payerName: string;
  payerPhone: string;
  paymentMethod: 'UPI' | 'CASH';
  lockedAt: number;
}

interface DigitalBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  tableNo: string;
  orders: OrderRound[];
  upiId?: string;
  taxRate?: number; // e.g. 5 for 5%
  serviceChargeRate?: number; // e.g. 0 or 5 or 10%
  promotionsConfig?: any;
  customerPhone?: string;
  customerName?: string;
  clientId?: string;
  activePaymentLock?: PaymentLock | null;
  onAcquireLock?: (method: 'UPI' | 'CASH') => Promise<boolean>;
  onReleaseLock?: () => Promise<void>;
  onPaymentSettled: (settlementSnapshot?: any) => void;
  billingMode?: 'STAFF_ASSISTED' | 'SELF_PAY';
}

export function DigitalBillModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
  tableNo,
  orders,
  upiId,
  taxRate = 5,
  serviceChargeRate = 0,
  promotionsConfig,
  customerPhone,
  customerName,
  clientId,
  activePaymentLock,
  onAcquireLock,
  onReleaseLock,
  onPaymentSettled,
  billingMode = 'STAFF_ASSISTED',
}: DigitalBillModalProps) {
  const supabase = createClient();
  const isAlreadyCash = orders.some(o => o.payment_status === 'CASH_REQUESTED');
  const isAlreadyUpi = orders.some(o => o.payment_status === 'UPI_VERIFICATION_PENDING');
  const hasUnpaid = orders.some(o => o.payment_status === 'PENDING');
  const initialView = isAlreadyCash ? 'CASH' : isAlreadyUpi ? 'UPI' : 'BILL';

  const [view, setView] = useState<'BILL' | 'UPI' | 'CONFIRMED' | 'CASH'>(initialView);

  // Synchronous render-phase adjustment:
  // If diner has active unpaid dishes (PENDING) and view is CONFIRMED, reset immediately during render BEFORE any frame paints!
  if (hasUnpaid && view === 'CONFIRMED') {
    setView('BILL');
  }

  const isHeldByOtherGuest = Boolean(
    activePaymentLock &&
    clientId &&
    activePaymentLock.lockedByClientId !== clientId &&
    (Date.now() - activePaymentLock.lockedAt < 75000)
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [cashCalled, setCashCalled] = useState(isAlreadyCash);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDetailedReceipt, setShowDetailedReceipt] = useState(false);

  // Group items by name for an individual order
  const getGroupedItems = (items: OrderItem[]) => {
    const map = new Map<string, { name: string; count: number; price: number }>();
    (items || []).forEach(entry => {
      const name = entry?.item?.name || 'Dish Item';
      const existing = map.get(name);
      if (existing) {
        existing.count += (entry.quantity || 1);
      } else {
        map.set(name, {
          name,
          count: entry.quantity || 1,
          price: entry.price || entry.item?.basePrice || 0
        });
      }
    });
    return Array.from(map.values());
  };

  // Flatten all items across all rounds for the final receipt
  const getAllGroupedItems = () => {
    const map = new Map<string, { name: string; count: number; price: number }>();
    orders.forEach(order => {
      (order.items_json || []).forEach(entry => {
        const name = entry?.item?.name || 'Dish Item';
        const existing = map.get(name);
        if (existing) {
          existing.count += (entry.quantity || 1);
        } else {
          map.set(name, {
            name,
            count: entry.quantity || 1,
            price: entry.price || entry.item?.basePrice || 0
          });
        }
      });
    });
    return Array.from(map.values());
  };

  // Phone number for loyalty matching
  const effectivePhone = (customerPhone || orders[0]?.customer_phone || '').trim();
  const cleanPhone = effectivePhone.replace(/\D/g, '');

  // TableTapy Loyalty Coins State
  const [userCoinsBalance, setUserCoinsBalance] = useState<number>(0);
  const [redeemCoins, setRedeemCoins] = useState<boolean>(false);

  // Synchronize customer coins balance strictly when 10 digits and loyalty campaign is active
  useEffect(() => {
    if (typeof window === 'undefined' || !restaurantId || !cleanPhone || cleanPhone.length !== 10) {
      setUserCoinsBalance(0);
      setRedeemCoins(false);
      return;
    }

    if (!promotionsConfig?.loyaltyEnabled) {
      setUserCoinsBalance(0);
      setRedeemCoins(false);
      return;
    }

    let isMounted = true;
    const key = `tabletapy_customer_coins_${restaurantId}_${cleanPhone}`;
    const stored = localStorage.getItem(key);
    if (stored !== null && stored !== undefined) {
      const parsed = parseInt(stored, 10);
      setUserCoinsBalance(isNaN(parsed) || parsed < 0 ? 0 : parsed);
      return;
    }

    // Fallback: If not in localStorage, calculate from paid orders in Supabase
    async function loadCoinsFromDb() {
      try {
        const { data: pastOrders } = await supabase
          .from('orders')
          .select('total, created_at')
          .eq('restaurant_id', restaurantId)
          .eq('customer_phone', cleanPhone)
          .eq('payment_status', 'PAID');

        if (pastOrders && pastOrders.length > 0 && promotionsConfig?.milestones) {
          const milestones = [...promotionsConfig.milestones].sort((a: any, b: any) => b.minSpend - a.minSpend);
          let totalEarned = 0;
          for (const ord of pastOrders) {
            const ordTotal = Number(ord.total) || 0;
            const match = milestones.find((m: any) => ordTotal >= m.minSpend);
            if (match) totalEarned += (match.coinsEarned || 0);
          }
          if (isMounted) {
            setUserCoinsBalance(totalEarned);
            localStorage.setItem(key, totalEarned.toString());
          }
        } else {
          if (isMounted) setUserCoinsBalance(0);
        }
      } catch {
        if (isMounted) setUserCoinsBalance(0);
      }
    }

    loadCoinsFromDb();

    return () => {
      isMounted = false;
    };
  }, [cleanPhone, restaurantId, promotionsConfig?.loyaltyEnabled, promotionsConfig?.milestones, supabase]);

  // Subtotal of food items across all active rounds
  const rawSubtotal = orders.reduce((sum, o) => {
    const itemsTotal = (o.items_json || []).reduce((acc, curr) => acc + (curr.price || curr.item?.basePrice || 0) * (curr.quantity || 1), 0);
    return sum + (itemsTotal > 0 ? itemsTotal : Number(o.total) || 0);
  }, 0);

  // TableTapy Coins Calculation: Redeemable on ANY order, capped at owner's chosen max cap X
  const loyaltyActive = promotionsConfig?.loyaltyEnabled === true;
  const maxCap = promotionsConfig?.maxCoinsPerOrder ?? 100;
  const maxCoinsRedeemable = Math.min(userCoinsBalance, maxCap, Math.floor(rawSubtotal));
  const coinsDiscount = (redeemCoins && maxCoinsRedeemable > 0) ? (maxCoinsRedeemable * (promotionsConfig?.coinValueInRupees || 1.0)) : 0;

  // TableTapy Coins Earned on this dining session
  const coinsEarned = (() => {
    if (!loyaltyActive || !promotionsConfig?.milestones || promotionsConfig.milestones.length === 0) return 0;
    const sorted = [...promotionsConfig.milestones].sort((a: any, b: any) => b.minSpend - a.minSpend);
    const matched = sorted.find((m: any) => rawSubtotal >= m.minSpend);
    return matched ? (matched.coinsEarned || 0) : 0;
  })();

  const discountedSubtotal = Math.max(0, rawSubtotal - coinsDiscount);
  const calcService = Number(((discountedSubtotal * (serviceChargeRate || 0)) / 100).toFixed(2));
  const calcGst = Number((((discountedSubtotal + calcService) * (taxRate ?? 5)) / 100).toFixed(2));
  const calculatedGrandTotal = Number((discountedSubtotal + calcService + calcGst).toFixed(2));

  // Remaining coins after redemption + newly earned coins
  const totalCoinsLeft = Math.max(0, userCoinsBalance - ((redeemCoins && maxCoinsRedeemable > 0) ? maxCoinsRedeemable : 0)) + (loyaltyActive ? coinsEarned : 0);

  // Cache the last bill details so when table is settled by staff and orders list clears,
  // the Thank You / Payment Confirmed screen still renders the exact amount, items, and table name!
  const [lastBillSnapshot, setLastBillSnapshot] = useState<{
    subtotal: number;
    coinsDiscount: number;
    coinsRedeemed: number;
    gstAmount: number;
    serviceChargeAmount: number;
    grandTotal: number;
    groupedItems: { name: string; count: number; price: number }[];
    coinsEarned: number;
    totalCoinsLeft: number;
    previousCoins: number;
    phone: string;
  } | null>(null);

  useEffect(() => {
    if (orders.length > 0) {
      setLastBillSnapshot({
        subtotal: rawSubtotal,
        coinsDiscount,
        coinsRedeemed: (redeemCoins && maxCoinsRedeemable > 0) ? maxCoinsRedeemable : 0,
        gstAmount: calcGst,
        serviceChargeAmount: calcService,
        grandTotal: calculatedGrandTotal,
        groupedItems: getAllGroupedItems(),
        coinsEarned,
        totalCoinsLeft,
        previousCoins: userCoinsBalance,
        phone: cleanPhone
      });
    }
  }, [orders, serviceChargeRate, taxRate, rawSubtotal, coinsDiscount, calcGst, calcService, calculatedGrandTotal, coinsEarned, totalCoinsLeft, cleanPhone, redeemCoins, maxCoinsRedeemable, userCoinsBalance]);

  const lastBillSnapshotRef = useRef<any>(null);
  useEffect(() => {
    if (lastBillSnapshot) {
      lastBillSnapshotRef.current = lastBillSnapshot;
    }
  }, [lastBillSnapshot]);

  // If another guest acquires the payment lock while this modal is open, immediately revert this guest to BILL view with the hold card
  useEffect(() => {
    if (isHeldByOtherGuest && (view === 'UPI' || view === 'CASH')) {
      setView('BILL');
    }
  }, [isHeldByOtherGuest, view]);

  const buildAndEmitSettlement = () => {
    const snap = lastBillSnapshot || lastBillSnapshotRef.current;
    const finalItems = (snap?.groupedItems && snap.groupedItems.length > 0) ? snap.groupedItems : getAllGroupedItems();
    const finalGrandTotal = snap ? snap.grandTotal : calculatedGrandTotal;
    const finalSubtotal = snap ? snap.subtotal : rawSubtotal;
    const finalDiscount = snap ? snap.coinsDiscount : coinsDiscount;
    const finalGst = snap ? snap.gstAmount : calcGst;
    const finalService = snap ? snap.serviceChargeAmount : calcService;
    const finalEarnedCoins = snap ? snap.coinsEarned : coinsEarned;
    const finalTotalCoins = snap ? snap.totalCoinsLeft : totalCoinsLeft;
    const finalPreviousCoins = snap?.previousCoins !== undefined 
      ? snap.previousCoins 
      : userCoinsBalance;
    const finalPhone = snap?.phone || cleanPhone;

    const isThisDevicePayer = Boolean(
      !activePaymentLock || 
      (clientId && activePaymentLock.lockedByClientId === clientId) ||
      (cleanPhone && activePaymentLock.payerPhone && cleanPhone === activePaymentLock.payerPhone.replace(/\D/g, ''))
    );

    const settlementData = {
      settledAt: Date.now(),
      tableNo,
      restaurantId,
      restaurantName: restaurantName || 'Restaurant',
      grandTotal: finalGrandTotal,
      subtotal: finalSubtotal,
      discount: finalDiscount,
      taxAmount: finalGst,
      serviceChargeAmount: finalService,
      earnedCoins: finalEarnedCoins,
      totalCoins: isThisDevicePayer ? finalTotalCoins : userCoinsBalance,
      previousCoins: finalPreviousCoins,
      isPayer: isThisDevicePayer,
      payerName: isThisDevicePayer ? (customerName || 'You') : (activePaymentLock?.payerName || orders[0]?.customer_name || 'Table Guest'),
      payerPhone: isThisDevicePayer ? finalPhone : (activePaymentLock?.payerPhone || orders[0]?.customer_phone || ''),
      customerPhone: finalPhone,
      customerName: customerName || '',
      items: finalItems,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      upiId
    };

    // ONLY credit loyalty stars to this device's localStorage if THIS device was the payer!
    if (isThisDevicePayer && finalPhone.length === 10 && restaurantId && loyaltyActive) {
      const key = `tabletapy_customer_coins_${restaurantId}_${finalPhone}`;
      localStorage.setItem(key, finalTotalCoins.toString());
    }

    onPaymentSettled(settlementData);
    onClose();
  };

  // Sync view when orders change or auto-close when table is settled by owner
  useEffect(() => {
    if (!isOpen) return;

    const hasUnpaidOrders = orders.some(o => o.payment_status === 'PENDING');
    const hasCash = orders.some(o => o.payment_status === 'CASH_REQUESTED');
    const hasUpi = orders.some(o => o.payment_status === 'UPI_VERIFICATION_PENDING');
    const isPaid = orders.length > 0 && orders.every(o => o.payment_status === 'PAID' || o.status === 'CANCELLED');

    if (hasCash) {
      setView('CASH');
      setCashCalled(true);
    } else if (hasUpi) {
      if (view !== 'CONFIRMED') {
        setView('UPI');
      }
    } else if (hasUnpaidOrders) {
      if (view === 'CONFIRMED') {
        setView('BILL');
      }
    } else if (isPaid || orders.length === 0) {
      buildAndEmitSettlement();
      return;
    }
  }, [orders, isOpen, view, onPaymentSettled, onClose]);

  // Listen directly for payment confirmation / table settlement broadcast on Realtime
  useEffect(() => {
    if (!isOpen || !restaurantId || !tableNo) return;

    const cleanTable = (tableNo || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const normTable = cleanTable.replace(/^table0*([0-9]+)$/, 'table$1');

    const channelTargets = Array.from(new Set([
      `table_session_${restaurantId}_${cleanTable}`,
      `table_session_${restaurantId}_${normTable}`,
      `table_session_${restaurantId}_${encodeURIComponent(tableNo)}`
    ]));

    const channels = channelTargets.map(chName => {
      const ch = supabase.channel(`bill_modal_${chName}_${Date.now()}`)
        .on('broadcast', { event: 'payment_confirmed' }, () => {
          buildAndEmitSettlement();
        })
        .on('broadcast', { event: 'table_cleared' }, () => {
          buildAndEmitSettlement();
        })
        .subscribe();
      return ch;
    });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [isOpen, restaurantId, tableNo, view, onPaymentSettled, onClose, supabase]);



  if (!isOpen) return null;

  // Use cached values ONLY if active orders cleared upon cashier settlement
  const isSettledAndCleared = orders.length === 0 && lastBillSnapshot !== null;
  const subtotal = isSettledAndCleared ? lastBillSnapshot.subtotal : rawSubtotal;
  const activeCoinsDiscount = isSettledAndCleared ? lastBillSnapshot.coinsDiscount : coinsDiscount;
  const activeCoinsEarned = isSettledAndCleared ? lastBillSnapshot.coinsEarned : coinsEarned;
  const activeCoinsLeft = isSettledAndCleared ? lastBillSnapshot.totalCoinsLeft : totalCoinsLeft;
  const serviceChargeAmount = isSettledAndCleared ? lastBillSnapshot.serviceChargeAmount : calcService;
  const gstAmount = isSettledAndCleared ? lastBillSnapshot.gstAmount : calcGst;
  const grandTotal = isSettledAndCleared ? lastBillSnapshot.grandTotal : calculatedGrandTotal;
  const displayedItems = isSettledAndCleared ? lastBillSnapshot.groupedItems : getAllGroupedItems();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };

  // UPI deep link
  const merchantVpa = upiId || "payments@tabletapy";
  const upiDeepLink = `upi://pay?pa=${merchantVpa}&pn=${encodeURIComponent(restaurantName || 'Restaurant')}&am=${grandTotal}&cu=INR&tn=${encodeURIComponent(`Table ${tableNo} Bill`)}`;

  // Handle UPI Confirmation: alert staff to verify
  const handleConfirmUPI = async () => {
    setIsProcessing(true);
    try {
      if (orders.length > 0) {
        const existingSessionId = orders.map(o => extractSessionId(o.note)).find(Boolean) || `sess_${orders[0].id}`;

        for (const order of orders) {
          const cleanExistingNote = (order.note || '')
            .replace(/\[SESSION:[^\]]+\]/gi, '')
            .replace(/\[(UPI VERIFICATION REQUESTED|CASH REQUESTED)[^\]]*\]/gi, '')
            .trim();
          const updatedNote = [
            `[SESSION:${existingSessionId}]`,
            `[UPI VERIFICATION REQUESTED - ₹${grandTotal} - TABLE ${tableNo}]`,
            cleanExistingNote
          ].filter(Boolean).join(' ');

          const updatePayload: any = { 
            payment_status: 'UPI_VERIFICATION_PENDING',
            payment_method: 'UPI',
            note: updatedNote
          };
          if (cleanPhone) updatePayload.customer_phone = cleanPhone;
          if (customerName) updatePayload.customer_name = customerName;

          const { error } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', order.id);

          if (error) {
            setErrorMessage("Failed to submit payment verification: " + error.message);
          }
        }
      }

      // Broadcast to floor terminals & captain app with payer details
      if (restaurantId && tableNo) {
        try {
          const tableChannel = supabase.channel(`table_session_${restaurantId}_${encodeURIComponent(tableNo)}`);
          tableChannel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              tableChannel.send({
                type: 'broadcast',
                event: 'upi_payment_submitted',
                payload: {
                  tableNo,
                  amount: grandTotal,
                  payerPhone: cleanPhone,
                  payerName: customerName || 'Table Guest',
                  alertStaffToTable: true,
                  timestamp: Date.now()
                }
              });
              setTimeout(() => supabase.removeChannel(tableChannel), 1500);
            }
          });
        } catch {}
      }
    } catch (e: any) {
      setErrorMessage("Error: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle UPI Selection: acquire table payment lock, instantly alert floor staff & switch to QR view
  const handleSelectPayViaUpi = async () => {
    if (isHeldByOtherGuest) return;
    if (onAcquireLock) {
      const acquired = await onAcquireLock('UPI');
      if (!acquired) {
        setErrorMessage(`${activePaymentLock?.payerName || 'Another diner'} is currently paying. Please wait.`);
        return;
      }
    }
    setView('UPI');
    await handleConfirmUPI();
  };

  // 1-Tap Pay Direct via UPI App with fixed amount pre-filled (No scanning needed)
  const handlePayDirectlyViaUpiApp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isHeldByOtherGuest) return;
    if (onAcquireLock) {
      const acquired = await onAcquireLock('UPI');
      if (!acquired) {
        setErrorMessage(`${activePaymentLock?.payerName || 'Another diner'} is currently paying. Please wait.`);
        return;
      }
    }
    await handleConfirmUPI();
    if (typeof window !== 'undefined' && upiDeepLink) {
      window.location.href = upiDeepLink;
    }
  };

  // Handle Call Waiter for Cash: acquire table payment lock & notify staff
  const handleCallWaiterCash = async () => {
    if (isHeldByOtherGuest) return;
    if (onAcquireLock) {
      const acquired = await onAcquireLock('CASH');
      if (!acquired) {
        setErrorMessage(`${activePaymentLock?.payerName || 'Another diner'} is currently paying. Please wait.`);
        return;
      }
    }
    setIsProcessing(true);
    try {
      if (orders.length > 0) {
        const existingSessionId = orders.map(o => extractSessionId(o.note)).find(Boolean) || `sess_${orders[0].id}`;

        for (const order of orders) {
          const cleanExistingNote = (order.note || '')
            .replace(/\[SESSION:[^\]]+\]/gi, '')
            .replace(/\[(UPI VERIFICATION REQUESTED|CASH REQUESTED)[^\]]*\]/gi, '')
            .trim();
          const updatedNote = [
            `[SESSION:${existingSessionId}]`,
            `[CASH REQUESTED - ₹${grandTotal} - TABLE ${tableNo}]`,
            cleanExistingNote
          ].filter(Boolean).join(' ');

          const updatePayload: any = { 
            payment_method: 'CASH',
            payment_status: 'CASH_REQUESTED',
            note: updatedNote
          };
          if (cleanPhone) updatePayload.customer_phone = cleanPhone;
          if (customerName) updatePayload.customer_name = customerName;

          const { error } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', order.id);

          if (error) {
            setErrorMessage("Failed to notify waiter: " + error.message);
          }
        }

        // Broadcast cash alert to floor terminals & captain app with payer details
        if (restaurantId && tableNo) {
          try {
            const tableChannel = supabase.channel(`table_session_${restaurantId}_${encodeURIComponent(tableNo)}`);
            tableChannel.subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                tableChannel.send({
                  type: 'broadcast',
                  event: 'cash_payment_submitted',
                  payload: {
                    tableNo,
                    amount: grandTotal,
                    payerPhone: cleanPhone,
                    payerName: customerName || 'Table Guest',
                    alertStaffToTable: true,
                    timestamp: Date.now()
                  }
                });
                setTimeout(() => supabase.removeChannel(tableChannel), 1500);
              }
            });
          } catch {}
        }

        setView('CASH');
        setCashCalled(true);
      }
    } catch (e: any) {
      setErrorMessage("Error: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Staff-Assisted Tabletop Settle (Koi Resto-Bar flow): Request physical bill & EDC terminal to table
  const handleRequestBillToTable = async () => {
    if (isHeldByOtherGuest) return;
    if (onAcquireLock) {
      const acquired = await onAcquireLock('CASH');
      if (!acquired) {
        setErrorMessage(`${activePaymentLock?.payerName || 'Another diner'} is currently paying. Please wait.`);
        return;
      }
    }
    setIsProcessing(true);
    try {
      if (orders.length > 0) {
        const existingSessionId = orders.map(o => extractSessionId(o.note)).find(Boolean) || `sess_${orders[0].id}`;

        for (const order of orders) {
          const cleanExistingNote = (order.note || '')
            .replace(/\[SESSION:[^\]]+\]/gi, '')
            .replace(/\[(UPI VERIFICATION REQUESTED|CASH REQUESTED|BILL REQUESTED)[^\]]*\]/gi, '')
            .trim();
          const updatedNote = [
            `[SESSION:${existingSessionId}]`,
            `[BILL REQUESTED - ₹${grandTotal} - TABLE ${tableNo}]`,
            cleanExistingNote
          ].filter(Boolean).join(' ');

          const updatePayload: any = { 
            payment_method: 'STAFF_ASSISTED',
            payment_status: 'CASH_REQUESTED',
            note: updatedNote
          };
          if (cleanPhone) updatePayload.customer_phone = cleanPhone;
          if (customerName) updatePayload.customer_name = customerName;

          const { error } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', order.id);

          if (error) {
            setErrorMessage("Failed to request bill: " + error.message);
          }
        }

        // Broadcast alert to floor captain & table channel
        if (restaurantId && tableNo) {
          try {
            const cleanTable = (tableNo || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const normTable = cleanTable.replace(/^table0*([0-9]+)$/, 'table$1');
            const channelTargets = Array.from(new Set([
              `table_session_${restaurantId}_${cleanTable}`,
              `table_session_${restaurantId}_${normTable}`,
              `table_session_${restaurantId}_${encodeURIComponent(tableNo)}`,
              `captain_stream_${restaurantId}`
            ]));

            channelTargets.forEach(chName => {
              const tableChannel = supabase.channel(`bill_req_${chName}_${Date.now()}`);
              tableChannel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                  tableChannel.send({
                    type: 'broadcast',
                    event: 'cash_payment_submitted',
                    payload: {
                      tableNo,
                      amount: grandTotal,
                      payerPhone: cleanPhone,
                      payerName: customerName || 'Table Guest',
                      billingMode: 'STAFF_ASSISTED',
                      alertStaffToTable: true,
                      timestamp: Date.now()
                    }
                  });
                  setTimeout(() => supabase.removeChannel(tableChannel), 1500);
                }
              });
            });
          } catch {}
        }

        setView('CASH');
        setCashCalled(true);
      }
    } catch (e: any) {
      setErrorMessage("Error: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel bill request and resume dining / ordering
  const handleCancelBillRequest = async () => {
    setIsProcessing(true);
    try {
      if (orders.length > 0) {
        for (const order of orders) {
          const cleanExistingNote = (order.note || '')
            .replace(/\[SESSION:[^\]]+\]/gi, '')
            .replace(/\[(UPI VERIFICATION REQUESTED|CASH REQUESTED|BILL REQUESTED)[^\]]*\]/gi, '')
            .trim();
          const existingSessionId = extractSessionId(order.note) || `sess_${order.id}`;
          const updatedNote = [
            `[SESSION:${existingSessionId}]`,
            cleanExistingNote
          ].filter(Boolean).join(' ');

          await supabase
            .from('orders')
            .update({
              payment_status: 'PENDING',
              note: updatedNote
            })
            .eq('id', order.id);
        }
      }
      if (onReleaseLock) {
        await onReleaseLock();
      }
      setCashCalled(false);
      setView('BILL');
    } catch (err: any) {
      setErrorMessage("Failed to cancel bill request: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const [staffPinged, setStaffPinged] = useState(false);
  const handlePingStaff = async () => {
    setStaffPinged(true);
    if (restaurantId && tableNo) {
      try {
        const tableChannel = supabase.channel(`table_session_${restaurantId}_${encodeURIComponent(tableNo)}`);
        tableChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            tableChannel.send({
              type: 'broadcast',
              event: view === 'CASH' ? 'cash_payment_submitted' : 'upi_payment_submitted',
              payload: {
                tableNo,
                amount: grandTotal,
                alertStaffToTable: true,
                timestamp: Date.now()
              }
            });
            setTimeout(() => supabase.removeChannel(tableChannel), 1500);
          }
        });
      } catch {}
    }
    setTimeout(() => setStaffPinged(false), 5000);
  };

  // ─── STANDARD TABLETAPY MODAL (BILL VIEW, UPI QR VIEW & CASH WAITING) ─────────
  return (
    <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-200/80 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            {view !== 'BILL' && (
              <button 
                onClick={async () => {
                  if (onReleaseLock && (view === 'UPI' || view === 'CASH')) {
                    await onReleaseLock();
                  }
                  setView('BILL');
                }} 
                className="p-1 -ml-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Back to Bill Breakdown"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
                <Receipt size={16} className="text-zinc-600" />
                {view === 'UPI' ? `UPI Payment • ${tableNo}` : view === 'CASH' ? (billingMode === 'STAFF_ASSISTED' ? `Bill Requested • ${tableNo}` : `Cash Payment • ${tableNo}`) : `Table Bill • ${tableNo}`}
              </h3>
              <p className="text-[11.5px] text-zinc-400">
                {restaurantName || "TableTapy Restaurant"}
              </p>
            </div>
          </div>

          <button 
            onClick={async () => {
              if (onReleaseLock && (view === 'UPI' || view === 'CASH')) {
                await onReleaseLock();
              }
              setView('BILL');
              onClose();
            }} 
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* In-Modal Error Banner */}
        {errorMessage && (
          <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-[12px] rounded-xl flex items-center justify-between shrink-0 animate-in fade-in">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold ml-2 text-sm cursor-pointer">×</button>
          </div>
        )}

        {/* BODY CONTENT */}
        <div className="p-5 overflow-y-auto space-y-4 text-zinc-900 flex-1">
          
          {/* VIEW: RUNNING BILL BREAKDOWN */}
          {view === 'BILL' && (
            <>
              {/* Order Rounds List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-0.5">
                  <span>Order Rounds ({orders.length})</span>
                  <span>Kitchen Status</span>
                </div>

                {orders.map((order, orderIdx) => {
                  const groupedItems = getGroupedItems(order.items_json);
                  return (
                    <div 
                      key={order.id} 
                      className="p-3.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 space-y-2.5"
                    >
                      {/* Round Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-semibold text-zinc-900">
                            Round #{orderIdx + 1}
                          </span>
                          <span className="text-[11px] text-zinc-400 tabular-nums">
                            • {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          order.status === 'NEW' ? 'bg-[#E46254]/10 text-[#E46254] border border-[#E46254]/20' :
                          order.status === 'PREPARING' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                          order.status === 'SERVED' ? 'bg-sky-50 text-sky-700 border border-sky-200/60' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        }`}>
                          {order.status === 'NEW' && <span className="w-1.5 h-1.5 rounded-full bg-[#E46254]" />}
                          {order.status === 'PREPARING' && <ChefHat size={11} />}
                          {order.status === 'SERVED' && <UtensilsCrossed size={11} />}
                          {order.status === 'COMPLETED' && <CheckCircle2 size={11} />}
                          {order.status === 'NEW' ? 'Order Received' :
                           order.status === 'PREPARING' ? 'In Kitchen' :
                           order.status === 'SERVED' ? 'Served' : 'Ready'}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5">
                        {groupedItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[12.5px]">
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200/70 px-1.5 py-0.2 rounded tabular-nums shrink-0">
                                {item.count}×
                              </span>
                              <span className="text-zinc-800 font-medium truncate">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-zinc-600 font-normal tabular-nums text-[12px] shrink-0">
                              {formatCurrency(item.price * item.count)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TABLETAPY COINS REDEMPTION CHECKBOX (Zomato / Swiggy Style) */}
              {loyaltyActive && cleanPhone.length === 10 && (
                <div className="pt-1">
                  {userCoinsBalance > 0 ? (
                    <label className="flex items-center justify-between p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl cursor-pointer hover:bg-amber-100/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={redeemCoins}
                          onChange={e => setRedeemCoins(e.target.checked)}
                          className="w-4 h-4 rounded text-zinc-900 accent-amber-600 border-zinc-300 cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                            <Coins size={14} className="text-amber-600" />
                            Redeem {maxCoinsRedeemable} TableTapy Coins
                          </p>
                          <p className="text-[11px] text-zinc-600">
                            Available: {userCoinsBalance} Coins · 1 Coin = ₹1 (Max {maxCap} coins per bill)
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-emerald-700 tabular-nums">
                        -₹{maxCoinsRedeemable.toFixed(2)}
                      </span>
                    </label>
                  ) : (
                    coinsEarned > 0 ? (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl flex items-center justify-between text-xs text-emerald-950">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-amber-500 shrink-0" />
                          <span className="font-semibold">TableTapy Rewards</span>
                        </div>
                        <span className="font-bold text-emerald-700">+{coinsEarned} Coins will be earned!</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* Bill Totals Summary */}
              <div className="pt-2 border-t border-zinc-100 space-y-2 text-[13px]">
                <div className="flex justify-between text-zinc-500">
                  <span>Food & Beverage Subtotal</span>
                  <span className="tabular-nums font-medium text-zinc-800">{formatCurrency(subtotal)}</span>
                </div>

                {coinsDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>TableTapy Coins Redeemed ({maxCoinsRedeemable} coins)</span>
                    <span className="tabular-nums">-₹{coinsDiscount.toFixed(2)}</span>
                  </div>
                )}

                {serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-zinc-500">
                    <span>Service Charge ({serviceChargeRate}%)</span>
                    <span className="tabular-nums font-medium text-zinc-800">{formatCurrency(serviceChargeAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-zinc-500">
                  <span className="flex items-center gap-1">
                    GST / Taxes ({taxRate}%)
                  </span>
                  <span className="tabular-nums font-medium text-zinc-800">{formatCurrency(gstAmount)}</span>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-zinc-200/80 text-[16px] font-bold text-zinc-900">
                  <span>Grand Total</span>
                  <span className="tabular-nums text-[18px] text-zinc-950">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Settlement Options */}
              {isHeldByOtherGuest ? (
                <div className="pt-2">
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-left space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        <span className="text-[13px] font-bold text-amber-950">
                          Payment in Progress • Table {tableNo}
                        </span>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-800">
                        On Hold
                      </span>
                    </div>

                    <p className="text-[12.5px] text-amber-900/90 leading-relaxed">
                      <strong className="font-semibold text-amber-950">{activePaymentLock?.payerName || 'Another diner'}</strong> is currently paying the bill via <strong className="font-semibold text-amber-950">{activePaymentLock?.paymentMethod === 'CASH' ? 'Cash / Staff' : 'UPI'}</strong>.
                    </p>

                    <div className="pt-1 flex items-center gap-1.5 text-[11px] text-amber-800/80 font-medium">
                      <Clock size={13} className="shrink-0" />
                      <span>If they go back or cancel, the bill will unlock for you instantly.</span>
                    </div>
                  </div>
                </div>
              ) : billingMode === 'STAFF_ASSISTED' ? (
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleRequestBillToTable}
                    disabled={isProcessing}
                    className="w-full py-4 px-4 bg-[#E46254] hover:bg-[#c84d40] text-white rounded-2xl text-[14.5px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-md shadow-[#E46254]/20 cursor-pointer active:scale-[0.99] disabled:opacity-70"
                  >
                    <div className="flex items-center gap-2">
                      {isProcessing ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Receipt size={17} />
                      )}
                      <span>Request Bill to Table • {formatCurrency(grandTotal)}</span>
                    </div>
                    <span className="text-[11.5px] font-medium text-white/90">
                      Pay via UPI QR, Card Machine, or Cash with your captain
                    </span>
                  </button>
                </div>
              ) : (
                <div className="pt-2 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleSelectPayViaUpi}
                    disabled={isProcessing}
                    className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-black text-white rounded-2xl text-[13.5px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99] disabled:opacity-70"
                  >
                    {isProcessing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Smartphone size={16} />
                    )}
                    Pay Online via UPI • {formatCurrency(grandTotal)}
                  </button>

                  <button
                    type="button"
                    onClick={handleCallWaiterCash}
                    disabled={isProcessing}
                    className="w-full py-3 px-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 text-zinc-700 rounded-2xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-70"
                  >
                    <Banknote size={16} className="text-zinc-500" />
                    Pay by Cash • Call Waiter to Table
                  </button>
                </div>
              )}
            </>
          )}

          {/* VIEW: UPI CHECKOUT & LIVE VERIFICATION */}
          {view === 'UPI' && (
            <div className="flex flex-col items-center text-center space-y-4 py-1 animate-in fade-in duration-200">
              <div className="p-3.5 bg-white rounded-2xl border border-zinc-200 shadow-xs inline-block">
                <QRCode 
                  value={upiDeepLink} 
                  size={185} 
                  level="M"
                />
              </div>

              <div>
                <p className="text-[11.5px] font-bold text-zinc-400 uppercase tracking-wider">Scan QR or Pay Directly</p>
                <h4 className="text-[24px] font-black text-zinc-950 tabular-nums mt-0.5">
                  {formatCurrency(grandTotal)}
                </h4>
                <p className="text-[12px] text-zinc-500 mt-1">
                  Google Pay • PhonePe • Paytm • BHIM • Any Bank UPI
                </p>
              </div>

              {/* 1-Tap Pay Direct in UPI App with fixed bill amount pre-filled */}
              <div className="w-full space-y-1 pt-0.5">
                <button
                  type="button"
                  onClick={handlePayDirectlyViaUpiApp}
                  disabled={isProcessing}
                  className="w-full py-3.5 px-4 bg-[#E46254] hover:bg-[#c84d40] text-white rounded-2xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99] disabled:opacity-70"
                >
                  <Smartphone size={16} />
                  <span>Pay {formatCurrency(grandTotal)} on UPI App</span>
                </button>
                <p className="text-[11px] text-zinc-400 font-medium">
                  Pre-filled bill • No scan needed
                </p>
              </div>

              {/* Live Staff Alert & Verification Banner */}
              <div className="w-full p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-[12.5px] font-bold text-emerald-950">
                      Floor Captain Alerted to Table {tableNo}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    Live
                  </span>
                </div>
                <p className="text-[12px] text-emerald-900/80 leading-relaxed">
                  We've alerted floor staff to verify your payment at Table {tableNo}. Once paid on your UPI app, our captain will confirm and your receipt will appear immediately.
                </p>
              </div>

              {/* Action Controls */}
              <div className="w-full pt-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePingStaff}
                    disabled={staffPinged}
                    className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-98 text-zinc-800 border border-zinc-200 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Bell size={14} className={staffPinged ? 'text-emerald-600' : 'text-zinc-500'} />
                    <span>{staffPinged ? 'Captain Reminded!' : 'Remind Captain'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCallWaiterCash}
                    disabled={isProcessing}
                    className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-98 text-zinc-800 border border-zinc-200 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Banknote size={14} className="text-zinc-500" />
                    <span>Switch to Cash</span>
                  </button>
                </div>
              </div>

              <p className="text-[11.5px] text-zinc-400 font-medium flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>Keep this screen open · Receipt and stars unlock automatically</span>
              </p>
            </div>
          )}

          {/* VIEW: CASH CHECKOUT & WAITING / STAFF ASSISTED */}
          {view === 'CASH' && (
            <div className="flex flex-col items-center text-center space-y-4 py-2 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shadow-xs">
                {billingMode === 'STAFF_ASSISTED' ? (
                  <Receipt size={30} />
                ) : (
                  <Banknote size={30} />
                )}
              </div>

              <div>
                <h4 className="text-[17px] font-bold text-zinc-900 tracking-tight">
                  {billingMode === 'STAFF_ASSISTED' ? 'Bill Requested to Table' : 'Floor Captain Alerted for Cash Bill'}
                </h4>
                <h3 className="text-[26px] font-black text-zinc-950 tabular-nums mt-1">
                  {formatCurrency(grandTotal)}
                </h3>
                <p className="text-[12px] text-zinc-500 mt-1">
                  Total Payable at Table {tableNo}
                </p>
              </div>

              {/* Live Status Card */}
              <div className="w-full p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className="text-[12.5px] font-bold text-amber-950">
                      {billingMode === 'STAFF_ASSISTED'
                        ? 'Captain en route with bill & terminal'
                        : 'Captain en route with physical bill folder'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    Live
                  </span>
                </div>
                <p className="text-[12px] text-amber-900/80 leading-relaxed">
                  {billingMode === 'STAFF_ASSISTED'
                    ? `Our floor captain is heading to Table ${tableNo} with your bill folder and Paytm / EDC machine. You can pay via UPI QR, Card, or Cash.`
                    : `Our floor captain has been notified for Table ${tableNo}. We are arriving with your bill folder to collect ${formatCurrency(grandTotal)} in cash.`}
                </p>
              </div>

              {/* Action Controls */}
              <div className="w-full pt-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePingStaff}
                    disabled={staffPinged}
                    className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-98 text-zinc-800 border border-zinc-200 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Bell size={14} className={staffPinged ? 'text-emerald-600' : 'text-zinc-500'} />
                    <span>{staffPinged ? 'Captain Reminded!' : 'Remind Captain'}</span>
                  </button>

                  {billingMode === 'STAFF_ASSISTED' ? (
                    <button
                      type="button"
                      onClick={handleCancelBillRequest}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-98 text-zinc-800 border border-zinc-200 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <RotateCcw size={14} className="text-zinc-500" />
                      <span>Order More</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSelectPayViaUpi}
                      disabled={isProcessing}
                      className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:scale-98 text-zinc-800 border border-zinc-200 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <Smartphone size={14} className="text-zinc-500" />
                      <span>Switch to UPI</span>
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11.5px] text-zinc-400 font-medium flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>Keep this screen open · Your digital receipt unlocks once settled</span>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
