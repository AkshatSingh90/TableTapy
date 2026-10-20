import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileText, ChevronRight } from "lucide-react";

export const metadata = {
  title: "Terms and Conditions | TableTapy",
  description: "Terms and conditions governing the use of TableTapy restaurant operating system, a product of FlowTalk Enterprise.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 antialiased selection:bg-[#E46254]/30 font-sans relative overflow-x-hidden">
      {/* Background ambient refraction orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#E46254]/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-amber-500/10 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-[#E46254]/10 rounded-full blur-[150px]" />
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
          <FileText size={12} />
          <span>Legal & Regulatory Framework</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
          Terms & Conditions
        </h1>
        <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
          Effective Date: October 20, 2026 • TableTapy is a proprietary restaurant software suite developed and operated by <strong className="text-zinc-200">FlowTalk Enterprise</strong> (Registered Micro, Small and Medium Enterprise - MSME, Government of India).
        </p>
      </section>

      {/* Main Legal Content Container with Refraction Glass styling */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="relative rounded-3xl p-8 md:p-12 backdrop-blur-3xl bg-white/[0.02] border border-white/[0.08] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12),inset_0_-1px_1px_0_rgba(0,0,0,0.5),0_24px_64px_-12px_rgba(0,0,0,0.8)] space-y-10 text-zinc-300 text-sm leading-relaxed">
          
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              1. Agreement to Terms
            </h2>
            <p>
              By accessing, registering for, or using the TableTapy platform, including the Point-of-Sale (POS) software, Kitchen Order Ticketing (KOT) system, QR table ordering web clients, Captain floor management modules, and associated API connectors (&quot;Service&quot;), you (&quot;Subscriber&quot;, &quot;Merchant&quot;, &quot;Restaurant Partner&quot;) agree to be bound by these Terms and Conditions. If you do not agree, you must not access or utilize the Service.
            </p>
            <p>
              TableTapy is wholly owned, licensed, and maintained by <strong>FlowTalk Enterprise</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              2. Scope of Service &amp; Pre-Release Beta Notice
            </h2>
            <p>
              TableTapy provides cloud-hosted operational infrastructure for food and beverage establishments. The Service includes real-time order relay, menu distribution, inventory availability controls, billing calculators, and thermal print drivers.
            </p>
            <div className="p-4 rounded-2xl bg-[#E46254]/5 border border-[#E46254]/20 text-zinc-300 text-xs leading-normal">
              <strong className="text-[#E46254] block mb-1">Pre-Release / Beta Milestone:</strong>
              TableTapy is actively being deployed to select pilot partners across India ahead of our general availability launch. Features are continually updated to optimize kitchen latency, thermal printer spooling, and third-party delivery middleware.
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              3. Merchant Responsibilities &amp; Hardware Compatibility
            </h2>
            <p>
              Merchants are responsible for maintaining hardware compatibility (touchscreen terminals, Android tablets, Apple iPads, and ESC/POS thermal printers connected via USB, Bluetooth, or LAN) and stable local internet connectivity. While TableTapy provides offline queue resilience, continuous online order ingestion requires active network access.
            </p>
            <p>
              Merchants retain sole responsibility for the accuracy of food item pricing, GST rates (CGST, SGST, IGST), service charges, dietary labels (Veg/Non-Veg indicators), and allergen notices presented to consumers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              4. Third-Party Integrations &amp; Aggregator Middleware
            </h2>
            <p>
              TableTapy facilitates technical interoperability with third-party food delivery aggregators (including Swiggy and Zomato) through certified integration middleware partners such as UrbanPiper. FlowTalk Enterprise is not responsible for external aggregator platform downtime, delivery rider assignment delays, commission disputes, or third-party cancellation policies governed by merchant-aggregator contracts.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              5. Financial Transactions, Settlements &amp; Billing
            </h2>
            <p>
              TableTapy generates dynamic UPI QR codes and records payment tenders (Cash, UPI, Credit/Debit cards). TableTapy is not a payment bank or escrow holder. Customer payments routed via merchant UPI IDs or payment gateway accounts settle directly into the Merchant&apos;s designated bank accounts per standard banking settlement cycles (T+1 / T+2).
            </p>
            <p>
              Subscription fees for TableTapy SaaS tiers are invoiced monthly or annually. Failure to settle software subscription dues may result in suspension of cloud synchronization.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              6. Intellectual Property &amp; Data Ownership
            </h2>
            <p>
              All software architecture, source code, UI designs, refraction styling, branding, and proprietary algorithms of TableTapy remain the exclusive intellectual property of FlowTalk Enterprise. Merchants retain full ownership of their raw sales histories, customer contact registries, and proprietary recipe catalogs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#E46254]" />
              7. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable Indian law, FlowTalk Enterprise and TableTapy shall not be liable for any indirect, incidental, or consequential damages resulting from kitchen downtime, hardware disconnection, or loss of business during peak operational hours.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/[0.08] pt-8">
            <h2 className="text-xl font-semibold text-white tracking-tight">
              8. Contact &amp; Legal Notices
            </h2>
            <p>
              For legal inquiries, partnership compliance, or operational notices:
            </p>
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-400 space-y-1.5 font-mono">
              <p className="text-zinc-200 font-semibold font-sans text-sm">FlowTalk Enterprise</p>
              <p>Entity: Registered MSME (Micro Enterprise), Govt. of India</p>
              <p>Product: TableTapy Restaurant OS</p>
              <p>Email: legal@flowtalk.in / support@tabletapy.com</p>
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
