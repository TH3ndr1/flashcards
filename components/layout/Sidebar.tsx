'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  Sheet,
  SheetContent,
  SheetOverlay,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  User,
  Baby,
  Archive,
  Tags,
  Settings,
  List,
  BookOpen,
  PlusCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardCheck,
  LogOut,
} from 'lucide-react';
import React from 'react';
import {
  FlashcardMethodIcon,
  StoryMethodIcon,
  QuizMethodIcon,
  MindMapMethodIcon,
  KnowledgeGraphMethodIcon,
} from '@/components/study-method/study-method-config';

// ─── Icon type ─────────────────────────────────────────────────────────────────
// Permissive enough for both Lucide icons and our custom SVG icons,
// while the render code only ever passes `className`.
type IconComponent = React.ComponentType<{ className?: string; [key: string]: unknown }>;

// ─── Nav item types ────────────────────────────────────────────────────────────

type NavLink = {
  href: string;
  label: string;
  icon: IconComponent;
  iconClass?: string; // optional per-item icon colour override
  id?: undefined;
};

type NavButtonAction = {
  id: 'create-deck';
  label: string;
  icon: IconComponent;
  iconClass?: string;
  href?: undefined;
};

type NavItemUnion = NavLink | NavButtonAction;

interface NavGroupDefinition {
  group: string;
  items: NavItemUnion[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// ─── Nav items ─────────────────────────────────────────────────────────────────

const navItems: NavGroupDefinition[] = [
  {
    group: 'Study Methods',
    items: [
      {
        href: '/practice/decks',
        label: 'Flashcards',
        icon: FlashcardMethodIcon as IconComponent,
        iconClass: 'text-pink-600 dark:text-pink-400',
      },
      {
        href: '/practice/stories',
        label: 'Stories',
        icon: StoryMethodIcon as IconComponent,
        iconClass: 'text-purple-600 dark:text-purple-400',
      },
      {
        href: '/practice/quizzes',
        label: 'Quizzes',
        icon: QuizMethodIcon as IconComponent,
        iconClass: 'text-blue-600 dark:text-blue-400',
      },
      {
        href: '/practice/mindmaps',
        label: 'Mind Maps',
        icon: MindMapMethodIcon as IconComponent,
        iconClass: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        href: '/practice/knowledge-graphs',
        label: 'Knowledge Graphs',
        icon: KnowledgeGraphMethodIcon as IconComponent,
        iconClass: 'text-orange-600 dark:text-orange-400',
      },
    ],
  },
  {
    group: 'Practice',
    items: [
      { href: '/practice/sets', label: 'Playlists', icon: List as IconComponent },
      { href: '/practice/select', label: 'Custom', icon: BookOpen as IconComponent },
    ],
  },
  {
    group: 'Test',
    items: [
      { href: '/test/examination', label: 'Examination', icon: ClipboardCheck as IconComponent },
      { href: '/test/scores', label: 'Scores', icon: BarChart as IconComponent },
    ],
  },
  {
    group: 'Manage',
    items: [
      { href: '/manage/decks', label: 'Content', icon: Archive as IconComponent },
      { href: '/manage/decks/new', label: 'Create New Deck', icon: PlusCircle as IconComponent },
      { href: '/manage/tags', label: 'Tags', icon: Tags as IconComponent },
    ],
  },
  {
    group: 'Application',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings as IconComponent },
      { href: '/profile', label: 'Profile', icon: User as IconComponent },
    ],
  },
];

// ─── Sign-out button ───────────────────────────────────────────────────────────

const SignOutButton = ({ isCollapsed, onClick }: { isCollapsed: boolean; onClick?: () => void }) => {
  const handleSignOut = () => {
    onClick?.();
    window.location.href = '/api/auth/signout';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10',
            isCollapsed && 'justify-center h-10',
          )}
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
          <span className={cn(isCollapsed && 'hidden')}>Sign Out</span>
        </Button>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right">
          <p>Sign Out</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
};

// ─── Navigation content ────────────────────────────────────────────────────────

const NavigationContentInternal = ({ isCollapsed, onClose }: { isCollapsed: boolean; onClose?: () => void }) => {
  const pathname = usePathname();
  const { canAccessSettings, isChildMode } = useFeatureFlags();

  return (
    <>
      <nav className="flex flex-col gap-4 py-4">
        {navItems.map((group) => (
          <div key={group.group} className={cn('px-3', isCollapsed && 'px-1')}>
            {!isCollapsed && (
              <h4 className="mb-1 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.group}
              </h4>
            )}
            <div className="space-y-0.5">
              {group.items
                .filter((item) => {
                  if ('href' in item && item.href === '/settings') return canAccessSettings;
                  return true;
                })
                .map((item) => {
                  if (!('href' in item) || typeof item.href !== 'string') return null;

                  const isActive = pathname === item.href ||
                    // treat /practice/decks active for flashcard method pages
                    (item.href === '/practice/decks' && pathname.startsWith('/practice/decks'));

                  const label =
                    item.href === '/profile' && isChildMode ? 'Child Profile' : item.label;

                  const IconEl =
                    item.href === '/profile' && isChildMode
                      ? Baby
                      : item.icon;

                  // Determine icon colour: use per-item override, or active/default
                  const iconColorClass = item.iconClass
                    ? isActive ? item.iconClass : cn(item.iconClass, 'opacity-70')
                    : cn('h-4 w-4');

                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isActive ? 'secondary' : 'ghost'}
                          className={cn(
                            'w-full justify-start',
                            isCollapsed && 'justify-center h-10',
                          )}
                          asChild
                          onClick={onClose}
                        >
                          <Link href={item.href} aria-label={label}>
                            <IconEl
                              className={cn(
                                'h-4 w-4 flex-shrink-0',
                                !isCollapsed && 'mr-2',
                                iconColorClass,
                              )}
                            />
                            <span className={cn(isCollapsed && 'hidden')}>{label}</span>
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          <p>{label}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('px-3 pb-2', isCollapsed && 'px-1')}>
        <SignOutButton isCollapsed={isCollapsed} onClick={onClose} />
      </div>
    </>
  );
};
const NavigationContent = React.memo(NavigationContentInternal);

// ─── Sidebar shell ─────────────────────────────────────────────────────────────

const SidebarInternal = ({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) => {
  return (
    <TooltipProvider>
      {/* Mobile */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetOverlay className="md:hidden" />
        <SheetContent side="left" className="w-64 p-0 md:hidden">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Main navigation links for the application.</SheetDescription>
          <NavigationContent isCollapsed={false} onClose={onClose} />
        </SheetContent>
      </Sheet>

      {/* Desktop collapsible */}
      <aside
        className={cn(
          'hidden md:fixed md:left-0 md:top-0 md:bottom-0 md:z-30 md:flex md:h-full md:flex-col md:border-r bg-background dark:bg-slate-800 dark:border-slate-700 pt-16',
          'transition-all duration-300 ease-in-out',
          isCollapsed ? 'md:w-20' : 'md:w-64',
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
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export const Sidebar = React.memo(SidebarInternal);
