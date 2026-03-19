import React, { useRef, useEffect, useState } from 'react';
import { X, Send, ArrowLeft, Trash2 } from 'lucide-react';
import type { MessageDisplay, NotebookSource } from '../typesOG/conversation.types';
import { Message } from './Message';

interface ChatWindowProps {
  title: string;
  source: NotebookSource;
  messages: MessageDisplay[];
  onClose: () => void;
  onAddToProject?: (messageId: string) => void;
  onRemoveFromProject?: (messageId: string) => void;
  onNavigateToOriginal?: (conversationId: string, messageId: string) => void;
  onSendMessage?: (content: string) => void;
  onDeleteProject?: () => void;
  loading?: boolean;
  isProject?: boolean;
  scrollToMessageId?: string;
}

export function ChatWindow({
  title,
  source,
  messages,
  onClose,
  onAddToProject,
  onRemoveFromProject,
  onNavigateToOriginal,
  onSendMessage,
  onDeleteProject,
  loading = false,
  isProject = false,
  scrollToMessageId

}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [newMessage, setNewMessage] = useState('');

  // ✅ Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

    // ✅ Auto-scroll to bottom when new messages arrive (unless scrollToMessageId specified)
  useEffect(() => {
    if (!scrollToMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, scrollToMessageId]);

  // ✅ Scroll to specific message when specified
  useEffect(() => {
    if (scrollToMessageId && messageRefs.current[scrollToMessageId]) {
      messageRefs.current[scrollToMessageId]?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center' 
      });
      
      // Highlight the message briefly
      const element = messageRefs.current[scrollToMessageId];
      if (element) {
        element.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50');
        }, 2000);
      }
    }
  }, [scrollToMessageId]);


  const handleSend = () => {
    if (newMessage.trim() && onSendMessage) {
      onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = () => {
    if (onDeleteProject && window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      onDeleteProject();
    }
  };

  // ✅ Header style based on source
  const getHeaderStyle = (): string => {
    switch (source) {
      case 'claude': return 'bg-[#F0EEE6] text-gray-800 border-b border-[#E6E4DD]';
      case 'chatgpt': return 'bg-white text-gray-800 border-b border-gray-100';
      case 'manual':
      case 'google_keep': return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  // ✅ Main background based on source
  const getMainBackground = (): string => {
    switch (source) {
      case 'claude': return 'bg-[#F5F4F1]';
      case 'chatgpt': return 'bg-white';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className={`flex flex-col h-full ${getMainBackground()}`}>
      {/* Header */}
      <div className={`${getHeaderStyle()} p-4 flex items-center justify-between shadow-sm z-10 shrink-0`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-black hover:bg-opacity-5 rounded-full transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className={`text-lg font-semibold truncate max-w-md ${source === 'claude' ? 'font-serif' : ''}`} title={title}>
              {title || 'Untitled Conversation'}
            </h2>
            <p className="text-xs opacity-70">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
              {isProject && ' • Project Timeline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isProject && onDeleteProject && (
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-500 hover:text-white hover:bg-opacity-80 rounded-full transition text-red-500"
              title="Delete Project"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-black hover:bg-opacity-5 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="min-h-full p-4 space-y-6 max-w-5xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
          </div>
        ) : messages.length > 0 ? (
          <>
            {messages.map((message) => (
              <div 
                key={message.id}
                ref={(el) => { messageRefs.current[message.id] = el; }}
                className="transition-all duration-300"
              >
                <Message
                  message={message}
                  source={source}
                  onAddToProject={onAddToProject}
                  onRemoveFromProject={onRemoveFromProject}
                  onNavigateToOriginal={onNavigateToOriginal}
                  showActions={!isProject || !!onRemoveFromProject}
                />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">
                {isProject 
                  ? 'Add messages from conversations or notes'
                  : 'Start a conversation or import one'}
              </p>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Input Area (only for projects or manual conversations) */}
      {(isProject || source === 'manual') && onSendMessage && (
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className={`p-3 rounded-lg transition ${
                newMessage.trim()
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      )}
    </div>
  );
}