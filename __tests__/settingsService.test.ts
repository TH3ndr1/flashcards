// __tests__/settingsService.test.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchSettings, updateSettings } from '@/lib/settingsService';
import type { Settings } from '@/hooks/use-settings';

describe('settingsService', () => {
  let mockSupabase: Partial<SupabaseClient>;

  beforeEach(() => {
    // Create a minimal mock for the Supabase client.
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
    };
  });

  describe('fetchSettings', () => {
    it('should return transformed settings if data is found', async () => {
      const mockData = {
        id: 'setting1',
        user_id: 'user1',
        app_language: 'fr',
      };

      // Setup chainable mocks for fetching settings
      (mockSupabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const result = await fetchSettings(mockSupabase as SupabaseClient, 'user1');

      expect(result).toEqual({
        id: 'setting1',
        userId: 'user1',
        appLanguage: 'fr',
      });
    });

    it('should return null if no data is found', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      const result = await fetchSettings(mockSupabase as SupabaseClient, 'user1');
      expect(result).toBeNull();
    });

    it('should throw an error if fetching settings fails', async () => {
      // Simulate an error by having maybeSingle reject
      (mockSupabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockRejectedValue(new Error('Error occurred')),
      });
      await expect(fetchSettings(mockSupabase as SupabaseClient, 'user1')).rejects.toThrow('Error occurred');
    });
  });

  describe('updateSettings', () => {
    const inputSettings: Settings = {
      id: 'setting1',
      userId: 'user1',
      appLanguage: 'fr',
    };

    it('should update settings and return transformed settings', async () => {
      const returnedData = {
        id: 'setting1',
        user_id: 'user1',
        app_language: 'fr',
      };

      // Setup chainable mocks for upserting settings
      (mockSupabase.from as jest.Mock).mockReturnValueOnce({
        upsert: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: returnedData,
              error: null 
            }),
          }),
        }),
      });

      const result = await updateSettings(mockSupabase as SupabaseClient, 'user1', inputSettings);
      
      // The service returns snake_case data directly from Supabase
      expect(result).toEqual({
        id: 'setting1',
        user_id: 'user1',
        app_language: 'fr',
      });
    });

    it('should throw an error if update fails', async () => {
      // Simulate update failure by having maybeSingle reject
      (mockSupabase.from as jest.Mock).mockReturnValueOnce({
        upsert: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockRejectedValue(new Error('Update failed')),
          }),
        }),
      });

      await expect(updateSettings(mockSupabase as SupabaseClient, 'user1', inputSettings))
        .rejects.toThrow('Update failed');
    });
  });
});