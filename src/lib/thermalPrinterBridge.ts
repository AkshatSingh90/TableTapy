/**
 * Direct Thermal Printing & Hardware Bridge for TableTapy POS
 * 
 * Works seamlessly in both:
 * 1. Desktop / Native Tauri App (Direct raw ESC/POS via Windows spooler winspool.drv & Network TCP socket - zero dialogs)
 * 2. Localhost Web Browser Mode (Via Next.js local host hardware API `/api/hardware/*` - zero dialogs, instant WinSpool)
 * 3. Pure Remote Browser Fallback (Automatic graceful degradation to window.print() ONLY when running remotely without local hardware)
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
    (window as any).isTauri ||
    (window as any).__TAURI_INTERNALS__ || 
    (window as any).__TAURI__ || 
    (window as any).__TAURI_INVOKE__
  );
}

/**
 * List installed printers on the Windows machine.
 * 1. Checks native Tauri IPC if running as desktop app.
 * 2. Falls back to local host hardware API (/api/hardware/printers) if running in browser on localhost.
 */
export async function getInstalledPrinters(): Promise<string[]> {
  // 1. Try native Tauri IPC
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const printers = await invoke<string[]>('list_printers');
      if (Array.isArray(printers) && printers.length > 0) {
        return printers;
      }
    } catch (err) {
      console.warn('[Thermal Bridge] Tauri list_printers notice, checking local hardware API:', err);
    }
  }

  // 2. Query local Next.js hardware host API
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/hardware/printers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.printers)) {
          return data.printers;
        }
      }
    } catch (err) {
      console.warn('[Thermal Bridge] Local hardware API printers fetch error:', err);
    }
  }

  return [];
}

/**
 * Send raw ESC/POS bytes directly to the given Windows printer name.
 * Silent, instant, no browser print dialog.
 */
export async function printDirectRaw(printerName: string, rawBytes: number[]): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('print_raw_escpos', {
        printerName,
        data: rawBytes
      });
      return true;
    } catch (err) {
      console.error('[Thermal Bridge] Raw print failed via Tauri:', err);
    }
  }

  // Fallback to local hardware API
  try {
    const res = await fetch('/api/hardware/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printerName,
        rawBytes
      })
    });
    return res.ok;
  } catch (err) {
    console.error('[Thermal Bridge] Raw print failed via local API:', err);
    return false;
  }
}

/**
 * Test connectivity to a Network KOT printer (Port 9100)
 */
export async function testNetworkPrinter(ip: string, port: number = 9100): Promise<{ success: boolean; message: string }> {
  const cleanIp = ip.trim();
  const cleanPort = port || 9100;

  // 1. Try Tauri native socket
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('test_network_printer', { ip: cleanIp, port: cleanPort });
      return { success: true, message: `Connected successfully to Kitchen Printer at ${cleanIp}:${cleanPort}` };
    } catch (err: any) {
      // Proceed to test via local API in case Tauri socket had permission constraint
    }
  }

  // 2. Localhost Next.js Socket Test
  try {
    const res = await fetch('/api/hardware/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: cleanIp, port: cleanPort })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: `Could not connect to ${cleanIp}:${cleanPort}: ${err.message}` };
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
  const isKot = chit.type === 'KOT' || options?.target === 'KOT';
  const kotType = (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_kot_printer_type') : null) || 'same';

  // 1. Try native desktop Tauri engine
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      if (isKot) {
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
      console.warn('[Thermal Bridge] Tauri native spool error, attempting local API:', err);
    }
  }

  // 2. Localhost Next.js Hardware API (Works inside browser on localhost)
  try {
    let networkConfig = undefined;
    if (isKot && kotType === 'network') {
      const ip = (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_kot_printer_ip') : null) || '192.168.1.200';
      const port = parseInt((typeof window !== 'undefined' ? localStorage.getItem('tabletapy_kot_printer_port') : null) || '9100', 10);
      networkConfig = { ip, port: isNaN(port) ? 9100 : port };
    }

    const targetPrinter = isKot && kotType === 'windows'
      ? ((typeof window !== 'undefined' ? localStorage.getItem('tabletapy_kot_printer_name') : null) || '')
      : (options?.printerName || (typeof window !== 'undefined' ? localStorage.getItem('tabletapy_selected_printer') : null) || '');

    const res = await fetch('/api/hardware/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chit,
        printerName: targetPrinter,
        network: networkConfig
      })
    });

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Hardware print failed' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Print dispatch failed' };
  }
}

/**
 * Print a structured chit (KOT or Customer Bill) with direct ESC/POS formatting.
 * - In Desktop / Localhost: Sends raw ESC/POS formatting (bold, cut, alignment) directly to the Windows Spooler or Network Socket.
 *   CRITICAL: In desktop & local mode, NEVER fall back to window.print() to prevent unwanted print dialogs!
 * - In Web Browser Fallback: triggers fallbackCallback (thermal chit render + window.print()) ONLY if local hardware fails.
 */
export async function printThermalChit(
  chit: ThermalPrintChitData,
  options?: {
    printerName?: string;
    fallbackCallback?: () => void;
  }
): Promise<{ success: boolean; method: 'tauri_direct' | 'web_fallback' | 'failed' }> {
  try {
    const isKot = chit.type === 'KOT';
    const copies = !isKot && typeof window !== 'undefined' ? parseInt(localStorage.getItem('tabletapy_print_copies') || '1', 10) : 1;
    const totalCopies = Math.max(1, isNaN(copies) ? 1 : copies);

    let printedAny = false;
    for (let i = 0; i < totalCopies; i++) {
      const res = await executePrint(chit, { printerName: options?.printerName });
      if (res.success) {
        printedAny = true;
      } else if (i === 0) {
        console.warn('[Thermal Bridge] Hardware print error:', res.error);
      }
    }

    if (printedAny) {
      return { success: true, method: 'tauri_direct' };
    }
  } catch (err) {
    console.warn('[Thermal Bridge] Direct thermal spool error:', err);
  }

  // Pure Web Browser fallback only when not running on local hardware and fallback was explicitly requested
  if (options?.fallbackCallback && !isTauriEnvironment()) {
    options.fallbackCallback();
    return { success: true, method: 'web_fallback' };
  }

  return { success: false, method: 'failed' };
}
