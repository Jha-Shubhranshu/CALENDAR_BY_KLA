import { useState, useCallback } from 'react';
import type { ConversationDisplay, NotebookSource } from '../typesOG/conversation.types';
import { getAllConversations } from '../api/conversationsAPIAxios';

export function useConversations(source?: NotebookSource) {
  const [conversations, setConversations] = useState<ConversationDisplay[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const { conversations: fetchedConvos } = await getAllConversations(source, 2000);
      setConversations(fetchedConvos);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [source]);

  return {
    conversations,
    loading,
    loadConversations,
  };
}