import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "eCheckPay — print checks banks accept",
  description:
    "eCheckPay writes and prints bank-acceptable checks: true E-13B MICR on the ANSI position grid, a protected clear band, the anti-counterfeit feature stack and one-click Positive Pay export.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="text-slate-900 antialiased">{children}</body>
    </html>
  );
}
