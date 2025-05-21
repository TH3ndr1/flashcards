// store/studySessionStore.ts
import { create } from 'zustand';
// Import the centralized types from types/study.ts
import type { StudySessionInput, SessionType } from '@/types/study';
import { appLogger } from '@/lib/logger'; // Assuming logger is correctly set up

interface StudySessionState {
  currentInput: StudySessionInput | null;
  currentSessionType: SessionType | null; // Changed from currentMode to currentSessionType
  setStudyParameters: (input: StudySessionInput, sessionType: SessionType) => void; // Parameter changed
  clearStudyParameters: () => void;
}

/**
 * Zustand store to manage the parameters for the current or upcoming study session.
 * It now stores SessionType ('learn-only', 'review-only', 'unified') instead of the simpler StudyMode.
 */
export const useStudySessionStore = create<StudySessionState>((set) => ({
  currentInput: null,
  currentSessionType: null, // Initialize currentSessionType
  setStudyParameters: (input, sessionType) => {
      appLogger.info("[StudySessionStore] Setting parameters:", { input, sessionType });
      set({ currentInput: input, currentSessionType: sessionType }); // Store sessionType
  },
  clearStudyParameters: () => {
      appLogger.info("[StudySessionStore] Clearing parameters.");
      set({ currentInput: null, currentSessionType: null }); // Clear sessionType
  },
}));