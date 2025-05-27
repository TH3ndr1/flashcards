import React from 'react';
import { Tag as TagIcon, Globe as GlobeIcon, Layers as LayersIcon, CalendarCheck as AgendaIcon } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
}

interface ItemInfoBadgesProps {
  primaryLanguage?: string | null;
  secondaryLanguage?: string | null;
  isBilingual?: boolean;
  languageCriterion?: string | null; // For study sets (containsLanguage)
  tags?: Tag[];
  cardCount?: number;
  practiceableCount?: number;
}

export function ItemInfoBadges({
  primaryLanguage,
  secondaryLanguage,
  isBilingual,
  languageCriterion,
  tags = [],
  cardCount,
  practiceableCount,
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

  if (cardCount === undefined && !languageText && (!tags || tags.length === 0)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
      {/* Combined Card Count and Due Count Badge (Now First) */}
      {cardCount !== undefined && (
        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100 border-2 border-transparent">
          {practiceableCount && practiceableCount > 0 ? (
            <AgendaIcon className="h-3 w-3 mr-1" />
          ) : (
            <LayersIcon className="h-3 w-3 mr-1" />
          )}
          {practiceableCount && practiceableCount > 0 ? (
            <>
              {practiceableCount} of {cardCount} card{cardCount !== 1 ? 's' : ''} due
            </>
          ) : (
            <>
              {cardCount} card{cardCount !== 1 ? 's' : ''}
            </>
          )}
        </span>
      )}

      {/* Language Badge */}
      {languageText && (
        <span className="inline-flex items-center text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-slate-700 dark:text-slate-100 border-2 border-transparent">
          <GlobeIcon className="h-3 w-3 mr-1" />
          {languageText}
        </span>
      )}

      {/* Tags Badges */}
      {tags && tags.map(tag => (
        <span key={tag.id} className="inline-flex items-center text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-slate-700 dark:text-slate-100 border-2 border-transparent">
          <TagIcon className="h-3 w-3 mr-1" />
          {tag.name}
        </span>
      ))}
    </div>
  );
} 