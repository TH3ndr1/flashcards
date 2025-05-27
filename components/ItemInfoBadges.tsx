import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tag as TagIcon, Layers as LayersIcon, Globe as GlobeIcon } from 'lucide-react';

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
  let languageText: string | null = null;

  if (languageCriterion) {
    languageText = languageCriterion;
  } else if (primaryLanguage) {
    if (isBilingual && secondaryLanguage) {
      languageText = `${primaryLanguage} / ${secondaryLanguage}`;
    } else {
      languageText = primaryLanguage;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
      {/* Language Badge (Single, with icon, combined if bilingual, slate styled) */}
      {languageText && (
        <span className="inline-flex items-center text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-slate-700 dark:text-slate-100">
          <GlobeIcon className="h-3 w-3 mr-1" />
          {languageText}
        </span>
      )}

      {/* Card Count Badge (Styled like tags) */}
      <span className="inline-flex items-center text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-slate-700 dark:text-slate-100">
        <LayersIcon className="h-3 w-3 mr-1" />
        {cardCount} card{cardCount !== 1 ? 's' : ''}
      </span>

      {/* Tags Badges (Ensuring consistent padding) */}
      {tags && tags.map(tag => (
        <span key={tag.id} className="inline-flex items-center text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-slate-700 dark:text-slate-100">
          <TagIcon className="h-3 w-3 mr-1" />
          {tag.name}
        </span>
      ))}
    </div>
  );
} 