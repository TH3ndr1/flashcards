import { create } from 'zustand';
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema'; // Adjust path if needed
import { appLogger, statusLogger } from '@/lib/logger';

// Export the types
export type StudyMode = 'learn' | 'review'; 
export type StudyInput = { criteria: StudyQueryCriteria } | { studySetId: string };

interface StudySessionState {
  currentInput: StudyInput | null; 
  currentMode: StudyMode | null; 
  setStudyParameters: (input: StudyInput, mode: StudyMode) => void;
  clearStudyParameters: () => void; 
}

/**
 * Zustand store to manage the parameters for the current or upcoming study session.
 */
export const useStudySessionStore = create<StudySessionState>((set) => ({
  currentInput: null,
  currentMode: null,
  setStudyParameters: (input, mode) => {
      appLogger.info("[StudySessionStore] Setting parameters:", { input, mode });
      set({ currentInput: input, currentMode: mode });
  },
  clearStudyParameters: () => {
      appLogger.info("[StudySessionStore] Clearing parameters.");
      set({ currentInput: null, currentMode: null });
  },
})); 