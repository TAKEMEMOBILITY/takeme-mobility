import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display, DM_Sans } from "next/font/google";
import ClientProviders from "@/components/ClientProviders";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  weight: "400",
  variable: "--font-dm-serif",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TakeMe Mobility — Premium Global Transportation",
  description: "Premium rides, transparent pricing, and world-class reliability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClientProviders>
          {/* Horizontal overflow is contained on this wrapper, NOT on
              html/body — that combination breaks vertical scrolling on
              iOS Safari. */}
          <div className="flex-1" style={{ overflowX: 'hidden' }}>{children}</div>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  );
}
