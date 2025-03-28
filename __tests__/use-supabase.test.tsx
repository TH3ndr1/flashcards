// __tests__/use-supabase.test.tsx

// Set environment variables required by useSupabase before any imports occur
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy-key";

// Place mocks at the very top before any other imports:
jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/hooks/use-settings', () => ({
  __esModule: true,
  useSettings: () => ({
    settings: {},
    setSettings: () => {},
  }),
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

// IMPORTANT: Do NOT mock use-supabase so that we test the real hook
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useSupabase } from '@/hooks/use-supabase';

// A test component that uses useSupabase and calls onUpdate when values change
function TestSupabaseComponent({ onUpdate }: { onUpdate: (initialized: boolean, client: any) => void }) {
  const { supabase, initialized } = useSupabase();

  useEffect(() => {
    onUpdate(initialized, supabase);
  }, [initialized, supabase, onUpdate]);

  return <div data-testid="initialized">{initialized ? 'true' : 'false'}</div>;
}

describe('useSupabase hook', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let hookState: { initialized: boolean; client: any } | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    hookState = null;
  });

  afterEach(() => {
    // Wrap unmount in act to flush updates
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should return a supabase client and eventually set initialized to true', async () => {
    // Arrange: Setup the useAuth mock so that useSupabase gets a user
    const { useAuth } = require('@/hooks/use-auth');
    useAuth.mockReturnValue({ user: { id: 'user1' } });

    // Act: Render our test component using createRoot
    await act(async () => {
      root.render(
        <TestSupabaseComponent
          onUpdate={(initialized, client) => {
            hookState = { initialized, client };
          }}
        />
      );
    });

    // Wait a bit for the hook's useEffect to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    // Assert: Verify that the hookState has been set, a supabase client is defined, and initialized is true.
    expect(hookState).not.toBeNull();
    expect(hookState?.client).toBeDefined();
    expect(hookState?.initialized).toBe(true);
  });
});