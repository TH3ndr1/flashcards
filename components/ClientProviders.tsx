'use client'; // This component uses client-side features (Context)

import React from 'react';
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as SonnerToaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { SettingsProvider } from "@/providers/settings-provider";

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
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 