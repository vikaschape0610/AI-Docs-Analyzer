import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocMind AI — Your Personal Document Intelligence",
  description:
    "Ask anything about your documents. Upload PDFs, images, and files. Get instant AI-powered answers from your personal document library.",
  keywords: ["document AI", "PDF chat", "document search", "OCR", "RAG"],
  openGraph: {
    title: "DocMind AI",
    description: "Your personal AI document assistant",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full antialiased">
        <AppProvider>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
        </AppProvider>
      </body>
    </html>
  );
}
