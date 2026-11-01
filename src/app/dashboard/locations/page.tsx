"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { LocalSqliteStore, getCanonicalRestaurantId } from "@/lib/localSqliteStore";
import { OfflineSyncEngine } from "@/lib/offlineSyncEngine";
import { Loader2, Plus, Trash2, Edit2, Download, Users, AlertTriangle, Link as LinkIcon, Search, CheckCircle2, QrCode, Layers } from "lucide-react";
import QRCode from "react-qr-code";
import { normalizeTableIdentifier } from "@/utils/tableSessionPin";

interface Location {
  id: string;
  restaurant_id: string;
  type: string;
  name: string;
  secure_code: string;
  isActive?: boolean;
  capacity?: number;
  zone?: string;
}

export default function TableManagerPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string>('');
  const [businessType, setBusinessType] = useState<string>('RESTAURANT');
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Zone State
  const [zones, setZones] = useState<string[]>([]);
  const [tableZones, setTableZones] = useState<Record<string, string>>({});
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('ALL');
  const [isCreatingNewZone, setIsCreatingNewZone] = useState<boolean>(false);

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

  // Form State - Zone is mandatory
  const [formData, setFormData] = useState({ id: '', name: '', capacity: 4, isActive: true, zone: '' });

  useEffect(() => {
    loadLocations();
    const handleSyncCompleted = () => {
      loadLocations();
    };
    window.addEventListener("tabletapy_sync_completed", handleSyncCompleted);
    return () => window.removeEventListener("tabletapy_sync_completed", handleSyncCompleted);
  }, []);

  // Sync zones with localStorage and cloud configuration
  const syncZones = async (restId: string, updatedTableZones: Record<string, string>, updatedZonesList: string[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`tabletapy_table_zones_${restId}`, JSON.stringify(updatedTableZones));
        localStorage.setItem(`tabletapy_restaurant_zones_${restId}`, JSON.stringify(updatedZonesList));
        window.dispatchEvent(new CustomEvent('tabletapy_locations_updated'));
      } catch {}
    }
    try {
      const { data: r } = await supabase.from('restaurants').select('bg_image').eq('id', restId).maybeSingle();
      let cfg: any = {};
      if (r?.bg_image) {
        try {
          cfg = typeof r.bg_image === 'string' ? JSON.parse(r.bg_image) : r.bg_image;
        } catch {}
      }
      cfg.tableZones = updatedTableZones;
      cfg.zones = updatedZonesList;
      await supabase.from('restaurants').update({ bg_image: JSON.stringify(cfg) }).eq('id', restId);
    } catch (e) {
      console.error('Failed to sync zones to Supabase:', e);
    }
  };

  async function loadLocations() {
    try {
      setLoading(true);
      let restId = await getCanonicalRestaurantId(supabase);
      if (!restId) return;
      setRestaurantId(restId);

      // Instant 0ms hydration from local SQLite
      const localTables = await LocalSqliteStore.getTables(restId);
      if (localTables && localTables.length > 0) {
        setLocations(localTables as any);
        setLoading(false);
      }

      // Load zones from localStorage & cloud config
      let loadedTableZones: Record<string, string> = {};
      let loadedZonesList: string[] = [];

      if (typeof window !== 'undefined') {
        try {
          const rawTableZones = localStorage.getItem(`tabletapy_table_zones_${restId}`);
          if (rawTableZones) loadedTableZones = JSON.parse(rawTableZones);
          const rawZonesList = localStorage.getItem(`tabletapy_restaurant_zones_${restId}`);
          if (rawZonesList) loadedZonesList = JSON.parse(rawZonesList);
        } catch {}
      }

      const { data: restData } = await supabase.from('restaurants').select('slug, business_type, bg_image').eq('id', restId).single();
      if (restData) {
        setRestaurantSlug(restData.slug);
        setBusinessType(restData.business_type || 'RESTAURANT');
        if (restData.bg_image) {
          try {
            const parsed = typeof restData.bg_image === 'string' ? JSON.parse(restData.bg_image) : restData.bg_image;
            if (parsed?.tableZones && Object.keys(loadedTableZones).length === 0) {
              loadedTableZones = parsed.tableZones;
            }
            if (Array.isArray(parsed?.zones) && loadedZonesList.length === 0) {
              loadedZonesList = parsed.zones;
            }
          } catch {}
        }
      }

      const { data: locData } = await supabase.from('locations').select('*').eq('restaurant_id', restId).order('name', { ascending: true });
      
      if (locData) {
        const extractedZones = new Set<string>(loadedZonesList);
        locData.forEach(loc => {
          const z = loadedTableZones[loc.id] || (loc as any).zone;
          if (z && z.trim()) {
            extractedZones.add(z.trim());
            loadedTableZones[loc.id] = z.trim();
          }
        });

        const finalZones = Array.from(extractedZones);
        if (finalZones.length === 0) {
          finalZones.push('Main Floor');
        }

        setZones(finalZones);
        setTableZones(loadedTableZones);

        const localTables = await LocalSqliteStore.getTables(restId);
        const mappedCloud = locData.map(loc => ({ 
          ...loc, 
          isActive: true,
          capacity: 4,
          zone: loadedTableZones[loc.id] || (loc as any).zone || finalZones[0] || 'Main Floor'
        }));

        // Merge local tables not yet in cloud so they never vanish
        const combined = [...mappedCloud];
        for (const lt of localTables) {
          if (!combined.some(c => c.id === lt.id || c.name.trim().toLowerCase() === lt.name.trim().toLowerCase())) {
            combined.push({
              id: lt.id,
              restaurant_id: restId,
              name: lt.name,
              type: lt.type || 'TABLE',
              isActive: lt.is_active !== false,
              capacity: lt.capacity || 4,
              zone: lt.zone || finalZones[0] || 'Main Floor'
            } as any);
          }
        }

        setLocations(combined);
        LocalSqliteStore.saveTables(
          restId,
          combined.map((l: any) => ({
            id: l.id,
            restaurant_id: restId,
            name: l.name,
            type: l.type,
            capacity: l.capacity,
            zone: l.zone || 'Main Floor',
            is_active: l.isActive !== false
          })),
          false
        ).catch(() => {});
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
    const defaultZone = zones.length > 0 ? zones[0] : '';
    setFormData({ id: '', name: '', capacity: 4, isActive: true, zone: defaultZone });
    setIsCreatingNewZone(zones.length === 0);
    setShowAddModal(true);
  };

  const openEditModal = (loc: Location) => {
    const currentZone = loc.zone || tableZones[loc.id] || (zones.length > 0 ? zones[0] : '');
    setFormData({ 
      id: loc.id, 
      name: loc.name, 
      capacity: loc.capacity || 4,
      isActive: loc.isActive ?? true,
      zone: currentZone
    });
    setIsCreatingNewZone(!zones.includes(currentZone) && !!currentZone);
    setShowEditModal(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !formData.name.trim()) return;

    const trimmedName = formData.name.trim().toUpperCase();
    const trimmedZone = (formData.zone || '').trim();

    // 1. Mandatory Zone Validation
    if (!trimmedZone) {
      triggerToast('Zone is mandatory for each table');
      return;
    }
    
    setIsSaving(true);

    // Update zones list if new zone
    let nextZones = [...zones];
    if (!nextZones.includes(trimmedZone)) {
      nextZones.push(trimmedZone);
      setZones(nextZones);
    }
    
    if (showAddModal) {
      // Duplicate name check (case-insensitive)
      const isDuplicate = locations.some(
        l => l.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        triggerToast(`A table named "${trimmedName}" already exists`);
        setIsSaving(false);
        return;
      }

      const code = Math.random().toString(16).substring(2, 10);
      const tableId = 'loc_' + Date.now();
      const newLocObj = {
        id: tableId,
        restaurant_id: restaurantId,
        name: trimmedName,
        type: businessType === 'HOTEL' ? 'ROOM' : 'TABLE',
        secure_code: code,
        zone: trimmedZone,
        capacity: formData.capacity,
        isActive: formData.isActive
      };

      // 1. Instant 0ms SQLite Save
      await LocalSqliteStore.saveSingleTable({
        id: tableId,
        restaurant_id: restaurantId,
        name: trimmedName,
        type: newLocObj.type,
        capacity: formData.capacity,
        zone: trimmedZone,
        is_active: formData.isActive
      });

      // 2. Instant UI update & modal close (0ms)
      const nextTableZones = { ...tableZones, [tableId]: trimmedZone };
      setTableZones(nextTableZones);
      setLocations([...locations, newLocObj as any]);
      setShowAddModal(false);
      setIsSaving(false);
      triggerToast(`${trimmedName} added in zone "${trimmedZone}"`);

      // 3. Background cloud sync
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        LocalSqliteStore.queueMutation({
          id: 'mut_' + Date.now(),
          restaurant_id: restaurantId,
          entity: 'TABLE',
          action: 'INSERT',
          payload: newLocObj,
          created_at: new Date().toISOString()
        });
        OfflineSyncEngine.triggerSync();
      } else {
        (async () => {
          try {
            const { data, error } = await supabase.from('locations').insert({
              restaurant_id: restaurantId,
              name: trimmedName,
              type: newLocObj.type,
              secure_code: code
            }).select();
            if (error) {
              LocalSqliteStore.queueMutation({
                id: 'mut_' + Date.now(),
                restaurant_id: restaurantId,
                entity: 'TABLE',
                action: 'INSERT',
                payload: newLocObj,
                created_at: new Date().toISOString()
              });
            } else if (data && data[0]) {
              const cloudId = data[0].id;
              const updatedZones = { ...tableZones, [cloudId]: trimmedZone };
              setTableZones(updatedZones);
              syncZones(restaurantId, updatedZones, nextZones);
            }
          } catch (e: any) {
            console.warn('[Locations] Cloud insert deferred:', e);
            LocalSqliteStore.queueMutation({
              id: 'mut_' + Date.now(),
              restaurant_id: restaurantId,
              entity: 'TABLE',
              action: 'INSERT',
              payload: newLocObj,
              created_at: new Date().toISOString()
            }).catch(() => {});
          } finally {
            OfflineSyncEngine.triggerSync();
          }
        })();
      }
    } else if (showEditModal && formData.id) {
      // Duplicate name check excluding this table
      const isDuplicate = locations.some(
        l => l.id !== formData.id && l.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (isDuplicate) {
        triggerToast(`A table named "${trimmedName}" already exists`);
        setIsSaving(false);
        return;
      }

      const oldLoc = locations.find(l => l.id === formData.id);
      const oldName = oldLoc?.name.trim() || '';

      // Direct update
      let updateOk = false;
      const { data: uData, error: uErr } = await supabase
        .from('locations')
        .update({ name: trimmedName })
        .eq('id', formData.id)
        .select();

      if (!uErr && uData && uData.length > 0) {
        updateOk = true;
      } else if (oldLoc) {
        // Fallback for missing RLS UPDATE policy: delete & re-insert with identical ID and secure_code
        const { error: dErr } = await supabase.from('locations').delete().eq('id', formData.id);
        if (!dErr) {
          const { data: iData, error: iErr } = await supabase.from('locations').insert({
            id: formData.id,
            restaurant_id: restaurantId,
            type: oldLoc.type || (businessType === 'HOTEL' ? 'ROOM' : 'TABLE'),
            name: trimmedName,
            secure_code: oldLoc.secure_code
          }).select();
          if (!iErr && iData && iData.length > 0) {
            updateOk = true;
          }
        }
      }

      if (updateOk) {
        // Reflect rename across active orders in database so POS & Orders update
        if (oldName && oldName.toLowerCase() !== trimmedName.toLowerCase()) {
          try {
            await supabase
              .from('orders')
              .update({ table_no: trimmedName })
              .eq('restaurant_id', restaurantId)
              .ilike('table_no', oldName);

            const oldNorm = normalizeTableIdentifier(oldName);
            if (oldNorm && oldNorm !== oldName) {
              await supabase
                .from('orders')
                .update({ table_no: trimmedName })
                .eq('restaurant_id', restaurantId)
                .eq('table_no', oldNorm);
            }
          } catch (ordErr) {
            console.error('Order migration error:', ordErr);
          }
        }

        // Sync table zone
        const nextTableZones = { ...tableZones, [formData.id]: trimmedZone };
        setTableZones(nextTableZones);
        await syncZones(restaurantId, nextTableZones, nextZones);

        setLocations(locs => locs.map(l => l.id === formData.id ? {
          ...l,
          name: trimmedName,
          capacity: formData.capacity,
          isActive: formData.isActive,
          zone: trimmedZone
        } : l));

        triggerToast(`${trimmedName} updated successfully`);
      } else {
        triggerToast('Failed to update table in database.');
      }
    }
    
    setIsSaving(false);
    setShowAddModal(false);
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    if (!locToDelete || deleteConfirmText !== 'DELETE') return;
    const toDel = locToDelete;

    // 1. Instant 0ms SQLite Deletion
    if (restaurantId) {
      LocalSqliteStore.deleteTable(restaurantId, toDel.id);
    }

    // 2. Instant UI update
    const nextTableZones = { ...tableZones };
    delete nextTableZones[toDel.id];
    setTableZones(nextTableZones);
    setLocations(locations.filter(loc => loc.id !== toDel.id));
    triggerToast(`${toDel.name} deleted`);
    setLocToDelete(null);
    setDeleteConfirmText('');
    setIsDeleting(false);

    // 3. Background cloud sync
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (restaurantId) {
        LocalSqliteStore.queueMutation({
          id: 'mut_' + Date.now(),
          restaurant_id: restaurantId,
          entity: 'TABLE',
          action: 'DELETE',
          payload: { id: toDel.id, name: toDel.name },
          created_at: new Date().toISOString()
        });
      }
      OfflineSyncEngine.triggerSync();
    } else {
      (async () => {
        try {
          const { error } = await supabase.from('locations').delete().eq('id', toDel.id);
          if (error && restaurantId) {
            LocalSqliteStore.queueMutation({
              id: 'mut_' + Date.now(),
              restaurant_id: restaurantId,
              entity: 'TABLE',
              action: 'DELETE',
              payload: { id: toDel.id, name: toDel.name },
              created_at: new Date().toISOString()
            });
          }
          if (restaurantId) syncZones(restaurantId, nextTableZones, zones);
        } catch (e: any) {
          console.warn('[Locations] Cloud delete deferred:', e);
          if (restaurantId) {
            LocalSqliteStore.queueMutation({
              id: 'mut_' + Date.now(),
              restaurant_id: restaurantId,
              entity: 'TABLE',
              action: 'DELETE',
              payload: { id: toDel.id, name: toDel.name },
              created_at: new Date().toISOString()
            }).catch(() => {});
          }
        } finally {
          OfflineSyncEngine.triggerSync();
        }
      })();
    }
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

  const getPortalUrl = (code: string) => {
    const slug = restaurantSlug || 'menu';
    return `https://${slug}.tabletapy.online/r/${code}?scan=true`;
  };

  const filteredLocations = locations.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.zone && loc.zone.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (selectedZoneFilter !== 'ALL' && loc.zone !== selectedZoneFilter) return false;
    return true;
  });

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-transparent overflow-hidden text-gray-900 dark:text-zinc-100 font-sans relative">
      
      {/* BRAND TOAST NOTIFICATION */}
      <div className={`absolute bottom-8 right-8 z-50 transition-all duration-300 ease-out ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-gray-900 border-l-4 border-[#E46254] shadow-lg rounded-r-lg rounded-l-md px-5 py-3 flex items-center gap-3 min-w-[280px]">
          <CheckCircle2 size={18} className="text-[#E46254]" />
          <span className="text-[13px] font-medium text-white">{toast.message}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto slim-scrollbar px-6 md:px-12 w-full relative">
        
        {/* COMPACT FLOATING SEARCH & ADD BAR */}
        <div className="sticky top-0 z-30 pt-6 pb-4 bg-white/90 dark:bg-zinc-950/75 backdrop-blur-2xl flex flex-col gap-3 border-b border-gray-100 dark:border-white/[0.08] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${locations.length} tables...`}
                className="w-full bg-gray-50 dark:bg-[#1C1D26] border border-gray-200 dark:border-white/[0.08] rounded-lg pl-10 pr-4 py-2.5 text-[13px] font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder-[#5E5D72] outline-none focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254] transition-all"
              />
            </div>

            <button 
              onClick={openAddModal}
              className="w-full md:w-auto bg-[#E46254] hover:bg-[#D35546] text-white px-5 py-2.5 rounded-lg shadow-sm active:scale-95 transition-all font-semibold text-[13px] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={16} strokeWidth={3}/> Add {businessType === 'HOTEL' ? 'Room' : 'Table'}
            </button>
          </div>

          {/* Zone Filter Chips */}
          {zones.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                <Layers size={12} /> Zones:
              </span>
              <button
                onClick={() => setSelectedZoneFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedZoneFilter === 'ALL'
                    ? 'bg-zinc-900 dark:bg-[#E46254] text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-[#1C1D26] text-gray-600 dark:text-[#8B8A9E] hover:text-gray-900 dark:hover:text-[#F0EEF4] border border-transparent dark:border-white/[0.06] hover:bg-gray-200 dark:hover:bg-[#22232E]'
                }`}
              >
                All Zones ({locations.length})
              </button>
              {zones.map(z => {
                const count = locations.filter(l => (l.zone || 'Main Floor') === z).length;
                return (
                  <button
                    key={z}
                    onClick={() => setSelectedZoneFilter(z)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      selectedZoneFilter === z
                        ? 'bg-zinc-900 dark:bg-[#E46254] text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-[#1C1D26] text-gray-600 dark:text-[#8B8A9E] hover:text-gray-900 dark:hover:text-[#F0EEF4] border border-transparent dark:border-white/[0.06] hover:bg-gray-200 dark:hover:bg-[#22232E]'
                    }`}
                  >
                    {z} ({count})
                  </button>
                );
              })}
            </div>
          )}
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
                className={`rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 border transition-all duration-300 ${loc.isActive ? 'bg-white dark:bg-white/[0.025] dark:backdrop-blur-xl border-gray-200 dark:border-white/[0.08] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.4)] hover:shadow-md dark:hover:border-white/[0.18]' : 'border-gray-100 dark:border-white/[0.05] bg-white/60 dark:bg-white/[0.01] opacity-70'} group`}
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
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-none">{loc.name}</h3>
                      {loc.zone && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#E46254]/10 text-[#E46254] border border-[#E46254]/20">
                          {loc.zone}
                        </span>
                      )}
                    </div>
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
                    {getPortalUrl(loc.secure_code).replace(/^https?:\/\//, '')}
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
          <div className="bg-white dark:bg-[#1C1D26] border border-transparent dark:border-white/[0.08] rounded-2xl shadow-xl max-w-sm w-full overflow-hidden text-gray-900 dark:text-white">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-white/[0.07]">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {showAddModal ? `Add New ${businessType === 'HOTEL' ? 'Room' : 'Table'}` : `Edit Settings`}
              </h2>
            </div>
            
            <form onSubmit={handleSaveLocation} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Table Name / Identifier</label>
                <input 
                  required autoFocus
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                  placeholder="e.g. TABLE 12"
                  className="w-full bg-white dark:bg-[#22232E] border border-gray-300 dark:border-white/[0.08] rounded-lg px-3 py-2.5 text-[13px] font-medium text-gray-900 dark:text-white outline-none focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254] transition-all font-mono" 
                />
              </div>

              {/* Dining Zone - Mandatory with Dropdown & Create Option */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-bold text-gray-700">
                    Dining Zone <span className="text-[#E46254]">*</span>
                  </label>
                  {zones.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCreatingNewZone) {
                          setIsCreatingNewZone(false);
                          setFormData({ ...formData, zone: zones[0] });
                        } else {
                          setIsCreatingNewZone(true);
                          setFormData({ ...formData, zone: '' });
                        }
                      }}
                      className="text-[11px] font-bold text-[#E46254] hover:underline cursor-pointer"
                    >
                      {isCreatingNewZone ? "← Choose existing zone" : "+ Add New Zone"}
                    </button>
                  )}
                </div>

                {!isCreatingNewZone && zones.length > 0 ? (
                  <select 
                    required
                    value={formData.zone}
                    onChange={(e) => {
                      if (e.target.value === '__CREATE_NEW__') {
                        setIsCreatingNewZone(true);
                        setFormData({ ...formData, zone: '' });
                      } else {
                        setFormData({ ...formData, zone: e.target.value });
                      }
                    }}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254] transition-all cursor-pointer"
                  >
                    <option value="" disabled>Select a zone</option>
                    {zones.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                    <option value="__CREATE_NEW__">+ Create another zone...</option>
                  </select>
                ) : (
                  <div>
                    <input 
                      required
                      type="text" 
                      value={formData.zone} 
                      onChange={e => setFormData({...formData, zone: e.target.value})} 
                      placeholder="e.g. Ground Floor, Balcony, Rooftop"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254] transition-all" 
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Once added, this zone becomes available in the dropdown for other tables.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Seat Capacity</label>
                <input 
                  required 
                  type="number" min="1" max="20"
                  value={formData.capacity} 
                  onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 1})} 
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none focus:border-[#E46254] focus:ring-1 focus:ring-[#E46254] transition-all" 
                />
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="w-full bg-[#E46254] hover:bg-[#D35546] text-white px-4 py-2.5 rounded-lg text-[13px] font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : "Save Details"}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                  className="w-full px-4 py-2.5 text-[13px] font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 cursor-pointer"
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
                onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
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
