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
  BookOpen,
  Tags,
  Settings,
  LayoutDashboard,
  List,
  PlusCircle,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
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
      { href: '/decks', label: 'Decks', icon: LayoutDashboard },
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

function NavigationContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 py-4">
      {navItems.map((group) => (
        <div key={group.group} className="px-3">
          <h2 className="mb-2 px-1 text-lg font-semibold tracking-tight">
            {group.group}
          </h2>
          <div className="space-y-1">
            {group.items.map((item) => (
              <Button
                key={item.href}
                variant={pathname === item.href ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                asChild // Use Button styling on the Link
                onClick={onClose} // Close mobile sidebar on link click
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      ))}
      {/* Optional: Add Logout button at the bottom */}
      {/* <div className="mt-auto px-3">
                <Button variant="ghost" className="w-full justify-start" onClick={() => { }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div> */}
    </nav>
  );
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile Sidebar using Sheet */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetOverlay className="md:hidden" />
        <SheetContent side="left" className="w-64 p-0 md:hidden"> {/* Adjust width as needed */}
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Main navigation links for the application.</SheetDescription>
          <NavigationContent onClose={onClose} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:left-0 md:top-0 md:bottom-0 md:z-30 md:flex md:h-full md:w-64 md:flex-col md:border-r bg-background pt-16">
        <div className="flex-1 overflow-y-auto">
             <NavigationContent />
        </div>
      </aside>
    </>
  );
} 