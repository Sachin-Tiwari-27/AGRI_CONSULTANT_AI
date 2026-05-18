import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "AgriAI Platform",
  description: "AI-powered agricultural consultancy platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-surface text-foreground antialiased font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
