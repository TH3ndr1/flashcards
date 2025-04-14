'use client';

import { useState, useCallback, ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface ResponsiveLayoutProps {
  children: ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header onToggleMobileSidebar={toggleMobileSidebar} />
      <div className="flex flex-1">
        <Sidebar isOpen={isMobileSidebarOpen} onClose={closeMobileSidebar} />
        {/* Apply padding-left on medium screens and up to account for the desktop sidebar */}
        <main className="flex-1 bg-muted/40 md:pl-64 pt-16">{children}</main>
      </div>
    </div>
  );
} 