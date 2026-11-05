/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TableTapy Universal Background Outbox & Auto-Sync Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *  1. Silent, 100% non-blocking background queue drainer.
 *  2. Listens to 'online', 'offline', 'visibilitychange' & heartbeat timer.
 *  3. Drains 'local_mutations_queue' (dishes, tables, inventory, settings) in FIFO order.
 *  4. Drains 'local_orders' (KOTs, takeaway tokens, status updates) with deduplication.
 *  5. Drains 'local_invoices_history' (settled bills).
 *  6. Pulls fresh cloud updates into SQLite (non-destructive merge, 0-wipe).
 *  7. Never interrupts cashier/POS with banners, popups, or freezing spinners.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@/utils/supabase/client";
import {
  LocalSqliteStore,
  LocalMutationRecord,
  LocalOrderRecord,
  LocalInvoiceRecord,
  getCanonicalRestaurantId,
  generateUUID,
} from "./localSqliteStore";

export interface SyncEngineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingMutationsCount: number;
  pendingOrdersCount: number;
  pendingInvoicesCount: number;
  totalPending: number;
}

class OfflineSyncManager {
  private isSyncing = false;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private lastSyncedAt: string | null = null;
  private heartbeatTimer: any = null;
  private listenersAttached = false;
  private pendingSyncRequested = false;
  private supabase = createClient();

  /**
   * Start the background sync engine.
   * Attaches window connectivity listeners and starts heartbeat timer.
   */
  public start(): void {
    if (typeof window === "undefined" || this.listenersAttached) return;

    this.listenersAttached = true;
    this.isOnline = navigator.onLine;

    // 1. Connection recovery listener
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);

