import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@shared/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PAuleam — ERP & E-Commerce | Planta de Alimentos",
  description:
    "Sistema integrado de gestión industrial y comercio electrónico para planta de alimentos. Inventario, producción, ventas y más.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
