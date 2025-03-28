import { fetchDecks } from '@/lib/deckService';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('deckService', () => {
  const mockSupabase: Partial<SupabaseClient> = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() =>
            Promise.resolve({ data: [{ id: 'deck1', name: 'Test Deck', cards: [] }], error: null })
          ),
        })),
      })),
    })),
  };

  it('should transform fetched decks correctly', async () => {
    const decks = await fetchDecks(mockSupabase as SupabaseClient, 'user1');
    expect(decks).toEqual([
      expect.objectContaining({ id: 'deck1', name: 'Test Deck', cards: [] }),
    ]);
  });
});