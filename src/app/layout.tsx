import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header, BottomNav } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Smart Ambak AI - Deteksi Penyakit Udang",
  description: "Aplikasi deteksi penyakit udang tambak dengan komparasi 3 model AI Ultralytics dan validasi manusia.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smart Ambak AI",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased flex flex-col selection:bg-cyan-500 selection:text-black">
        <Header />
        <main className="flex-1 w-full max-w-lg mx-auto px-3 pt-2">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
