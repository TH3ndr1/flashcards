import React from 'react';
import { Badge } from '@/components/ui/badge';

interface Tag {
  id: string;
  name: string;
}

interface ItemInfoBadgesProps {
  primaryLanguage?: string | null;
  secondaryLanguage?: string | null;
  isBilingual?: boolean;
  languageCriterion?: string | null; // For study sets (containsLanguage)
  cardCount: number;
  tags?: Tag[];
}

export function ItemInfoBadges({
  primaryLanguage,
  secondaryLanguage,
  isBilingual,
  languageCriterion,
  cardCount,
  tags = [],
}: ItemInfoBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
      {/* Language Badges Logic */}
      {primaryLanguage && !languageCriterion && (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-blue-700 dark:text-blue-100">
          {primaryLanguage}
        </span>
      )}
      {isBilingual && secondaryLanguage && !languageCriterion && (
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-indigo-700 dark:text-indigo-100">
          {secondaryLanguage}
        </span>
      )}
      {languageCriterion && (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-blue-700 dark:text-blue-100">
          {languageCriterion}
        </span>
      )}

      {/* Card Count Badge */}
      <Badge variant="secondary" className="whitespace-nowrap">
        {cardCount} card{cardCount !== 1 ? 's' : ''}
      </Badge>

      {/* Tags Badges */}
      {tags && tags.map(tag => (
        <span key={tag.id} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-slate-700 dark:text-slate-100">
          {tag.name}
        </span>
      ))}
    </div>
  );
} 