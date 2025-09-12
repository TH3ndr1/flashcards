import { Atkinson_Hyperlegible } from "next/font/google";
import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
// --- 1. Import custom font objects and cn utility ---
import { openDyslexicFont, atkinsonFont } from '@/lib/fonts';
import { cn } from '@/lib/utils';
// --- End of imports ---
import "./globals.css";
import { ClientProviders } from "@/components/ClientProviders";
import { ConditionalLayout } from '@/components/layout/ConditionalLayout';
import LayoutScript from "./layout-script";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans", // Define the CSS variable name
});
// --- End of font configuration ---

/**
 * Root layout component for the application.
 * 
 * This component sets up the fundamental structure of the application, including:
 * - HTML document structure and metadata
 * - Global styles and fonts
 * - Client-side providers for authentication, theme, and settings
 * 
 * @component
 * @returns {JSX.Element} The root layout with all necessary providers and global styles
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <ClientProviders>
          <Suspense fallback={null}>
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </Suspense>
        </ClientProviders>
        <LayoutScript />
        <SpeedInsights />
      </body>
    </html>
  )
}