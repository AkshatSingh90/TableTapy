export type ProductType = 'nfc_stand' | 'wood_block' | 'wood_plaque' | 'tent_card' | 'nfc_card';

export interface CatalogProduct {
  id: ProductType;
  name: string;
  description: string;
  basePrice: number;
  finishes: { id: string; name: string; colorHex?: string }[];
  allowsNfc: boolean;
  allowsQr: boolean;
  defaultViews: ('front' | 'back' | 'angled' | 'lifestyle')[];
}

export const PRODUCT_CATALOG: CatalogProduct[] = [
  {
    id: 'nfc_stand',
    name: 'NFC Menu Stand',
    description: 'Premium freestanding tabletop stand with integrated NFC.',
    basePrice: 15.00,
    finishes: [
      { id: 'charcoal', name: 'Dark Charcoal', colorHex: '#333333' },
      { id: 'wood_dark', name: 'Dark Wood', colorHex: '#4A3728' },
    ],
    allowsNfc: true,
    allowsQr: true,
    defaultViews: ['front', 'angled'],
  },
  {
    id: 'wood_block',
    name: 'Wooden QR/NFC Block',
    description: 'Minimalist wooden block for modern café tables.',
    basePrice: 12.50,
    finishes: [
      { id: 'light', name: 'Light Wood', colorHex: '#D4B895' },
      { id: 'natural', name: 'Natural Oak', colorHex: '#C19A6B' },
      { id: 'dark', name: 'Dark Walnut', colorHex: '#5C4033' },
    ],
    allowsNfc: true,
    allowsQr: true,
    defaultViews: ['front', 'angled', 'lifestyle'],
  },
  {
    id: 'wood_plaque',
    name: 'Wooden Menu QR Plaque',
    description: 'Elegant vertical wooden plaque with freestanding base.',
    basePrice: 18.00,
    finishes: [
      { id: 'natural', name: 'Natural Wood', colorHex: '#C19A6B' },
      { id: 'dark', name: 'Dark Wood', colorHex: '#5C4033' },
    ],
    allowsNfc: true,
    allowsQr: true,
    defaultViews: ['front', 'angled', 'lifestyle'],
  },
  {
    id: 'tent_card',
    name: 'NFC Tent Card',
    description: 'Folded premium cardstock tent card.',
    basePrice: 4.50,
    finishes: [
      { id: 'matte_white', name: 'Matte White', colorHex: '#FAFAFA' },
      { id: 'soft_black', name: 'Soft Touch Black', colorHex: '#1A1A1A' },
    ],
    allowsNfc: true,
    allowsQr: true,
    defaultViews: ['front', 'back', 'angled'],
  },
  {
    id: 'nfc_card',
    name: 'Custom NFC Card',
    description: 'Standard card-shaped premium NFC card.',
    basePrice: 6.00,
    finishes: [
      { id: 'matte_pvc', name: 'Matte PVC', colorHex: '#FFFFFF' },
      { id: 'metal', name: 'Brushed Metal', colorHex: '#B0C4DE' },
    ],
    allowsNfc: true,
    allowsQr: true,
    defaultViews: ['front', 'back'],
  }
];

export interface DesignState {
  productId: ProductType;
  finishId: string;
  businessName: string;
  customText: string;
  qrUrl: string;
  nfcUrl: string;
  logoUrl: string | null;
  removeBackground: boolean;
  quantity: number;
}
