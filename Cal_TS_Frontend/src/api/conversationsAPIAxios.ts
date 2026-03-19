import axios from 'axios';
import type { ConversationDisplay, ConversationWithMessages, NotebookSource } from '../typesOG/conversation.types';

const BASE_URL = 'http://localhost:8004/api/v1/conversations';

export async function getAllConversations(
  source?: NotebookSource,
  limit: number = 50,
  offset: number = 0
): Promise<{ conversations: ConversationDisplay[], total: number }> {
  try {
    const params: any = { skip: offset, limit };
    if (source) params.source = source;
    
    const res = await axios.get(`${BASE_URL}`, {
      params,
      withCredentials: true,
    });
    
    return {
      conversations: res.data.conversations || [],
      total: res.data.total || 0
    };
  } catch (error) {
    console.error('❌ Failed to fetch conversations:', error);
    throw error;
  }
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  try {
    const res = await axios.get(`${BASE_URL}/${id}`, {
      withCredentials: true,
    });
    
    return res.data;
  } catch (error) {
    console.error('❌ Failed to fetch conversation:', error);
    throw error;
  }
}

export async function createConversation(data: {
  title: string;
  source: NotebookSource;
  original_conversation_id?: string;
  original_filename?: string;
  metadata?: Record<string, any>;
}): Promise<ConversationWithMessages> {
  try {
    const res = await axios.post(`${BASE_URL}`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
    });
    
    console.log("✅ Conversation created:", res.data);
    return res.data;
  } catch (error) {
    console.error("❌ Conversation creation failed:", error);
    throw error;
  }
}