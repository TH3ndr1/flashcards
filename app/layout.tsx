import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/hooks/use-auth"
import LayoutScript from "./layout-script"
import { Header } from "@/components/header"

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

const inter = Inter({ subsets: ["latin"] })

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
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <div className="relative flex min-h-screen flex-col">
              <div className="flex-1">
                <div className="container mx-auto py-8">
                  <Header />
                  {children}
                </div>
              </div>
            </div>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
        <LayoutScript />
      </body>
    </html>
  )
}