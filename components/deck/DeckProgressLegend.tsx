import React from 'react';

interface LegendStage {
  name: string;
  color: string; // Simplified to a single color for the dot, using endColor from original
  count: number;
}

interface DeckProgressLegendProps {
  newCount: number;
  learningCount: number;
  relearningCount: number;
  youngCount: number;
  matureCount: number;
  showEmptyStages?: boolean; // Prop to control if stages with 0 count are shown
}

const STAGE_DEFINITIONS = [
  { name: 'New', key: 'newCount', color: '#EF4444' }, // endColor from original pink/red
  { name: 'Learning', key: 'learningCount', color: '#9353DD' }, // endColor from original purple
  { name: 'Relearning', key: 'relearningCount', color: '#F97316' }, // endColor from original orange
  { name: 'Young', key: 'youngCount', color: '#5386DD' }, // endColor from original blue
  { name: 'Mature', key: 'matureCount', color: '#53DDDD' }, // endColor from original cyan/teal
] as const; // Use 'as const' for better type inference on keys

export function DeckProgressLegend({
  newCount,
  learningCount,
  relearningCount,
  youngCount,
  matureCount,
  showEmptyStages = false, // Default to false, as in manage/decks
}: DeckProgressLegendProps) {
  const counts = {
    newCount,
    learningCount,
    relearningCount,
    youngCount,
    matureCount,
  };

  const stagesToRender: LegendStage[] = STAGE_DEFINITIONS.map(def => ({
    name: def.name,
    color: def.color,
    count: counts[def.key],
  })).filter(stage => showEmptyStages || stage.count > 0);

  if (stagesToRender.length === 0) {
    return null; // Don't render anything if all relevant stages are empty
  }

  return (
    <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 justify-start">
      {stagesToRender.map(stage => (
        <span key={stage.name} className="flex items-center">
          <span 
            className="h-2 w-2 rounded-full mr-1.5"
            style={{ backgroundColor: stage.color }}
            aria-label={`${stage.name} color indicator`}
          ></span>
          {stage.name}: {stage.count}
        </span>
      ))}
    </div>
  );
} 