import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RegistroServiceWorker } from "@/components/pwa/registro-sw";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "TransPort ERP", template: "%s · TransPort ERP" },
  description: "Sistema integrado de gestión para los giros de negocio de TransPort, Guatemala.",
  applicationName: "TransPort ERP",
  appleWebApp: { capable: true, title: "TransPort", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0f172a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <RegistroServiceWorker />
      </body>
    </html>
  );
}