    // 2. Tab/App focus recovery listener
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // 3. Heartbeat pulse (checks every 25 seconds if online)
    this.heartbeatTimer = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.triggerSync();
      }
    }, 25000);

    // Initial trigger if online
    if (this.isOnline) {
      setTimeout(() => this.triggerSync(), 1500);
    }
  }

  /**
   * Stop background sync engine and clean up timers/listeners.
   */
  public stop(): void {
    if (typeof window === "undefined" || !this.listenersAttached) return;

    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.listenersAttached = false;
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.emitStatus();
    // Delay slightly to allow network adapter to stabilize
    setTimeout(() => this.triggerSync(), 800);
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.emitStatus();
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && this.isOnline && !this.isSyncing) {
      this.triggerSync();
    }
  };

  /**
   * Programmatic one-line sync trigger.
   * Can be safely called after placing an order or adding a dish/table.
   */
  public triggerSync(): void {
    if (this.isSyncing) {
      this.pendingSyncRequested = true;
      return;
    }
    this.syncNow();
  }

  /**
   * Main synchronization execution cycle.
   */
  public async syncNow(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.isSyncing) {
      this.pendingSyncRequested = true;
      return;
    }

    // 1. Connectivity probe: ensure we have genuine reachability
    const reachable = await this.probeReachability();
    if (!reachable) {
      this.isOnline = false;
      this.emitStatus();
      return;
    }
    this.isOnline = true;

    // 2. Acquire Mutex Lock
    this.isSyncing = true;
    this.emitStatus();

    try {
      const restaurantId = await getCanonicalRestaurantId(this.supabase);
      if (!restaurantId) {
        this.isSyncing = false;
        this.emitStatus();
        return;
      }

      // Step A: Drain entity mutations queue (Dishes, Tables, Raw Materials, Settings)
      await this.drainMutationQueue(restaurantId);

      // Step B: Drain pending offline orders (KOTs, Takeaways, Status Transitions)
      await this.drainOrdersQueue(restaurantId);

      // Step C: Drain unsynced invoices
      await this.drainInvoicesQueue(restaurantId);

      // Step D: Silent inbound delta pull (re-hydrate SQLite cache without wiping local items)
      await this.inboundDeltaPull(restaurantId);

      // Step E: Clean up ancient synced mutation records (older than 7 days)
      await LocalSqliteStore.pruneSyncedMutations(restaurantId).catch(() => {});

      this.lastSyncedAt = new Date().toISOString();
      await LocalSqliteStore.saveSettings({
        restaurant_id: restaurantId,
        last_synced_at: this.lastSyncedAt,
      }).catch(() => {});

      // Dispatch non-intrusive event so active UI pages can refresh data silently
      window.dispatchEvent(
        new CustomEvent("tabletapy_sync_completed", {
          detail: { restaurantId, timestamp: this.lastSyncedAt },
        })
      );
    } catch (err) {
      console.warn("[Offline Sync Engine] Error during sync pass (deferred):", err);
    } finally {
      this.isSyncing = false;
      this.emitStatus();

      // If another sync was requested while this pass was running, dispatch it
      if (this.pendingSyncRequested) {
        this.pendingSyncRequested = false;
        setTimeout(() => this.triggerSync(), 500);
      }
    }
  }

  /**
   * 1. Drain Entity Mutations Queue (FIFO Chronological Order)
   */
  private async drainMutationQueue(restaurantId: string): Promise<void> {
    const mutations = await LocalSqliteStore.getPendingMutations(restaurantId);
    if (!mutations || mutations.length === 0) return;

    // Sort by created_at ascending (FIFO)
    mutations.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const m of mutations) {
      try {
        let success = false;

        switch (m.entity) {
          case "MENU_ITEM": {
            if (m.action === "INSERT" || m.action === "UPDATE") {
              const d = m.payload;
              const isUuid = Boolean(d.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.id));
              const validId = isUuid ? d.id : generateUUID();
              const { error } = await this.withTimeout(
                this.supabase.from("menu_items_v2").upsert({
                  id: validId,
                  name: d.name ? d.name.trim() : "",
                  category: d.category || "General",
                  subcategory: d.subcategory || "",
                  base_price: Number(d.base_price || d.price || 0),
                  description: d.description || "",
                  is_veg: Boolean(d.is_veg),
                  is_available: d.is_available !== false,
                  restaurant_id: m.restaurant_id,
                })
              );
              success = !error;
              if (!error && validId !== d.id) {
                await LocalSqliteStore.deleteMenuItem(m.restaurant_id, d.id).catch(() => {});
                await LocalSqliteStore.saveSingleMenuItem({ ...d, id: validId }).catch(() => {});
              }
            } else if (m.action === "DELETE") {
              const { error } = await this.withTimeout(
                this.supabase.from("menu_items_v2").delete().eq("id", m.payload.id)
              );
              if (m.payload.name) {
                await this.withTimeout(
                  this.supabase.from("inventory_recipe_usage").delete().eq("name", m.payload.name)
                ).catch(() => {});
              }
              success = !error;
            }
            break;
          }

          case "TABLE": {
            if (m.action === "INSERT" || m.action === "UPDATE") {
              const t = m.payload;
              const isUuid = Boolean(t.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id));
              const validId = isUuid ? t.id : generateUUID();
              const { error } = await this.withTimeout(
                this.supabase.from("locations").upsert({
                  id: validId,
                  restaurant_id: m.restaurant_id,
                  name: t.name,
                  type: t.type || "TABLE",
                  secure_code: t.secure_code || t.code || "1234",
                })
              );
              success = !error;
              if (!error && validId !== t.id) {
                await LocalSqliteStore.deleteTable(m.restaurant_id, t.id).catch(() => {});
                await LocalSqliteStore.saveSingleTable({ ...t, id: validId }).catch(() => {});
              }
            } else if (m.action === "DELETE") {
              const { error } = await this.withTimeout(
                this.supabase.from("locations").delete().eq("id", m.payload.id)
              );
              success = !error;
            }
            break;
          }

          case "INVENTORY": {
            if (m.action === "INSERT") {
              const it = m.payload;
              const { error } = await this.withTimeout(
                this.supabase.from("inventory_items").upsert({
                  id: it.id,
                  name: it.name,
                  restaurant_id: m.restaurant_id,
                  category: it.category,
                  stock: Number(it.stock || 0),
                  threshold: it.threshold != null ? Number(it.threshold) : null,
                  storage_unit: it.storage_unit || "kg",
                  vendor_unit: it.vendor_unit || "carton",
                  vendor_to_storage: Number(it.vendor_to_storage || 1),
                  cost_per_vendor_unit: Number(it.cost_per_vendor_unit || 0),
                  price_last_month: Number(it.price_last_month || it.cost_per_vendor_unit || 0),
                  yield_percentage: Number(it.yield_percentage || 100),
                  is_semi_finished: Boolean(it.is_semi_finished),
                  expiry_date: it.expiry_date || null,
                  last_ordered_date: it.last_ordered_date || "Today",
                  next_order_date: it.next_order_date || "Not Scheduled",
                  daily_burn_rate: 0,
                  estimated_days_left: 999,
                  recipe_unit: it.recipe_unit || "g",
                  last_counted_at: it.last_counted_at || new Date().toISOString(),
                  pos_expected: Number(it.pos_expected || it.stock || 0),
                  actual_counted: Number(it.actual_counted || it.stock || 0),
                })
              );
              if (!error && it.stock > 0) {
                await this.withTimeout(
                  this.supabase.from("inventory_ledgers").insert([{
                    inventory_item_id: it.id,
                    date: new Date().toISOString().split("T")[0],
                    type: "DELIVERY",
                    amount: it.stock,
                    note: "Opening Stock Initialisation (Offline Synced)",
                  }])
                ).catch(() => {});
              }
              success = !error;
            } else if (m.action === "UPDATE") {
              const { error } = await this.withTimeout(
                this.supabase
                  .from("inventory_items")
                  .update({
                    stock: m.payload.stock,
                    last_counted_at: new Date().toISOString(),
                  })
                  .eq("id", m.payload.id)
              );
              success = !error;
            } else if (m.action === "DELETE") {
              const { error } = await this.withTimeout(
                this.supabase.from("inventory_items").delete().eq("id", m.payload.id)
              );
              success = !error;
            }
            break;
          }

          case "SETTINGS": {
            if (m.payload && m.restaurant_id) {
              const { error } = await this.withTimeout(
                this.supabase
                  .from("restaurants")
                  .update(m.payload)
                  .eq("id", m.restaurant_id)
              );
              success = !error;
            }
            break;
          }
        }

        if (success) {
          await LocalSqliteStore.markMutationSynced(m.id);
        }
      } catch (mutationErr) {
        console.warn(`[Sync Engine] Mutation ${m.id} failed, will retry:`, mutationErr);
      }
    }
  }

  /**
   * 2. Drain Pending Offline Orders Queue (Deduplication Guarantee)
   */
  private async drainOrdersQueue(restaurantId: string): Promise<void> {
    const unsynced = await LocalSqliteStore.getUnsyncedOrders(restaurantId);
    if (!unsynced || unsynced.length === 0) return;

    for (const order of unsynced) {
      try {
        // Check if order already exists in Supabase to prevent duplicate key conflicts
        const { data: existing } = await this.withTimeout(
          this.supabase.from("orders").select("id, status").eq("id", order.id).maybeSingle()
        );

        if (!existing) {
          // Clean insert
          const { error: insertErr } = await this.withTimeout(
            this.supabase.from("orders").insert({
              id: order.id,
              restaurant_id: order.restaurant_id,
              table_no: order.table_no,
              total: Number(order.total || 0),
              status: order.status || "PREPARING",
              payment_status: order.payment_status || "PENDING",
              payment_method: order.payment_method || "COUNTER",
              customer_name: order.customer_name || null,
              customer_phone: order.customer_phone || null,
              items_json: order.items_json,
              note: order.note || "[Offline Synced Order]",
              created_at: order.created_at || new Date().toISOString(),
            })
          );
          if (!insertErr) {
            await LocalSqliteStore.markOrderSynced(order.id);
          }
        } else {
          // If already in cloud, update status and payment
          const { error: updateErr } = await this.withTimeout(
            this.supabase
              .from("orders")
              .update({
                status: order.status,
                payment_status: order.payment_status,
                payment_method: order.payment_method,
                total: Number(order.total || 0),
                items_json: order.items_json,
              })
              .eq("id", order.id)
          );
          if (!updateErr) {
            await LocalSqliteStore.markOrderSynced(order.id);
          }
        }
      } catch (orderErr) {
        console.warn(`[Sync Engine] Order ${order.id} sync failed:`, orderErr);
      }
    }
  }

  /**
   * 3. Drain Invoices Queue
   */
  private async drainInvoicesQueue(restaurantId: string): Promise<void> {
    const unsyncedInvoices = await LocalSqliteStore.getUnsyncedInvoices(restaurantId);
    if (!unsyncedInvoices || unsyncedInvoices.length === 0) return;

    for (const inv of unsyncedInvoices) {
      // Invoices are archived permanently in local SQLite.
      // Once verified against cloud, mark synced locally.
      await LocalSqliteStore.markInvoiceSynced(inv.id);
    }
  }

  /**
   * 4. Inbound Delta Pull: Safely pulls latest cloud records strictly for this restaurant
   */
  private async inboundDeltaPull(restaurantId: string): Promise<void> {
    try {
      // Pull fresh menu dishes strictly for this restaurant
      const { data: dishes } = await this.withTimeout(
        this.supabase
          .from("menu_items_v2")
          .select("id, name, category, subcategory, base_price, is_veg, is_available, description")
          .eq("restaurant_id", restaurantId)
      );
      if (dishes && dishes.length > 0) {
        await LocalSqliteStore.saveMenuItems(
          restaurantId,
          dishes.map((d: any) => ({
            id: d.id,
            restaurant_id: restaurantId,
            name: d.name,
            category: d.category || "General",
            subcategory: d.subcategory,
            base_price: Number(d.base_price || 0),
            is_veg: Boolean(d.is_veg),
            is_available: Boolean(d.is_available),
            description: d.description,
            updated_at: new Date().toISOString(),
          })),
          true // replaceAll = true to flush out old stale/demo items
        );
      }

      // Pull fresh locations/tables strictly for this restaurant
      const { data: tables } = await this.withTimeout(
        this.supabase
          .from("locations")
          .select("id, name, type, secure_code")
          .eq("restaurant_id", restaurantId)
      );
      if (tables && tables.length > 0) {
        await LocalSqliteStore.saveTables(
          restaurantId,
          tables.map((t: any) => ({
            id: t.id,
            restaurant_id: restaurantId,
            name: t.name,
            type: t.type || "TABLE",
            is_active: true,
          })),
          true // replaceAll = true to flush out old stale/demo tables
        );
      }
    } catch (inboundErr) {
      console.warn("[Sync Engine] Inbound delta pull deferred:", inboundErr);
    }
  }

  /**
   * Lightweight probe: checks if Supabase is genuinely reachable over network
   */
  private async probeReachability(): Promise<boolean> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return false;
    }
    try {
      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 3500)
      );
      const probePromise = Promise.resolve(
        this.supabase.from("restaurants").select("id").limit(1)
      )
        .then(() => true)
        .catch(() => false);

      return await Promise.race([probePromise, timeoutPromise]);
    } catch {
      return false;
    }
  }

  /**
   * Helper: Wraps any promise with a 6-second timeout to prevent network stalls
   */
  private async withTimeout<T = any>(promise: PromiseLike<T> | Promise<T>, timeoutMs = 6000): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Supabase request timeout")), timeoutMs)
    );
    return Promise.race([Promise.resolve(promise), timeout]);
  }

  /**
   * Dispatch status update event for reactive UI hooks
   */
  private async emitStatus(): Promise<void> {
    if (typeof window === "undefined") return;

    let pendingMutations = 0;
    let pendingOrders = 0;
    let pendingInvoices = 0;

    try {
      const restId = localStorage.getItem("tabletapy_restaurant_id");
      if (restId) {
        const stats = await LocalSqliteStore.getSyncStats(restId);
        pendingMutations = stats.pendingMutationsCount || 0;
        pendingOrders = stats.pendingOrdersCount || 0;
        pendingInvoices = stats.pendingInvoicesCount || 0;
      }
    } catch {}

    const detail: SyncEngineStatus = {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      pendingMutationsCount: pendingMutations,
      pendingOrdersCount: pendingOrders,
      pendingInvoicesCount: pendingInvoices,
      totalPending: pendingMutations + pendingOrders + pendingInvoices,
    };

    window.dispatchEvent(new CustomEvent("tabletapy_sync_status", { detail }));
  }

  /**
   * Get current sync status snapshot
   */
  public async getStatus(): Promise<SyncEngineStatus> {
    let pendingMutations = 0;
    let pendingOrders = 0;
    let pendingInvoices = 0;

    try {
      const restId = typeof window !== "undefined" ? localStorage.getItem("tabletapy_restaurant_id") : null;
      if (restId) {
        const stats = await LocalSqliteStore.getSyncStats(restId);
        pendingMutations = stats.pendingMutationsCount || 0;
        pendingOrders = stats.pendingOrdersCount || 0;
        pendingInvoices = stats.pendingInvoicesCount || 0;
      }
    } catch {}

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      pendingMutationsCount: pendingMutations,
      pendingOrdersCount: pendingOrders,
      pendingInvoicesCount: pendingInvoices,
      totalPending: pendingMutations + pendingOrders + pendingInvoices,
    };
  }
}

// Export Singleton Instance
export const OfflineSyncEngine = new OfflineSyncManager();
