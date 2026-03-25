// store/storyStore.ts
import { create } from 'zustand';
import { appLogger } from '@/lib/logger';
import type { Story } from '@/types/story';

interface StoryState {
  currentStory: Story | null;
  currentDeckName: string | null;
  currentDeckId: string | null;
  originUrl: string | null;
  setCurrentStory: (story: Story, deckName: string, deckId: string, originUrl?: string) => void;
  clearCurrentStory: () => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  currentStory: null,
  currentDeckName: null,
  currentDeckId: null,
  originUrl: null,
  setCurrentStory: (story, deckName, deckId, originUrl) => {
    appLogger.info('[StoryStore] Setting current story:', { storyId: story.id, deckName, deckId });
    set({ currentStory: story, currentDeckName: deckName, currentDeckId: deckId, originUrl: originUrl ?? null });
  },
  clearCurrentStory: () => {
    appLogger.info('[StoryStore] Clearing current story.');
    set({ currentStory: null, currentDeckName: null, currentDeckId: null, originUrl: null });
  },
}));
