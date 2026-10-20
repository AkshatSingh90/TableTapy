"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Plus, Trash2, Edit2, Download, Users, AlertTriangle, Link as LinkIcon, Search, CheckCircle2, QrCode } from "lucide-react";
import QRCode from "react-qr-code";

interface Location {
  id: string;
  restaurant_id: string;
  type: string;
  name: string;
  secure_code: string;
  isActive?: boolean;
  capacity?: number;
}

export default function TableManagerPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string>('');
  const [businessType, setBusinessType] = useState<string>('RESTAURANT');
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Feedback State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete State
  const [locToDelete, setLocToDelete] = useState<Location | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // QR Modal State
  const [qrExpanded, setQrExpanded] = useState<Location | null>(null);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  // Form State
  const [formData, setFormData] = useState({ id: '', name: '', capacity: 4, isActive: true });

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.user_metadata?.restaurant_id) return;
      
      const restId = user.user_metadata.restaurant_id;
      setRestaurantId(restId);

      const { data: restData } = await supabase.from('restaurants').select('slug, business_type').eq('id', restId).single();
      if (restData) {
        setRestaurantSlug(restData.slug);
        setBusinessType(restData.business_type || 'RESTAURANT');
      }

      const { data: locData } = await supabase.from('locations').select('*').eq('restaurant_id', restId).order('name', { ascending: true });
      
      if (locData) {
        setLocations(locData.map(loc => ({ 
          ...loc, 
          isActive: true,
          capacity: 4
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  }

  const triggerToast = (message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 3000);
  };

  const openAddModal = () => {
    setFormData({ id: '', name: '', capacity: 4, isActive: true });
    setShowAddModal(true);
  };

  const openEditModal = (loc: Location) => {
    setFormData({ 
      id: loc.id, 
      name: loc.name, 
      capacity: loc.capacity || 4,
      isActive: loc.isActive ?? true 
    });
    setShowEditModal(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !formData.name.trim()) return;
    
    setIsSaving(true);
    
    if (showAddModal) {
      const code = Math.random().toString(16).substring(2, 10);
      const newLoc = {
        restaurant_id: restaurantId,
        name: formData.name.trim(),
        type: businessType === 'HOTEL' ? 'ROOM' : 'TABLE',
        secure_code: code
      };

      const { data, error } = await supabase.from('locations').insert(newLoc).select();
      if (!error && data) {
        setLocations([...locations, { 
          ...data[0], 
          isActive: formData.isActive, 
          capacity: formData.capacity 
        }]);
        triggerToast(`${formData.name.trim()} added successfully`);
      }
    } else if (showEditModal && formData.id) {
      const { error } = await supabase.from('locations').update({ name: formData.name.trim() }).eq('id', formData.id);
      if (!error) {
        setLocations(locs => locs.map(l => l.id === formData.id ? {
          ...l,
          name: formData.name.trim(),
          capacity: formData.capacity,
          isActive: formData.isActive
        } : l));
        triggerToast(`${formData.name.trim()} updated successfully`);
      }
    }
    
    setIsSaving(false);
    setShowAddModal(false);
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    if (!locToDelete || deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    const { error } = await supabase.from('locations').delete().eq('id', locToDelete.id);
    if (!error) {
      setLocations(locations.filter(loc => loc.id !== locToDelete.id));
      triggerToast(`${locToDelete.name} deleted`);
      setLocToDelete(null);
      setDeleteConfirmText('');
    }
    setIsDeleting(false);
  };

  const toggleActive = (id: string, currentStatus: boolean | undefined) => {
    const locName = locations.find(l => l.id === id)?.name;
    setLocations(locs => locs.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
    triggerToast(`${locName} is now ${!currentStatus ? 'Active' : 'Disabled'}`);
  };

  const downloadQR = (loc: Location, sourceId: string) => {
    const svg = document.getElementById(sourceId);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${loc.name}-QR.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
      triggerToast(`QR Code for ${loc.name} downloaded`);
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const getPortalUrl = (code: string) => `http://${restaurantSlug}.localhost:3000/r/${code}?scan=true`;

  const filteredLocations = locations.filter(loc => loc.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden text-gray-900 font-sans relative">
      
      {/* BRAND TOAST NOTIFICATION */}
      <div className={`absolute bottom-8 right-8 z-50 transition-all duration-300 ease-out ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-gray-900 border-l-4 border-[#E46254] shadow-lg rounded-r-lg rounded-l-md px-5 py-3 flex items-center gap-3 min-w-[280px]">
          <CheckCircle2 size={18} className="text-[#E46254]" />
          <span className="text-[13px] font-medium text-white">{toast.message}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto slim-scrollbar px-6 md:px-12 w-full relative">
        
        {/* COMPACT FLOATING SEARCH & ADD BAR */}
        <div className="sticky top-0 z-30 pt-6 pb-4 bg-white/90 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-100">
          
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${locations.length} tables...`}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-[13px] font-medium text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254] transition-all"
            />
          </div>

          <button 
            onClick={openAddModal}
            className="w-full md:w-auto bg-[#E46254] hover:bg-[#D35546] text-white px-5 py-2.5 rounded-lg shadow-sm active:scale-95 transition-all font-semibold text-[13px] flex items-center justify-center gap-2"
          >
            <Plus size={16} strokeWidth={3}/> Add {businessType === 'HOTEL' ? 'Room' : 'Table'}
          </button>
        </div>

        {/* MAIN CONTENT - COMPACT WHITE CARDS */}
        <div className="max-w-5xl mx-auto w-full space-y-3 pb-20 mt-4">
          
          {loading ? (
            // SKELETON LOADERS
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 flex items-center justify-between shadow-sm animate-pulse">
                <div className="flex items-center gap-6">
                  <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-gray-100 rounded-md"></div>
                    <div className="h-3 w-20 bg-gray-100 rounded-md"></div>
                  </div>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg hidden md:block"></div>
              </div>
            ))
          ) : filteredLocations.length === 0 ? (
            // EMPTY STATE
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 mb-4">
                <Search size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">No tables found</h3>
              <p className="text-[14px] text-gray-500 max-w-sm font-medium">Create your first table or adjust your search to see results.</p>
            </div>
          ) : (
            // WHITE CARDS
            filteredLocations.map((loc) => (
              <div 
                key={loc.id} 
                className={`bg-white rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 border shadow-sm hover:shadow-md transition-all duration-300 ${loc.isActive ? 'border-gray-200' : 'border-gray-100 opacity-70'} group`}
              >
                
                {/* 1. Left: Explicit Toggle & Name */}
                <div className="flex items-center gap-5 md:gap-6 min-w-[200px]">
                  
                  {/* Sleek iOS-Style Toggle */}
                  <div className="flex flex-col items-center gap-1.5 border-r border-gray-100 pr-5">
                    <button 
                      onClick={() => toggleActive(loc.id, loc.isActive)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner ${loc.isActive ? 'bg-[#E46254]' : 'bg-gray-200'}`}
                      title={loc.isActive ? 'Mark Disabled' : 'Mark Active'}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${loc.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${loc.isActive ? 'text-[#E46254]' : 'text-gray-400'}`}>
                      {loc.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight leading-none mb-1.5">{loc.name}</h3>
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500">
                      <Users size={14} className="text-gray-400"/> {loc.capacity} Seats
                    </div>
                  </div>
                </div>

                {/* 2. Middle: Clean Order Link */}
                <div className="flex-1 hidden lg:block px-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Direct Ordering Link</p>
                  <a 
                    href={getPortalUrl(loc.secure_code)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#E46254] hover:text-[#D35546] hover:underline transition-colors"
                  >
                    <LinkIcon size={14} /> 
                    {getPortalUrl(loc.secure_code).replace('http://', '')}
                  </a>
                </div>

                {/* 3. Right: Always Visible Actions & QR */}
                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-2 md:mt-0 border-l border-gray-100 pl-5">
                  
                  {/* Polished Explicit Buttons */}
                  <div className="flex flex-col gap-2.5">
                    <button 
                      onClick={() => openEditModal(loc)}
                      className="w-24 px-3 py-2 flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:border-[#E46254] hover:text-[#E46254] text-gray-600 text-[12px] font-semibold rounded-lg transition-all shadow-sm"
                    >
                      <Edit2 size={13} strokeWidth={2.5}/> Edit
                    </button>
                    <button 
                      onClick={() => { setLocToDelete(loc); setDeleteConfirmText(''); }}
                      className="w-24 px-3 py-2 flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:border-red-500 hover:text-red-600 hover:bg-red-50 text-gray-600 text-[12px] font-semibold rounded-lg transition-all shadow-sm"
                    >
                      <Trash2 size={13} strokeWidth={2.5}/> Delete
                    </button>
                  </div>

                  {/* Clickable QR Thumbnail (Bigger, No Border) */}
                  <div 
                    onClick={() => setQrExpanded(loc)}
                    className="cursor-pointer hover:scale-105 transition-transform origin-center ml-2"
                    title="Expand QR Code"
                  >
                    <QRCode value={getPortalUrl(loc.secure_code)} size={64} viewBox={`0 0 256 256`} style={{ display: 'block' }} />
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* QR EXPAND MODAL */}
      {qrExpanded && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center relative">
             <button 
               onClick={() => setQrExpanded(null)} 
               className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors font-black"
             >
               ×
             </button>
             
             <h2 className="text-xl font-bold text-gray-900 mb-1">{qrExpanded.name}</h2>
             <p className="text-gray-500 text-[13px] font-medium mb-6">Scan to order from this {businessType === 'HOTEL' ? 'room' : 'table'}.</p>
             
             <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm inline-block mb-6">
               <QRCode 
                 id={`expanded-qr-${qrExpanded.id}`}
                 value={getPortalUrl(qrExpanded.secure_code)} 
                 size={200}
                 viewBox={`0 0 256 256`}
               />
             </div>
             
             <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-6 text-left">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Direct Link</p>
                <a href={getPortalUrl(qrExpanded.secure_code)} target="_blank" rel="noreferrer" className="text-[13px] text-[#E46254] font-medium break-all hover:underline flex items-center gap-1.5">
                  <LinkIcon size={14} className="shrink-0"/> {getPortalUrl(qrExpanded.secure_code)}
                </a>
             </div>

             <button 
               onClick={() => downloadQR(qrExpanded, `expanded-qr-${qrExpanded.id}`)} 
               className="w-full py-3 bg-[#E46254] hover:bg-[#D35546] text-white font-bold rounded-xl transition-all text-[13px] shadow-sm active:scale-95 flex justify-center items-center gap-2"
             >
                <Download size={16} /> Download PNG Image
             </button>
          </div>
        </div>
      )}

      {/* REUSABLE ADD/EDIT DIALOG */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {showAddModal ? `Add New ${businessType === 'HOTEL' ? 'Room' : 'Table'}` : `Edit Settings`}
              </h2>
            </div>
            
            <form onSubmit={handleSaveLocation} className="p-6 space-y-5">
              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Table Name / Identifier</label>
                <input 
                  required autoFocus
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                  placeholder="e.g. TABLE 12"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254] transition-all" 
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Seat Capacity</label>
                <input 
                  required 
                  type="number" min="1" max="20"
                  value={formData.capacity} 
                  onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})} 
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254] transition-all" 
                />
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="w-full bg-[#E46254] hover:bg-[#D35546] text-white px-4 py-2.5 rounded-lg text-[13px] font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : "Save Details"}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                  className="w-full px-4 py-2.5 text-[13px] font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2-STEP DELETE CONFIRMATION DIALOG */}
      {locToDelete && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-4">
               <AlertTriangle size={28} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete {locToDelete.name}?</h2>
            <p className="text-[13px] text-gray-600 font-medium mb-6">
              This action is permanent and will instantly invalidate the physical QR code.
            </p>
            
            <div className="text-left mb-6">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">
                Type <span className="text-red-600 font-black">DELETE</span> to confirm
              </label>
              <input 
                type="text" 
                autoFocus
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-center text-[13px] font-bold outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-all uppercase"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <button 
                onClick={handleDelete}
                disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold rounded-lg transition-all text-[13px] shadow-sm active:scale-95 flex justify-center items-center"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Permanently Delete"}
              </button>
              <button 
                onClick={() => { setLocToDelete(null); setDeleteConfirmText(''); }}
                className="w-full py-2.5 text-gray-600 font-semibold hover:bg-gray-50 rounded-lg transition-all text-[13px] border border-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
