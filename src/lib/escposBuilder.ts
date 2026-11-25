import { ThermalPrintChitData } from './thermalPrinterBridge';

/**
 * Encodes text string to ASCII / UTF-8 byte array for thermal ESC/POS printers
 */
function textBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 127) {
      bytes.push(code);
    } else {
      // Approximate unicode symbols to ASCII for thermal paper
      if (str[i] === '₹') {
        bytes.push(0x52, 0x73, 0x2E, 0x20); // "Rs. "
      } else {
        bytes.push(0x3F); // '?'
      }
    }
  }
  return bytes;
}

export function buildEscposBinaryBuffer(chit: ThermalPrintChitData): Buffer {
  const bytes: number[] = [];

  // 1. ESC @ -> Initialize printer
  bytes.push(0x1B, 0x40);

  const isKot = chit.type === 'KOT';

  if (isKot) {
    // ─────────────────────────────────────────────────────────────
    // KITCHEN ORDER TICKET (KOT) LAYOUT (HIGH VISIBILITY FOR CHEF)
    // ─────────────────────────────────────────────────────────────
    // Center Align (ESC a 1)
    bytes.push(0x1B, 0x61, 0x01);
    bytes.push(0x1B, 0x45, 0x01); // Bold ON
    bytes.push(0x1D, 0x21, 0x11); // Double width + Double height
    bytes.push(...textBytes("*** KITCHEN ORDER (KOT) ***\n"));
    bytes.push(0x1D, 0x21, 0x00); // Normal size
    bytes.push(0x1B, 0x45, 0x00); // Bold OFF

    // Left Align (ESC a 0)
    bytes.push(0x1B, 0x61, 0x00);
    bytes.push(...textBytes("------------------------------------------\n"));

    // Table Name (Double Height + Bold)
    if (chit.tableName) {
      bytes.push(0x1B, 0x45, 0x01);
      bytes.push(0x1D, 0x21, 0x11);
      bytes.push(...textBytes(`TABLE: ${chit.tableName}\n`));
      bytes.push(0x1D, 0x21, 0x00);
      bytes.push(0x1B, 0x45, 0x00);
    }

    if (chit.orderNumber) {
      bytes.push(...textBytes(`ROUND / TOKEN: #${chit.orderNumber}\n`));
    }

    if (chit.orderType) {
      bytes.push(...textBytes(`TYPE: ${chit.orderType}\n`));
    }

    if (chit.serverName) {
      bytes.push(...textBytes(`CAPTAIN: ${chit.serverName}\n`));
    }

    if (chit.timestamp) {
      bytes.push(...textBytes(`TIME: ${chit.timestamp}\n`));
    }

    bytes.push(...textBytes("==========================================\n"));
    bytes.push(...textBytes("ITEM                                QTY   \n"));
    bytes.push(...textBytes("==========================================\n"));

    for (const item of chit.items || []) {
      const name = (item.name || 'Item').slice(0, 28);
      const paddedName = name.padEnd(28, ' ');
      const qtyStr = String(item.quantity || 1).padStart(6, ' ');

      bytes.push(0x1B, 0x45, 0x01); // Bold ON
      bytes.push(0x1D, 0x21, 0x01); // Double height
      bytes.push(...textBytes(`${paddedName} ${qtyStr}\n`));
      bytes.push(0x1D, 0x21, 0x00);
      bytes.push(0x1B, 0x45, 0x00);

      if (item.variant) {
        bytes.push(...textBytes(`   Variant: ${item.variant}\n`));
      }

      if (item.notes) {
        bytes.push(0x1B, 0x45, 0x01);
        bytes.push(...textBytes(`   >> NOTE: ${item.notes}\n`));
        bytes.push(0x1B, 0x45, 0x00);
      }
    }

    bytes.push(...textBytes("------------------------------------------\n"));
    if (chit.customerName) {
      bytes.push(...textBytes(`Guest: ${chit.customerName}\n`));
    }

    bytes.push(...textBytes("\n\n\n"));
    // Paper Cut (GS V 65 0)
    bytes.push(0x1D, 0x56, 0x41, 0x00);
    // Buzzer / Acoustic Alarm (ESC B 3 2)
    bytes.push(0x1B, 0x42, 0x03, 0x02);

  } else {
    // ─────────────────────────────────────────────────────────────
    // CUSTOMER BILL / RECEIPT / TOKEN LAYOUT
    // ─────────────────────────────────────────────────────────────
    // Center Align (ESC a 1)
    bytes.push(0x1B, 0x61, 0x01);

    // Bold & Double Size Header
    bytes.push(0x1B, 0x45, 0x01);
    bytes.push(0x1D, 0x21, 0x11);
    bytes.push(...textBytes(`${chit.restaurantName || 'TABLETAPY'}\n`));

    // Normal size
    bytes.push(0x1D, 0x21, 0x00);
    bytes.push(0x1B, 0x45, 0x00);

    if (chit.restaurantAddress) {
      bytes.push(...textBytes(`${chit.restaurantAddress}\n`));
    }

    if (chit.restaurantPhone) {
      bytes.push(...textBytes(`Ph: ${chit.restaurantPhone}\n`));
    }

    if (chit.gstin) {
      bytes.push(...textBytes(`GSTIN: ${chit.gstin}\n`));
    }

    if (chit.fssai) {
      bytes.push(...textBytes(`FSSAI: ${chit.fssai}\n`));
    }

    bytes.push(...textBytes("------------------------------------------\n"));

    const title = chit.title || (chit.type === 'TOKEN' ? 'TOKEN RECEIPT' : 'TAX INVOICE');
    bytes.push(0x1B, 0x45, 0x01);
    bytes.push(...textBytes(`*** ${title} ***\n`));
    bytes.push(0x1B, 0x45, 0x00);

    // Left Align
    bytes.push(0x1B, 0x61, 0x00);

    if (chit.tableName) {
      bytes.push(0x1B, 0x45, 0x01);
      bytes.push(...textBytes(`TABLE: ${chit.tableName}\n`));
      bytes.push(0x1B, 0x45, 0x00);
    }

    if (chit.orderNumber) {
      bytes.push(...textBytes(`TOKEN / INVOICE: #${chit.orderNumber}\n`));
    }

    if (chit.serverName) {
      bytes.push(...textBytes(`Server: ${chit.serverName}\n`));
    }

    if (chit.timestamp) {
      bytes.push(...textBytes(`Date & Time: ${chit.timestamp}\n`));
    }

    bytes.push(...textBytes("------------------------------------------\n"));
    bytes.push(...textBytes("ITEM                     QTY        AMOUNT\n"));
    bytes.push(...textBytes("------------------------------------------\n"));

    for (const item of chit.items || []) {
      const name = (item.name || 'Item').slice(0, 24);
      const paddedName = name.padEnd(24, ' ');
      const qtyStr = String(item.quantity || 1).padStart(4, ' ');
      const totalNum = item.total ?? ((item.price || 0) * (item.quantity || 1));
      const amountStr = totalNum.toFixed(2).padStart(12, ' ');
      bytes.push(...textBytes(`${paddedName} ${qtyStr} ${amountStr}\n`));
    }

    bytes.push(...textBytes("------------------------------------------\n"));

    // Right Align for Subtotal / Taxes / Grand Total
    bytes.push(0x1B, 0x61, 0x02);

    if (chit.subtotal !== undefined) {
      bytes.push(...textBytes(`Subtotal: Rs ${chit.subtotal.toFixed(2)}\n`));
    }

    if (chit.packagingCharge && chit.packagingCharge > 0) {
      bytes.push(...textBytes(`Packaging: Rs ${chit.packagingCharge.toFixed(2)}\n`));
    }

    if (chit.serviceCharge && chit.serviceCharge > 0) {
      bytes.push(...textBytes(`Service Charge: Rs ${chit.serviceCharge.toFixed(2)}\n`));
    }

    if (chit.discount && chit.discount > 0) {
      bytes.push(...textBytes(`Discount: -Rs ${chit.discount.toFixed(2)}\n`));
    }

    if (chit.cgst && chit.cgst > 0) {
      bytes.push(...textBytes(`CGST: Rs ${chit.cgst.toFixed(2)}\n`));
    }

    if (chit.sgst && chit.sgst > 0) {
      bytes.push(...textBytes(`SGST: Rs ${chit.sgst.toFixed(2)}\n`));
    }

    if (chit.totalGst && chit.totalGst > 0 && chit.cgst === undefined) {
      bytes.push(...textBytes(`GST: Rs ${chit.totalGst.toFixed(2)}\n`));
    }

    if (chit.grandTotal !== undefined) {
      bytes.push(0x1B, 0x45, 0x01); // Bold ON
      bytes.push(0x1D, 0x21, 0x01); // Double height
      bytes.push(...textBytes(`GRAND TOTAL: Rs ${chit.grandTotal.toFixed(2)}\n`));
      bytes.push(0x1D, 0x21, 0x00);
      bytes.push(0x1B, 0x45, 0x00);
    }

    if (chit.paymentMode) {
      bytes.push(...textBytes(`Payment Mode: ${chit.paymentMode}\n`));
    }

    if (chit.amountReceived && chit.amountReceived > 0) {
      bytes.push(...textBytes(`Cash Tendered: Rs ${chit.amountReceived.toFixed(2)}\n`));
    }

    if (chit.changeDue && chit.changeDue > 0) {
      bytes.push(...textBytes(`Change Returned: Rs ${chit.changeDue.toFixed(2)}\n`));
    }

    // Center Align for Footer
    bytes.push(0x1B, 0x61, 0x01);
    bytes.push(...textBytes("------------------------------------------\n"));
    bytes.push(...textBytes(`${chit.footerMessage || 'Thank you! Visit again.'}\n`));
    bytes.push(...textBytes("Powered by TableTapy\n\n\n\n"));

    // Paper Cut (GS V 65 0)
    bytes.push(0x1D, 0x56, 0x41, 0x00);

    // Cash drawer kick pulse (ESC p 0 25 250)
    bytes.push(0x1B, 0x70, 0x00, 0x19, 0xFA);
  }

  return Buffer.from(bytes);
}
