'use client';

import { useState, useCallback, ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface ResponsiveLayoutProps {
  children: ReactNode;
}

export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen((prev) => !prev);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  const toggleDesktopSidebar = useCallback(() => {
    setIsDesktopSidebarCollapsed((prev) => !prev);
  }, []);

  const collapsedWidth = 'md:pl-20';
  const expandedWidth = 'md:pl-64';

  return (
    <div className="flex min-h-screen flex-col">
      <Header onToggleMobileSidebar={toggleMobileSidebar} />
      <div className="flex flex-1">
        <Sidebar 
          isOpen={isMobileSidebarOpen} 
          onClose={closeMobileSidebar} 
          isCollapsed={isDesktopSidebarCollapsed}
          onToggleCollapse={toggleDesktopSidebar}
        />
        <main className={cn(
          "flex-1 bg-muted/40 pt-16 transition-all duration-300 ease-in-out",
          isDesktopSidebarCollapsed ? collapsedWidth : expandedWidth
        )}>
          {children}
        </main>
      </div>
    </div>
  );
} 