"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Receipt, 
  CreditCard, 
  Sparkles, 
  Check, 
  Loader2, 
  Percent, 
  Wine, 
  Store, 
  Printer,
  ShieldCheck,
  KeyRound,
  UserCheck,
  Smartphone,
  Monitor,
  Info,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  Volume2,
  AlertCircle,
  ChefHat,
  CheckCircle,
  Radio
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { LocalSqliteStore } from "@/lib/localSqliteStore";
import { SyncBus } from "@/utils/syncBus";
import { OfflineSyncEngine } from "@/lib/offlineSyncEngine";
import { 
  getInstalledPrinters, 
  isTauriEnvironment, 
  testNetworkPrinter, 
  testPrintBillingPrinter, 
  testPrintKitchenPrinter 
} from "@/lib/thermalPrinterBridge";
import { 
  TaxSettings, 
  DEFAULT_TAX_SETTINGS, 
  RestaurantConfig,
  DEFAULT_RESTAURANT_CONFIG,
  parseConfigFromRestaurant,
  getStoredRestaurantConfig,
  saveRestaurantConfig,
  calculateBillTaxes 
} from "@/utils/tax";

export default function SettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'TAXES' | 'SECURITY' | 'HARDWARE' | 'BRAND'>('TAXES');
  
  // General & Brand Settings
  const [primaryColor, setPrimaryColor] = useState('#E46254');
  const [restaurantName, setRestaurantName] = useState('The Daily Café');
  const [restaurantSlug, setRestaurantSlug] = useState('dailycafe');
  const [upiId, setUpiId] = useState('');
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [phone, setPhone] = useState('');
  
  // QR Menu Order Security Mode: 'PIN_DIRECT_FIRE' vs 'OPEN_STAFF_APPROVAL'
  const [qrOrderMode, setQrOrderMode] = useState<'PIN_DIRECT_FIRE' | 'OPEN_STAFF_APPROVAL'>('PIN_DIRECT_FIRE');

  // Billing & Settlement Mode: 'STAFF_ASSISTED' or 'SELF_PAY'
  const [billingMode, setBillingMode] = useState<'STAFF_ASSISTED' | 'SELF_PAY'>('STAFF_ASSISTED');

  // Hardware & Printing
  const [paperWidth, setPaperWidth] = useState<'80MM' | '58MM'>('80MM');
  const [printCopies, setPrintCopies] = useState<1 | 2>(1);
  const [autoPrintOnSettle, setAutoPrintOnSettle] = useState(false);
  
  // Thermal Hardware & KOT Configuration
  const [installedPrinters, setInstalledPrinters] = useState<string[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [kotPrinterType, setKotPrinterType] = useState<'same' | 'windows' | 'network'>('same');
  const [kotPrinterName, setKotPrinterName] = useState<string>('');
  const [kotPrinterIp, setKotPrinterIp] = useState<string>('192.168.1.200');
  const [kotPrinterPort, setKotPrinterPort] = useState<number>(9100);
  const [autoKotPrint, setAutoKotPrint] = useState<boolean>(true);
  const [testingBill, setTestingBill] = useState(false);
  const [testingKot, setTestingKot] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [printerFeedback, setPrinterFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);

  // Tax & Receipt Settings
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(DEFAULT_TAX_SETTINGS);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (isLoadedRef.current) return;

    async function loadSettings() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let restId = user?.user_metadata?.restaurant_id;

        if (!restId && typeof window !== "undefined") {
          restId = localStorage.getItem("tabletapy_restaurant_id") || undefined;
        }

        if (!restId && user?.id) {
          restId = user.id;
        }

        if (restId) {
          setRestaurantId(restId);
          if (typeof window !== "undefined") {
            localStorage.setItem("tabletapy_restaurant_id", restId);
          }
          const { data: rest } = await supabase.from('restaurants').select('*').eq('id', restId).single();
          if (rest) {
            if (rest.name) setRestaurantName(rest.name);
            if (rest.slug) setRestaurantSlug(rest.slug);
            if (rest.primary_color) setPrimaryColor(rest.primary_color);
            if (rest.phone) setPhone(rest.phone);

            // Populate settings from Supabase if present
            if (rest.bg_image) {
              let hasCloudTax = false;
              let parsedBg: any = null;
              try {
                parsedBg = typeof rest.bg_image === 'string' ? JSON.parse(rest.bg_image) : rest.bg_image;
                if (parsedBg && (parsedBg.taxSettings || parsedBg.gstType)) {
                  hasCloudTax = true;
                }
                if (parsedBg?.upiId) {
                  setUpiId(parsedBg.upiId);
                } else if (parsedBg?.taxSettings?.upiId) {
                  setUpiId(parsedBg.taxSettings.upiId);
                }
              } catch {}

              const cloudConfig = parseConfigFromRestaurant(rest);
              if (hasCloudTax) {
                setTaxSettings(cloudConfig.taxSettings);
                setQrOrderMode(cloudConfig.qrOrderMode);
                setBillingMode(cloudConfig.billingMode);
                setPaperWidth(cloudConfig.paperWidth);
                setPrintCopies(cloudConfig.printCopies);
                setAutoPrintOnSettle(cloudConfig.autoPrintOnSettle);
                if (parsedBg?.printerSettings) {
                  const ps = parsedBg.printerSettings;
                  if (ps.selectedPrinter) setSelectedPrinter(ps.selectedPrinter);
                  if (ps.kotPrinterType) setKotPrinterType(ps.kotPrinterType);
                  if (ps.kotPrinterName) setKotPrinterName(ps.kotPrinterName);
                  if (ps.kotPrinterIp) setKotPrinterIp(ps.kotPrinterIp);
                  if (ps.kotPrinterPort) setKotPrinterPort(ps.kotPrinterPort);
                  if (typeof ps.autoKotPrint === 'boolean') setAutoKotPrint(ps.autoKotPrint);
                }
              }
            }
          }

          // Fallback to local stored config
          const localConfig = getStoredRestaurantConfig(restId);
          setTaxSettings(localConfig.taxSettings);
          setQrOrderMode(localConfig.qrOrderMode);
          setBillingMode(localConfig.billingMode);
          setPaperWidth(localConfig.paperWidth);
          setPrintCopies(localConfig.printCopies);
          setAutoPrintOnSettle(localConfig.autoPrintOnSettle);
          isLoadedRef.current = true;
        } else {
          const genericConfig = getStoredRestaurantConfig();
          setTaxSettings(genericConfig.taxSettings);
          setQrOrderMode(genericConfig.qrOrderMode);
          setBillingMode(genericConfig.billingMode);
          setPaperWidth(genericConfig.paperWidth);
          setPrintCopies(genericConfig.printCopies);
          setAutoPrintOnSettle(genericConfig.autoPrintOnSettle);
          isLoadedRef.current = true;
        }

        // Load local hardware printer preferences
        if (typeof window !== "undefined") {
          setIsDesktopApp(isTauriEnvironment());
          const localPrinter = localStorage.getItem('tabletapy_selected_printer');
          if (localPrinter) setSelectedPrinter(localPrinter);
          const localKotType = localStorage.getItem('tabletapy_kot_printer_type') as any;
          if (localKotType) setKotPrinterType(localKotType);
          const localKotName = localStorage.getItem('tabletapy_kot_printer_name');
          if (localKotName) setKotPrinterName(localKotName);
          const localKotIp = localStorage.getItem('tabletapy_kot_printer_ip');
          if (localKotIp) setKotPrinterIp(localKotIp);
          const localKotPort = parseInt(localStorage.getItem('tabletapy_kot_printer_port') || '', 10);
          if (localKotPort) setKotPrinterPort(localKotPort);
          const localAutoKot = localStorage.getItem('tabletapy_auto_kot_print');
          if (localAutoKot !== null) setAutoKotPrint(localAutoKot !== 'false');
        }

        // Query installed Windows printers from desktop bridge
        try {
          const list = await getInstalledPrinters();
          setInstalledPrinters(list);
        } catch {}
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }

    loadSettings();
  }, []);

  const refreshPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const list = await getInstalledPrinters();
      setInstalledPrinters(list);
      setPrinterFeedback({ type: 'success', message: `Detected ${list.length} installed Windows printer(s).` });
    } catch (err: any) {
      setPrinterFeedback({ type: 'error', message: err?.message || 'Failed to detect printers' });
    } finally {
      setLoadingPrinters(false);
      setTimeout(() => setPrinterFeedback(null), 4000);
    }
  };

  const handleTestBillPrint = async () => {
    setTestingBill(true);
    setPrinterFeedback(null);
    try {
      const res = await testPrintBillingPrinter();
      if (res.success) {
        setPrinterFeedback({ type: 'success', message: `Test receipt printed to "${selectedPrinter || 'Windows Default Printer'}"!` });
      } else {
        setPrinterFeedback({ type: 'error', message: res.error || 'Failed to print test receipt. Check printer power & connection.' });
      }
    } catch (err: any) {
      setPrinterFeedback({ type: 'error', message: err.message || 'Error executing test print' });
    } finally {
      setTestingBill(false);
      setTimeout(() => setPrinterFeedback(null), 6000);
    }
  };

  const handleTestKotPrint = async () => {
    setTestingKot(true);
    setPrinterFeedback(null);
    try {
      const res = await testPrintKitchenPrinter();
      if (res.success) {
        const dest = kotPrinterType === 'network' ? `${kotPrinterIp}:${kotPrinterPort}` : (kotPrinterName || selectedPrinter || 'Counter Printer');
        setPrinterFeedback({ type: 'success', message: `Test KOT ticket sent to kitchen printer (${dest})!` });
      } else {
        setPrinterFeedback({ type: 'error', message: res.error || 'Failed to print test KOT ticket. Verify IP address or printer driver.' });
      }
    } catch (err: any) {
      setPrinterFeedback({ type: 'error', message: err.message || 'Error executing kitchen test print' });
    } finally {
      setTestingKot(false);
      setTimeout(() => setPrinterFeedback(null), 6000);
    }
  };

  const handlePingNetworkPrinter = async () => {
    setTestingPing(true);
    setPrinterFeedback(null);
    try {
      const res = await testNetworkPrinter(kotPrinterIp, kotPrinterPort);
      if (res.success) {
        setPrinterFeedback({ type: 'success', message: res.message });
      } else {
        setPrinterFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setPrinterFeedback({ type: 'error', message: err.message || 'Could not reach printer' });
    } finally {
      setTestingPing(false);
      setTimeout(() => setPrinterFeedback(null), 6000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist local thermal hardware preferences
      if (typeof window !== "undefined") {
        localStorage.setItem('tabletapy_selected_printer', selectedPrinter);
        localStorage.setItem('tabletapy_kot_printer_type', kotPrinterType);
        localStorage.setItem('tabletapy_kot_printer_name', kotPrinterName);
        localStorage.setItem('tabletapy_kot_printer_ip', kotPrinterIp);
        localStorage.setItem('tabletapy_kot_printer_port', kotPrinterPort.toString());
        localStorage.setItem('tabletapy_auto_kot_print', autoKotPrint ? 'true' : 'false');
        localStorage.setItem('tabletapy_paper_width', paperWidth);
        localStorage.setItem('tabletapy_print_copies', printCopies.toString());
        localStorage.setItem('tabletapy_auto_bill_print', autoPrintOnSettle ? 'true' : 'false');
      }

      const fullConfig: RestaurantConfig = {
        taxSettings: {
          ...taxSettings,
          upiId: upiId || taxSettings.upiId || ''
        },
        qrOrderMode,
        billingMode,
        paperWidth,
        printCopies,
        autoPrintOnSettle,
        upiId: upiId || taxSettings.upiId || ''
      };

      // 1. Resolve restaurant id reliably
      let targetRestId = restaurantId;
      if (!targetRestId && typeof window !== "undefined") {
        targetRestId = localStorage.getItem("tabletapy_restaurant_id") || '';
      }
      if (!targetRestId && restaurantId) {
        targetRestId = restaurantId;
      }

      if (targetRestId && typeof window !== "undefined") {
        localStorage.setItem("tabletapy_restaurant_id", targetRestId);
      }

      // 2. Save full config to localStorage & cross-tab sync
      saveRestaurantConfig(fullConfig, targetRestId || undefined);

      // 3. Update Supabase Restaurant Record (synced across all devices in real-time)
      if (targetRestId) {
        let existingCfg: any = {};
        try {
          const { data: r } = await supabase.from('restaurants').select('bg_image').eq('id', targetRestId).maybeSingle();
          if (r?.bg_image) {
            existingCfg = typeof r.bg_image === 'string' ? JSON.parse(r.bg_image) : r.bg_image;
          }
        } catch (fetchErr) {
          console.warn("Could not fetch existing bg_image:", fetchErr);
        }

        const mergedBgImage = JSON.stringify({
          ...existingCfg,
          ...fullConfig,
          upiId,
          printerSettings: {
            selectedPrinter,
            kotPrinterType,
            kotPrinterName,
            kotPrinterIp,
            kotPrinterPort,
            autoKotPrint,
            paperWidth,
            printCopies,
            autoPrintOnSettle
          },
          taxSettings: {
            ...DEFAULT_TAX_SETTINGS,
            ...taxSettings,
            upiId: upiId || taxSettings.upiId || ''
          }
        });

        const updatePayload: Record<string, any> = {
          name: restaurantName,
          slug: restaurantSlug,
          primary_color: primaryColor,
          bg_image: mergedBgImage
        };

        // Instant 0ms Local SQLite persistence
        LocalSqliteStore.saveSettings({
          restaurant_id: targetRestId,
          business_name: restaurantName,
          upi_id: upiId,
          tax_settings_json: JSON.stringify(taxSettings),
        }).catch(() => {});

        // Instant cross-tab sync
        SyncBus.emit("SETTINGS_UPDATED", targetRestId, { config: fullConfig });

        // Cloud sync with offline fallback
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          await LocalSqliteStore.queueMutation({
            id: 'mut_' + Date.now(),
            restaurant_id: targetRestId,
            entity: 'SETTINGS',
            action: 'UPDATE',
            payload: updatePayload,
            created_at: new Date().toISOString()
          });
          OfflineSyncEngine.triggerSync();
        } else {
          const { error: updateErr } = await supabase.from('restaurants').update(updatePayload).eq('id', targetRestId);
          if (updateErr) {
            console.warn("Database update deferred, queued offline:", updateErr);
            await LocalSqliteStore.queueMutation({
              id: 'mut_' + Date.now(),
              restaurant_id: targetRestId,
              entity: 'SETTINGS',
              action: 'UPDATE',
              payload: updatePayload,
              created_at: new Date().toISOString()
            });
            OfflineSyncEngine.triggerSync();
          }
        }

        // 4. Realtime broadcast instant update to active POS terminals and customer tables
        try {
          const chScoped = supabase.channel(`restaurant_config_${targetRestId}`);
          chScoped.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              chScoped.send({
                type: 'broadcast',
                event: 'config_updated',
                payload: { config: fullConfig, restaurantId: targetRestId, timestamp: Date.now() }
              });
              setTimeout(() => supabase.removeChannel(chScoped), 2000);
            }
          });

          const chGlobal = supabase.channel(`restaurant_config_global`);
          chGlobal.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              chGlobal.send({
                type: 'broadcast',
                event: 'config_updated',
                payload: { config: fullConfig, restaurantId: targetRestId, timestamp: Date.now() }
              });
              setTimeout(() => supabase.removeChannel(chGlobal), 2000);
            }
          });
        } catch {}
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tabletapy_config_updated", { detail: { config: fullConfig, restaurantId: targetRestId } }));
        window.dispatchEvent(new Event("storage"));
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Failed to save settings: " + (err.message || "Please check your network."));
    } finally {
      setSaving(false);
    }
  };

  // Live Sample Calculation for Receipt Preview
  const sampleCalc = useMemo(() => {
    const foodSubtotal = 400; // 180 + 220
    const alcoholSubtotal = taxSettings.alcoholVatEnabled ? 350 : 0;
    return calculateBillTaxes({
      subtotal: foodSubtotal + alcoholSubtotal,
      discountAmount: 0,
      packagingAmount: 0,
      isDineIn: true,
      hasAlcohol: taxSettings.alcoholVatEnabled,
      alcoholSubtotal: alcoholSubtotal,
      settings: taxSettings,
    });
  }, [taxSettings]);

  return (
    <div className="bg-[#FAFAFA] text-zinc-900 font-sans pb-24 min-h-screen">
      
      {/* ── STICKY TOP NAVIGATION DOCK (APPLE STYLE) ── */}
      <header className="sticky top-0 z-30 bg-[#FAFAFA]/90 backdrop-blur-2xl border-b border-zinc-200/80 px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              Settings
            </h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
              Taxes, order security, POS hardware, and restaurant branding.
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            
            {saveSuccess && (
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 size={14} />
                <span>Saved successfully</span>
              </span>
            )}
            <button 
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-[#E46254] hover:bg-[#d04e41] text-white font-medium rounded-xl text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>

        </div>

        {/* Apple-Style Segmented Tab Pills */}
        <div className="max-w-6xl mx-auto mt-3">
          <div className="inline-flex p-1.5 bg-zinc-200/60 border border-transparent backdrop-blur-2xl rounded-2xl overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('TAXES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'TAXES'
                  ? 'bg-white text-[#E46254] shadow-xs '
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/[0.04]'
              }`}
            >
              <Receipt size={13} strokeWidth={1.75} />
              <span>Taxes & Thermal Bill</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SECURITY')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'SECURITY'
                  ? 'bg-white text-[#E46254] shadow-xs '
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/[0.04]'
              }`}
            >
              <ShieldCheck size={13} strokeWidth={1.75} />
              <span>QR Menu & Security</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('HARDWARE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'HARDWARE'
                  ? 'bg-white text-[#E46254] shadow-xs '
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/[0.04]'
              }`}
            >
              <Printer size={13} strokeWidth={1.75} />
              <span>POS & Hardware</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BRAND')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'BRAND'
                  ? 'bg-white text-[#E46254] shadow-xs '
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/[0.04]'
              }`}
            >
              <Store size={13} strokeWidth={1.75} />
              <span>Brand Profile</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 mt-8">

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 1: TAXES, GST & THERMAL RECEIPT ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'TAXES' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            
            {/* Left Column (7 cols): Clean Questionnaire */}
            <div className="xl:col-span-7 space-y-6">

              {/* 1. GST Registration Status */}
              <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs shadow-xs space-y-5">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                    GST Registration Scheme
                  </h2>
                  <p className="text-zinc-500 text-xs mt-1">
                    Select your cafe or restaurant taxation category under Indian GST law.
                  </p>
                </div>

                {/* 2 Focused Cards (Regular 5% vs Composition 0%) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  
                  {/* Regular GST (5%) */}
                  <div
                    onClick={() => setTaxSettings(prev => ({ ...prev, gstType: 'REGULAR', cgstRate: 2.5, sgstRate: 2.5 }))}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      taxSettings.gstType === 'REGULAR'
                        ? 'border-[#E46254] bg-[#E46254]/5'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900">Regular GST (5%)</span>
                        {taxSettings.gstType === 'REGULAR' && (
                          <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                            <Check size={10} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                        2.5% CGST + 2.5% SGST. Standard scheme for independent restaurants and cafes.
                      </p>
                    </div>
                    <span className="text-[10.5px] font-mono font-semibold text-zinc-600 mt-3 pt-2 border-t border-zinc-100">
                      Standard 5% Rate
                    </span>
                  </div>

                  {/* Composition Scheme (0%) */}
                  <div
                    onClick={() => setTaxSettings(prev => ({ ...prev, gstType: 'COMPOSITION', cgstRate: 0, sgstRate: 0 }))}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      taxSettings.gstType === 'COMPOSITION'
                        ? 'border-[#E46254] bg-[#E46254]/5'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900">Composition (0%)</span>
                        {taxSettings.gstType === 'COMPOSITION' && (
                          <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                            <Check size={10} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                        Zero tax collected on guest bills. Issues statutory "Bill of Supply" per GST section 10.
                      </p>
                    </div>
                    <span className="text-[10.5px] font-mono font-semibold text-zinc-600 mt-3 pt-2 border-t border-zinc-100">
                      0% on Guest Bill
                    </span>
                  </div>

                </div>

                {/* Exclusive vs Inclusive Pricing Mode */}
                {taxSettings.gstType === 'REGULAR' && (
                  <div className="pt-4 border-t border-zinc-100">
                    <label className="text-xs font-semibold text-zinc-700 block mb-2">
                      Menu Price Display Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, pricingType: 'EXCLUSIVE' }))}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          taxSettings.pricingType === 'EXCLUSIVE'
                            ? 'bg-white text-[#E46254] shadow-xs font-semibold'
                            : 'text-zinc-600 hover:text-zinc-900 '
                        }`}
                      >
                        Exclusive (Add tax on top)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, pricingType: 'INCLUSIVE' }))}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          taxSettings.pricingType === 'INCLUSIVE'
                            ? 'bg-white text-[#E46254] shadow-xs font-semibold'
                            : 'text-zinc-600 hover:text-zinc-900 '
                        }`}
                      >
                        Inclusive (Tax baked into MRP)
                      </button>
                    </div>
                  </div>
                )}

                {/* Statutory Identifiers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      GSTIN (15 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g. 29AAAAA0000A1Z5"
                      value={taxSettings.gstin}
                      onChange={(e) => setTaxSettings(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all uppercase placeholder:text-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      FSSAI License (14 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={14}
                      placeholder="e.g. 11223344556677"
                      value={taxSettings.fssai}
                      onChange={(e) => setTaxSettings(prev => ({ ...prev, fssai: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>
              </section>

              {/* 2. Dine-In Service Charge */}
              <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Dine-In Service Charge
                    </h2>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      Optional staff fee strictly applied on Dine-In orders. Never charged on Takeaway.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTaxSettings(prev => ({ ...prev, serviceChargeEnabled: !prev.serviceChargeEnabled }))}
                    className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                      taxSettings.serviceChargeEnabled ? 'bg-[#E46254]' : 'bg-zinc-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      taxSettings.serviceChargeEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {taxSettings.serviceChargeEnabled && (
                  <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600">Rate:</span>
                    {[5, 7, 10].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, serviceChargeRate: rate }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          taxSettings.serviceChargeRate === rate
                            ? 'bg-[#E46254] text-white font-semibold'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={25}
                        value={taxSettings.serviceChargeRate}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, serviceChargeRate: Math.max(0, parseFloat(e.target.value) || 0) }))}
                        className="w-16 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900"
                      />
                      <span className="text-xs text-zinc-400 ml-1.5 font-mono">%</span>
                    </div>
                  </div>
                )}
              </section>

              {/* 3. Alcohol Liquor VAT */}
              <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Alcohol & Liquor State VAT
                    </h2>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      State alcohol tax billed separately from GST if serving beer, cocktails, or spirits.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTaxSettings(prev => ({ ...prev, alcoholVatEnabled: !prev.alcoholVatEnabled }))}
                    className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                      taxSettings.alcoholVatEnabled ? 'bg-[#E46254]' : 'bg-zinc-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      taxSettings.alcoholVatEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {taxSettings.alcoholVatEnabled && (
                  <div className="pt-3 border-t border-zinc-100 flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600">VAT Rate:</span>
                    {[10, 18, 20].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setTaxSettings(prev => ({ ...prev, alcoholVatRate: rate }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          taxSettings.alcoholVatRate === rate
                            ? 'bg-[#E46254] text-white font-semibold'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={taxSettings.alcoholVatRate}
                        onChange={(e) => setTaxSettings(prev => ({ ...prev, alcoholVatRate: Math.max(0, parseFloat(e.target.value) || 0) }))}
                        className="w-16 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900"
                      />
                      <span className="text-xs text-zinc-400 ml-1.5 font-mono">%</span>
                    </div>
                  </div>
                )}
              </section>

              {/* 4. Thermal Receipt Content */}
              <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs shadow-xs space-y-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                    Thermal Chit Header & Footer
                  </h2>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Printed address, phone number, and closing message on thermal slips.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Store Address & Contact (Header)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 104 Indiranagar 100ft Road, Bengaluru&#10;Ph: +91 98765 43210"
                      value={taxSettings.receiptAddress}
                      onChange={(e) => setTaxSettings(prev => ({ ...prev, receiptAddress: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder:text-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Custom Footer Greeting
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Thank you for dining with us! Tag @yourcafe on Instagram"
                      value={taxSettings.receiptFooter}
                      onChange={(e) => setTaxSettings(prev => ({ ...prev, receiptFooter: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all placeholder:text-zinc-400"
                    />
                  </div>
                </div>
              </section>

            </div>

            {/* Right Column (5 cols): Live 80mm Thermal Receipt Preview */}
            <div className="xl:col-span-5 sticky top-28">
              <div className="bg-[#FFFDF9] border border-zinc-300 rounded-2xl p-6 shadow-sm text-zinc-900 font-mono text-xs relative">
                
                {/* Paper Header Pin */}
                <div className="text-center pb-3 border-b border-dashed border-zinc-300 space-y-1">
                  <h3 className="font-bold text-sm tracking-wider uppercase text-zinc-900">
                    {restaurantName}
                  </h3>
                  {taxSettings.receiptAddress ? (
                    <p className="text-[10px] text-zinc-600 whitespace-pre-line leading-tight">
                      {taxSettings.receiptAddress}
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-400 italic">Address printed here</p>
                  )}

                  {taxSettings.gstin && (
                    <div className="text-[10px] font-bold text-zinc-800 pt-0.5">
                      GSTIN: {taxSettings.gstin}
                    </div>
                  )}

                  {taxSettings.fssai && (
                    <div className="text-[9.5px] text-zinc-600">
                      FSSAI: {taxSettings.fssai}
                    </div>
                  )}

                  <div className="pt-1.5">
                    <span className="font-bold text-xs uppercase tracking-wide">
                      {taxSettings.gstType === 'COMPOSITION' ? '*** BILL OF SUPPLY ***' : '*** TAX INVOICE ***'}
                    </span>
                    {taxSettings.gstType === 'COMPOSITION' && (
                      <p className="text-[8.5px] text-zinc-600 uppercase font-sans mt-0.5">
                        Composition Taxable Person, Not Eligible To Collect Tax On Supplies
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between text-[10px] text-zinc-600 pt-1 font-sans">
                    <span>Table 04 (Dine-In)</span>
                    <span>12:45 PM</span>
                  </div>
                </div>

                {/* Sample Items Table */}
                <div className="py-2.5 border-b border-dashed border-zinc-300 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span>1x Truffle Pasta</span>
                    <span className="font-semibold">₹220.00</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>1x Artisan Cold Brew</span>
                    <span className="font-semibold">₹180.00</span>
                  </div>
                  {taxSettings.alcoholVatEnabled && (
                    <div className="flex justify-between text-[11px]">
                      <span>1x Craft Draught Pint</span>
                      <span className="font-semibold">₹350.00</span>
                    </div>
                  )}
                </div>

                {/* Calculation Breakdown */}
                <div className="py-2.5 border-b border-dashed border-zinc-300 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{sampleCalc.subtotal.toFixed(2)}</span>
                  </div>

                  {taxSettings.serviceChargeEnabled && sampleCalc.serviceChargeAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Service Charge ({taxSettings.serviceChargeRate}%)</span>
                      <span>₹{sampleCalc.serviceChargeAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {sampleCalc.isComposition ? (
                    <div className="flex justify-between text-[10px] italic text-zinc-500">
                      <span>GST (Composition 0%)</span>
                      <span>₹0.00</span>
                    </div>
                  ) : sampleCalc.isInclusive ? (
                    <>
                      <div className="flex justify-between text-[10px] text-zinc-600">
                        <span>GST ({sampleCalc.effectiveCgstRate + sampleCalc.effectiveSgstRate}%)</span>
                        <span className="font-sans font-medium text-zinc-600">Included in Price</span>
                      </div>
                      <div className="text-[9.5px] text-zinc-500 pl-2">
                        (CGST {sampleCalc.effectiveCgstRate}%: ₹{sampleCalc.cgstAmount.toFixed(2)} + SGST {sampleCalc.effectiveSgstRate}%: ₹{sampleCalc.sgstAmount.toFixed(2)})
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>CGST ({sampleCalc.effectiveCgstRate}%)</span>
                        <span>₹{sampleCalc.cgstAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST ({sampleCalc.effectiveSgstRate}%)</span>
                        <span>₹{sampleCalc.sgstAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {sampleCalc.alcoholVatAmount > 0 && (
                    <div className="flex justify-between text-zinc-700">
                      <span>State Alcohol VAT ({taxSettings.alcoholVatRate}%)</span>
                      <span>₹{sampleCalc.alcoholVatAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {sampleCalc.roundOff !== 0 && (
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>Round-off</span>
                      <span>{sampleCalc.roundOff > 0 ? `+₹${sampleCalc.roundOff}` : `-₹${Math.abs(sampleCalc.roundOff)}`}</span>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="pt-2 flex justify-between items-baseline font-bold text-sm">
                  <span>Grand Total</span>
                  <span className="text-base font-black">₹{sampleCalc.grandTotal}</span>
                </div>

                {/* Footer Message */}
                <div className="text-center pt-4 text-[10px] text-zinc-600 font-sans leading-tight">
                  {taxSettings.receiptFooter || "Thank you for dining with us! Visit again."}
                </div>

                {/* Paper Tear Serration Visual */}
                <div className="mt-4 pt-2 border-t border-dotted border-zinc-300 flex justify-center text-[9px] text-zinc-400 font-sans tracking-widest uppercase">
                  80mm Live Thermal Preview
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 2: QR MENU & ORDER SECURITY ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'SECURITY' && (
          <div className="max-w-3xl space-y-6">
            
            {/* 1. Menu Ordering Mode: PIN vs Staff Approval */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs sm:p-7 shadow-xs space-y-5">
              <div>
                <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                  QR Menu Ordering & Prank-Protection Mode
                </h2>
                <p className="text-zinc-500 text-xs mt-1">
                  Choose how guest table orders are verified before items reach the kitchen.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Option 1: 4-Digit Table PIN (Direct Fire) */}
                <div
                  onClick={() => setQrOrderMode('PIN_DIRECT_FIRE')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    qrOrderMode === 'PIN_DIRECT_FIRE'
                      ? 'border-[#E46254] bg-[#E46254]/5 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                        <KeyRound size={16} strokeWidth={2} />
                      </div>
                      {qrOrderMode === 'PIN_DIRECT_FIRE' && (
                        <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">
                        4-Digit Table PIN
                      </h3>
                      <span className="inline-block mt-0.5 text-[10.5px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Direct Kitchen Fire
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests enter the 4-digit PIN printed on their table stand. Confirms physical presence and fires items instantly to Kitchen KDS with zero staff delay.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] font-medium text-zinc-600">
                    Recommended for busy dining rush
                  </div>
                </div>

                {/* Option 2: Open Menu (Staff Approval Queue) */}
                <div
                  onClick={() => setQrOrderMode('OPEN_STAFF_APPROVAL')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    qrOrderMode === 'OPEN_STAFF_APPROVAL'
                      ? 'border-[#E46254] bg-[#E46254]/5 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                        <UserCheck size={16} strokeWidth={2} />
                      </div>
                      {qrOrderMode === 'OPEN_STAFF_APPROVAL' && (
                        <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">
                        Open Menu
                      </h3>
                      <span className="inline-block mt-0.5 text-[10.5px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                        Staff Approval Queue
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Guests order instantly without entering a PIN. Orders enter a pending queue on POS & Captain screens where staff click Accept or Reject to prevent prank orders.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] font-medium text-zinc-600">
                    Ideal for patio & zero-barrier cafes
                  </div>
                </div>

              </div>
            </section>

            {/* 2. Guest Payment & Settlement Flow */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs sm:p-7 shadow-xs space-y-5">
              <div>
                <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                  Guest Billing & Payment Workflow
                </h2>
                <p className="text-zinc-500 text-xs mt-1">
                  Choose how table guests settle their check.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Staff-Assisted */}
                <div
                  onClick={() => setBillingMode('STAFF_ASSISTED')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    billingMode === 'STAFF_ASSISTED'
                      ? 'border-[#E46254] bg-[#E46254]/5 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                        <CreditCard size={16} strokeWidth={2} />
                      </div>
                      {billingMode === 'STAFF_ASSISTED' && (
                        <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">
                        Staff-Assisted Checkout
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Guest taps "Request Bill" from their phone. Floor captain brings the paper check or collects Cash / Card / UPI at the counter.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Self-Pay UPI */}
                <div
                  onClick={() => setBillingMode('SELF_PAY')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    billingMode === 'SELF_PAY'
                      ? 'border-[#E46254] bg-[#E46254]/5 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                        <Smartphone size={16} strokeWidth={2} />
                      </div>
                      {billingMode === 'SELF_PAY' && (
                        <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">
                        Self-Pay Digital UPI
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Guest scans dynamic UPI QR from their phone via Google Pay or PhonePe. Order auto-clears once payment is verified.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </section>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 3: POS & HARDWARE (THERMAL PRINTERS & KOT ENGINE) ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'HARDWARE' && (
          <div className="max-w-4xl space-y-6">

            {/* Notification / Feedback Banner */}
            {printerFeedback && (
              <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 border ${
                printerFeedback.type === 'success'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50/80 border-rose-200 text-rose-800'
              }`}>
                {printerFeedback.type === 'success' ? (
                  <CheckCircle size={18} className="shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle size={18} className="shrink-0 text-rose-600" />
                )}
                <span className="text-xs font-semibold">{printerFeedback.message}</span>
              </div>
            )}

            {/* 1. Desktop ESC/POS Hardware Bridge Status */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    isDesktopApp ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    <Printer size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                        Thermal Hardware Bridge
                      </h2>
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isDesktopApp 
                          ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200' 
                          : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}>
                        {isDesktopApp ? 'Native Win32 Spooler Active' : 'Web Browser Preview'}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {isDesktopApp
                        ? 'Direct binary ESC/POS communication via Windows Spooler (winspool.drv RAW) & Network TCP Socket. Zero print dialogs, instant sub-100ms output.'
                        : 'Running inside web browser. Direct silent hardware printing & Ethernet IP socket KOT firing activate seamlessly when using the TableTapy Desktop Terminal.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={refreshPrinters}
                  disabled={loadingPrinters}
                  className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <RefreshCw size={13} className={loadingPrinters ? 'animate-spin' : ''} />
                  <span>Scan Printers</span>
                </button>
              </div>
            </section>

            {/* 2. Counter Billing Thermal Printer */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt size={17} className="text-[#E46254]" />
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Counter Billing Thermal Printer
                    </h2>
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Used for customer tax invoices, takeaway order tokens, and receipt copies.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestBillPrint}
                  disabled={testingBill}
                  className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto shrink-0 active:scale-95 disabled:opacity-60 shadow-xs"
                >
                  {testingBill ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                  <span>Test Print Bill</span>
                </button>
              </div>

              {/* Printer Selection Dropdown */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Select Windows Billing Printer
                </label>
                <div className="relative">
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all cursor-pointer"
                  >
                    <option value="">(Default Windows Printer)</option>
                    {installedPrinters.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                {installedPrinters.length === 0 && (
                  <p className="text-[11px] text-zinc-400 mt-1 italic">
                    Click "Scan Printers" above to detect installed USB and networked Windows thermal printers.
                  </p>
                )}
              </div>

              {/* Paper Roll Width & Copies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
                {/* 80mm */}
                <div
                  onClick={() => setPaperWidth('80MM')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    paperWidth === '80MM'
                      ? 'border-[#E46254] bg-[#E46254]/5'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">80mm (3-Inch Standard)</span>
                    {paperWidth === '80MM' && (
                      <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    Recommended for high-speed counter printers (Epson TM-T82, TVS RP-3200, Rugtek).
                  </p>
                </div>

                {/* 58mm */}
                <div
                  onClick={() => setPaperWidth('58MM')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    paperWidth === '58MM'
                      ? 'border-[#E46254] bg-[#E46254]/5'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">58mm (2-Inch Compact)</span>
                    {paperWidth === '58MM' && (
                      <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    Compact portable Bluetooth or small desktop receipt printers.
                  </p>
                </div>
              </div>

              {/* Print Copies & Auto-Print Toggle */}
              <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Print Copies</span>
                  <span className="text-[11px] text-zinc-500">Number of receipts printed per table settlement</span>
                </div>

                <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setPrintCopies(1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      printCopies === 1
                        ? 'bg-white text-[#E46254] shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    1 Copy (Guest Bill)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintCopies(2)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      printCopies === 2
                        ? 'bg-white text-[#E46254] shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    2 Copies (Guest + Store)
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Auto-Print Bill on Settle</span>
                  <span className="text-[11px] text-zinc-500">Automatically trigger thermal print when cashier marks order as PAID</span>
                </div>

                <button
                  type="button"
                  onClick={() => setAutoPrintOnSettle(!autoPrintOnSettle)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                    autoPrintOnSettle ? 'bg-[#E46254]' : 'bg-zinc-200'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    autoPrintOnSettle ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </section>

            {/* 3. Kitchen KOT Thermal Printer Routing */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ChefHat size={18} className="text-[#E46254]" />
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Kitchen Order Ticket (KOT) Printer
                    </h2>
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Direct thermal chit output to the kitchen cook line (supports Ethernet LAN, Wi-Fi, or USB).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestKotPrint}
                  disabled={testingKot}
                  className="px-4 py-2 bg-[#E46254] hover:bg-[#d04e41] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto shrink-0 active:scale-95 disabled:opacity-60 shadow-xs"
                >
                  {testingKot ? <Loader2 size={13} className="animate-spin" /> : <ChefHat size={13} />}
                  <span>Test Print Kitchen KOT</span>
                </button>
              </div>

              {/* 3-Way Mode Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Mode 1: Same as Counter */}
                <div
                  onClick={() => setKotPrinterType('same')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    kotPrinterType === 'same'
                      ? 'border-[#E46254] bg-[#E46254]/5'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">Same as Counter</span>
                    {kotPrinterType === 'same' && (
                      <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Single thermal printer prints both customer bills and kitchen KOT chits.
                  </p>
                </div>

                {/* Mode 2: Separate Windows Printer */}
                <div
                  onClick={() => setKotPrinterType('windows')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    kotPrinterType === 'windows'
                      ? 'border-[#E46254] bg-[#E46254]/5'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">USB / Windows Spooler</span>
                    {kotPrinterType === 'windows' && (
                      <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Dedicated USB kitchen printer with Windows driver installed.
                  </p>
                </div>

                {/* Mode 3: Network IP (Ethernet / LAN) */}
                <div
                  onClick={() => setKotPrinterType('network')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    kotPrinterType === 'network'
                      ? 'border-[#E46254] bg-[#E46254]/5'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">Network IP (LAN / Wi-Fi)</span>
                    {kotPrinterType === 'network' && (
                      <div className="w-4 h-4 rounded-full bg-[#E46254] flex items-center justify-center">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Commercial kitchen Ethernet LAN printer (ESC/POS Raw Port 9100).
                  </p>
                </div>
              </div>

              {/* Sub-config: Windows Printer Selector */}
              {kotPrinterType === 'windows' && (
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-2 animate-in fade-in">
                  <label className="block text-xs font-medium text-zinc-700">
                    Select Kitchen Windows Printer
                  </label>
                  <select
                    value={kotPrinterName}
                    onChange={(e) => setKotPrinterName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs sm:text-sm font-medium text-zinc-900 outline-none focus:border-zinc-900 transition-all cursor-pointer"
                  >
                    <option value="">-- Choose Installed Kitchen Printer --</option>
                    {installedPrinters.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sub-config: Network IP & Port */}
              {kotPrinterType === 'network' && (
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                      <Wifi size={14} className="text-emerald-600" />
                      Kitchen Printer Network Settings
                    </span>
                    <button
                      type="button"
                      onClick={handlePingNetworkPrinter}
                      disabled={testingPing}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      {testingPing ? <Loader2 size={12} className="animate-spin" /> : <Radio size={12} />}
                      <span>Ping Port 9100</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Printer IP Address (LAN)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 192.168.1.200"
                        value={kotPrinterIp}
                        onChange={(e) => setKotPrinterIp(e.target.value.trim())}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 outline-none focus:border-zinc-900 transition-all placeholder:text-zinc-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        RAW Port (Default: 9100)
                      </label>
                      <input
                        type="number"
                        placeholder="9100"
                        value={kotPrinterPort}
                        onChange={(e) => setKotPrinterPort(parseInt(e.target.value, 10) || 9100)}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 outline-none focus:border-zinc-900 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-print KOT toggle */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Auto-Print KOT on Punch</span>
                  <span className="text-[11px] text-zinc-500">
                    Immediately print KOT ticket to kitchen printer when order is placed or fired
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setAutoKotPrint(!autoKotPrint)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                    autoKotPrint ? 'bg-[#E46254]' : 'bg-zinc-200'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    autoKotPrint ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </section>

            {/* 4. Touchscreen Monitor & On-Screen Numpad */}
            <section className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                      Touchscreen Monitor & On-Screen Numpad
                    </h2>
                    <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                      Touch Ergonomics
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                    Designed for touch all-in-one monitors where cashiers don't use a physical keyboard. Automatically opens an on-screen touch dial for entering quantities, table numbers, phone digits, and cash tender amounts.
                  </p>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
                  <Monitor size={20} strokeWidth={1.75} />
                </div>
              </div>

              {/* Realistic Touchscreen Numpad Preview (Apple-style clean mockup) */}
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-left">
                  <div className="text-xs font-semibold text-zinc-800">
                    Touch Keypad Ergonomics
                  </div>
                  <p className="text-[11.5px] text-zinc-500 max-w-sm leading-relaxed">
                    Clicking numeric quantity or cash fields instantly launches the large floating touch dial to eliminate keyboard reach.
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[11px] font-medium text-emerald-600">
                    <CheckCircle2 size={13} />
                    <span>Enabled in TableTapy Terminal</span>
                  </div>
                </div>

                {/* The Dummy Touch Numpad */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-xs shrink-0 w-48 space-y-2 select-none pointer-events-none opacity-85">
                  <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-xs text-zinc-800">
                    Qty: 2
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold font-mono text-zinc-700">
                    {['1','2','3','4','5','6','7','8','9','C','0','00'].map((btn) => (
                      <div
                        key={btn}
                        className="h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shadow-2xs"
                      >
                        {btn}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* ── TAB 4: BRAND & PROFILE ── */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'BRAND' && (
          <div className="max-w-2xl bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-xs sm:p-7 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                Restaurant Brand Identity
              </h2>
              <p className="text-zinc-500 text-xs mt-1">
                Name, menu slug, accent color, and UPI settlement details.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Restaurant Display Name
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="e.g. The Daily Café"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Digital Menu Slug URL
                </label>
                <div className="flex items-center">
                  <span className="px-3.5 py-2.5 bg-zinc-100 border border-r-0 border-zinc-200 rounded-l-xl text-xs text-zinc-500 select-none font-mono">
                    tabletapy.online/r/
                  </span>
                  <input
                    type="text"
                    value={restaurantSlug}
                    onChange={(e) => setRestaurantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="dailycafe"
                    className="flex-1 px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-r-xl text-xs sm:text-sm text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Merchant UPI VPA ID (For Direct Payments)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. businessname@okaxis or merchant@hdfcbank"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Theme Brand Color
                </label>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-xl border border-zinc-300 shadow-2xs shrink-0 cursor-pointer overflow-hidden relative"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <input 
                      type="color" 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-32 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-900 outline-none focus:bg-white focus:border-zinc-900 transition-all uppercase"
                  />
                  <div className="flex items-center gap-1.5">
                    {['#E46254', '#2563EB', '#16A34A', '#D97706', '#9333EA', '#18181B'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPrimaryColor(c)}
                        className={`w-6 h-6 rounded-lg transition-transform cursor-pointer border ${
                          primaryColor === c ? 'scale-110 border-zinc-900 ring-2 ring-zinc-400/30' : 'border-zinc-200'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
