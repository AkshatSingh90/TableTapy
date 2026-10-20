/**
 * Utility to generate and validate 4-digit dining session PINs for physical table safety.
 * 
 * Rules:
 * 1. A table PIN is stable throughout an active dining session (Round 1, Round 2, Round 3).
 * 2. If an active session order exists, the PIN is extracted directly from the order's note ([PIN:XXXX]).
 * 3. When the table is settled/paid and cleared by staff, a brand new 4-digit PIN is generated
 *    from the settled order ID for the next incoming dining party.
 * 4. The floor captain / staff can see the current active PIN on their terminal / table card
 *    and read it to seated guests.
 */

export function normalizeTableIdentifier(tableIdentifier: string): string {
  return (tableIdentifier || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^table0*([0-9]+)$/, (_, n) => 'table' + n)
    .replace(/^room0*([0-9]+)$/, (_, n) => 'room' + n);
}

export function generateTablePin(tableIdentifier: string, sessionSeed: string = ''): string {
  const normTable = normalizeTableIdentifier(tableIdentifier);
  const cleanSeed = (sessionSeed || '').trim().toLowerCase();
  const input = `${normTable}_${cleanSeed}`;

  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }

  // Generate a friendly 4-digit number between 1000 and 9999
  const pinNum = 1000 + (Math.abs(hash) % 9000);
  return pinNum.toString();
}

/**
 * Resolves the rock-solid PIN and seed for a table across both Captain and Customer views.
 */
export function resolveTablePinAndSeed(
  tableName: string,
  activeTableOrders: any[] = [],
  historicalTableOrders: any[] = []
): { pin: string; seed: string } {
  const normTable = normalizeTableIdentifier(tableName);

  // 1. If table has active unpaid orders in progress, check if any order already has [PIN:XXXX] saved
  if (activeTableOrders && activeTableOrders.length > 0) {
    for (const order of activeTableOrders) {
      const pinMatch = (order.note || '').match(/\[PIN:(\d{4})\]/i);
      if (pinMatch && pinMatch[1]) {
        return {
          pin: pinMatch[1],
          seed: `pinned_${pinMatch[1]}`
        };
      }
    }

    // Fallback if no [PIN:XXXX] tag was in note: anchor to the first active order
    const firstActive = activeTableOrders[0];
    const sessionMatch = (firstActive.note || '').match(/\[SESSION:([a-zA-Z0-9_-]+)\]/i);
    const sessionTag = (sessionMatch && sessionMatch[1]) ? sessionMatch[1] : (firstActive.id || firstActive.created_at);
    const activeSeed = `active_${sessionTag}`;
    return {
      pin: generateTablePin(normTable, activeSeed),
      seed: activeSeed
    };
  }

  // 2. If table is vacant, derive seed from the last completed/settled (PAID) order
  const settledOrders = (historicalTableOrders || []).filter((o: any) => o.payment_status === 'PAID');
  if (settledOrders.length > 0) {
    const lastSettled = settledOrders[0];
    const settledSeed = `settled_${lastSettled.id || lastSettled.created_at}`;
    return {
      pin: generateTablePin(normTable, settledSeed),
      seed: settledSeed
    };
  }

  // 3. Fallback to daily stable seed
  const today = new Date().toISOString().slice(0, 10);
  const dailySeed = `daily_${today}`;
  return {
    pin: generateTablePin(normTable, dailySeed),
    seed: dailySeed
  };
}

export function getTableSessionSeed(
  activeTableOrders: any[],
  historicalTableOrders: any[] = []
): string {
  return resolveTablePinAndSeed('', activeTableOrders, historicalTableOrders).seed;
}

/**
 * Single source of truth helper to fetch the exact same PIN across Captain and Customer views.
 */
export async function fetchTableSessionPin(
  supabase: any,
  restaurantId: string,
  tableName: string
): Promise<{ pin: string; seed: string }> {
  const norm = normalizeTableIdentifier(tableName);

  try {
    // 1. Fetch active unpaid orders for this table
    const { data: active } = await supabase
      .from('orders')
      .select('id, table_no, status, payment_status, note, created_at')
      .eq('restaurant_id', restaurantId)
      .neq('status', 'CANCELLED')
      .neq('payment_status', 'PAID')
      .order('created_at', { ascending: true });

    const tableActive = (active || []).filter(
      (o: any) => normalizeTableIdentifier(o.table_no) === norm
    );

    // 2. Fetch latest settled (PAID) orders for this table
    const { data: settled } = await supabase
      .from('orders')
      .select('id, table_no, status, payment_status, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'PAID')
      .order('created_at', { ascending: false })
      .limit(25);

    const tableSettled = (settled || []).filter(
      (o: any) => normalizeTableIdentifier(o.table_no) === norm
    );

    return resolveTablePinAndSeed(tableName, tableActive, tableSettled);
  } catch (err) {
    console.error("fetchTableSessionPin error:", err);
    return resolveTablePinAndSeed(tableName, [], []);
  }
}
