import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck, Database, Key } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | TableTapy",
  description: "Privacy policy detailing how TableTapy, a product of FlowTalk Enterprise, collects, uses, and safeguards restaurant and consumer data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 antialiased selection:bg-[#E46254]/30 font-sans relative overflow-x-hidden">
      {/* Background ambient refraction orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#E46254]/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -left-40 w-[30rem] h-[30rem] bg-rose-500/10 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-black/40 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center group py-1">
            <img 
              src="/logo-clean.png" 
              alt="TableTapy" 
              className="h-8 w-auto object-contain transition-transform group-hover:scale-105" 
              style={{ imageRendering: '-webkit-optimize-contrast' }}
            />
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white px-3.5 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] backdrop-blur-md transition-all"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#E46254]/10 text-[#E46254] border border-[#E46254]/20 backdrop-blur-md mb-6">
          <Lock size={12} />
          <span>Data Governance &amp; Security</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
          Privacy Policy
        </h1>
        <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
          Effective Date: October 20, 2026 • Your operational trust is our highest priority. Learn how <strong className="text-zinc-200">TableTapy</strong> and <strong className="text-zinc-200">FlowTalk Enterprise</strong> protect restaurant records, staff credentials, and guest order information.
        </p>
      </section>

      {/* Main Privacy Container with Refractive Glass Aesthetics */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="relative rounded-3xl p-8 md:p-12 backdrop-blur-3xl bg-white/[0.02] border border-white/[0.08] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12),inset_0_-1px_1px_0_rgba(0,0,0,0.5),0_24px_64px_-12px_rgba(0,0,0,0.8)] space-y-10 text-zinc-300 text-sm leading-relaxed">
          
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              1. Information We Collect
            </h2>
            <p>
              When you deploy TableTapy in your food service venue, we collect information necessary to deliver high-speed operational sync:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li><strong className="text-zinc-200">Merchant Account Data:</strong> Restaurant trade name, Udyam / GSTIN registration details, manager email, contact phone, branch location, and bank account / UPI VPA for settlement generation.</li>
              <li><strong className="text-zinc-200">Menu &amp; Operational Data:</strong> Item titles, dietary classifications (Veg / Non-Veg / Vegan), pricing tiers, modifiers, inventory stock toggles (86 status), and kitchen station routing tags.</li>
              <li><strong className="text-zinc-200">Order &amp; Transaction Logs:</strong> Table identifiers, order timestamps, line items, payment tender modes (Cash, UPI QR, Credit Card), token numbers, and discounted bill calculations.</li>
              <li><strong className="text-zinc-200">Customer Interaction Data:</strong> Contact details entered voluntarily by diners for digital WhatsApp bills or loyalty rewards (phone number, customer name).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              2. How We Utilize Your Data
            </h2>
            <p>
              We process data strictly to facilitate your restaurant operations:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-white font-medium text-xs uppercase tracking-wider mb-1">Real-Time Kitchen Routing</h3>
                <p className="text-zinc-400 text-xs">Directing KOT chits to kitchen thermal printers and captain tablets within &lt;100ms.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-white font-medium text-xs uppercase tracking-wider mb-1">Online Delivery Relays</h3>
                <p className="text-zinc-400 text-xs">Synchronizing live orders and 86 stock status with Swiggy and Zomato through UrbanPiper APIs.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-white font-medium text-xs uppercase tracking-wider mb-1">Financial Reconciliation</h3>
                <p className="text-zinc-400 text-xs">Compiling day-end Z-reports, cashier drawer shifts, and GST tax ledger summaries.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <h3 className="text-white font-medium text-xs uppercase tracking-wider mb-1">Security &amp; Abuse Prevention</h3>
                <p className="text-zinc-400 text-xs">Preventing unauthorized access to cash drawer commands and staff shift overrides.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              3. Data Protection &amp; Cloud Security Standards
            </h2>
            <p>
              TableTapy utilizes enterprise-grade cloud infrastructure powered by Supabase and Next.js Edge networks. All communications across browser terminals, kitchen displays, and database servers are protected by Transport Layer Security (TLS 1.3) with 256-bit AES encryption at rest.
            </p>
            <p>
              We adhere to strict Row Level Security (RLS) policies ensuring complete multi-tenant tenant isolation. No restaurant can ever inspect or access the inventory, pricing, or sales data of another establishment.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              4. Third-Party Sharing &amp; Non-Sale of Data
            </h2>
            <p>
              <strong className="text-white">We never sell, rent, or trade your restaurant or customer data to marketing brokers or advertising networks.</strong> Data is shared only with verified technical providers necessary to execute core operations:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>UrbanPiper / Swiggy / Zomato (for delivery order relay and stock sync).</li>
              <li>NPCI / UPI Payment Service Providers (for dynamic QR payment status verification).</li>
              <li>Transactional SMS / WhatsApp API providers (for digital receipt delivery).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              5. Merchant Data Rights &amp; Retention
            </h2>
            <p>
              Restaurant owners can export their complete menu catalogs, historical order books, customer contacts, and tax audit records at any time. Upon formal account closure, merchant data is securely purged in accordance with statutory accounting retention requirements.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/[0.08] pt-8">
            <h2 className="text-xl font-semibold text-white tracking-tight">
              6. Privacy Officer Contact
            </h2>
            <p>
              For privacy audits, data deletion requests, or compliance inquiries:
            </p>
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-400 space-y-1.5 font-mono">
              <p className="text-zinc-200 font-semibold font-sans text-sm">FlowTalk Enterprise — Data Privacy Group</p>
              <p>MSME Registration: Govt. of India</p>
              <p>Product: TableTapy Restaurant Suite</p>
              <p>Email: privacy@flowtalk.in / privacy@tabletapy.com</p>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 relative z-10 text-center text-xs text-zinc-500">
        <p>© 2026 TableTapy. A product of FlowTalk Enterprise. All rights reserved.</p>
      </footer>
    </div>
  );
}
