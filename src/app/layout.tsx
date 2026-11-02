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
  viewportFit: "cover",
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.className} bg-[#FBFBFC] text-zinc-900 antialiased selection:bg-[#E46254]/30`}
      >
        {children}
</body>
    </html>
  );
}
