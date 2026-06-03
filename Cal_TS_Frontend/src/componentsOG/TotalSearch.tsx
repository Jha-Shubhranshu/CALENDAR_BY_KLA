import { useState, useEffect, useCallback } from 'react';
import { 
  Search as SearchIcon, 
  X, 
  ChevronDown, 
  ChevronRight, 
  CaseSensitive, 
  WholeWord, 
  Regex,
  MessageSquare,
  FileText,
  Loader2
} from 'lucide-react';
import { totalSearch } from '../api/searchAPIAxios';
import type { SearchResponse } from '../api/searchAPIAxios';

interface TotalSearchProps {
  onClose: () => void;
  onNavigateToMessage: (conversationId: string, messageId: string) => void;
  onNavigateToNote: (noteId: string) => void;
}

export function TotalSearch({ onClose, onNavigateToMessage, onNavigateToNote }: TotalSearchProps) {
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedConversations, setExpandedConversations] = useState<Record<string, boolean>>({});

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const data = await totalSearch({
        query,
        match_case: matchCase,
        match_whole_word: wholeWord,
        use_regexp: useRegex
      });
      setResults(data);
      
      // Auto-expand all conversations with results
      const initialExpanded: Record<string, boolean> = {};
      data.conversations.forEach(c => {
        initialExpanded[c.id] = true;
      });
      setExpandedConversations(initialExpanded);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [query, matchCase, wholeWord, useRegex]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        handleSearch();
      } else {
        setResults(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, matchCase, wholeWord, useRegex, handleSearch]);

  const toggleConversation = (id: string) => {
    setExpandedConversations(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const highlightMatch = (text: string) => {
    if (!query.trim() || useRegex) return text;
    
    const flags = matchCase ? 'g' : 'gi';
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
    
    try {
      const regex = new RegExp(`(${regexPattern})`, flags);
      const parts = text.split(regex);
      
      return parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/50 text-gray-900 dark:text-gray-100 rounded-sm px-0.5">
            {part}
          </mark>
        ) : part
      );
    } catch (e) {
      return text;
    }
  };

  return (
    <div className="w-80 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col animate-slide-in-left shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Search</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all conversations & notes..."
            className="w-full pl-9 pr-24 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all"
            autoFocus
          />
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              onClick={() => setMatchCase(!matchCase)}
              title="Match Case"
              className={`p-1 rounded transition ${matchCase ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <CaseSensitive size={16} />
            </button>
            <button
              onClick={() => setWholeWord(!wholeWord)}
              title="Match Whole Word"
              className={`p-1 rounded transition ${wholeWord ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <WholeWord size={16} />
            </button>
            <button
              onClick={() => setUseRegex(!useRegex)}
              title="Use Regular Expression"
              className={`p-1 rounded transition ${useRegex ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <Regex size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 size={24} className="animate-spin mb-2" />
            <p className="text-sm">Searching...</p>
          </div>
        ) : results ? (
          <div className="space-y-1">
            <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              {results.conversations.length + results.notes.length} results found
            </div>

            {/* Conversations */}
            {results.conversations.map(conv => (
              <div key={conv.id} className="mb-1">
                <button
                  onClick={() => toggleConversation(conv.id)}
                  className="w-full flex items-center gap-1 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition text-left group"
                >
                  {expandedConversations[conv.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <MessageSquare size={14} className="text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1">
                    {highlightMatch(conv.title)}
                  </span>
                  <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition">
                    {conv.messages.length}
                  </span>
                </button>

                {expandedConversations[conv.id] && (
                  <div className="ml-4 pl-2 border-l border-gray-100 dark:border-gray-800 space-y-0.5 mt-0.5">
                    {conv.messages.map(msg => (
                      <button
                        key={msg.id}
                        onClick={() => onNavigateToMessage(conv.id, msg.id)}
                        className="w-full text-left p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition group"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-tighter px-1 rounded ${
                            msg.role === 'user' 
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                              : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
                          }`}>
                            {msg.role}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {highlightMatch(msg.content)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Manual Notes */}
            {results.notes.length > 0 && (
              <div className="mt-4">
                <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-widest border-t border-gray-100 dark:border-gray-800 pt-3 mt-2">
                  Manual Notes
                </div>
                {results.notes.map(note => (
                  <button
                    key={note.id}
                    onClick={() => onNavigateToNote(note.id)}
                    className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={14} className="text-amber-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                        {note.title || 'Untitled Note'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {highlightMatch(note.content)}
                    </p>
                    <div className="mt-1 text-[9px] text-gray-400">
                      {new Date(note.timestamp).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!results.conversations.length && !results.notes.length && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center px-4">
                <SearchIcon size={32} className="mb-2 opacity-20" />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs mt-1">Try different keywords or check your search options</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center px-4">
            <SearchIcon size={32} className="mb-2 opacity-20" />
            <p className="text-sm">Type to search across everything</p>
            <p className="text-xs mt-1 italic">Use the options above for precise matching</p>
          </div>
        )}
      </div>
    </div>
  );
}
