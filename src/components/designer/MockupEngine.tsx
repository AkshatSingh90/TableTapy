import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DesignState, PRODUCT_CATALOG } from '@/lib/catalog';

interface MockupEngineProps {
  design: DesignState;
  view: 'front' | 'back' | 'angled' | 'lifestyle';
}

export default function MockupEngine({ design, view }: MockupEngineProps) {
  const product = PRODUCT_CATALOG.find(p => p.id === design.productId);
  const finish = product?.finishes.find(f => f.id === design.finishId);
  const bgColor = finish?.colorHex || '#ffffff';
  
  let transformStyle = '';
  let shadowStyle = '';
  
  if (view === 'angled') {
    transformStyle = 'perspective(1200px) rotateY(-25deg) rotateX(10deg) scale(0.9)';
    shadowStyle = '20px 20px 40px rgba(0,0,0,0.5), -10px -10px 20px rgba(255,255,255,0.05)';
  } else if (view === 'lifestyle') {
    transformStyle = 'perspective(1000px) rotateY(10deg) scale(0.85)';
    shadowStyle = '30px 40px 50px rgba(0,0,0,0.6)';
  } else {
    transformStyle = 'scale(1)';
    shadowStyle = '0px 10px 30px rgba(0,0,0,0.3)';
  }

  const renderContent = () => (
    <div className="flex flex-col items-center justify-center w-full h-full p-8 text-center relative z-10">
      
      {design.logoUrl ? (
        <div className="mb-6 w-32 h-32 flex items-center justify-center">
          <img 
            src={design.logoUrl} 
            alt="Customer Logo" 
            className="max-w-full max-h-full object-contain drop-shadow-sm"
            style={design.removeBackground ? { mixBlendMode: 'multiply' } : {}} 
          />
        </div>
      ) : (
        <div className="mb-6 w-32 h-32 border-2 border-dashed border-gray-400/50 rounded-xl flex items-center justify-center text-gray-400/70 text-sm font-semibold">
          [ Logo Area ]
        </div>
      )}

      <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: finish?.colorHex === '#333333' || finish?.colorHex === '#1A1A1A' ? '#fff' : '#111' }}>
        {design.businessName || 'Your Business Name'}
      </h2>
      <p className="text-sm font-medium opacity-70 mb-8" style={{ color: finish?.colorHex === '#333333' || finish?.colorHex === '#1A1A1A' ? '#ccc' : '#444' }}>
        {design.customText || 'Your custom message or CTA'}
      </p>

      {(design.qrUrl && product?.allowsQr) && (
        <div className="p-3 bg-white rounded-xl shadow-sm">
          <QRCodeSVG value={design.qrUrl} size={110} />
        </div>
      )}
      
      {product?.allowsNfc && (
        <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60" style={{ color: finish?.colorHex === '#333333' || finish?.colorHex === '#1A1A1A' ? '#fff' : '#111' }}>
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Tap to Connect
        </div>
      )}
    </div>
  );

  const getProductGeometry = () => {
    switch(design.productId) {
      case 'nfc_stand': return 'w-[280px] h-[400px] rounded-tl-3xl rounded-tr-3xl rounded-bl-sm rounded-br-sm border-b-8 border-gray-900/40';
      case 'wood_block': return 'w-[200px] h-[200px] rounded-2xl border-b-[12px] border-black/40';
      case 'wood_plaque': return 'w-[260px] h-[380px] rounded-2xl border-b-[16px] border-black/50';
      case 'tent_card': return 'w-[300px] h-[450px] rounded-md border-b-[20px] border-black/20';
      case 'nfc_card': return 'w-[340px] h-[215px] rounded-xl';
      default: return 'w-[300px] h-[400px] rounded-xl';
    }
  };

  return (
    <div className="w-full h-full min-h-[600px] flex items-center justify-center bg-black overflow-hidden relative">
      
      {/* 3D Container */}
      <div 
        className={`relative transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${getProductGeometry()}`}
        style={{ 
          transform: transformStyle,
          boxShadow: shadowStyle,
          backgroundColor: bgColor,
          backgroundImage: design.productId.includes('wood') 
            ? 'linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.05) 75%, transparent 75%, transparent)' 
            : 'none',
          backgroundSize: '10px 10px'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none rounded-inherit mix-blend-overlay z-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none rounded-inherit z-0" />
        {renderContent()}
      </div>
    </div>
  );
}
