/**
 * Utility functions for managing dining sessions across customer, captain, and dashboard views.
 * 
 * GOLDEN RULE:
 * Multiple orders on the same table represent multiple rounds of a single meal IF AND ONLY IF:
 * 1. They share the same explicit session identifier ([SESSION:<id>]), OR
 * 2. They were actively placed and settled together under the same bill payment request ([UPI VERIFICATION REQUESTED...] or [CASH REQUESTED...]).
 * 
 * Orders placed and settled separately (or placed after a previous order was settled)
 * represent separate visits/meals and MUST be treated as separate invoices and settled orders.
 */

export function generateSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `sess_${ts}_${rand}`;
}

export function extractSessionId(note?: string | null): string | null {
  if (!note) return null;
  const match = note.match(/\[SESSION:([a-zA-Z0-9_-]+)\]/i);
  return match && match[1] ? match[1] : null;
}

export function extractSettlementSignature(note?: string | null): string | null {
  if (!note) return null;
  const match = note.match(/\[(UPI VERIFICATION REQUESTED|CASH REQUESTED)[^\]]+\]/i);
  return match && match[0] ? match[0].trim() : null;
}

export function attachSessionToNote(note: string | null | undefined, sessionId: string): string {
  const existingNote = (note || '').trim();
  if (existingNote.includes(`[SESSION:${sessionId}]`)) {
    return existingNote;
  }
  // Strip any old/mismatched session tag if present
  const cleaned = existingNote.replace(/\[SESSION:[^\]]+\]/gi, '').trim();
  return `[SESSION:${sessionId}] ${cleaned}`.trim();
}

/**
 * Strips all internal system tags ([SESSION:...], [UPI VERIFICATION REQUESTED...], [CASH REQUESTED...])
 * and returns only the customer's actual cooking instructions / notes.
 */
export function extractUserNote(rawNote?: string | null): string {
  if (!rawNote) return '';
  return rawNote
    .replace(/\[SESSION:[^\]]+\]/gi, '')
    .replace(/\[PIN:[^\]]+\]/gi, '')
    .replace(/\[(UPI VERIFICATION REQUESTED|CASH REQUESTED)[^\]]*\]/gi, '')
    .trim();
}

export interface OrderBasicInfo {
  id: string;
  created_at: string;
  table_no?: string | null;
  note?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  status?: string | null;
  payment_status?: string | null;
  total?: number | string | null;
}

export function getOrderSessionSignature(order: OrderBasicInfo): string {
  // 1. Explicit [SESSION:xyz] tag
  const sessionId = extractSessionId(order.note);
  if (sessionId) {
    return `SESSION_${sessionId}`;
  }

  // 2. Exact settlement request signature
  const settlementSig = extractSettlementSignature(order.note);
  if (settlementSig) {
    return `SETTLEMENT_${settlementSig}`;
  }

  // 3. Fallback to order ID to prevent accidental merging of distinct orders
  return `ORDER_${order.id}`;
}

/**
 * Group a chronologically sorted list of orders for a table into distinct dining sessions / invoices.
 */
export function groupOrdersIntoSessions<T extends OrderBasicInfo>(orders: T[]): T[][] {
  if (!orders || orders.length === 0) return [];

  // Sort ascending by created_at
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const batches: T[][] = [];
  let currentBatch: T[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const order = sorted[i];

    if (currentBatch.length === 0) {
      currentBatch.push(order);
      continue;
    }

    const prevOrder = currentBatch[currentBatch.length - 1];
    const prevSig = getOrderSessionSignature(prevOrder);
    const currSig = getOrderSessionSignature(order);

    let isSameSession = false;

    if (prevSig.startsWith('SESSION_') && currSig.startsWith('SESSION_')) {
      // Both orders explicitly declare a session: group only if sessions match
      isSameSession = prevSig === currSig;
    } else if (prevSig.startsWith('SETTLEMENT_') && currSig.startsWith('SETTLEMENT_')) {
      // Both orders were settled together under the same settlement request
      const timeDiffMinutes = (new Date(order.created_at).getTime() - new Date(prevOrder.created_at).getTime()) / (1000 * 60);
      const prevPhone = prevOrder.customer_phone?.trim();
      const currPhone = order.customer_phone?.trim();
      const phoneMatches = !prevPhone || !currPhone || prevPhone === currPhone;
      
      // Must have the exact same settlement signature and be within 45m
      isSameSession = prevSig === currSig && timeDiffMinutes <= 45 && phoneMatches;
    } else if (
      order.payment_status !== 'PAID' && 
      order.status !== 'CANCELLED' &&
      prevOrder.payment_status !== 'PAID' &&
      prevOrder.status !== 'CANCELLED'
    ) {
      // Unsettled active rounds on this table during an active dining session
      const timeDiffMinutes = (new Date(order.created_at).getTime() - new Date(prevOrder.created_at).getTime()) / (1000 * 60);
      const prevPhone = prevOrder.customer_phone?.trim();
      const currPhone = order.customer_phone?.trim();
      const phoneMatches = !prevPhone || !currPhone || prevPhone === currPhone;

      isSameSession = timeDiffMinutes <= 45 && phoneMatches;
    }

    if (isSameSession) {
      currentBatch.push(order);
    } else {
      batches.push(currentBatch);
      currentBatch = [order];
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
