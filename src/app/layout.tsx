import type { Metadata } from "next";
import { Open_Sans, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { NicheProvider } from "@/contexts/NicheContext";
import { ProtectionProvider } from "@/contexts/ProtectionContext";
import { LayoutClient } from "@/components/layout-client";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shorts Analyzer",
  description: "AI-powered shorts analysis and trending content discovery",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${openSans.variable} ${inter.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <ProtectionProvider>
            <NicheProvider>
              <LayoutClient>
                {children}
              </LayoutClient>
            </NicheProvider>
          </ProtectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
