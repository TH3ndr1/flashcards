// hooks/useDecksRealtime.ts
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSupabase } from '@/hooks/use-supabase';
import { useAuth } from '@/hooks/use-auth';
import { getDecks, type DeckListItemWithCounts } from '@/lib/actions/deckActions';
import { appLogger } from '@/lib/logger';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Connection states for better UX
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseDecksRealtimeReturn {
  decks: DeckListItemWithCounts[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const logDecks = (...args: unknown[]) => {
  appLogger.info('[Decks Realtime Hook]:', ...args);
};

const logDecksError = (...args: unknown[]) => {
  appLogger.error('[Decks Realtime Hook Error]:', ...args);
};

export function useDecksRealtime(): UseDecksRealtimeReturn {
  const [decks, setDecks] = useState<DeckListItemWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const isFetchingList = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { supabase } = useSupabase();
  
  // Connection state management
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const lastErrorToastRef = useRef<number>(0);
  const isPageVisibleRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced error toast to prevent spam on mobile
  const showErrorToast = useCallback((message: string, description?: string) => {
    const now = Date.now();
    // Only show error toast if page is visible and it's been more than 10 seconds since last error
    if (isPageVisibleRef.current && now - lastErrorToastRef.current > 10000) {
      lastErrorToastRef.current = now;
      toast.error(message, { description });
    } else {
      // Just log the error without showing toast
      logDecksError('Suppressed error toast:', message, description);
    }
  }, []);

  // Handle page visibility changes (mobile background/foreground)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      isPageVisibleRef.current = isVisible;
      
      if (isVisible) {
        logDecks('Page became visible, connection state:', connectionState);
        // Reset error toast timer when page becomes visible
        lastErrorToastRef.current = 0;
        
        // If we were disconnected, try to reconnect after a short delay
        if (connectionState === 'disconnected' || connectionState === 'error') {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            if (user && supabase) {
              logDecks('Attempting to reconnect after page visibility change');
              // The useEffect will handle reconnection
            }
          }, 1000);
        }
      } else {
        logDecks('Page became hidden');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectionState, user, supabase]);

  const fetchDeckList = useCallback(async () => {
    if (authLoading || !user) {
      setDecks([]);
      setLoading(false);
      setError(null);
      if (!authLoading) logDecks("No user, clearing deck list.");
      return;
    }

    if (isFetchingList.current) {
      logDecks("Fetch already in progress, skipping.");
      return;
    }

    logDecks("Fetching deck list via getDecks action...");
    setLoading(true);
    setError(null);
    isFetchingList.current = true;

    try {
      const result = await getDecks();
      if (result.error) {
        logDecksError("Error fetching deck list:", result.error);
        showErrorToast("Failed to load decks", result.error);
        setDecks([]);
        setError(result.error);
      } else {
        logDecks(`Fetched ${result.data?.length ?? 0} decks.`);
        setDecks(result.data || []);
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      logDecksError("Unexpected error fetching deck list:", errorMessage);
      showErrorToast("Failed to load decks", errorMessage);
      setDecks([]);
      setError(errorMessage);
    } finally {
      setLoading(false);
      isFetchingList.current = false;
    }
  }, [user, authLoading, showErrorToast]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !supabase) {
      // Clean up existing channel if user logs out or supabase not ready
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      return;
    }

    logDecks(`Setting up real-time subscription for user: ${user.id}`);

    // Create a channel for deck changes
    const channel = supabase
      .channel(`deck-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'decks',
          filter: `user_id=eq.${user.id}` // Only listen to current user's decks
        },
        (payload: { eventType: string; table: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          logDecks('Received real-time deck change:', {
            eventType: payload.eventType,
            table: payload.table,
            new: payload.new,
            old: payload.old
          });
          
          // Refetch deck list when any deck changes occur
          // This ensures we get the latest data with all computed fields (SRS counts, etc.)
          fetchDeckList();
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | string) => {
        logDecks('Real-time subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          logDecks('Successfully subscribed to deck changes');
          setConnectionState('connected');
        } else if (status === 'CHANNEL_ERROR') {
          logDecksError('Real-time subscription error');
          setConnectionState('error');
          // Only show error toast if page is visible and connection was previously working
          if (connectionState === 'connected') {
            showErrorToast('Real-time sync disconnected', 'Changes may not appear immediately');
          }
        } else if (status === 'TIMED_OUT') {
          logDecksError('Real-time subscription timed out');
          setConnectionState('error');
          // Don't show timeout errors as they're common on mobile
        } else if (status === 'CLOSED') {
          logDecks('Real-time subscription closed');
          setConnectionState('disconnected');
          // Don't show toast for normal disconnections (common on mobile)
        } else {
          logDecks('Real-time subscription status changed to:', status);
          setConnectionState('connecting');
        }
      });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (channelRef.current) {
        logDecks('Cleaning up real-time subscription');
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [user, fetchDeckList, supabase, connectionState, showErrorToast]);

  // Initial fetch on mount
  useEffect(() => {
    fetchDeckList();
  }, [fetchDeckList]);

  return { 
    decks, 
    loading, 
    error, 
    refetch: fetchDeckList 
  };
}
