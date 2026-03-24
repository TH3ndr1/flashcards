// types/story.ts

export interface StoryParagraph {
  primary: string;    // Main story text (L2 for translation, L1 for knowledge)
  secondary: string;  // Translation text (L1 for translation, "" for knowledge)
}

export type StoryMode = 'knowledge' | 'translation';
export type ReadingTimeMin = 5 | 10 | 20;

export interface Story {
  id: string;
  deck_id: string;
  user_id: string;
  age_at_generation: number;
  reading_time_min: ReadingTimeMin;
  cards_hash: string;
  deck_mode: StoryMode;
  paragraphs: StoryParagraph[];
  is_manually_edited: boolean;
  created_at: string | null;
  updated_at: string | null;
}
