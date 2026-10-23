export interface TaxSettings {
  gstType: "REGULAR" | "COMPOSITION" | "CUSTOM";
  pricingType: "EXCLUSIVE" | "INCLUSIVE";
  cgstRate: number; // default 2.5
  sgstRate: number; // default 2.5
  customGstRate: number; // default 18 (9% CGST + 9% SGST)
  serviceChargeEnabled: boolean;
  serviceChargeRate: number; // default 5.0
  alcoholVatEnabled: boolean;
  alcoholVatRate: number; // default 10.0
  gstin: string;
  fssai: string;
  receiptAddress: string;
  receiptFooter: string;
}

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  gstType: "REGULAR",
  pricingType: "EXCLUSIVE",
  cgstRate: 2.5,
  sgstRate: 2.5,
  customGstRate: 18.0,
  serviceChargeEnabled: false,
  serviceChargeRate: 5.0,
  alcoholVatEnabled: false,
  alcoholVatRate: 10.0,
  gstin: "",
  fssai: "",
  receiptAddress: "",
  receiptFooter: "Thank you for dining with us! Visit again.",
};

export function getStoredTaxSettings(restaurantId?: string): TaxSettings {
  if (typeof window === "undefined") return DEFAULT_TAX_SETTINGS;
  try {
    const key = restaurantId
      ? `tabletapy_tax_settings_${restaurantId}`
      : "tabletapy_tax_settings_default";
    const raw = localStorage.getItem(key) || localStorage.getItem("tabletapy_tax_settings_default");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_TAX_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error("Error reading stored tax settings:", err);
  }
  return DEFAULT_TAX_SETTINGS;
}

export function saveTaxSettings(settings: TaxSettings, restaurantId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(settings);
    if (restaurantId) {
      localStorage.setItem(`tabletapy_tax_settings_${restaurantId}`, serialized);
    }
    localStorage.setItem("tabletapy_tax_settings_default", serialized);
  } catch (err) {
    console.error("Error saving tax settings:", err);
  }
}

export interface BillTaxCalculation {
  subtotal: number;
  discountAmount: number;
  netFoodSubtotal: number;
  serviceChargeAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGst: number;
  effectiveCgstRate: number;
  effectiveSgstRate: number;
  alcoholVatAmount: number;
  packagingAmount: number;
  exactTotal: number;
  grandTotal: number;
  roundOff: number;
  isInclusive: boolean;
  isComposition: boolean;
}

export function calculateBillTaxes(params: {
  subtotal: number;
  discountAmount?: number;
  packagingAmount?: number;
  isDineIn: boolean;
  hasAlcohol?: boolean;
  alcoholSubtotal?: number;
  settings: TaxSettings;
}): BillTaxCalculation {
  const {
    subtotal,
    discountAmount = 0,
    packagingAmount = 0,
    isDineIn,
    hasAlcohol = false,
    alcoholSubtotal = 0,
    settings,
  } = params;

  const netFoodSubtotal = Math.max(0, subtotal - discountAmount - alcoholSubtotal);
  const netAlcoholSubtotal = Math.max(0, alcoholSubtotal);

  // 1. Service Charge (Dine-In only, CCPA compliant)
  const serviceChargeAmount =
    isDineIn && settings.serviceChargeEnabled
      ? Math.round((netFoodSubtotal + netAlcoholSubtotal) * (settings.serviceChargeRate / 100))
      : 0;

  // 2. Alcohol VAT (State specific, outside GST)
  const alcoholVatAmount =
    hasAlcohol && settings.alcoholVatEnabled
      ? Math.round(netAlcoholSubtotal * (settings.alcoholVatRate / 100))
      : 0;

  const isComposition = settings.gstType === "COMPOSITION";
  const isInclusive = settings.pricingType === "INCLUSIVE" && !isComposition;

  let effectiveCgstRate = 0;
  let effectiveSgstRate = 0;

  if (settings.gstType === "REGULAR") {
    effectiveCgstRate = settings.cgstRate;
    effectiveSgstRate = settings.sgstRate;
  } else if (settings.gstType === "CUSTOM") {
    effectiveCgstRate = settings.customGstRate / 2;
    effectiveSgstRate = settings.customGstRate / 2;
  }

  const combinedGstRate = effectiveCgstRate + effectiveSgstRate;

  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let totalGst = 0;
  let exactTotal = 0;
  let grandTotal = 0;

  if (isComposition) {
    taxableAmount = netFoodSubtotal + serviceChargeAmount;
    cgstAmount = 0;
    sgstAmount = 0;
    totalGst = 0;
    exactTotal =
      netFoodSubtotal + netAlcoholSubtotal + serviceChargeAmount + alcoholVatAmount + packagingAmount;
    grandTotal = Math.round(exactTotal);
  } else if (isInclusive) {
    // Inclusive: Tax is already baked into menu item price
    const rateFactor = combinedGstRate / 100;
    const baseFood = rateFactor > 0 ? netFoodSubtotal / (1 + rateFactor) : netFoodSubtotal;
    totalGst = netFoodSubtotal - baseFood;
    cgstAmount = totalGst / 2;
    sgstAmount = totalGst / 2;
    taxableAmount = baseFood + serviceChargeAmount;

    exactTotal =
      netFoodSubtotal + netAlcoholSubtotal + serviceChargeAmount + alcoholVatAmount + packagingAmount;
    grandTotal = Math.round(exactTotal);
  } else {
    // Exclusive: Tax added on top of food + service charge
    taxableAmount = netFoodSubtotal + serviceChargeAmount;
    if (combinedGstRate > 0) {
      cgstAmount = Math.round((taxableAmount * (effectiveCgstRate / 100)) * 100) / 100;
      sgstAmount = Math.round((taxableAmount * (effectiveSgstRate / 100)) * 100) / 100;
      totalGst = cgstAmount + sgstAmount;
    }
    exactTotal =
      taxableAmount + netAlcoholSubtotal + totalGst + alcoholVatAmount + packagingAmount;
    grandTotal = Math.round(exactTotal);
  }

  const roundOff = Math.round((grandTotal - exactTotal) * 100) / 100;

  return {
    subtotal,
    discountAmount,
    netFoodSubtotal,
    serviceChargeAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    totalGst,
    effectiveCgstRate,
    effectiveSgstRate,
    alcoholVatAmount,
    packagingAmount,
    exactTotal,
    grandTotal,
    roundOff,
    isInclusive,
    isComposition,
  };
}
