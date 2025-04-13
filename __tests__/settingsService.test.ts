// __tests__/settingsService.test.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserSettings, updateUserSettings } from '@/lib/actions/settingsActions';
import type { Settings } from '@/providers/settings-provider';

describe('settingsService', () => {
  let mockSupabase: Partial<SupabaseClient>;

  beforeEach(() => {
    // Create a minimal mock for the Supabase client.
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
    };
  });

  describe('getUserSettings', () => {
    it('should return transformed settings if data is found', async () => {
      const mockData = {
        appLanguage: 'en',
        cardFont: 'default' as const,
        showDifficulty: true,
        masteryThreshold: 3,
        ttsEnabled: true,
        srs_algorithm: 'sm2' as const,
        languageDialects: {
          en: 'en-US',
          nl: 'nl-NL',
          fr: 'fr-FR',
          de: 'de-DE',
          es: 'es-ES',
          it: 'it-IT'
        }
      };

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const result = await getUserSettings();

      expect(result).toEqual(mockData);
    });

    it('should return null if no settings are found', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await getUserSettings();
      expect(result).toBeNull();
    });

    it('should throw an error if the database query fails', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockRejectedValue(new Error('Error occurred')),
      });

      await expect(getUserSettings()).rejects.toThrow('Error occurred');
    });
  });

  describe('updateUserSettings', () => {
    const inputSettings: Partial<Settings> = {
      appLanguage: 'en',
      cardFont: 'default' as const,
      showDifficulty: true,
      masteryThreshold: 3,
      ttsEnabled: true,
      srs_algorithm: 'sm2' as const,
      languageDialects: {
        en: 'en-US',
        nl: 'nl-NL',
        fr: 'fr-FR',
        de: 'de-DE',
        es: 'es-ES',
        it: 'it-IT'
      }
    };

    it('should update settings successfully', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: inputSettings, error: null }),
      });

      const result = await updateUserSettings({ updates: inputSettings });
      
      expect(result).toEqual(inputSettings);
    });

    it('should throw an error if the update fails', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockRejectedValue(new Error('Update failed')),
      });

      await expect(updateUserSettings({ updates: inputSettings }))
        .rejects.toThrow('Update failed');
    });
  });
});