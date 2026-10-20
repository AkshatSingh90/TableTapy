"use client";

import { useState } from "react";
import { 
  MenuTemplate,
  ModifiersSheet, CartSheet,
  MOCK_ITEMS, MenuItem
} from "@/components/MenuTemplates";

export default function TestTemplatePage() {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<{ item: MenuItem; price: number }[]>([]);
  
  const cartTotal = cart.reduce((acc, curr) => acc + curr.price, 0);
  const primaryColor = '#FFDF00';

  const props = {
    items: MOCK_ITEMS,
    primaryColor,
    font: 'Inter, sans-serif',
    restaurantName: 'Live Test Cafe',
    tableNo: 'Table 1',
    onSelectItem: setSelectedItem
  };

  return (
    <div className="w-full min-h-screen bg-black relative max-w-md mx-auto shadow-2xl">
      <div className="h-full overflow-y-auto overflow-x-hidden">
        <MenuTemplate {...props} />
      </div>
      
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-40 animate-in slide-in-from-bottom-4">
        <button 
          onClick={() => setIsCartOpen(true)}
          className={`w-full py-4 px-5 flex justify-between items-center text-white font-bold transition-all active:scale-95 rounded-2xl shadow-xl hover:opacity-95 ${cart.length === 0 ? 'opacity-90' : ''}`}
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center text-xs rounded-full bg-white/20">
              {cart.length}
            </div>
            <span className="text-sm tracking-wide">VIEW ORDER</span>
          </div>
          <span className="text-base">${cartTotal.toFixed(2)}</span>
        </button>
      </div>

      <ModifiersSheet 
        item={selectedItem} 
        primaryColor={primaryColor} 
        onClose={() => setSelectedItem(null)} 
        onAddToCart={(item: MenuItem, price: number) => { setCart(prev => [...prev, { item, price }]); setSelectedItem(null); }} 
      />
      
      <CartSheet 
        isOpen={isCartOpen} 
        cart={cart} 
        primaryColor={primaryColor} 
        onClose={() => setIsCartOpen(false)} 
        onClearCart={() => setCart([])} 
      />
    </div>
  );
}
