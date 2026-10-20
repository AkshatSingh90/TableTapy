import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Injecting a crisp, enterprise-grade sans-serif font
const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "TableTapy | Restaurant OS",
  description: "The ultimate operating system for modern restaurants.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-zinc-950 text-zinc-50 antialiased selection:bg-[#E46254]/30`}>
        {children}
      </body>
    </html>
  );
}
