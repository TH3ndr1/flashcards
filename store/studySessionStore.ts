// store/studySessionStore.ts
import { create } from 'zustand';
// Import the centralized types from types/study.ts
import type { StudySessionInput, SessionType } from '@/types/study';
import { appLogger } from '@/lib/logger'; // Assuming logger is correctly set up

interface StudySessionState {
  currentInput: StudySessionInput | null;
  currentSessionType: SessionType | null; // Changed from currentMode to currentSessionType
  sessionOriginUrl: string | null; // Added to store the origin URL
  srsEnabledForSession: boolean; // Whether SRS scheduling is enabled for the upcoming session
  setStudyParameters: (input: StudySessionInput, sessionType: SessionType, originUrl?: string, srsEnabled?: boolean) => void; // Added optional srsEnabled
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
  srsEnabledForSession: true,
  setStudyParameters: (input, sessionType, originUrl, srsEnabled) => {
      appLogger.info("[StudySessionStore] Setting parameters:", { input, sessionType, originUrl, srsEnabled });
      set({ 
        currentInput: input, 
        currentSessionType: sessionType, 
        sessionOriginUrl: originUrl ?? null,
        srsEnabledForSession: srsEnabled === undefined ? true : !!srsEnabled
      }); // Store sessionType, originUrl, and SRS toggle
  },
  clearStudyParameters: () => {
      appLogger.info("[StudySessionStore] Clearing parameters.");
      set({ currentInput: null, currentSessionType: null, sessionOriginUrl: null, srsEnabledForSession: true }); // Clear and reset SRS flag
  },
}));