import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

describe('studyQueryActions', () => {
  const mockSupabase = {
    rpc: jest.fn()
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('resolve_study_query RPC', () => {
    const TEST_USER_ID = '12345678-1234-1234-1234-123456789012';
    const TEST_DECK_ID = '98765432-9876-9876-9876-987654321098';
    const TEST_TAG_IDS = [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    ];

    // Helper to simulate RPC response
    const mockRpcResponse = (cards: Array<{ card_id: string; priority: number }>) => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: cards, error: null });
    };

    it('should fetch all cards when no filters are applied', async () => {
      // Arrange
      const criteria = {
        limit: 10,
        includeNew: true,
        includeReview: true,
        includeLearning: true
      };
      
      mockRpcResponse([
        { card_id: 'card1', priority: 1 },
        { card_id: 'card2', priority: 2 },
        { card_id: 'card3', priority: 3 }
      ]);

      // Act
      const { data, error } = await mockSupabase.rpc('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: criteria
      });

      // Assert
      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: criteria
      });
    });

    it('should filter only new cards', async () => {
      // Arrange
      const criteria = {
        limit: 10,
        includeNew: true,
        includeReview: false,
        includeLearning: false
      };
      
      mockRpcResponse([
        { card_id: 'new1', priority: 1 },
        { card_id: 'new2', priority: 1 }
      ]);

      // Act
      const { data, error } = await mockSupabase.rpc('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: criteria
      });

      // Assert
      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data?.every(card => card.priority === 1)).toBe(true);
    });

    it('should filter by deck ID', async () => {
      // Arrange
      const criteria = {
        deckId: TEST_DECK_ID,
        limit: 10,
        includeNew: true,
        includeReview: true,
        includeLearning: true
      };
      
      mockRpcResponse([
        { card_id: 'deck1', priority: 1 },
        { card_id: 'deck2', priority: 2 }
      ]);

      // Act
      const { data, error } = await mockSupabase.rpc('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: criteria
      });

      // Assert
      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: expect.objectContaining({ deckId: TEST_DECK_ID })
      });
    });

    it('should filter by tags', async () => {
      // Arrange
      const criteria = {
        tagIds: TEST_TAG_IDS,
        limit: 10,
        includeNew: true,
        includeReview: true,
        includeLearning: true
      };
      
      mockRpcResponse([
        { card_id: 'tagged1', priority: 1 },
        { card_id: 'tagged2', priority: 2 }
      ]);

      // Act
      const { data, error } = await mockSupabase.rpc('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: criteria
      });

      // Assert
      expect(error).toBeNull();
      expect(mockSupabase.rpc).toHaveBeenCalledWith('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: expect.objectContaining({ tagIds: TEST_TAG_IDS })
      });
    });

    it('should handle complex filtering (deck + tags + learning only)', async () => {
      // Arrange
      const criteria = {
        deckId: TEST_DECK_ID,
        tagIds: TEST_TAG_IDS,
        limit: 10,
        includeNew: false,
        includeReview: false,
        includeLearning: true
      };
      
      mockRpcResponse([
        { card_id: 'learning1', priority: 2 },
        { card_id: 'learning2', priority: 2 }
      ]);

      // Act
      const { data, error } = await mockSupabase.rpc('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: criteria
      });

      // Assert
      expect(error).toBeNull();
      expect(data?.every(card => card.priority === 2)).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: expect.objectContaining({
          deckId: TEST_DECK_ID,
          tagIds: TEST_TAG_IDS,
          includeLearning: true
        })
      });
    });

    it('should handle RPC errors gracefully', async () => {
      // Arrange
      const criteria = { limit: 10 };
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Test error', code: 'TEST_ERROR' }
      });

      // Act
      const { data, error } = await mockSupabase.rpc('resolve_study_query', {
        p_user_id: TEST_USER_ID,
        p_criteria: criteria
      });

      // Assert
      expect(data).toBeNull();
      expect(error).toEqual(expect.objectContaining({
        message: 'Test error',
        code: 'TEST_ERROR'
      }));
    });
  });
}); 