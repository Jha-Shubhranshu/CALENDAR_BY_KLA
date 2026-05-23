import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MoreVertical, FolderPlus, FolderMinus, Trash2, Copy, Bot, Sparkles } from 'lucide-react';
import type { MessageDisplay, NotebookSource } from '../typesOG/conversation.types';
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';

interface MessageProps {
  message: MessageDisplay;
  source: NotebookSource;
  onAddToProject?: (messageId: string) => void;
  onRemoveFromProject?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onNavigateToOriginal?: (conversationId: string, messageId: string) => void;
  showActions?: boolean;
}

export function Message({ 
  message, 
  source, 
  onAddToProject, 
  onRemoveFromProject,
  onDelete,
  onNavigateToOriginal,
  showActions = true 
}: MessageProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuTop, setMenuTop] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastRightClickTime = useRef<number>(0);

  useClickOutside(menuRef, () => setShowMenu(false));

  const handleCopyContent = () => {
    navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  };

  const isUser = message.role === 'user';

  // Format content to include title if present (for Notes added as messages)
  const displayContent = message.title 
    ? `**${message.title}**\n${message.content}`
    : message.content;

  // --- Interaction Handlers ---
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showActions) {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuTop(e.clientY - rect.top);
      setShowMenu(true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Always prevent default browser context menu on messages
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    // Detect double right click (within 300ms)
    if (now - lastRightClickTime.current < 300) {
      if (showActions) {
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuTop(e.clientY - rect.top);
        setShowMenu(true);
      }
    }
    lastRightClickTime.current = now;
  };

  // --- Render Action Menu ---
  const renderActionMenu = () => (
    <div
      ref={menuRef}
      className="w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
      onClick={(e) => e.stopPropagation()}
    >
      {onAddToProject && (
        <button
          onClick={() => {
            onAddToProject(message.id);
            setShowMenu(false);
          }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
        >
          <FolderPlus size={16} />
          <span>Add to Project</span>
        </button>
      )}

      {onRemoveFromProject && (
        <button
          onClick={() => {
            onRemoveFromProject(message.id);
            setShowMenu(false);
          }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-sm text-red-600"
        >
          <FolderMinus size={16} />
          <span>Remove from Project</span>
        </button>
      )}

      <button
        onClick={handleCopyContent}
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-sm text-gray-700"
      >
        <Copy size={16} />
        <span>Copy Content</span>
      </button>

      {onDelete && (
        <>
          <div className="border-t border-gray-200 my-1" />
          <button
            onClick={() => {
              onDelete(message.id);
              setShowMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-red-600 text-sm"
          >
            <Trash2 size={16} />
            <span>Delete Message</span>
          </button>
        </>
      )}
    </div>
  );

  // --- ChatGPT Style ---
  if (source === 'chatgpt') {
    return (
      <div className={`group relative flex w-full ${isUser ? 'justify-end' : 'justify-start gap-4'} mb-6`}>
        {/* Avatar for Assistant */}
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#10a37f] flex items-center justify-center text-white mt-1">
            <Sparkles size={16} />
          </div>
        )}

        {/* Message Bubble/Content */}
        <div 
          className={`relative max-w-[85%] ${
            isUser 
              ? 'bg-[#f4f4f4] text-gray-900 rounded-3xl px-5 py-3' 
              : 'text-gray-900 pt-1'
          }`}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        >
          <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-white prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none [&>ul]:list-disc [&>ol]:list-decimal">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>

          {/* Timestamp */}
          <div className={`mt-1 text-[10px] text-gray-400 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* Action Trigger */}
          {showActions && (
            <button
              className="absolute -right-8 top-0 p-1 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400"
              onClick={(e) => {
                e.stopPropagation();
                setMenuTop(24);
                setShowMenu(!showMenu);
              }}
            >
              <MoreVertical size={16} />
            </button>
          )}

          {/* Menu */}
          {showMenu && showActions && (
            <div 
              className="absolute right-0 z-50"
              style={{ top: menuTop }}
            >
               {renderActionMenu()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Claude Style ---
  if (source === 'claude') {
    return (
      <div className={`group relative flex w-full ${isUser ? 'justify-end' : 'justify-start gap-4'} mb-8`}>
        {/* Avatar for Assistant */}
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded bg-[#D97757] flex items-center justify-center text-white mt-1">
            <Bot size={18} />
          </div>
        )}

        {/* Message Bubble/Content */}
        <div 
          className={`relative max-w-[85%] ${
            isUser 
              ? 'bg-[#E6E4DD] text-gray-900 rounded-2xl px-5 py-3 font-sans' 
              : 'text-gray-900 pt-1 font-serif text-[15px] leading-relaxed'
          }`}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        >
          <div className="prose prose-sm max-w-none prose-p:leading-relaxed font-serif prose-headings:font-serif prose-code:font-mono prose-pre:bg-[#f4f4f3] prose-pre:text-gray-900 prose-code:text-[#c45533] prose-code:bg-[#f0eee6] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none [&>ul]:list-disc [&>ol]:list-decimal">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>

          {/* Timestamp */}
          <div className={`mt-1 text-[10px] text-gray-500 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>

          {/* Action Trigger */}
          {showActions && (
            <button
              className="absolute -right-8 top-0 p-1 rounded-full hover:bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500"
              onClick={(e) => {
                e.stopPropagation();
                setMenuTop(24);
                setShowMenu(!showMenu);
              }}
            >
              <MoreVertical size={16} />
            </button>
          )}

          {/* Menu */}
          {showMenu && showActions && (
            <div 
              className="absolute right-0 z-50"
              style={{ top: menuTop }}
            >
               {renderActionMenu()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Default / Manual Style (Card based) ---
  const getRoleLabel = (): string => {
    switch (message.role) {
      case 'user': return 'You';
      case 'assistant': return 'Assistant';
      case 'note': return 'Note';
      default: return '';
    }
  };

  const renderSourceInfo = () => {
    if (message.role === 'note' || !message.original_source) return null;
    
    const sourceLabel = String(message.original_source).toUpperCase();
    const title = message.conversation_title 
      ? (message.conversation_title.length > 20 ? message.conversation_title.substring(0, 20) + '...' : message.conversation_title)
      : 'Conversation';

    return (
      <>
        <span className="text-gray-400 mx-1">•</span>
        <span className="text-blue-600">{sourceLabel}</span>
        {message.conversation_id && (
          <>
             <span className="text-gray-400 mx-1">•</span>
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 if (onNavigateToOriginal && message.conversation_id) {
                   onNavigateToOriginal(message.conversation_id, message.id);
                 }
               }}
               className="hover:underline cursor-pointer text-gray-500 hover:text-blue-600 truncate max-w-[150px]"
               title={message.conversation_title}
             >
               {title}
             </button>
          </>
        )}
      </>
    );
  };

  return (
    <div className="group relative">
      <div
        className={`
          bg-white border border-gray-200
          rounded-lg p-4 
          hover:shadow-md transition-shadow
          cursor-pointer
          relative
          ${message.background_color ? '' : 'bg-white'}
        `}
        style={{ backgroundColor: message.background_color }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600 uppercase flex items-center">
            {getRoleLabel()}
            {renderSourceInfo()}
          </span>
        </div>

        <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-code:text-blue-600 prose-code:before:content-none prose-code:after:content-none [&>ul]:list-disc [&>ol]:list-decimal break-words prose-pre:whitespace-pre-wrap overflow-x-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
        </div>

        {/* Timestamp at bottom */}
        <div className="mt-2 text-[10px] text-gray-400">
          {new Date(message.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>

        {showActions && (
          <button
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setMenuTop(40);
              setShowMenu(!showMenu);
            }}
          >
            <MoreVertical size={16} className="text-gray-600" />
          </button>
        )}

        {showMenu && showActions && (
          <div 
            className="absolute right-0 z-50"
            style={{ top: menuTop }}
          >
             {renderActionMenu()}
          </div>
        )}
      </div>
    </div>
  );
}