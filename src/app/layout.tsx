import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
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
    <html lang="en">
      <body><AppRouterCacheProvider options={{ enableCssLayer: true }}>{children}<Toaster richColors position="top-right" /></AppRouterCacheProvider></body>
    </html>
  );
}
