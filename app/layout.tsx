import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@shared/components/theme-provider";
import { ServiceWorkerRegister } from "@shared/components/service-worker-register";
import { InstallPwaButton } from "@shared/components/install-pwa-button";
import { AuthRecoveryBoot } from "@shared/components/auth-recovery-boot";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PAuleam — ERP & E-Commerce | Planta de Alimentos",
  description:
    "Sistema integrado de gestión industrial y comercio electrónico para planta de alimentos. Inventario, producción, ventas y más.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PAuleam",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#cc0000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
        >
          Saltar al contenido principal
        </a>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
        <AuthRecoveryBoot />
        <InstallPwaButton />
      </body>
    </html>
  );
}
