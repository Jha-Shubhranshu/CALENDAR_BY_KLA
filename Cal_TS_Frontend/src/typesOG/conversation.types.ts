export type NotebookSource = 'claude' | 'chatgpt' | 'perplexity' | 'google_keep' | 'manual';
export type MessageRole = 'user' | 'assistant' | 'note';

export interface MessageDisplay {
  id: string;
  conversation_id?: string;
  project_id?: string;
  content: string;
  title?: string;
  role: MessageRole;
  timestamp: number;
  created_at: number;
  background_color?: string;
  metadata: Record<string, any>;
  conversation_title?: string;
  original_source?: NotebookSource | string;
}

export interface ConversationDisplay {
  id: string;
  user_id: string;
  title: string;
  source: NotebookSource;
  original_conversation_id?: string;
  import_date: number;
  original_filename?: string;
  metadata: Record<string, any>;
  created_at: number;
  updated_at: number;
  account?: string;
}

export interface ConversationWithMessages extends ConversationDisplay {
  messages: MessageDisplay[];
}