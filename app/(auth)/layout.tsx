import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Authentication Layout Component
 * 
 * This layout provides a clean, standalone interface for authentication
 * pages without the main app's header and sidebar.
 * 
 * Note: This layout is nested within the root layout, so it inherits
 * the ClientProviders but overrides the ResponsiveLayout structure.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
