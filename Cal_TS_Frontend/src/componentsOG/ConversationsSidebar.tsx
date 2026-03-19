import React, { useEffect, useState, useMemo, useRef } from 'react';
import { X, MessageSquare, ChevronDown, Check } from 'lucide-react';
import type { ConversationDisplay, NotebookSource } from '../typesOG/conversation.types';
import { useConversations } from '../hooksOG/useConversations';
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';

interface ConversationsSidebarProps {
  source: NotebookSource;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationsSidebar({ 
  source, 
  onClose, 
  onSelectConversation 
}: ConversationsSidebarProps) {
  const { conversations, loading, loadConversations } = useConversations(source);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsAccountDropdownOpen(false));

  useEffect(() => {
    loadConversations();
  }, [loadConversations, source]);

  // Extract unique accounts
  const availableAccounts = useMemo(() => {
    const accounts = new Set<string>();
    conversations.forEach(c => {
      if (c.account) accounts.add(c.account);
    });
    return Array.from(accounts).sort();
  }, [conversations]);

  // Initialize selected accounts
  useEffect(() => {
    if (availableAccounts.length > 0) {
      // If no accounts selected (initial load), select all
      setSelectedAccounts(prev => prev.length === 0 ? availableAccounts : prev);
    }
  }, [availableAccounts]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (availableAccounts.length === 0) return conversations;
    
    return conversations.filter(c => {
      // If conversation has no account, show it only if all accounts are selected (default behavior)
      // or maybe always show it? Let's assume we filter strictly by what's selected if it has an account.
      // If it has NO account, we'll display it always for now to avoid hiding data, 
      // unless we want a "No Account" filter.
      if (!c.account) return true;
      return selectedAccounts.includes(c.account);
    });
  }, [conversations, selectedAccounts, availableAccounts]);

  const toggleAccount = (account: string) => {
    setSelectedAccounts(prev => 
      prev.includes(account) 
        ? prev.filter(a => a !== account)
        : [...prev, account]
    );
  };

  const toggleAll = () => {
    if (selectedAccounts.length === availableAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(availableAccounts);
    }
  };

  const getSourceLabel = () => {
    switch (source) {
      case 'claude': return 'Claude Conversations';
      case 'chatgpt': return 'ChatGPT Conversations';
      case 'perplexity': return 'Perplexity Conversations';
      default: return 'Conversations';
    }
  };

  const getSourceColor = () => {
    switch (source) {
      case 'claude': return 'bg-orange-500';
      case 'chatgpt': return 'bg-gray-700';
      case 'perplexity': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="w-80 h-full bg-white border-r border-gray-200 flex flex-col animate-slide-in-left shadow-lg">
      {/* Header */}
      <div className={`p-4 ${getSourceColor()} text-white flex flex-col shadow-md z-10 relative shrink-0`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <MessageSquare size={24} />
            <h2 className="text-lg font-medium">{getSourceLabel()}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Account Selector */}
        {availableAccounts.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
              className="flex items-center gap-2 text-sm bg-black/10 hover:bg-black/20 px-3 py-1.5 rounded-md transition w-full justify-between border border-white/10"
            >
              <span className="truncate">
                {selectedAccounts.length === availableAccounts.length 
                  ? 'All Accounts' 
                  : selectedAccounts.length === 0 
                    ? 'Select Accounts'
                    : `${selectedAccounts.length} Account${selectedAccounts.length > 1 ? 's' : ''}`
                }
              </span>
              <ChevronDown size={14} className={`transition-transform ${isAccountDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isAccountDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg py-1 border border-gray-100 max-h-64 overflow-y-auto text-gray-800 z-50">
                <button
                  onClick={toggleAll}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 font-medium border-b border-gray-100"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedAccounts.length === availableAccounts.length ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                    {selectedAccounts.length === availableAccounts.length && <Check size={10} className="text-white" />}
                  </div>
                  Select All
                </button>
                
                {availableAccounts.map(account => (
                  <button
                    key={account}
                    onClick={() => toggleAccount(account)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedAccounts.includes(account) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                      {selectedAccounts.includes(account) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="truncate">{account}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : filteredConversations.length > 0 ? (
          <div className="space-y-2">
            {filteredConversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => onSelectConversation(convo.id)}
                className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition group"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-gray-800 truncate group-hover:text-blue-600 flex-1">
                    {convo.title}
                  </h3>
                  {convo.account && (
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded ml-2 shrink-0">
                      {convo.account}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(convo.updated_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare size={48} className="mx-auto mb-2 opacity-50" />
            <p>No conversations found</p>
            {conversations.length > 0 && <p className="text-xs mt-1">Try adjusting your filters</p>}
          </div>
        )}
      </div>
    </div>
  );
}