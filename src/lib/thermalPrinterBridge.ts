/**
 * Direct Thermal Printing & Hardware Bridge for TableTapy POS
 * 
 * Works seamlessly in both:
 * 1. Desktop / Native Tauri App (Direct raw ESC/POS via Windows spooler / winspool.drv API - zero dialogs)
 * 2. Web Browser Fallback (Automatic graceful degradation to window.print() ONLY when running in standard browser)
 */

export interface ThermalPrintChitData {
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  gstin?: string;
  fssai?: string;
  type: 'KOT' | 'BILL' | 'TOKEN';
  title?: string;
  orderNumber?: string | number;
  tableName?: string;
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  serverName?: string;
  timestamp?: string;
  items: Array<{
    name: string;
    quantity: number;
    price?: number;
    total?: number;
    variant?: string;
    notes?: string;
  }>;
  subtotal?: number;
  discount?: number;
  packagingCharge?: number;
  serviceCharge?: number;
  cgst?: number;
  sgst?: number;
  totalGst?: number;
  grandTotal?: number;
  paymentMode?: string;
  amountReceived?: number;
  changeDue?: number;
  footerMessage?: string;
}

/** Check if running inside the Tauri native desktop wrapper */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ || 
    (window as any).__TAURI__ || 
    (window as any).__TAURI_INVOKE__
  );
}

/**
 * List installed printers on the Windows machine.
 * Returns empty array if running in browser.
 */
export async function getInstalledPrinters(): Promise<string[]> {
  if (!isTauriEnvironment()) return [];
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const printers = await invoke<string[]>('list_printers');
    return printers || [];
  } catch (err) {
    console.warn('[Thermal Bridge] Failed to list printers via Tauri:', err);
    return [];
  }
}

/**
 * Send raw ESC/POS bytes directly to the given Windows printer name.
 * Silent, instant, no browser print dialog.
 */
export async function printDirectRaw(printerName: string, rawBytes: number[]): Promise<boolean> {
  if (!isTauriEnvironment()) {
    console.warn('[Thermal Bridge] Cannot send raw ESC/POS outside Tauri environment.');
    return false;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('print_raw_escpos', {
      printerName,
      data: rawBytes
    });
    return true;
  } catch (err) {
    console.error('[Thermal Bridge] Raw print failed:', err);
    return false;
  }
}

/**
 * Print a structured chit (KOT or Customer Bill) with direct ESC/POS formatting.
 * - In Tauri / Desktop: Sends raw ESC/POS formatting (bold, cut, alignment) directly to the Windows Spooler.
 *   CRITICAL: In desktop mode, NEVER fall back to window.print() even if print fails or no printer is found.
 * - In Web Browser: triggers fallbackCallback (thermal chit render + window.print()).
 */
export async function printThermalChit(
  chit: ThermalPrintChitData,
  options?: {
    printerName?: string;
    fallbackCallback?: () => void;
  }
): Promise<{ success: boolean; method: 'tauri_direct' | 'web_fallback' | 'failed' }> {
  const inTauri = isTauriEnvironment();

  if (inTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const targetPrinter = options?.printerName || localStorage.getItem('tabletapy_selected_printer') || '';
      
      const success = await invoke<boolean>('print_receipt', {
        printerName: targetPrinter,
        chitJson: JSON.stringify(chit)
      });

      if (success) {
        return { success: true, method: 'tauri_direct' };
      }
    } catch (err) {
      console.warn('[Thermal Bridge] Direct thermal spool failed in desktop:', err);
      // Suppress browser print completely in desktop app to prevent unwanted window.print() dialogs!
      return { success: false, method: 'failed' };
    }

    // In desktop mode, do NOT open browser print dialog under any circumstances
    return { success: false, method: 'failed' };
  }

  // Pure Web Browser fallback only (when not in native desktop wrapper)
  if (options?.fallbackCallback) {
    options.fallbackCallback();
  } else if (typeof window !== 'undefined') {
    window.print();
  }

  return { success: true, method: 'web_fallback' };
}
