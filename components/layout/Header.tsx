'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, Settings, Volume2 } from 'lucide-react';
import Image from 'next/image';
import { UserNavButton } from '@/components/user-nav';
import { TTSToggleButton } from '@/components/tts-toggle-button';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import React from 'react';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
}

const HeaderInternal = ({ onToggleMobileSidebar }: HeaderProps) => {
  const { canAccessSettings } = useFeatureFlags();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      {/* Hamburger Menu for Mobile */}
      <Button
        variant="outline"
        size="icon"
        className="md:hidden mr-3" // Only show on mobile, ADDED mr-3 for spacing
        onClick={onToggleMobileSidebar}
        aria-label="Toggle Menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* App Title/Logo - Updated with Image and Text */}
      <div className="flex items-center md:ml-0">
        <Link href="/" className="flex items-center gap-2 font-semibold group">
          <Image 
            src="/favicon.svg"
            alt="StudyCards Logo" 
            width={28}
            height={28}
            className="transition-transform group-hover:scale-110"
          />
          <span className="text-lg">StudyCards</span>
        </Link>
      </div>

      {/* Spacer to push icons to the right */}
      <div className="flex-1 md:hidden"></div>

      {/* Right-side icons */}
      <div className="flex items-center gap-3">
         {/* Settings Button - Hidden on mobile and when child mode is active */}
        {canAccessSettings && (
          <Link href="/settings" className="hidden md:inline-flex"> {/* Hide Link on mobile */}
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        )}
        {/* Use the actual TTSToggleButton component */}
        <div className="hidden md:inline-flex"> {/* Wrapper to maintain layout */} 
          <TTSToggleButton />
        </div>
        {/* User/Profile Button (Using Functional Component) - Always visible */} 
        <UserNavButton />
      </div>
    </header>
  );
};

export const Header = React.memo(HeaderInternal); 