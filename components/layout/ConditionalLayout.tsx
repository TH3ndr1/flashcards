'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';
import { ResponsiveLayout } from './ResponsiveLayout';

interface ConditionalLayoutProps {
  children: ReactNode;
}

/**
 * Conditional Layout Component
 * 
 * This component conditionally applies the ResponsiveLayout (with header/sidebar)
 * based on the current route and context. Auth routes and legal pages accessed 
 * from auth context get a clean layout without app chrome.
 */
export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Check if we're on an auth route (login, signup)
  const isAuthRoute = pathname?.startsWith('/login') || pathname?.startsWith('/signup');
  
  // Check if we're on a legal page accessed from auth context
  const isLegalFromAuth = pathname?.startsWith('/legal/') && searchParams?.get('from') === 'auth';
  
  // For auth routes or legal pages from auth context, render children directly without ResponsiveLayout
  if (isAuthRoute || isLegalFromAuth) {
    return <>{children}</>;
  }
  
  // For all other routes, use the ResponsiveLayout with header/sidebar
  return (
    <ResponsiveLayout>
      <div className="relative flex min-h-screen flex-col">
        <div className="flex-1">
          <div className="pb-8">
            {children}
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
