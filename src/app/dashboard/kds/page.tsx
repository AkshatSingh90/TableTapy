"use client";

import React, { useState, useEffect } from "react";
import { Maximize2, Minimize2, Volume2, VolumeX, Check, AlertOctagon, X, Trash2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

import { playNewOrderChime, playKitchenHoldUrgentAlert } from "@/utils/audioAlerts";
import { extractUserNote } from "@/utils/orderSession";

interface OrderItem {
  item: { id?: string; name: string; category?: string; isVeg?: boolean; notes?: string };
  price: number;
  quantity?: number;
  isReady?: boolean;
  ready_at?: string;
  notes?: string;
}

interface KitchenOrder {
  id: string;
  restaurant_id: string;
  table_no: string;
  status: 'NEW' | 'PREPARING' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  note?: string;
  items_json: OrderItem[];
  created_at: string;
  customer_name?: string;
}

interface KitchenCancellationAlert {
  id: string;
  tableName: string;
  itemName: string;
  quantity: number;
  cancelledAt: number;
  status: 'pending' | 'halted' | 'wasted';
}

interface WastageItem {
  id: string;
  tableName: string;
  itemName: string;
  quantity: number;
  timestamp: number;
}

export default function KitchenDisplayPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const ordersRef = React.useRef<KitchenOrder[]>([]);
  ordersRef.current = orders;

  const [recentlyBumped, setRecentlyBumped] = useState<KitchenOrder[]>([]);
  const [undoToastOrder, setUndoToastOrder] = useState<KitchenOrder | null>(null);
  const [undoTimer, setUndoTimer] = useState<any>(null);
  const [isRecallOpen, setIsRecallOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'FOOD' | 'DRINKS'>('ALL');
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Track selected dishes per ticket (set of dish names selected by chef)
  const [selectedDishesByOrder, setSelectedDishesByOrder] = useState<Record<string, string[]>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  // Expediter Ping Notification Toast on KDS
  const [expediteNotice, setExpediteNotice] = useState<string | null>(null);

  // Live mid-prep cancellation alerts & Kitchen Wastage tracking
  const [cancellationAlerts, setCancellationAlerts] = useState<KitchenCancellationAlert[]>([]);
  const [wastageLog, setWastageLog] = useState<WastageItem[]>([]);
  const [isWastageDrawerOpen, setIsWastageDrawerOpen] = useState(false);

  // Helper to deduplicate cancellation alerts and prevent duplicate cards on KDS
  const pushCancellationAlert = (tableName: string, itemName: string, quantity: number, cancelledAt = Date.now()) => {
    setCancellationAlerts(prev => {
      const normalize = (t: string, i: string) => {
        const cleanT = (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^table0*([0-9]+)$/, 'table$1');
        const cleanI = (i || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return `${cleanT}__${cleanI}`;
      };

      const targetKey = normalize(tableName, itemName);
      const existingIdx = prev.findIndex(a => {
        const key = normalize(a.tableName, a.itemName);
        return key === targetKey && (a.status === 'pending' || Math.abs(Date.now() - a.cancelledAt) < 30000);
      });

      if (existingIdx !== -1) {
        // Already exists in pending or was pushed in the last 30s. Update quantity if larger, but DO NOT create a second card!
        const existing = prev[existingIdx];
        if (quantity > existing.quantity) {
          const next = [...prev];
          next[existingIdx] = { ...existing, quantity };
          return next;
        }
        return prev;
      }

      const newAlert: KitchenCancellationAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tableName: tableName || 'Counter',
        itemName,
        quantity: quantity || 1,
        cancelledAt,
        status: 'pending'
      };
      return [newAlert, ...prev];
    });
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      setIsFullscreen(prev => !prev);
    }
  };

  // Initial fetch and Realtime listener
  useEffect(() => {
    let channel: any = null;

    const init = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const restId = user?.user_metadata?.restaurant_id;

      if (restId) {
        const { data: r } = await supabase.from('restaurants').select('name').eq('id', restId).single();
        if (r?.name) setRestaurantName(r.name);
      }

      if (!restId) {
        setLoading(false);
        return;
      }

      setRestaurantId(restId);

      // Fetch active kitchen orders - both 'NEW' (customer submitted) and 'PREPARING'
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restId)
        .in('status', ['NEW', 'PREPARING'])
        .order('created_at', { ascending: true });

      if (activeOrders) {
        setOrders(activeOrders as KitchenOrder[]);
      }

      // Fetch recently served tickets for Recall capability
      const { data: recentServed } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', restId)
        .eq('status', 'SERVED')
        .order('created_at', { ascending: false })
        .limit(15);

      if (recentServed) {
        setRecentlyBumped(recentServed as KitchenOrder[]);
      }

      setLoading(false);

      // Realtime subscription
      const channelName = `kds_stream_${restId}`;
      const existingCh = supabase.getChannels().find(c => c.topic === `realtime:${channelName}` || c.topic === channelName);
      if (existingCh) {
        await supabase.removeChannel(existingCh);
      }

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=eq.${restId}`
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              const newOrd = payload.new as KitchenOrder;
              // Kitchen KDS shows both NEW and PREPARING tickets
              if (newOrd.status === 'PREPARING' || newOrd.status === 'NEW') {
                setOrders(prev => {
                  if (prev.some(o => o.id === newOrd.id)) return prev;
                  const next = [...prev, newOrd];
                  ordersRef.current = next;
                  return next;
                });
                playNewOrderChime(soundEnabled);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedOrd = payload.new as KitchenOrder;
              const prevOrd = ordersRef.current.find(o => o.id === updatedOrd.id);

              if (updatedOrd.status === 'PREPARING' || updatedOrd.status === 'NEW') {
                // Check if items were modified or cancelled while cooking (mid-prep)
                if (prevOrd) {
                  const prevMap = new Map<string, number>();
                  (prevOrd.items_json || []).forEach(it => {
                    const name = it.item?.name || 'Dish Item';
                    prevMap.set(name, (prevMap.get(name) || 0) + (it.quantity || 1));
                  });

                  const nextMap = new Map<string, number>();
                  (updatedOrd.items_json || []).forEach(it => {
                    const name = it.item?.name || 'Dish Item';
                    nextMap.set(name, (nextMap.get(name) || 0) + (it.quantity || 1));
                  });

                  let hasHoldAlert = false;
                  // Detect item reductions or cancellations
                  prevMap.forEach((prevQty, name) => {
                    const nextQty = nextMap.get(name) || 0;
                    if (nextQty < prevQty) {
                      const dropped = prevQty - nextQty;
                      hasHoldAlert = true;
                      pushCancellationAlert(updatedOrd.table_no || 'Counter', name, dropped, Date.now());
                    }
                  });

                  let hasAddAlert = false;
                  // Detect additions
                  nextMap.forEach((nextQty, name) => {
                    const prevQty = prevMap.get(name) || 0;
                    if (nextQty > prevQty) {
                      hasAddAlert = true;
                      const added = nextQty - prevQty;
                      setExpediteNotice(`🔔 ADDED: +${added}× "${name}" on Table ${updatedOrd.table_no}. Prepare additional!`);
                      setTimeout(() => setExpediteNotice(null), 8000);
                    }
                  });

                  if (hasHoldAlert) {
                    playKitchenHoldUrgentAlert(soundEnabled);
                  } else if (hasAddAlert) {
                    playNewOrderChime(soundEnabled);
                  }
                }

                setOrders(prev => {
                  const idx = prev.findIndex(o => o.id === updatedOrd.id);
                  let next: KitchenOrder[];
                  if (idx !== -1) {
                    next = [...prev];
                    next[idx] = updatedOrd;
                  } else {
                    next = [...prev, updatedOrd];
                    playNewOrderChime(soundEnabled);
                  }
                  ordersRef.current = next;
                  return next;
                });
                setRecentlyBumped(prev => prev.filter(o => o.id !== updatedOrd.id));
              } else if (['SERVED', 'COMPLETED', 'CANCELLED'].includes(updatedOrd.status)) {
                // If entire ticket cancelled while preparing
                if (updatedOrd.status === 'CANCELLED' && prevOrd && prevOrd.status === 'PREPARING') {
                  (prevOrd.items_json || []).forEach(it => {
                    pushCancellationAlert(updatedOrd.table_no || 'Counter', it.item?.name || 'Dish Item', it.quantity || 1, Date.now());
                  });
                  playKitchenHoldUrgentAlert(soundEnabled);
                }

                setOrders(prev => {
                  const next = prev.filter(o => o.id !== updatedOrd.id);
                  ordersRef.current = next;
                  return next;
                });

                if (updatedOrd.status === 'SERVED') {
                  setRecentlyBumped(prev => {
                    const filtered = prev.filter(o => o.id !== updatedOrd.id);
                    return [updatedOrd, ...filtered].slice(0, 15);
                  });
                }
              } else {
                setOrders(prev => {
                  const next = prev.filter(o => o.id !== updatedOrd.id);
                  ordersRef.current = next;
                  return next;
                });
              }
            } else if (payload.eventType === 'DELETE') {
              setOrders(prev => {
                const next = prev.filter(o => o.id !== payload.old.id);
                ordersRef.current = next;
                return next;
              });
              setRecentlyBumped(prev => prev.filter(o => o.id !== payload.old.id));
            }
          }
        )
        .on('broadcast', { event: 'item_cancelled' }, ({ payload }: any) => {
          if (payload && payload.itemName) {
            pushCancellationAlert(payload.tableName || 'Counter', payload.itemName, payload.quantity || 1, payload.cancelledAt || Date.now());
            playKitchenHoldUrgentAlert(soundEnabled);
          }
        })
        .on('broadcast', { event: 'item_added' }, ({ payload }: any) => {
          if (payload && payload.itemName) {
            setExpediteNotice(`🔔 ADDED: +${payload.quantity || 1}× "${payload.itemName}" on Table ${payload.tableName}. Prepare additional!`);
            playNewOrderChime(soundEnabled);
            setTimeout(() => setExpediteNotice(null), 8000);
          }
        })
        .subscribe();

      // Auto-reconnect / sync when screen wakes up from sleep or tab regains focus
      const syncActiveKitchen = async () => {
        const { data: freshActive } = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restId)
          .in('status', ['NEW', 'PREPARING'])
          .order('created_at', { ascending: true });

        if (freshActive) {
          setOrders(freshActive as KitchenOrder[]);
          ordersRef.current = freshActive as KitchenOrder[];
        }
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          syncActiveKitchen();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleVisibilityChange);
      window.addEventListener('online', syncActiveKitchen);
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  // Mark order as ready/served with undo capability & trigger Waiter Expediter Ping
  const handleMarkReady = async (order: KitchenOrder) => {
    setActionLoadingId(order.id);
    try {
      // Set status to SERVED which notifies cashier / waiters on dashboard
      const { error } = await supabase.from('orders').update({ status: 'SERVED' }).eq('id', order.id);
      if (!error) {
        setOrders(prev => prev.filter(o => o.id !== order.id));
        setRecentlyBumped(prev => [order, ...prev.filter(o => o.id !== order.id)].slice(0, 15));

        // Trigger Expediter notification on screen
        setExpediteNotice(`Table ${order.table_no} Plated & Ready for Waiter Pickup`);
        setTimeout(() => setExpediteNotice(null), 5000);

        // Broadcast to guest table and waiter terminals immediately
        if (restaurantId && order.table_no) {
          try {
            const tableChannel = supabase.channel(`table_session_${restaurantId}_${encodeURIComponent(order.table_no)}`);
            tableChannel.subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                tableChannel.send({
                  type: 'broadcast',
                  event: 'food_ready',
                  payload: {
                    orderId: order.id,
                    tableName: order.table_no,
                    timestamp: Date.now()
                  }
                });
                setTimeout(() => supabase.removeChannel(tableChannel), 1000);
              }
            });
          } catch (bErr) {
            console.warn("Food ready broadcast notice:", bErr);
          }
        }

        // Trigger 10-second Undo banner
        if (undoTimer) clearTimeout(undoTimer);
        setUndoToastOrder(order);
        const timer = setTimeout(() => {
          setUndoToastOrder(null);
        }, 10000);
        setUndoTimer(timer);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark selected items as ready and notify expediter
  const handleMarkSelectedReady = (order: KitchenOrder, selectedItemNames: string[]) => {
    if (selectedItemNames.length === 0) return;
    setExpediteNotice(`Table ${order.table_no}: ${selectedItemNames.join(', ')} Ready!`);
    setTimeout(() => setExpediteNotice(null), 5000);
  };

  // Restore bumped order back to kitchen
  const handleRestoreOrder = async (order: KitchenOrder) => {
    setActionLoadingId(order.id);
    try {
      const { error } = await supabase.from('orders').update({ status: 'PREPARING' }).eq('id', order.id);
      if (!error) {
        setRecentlyBumped(prev => prev.filter(o => o.id !== order.id));
        setOrders(prev => {
          if (prev.some(o => o.id === order.id)) return prev;
          return [...prev, { ...order, status: 'PREPARING' }];
        });
        if (undoToastOrder?.id === order.id) {
          setUndoToastOrder(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle selection of a dish within a ticket for pickup
  const toggleSelectDish = (orderId: string, dishName: string) => {
    setSelectedDishesByOrder(prev => {
      const current = prev[orderId] || [];
      const exists = current.includes(dishName);
      const updated = exists ? current.filter(n => n !== dishName) : [...current, dishName];
      return { ...prev, [orderId]: updated };
    });
  };

  // Bump selected dishes as ready for pickup:
  // Removes the finished dishes from the active ticket while remaining dishes stay cooking in queue.
  // If ALL dishes are selected/finished, bumps the entire ticket to SERVED.
  const handleBumpSelectedDishes = async (order: KitchenOrder) => {
    const selected = selectedDishesByOrder[order.id] || [];
    if (selected.length === 0) return;

    setActionLoadingId(order.id);
    const rawItems: OrderItem[] = Array.isArray(order.items_json) ? order.items_json : [];
    
    // Check which unready items remain after this bump
    const stillUnreadyItems = rawItems.filter((i: OrderItem) => {
      const name = i?.item?.name || 'Dish Item';
      if (i.isReady) return false;
      return !selected.includes(name);
    });

    const isAllCompleted = stillUnreadyItems.length === 0;

    try {
      if (isAllCompleted) {
        // All items completed: mark all as ready and bump entire ticket to SERVED
        const allReadyItems: OrderItem[] = rawItems.map((i: OrderItem) => ({ ...i, isReady: true, ready_at: i.ready_at || new Date().toISOString() }));
        const { error } = await supabase
          .from('orders')
          .update({ status: 'SERVED', items_json: allReadyItems })
          .eq('id', order.id);

        if (!error) {
          setOrders(prev => prev.filter(o => o.id !== order.id));
          const bumpedOrder: KitchenOrder = { ...order, status: 'SERVED', items_json: allReadyItems };
          setRecentlyBumped(prev => [bumpedOrder, ...prev.filter(o => o.id !== order.id)].slice(0, 15));
          setSelectedDishesByOrder(prev => {
            const next = { ...prev };
            delete next[order.id];
            return next;
          });

          // Expediter announcement
          setExpediteNotice(`Table ${order.table_no}: All dishes ready for pickup!`);
          setTimeout(() => setExpediteNotice(null), 5000);

          // Undo support
          if (undoTimer) clearTimeout(undoTimer);
          setUndoToastOrder(order);
          const timer = setTimeout(() => setUndoToastOrder(null), 10000);
          setUndoTimer(timer);
        }
      } else {
        // Partial items completed: mark selected items as isReady: true in items_json so waiter sees exactly what is ready vs cooking
        const updatedItems: OrderItem[] = rawItems.map((i: OrderItem) => {
          const name = i?.item?.name || 'Dish Item';
          if (selected.includes(name)) {
            return { ...i, isReady: true, ready_at: new Date().toISOString() };
          }
          return i;
        });

        const { error } = await supabase
          .from('orders')
          .update({ items_json: updatedItems })
          .eq('id', order.id);

        if (!error) {
          // Optimistically update local orders
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, items_json: updatedItems } : o));
          // Clear selections for this order
          setSelectedDishesByOrder(prev => {
            const next = { ...prev };
            delete next[order.id];
            return next;
          });

          // Trigger Expediter notification
          setExpediteNotice(`Table ${order.table_no}: ${selected.join(', ')} Ready for Pickup!`);
          setTimeout(() => setExpediteNotice(null), 5000);

          // Broadcast to guest table and waiter terminals
          if (restaurantId && order.table_no) {
            try {
              const tableChannel = supabase.channel(`table_session_${restaurantId}_${encodeURIComponent(order.table_no)}`);
              tableChannel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                  tableChannel.send({
                    type: 'broadcast',
                    event: 'item_ready',
                    payload: {
                      orderId: order.id,
                      tableName: order.table_no,
                      readyItems: selected,
                      timestamp: Date.now()
                    }
                  });
                  setTimeout(() => supabase.removeChannel(tableChannel), 1000);
                }
              });
            } catch (bErr) {
              console.warn("Item ready broadcast notice:", bErr);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error bumping selected dishes:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Classify dish item into clean kitchen sections: STARTER, MAIN, DRINK / DESSERT
  const getDishCourse = (dish: { name: string; category?: string }): 'STARTERS' | 'MAINS' | 'DRINKS' | 'DESSERTS' => {
    const cat = (dish.category || '').toLowerCase();
    const name = (dish.name || '').toLowerCase();
    if (cat.includes('drink') || cat.includes('beverage') || cat.includes('cocktail') || cat.includes('mocktail') || cat.includes('shake') || cat.includes('juice') || cat.includes('tea') || cat.includes('coffee')) {
      return 'DRINKS';
    }
    if (cat.includes('dessert') || cat.includes('sweet') || name.includes('ice cream') || name.includes('cake') || name.includes('pastry') || name.includes('tiramisu') || name.includes('brownie')) {
      return 'DESSERTS';
    }
    if (cat.includes('starter') || cat.includes('appetizer') || cat.includes('soup') || cat.includes('salad') || cat.includes('snack') || name.includes('soup') || name.includes('tikka') || name.includes('fries') || name.includes('wing') || name.includes('roll') || name.includes('nacho') || name.includes('kebab') || name.includes('crispy')) {
      return 'STARTERS';
    }
    return 'MAINS';
  };

  // Group items by name with count and course classification (only shows dishes still cooking in kitchen)
  const getGroupedItems = (items: OrderItem[]) => {
    const map = new Map<string, { 
      name: string; 
      count: number; 
      category?: string; 
      course: 'STARTERS' | 'MAINS' | 'DRINKS' | 'DESSERTS';
      notes?: string;
    }>();
    
    (items || [])
      .filter(entry => !entry.isReady)
      .forEach(entry => {
        const name = entry?.item?.name || 'Dish Item';
        const cat = entry?.item?.category;
        const course = getDishCourse({ name, category: cat });
        const qty = entry.quantity || 1;
        const notes = entry.notes || (entry.item as any)?.notes;

        const existing = map.get(name);
        if (existing) {
          existing.count += qty;
          if (notes && !existing.notes) existing.notes = notes;
        } else {
          map.set(name, {
            name,
            count: qty,
            category: cat,
            course,
            notes,
          });
        }
      });
    return Array.from(map.values());
  };

  // Calculate Batch Prep Matrix: Aggregate all active dishes across the kitchen
  const batchPrepMatrix = React.useMemo(() => {
    const map = new Map<string, { name: string; count: number; tables: string[]; course: string }>();
    orders.forEach(order => {
      const grouped = getGroupedItems(order.items_json);
      grouped.forEach((dish) => {
        const existing = map.get(dish.name);
        if (existing) {
          existing.count += dish.count;
          if (!existing.tables.includes(order.table_no)) {
            existing.tables.push(order.table_no);
          }
        } else {
          map.set(dish.name, {
            name: dish.name,
            count: dish.count,
            tables: [order.table_no],
            course: dish.course
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [orders]);

  // Filter orders by food vs drinks
  const filteredOrders = orders.filter(ord => {
    if (filterType === 'ALL') return true;
    const items = ord.items_json || [];
    if (filterType === 'DRINKS') {
      return items.some(i => i.item?.category?.toLowerCase().includes('drink') || i.item?.category?.toLowerCase().includes('beverage'));
    }
    if (filterType === 'FOOD') {
      return items.some(i => !i.item?.category?.toLowerCase().includes('drink') && !i.item?.category?.toLowerCase().includes('beverage'));
    }
    return true;
  });

  return (
    <div className={`min-h-screen bg-white text-zinc-900 flex flex-col font-sans select-none ${isFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen' : ''}`}>
      
      {/* ── CLEAN TOP HEADER ── */}
      <header className="px-6 py-4 bg-white border-b border-zinc-100 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[18px] font-bold text-zinc-900 tracking-tight">Kitchen Orders</h1>
          {restaurantName && <p className="text-[11.5px] text-zinc-400 mt-0.5">{restaurantName}</p>}
        </div>

        {/* Station Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
          {(['ALL', 'FOOD', 'DRINKS'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                filterType === f 
                  ? 'bg-white text-[#E46254] shadow-xs' 
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {f === 'ALL' ? 'All Orders' : f === 'FOOD' ? 'Kitchen' : 'Bar & Drinks'}
            </button>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Kitchen Wastage Log Drawer Button */}
          {wastageLog.length > 0 && (
            <button
              onClick={() => setIsWastageDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 font-semibold text-[12px] transition-colors cursor-pointer"
              title="View Mid-Prep Kitchen Wastage Log"
            >
              <Trash2 size={13} className="text-red-500" />
              <span>Waste Log</span>
              <span className="bg-red-200/80 text-red-800 font-bold px-1.5 py-0.2 rounded-md text-[10px]">
                {wastageLog.length}
              </span>
            </button>
          )}

          {/* Recall / Recent Bumped Drawer Button */}
          <button
            onClick={() => setIsRecallOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200/90 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 font-medium text-[12.5px] transition-colors cursor-pointer"
            title="Recall Recently Bumped Tickets"
          >
            <span>Recall</span>
            {recentlyBumped.length > 0 && (
              <span className="bg-[#E46254]/10 text-[#E46254] font-bold px-1.5 py-0.2 rounded-md text-[10.5px]">
                {recentlyBumped.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setSoundEnabled(v => !v)}
            title={soundEnabled ? "Mute Bell" : "Enable Bell"}
            className="p-2.5 rounded-xl border border-zinc-200/90 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50 font-medium text-[12.5px] transition-colors cursor-pointer shadow-xs"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>
        </div>
      </header>

      {/* ── 10s FLOATING UNDO BANNER ── */}
      {undoToastOrder && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="bg-white text-zinc-900 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-zinc-200/90 text-[12.5px]">
            <span className="text-zinc-600">
              Marked <strong className="text-zinc-900">{undoToastOrder.table_no}</strong> as Plated
            </span>
            <button
              onClick={() => handleRestoreOrder(undoToastOrder)}
              className="px-2.5 py-1 bg-[#E46254]/10 hover:bg-[#E46254]/15 text-[#E46254] font-semibold text-[11.5px] rounded-lg transition-colors cursor-pointer border border-[#E46254]/20"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* ── INTERACTIVE MID-PREP CANCELLATION ALERTS BANNER ── */}
      {cancellationAlerts.filter(a => a.status === 'pending').length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-300/80 px-6 py-3 shrink-0 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon size={16} className="text-amber-600 animate-pulse" />
                <span className="text-[12.5px] font-bold text-amber-950 uppercase tracking-wide">
                  Mid-Prep Action Required ({cancellationAlerts.filter(a => a.status === 'pending').length})
                </span>
              </div>
              <span className="text-[11px] font-semibold text-amber-800">
                Dishes cancelled or modified by owner while ticket was active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {cancellationAlerts.filter(a => a.status === 'pending').map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white border border-amber-200/90 rounded-2xl p-3 shadow-xs flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-[14px] text-zinc-950">
                          Table {alert.tableName}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full">
                          Cancelled
                        </span>
                      </div>
                      <p className="text-[13px] font-bold text-zinc-900 mt-0.5">
                        {alert.quantity}× {alert.itemName}
                      </p>
                    </div>

                    <button
                      onClick={() => setCancellationAlerts(prev => prev.filter(a => a.id !== alert.id))}
                      className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                      title="Dismiss alert"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* The Chef's 2 Real-Life Options */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-zinc-100">
                    <button
                      onClick={() => {
                        // Scenario A: Halted prep in time, zero food waste
                        setCancellationAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'halted' } : a));
                        setExpediteNotice(`✅ Table ${alert.tableName}: Cancelled ${alert.itemName} halted. Zero food waste.`);
                        setTimeout(() => setExpediteNotice(null), 5000);
                      }}
                      className="py-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 active:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11.5px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>Halted (Saved)</span>
                    </button>

                    <button
                      onClick={() => {
                        // Scenario B: Already cooked/plated, log to kitchen wastage
                        const wastageEntry: WastageItem = {
                          id: `waste_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                          tableName: alert.tableName,
                          itemName: alert.itemName,
                          quantity: alert.quantity,
                          timestamp: Date.now()
                        };
                        setWastageLog(prev => [wastageEntry, ...prev]);
                        setCancellationAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'wasted' } : a));
                        setExpediteNotice(`🗑️ Table ${alert.tableName}: ${alert.quantity}× ${alert.itemName} logged to Kitchen Wastage.`);
                        setTimeout(() => setExpediteNotice(null), 5000);
                      }}
                      className="py-1.5 px-2.5 rounded-xl bg-red-50 hover:bg-red-100/80 active:bg-red-100 text-red-800 border border-red-200 text-[11.5px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} className="text-red-600" />
                      <span>Already Cooked (Waste)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── EXPEDITER WAITER PING TOAST ── */}
      {expediteNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="bg-white text-zinc-900 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-[12.5px] font-semibold border border-zinc-200">
            <span className="w-2 h-2 rounded-full bg-[#E46254] animate-pulse" />
            <span>{expediteNotice}</span>
          </div>
        </div>
      )}

      {/* ── BATCH PREP MATRIX BAR (Head-Chef Batch Cooking) ── */}
      {batchPrepMatrix.length > 0 && (
        <div className="bg-white border-b border-zinc-100 px-6 py-2.5 overflow-x-auto flex items-center gap-2.5 slim-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E46254] shrink-0" />
            <span>Cooking Now ({batchPrepMatrix.reduce((s, x) => s + x.count, 0)})</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {batchPrepMatrix.map((item, idx) => (
              <div
                key={idx}
                className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-2xs hover:border-[#E46254]/30 transition-colors"
              >
                <span className="text-[12px] font-extrabold text-[#E46254] bg-[#E46254]/10 px-1.5 py-0.2 rounded-md tabular-nums">
                  {item.count}×
                </span>
                <span className="text-[12.5px] font-semibold text-zinc-800">
                  {item.name}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  ({item.tables.join(', ')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TICKETS GRID ── */}
      <main className="flex-1 p-6 overflow-y-auto slim-scrollbar bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-400 text-[13px]">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[55vh] text-center border border-dashed border-zinc-200 rounded-2xl p-8 max-w-sm mx-auto">
            <h3 className="text-[14px] font-semibold text-zinc-700">No active kitchen orders</h3>
            <p className="text-[12px] text-zinc-400 mt-1">
              New orders sent to the kitchen will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start">
            {filteredOrders.map(order => {
              const grouped = getGroupedItems(order.items_json);
              const starters = grouped.filter(g => g.course === 'STARTERS');
              const mains = grouped.filter(g => g.course === 'MAINS');
              const drinksAndDesserts = grouped.filter(g => g.course === 'DRINKS' || g.course === 'DESSERTS');

              // Selected dishes for this order
              const selectedDishes = selectedDishesByOrder[order.id] || [];
              const hasSelection = selectedDishes.length > 0;
              const isAllSelected = grouped.length > 0 && selectedDishes.length === grouped.length;

              // Render individual dish row
              const renderDishRow = (dish: typeof grouped[0]) => {
                const isSelected = selectedDishes.includes(dish.name);
                return (
                  <button
                    key={dish.name}
                    type="button"
                    onClick={() => toggleSelectDish(order.id, dish.name)}
                    className={`w-full p-2.5 rounded-xl transition-all border flex items-center justify-between gap-2.5 text-left cursor-pointer active:scale-[0.99] ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-300 shadow-xs ring-1 ring-emerald-400/30'
                        : 'bg-white border-zinc-200/90 hover:border-zinc-300 shadow-2xs hover:bg-zinc-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Quantity Badge */}
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[12px] tabular-nums shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-zinc-100 text-zinc-800'
                      }`}>
                        {dish.count}×
                      </span>

                      {/* Dish Name & Cooking Note */}
                      <div className="min-w-0">
                        <p className={`text-[13px] font-semibold truncate transition-colors ${
                          isSelected ? 'text-emerald-950 font-bold' : 'text-zinc-800'
                        }`}>
                          {dish.name}
                        </p>
                        {dish.notes && (
                          <span className="inline-block px-1.5 py-0.5 text-[10.5px] font-bold text-amber-900 bg-amber-100 rounded border border-amber-300 mt-0.5">
                            ⚡ {dish.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Touch Selection Indicator */}
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                        : 'border-zinc-300 bg-zinc-50/50'
                    }`}>
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </div>
                  </button>
                );
              };

              const activeTableHold = cancellationAlerts.find(a => {
                const normA = (a.tableName || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^table0*([0-9]+)$/, 'table$1');
                const normB = (order.table_no || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^table0*([0-9]+)$/, 'table$1');
                return normA === normB && a.status === 'pending';
              });

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                    activeTableHold
                      ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-[0_4px_20px_rgba(245,158,11,0.15)] bg-amber-50/10'
                      : 'border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-zinc-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className={`p-4 border-b flex items-start justify-between ${
                    activeTableHold ? 'bg-amber-100/40 border-amber-200' : 'bg-zinc-50/50 border-zinc-100'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[17px] font-bold text-zinc-900 tracking-tight">
                          {order.table_no}
                        </h3>
                        {activeTableHold ? (
                          <span className="flex items-center gap-1 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                            <AlertOctagon size={11} />
                            HOLD / MODIFIED
                          </span>
                        ) : order.status === 'NEW' ? (
                          <span className="flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            NEW
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-zinc-400">
                            #{order.id.slice(0, 4).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {order.customer_name && (
                        <p className="text-[11.5px] text-zinc-500 mt-0.5">
                          Guest: {order.customer_name}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums border bg-zinc-100 text-zinc-700 border-zinc-200/60">
                        {grouped.length} {grouped.length === 1 ? 'Dish' : 'Dishes'}
                      </span>
                    </div>
                  </div>

                  {/* Active Kitchen Hold Banner on Ticket */}
                  {activeTableHold && (
                    <div className="mx-3.5 mt-2.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-300 text-amber-950 text-[11.5px] font-bold flex items-center justify-between gap-2 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertOctagon size={14} className="text-amber-600 shrink-0 animate-bounce" />
                        <span className="truncate">STOP PREP: {activeTableHold.quantity}× "{activeTableHold.itemName}" cancelled!</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCancellationAlerts(prev => prev.map(a => a.id === activeTableHold.id ? { ...a, status: 'halted' } : a))}
                        className="px-2 py-0.5 bg-white border border-amber-300 hover:bg-amber-50 rounded-lg text-amber-900 font-extrabold text-[10.5px] shrink-0 cursor-pointer shadow-2xs"
                      >
                        Acknowledge
                      </button>
                    </div>
                  )}

                  {/* Customer Cooking Instructions Note */}
                  {(() => {
                    const cleanNote = extractUserNote(order.note);
                    if (!cleanNote) return null;
                    return (
                      <div className="mx-4 mt-2.5 px-3 py-1.5 rounded-xl bg-[#E46254]/6 border border-[#E46254]/20 text-[#E46254] text-[11.5px] font-medium">
                        Note: {cleanNote}
                      </div>
                    );
                  })()}

                  {/* Clean Dish List with Course Organization */}
                  <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[380px] slim-scrollbar">
                    
                    {/* 1. STARTERS */}
                    {starters.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Starters
                          </span>
                        </div>
                        {starters.map(dish => renderDishRow(dish))}
                      </div>
                    )}

                    {/* 2. MAIN COURSES */}
                    {mains.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Main Course
                          </span>
                        </div>
                        {mains.map(dish => renderDishRow(dish))}
                      </div>
                    )}

                    {/* 3. DRINKS & DESSERTS */}
                    {drinksAndDesserts.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                            Drinks & Desserts
                          </span>
                        </div>
                        {drinksAndDesserts.map(dish => renderDishRow(dish))}
                      </div>
                    )}
                  </div>

                  {/* Action Button: transforms dynamically based on chef's selection */}
                  <div className="p-3.5 pt-2 border-t border-zinc-100 bg-white">
                    {hasSelection ? (
                      <button
                        disabled={actionLoadingId === order.id}
                        onClick={() => handleBumpSelectedDishes(order)}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check size={14} strokeWidth={3} />
                        <span>
                          {isAllSelected 
                            ? 'Ready for Pickup (All Dishes)' 
                            : `Ready for Pickup (${selectedDishes.length} ${selectedDishes.length === 1 ? 'Dish' : 'Dishes'})`
                          }
                        </span>
                      </button>
                    ) : (
                      <button
                        disabled={actionLoadingId === order.id}
                        onClick={() => handleMarkReady(order)}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 bg-[#E46254]/10 hover:bg-[#E46254]/15 text-[#E46254] border border-[#E46254]/25"
                      >
                        <span>Bump Entire Ticket</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── RECALL / RECENTLY BUMPED DRAWER ── */}
      {isRecallOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/20 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl border-l border-zinc-200 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-zinc-900">Recently Bumped</h2>
                <p className="text-[11.5px] text-zinc-400 mt-0.5">Tickets marked as Ready</p>
              </div>
              <button
                onClick={() => setIsRecallOpen(false)}
                className="px-2.5 py-1 text-[12px] text-zinc-500 hover:text-zinc-800 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 slim-scrollbar">
              {recentlyBumped.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-[12.5px]">
                  No recently bumped orders.
                </div>
              ) : (
                recentlyBumped.map(item => {
                  const grouped = getGroupedItems(item.items_json);
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 text-[14px]">{item.table_no}</span>
                        <span className="text-[11px] text-zinc-400">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-[12px] text-zinc-600 space-y-0.5">
                        {grouped.map((g, idx) => (
                          <div key={idx}>
                            {g.count}× {g.name}
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => handleRestoreOrder(item)}
                        className="mt-1 w-full py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-[11.5px] font-medium transition-colors cursor-pointer"
                      >
                        Restore to Kitchen
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KITCHEN WASTAGE LOG DRAWER ── */}
      {isWastageDrawerOpen && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/20 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl border-l border-zinc-200 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Trash2 size={16} className="text-red-500" />
                  <h2 className="text-[15px] font-bold text-zinc-900">Kitchen Wastage Log</h2>
                </div>
                <p className="text-[11.5px] text-zinc-400 mt-0.5">Dishes cancelled mid-prep that were already cooked</p>
              </div>
              <button
                onClick={() => setIsWastageDrawerOpen(false)}
                className="px-2.5 py-1 text-[12px] text-zinc-500 hover:text-zinc-800 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 slim-scrollbar">
              {wastageLog.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-[12.5px]">
                  No wastage logged today.
                </div>
              ) : (
                wastageLog.map(item => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-red-200 bg-red-50/30 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 text-[13.5px]">Table {item.tableName}</span>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-[13px] font-semibold text-red-900">
                      {item.quantity}× {item.itemName}
                    </div>

                    <p className="text-[11px] text-zinc-500 italic mt-0.5">
                      Reason: Customer cancelled after cooking commenced.
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
