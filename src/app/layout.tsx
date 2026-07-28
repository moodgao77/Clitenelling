import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

// Raleway is Marushika's approved marketing/UI typeface. Self-hosted by Next.
const raleway = Raleway({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-raleway",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Marushika · Clienteling",
  description: "The client book for the showroom floor.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4a0e33",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${raleway.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <div className="flex-1">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
