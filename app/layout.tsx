import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import ServiceWorkerRegister from "./sw-register";
import ThemeProvider from "@/components/ui/ThemeProvider";
import Toaster from "@/components/ui/Toaster";
import OfflineBanner from "@/components/ui/OfflineBanner";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: {
    default: "SelfOS",
    template: "%s · SelfOS",
  },
  description: "Workspace modulare self-hosted per organizzare vita, mente e obiettivi",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SelfOS",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${geist.variable} h-full antialiased`} data-theme="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* iOS splash screens — dark background matching the app */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-[100dvh] bg-sb text-sb flex flex-col transition-colors duration-200">
        <ThemeProvider>
          <ServiceWorkerRegister />
          <Toaster />
          <OfflineBanner />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
