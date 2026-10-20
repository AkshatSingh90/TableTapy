"use client";

import React, { useState, useEffect } from "react";
import { 
  KeyRound, Copy, Check, Loader2, Plus, 
  Eye, EyeOff, Smartphone, ShieldCheck, Users, 
  Trash2, X, AlertCircle
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export interface StaffRecord {
  id: string;
  name: string;
  role: 'CAPTAIN' | 'WAITER' | 'STEWARD' | 'CHEF' | 'MANAGER';
  phone?: string;
  assigned_tables: string[]; // ['ALL'] or specific table names e.g. ['Table 01', 'Table 02']
  created_at: string;
}

export default function StaffsDashboardPage() {
  const supabase = createClient();

  // Restaurant details & Security
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [restaurantCode, setRestaurantCode] = useState<string>('');
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [staffPin, setStaffPin] = useState<string>('1234');
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Available Tables
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  // Staff List State
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);

  // Add Staff Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: 'CAPTAIN' as StaffRecord['role'],
    phone: '',
    tableSelection: 'ALL' as 'ALL' | 'CUSTOM',
    selectedTables: [] as string[],
  });
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [addError, setAddError] = useState('');

  // Delete State
  const [staffToDelete, setStaffToDelete] = useState<StaffRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy Feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const restId = user?.user_metadata?.restaurant_id;

      if (restId) {
        setRestaurantId(restId);

        // 1. Restaurant credentials
        const { data: restData } = await supabase
          .from('restaurants')
          .select('id, name, slug, bg_pattern')
          .eq('id', restId)
          .maybeSingle();

        if (restData) {
          if (restData.name) setRestaurantName(restData.name);

          // Extract or compute deterministic 5-character ID
          let computedCode = '';
          if (restData.bg_pattern && restData.bg_pattern.includes('CODE:')) {
            computedCode = restData.bg_pattern.split('CODE:')[1].split('|')[0].trim().toUpperCase();
          } else {
            const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
            let hash = 0;
            for (let i = 0; i < restId.length; i++) {
              hash = (hash * 31 + restId.charCodeAt(i)) >>> 0;
            }
            for (let i = 0; i < 5; i++) {
              computedCode += chars[hash % chars.length];
              hash = Math.floor(hash / chars.length) ^ (i * 7);
            }
          }
          setRestaurantCode(computedCode);

          // Extract PIN
          let currentPin = '1234';
          if (restData.bg_pattern && restData.bg_pattern.includes('PIN:')) {
            currentPin = restData.bg_pattern.split('PIN:')[1].split('|')[0].trim();
          } else {
            const savedLocalPin = localStorage.getItem(`tabletapy_staff_pin_${restId}`);
            if (savedLocalPin) currentPin = savedLocalPin;
          }
          setStaffPin(currentPin);
        }

        // 2. Fetch tables for restaurant
        const { data: locData } = await supabase
          .from('locations')
          .select('name')
          .eq('restaurant_id', restId)
          .order('name', { ascending: true });

        if (locData && locData.length > 0) {
          setAvailableTables(locData.map(l => l.name));
        } else {
          // Standard floor tables fallback
          setAvailableTables(['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05', 'Table 06', 'Table 07', 'Table 08']);
        }

        // 3. Fetch Staff roster
        const { data: staffData } = await supabase
          .from('inventory_items')
          .select('*')
          .eq('category', 'STAFF_ROSTER')
          .order('created_at', { ascending: false });

        let roster: StaffRecord[] = [];
        if (staffData && staffData.length > 0) {
          roster = staffData
            .map((item: any) => {
              let meta: any = {};
              try {
                if (item.name.startsWith('STAFF:')) {
                  meta = JSON.parse(item.name.replace('STAFF:', ''));
                }
              } catch {}
              return {
                id: item.id,
                name: meta.name || item.name.replace('STAFF:', ''),
                role: meta.role || 'CAPTAIN',
                phone: meta.phone || '',
                assigned_tables: meta.assigned_tables || ['ALL'],
                restaurant_id: meta.restaurant_id || null,
                created_at: item.created_at || new Date().toISOString(),
              };
            })
            // Strictly isolate to the current restaurant!
            .filter((s: any) => s.restaurant_id === restId);
        }

        // Filter out legacy mock members (e.g. stf_1, stf_2) so only user-created staff exist
        const isMockStaff = (s: any) => 
          s.id === 'stf_1' || s.id === 'stf_2' || s.id === 'stf_3' || s.id === 'stf_4' || s.id === 'stf_5' ||
          s.name === 'Rahul Sharma' || s.name === 'Vikram Singh' || s.name === 'Amit Patel' || s.name === 'Suresh Kumar' || s.name === 'Manager on Duty';

        roster = roster.filter(s => !isMockStaff(s));

        // Check local storage for real added staff
        const localStaffRaw = localStorage.getItem(`tabletapy_custom_staff_${restId}`);
        if (localStaffRaw) {
          try {
            const localStaffList: StaffRecord[] = JSON.parse(localStaffRaw);
            const filteredLocal = localStaffList.filter(s => !isMockStaff(s));
            
            // Clean up localStorage if old mock data was in there
            if (filteredLocal.length !== localStaffList.length) {
              localStorage.setItem(`tabletapy_custom_staff_${restId}`, JSON.stringify(filteredLocal));
            }

            const existingIds = new Set(roster.map(s => s.id));
            filteredLocal.forEach(ls => {
              if (!existingIds.has(ls.id)) roster.push(ls);
            });
          } catch {}
        }

        setStaffList(roster);
      }
    } catch (err) {
      console.error("Error loading credentials:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleUpdatePin = async () => {
    if (pinDraft.length !== 4 || isNaN(Number(pinDraft))) {
      alert("PIN must be exactly 4 digits.");
      return;
    }

    try {
      setSavingPin(true);
      const newPattern = `CODE:${restaurantCode}|PIN:${pinDraft}`;
      const { error } = await supabase
        .from('restaurants')
        .update({ bg_pattern: newPattern })
        .eq('id', restaurantId);

      if (!error) {
        setStaffPin(pinDraft);
        localStorage.setItem(`tabletapy_staff_pin_${restaurantId}`, pinDraft);
        setIsEditingPin(false);
      } else {
        localStorage.setItem(`tabletapy_staff_pin_${restaurantId}`, pinDraft);
        setStaffPin(pinDraft);
        setIsEditingPin(false);
      }
    } catch (err) {
      localStorage.setItem(`tabletapy_staff_pin_${restaurantId}`, pinDraft);
      setStaffPin(pinDraft);
      setIsEditingPin(false);
    } finally {
      setSavingPin(false);
    }
  };

  // Toggle Table in Add Staff Form
  const handleToggleTable = (table: string) => {
    if (newStaff.selectedTables.includes(table)) {
      setNewStaff({
        ...newStaff,
        selectedTables: newStaff.selectedTables.filter(t => t !== table)
      });
    } else {
      setNewStaff({
        ...newStaff,
        selectedTables: [...newStaff.selectedTables, table]
      });
    }
  };

  // Add Staff Member
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!newStaff.name.trim()) {
      setAddError('Staff name is required.');
      return;
    }

    const assigned = newStaff.tableSelection === 'ALL' || newStaff.selectedTables.length === 0
      ? ['ALL']
      : newStaff.selectedTables;

    try {
      setSubmittingStaff(true);
      const newId = `stf_${Date.now()}`;
      const payload: StaffRecord & { restaurant_id?: string } = {
        id: newId,
        name: newStaff.name.trim(),
        role: newStaff.role,
        phone: newStaff.phone.trim() || undefined,
        assigned_tables: assigned,
        created_at: new Date().toISOString(),
        restaurant_id: restaurantId,
      };

      const { data: dbItem } = await supabase
        .from('inventory_items')
        .insert([{
          name: `STAFF:${JSON.stringify(payload)}`,
          category: 'STAFF_ROSTER',
          stock: 1,
          threshold: 0,
          storage_unit: 'person',
          vendor_unit: 'staff',
          vendor_to_storage: 1,
          cost_per_vendor_unit: 0,
          price_last_month: 0,
          recipe_unit: 'person'
        }])
        .select()
        .maybeSingle();

      const savedRecord = dbItem ? { ...payload, id: dbItem.id } : payload;
      const updatedList = [savedRecord, ...staffList];
      setStaffList(updatedList);

      if (restaurantId) {
        localStorage.setItem(`tabletapy_custom_staff_${restaurantId}`, JSON.stringify(updatedList));
      }

      setNewStaff({
        name: '',
        role: 'CAPTAIN',
        phone: '',
        tableSelection: 'ALL',
        selectedTables: []
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add staff member.');
    } finally {
      setSubmittingStaff(false);
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;

    try {
      setIsDeleting(true);
      if (staffToDelete.id && staffToDelete.id.length > 20) {
        await supabase.from('inventory_items').delete().eq('id', staffToDelete.id);
      }

      const updated = staffList.filter(s => s.id !== staffToDelete.id);
      setStaffList(updated);
      if (restaurantId) {
        localStorage.setItem(`tabletapy_custom_staff_${restaurantId}`, JSON.stringify(updated));
      }
      setStaffToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-white text-zinc-900 font-sans p-6 md:p-10">
      
      {/* ─── Full-Width Header Bar ────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-zinc-900 tracking-tight">Staff Terminal Access</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            Floor credentials and login details for {restaurantName || 'your restaurant'}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E46254] hover:bg-[#d04e41] text-white text-[13px] font-semibold transition-all shadow-2xs cursor-pointer"
        >
          <Plus size={15} />
          <span>Add Staff</span>
        </button>
      </div>

      {/* ─── 3-Step Guide Across Full Horizontal Space ────── */}
      <div className="mb-6 rounded-2xl bg-[#E46254]/5 border border-[#E46254]/15 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-[#E46254]/15 text-[#E46254] flex items-center justify-center">
            <Smartphone size={14} />
          </div>
          <span className="text-[13px] font-bold text-zinc-900">How floor staff access the terminal:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3.5 border border-[#E46254]/15 flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#E46254]/10 text-[#E46254] text-[12px] font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <p className="text-[12px] font-bold text-zinc-900">Visit Terminal URL</p>
              <p className="text-[11.5px] text-zinc-500 mt-0.5">
                Open <span className="font-mono font-semibold text-[#E46254]">captain.tabletapy.com</span> on floor devices or mobile phones
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-[#E46254]/15 flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#E46254]/10 text-[#E46254] text-[12px] font-bold flex items-center justify-center shrink-0">2</span>
            <div>
              <p className="text-[12px] font-bold text-zinc-900">Enter Credentials</p>
              <p className="text-[11.5px] text-zinc-500 mt-0.5">Type your 5-character Restaurant ID and 4-digit PIN</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-[#E46254]/15 flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[#E46254]/10 text-[#E46254] text-[12px] font-bold flex items-center justify-center shrink-0">3</span>
            <div>
              <p className="text-[12px] font-bold text-zinc-900">Select Name & Fire Orders</p>
              <p className="text-[11.5px] text-zinc-500 mt-0.5">Tap own staff identity to start taking table orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Full-Width Credentials Cards Grid ────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        
        {/* Restaurant Floor ID */}
        <div className="rounded-2xl border border-zinc-200/90 p-5 bg-white flex items-center justify-between shadow-2xs hover:border-zinc-300 transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Restaurant Floor ID
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#E46254]/10 text-[#E46254]">
                5-Character Code
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              {loading ? (
                <Loader2 size={18} className="animate-spin text-[#E46254]" />
              ) : (
                <span className="text-[26px] font-black font-mono text-zinc-900 tracking-wider">
                  {restaurantCode || '•••••'}
                </span>
              )}
              <span className="text-[12px] text-zinc-400">Share this ID with floor staff</span>
            </div>
          </div>
          <button
            onClick={() => handleCopy(restaurantCode, 'code')}
            disabled={loading || !restaurantCode}
            className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200/80 cursor-pointer"
            title="Copy Restaurant ID"
          >
            {copiedField === 'code' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
          </button>
        </div>

        {/* Terminal Access PIN */}
        <div className="rounded-2xl border border-zinc-200/90 p-5 bg-white flex items-center justify-between shadow-2xs hover:border-zinc-300 transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Terminal Access PIN
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                4-Digit Security
              </span>
            </div>

            {isEditingPin ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  maxLength={4}
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="w-20 px-3 py-1 text-base font-mono font-bold border border-[#E46254] rounded-lg focus:outline-hidden text-center bg-white"
                />
                <button
                  disabled={savingPin}
                  onClick={handleUpdatePin}
                  className="px-3 py-1 bg-[#E46254] text-white text-[12px] font-bold rounded-lg hover:bg-[#d04e41] disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {savingPin ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditingPin(false)}
                  className="px-2 py-1 text-zinc-400 text-[12px] hover:text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-baseline gap-3">
                <span className="text-[26px] font-black font-mono text-zinc-900 tracking-widest">
                  {showPin ? staffPin : '••••'}
                </span>
                <button
                  onClick={() => setShowPin(!showPin)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer transition-colors"
                  title={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => {
                    setPinDraft(staffPin);
                    setIsEditingPin(true);
                  }}
                  className="text-[12px] text-[#E46254] hover:underline font-bold cursor-pointer"
                >
                  Change PIN
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => handleCopy(staffPin, 'pin')}
            className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200/80 cursor-pointer"
            title="Copy PIN"
          >
            {copiedField === 'pin' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
          </button>
        </div>

      </div>

      {/* ─── Active Staff Section (if any added) ─────────── */}
      {staffList.length > 0 && (
        <div className="rounded-2xl border border-zinc-200/90 bg-white overflow-hidden shadow-2xs">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-[#E46254]" />
              <h3 className="text-[13px] font-bold text-zinc-900">Floor Staff Roster</h3>
              <span className="px-1.5 py-0.2 bg-zinc-100 text-zinc-600 text-[11px] font-bold rounded-full">
                {staffList.length}
              </span>
            </div>
            <p className="text-[11.5px] text-zinc-400">Available to select on captain terminal</p>
          </div>

          <div className="divide-y divide-zinc-100">
            {staffList.map(staff => (
              <div key={staff.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E46254]/10 text-[#E46254] font-bold text-[12px] flex items-center justify-center shrink-0">
                    {staff.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-zinc-900">{staff.name}</span>
                      <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-zinc-100 text-zinc-600 border border-zinc-200/70">
                        {staff.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11.5px] text-zinc-400 mt-0.5">
                      {staff.phone && <span>{staff.phone}</span>}
                      {staff.phone && <span>·</span>}
                      <span>
                        Assigned: {staff.assigned_tables && staff.assigned_tables.includes('ALL') ? (
                          <strong className="text-zinc-700">All Tables</strong>
                        ) : (
                          <strong className="text-zinc-700">{(staff.assigned_tables || []).join(', ')}</strong>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStaffToDelete(staff)}
                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Remove staff"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Modal: Add Staff Member ────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200 overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="px-5 pt-5 pb-3.5 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-zinc-900">Add Floor Staff Member</h3>
                <p className="text-[11.5px] text-zinc-400 mt-0.5">They will appear on the captain terminal for taking orders</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="p-5 space-y-4">
              {addError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] font-medium rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              {/* Staff Name */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wide mb-1.5">
                  Staff Name <span className="text-[#E46254]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full px-3.5 py-2 text-[13px] bg-white border border-zinc-200 rounded-xl focus:outline-hidden focus:border-[#E46254]"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wide mb-1.5">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3.5 py-2 text-[13px] bg-white border border-zinc-200 rounded-xl focus:outline-hidden focus:border-[#E46254]"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wide mb-1.5">
                  Designation / Role
                </label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as StaffRecord['role'] })}
                  className="w-full px-3.5 py-2 text-[13px] bg-white border border-zinc-200 rounded-xl focus:outline-hidden focus:border-[#E46254]"
                >
                  <option value="CAPTAIN">Captain (Floor Lead & Orders)</option>
                  <option value="WAITER">Waiter (Order Taker)</option>
                  <option value="STEWARD">Steward (Table Servicing)</option>
                  <option value="MANAGER">Manager on Duty</option>
                </select>
              </div>

              {/* Tables Handled / Prioritized */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wide mb-1.5">
                  Tables Under Staff / Handled
                </label>
                
                {/* Radio: ALL vs Custom */}
                <div className="flex items-center gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setNewStaff({ ...newStaff, tableSelection: 'ALL', selectedTables: [] })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-[12px] font-bold border transition-all cursor-pointer ${
                      newStaff.tableSelection === 'ALL'
                        ? 'bg-[#E46254]/10 text-[#E46254] border-[#E46254]/30 shadow-2xs'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    All Tables (Entire Floor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStaff({ ...newStaff, tableSelection: 'CUSTOM' })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-[12px] font-bold border transition-all cursor-pointer ${
                      newStaff.tableSelection === 'CUSTOM'
                        ? 'bg-[#E46254]/10 text-[#E46254] border-[#E46254]/30 shadow-2xs'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    Specific Tables
                  </button>
                </div>

                {/* Specific Tables Pill Picker */}
                {newStaff.tableSelection === 'CUSTOM' && (
                  <div className="p-3 bg-zinc-50/70 border border-zinc-200/80 rounded-xl">
                    <p className="text-[11px] text-zinc-400 mb-2">Tap tables assigned to this staff member:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {availableTables.map(tName => {
                        const isSelected = newStaff.selectedTables.includes(tName);
                        return (
                          <button
                            key={tName}
                            type="button"
                            onClick={() => handleToggleTable(tName)}
                            className={`px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#E46254] text-white border-[#E46254]'
                                : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                            }`}
                          >
                            {isSelected ? `✓ ${tName}` : tName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Footer */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-[12px] font-semibold text-zinc-500 hover:bg-zinc-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStaff}
                  className="px-4 py-2 bg-[#E46254] hover:bg-[#d04e41] text-white text-[12px] font-bold rounded-xl transition-all cursor-pointer shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingStaff ? <Loader2 size={13} className="animate-spin" /> : null}
                  Confirm & Add
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Delete Staff Confirmation ───────────────── */}
      {staffToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-xs p-4 shadow-xl border border-zinc-200 text-center animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-zinc-900 mb-1">Remove Staff Member?</h3>
            <p className="text-[11.5px] text-zinc-500 mb-4">
              Remove <span className="font-bold text-zinc-800">{staffToDelete.name}</span> from the floor roster?
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setStaffToDelete(null)}
                className="px-3 py-1.5 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteStaff}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isDeleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
