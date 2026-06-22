import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "Faculty and Staff Management System",
    template: "%s | Faculty and Staff Management System",
  },
  description:
    "Local faculty and staff leave, attendance, and payroll deduction management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}<Toaster richColors position="top-right" /></body>
    </html>
  );
}
