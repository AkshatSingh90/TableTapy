"use client";
import { useState } from "react";
import Link from "next/link";
import { 
  Smartphone, Palette, LayoutList, Type, Image as ImageIcon, 
  AlignLeft, AlignCenter, EyeOff, CheckCircle2, ChevronLeft, 
  Save, Sparkles, Box, Loader2
} from "lucide-react";

type ThemeConfig = {
  logoPosition: 'left' | 'center' | 'hidden';
  primaryColor: string;
  backgroundColor: string;
  fontFamily: 'sans' | 'serif' | 'mono' | 'rounded';
  layoutStyle: 'list' | 'grid' | 'masonry';
  buttonStyle: 'sharp' | 'rounded' | 'pill';
  cardStyle: 'flat' | 'elevated' | 'glass' | 'minimal';
};

export default function DedicatedDesignerPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewMode, setPreviewMode] = useState<'RESTAURANT' | 'HOTEL'>('RESTAURANT');

  // Massive Expansion of Theme State
  const [theme, setTheme] = useState<ThemeConfig>({
    logoPosition: 'center',
    primaryColor: '#E46254',
    backgroundColor: '#09090b',
    fontFamily: 'sans',
    layoutStyle: 'list',
    buttonStyle: 'pill',
    cardStyle: 'elevated',
  });

  const mockItems = [
    { id: '1', name: 'Truffle Burger', desc: 'Wagyu beef, black truffle aioli, aged cheddar.', price: '$24.00', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80' },
    { id: '2', name: 'Spicy Rigatoni', desc: 'Vodka sauce, calabrian chili, fresh basil.', price: '$22.00', img: 'https://images.unsplash.com/photo-1621996311210-9113697e64ab?w=500&q=80' },
  ];

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => { setIsSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 1000);
  };

  // Helper styles based on theme
  const getButtonRadius = () => {
    if (theme.buttonStyle === 'sharp') return '0px';
    if (theme.buttonStyle === 'rounded') return '8px';
    return '9999px';
  };

  const getCardClasses = () => {
    const base = "overflow-hidden transition-all ";
    if (theme.cardStyle === 'flat') return base + (theme.backgroundColor === '#09090b' ? 'bg-zinc-900 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200');
    if (theme.cardStyle === 'elevated') return base + (theme.backgroundColor === '#09090b' ? 'bg-zinc-900 border border-zinc-800/50 shadow-xl' : 'bg-white shadow-xl border border-black/5');
    if (theme.cardStyle === 'glass') return base + 'bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl';
    if (theme.cardStyle === 'minimal') return base + 'bg-transparent border-b border-white/10 rounded-none';
    return base;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0f0f11] text-zinc-50 font-sans">
      
      {/* TOP NAVIGATION BAR (Figma/Canva style) */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/menu" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
            <ChevronLeft size={16} /> Back to Dashboard
          </Link>
          <div className="h-4 w-px bg-zinc-800"></div>
          <span className="text-sm font-semibold flex items-center gap-2">
            <Sparkles size={14} className="text-[#E46254]" /> Theme Studio Pro
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-900">Discard Changes</button>
          <button 
            onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-medium transition-all ${saved ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? 'Published' : 'Publish to Live'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT PANEL: The Inspector (Controls) */}
        <div className="w-80 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-full overflow-y-auto custom-scrollbar shrink-0">
          
          <div className="p-5 border-b border-zinc-800/50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2"><Palette size={14}/> Colors</h3>
            
            <label className="block text-xs font-medium text-zinc-400 mb-2">Accent Color</label>
            <div className="flex flex-wrap gap-2 mb-5">
              {['#E46254', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#000000'].map((color) => (
                <button key={color} onClick={() => setTheme({...theme, primaryColor: color})} className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${theme.primaryColor === color ? 'border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent'}`} style={{ backgroundColor: color }} />
              ))}
            </div>

            <label className="block text-xs font-medium text-zinc-400 mb-2">Canvas Background</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTheme({...theme, backgroundColor: '#09090b'})} className={`py-2 text-xs rounded-md border ${theme.backgroundColor === '#09090b' ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'}`}>Midnight Black</button>
              <button onClick={() => setTheme({...theme, backgroundColor: '#ffffff'})} className={`py-2 text-xs rounded-md border ${theme.backgroundColor === '#ffffff' ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'}`}>Clean White</button>
              <button onClick={() => setTheme({...theme, backgroundColor: '#f4f4f5'})} className={`py-2 text-xs rounded-md border ${theme.backgroundColor === '#f4f4f5' ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'}`}>Warm Sand</button>
              <button onClick={() => setTheme({...theme, backgroundColor: '#171717'})} className={`py-2 text-xs rounded-md border ${theme.backgroundColor === '#171717' ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'}`}>Charcoal</button>
            </div>
          </div>

          <div className="p-5 border-b border-zinc-800/50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2"><Box size={14}/> Elements</h3>
            
            <label className="block text-xs font-medium text-zinc-400 mb-2">Button Shape</label>
            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 mb-5">
              {['sharp', 'rounded', 'pill'].map((style) => (
                <button key={style} onClick={() => setTheme({...theme, buttonStyle: style as any})} className={`flex-1 py-1.5 text-xs capitalize rounded-md ${theme.buttonStyle === style ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>{style}</button>
              ))}
            </div>

            <label className="block text-xs font-medium text-zinc-400 mb-2">Item Card Style</label>
            <div className="grid grid-cols-2 gap-2">
              {['flat', 'elevated', 'glass', 'minimal'].map((style) => (
                <button key={style} onClick={() => setTheme({...theme, cardStyle: style as any})} className={`py-2 text-xs capitalize rounded-md border ${theme.cardStyle === style ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'}`}>{style}</button>
              ))}
            </div>
          </div>

          <div className="p-5 border-b border-zinc-800/50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2"><Type size={14}/> Typography & Layout</h3>
            
            <label className="block text-xs font-medium text-zinc-400 mb-2">Font Family</label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button onClick={() => setTheme({...theme, fontFamily: 'sans'})} className={`py-2 font-sans text-xs rounded-md border ${theme.fontFamily === 'sans' ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'}`}>System Sans</button>
              <button onClick={() => setTheme({...theme, fontFamily: 'serif'})} className={`py-2 font-serif text-xs rounded-md border ${theme.fontFamily === 'serif' ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'}`}>Elegant Serif</button>
              <button onClick={() => setTheme({...theme, fontFamily: 'mono'})} className={`py-2 font-mono text-xs rounded-md border ${theme.fontFamily === 'mono' ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'}`}>Technical Mono</button>
            </div>

            <label className="block text-xs font-medium text-zinc-400 mb-2">Grid Layout</label>
            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              {['list', 'grid', 'masonry'].map((style) => (
                <button key={style} onClick={() => setTheme({...theme, layoutStyle: style as any})} className={`flex-1 py-1.5 text-xs capitalize rounded-md ${theme.layoutStyle === style ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>{style}</button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT PANEL: The Canvas (Figma-style background) */}
        <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden flex items-center justify-center">
          {/* Subtle grid pattern background like Figma */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          
          <div className="absolute top-6 flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur-md rounded-full border border-zinc-800 text-xs font-medium text-zinc-400">
              <Smartphone size={14} /> Live Mobile Preview
            </div>
            {/* Preview Mode Toggle */}
            <div className="flex bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-full p-1 gap-1">
              <button
                onClick={() => setPreviewMode('RESTAURANT')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${previewMode === 'RESTAURANT' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
              >
                Restaurant
              </button>
              <button
                onClick={() => setPreviewMode('HOTEL')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${previewMode === 'HOTEL' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
              >
                Hotel
              </button>
            </div>
          </div>

          {/* The Phone Container */}
          <div className="relative w-[360px] h-[740px] bg-black rounded-[55px] border-[14px] border-zinc-800 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col z-10 transition-all duration-300 transform hover:scale-[1.02]">
            
            {/* Dynamic Injector */}
            <div 
              className="w-full h-full overflow-y-auto custom-scrollbar relative transition-all duration-500"
              style={{ 
                backgroundColor: previewMode === 'HOTEL' ? '#F9FAFB' : theme.backgroundColor, 
                fontFamily: theme.fontFamily === 'serif' ? 'Georgia, serif' : theme.fontFamily === 'mono' ? 'monospace' : 'system-ui, sans-serif',
                color: previewMode === 'HOTEL' ? '#111827' : (theme.backgroundColor === '#ffffff' || theme.backgroundColor === '#f4f4f5' ? '#18181b' : '#ffffff')
              }}
            >

              {/* ── HOTEL PREVIEW ── */}
              {previewMode === 'HOTEL' && (
                <div>
                  {/* Hotel Header */}
                  <div className="bg-white px-5 pt-10 pb-5 flex items-center justify-between shadow-sm rounded-b-2xl">
                    <div>
                      <div className="w-8 h-8 rounded-full mb-2" style={{ backgroundColor: theme.primaryColor }} />
                      <h2 className="text-base font-bold text-gray-900">The Grand Hotel</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Room</p>
                      <div className="bg-gray-50 border border-gray-100 px-3 py-1 rounded-xl">
                        <span className="text-sm font-bold text-gray-900">204</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="px-4 py-4">
                    <div className="flex p-1.5 bg-gray-200/60 rounded-2xl">
                      <div className="flex-1 py-2.5 text-xs font-bold text-center bg-white rounded-xl shadow-sm text-gray-900">Guest Services</div>
                      <div className="flex-1 py-2.5 text-xs font-bold text-center text-gray-400">In-Room Dining</div>
                    </div>
                  </div>

                  {/* Category heading */}
                  <div className="px-5 mb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">What do you need?</p>
                  </div>

                  {/* 2-Col Category Grid */}
                  <div className="px-4 grid grid-cols-2 gap-3 pb-24">
                    {[
                      { icon: '🧹', label: 'Room Cleaning', desc: 'Washroom, full clean, vacuum', count: 3 },
                      { icon: '🧴', label: 'Basic Essentials', desc: 'Toothbrush, soap, towels', count: 6 },
                      { icon: '☕', label: 'Tea & Coffee', desc: 'Sachets, milk powder', count: 4 },
                      { icon: '💧', label: 'Water & Drinks', desc: 'Water bottles, sodas', count: 2 },
                      { icon: '🛏️', label: 'Bedding & Linen', desc: 'Bedsheet change, pillows', count: 3 },
                      { icon: '👕', label: 'Laundry Services', desc: 'Wash & fold, ironing', count: 4 },
                    ].map((cat) => (
                      <div key={cat.label} className="bg-white border border-gray-100 shadow-sm p-4 flex flex-col gap-3 rounded-2xl">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ backgroundColor: `${theme.primaryColor}18` }}
                        >
                          {cat.icon}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-gray-900 leading-tight mb-0.5">{cat.label}</h3>
                          <p className="text-[10px] text-gray-400 leading-snug">{cat.desc}</p>
                        </div>
                        <div
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full w-fit"
                          style={{ backgroundColor: `${theme.primaryColor}18`, color: theme.primaryColor }}
                        >
                          {cat.count} items
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── RESTAURANT PREVIEW ── */}
              {previewMode === 'RESTAURANT' && (
                <>
                  {/* Dynamic Gradients if Glass style */}
                  {theme.cardStyle === 'glass' && (
                    <>
                      <div className="absolute top-0 right-0 w-[300px] h-[300px] blur-[80px] rounded-full opacity-40 pointer-events-none transition-colors duration-500" style={{ backgroundColor: theme.primaryColor }} />
                      <div className="absolute bottom-0 left-0 w-[200px] h-[200px] blur-[60px] rounded-full opacity-30 pointer-events-none transition-colors duration-500" style={{ backgroundColor: theme.primaryColor }} />
                    </>
                  )}

                  <div className={`p-6 pt-14 pb-8 ${theme.logoPosition === 'center' ? 'flex justify-center text-center' : 'text-left'}`}>
                    <div 
                      className="w-14 h-14 mb-4 flex items-center justify-center text-white font-bold text-2xl shadow-lg transition-colors duration-500" 
                      style={{ backgroundColor: theme.primaryColor, borderRadius: getButtonRadius() }}
                    >
                      R
                    </div>
                    {theme.logoPosition === 'center' && (
                      <div>
                        <h2 className="text-2xl font-extrabold tracking-tight">The Continental</h2>
                        <p className="text-sm opacity-60 mt-1">Tap to order instantly.</p>
                      </div>
                    )}
                  </div>

                  {theme.logoPosition === 'left' && (
                    <div className="px-6 mb-8">
                      <h2 className="text-3xl font-extrabold tracking-tight">The Continental</h2>
                      <p className="text-sm opacity-60 mt-1">Tap to order instantly.</p>
                    </div>
                  )}

                  {/* Items Preview */}
                  <div className={`px-5 pb-24 ${theme.layoutStyle === 'grid' || theme.layoutStyle === 'masonry' ? 'grid grid-cols-2 gap-4' : 'space-y-5'}`}>
                    {mockItems.map((item, idx) => (
                      <div 
                        key={item.id} 
                        className={getCardClasses()}
                        style={{ borderRadius: theme.cardStyle === 'minimal' ? '0px' : theme.buttonStyle === 'sharp' ? '0px' : '16px' }}
                      >
                        <img 
                          src={item.img} 
                          alt={item.name} 
                          className={`object-cover ${theme.layoutStyle === 'grid' || theme.layoutStyle === 'masonry' ? 'w-full h-36' : 'w-24 h-24 rounded-lg shrink-0 m-3'}`} 
                        />
                        <div className={`flex flex-col justify-center ${theme.layoutStyle === 'grid' || theme.layoutStyle === 'masonry' ? 'p-4' : 'flex-1 pr-4 py-2'}`}>
                          <h4 className="font-bold text-sm leading-tight mb-1">{item.name}</h4>
                          {theme.layoutStyle === 'list' && (
                            <p className="text-xs opacity-60 line-clamp-2 leading-relaxed mb-3">{item.desc}</p>
                          )}
                          <div className="mt-auto flex justify-between items-center pt-2">
                            <span className="text-sm font-bold" style={{ color: theme.cardStyle === 'glass' ? '#ffffff' : theme.primaryColor }}>{item.price}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Floating Action Button */}
                  <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent pointer-events-none flex justify-center z-50">
                    <button 
                      className="w-full py-4 font-bold text-sm shadow-2xl flex items-center justify-center gap-2 text-white pointer-events-auto transition-transform hover:scale-105"
                      style={{ backgroundColor: theme.primaryColor, borderRadius: getButtonRadius() }}
                    >
                      View Cart (0)
                    </button>
                  </div>
                </>
              )}
              
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
