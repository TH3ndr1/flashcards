import { fetchDecks, getDeckService, createDeckService, updateDeckService, deleteDeckService } from '@/lib/deckService';
import type { Deck, FlashCard } from '@/types/deck';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

// --- Mock Data (using camelCase as defined in types/deck.ts) ---
const mockDeck1: Deck = {
  id: 'deck1',
  name: 'Test Deck 1',
  language: 'en-US',
  isBilingual: false,
  questionLanguage: 'en-US',
  answerLanguage: 'en-US',
  cards: [],
  progress: { correct: 0, total: 0 }
};
const mockCard1: FlashCard = {
  id: 'card1',
  question: 'Q1',
  answer: 'A1',
  correctCount: 0,
  incorrectCount: 0,
  lastStudied: null,
  attemptCount: 0,
  difficultyScore: 0
};
const mockCard2: FlashCard = {
  id: 'card2',
  question: 'Q2',
  answer: 'A2',
  correctCount: 1,
  incorrectCount: 0,
  lastStudied: new Date(),
  attemptCount: 1,
  difficultyScore: 0.1
};
const mockDeckWithCards: Deck = { ...mockDeck1, cards: [mockCard1, mockCard2] };

// --- Define CreateDeckParams inline based on expected usage ---
interface CreateDeckParamsTest {
  name: string;
  isBilingual: boolean;
  questionLanguage: string;
  answerLanguage: string;
}

