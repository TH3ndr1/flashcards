// types/story.ts

export interface StoryParagraph {
  primary: string;    // Main text (L2 for translation, primary language for knowledge)
  secondary: string;  // Translation text (L1 for translation, "" for knowledge)
}

export type StoryMode = 'knowledge' | 'translation';

/** 'minimal' = shortest possible content that still conveys maximum learning impact (~300 words) */
export type ReadingTimeMin = 'minimal' | 5 | 10 | 20;

/**
 * The format/style of the generated content:
 * - 'narrative': Engaging fictional story weaving all concepts together (original mode)
 * - 'summary':   Structured audio-overview / concept recap, ideal for pre-exam review
 * - 'dialogue':  Socratic teacher-student conversation exploring all concepts naturally
 * - 'analogy':   Each concept introduced through a vivid real-world analogy or scenario
 */
export type StoryFormat = 'narrative' | 'summary' | 'dialogue' | 'analogy';

export interface Story {
  id: string;
  deck_id: string;
  user_id: string;
  age_at_generation: number;
  reading_time_min: ReadingTimeMin;
  cards_hash: string;
  deck_mode: StoryMode;
  story_format: StoryFormat;
  paragraphs: StoryParagraph[];
  is_manually_edited: boolean;
  created_at: string | null;
  updated_at: string | null;
}
