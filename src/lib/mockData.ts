export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
};

export type Theme = {
  primaryColor: string;
  logoUrl?: string;
};

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  theme: Theme;
  products: Product[];
  tagline?: string;
};

export type OrderItem = {
  productId: string;
  quantity: number;
};

export type Order = {
  id: string;
  restaurantId: string;
  tableNumber?: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'served';
  total: number;
  createdAt: Date;
};

export type TentCardTemplate = {
  id: string;
  name: string;
  category: 'Café' | 'Classic' | 'Luxury' | 'Modern' | 'Minimal' | 'Restaurant' | 'Fine Dining';
  previewUrl?: string; // fallback if needed
  layoutConfig: any; // determines layout styles
};

export type TentCardMaterial = {
  id: string;
  name: string;
  description: string;
  basePrice: number; // per card
  sizes: string[];
};

export const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: "r1",
    slug: "test-cafe",
    name: "The Daily Café",
    tagline: "Good food. Good mood.",
    theme: {
      primaryColor: "#8C4C63", // Luxury Accent
      logoUrl: "",
    },
    products: [
      { id: "p1", name: "Espresso", description: "Strong and rich", price: 3.5 },
      { id: "p2", name: "Croissant", description: "Buttery, flaky pastry", price: 4.0 },
    ],
  },
];

export const MOCK_TEMPLATES: TentCardTemplate[] = [
  { id: "t1", name: "The Minimalist", category: "Minimal", layoutConfig: { font: "font-sans", qrPosition: "bottom", align: "center" } },
  { id: "t2", name: "Classic Elegance", category: "Luxury", layoutConfig: { font: "font-serif", qrPosition: "center", align: "center" } },
  { id: "t3", name: "Modern Bold", category: "Modern", layoutConfig: { font: "font-sans", qrPosition: "bottom-right", align: "left" } },
  { id: "t4", name: "Café Casual", category: "Café", layoutConfig: { font: "font-sans", qrPosition: "center", align: "center" } },
  { id: "t5", name: "Fine Dining", category: "Fine Dining", layoutConfig: { font: "font-serif", qrPosition: "bottom", align: "center" } },
  { id: "t6", name: "Bistro Standard", category: "Restaurant", layoutConfig: { font: "font-sans", qrPosition: "top", align: "left" } },
];

export const MOCK_MATERIALS: TentCardMaterial[] = [
  { id: "m1", name: "Premium Cardstock", description: "Heavyweight 350gsm paper with soft-touch matte finish.", basePrice: 2.50, sizes: ["4x6 in", "5x7 in"] },
  { id: "m2", name: "Rigid PVC", description: "Durable, waterproof plastic built for heavy restaurant use.", basePrice: 4.50, sizes: ["4x6 in"] },
  { id: "m3", name: "Clear Acrylic", description: "Elegant transparent acrylic with UV-printed artwork.", basePrice: 8.00, sizes: ["4x6 in", "5x7 in"] },
  { id: "m4", name: "Laser-Engraved Wood", description: "Sustainable bamboo or birch with etched QR codes.", basePrice: 10.50, sizes: ["4x6 in"] },
];

export let MOCK_ORDERS: Order[] = [];