describe('deckService', () => {
  // --- Mock Supabase Client Setup ---
  let mockSupabase: SupabaseClient;
  let mockFrom: jest.Mock;
  let mockSelect: jest.Mock;
  let mockEq: jest.Mock;
  let mockOrder: jest.Mock;
  let mockSingle: jest.Mock;
  let mockInsert: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockDelete: jest.Mock;
  let mockUpsert: jest.Mock;
  let mockReturns: jest.Mock; // Added mock for .returns()
  let mockIn: jest.Mock; // Added mock for .in()

  beforeEach(() => {
    // Reset mocks before each test
    mockReturns = jest.fn(); // Mock for .returns()
    mockSingle = jest.fn(() => ({ returns: mockReturns })); // .single() returns object with .returns()
    mockOrder = jest.fn(() => ({ returns: mockReturns })); // .order() returns object with .returns()
    mockIn = jest.fn(); // Placeholder for .in()

    // mockEq needs to return itself AND other chain terminators/modifiers
    const eqReturnObject: any = { 
      order: mockOrder, 
      single: mockSingle, 
      eq: jest.fn(), // Placeholder for self-reference
      in: mockIn, // Add mock for .in()
      // .returns() needed if eq is the last call
      returns: mockReturns 
    };
    mockEq = jest.fn(() => eqReturnObject);
    eqReturnObject.eq = mockEq; // Make eq return itself for chaining
    // Make .in() return an object allowing termination with .eq or .returns()
    // (Adjust if .in() needs to chain with other methods)
    mockIn.mockImplementation(() => ({ eq: mockEq, returns: mockReturns })); 

    // Mock .select() to return object with .eq and potentially .single/.returns
    mockSelect = jest.fn(() => ({ eq: mockEq, single: mockSingle, returns: mockReturns }));
    // Mock insert/upsert to return object with .select
    mockInsert = jest.fn(() => ({ select: mockSelect }));
    mockUpsert = jest.fn(() => ({ select: mockSelect })); // Assuming upsert returns select() like insert()
    // Mock update/delete to return object with .eq (and potentially other filters like .in)
    mockUpdate = jest.fn(() => ({ eq: mockEq })); // update -> eq
    mockDelete = jest.fn(() => ({ eq: mockEq, in: mockIn })); // delete -> eq or delete -> in
    // Mock .from() to return object with all possible first methods
    mockFrom = jest.fn(() => ({ 
      select: mockSelect, 
      insert: mockInsert, 
      update: mockUpdate, 
      delete: mockDelete, 
      upsert: mockUpsert 
    }));

    // Assign the mock implementation
    mockSupabase = { from: mockFrom } as any; 
  });

  // --- fetchDecks Tests ---
  describe('fetchDecks', () => {
    const userId = 'user1';
    it('should fetch and return decks for a user', async () => {
      // Arrange: Mock the chain ending with .returns()
      const mockRawDecks = [{ /* ... raw deck data ... */ }]; // Simulate raw DB result
      mockReturns.mockResolvedValueOnce({ data: mockRawDecks, error: null });

      // Act
      const result = await fetchDecks(mockSupabase, userId);

      // Assert
      expect(mockFrom).toHaveBeenCalledWith('decks');
      expect(mockSelect).toHaveBeenCalled(); 
      expect(mockEq).toHaveBeenCalledWith('user_id', userId);
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockReturns).toHaveBeenCalledTimes(1);
      expect(result.data).toBeDefined(); // Check data exists
      expect(result.error).toBeNull();
    });

    it('should return an error if Supabase fetch fails', async () => {
      // Arrange
      const dbError = { message: 'Database fetch failed', details: '', hint: '', code: 'DB_ERROR' } as PostgrestError;
      mockReturns.mockResolvedValueOnce({ data: null, error: dbError });

      // Act
      const result = await fetchDecks(mockSupabase, userId);

      // Assert
      expect(mockReturns).toHaveBeenCalledTimes(1);
      expect(result.data).toBeNull();
      expect(result.error).toBe(dbError);
    });
  });

  // --- getDeckService Tests ---
  describe('getDeckService', () => {
    const deckId = 'deck1';
    const userId = 'user1';
    const mockRawDeck = { /* ... raw deck data ... */ }; // Simulate DB structure

    it('should fetch a single deck and its associated cards', async () => {
      // Arrange: Mock the chain eq -> eq -> single -> returns
      mockReturns.mockResolvedValueOnce({ data: mockRawDeck, error: null }); 

      // Act
      const result = await getDeckService(mockSupabase, userId, deckId); // Add userId

      // Assert
      expect(mockFrom).toHaveBeenCalledWith('decks');
      expect(mockSelect).toHaveBeenCalled(); // Check exact select if needed
      expect(mockEq).toHaveBeenCalledWith('id', deckId);
      expect(mockEq).toHaveBeenCalledWith('user_id', userId); // Check second eq call
      expect(mockSingle).toHaveBeenCalledTimes(1);
      expect(mockReturns).toHaveBeenCalledTimes(1);
      expect(result.data).toBeDefined(); // Check transformed data exists
      expect(result.error).toBeNull();
    });

    it('should return null data if the deck is not found', async () => {
      // Arrange: Mock deck fetch returning PGRST116 error
      const notFoundError = { message: 'Not Found', details: '', hint: '', code: 'PGRST116' } as PostgrestError;
      mockReturns.mockResolvedValueOnce({ data: null, error: notFoundError });

      // Act
      const result = await getDeckService(mockSupabase, userId, 'nonexistent-deck'); // Add userId

      // Assert
      expect(mockReturns).toHaveBeenCalledTimes(1);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull(); // Service transforms PGRST116
    });

    it('should return an error if fetching the deck fails (non-PGRST116)', async () => {
      // Arrange: Mock deck fetch returning a different error
      const dbError = { message: 'Deck fetch error', details: '', hint: '', code: 'DB_ERROR' } as PostgrestError;
      mockReturns.mockResolvedValueOnce({ data: null, error: dbError });

      // Act
      const result = await getDeckService(mockSupabase, userId, deckId); // Add userId

      // Assert
      expect(mockReturns).toHaveBeenCalledTimes(1);
      expect(result.data).toBeNull();
      expect(result.error).toBe(dbError);
    });
  });

  // --- createDeckService Tests ---
  describe('createDeckService', () => {
    const userId = 'user1';
    const deckParams: CreateDeckParamsTest = {
      name: 'New Test Deck',
      isBilingual: false,
      questionLanguage: 'en-US',
      answerLanguage: 'en-US',
    };
    const expectedInsertData = { /* ... */ user_id: userId }; // Data passed to insert (snake_case)
    const mockRawCreatedDeck = {
      id: 'new-id',
      name: deckParams.name,
      user_id: userId, // Not in Deck type, but likely in raw data
      language: deckParams.questionLanguage,
      is_bilingual: deckParams.isBilingual,
      question_language: deckParams.questionLanguage,
      answer_language: deckParams.answerLanguage,
      progress: { correct: 0, total: 0 },
      // created_at handled by DB
    }; 
    const mockTransformedCreatedDeck: Deck = { /* ... */ id: 'new-id' }; // Transformed data

    it('should insert a new deck and return the transformed deck', async () => {
      // Arrange: Mock insert -> select -> single -> returns
      mockReturns.mockResolvedValueOnce({ data: mockRawCreatedDeck, error: null });

      // Act
      const result = await createDeckService(mockSupabase, userId, deckParams);

      // Assert
      expect(mockFrom).toHaveBeenCalledWith('decks');
      expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({ user_id: userId })]); 
      expect(mockSelect).toHaveBeenCalled(); 
      expect(mockSingle).toHaveBeenCalledTimes(1);
      expect(mockReturns).toHaveBeenCalledTimes(1);
      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should return an error if Supabase insert fails', async () => {
      // Arrange: Mock insert failing
      const dbError = { message: 'Insert failed', details: '', hint: '', code: 'DB_ERROR' } as PostgrestError;
      mockReturns.mockResolvedValueOnce({ data: null, error: dbError });

      // Act
      const result = await createDeckService(mockSupabase, userId, deckParams);

      // Assert
      expect(mockReturns).toHaveBeenCalledTimes(1);
      expect(result.data).toBeNull();
      expect(result.error).toBe(dbError);
    });
  });

  // --- updateDeckService Tests ---
  describe('updateDeckService', () => {
    const deckId = 'deck1';
    const userId = 'user1';
    const baseDeck: Deck = {
      id: deckId,
      name: 'Original Name',
      language: 'en-US',
      isBilingual: false,
      questionLanguage: 'en-US',
      answerLanguage: 'nl-NL',
      cards: [
        { ...mockCard1 }, // Use copies of base mocks
        { ...mockCard2 },
      ],
      progress: { correct: 0, total: 0 }
    }; 

    it('should update deck metadata successfully', async () => {
      const updates: Deck = { ...baseDeck, name: 'Updated Name' };
      const expectedDbUpdate = { name: 'Updated Name' /* ... other snake_case fields ... */ };
      const mockExistingCardIds = [{ id: 'card1' }, { id: 'card2' }];
      
      // Arrange Mocks:
      // 1. Deck update succeeds (update -> eq -> eq)
      mockEq.mockResolvedValueOnce({ error: null }); // Second eq call resolves
      // 2. Fetch existing card IDs succeeds (select -> eq -> returns)
      mockReturns.mockResolvedValueOnce({ data: mockExistingCardIds, error: null }); 
      
      // Act
      const result = await updateDeckService(mockSupabase, userId, updates); // Add userId

      // Assert
      expect(mockFrom).toHaveBeenCalledWith('decks'); 
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: updates.name }));
      expect(mockEq).toHaveBeenCalledWith('id', deckId);
      expect(mockEq).toHaveBeenCalledWith('user_id', userId);
      expect(mockFrom).toHaveBeenCalledWith('cards'); 
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith('deck_id', deckId);
      expect(mockReturns).toHaveBeenCalledTimes(1); 
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
      expect(result.error).toBeNull();
    });

    it('should update deck and handle complex card changes successfully', async () => {
      const cardToUpdate: FlashCard = { ...mockCard1, question: 'Q1 Updated' };
      const cardToDeleteId = mockCard2.id;
      const cardToAdd: Omit<FlashCard, 'id'> = { question: 'Q3', answer: 'A3', correctCount: 0, incorrectCount: 0, lastStudied: null, attemptCount: 0, difficultyScore: 0 };
      
      const updates: Deck = {
        ...baseDeck,
        name: 'Updated Complex Name',
        cards: [
          cardToUpdate,
          cardToAdd as FlashCard, // Cast okay here for test setup
        ]
      };

      const expectedDeckDbUpdate = { name: updates.name };
      const expectedCardsToUpsert = [ /* ... snake_case card data ... */ ];
      const expectedCardIdsToDelete = [cardToDeleteId];
      const mockExistingCardIds = [{ id: mockCard1.id }, { id: mockCard2.id }];

      // Arrange Mocks:
      // 1. Deck update succeeds (update -> eq -> eq)
      mockEq.mockResolvedValueOnce({ error: null }); 
      // 2. Fetch existing card IDs succeeds (select -> eq -> returns)
      mockReturns.mockResolvedValueOnce({ data: mockExistingCardIds, error: null }); 
      // 3. Card upsert succeeds (upsert returns resolved promise directly, maybe check service code?)
      mockUpsert.mockResolvedValueOnce({ error: null }); // Assuming upsert resolves directly
      // 4. Card delete succeeds (delete -> eq -> in)
      mockEq.mockResolvedValueOnce({ error: null }); // For the .in().eq() part

      // Act
      const result = await updateDeckService(mockSupabase, userId, updates); // Add userId

      // Assert
      // Deck Update
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: updates.name }));
      expect(mockEq).toHaveBeenCalledWith('id', deckId);
      expect(mockEq).toHaveBeenCalledWith('user_id', userId);
      // Fetch Existing Cards
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith('deck_id', deckId);
      expect(mockReturns).toHaveBeenCalledTimes(1); 
      // Card Upsert
      expect(mockUpsert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: cardToUpdate.id })]), { onConflict: 'id' });
      // Card Delete
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockIn).toHaveBeenCalledWith('id', expectedCardIdsToDelete);
      expect(mockEq).toHaveBeenCalledWith('deck_id', deckId); // Check the eq after in
      // Final Result
      expect(result.error).toBeNull();
    });

    it('should return error if deck update fails', async () => {
        const updates: Deck = { ...baseDeck, name: 'Fail Update' };
        const dbError = { message: 'Deck update failed', details: '', hint: '', code: 'DB_ERROR' } as PostgrestError;
        // Mock the second .eq call to fail
        mockEq.mockImplementationOnce(() => ({ // First eq() returns object... 
            eq: jest.fn().mockResolvedValueOnce({ error: dbError }) // ...whose eq() call fails
        })); 

        const result = await updateDeckService(mockSupabase, userId, updates); // Add userId

        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockEq).toHaveBeenCalledWith('id', deckId); // First eq call
        expect(mockEq).toHaveBeenCalledWith('user_id', userId); // Second eq call
        expect(result.error).toBe(dbError);
        expect(mockSelect).not.toHaveBeenCalledWith('id'); 
        expect(mockUpsert).not.toHaveBeenCalled();
        expect(mockDelete).not.toHaveBeenCalled();
    });

    // Add more error tests for fetch, upsert, delete failures...

  });

  // --- deleteDeckService Tests ---
  describe('deleteDeckService', () => {
    const deckId = 'deck1';
    const userId = 'user1';

    it('should delete associated cards and then the deck successfully', async () => {
      // Arrange: Mock card delete success (delete -> eq)
      mockEq.mockResolvedValueOnce({ error: null }); 
      // Arrange: Mock deck delete success (delete -> eq -> eq)
      mockEq.mockResolvedValueOnce({ error: null }); 

      // Act
      const result = await deleteDeckService(mockSupabase, userId, deckId); // Add userId

      // Assert
      // Card delete checks
      expect(mockFrom).toHaveBeenCalledWith('cards');
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockEq).toHaveBeenCalledWith('deck_id', deckId);
      // Deck delete checks
      expect(mockFrom).toHaveBeenCalledWith('decks');
      expect(mockDelete).toHaveBeenCalledTimes(2); 
      expect(mockEq).toHaveBeenCalledWith('id', deckId);
      expect(mockEq).toHaveBeenCalledWith('user_id', userId);
      expect(result.error).toBeNull();
    });

    it('should return an error if deleting associated cards fails', async () => {
      // Arrange: Mock card delete failure (delete -> eq)
      const dbError = { message: 'Card delete failed', details: '', hint: '', code: 'DB_ERROR' } as PostgrestError;
      mockEq.mockResolvedValueOnce({ error: dbError }); 

      // Act
      const result = await deleteDeckService(mockSupabase, userId, deckId); // Add userId

      // Assert
      expect(mockFrom).toHaveBeenCalledWith('cards');
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockEq).toHaveBeenCalledWith('deck_id', deckId);
      expect(mockFrom).not.toHaveBeenCalledWith('decks');
      expect(result.error).toBe(dbError);
    });

    it('should return an error if deleting the deck fails (after card delete succeeds)', async () => {
      // Arrange: Mock card delete success (delete -> eq)
      mockEq.mockResolvedValueOnce({ error: null }); 
      // Arrange: Mock deck delete failure (delete -> eq -> eq)
      const dbError = { message: 'Deck delete failed', details: '', hint: '', code: 'DB_ERROR' } as PostgrestError;
      // Mock the eq chain for deck deletion to fail on the second eq
      mockEq.mockImplementationOnce(() => ({ // First eq() returns object... 
          eq: jest.fn().mockResolvedValueOnce({ error: dbError }) // ...whose eq() call fails
      })); 

      // Act
      const result = await deleteDeckService(mockSupabase, userId, deckId); // Add userId

      // Assert
      // Card delete checks
      expect(mockFrom).toHaveBeenCalledWith('cards');
      expect(mockDelete).toHaveBeenCalledTimes(1); 
      expect(mockEq).toHaveBeenCalledWith('deck_id', deckId); // From card delete
      // Deck delete checks
      expect(mockFrom).toHaveBeenCalledWith('decks');
      expect(mockDelete).toHaveBeenCalledTimes(2); 
      expect(mockEq).toHaveBeenCalledWith('id', deckId); // First eq for deck delete
      expect(mockEq).toHaveBeenCalledWith('user_id', userId); // Second eq for deck delete
      expect(result.error).toBe(dbError);
    });
  });

});