import { useEffect, useState, useMemo, useRef } from 'react';
import { X, MessageSquare, ChevronDown, Check, Trash2, Loader2, Plus } from 'lucide-react';
import type { NotebookSource } from '../typesOG/conversation.types';
import { useConversations } from '../hooksOG/useConversations';
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';
import { useAccounts } from '../hooksOG/useAccounts';

interface ConversationsSidebarProps {
  source: NotebookSource;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation?: () => void;
}

export function ConversationsSidebar({ 
  source, 
  onClose, 
  onSelectConversation,
  onDeleteConversation
}: ConversationsSidebarProps) {
  const { conversations, loading, deletingId, removeConversation } = useConversations(source, onDeleteConversation);
  const { accounts, addAccount } = useAccounts();
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useClickOutside(dropdownRef, () => {
    setIsAccountDropdownOpen(false);
    setIsAddingAccount(false);
    setAddError(null);
  });

  // Extract unique accounts from conversations + saved accounts
  const availableAccounts = useMemo(() => {
    const accountSet = new Set<string>();
    conversations.forEach(c => {
      if (c.account) accountSet.add(c.account);
    });
    // Also include saved accounts that might not have conversations yet
    accounts.forEach(a => accountSet.add(a.email_address));
    return Array.from(accountSet).sort();
  }, [conversations, accounts]);

  // Initialize selected accounts
  useEffect(() => {
    if (availableAccounts.length > 0) {
      setSelectedAccounts(prev => prev.length === 0 ? availableAccounts : prev);
    }
  }, [availableAccounts]);

  // Focus input when add mode activates
  useEffect(() => {
    if (isAddingAccount) addInputRef.current?.focus();
  }, [isAddingAccount]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (availableAccounts.length === 0) return conversations;
    return conversations.filter(c => {
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

  const handleAddAccount = async () => {
    const email = newEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError('Enter a valid email');
      return;
    }
    setAddSaving(true);
    setAddError(null);
    const result = await addAccount(email);
    setAddSaving(false);
    if (result) {
      setNewEmail('');
      setIsAddingAccount(false);
      // Auto-select the new account in the filter
      setSelectedAccounts(prev => [...prev, result.email_address]);
    } else {
      setAddError('Already exists');
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
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col animate-slide-in-left shadow-lg">
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
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg py-1 border border-gray-100 max-h-72 overflow-y-auto text-gray-800 z-50">
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

                {/* Divider + Add new account */}
                <div className="border-t border-gray-100 mt-1" />
                {isAddingAccount ? (
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={addInputRef}
                        type="email"
                        value={newEmail}
                        onChange={(e) => { setNewEmail(e.target.value); setAddError(null); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddAccount();
                          if (e.key === 'Escape') { setIsAddingAccount(false); setAddError(null); }
                        }}
                        placeholder="email@example.com"
                        className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400"
                      />
                      <button
                        onClick={handleAddAccount}
                        disabled={addSaving || !newEmail.trim()}
                        className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        {addSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </button>
                      <button
                        onClick={() => { setIsAddingAccount(false); setNewEmail(''); setAddError(null); }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {addError && <p className="text-[10px] text-red-500 mt-1 px-0.5">{addError}</p>}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingAccount(true)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 text-blue-600 font-medium"
                  >
                    <Plus size={14} />
                    Add new account
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : filteredConversations.length > 0 ? (
          <div className="space-y-1">
            {filteredConversations.map((convo) => (
              <div
                key={convo.id}
                className="w-full flex items-start gap-2 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition group relative"
              >
                <button
                  onClick={() => onSelectConversation(convo.id)}
                  className="flex-1 text-left"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-1">
                      {convo.title}
                    </h3>
                    {convo.account && (
                      <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded ml-2 shrink-0">
                        {convo.account}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(convo.created_at).toLocaleDateString()}
                  </p>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Are you sure you want to delete this conversation?')) {
                      removeConversation(convo.id);
                    }
                  }}
                  disabled={deletingId === convo.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition disabled:opacity-50"
                  title="Delete conversation"
                >
                  {deletingId === convo.id
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Trash2 size={15} />
                  }
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <MessageSquare size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No conversations found</p>
            {conversations.length > 0 && <p className="text-xs mt-1">Try adjusting your filters</p>}
          </div>
        )}
      </div>
    </div>
  );
}