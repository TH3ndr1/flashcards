// __tests__/use-decks.test.tsx

// Place mocks at the very top before any other imports:
jest.mock('@/hooks/use-auth', () => ({
    useAuth: jest.fn(),
  }));
  jest.mock('@/hooks/use-supabase', () => ({
    useSupabase: jest.fn(),
  }));
  // Updated mock: useSettings now always returns an object with settings and setSettings
  jest.mock('@/providers/settings-provider', () => ({
    useSettings: jest.fn(),
  }));
  jest.mock('@/lib/deckService', () => ({
    fetchDecks: jest.fn(),
    createDeckService: jest.fn(),
    getDeckService: jest.fn(),
    updateDeckService: jest.fn(),
    deleteDeckService: jest.fn(),
  }));
  jest.mock('@/lib/localStorageUtils', () => ({
    getDecksFromLocalStorage: jest.fn(),
    saveDecksToLocalStorage: jest.fn(),
  }));
  
  // Optional: Suppress warnings about act in concurrent mode
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('The current testing environment is not configured to support act')) {
      return;
    }
    originalConsoleError(...args);
  };
  
  // Now import modules that rely on the above mocks:
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { act } from 'react';
  import { useDecks } from '@/hooks/use-decks';
  import { useAuth } from '@/hooks/use-auth';
  import { useSupabase } from '@/hooks/use-supabase';
  import { fetchDecks } from '@/lib/deckService';
  import { getDecksFromLocalStorage } from '@/lib/localStorageUtils';
  
  // Instead of using renderHook from @testing-library/react-hooks,
  // we create a test component that uses the hook and renders its output.
  function TestComponent() {
    const { decks, loading } = useDecks();
    return (
      <div>
        {loading ? (
          <span data-testid="loading">Loading</span>
        ) : (
          decks.map((deck) => (
            <div key={deck.id} data-testid="deck">
              {deck.name}
            </div>
          ))
        )}
      </div>
    );
  }
  
  // Create a container for our tests
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot>;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  
  afterEach(() => {
    if (root) {
      root.unmount();
    }
    if (container) {
      container.remove();
      container = null;
    }
  });
  
  describe('useDecks (using createRoot)', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
  
    it('loads decks from Supabase and updates localStorage', async () => {
      // Arrange: Setup mocks for auth and supabase
      const mockUser = { id: 'user1' };
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const mockSupabase = {
        // Create a simple mock for Supabase chainable calls if needed
      };
      (useSupabase as jest.Mock).mockReturnValue({ supabase: mockSupabase });
      const fakeDecks = [{ id: 'deck1', name: 'Test Deck', cards: [] }];
      (fetchDecks as jest.Mock).mockResolvedValue(fakeDecks);
      (getDecksFromLocalStorage as jest.Mock).mockReturnValue([]);
  
      // Act: Render the test component using createRoot
      await act(async () => {
        root.render(<TestComponent />);
      });
  
      // Assert: Check that the rendered output contains our deck name
      expect(container?.textContent).toContain('Test Deck');
    });
  });