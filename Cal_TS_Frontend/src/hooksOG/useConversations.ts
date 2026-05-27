import { useState, useCallback, useEffect, useRef } from 'react';
import type { ConversationDisplay, NotebookSource } from '../typesOG/conversation.types';
import { getAllConversations, deleteConversation as deleteConvoApi } from '../api/conversationsAPIAxios';

export function useConversations(source?: NotebookSource, onDelete?: () => void) {
  const [conversations, setConversations] = useState<ConversationDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  const loadConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { conversations: fetchedConvos } = await getAllConversations(source, 2000);
      setConversations(fetchedConvos);
      lastUpdateRef.current = Date.now();
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [source]);

  // Set up polling to check for new conversations automatically
  useEffect(() => {
    // Initial load
    loadConversations();

    // Poll every 10 seconds to catch background extension ingestions
    const interval = setInterval(() => {
      loadConversations(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [loadConversations]);

  const removeConversation = async (id: string) => {
    try {
      setDeletingId(id);
      await deleteConvoApi(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (onDelete) onDelete();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    } finally {
      setDeletingId(null);
    }
  };

  return {
    conversations,
    loading,
    deletingId,
    loadConversations,
    removeConversation,
  };
}