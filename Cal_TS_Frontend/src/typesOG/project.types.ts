import type { MessageDisplay } from './conversation.types';

export interface ProjectDisplay {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  color: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

export interface ProjectWithMessages extends Omit<ProjectDisplay, 'message_count'> {
  messages: MessageDisplay[];
}