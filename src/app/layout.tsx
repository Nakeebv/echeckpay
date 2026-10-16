import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "eCheckPay — print checks banks accept",
    template: "%s · eCheckPay",
  },
  description:
    "eCheckPay writes and prints bank-acceptable checks: true E-13B MICR on the ANSI position grid, a protected clear band, the anti-counterfeit feature stack and one-click Positive Pay export.",
  applicationName: "eCheckPay",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
