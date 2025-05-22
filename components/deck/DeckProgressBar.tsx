'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DeckProgressBarProps {
  newCount: number;
  learningCount: number;
  relearningCount: number;
  youngCount: number;
  matureCount: number;
  onClick?: () => void;
}

// Custom hook to track element width
function useElementWidth(elementRef: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const currentElement = elementRef.current;
    if (!currentElement) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(currentElement);

    // Initial width set
    setWidth(currentElement.offsetWidth);

    return () => resizeObserver.disconnect();
  }, [elementRef]);

  return width;
}

export function DeckProgressBar({
  newCount,
  learningCount,
  relearningCount,
  youngCount,
  matureCount,
}: Omit<DeckProgressBarProps, 'onClick'>) {
  const totalCount = newCount + learningCount + relearningCount + youngCount + matureCount;
  const rootRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasAnimated(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Define stages with gradient hex codes
  const stages = [
    { name: 'New', count: newCount, percentage: totalCount > 0 ? (newCount / totalCount) * 100 : 0, startColor: '#EC4899', endColor: '#EF4444' },
    { name: 'Learning', count: learningCount, percentage: totalCount > 0 ? (learningCount / totalCount) * 100 : 0, startColor: '#DA55C6', endColor: '#9353DD' },
    { name: 'Relearning', count: relearningCount, percentage: totalCount > 0 ? (relearningCount / totalCount) * 100 : 0, startColor: '#F59E0B', endColor: '#F97316' },
    { name: 'Young', count: youngCount, percentage: totalCount > 0 ? (youngCount / totalCount) * 100 : 0, startColor: '#6055DA', endColor: '#5386DD' },
    { name: 'Mature', count: matureCount, percentage: totalCount > 0 ? (matureCount / totalCount) * 100 : 0, startColor: '#55A9DA', endColor: '#53DDDD' },
  ];

  // Placeholder for zero cards
  if (totalCount === 0) {
    return (
      <div
        ref={rootRef}
        className="h-3 w-full bg-muted rounded-lg flex items-center justify-center px-2"
      >
        <span className="text-xs text-muted-foreground">No cards yet</span>
      </div>
    );
  }

  // Calculate percentages safely
  const newPercentage = stages[0].percentage;
  const learningPercentage = stages[1].percentage;
  const relearningPercentage = stages[2].percentage;
  const youngPercentage = stages[3].percentage;
  const maturePercentage = stages[4].percentage;

  const ariaLabel = `Deck progress: ${Math.round(maturePercentage)}% mature, ${Math.round(youngPercentage)}% young, ${Math.round(relearningPercentage)}% relearning, ${Math.round(learningPercentage)}% learning, ${Math.round(newPercentage)}% new. Total ${totalCount} cards.`;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      aria-label={ariaLabel}
      className={cn(
        "relative w-full h-3 rounded-lg overflow-hidden bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      {/* Flex container for slices and gutters */}
      <div className="absolute inset-0 flex w-full h-full gap-px bg-border">
        {stages.map((stage, index) => {
          if (stage.count === 0) return null;
          const width = hasAnimated ? `${stage.percentage}%` : '0%';
          return (
            <TooltipProvider key={stage.name}>
              <Tooltip delayDuration={100}>
                <TooltipTrigger
                  asChild
                  aria-label={`${stage.name}: ${stage.count} card${stage.count === 1 ? '' : 's'}`}
                >
                  <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{
                      width: width,
                      backgroundImage: `linear-gradient(to right, ${stage.startColor}, ${stage.endColor})`,
                      marginLeft: index > 0 && stages.slice(0, index).every(s => s.count === 0) ? '0' : index > 0 ? '1px' : '0',
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {stage.name}: {stage.count} card{stage.count === 1 ? '' : 's'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
      {/* Animation Overlay */}
      <div
        className={cn(
          'absolute inset-0 bg-background transition-transform duration-600 ease-out',
          hasAnimated ? '-translate-x-full' : 'translate-x-0'
        )}
      />
    </div>
  );
}