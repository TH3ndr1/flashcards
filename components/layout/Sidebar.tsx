'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetOverlay,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // Assuming you have a utility for classnames
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookOpen,
  Tags,
  Settings,
  LayoutDashboard,
  List,
  PlusCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  {
    group: 'Practice',
    items: [
      { href: '/study/select', label: 'Start Session', icon: BookOpen },
      { href: '/study/sets', label: 'Smart Playlists', icon: List },
    ],
  },
  {
    group: 'Prepare',
    items: [
      { href: '/', label: 'Decks', icon: LayoutDashboard },
      { href: '/tags', label: 'Manage Tags', icon: Tags },
      { href: '/decks/new', label: 'Create Deck', icon: PlusCircle },
    ],
  },
  {
    group: 'Other',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
      // Add Logout or other links here
      // Example: { href: '/logout', label: 'Logout', icon: LogOut }
    ],
  },
];

function NavigationContent({ isCollapsed, onClose }: { isCollapsed: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 py-4">
      {navItems.map((group) => (
        <div key={group.group} className={cn("px-3", isCollapsed && "px-1")}>
          <div className="space-y-1">
            {group.items.map((item) => (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Button
                    variant={pathname === item.href ? 'secondary' : 'ghost'}
                    className={cn(
                      "w-full justify-start",
                      isCollapsed && "justify-center h-10"
                    )}
                    asChild
                    onClick={onClose}
                  >
                    <Link href={item.href} aria-label={item.label}>
                      <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                      <span className={cn(isCollapsed && "hidden")}>{item.label}</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
  return (
    <TooltipProvider>
      {/* Mobile Sidebar using Sheet */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetOverlay className="md:hidden" />
        <SheetContent side="left" className="w-64 p-0 md:hidden">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Main navigation links for the application.</SheetDescription>
          <NavigationContent isCollapsed={false} onClose={onClose} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - Now collapsible */}
      <aside 
        className={cn(
          "hidden md:fixed md:left-0 md:top-0 md:bottom-0 md:z-30 md:flex md:h-full md:flex-col md:border-r bg-background pt-16",
          "transition-all duration-300 ease-in-out",
          isCollapsed ? "md:w-20" : "md:w-64"
        )}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
             <NavigationContent isCollapsed={isCollapsed} />
        </div>
        <div className="mt-auto border-t p-2">
           <Button 
              variant="ghost" 
              size="icon" 
              className="w-full hidden md:block" 
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
           >
              {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
           </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
} 