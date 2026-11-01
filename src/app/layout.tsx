import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider, ThemeScript } from "@/components/ThemeProvider";

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
        <ThemeScript />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.className} bg-[#FBFBFC] dark:bg-[#070709] text-zinc-900 dark:text-zinc-100 antialiased selection:bg-[#E46254]/30`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
