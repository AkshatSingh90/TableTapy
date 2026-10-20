import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { TentCardTemplate } from '@/lib/mockData';

interface LiveCardPreviewProps {
  restaurantName: string;
  tagline: string;
  color: string;
  template: TentCardTemplate;
  tableNumber: string | null;
  baseUrl: string;
}

export default function LiveCardPreview({
  restaurantName,
  tagline,
  color,
  template,
  tableNumber,
  baseUrl,
}: LiveCardPreviewProps) {
  // The actual URL the QR code will point to
  const destinationUrl = tableNumber ? `${baseUrl}?table=${tableNumber}` : baseUrl;

  // Derive styles from the selected template configuration
  const { align, qrPosition, font } = template.layoutConfig;
  const isSerif = font === 'font-serif';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-gray-50/50 rounded-2xl p-8 border border-gray-100">
      <div className="mb-6 text-sm text-gray-400 font-medium tracking-widest uppercase">Live Physical Preview</div>
      
      {/* The Physical Card Mockup */}
      <div className="relative bg-white rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-[320px] h-[480px] overflow-hidden flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.02] border border-gray-100/50">
        
        {/* Accent Bar (if template uses top alignment) */}
        {qrPosition === 'top' && (
          <div className="h-2 w-full" style={{ backgroundColor: color }} />
        )}

        <div className={`flex flex-col h-full p-8 ${align === 'center' ? 'items-center text-center' : 'items-start text-left'}`}>
          
          {/* Top Section */}
          <div className="flex-1 w-full flex flex-col justify-start mt-4">
            {qrPosition !== 'top' && (
              <h1 
                className={`text-3xl font-bold tracking-tight mb-2 ${isSerif ? 'font-serif' : 'font-sans'}`}
                style={{ color: '#111' }}
              >
                {restaurantName || 'Restaurant Name'}
              </h1>
            )}
            
            {tagline && qrPosition !== 'top' && (
              <p className="text-gray-500 text-sm italic mb-6">
                {tagline}
              </p>
            )}

            {/* Top QR variant */}
            {qrPosition === 'top' && (
              <div className="flex w-full justify-center mb-8">
                 <QRCodeSVG 
                  value={destinationUrl} 
                  size={140}
                  fgColor="#111"
                  className="p-2 bg-white rounded-lg shadow-sm border border-gray-100" 
                />
              </div>
            )}
          </div>

          {/* Center/Bottom QR variant */}
          {qrPosition !== 'top' && (
            <div className="flex flex-col items-center justify-center w-full mb-8">
               <div className="p-3 bg-white rounded-xl shadow-[0_5px_15px_rgba(0,0,0,0.08)] border border-gray-100 transition-all">
                  <QRCodeSVG 
                    value={destinationUrl} 
                    size={160}
                    fgColor={color} // Use accent color for QR to make it premium
                  />
               </div>
               <div className="mt-6 flex items-center gap-2 text-gray-400 font-medium text-xs tracking-widest uppercase">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }}></span>
                  NFC Enabled • Tap or Scan
               </div>
            </div>
          )}

          {/* Bottom Section */}
          <div className="w-full flex justify-between items-end border-t border-gray-100 pt-4 mt-auto">
             <div>
               <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Table No.</p>
               <p className="text-2xl font-bold" style={{ color }}>{tableNumber || 'Any'}</p>
             </div>
             {qrPosition === 'top' && (
                <div className="text-right">
                  <h1 className={`text-xl font-bold ${isSerif ? 'font-serif' : 'font-sans'}`} style={{ color: '#111' }}>{restaurantName}</h1>
                  <p className="text-xs text-gray-500">{tagline}</p>
                </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}
