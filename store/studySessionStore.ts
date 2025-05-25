// store/studySessionStore.ts
import { create } from 'zustand';
// Import the centralized types from types/study.ts
import type { StudySessionInput, SessionType } from '@/types/study';
import { appLogger } from '@/lib/logger'; // Assuming logger is correctly set up

interface StudySessionState {
  currentInput: StudySessionInput | null;
  currentSessionType: SessionType | null; // Changed from currentMode to currentSessionType
  sessionOriginUrl: string | null; // Added to store the origin URL
  setStudyParameters: (input: StudySessionInput, sessionType: SessionType, originUrl?: string) => void; // Parameter changed, added originUrl
  clearStudyParameters: () => void;
  // Removed setSessionOriginUrl as it's integrated into setStudyParameters
}

/**
 * Zustand store to manage the parameters for the current or upcoming study session.
 * It now stores SessionType ('learn-only', 'review-only', 'unified') instead of the simpler StudyMode.
 * It also stores the URL from which the study session was initiated.
 */
export const useStudySessionStore = create<StudySessionState>((set) => ({
  currentInput: null,
  currentSessionType: null, // Initialize currentSessionType
  sessionOriginUrl: null, // Initialize sessionOriginUrl
  setStudyParameters: (input, sessionType, originUrl) => {
      appLogger.info("[StudySessionStore] Setting parameters:", { input, sessionType, originUrl });
      set({ currentInput: input, currentSessionType: sessionType, sessionOriginUrl: originUrl ?? null }); // Store sessionType and originUrl
  },
  clearStudyParameters: () => {
      appLogger.info("[StudySessionStore] Clearing parameters.");
      set({ currentInput: null, currentSessionType: null, sessionOriginUrl: null }); // Clear sessionType and originUrl
  },
}));