/**
 * Cross-Tab and In-App Synchronization Bus for TableTapy
 * 
 * Enables 0ms instant coordination across browser tabs & pages:
 * When owner updates Menu or Floor Plan in /dashboard/menu or /dashboard/locations:
 * 1. Broadcasts to other open tabs (e.g. POS terminal) via BroadcastChannel.
 * 2. Emits window CustomEvent for the local window.
 * 3. Bumps local version timestamp so other tabs read from local storage without hitting Supabase.
 */

export type SyncEventType = "MENU_UPDATED" | "LOCATIONS_UPDATED" | "SETTINGS_UPDATED";

export interface SyncMessage {
  type: SyncEventType;
  restaurantId: string;
  timestamp: string;
  payload?: any;
}

const CHANNEL_NAME = "tabletapy_sync_bus";

let channel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {}
}

export const SyncBus = {
  emit(type: SyncEventType, restaurantId: string, payload?: any) {
    if (typeof window === "undefined" || !restaurantId) return;

    const message: SyncMessage = {
      type,
      restaurantId,
      timestamp: new Date().toISOString(),
      payload,
    };

    // 1. Post to other open browser tabs
    if (channel) {
      try {
        channel.postMessage(message);
      } catch {}
    }

    // 2. Dispatch in current window
    try {
      window.dispatchEvent(new CustomEvent("tabletapy_sync_bus", { detail: message }));
      // Also fire legacy event names for backwards compatibility
      if (type === "MENU_UPDATED") {
        window.dispatchEvent(new CustomEvent("tabletapy_menu_updated", { detail: message }));
      } else if (type === "LOCATIONS_UPDATED") {
        window.dispatchEvent(new CustomEvent("tabletapy_locations_updated", { detail: message }));
      } else if (type === "SETTINGS_UPDATED") {
        window.dispatchEvent(new CustomEvent("tabletapy_config_updated", { detail: message }));
      }
    } catch {}

    // 3. Persist latest local timestamp
    try {
      localStorage.setItem(`tabletapy_v_${type.toLowerCase()}_${restaurantId}`, message.timestamp);
    } catch {}
  },

  subscribe(callback: (msg: SyncMessage) => void): () => void {
    if (typeof window === "undefined") return () => {};

    const handleBroadcast = (event: MessageEvent) => {
      if (event.data && event.data.type) {
        callback(event.data);
      }
    };

    const handleCustom = (event: any) => {
      if (event.detail && event.detail.type) {
        callback(event.detail);
      }
    };

    if (channel) {
      channel.addEventListener("message", handleBroadcast);
    }
    window.addEventListener("tabletapy_sync_bus", handleCustom);

    return () => {
      if (channel) {
        channel.removeEventListener("message", handleBroadcast);
      }
      window.removeEventListener("tabletapy_sync_bus", handleCustom);
    };
  },
};
