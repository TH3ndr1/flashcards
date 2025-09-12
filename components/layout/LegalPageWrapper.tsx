"use client";

import { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface LegalPageWrapperProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * Legal Page Wrapper Component
 * 
 * This component provides different layouts for legal pages based on context:
 * - Standalone layout when accessed from auth pages (signup/login)
 * - Regular layout when accessed from within the main app
 * 
 * Context is determined by URL parameters or referrer
 */
export function LegalPageWrapper({ children, title, subtitle }: LegalPageWrapperProps) {
  const searchParams = useSearchParams();
  const isAuthContext = searchParams?.get('from') === 'auth';
  const backUrl = isAuthContext ? '/signup' : '/profile?tab=legal';
  const backText = isAuthContext ? 'Back to Sign Up' : 'Back to Legal Overview';

  // Standalone layout for auth context
  if (isAuthContext) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link href={backUrl}>
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backText}
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
            <p className="text-muted-foreground mt-1">Last updated: September 12, 2025</p>
          </div>
          
          <div className="space-y-6">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Regular layout for main app context
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <Link href={backUrl}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backText}
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        <p className="text-muted-foreground mt-1">Last updated: September 12, 2025</p>
      </div>
      
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
