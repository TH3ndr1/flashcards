/**
 * Client-side providers wrapper component.
 * 
 * This component groups all client-side context providers required by the application:
 * - ThemeProvider: Manages light/dark theme state
 * - AuthProvider: Handles authentication state and user session
 * - SettingsProvider: Manages user preferences and settings
 * - SonnerToaster: Provides toast notifications
 * 
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to be wrapped by providers
 * @returns {JSX.Element} Wrapped children with all necessary providers
 */

'use client'; // This component uses client-side features (Context)

import React from 'react';
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as SonnerToaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { SettingsProvider } from "@/providers/settings-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";

interface ClientProvidersProps {
  children: React.ReactNode;
}

/**
 * Wraps the main application content with client-side context providers.
 */
export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem 
        disableTransitionOnChange
    >
      <AuthProvider>
        <SettingsProvider>
          {children}
          <SonnerToaster richColors closeButton />
          <SpeedInsights />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 