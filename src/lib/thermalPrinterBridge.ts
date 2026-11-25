/**
 * Direct Thermal Printing & Hardware Bridge for TableTapy POS
 * 
 * Works seamlessly in both:
 * 1. Desktop / Native Tauri App (Direct raw ESC/POS via Windows spooler winspool.drv & Network TCP socket - zero dialogs)
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
  customerName?: string;
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
 * Test connectivity to a Network KOT printer (Port 9100)
 */
export async function testNetworkPrinter(ip: string, port: number = 9100): Promise<{ success: boolean; message: string }> {
  if (!isTauriEnvironment()) {
    return { success: false, message: 'Network socket printing is only available in TableTapy Desktop App.' };
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('test_network_printer', { ip: ip.trim(), port: port || 9100 });
    return { success: true, message: `Connected successfully to Kitchen Printer at ${ip}:${port}` };
  } catch (err: any) {
    return { success: false, message: err?.toString() || `Could not connect to ${ip}:${port}` };
  }
}

/**
 * Test print a sample chit to Counter Billing printer
 */
export async function testPrintBillingPrinter(): Promise<{ success: boolean; error?: string }> {
  const printerName = typeof window !== 'undefined' ? localStorage.getItem('tabletapy_selected_printer') || '' : '';
  const testChit: ThermalPrintChitData = {
    restaurantName: 'TABLETAPY POS',
    restaurantAddress: '100ft Road, Indiranagar, Bengaluru',
    restaurantPhone: '+91 98765 43210',
    gstin: '29ABCDE1234F1Z5',
    type: 'BILL',
    title: 'TEST RECEIPT',
    tableName: 'T-01 (TEST)',
    orderNumber: 'TEST-001',
    serverName: 'Admin',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    items: [
      { name: 'Cold Brew Coffee', quantity: 2, price: 180, total: 360 },
      { name: 'Almond Croissant', quantity: 1, price: 140, total: 140 }
    ],
    subtotal: 500,
    cgst: 12.5,
    sgst: 12.5,
    totalGst: 25,
    grandTotal: 525,
    paymentMode: 'CASH',
    amountReceived: 600,
    changeDue: 75,
    footerMessage: 'Hardware Test Successful! Happy Pitching!'
  };

  return executePrint(testChit, { printerName, target: 'BILL' });
}

/**
 * Test print a sample chit to Kitchen KOT printer
 */
export async function testPrintKitchenPrinter(): Promise<{ success: boolean; error?: string }> {
  const testChit: ThermalPrintChitData = {
    restaurantName: 'TABLETAPY KITCHEN',
    type: 'KOT',
    title: 'KITCHEN TEST TICKET',
    tableName: 'TABLE 05',
    orderNumber: 'KOT-99',
    orderType: 'DINE_IN',
    serverName: 'Captain Rahul',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    items: [
      { name: 'Paneer Butter Masala', quantity: 1, notes: 'Less spicy, no coriander' },
      { name: 'Butter Garlic Naan', quantity: 4 },
      { name: 'Fresh Lime Soda (Sweet)', quantity: 2, notes: 'With ice' }
    ]
  };

  return executePrint(testChit, { target: 'KOT' });
}

/** Internal router for executing print based on chit type & configuration */
async function executePrint(
  chit: ThermalPrintChitData,
  options?: {
    printerName?: string;
    target?: 'BILL' | 'KOT';
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isTauriEnvironment()) {
    return { success: false, error: 'Not in desktop environment' };
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const isKot = chit.type === 'KOT' || options?.target === 'KOT';

    if (isKot) {
      const kotType = (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_kot_printer_type') : null) || 'same';

      if (kotType === 'network') {
        const ip = (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_kot_printer_ip') : null) || '192.168.1.200';
        const port = parseInt((typeof window !== 'undefined' ? localStorage.getItem('tabletapy_kot_printer_port') : null) || '9100', 10);
        await invoke('print_network_receipt', {
          ip,
          port: isNaN(port) ? 9100 : port,
          chitJson: JSON.stringify(chit)
        });
        return { success: true };
      } else if (kotType === 'windows') {
        const kotPrinterName = (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_kot_printer_name') : null) || '';
        await invoke('print_receipt', {
          printerName: kotPrinterName,
          chitJson: JSON.stringify(chit)
        });
        return { success: true };
      } else {
        // 'same' as counter billing printer
        const counterPrinter = options?.printerName || (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_selected_printer') : null) || '';
        await invoke('print_receipt', {
          printerName: counterPrinter,
          chitJson: JSON.stringify(chit)
        });
        return { success: true };
      }
    } else {
      // Counter Billing / Token Receipt
      const counterPrinter = options?.printerName || (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_selected_printer') : null) || '';
      await invoke('print_receipt', {
        printerName: counterPrinter,
        chitJson: JSON.stringify(chit)
      });
      return { success: true };
    }
  } catch (err: any) {
    console.error('[Thermal Bridge] Execution error:', err);
    return { success: false, error: err?.toString() || 'Print failed' };
  }
}

/**
 * Print a structured chit (KOT or Customer Bill) with direct ESC/POS formatting.
 * - In Tauri / Desktop: Sends raw ESC/POS formatting (bold, cut, alignment) directly to the Windows Spooler or Network Socket.
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
      const isKot = chit.type === 'KOT';
      const copies = !isKot && typeof window !== 'undefined' ? parseInt(localStorage.getItem('tabletapy_print_copies') || '1', 10) : 1;
      const totalCopies = Math.max(1, isNaN(copies) ? 1 : copies);

      for (let i = 0; i < totalCopies; i++) {
        const res = await executePrint(chit, { printerName: options?.printerName });
        if (!res.success && i === 0) {
          console.warn('[Thermal Bridge] Direct print returned error:', res.error);
          return { success: false, method: 'failed' };
        }
      }

      return { success: true, method: 'tauri_direct' };
    } catch (err) {
      console.warn('[Thermal Bridge] Direct thermal spool failed in desktop:', err);
      // Suppress browser print completely in desktop app to prevent unwanted window.print() dialogs!
      return { success: false, method: 'failed' };
    }
  }

  // Pure Web Browser fallback only (when not in native desktop wrapper)
  if (options?.fallbackCallback) {
    options.fallbackCallback();
  } else if (typeof window !== 'undefined') {
    window.print();
  }

  return { success: true, method: 'web_fallback' };
}
