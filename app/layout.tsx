import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
// --- 1. Import custom font objects and cn utility ---
import { openDyslexicFont, atkinsonFont } from '@/lib/fonts';
import { cn } from '@/lib/utils';
// --- End of imports ---
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as SonnerToaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { SettingsProvider } from "@/providers/settings-provider";
import LayoutScript from "./layout-script";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "StudyCards - Interactive Flashcard App",
  description: "Study effectively with interactive question-and-answer cards",
  icons: {
    icon: [
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png'
  },
  manifest: '/manifest.json'
};

// --- 2. Configure Inter to use a CSS variable ---
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans", // Define the CSS variable name
});
// --- End of font configuration ---

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      {/* --- 3. Apply all font variables using cn --- */}
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased", // Base styles + default font utility
          fontSans.variable,           // Apply --font-sans variable
          openDyslexicFont.variable,   // Apply --font-open-dyslexic variable
          atkinsonFont.variable        // Apply --font-atkinson variable
        )}
      >
      {/* --- End of body className changes --- */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <SettingsProvider> {/* SettingsProvider now correctly nested */}
              <div className="relative flex min-h-screen flex-col">
                <div className="flex-1">
                  <div className="container mx-auto py-8">
                    <Header />
                    {children}
                  </div>
                </div>
              </div>
              <SonnerToaster richColors closeButton />
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
        <LayoutScript />
      </body>
    </html>
  )
}