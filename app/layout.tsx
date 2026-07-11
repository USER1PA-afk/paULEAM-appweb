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

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://pauleam.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PAuleam — Planta de Alimentos ULEAM | Productos Artesanales",
    template: "%s | PAuleam — Planta de Alimentos ULEAM",
  },
  description:
    "Productos alimenticios artesanales elaborados en la Planta de Alimentos de la ULEAM. Quesos, embutidos y más. Calidad académica, trazabilidad completa, directo a tu mesa.",
  keywords: [
    "PAuleam",
    "Planta de Alimentos ULEAM",
    "ULEAM",
    "productos artesanales Ecuador",
    "queso manaba",
    "embutidos artesanales",
    "planta de alimentos Chone",
    "productos lácteos ULEAM",
    "Queso Manaba",
    "Panchitos ULEAM",
  ],
  authors: [{ name: "Planta de Alimentos ULEAM" }],
  creator: "Planta de Alimentos ULEAM",
  publisher: "Universidad Laica Eloy Alfaro de Manabí (ULEAM)",
  applicationName: "PAuleam",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "o3DzClk0eI-CVW7kn3tbyHSPy-Gx-eOL8ce0zwBm6Ps",
  },
  openGraph: {
    type: "website",
    locale: "es_EC",
    url: SITE_URL,
    siteName: "PAuleam — Planta de Alimentos ULEAM",
    title: "PAuleam — Productos Artesanales de la Planta de Alimentos ULEAM",
    description:
      "Productos alimenticios artesanales elaborados en la Planta de Alimentos de la ULEAM. Calidad académica, trazabilidad completa, directo a tu mesa.",
    images: [
      {
        url: "/logo-pauleam.png",
        width: 512,
        height: 512,
        alt: "PAuleam — Planta de Alimentos ULEAM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PAuleam — Planta de Alimentos ULEAM",
    description:
      "Productos alimenticios artesanales elaborados en la Planta de Alimentos de la ULEAM.",
    images: ["/logo-pauleam.png"],
  },
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
  category: "food",
};

export const viewport: Viewport = {
  themeColor: "#cc0000",
  width: "device-width",
  initialScale: 1,
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
