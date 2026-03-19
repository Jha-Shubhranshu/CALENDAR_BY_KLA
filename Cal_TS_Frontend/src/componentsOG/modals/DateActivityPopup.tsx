import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { MessageSquare, FileText, FolderKanban, ChevronRight } from 'lucide-react';
import type { DateActivity } from '../../api/calendarAPIAxios';
import type { ProjectDisplay } from '../../typesOG/project.types';
import { useClickOutside } from '../../hooksOG/Intelligenceeffects/useClickOutside';

interface DateActivityPopupProps {
  date: Date;
  activity: DateActivity;
  anchorRef: React.RefObject<HTMLDivElement>;
  projects: ProjectDisplay[];
  onOpenConversation: (conversationId: string) => void;
  onOpenNote: (noteId: string) => void;
  onOpenProject: (projectId: string, messageId: string) => void;
  onClose: () => void;
}

export function DateActivityPopup({
  date,
  activity,
  anchorRef,
  projects,
  onOpenConversation,
  onOpenNote,
  onOpenProject,
  onClose,
}: DateActivityPopupProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useClickOutside(popupRef, onClose);

  // Calculate position relative to anchor
  const getPosition = (): React.CSSProperties => {
    if (!anchorRef.current) return {};

    const rect = anchorRef.current.getBoundingClientRect();
    const popupWidth = 280;
    const popupMaxHeight = 400;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Determine horizontal position based on screen side
    // If anchor is in left half of screen -> show on right
    // If anchor is in right half of screen -> show on left
    const isLeftHalf = rect.left + (rect.width / 2) < windowWidth / 2;

    let left: number;
    if (isLeftHalf) {
      // Try right
      left = rect.right + 8;
      // Fallback if overflows right
      if (left + popupWidth > windowWidth) {
        left = rect.left - popupWidth - 8;
      }
    } else {
      // Try left
      left = rect.left - popupWidth - 8;
      // Fallback if overflows left
      if (left < 0) {
        left = rect.right + 8;
      }
    }

    // Vertical positioning
    const isBottomHalf = rect.top > windowHeight / 2;
    let style: React.CSSProperties = {
      position: 'fixed',
      left: `${left}px`,
      zIndex: 1000,
    };

    if (isBottomHalf) {
      // Align bottom of popup with bottom of block
      let bottomDistance = windowHeight - rect.bottom;
      if (bottomDistance < 8) bottomDistance = 8;
      
      style.bottom = `${bottomDistance}px`;
      style.maxHeight = `${windowHeight - bottomDistance - 16}px`;
    } else {
      // Align top of popup with top of block
      let topPos = rect.top;
      if (topPos < 8) topPos = 8;
      
      style.top = `${topPos}px`;
      style.maxHeight = `${windowHeight - topPos - 16}px`;
    }

    return style;
  };

  const formatDate = date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    year: 'numeric' 
  });

  const truncate = (str: string, maxLen: number = 10) => {
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  };

  const handleNotebookClick = (type: 'claude' | 'chatgpt' | 'notes') => {
    const key = `notebook-${type}`;
    setExpandedSection(expandedSection === key ? null : key);
  };

  const handleProjectClick = (projectId: string) => {
    const key = `project-${projectId}`;
    setExpandedSection(expandedSection === key ? null : key);
  };

  const popup = (
    <div
      ref={popupRef}
      className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden w-[280px] flex flex-col"
      style={getPosition()}
    >
      {/* Header */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex-none">
        <p className="text-xs font-semibold text-gray-700">{formatDate}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Notebooks Section */}
        <div className="p-2">
          <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2 px-2">
            Notebooks
          </h3>

          {/* Claude */}
          {activity.notebooks.claude.count > 0 && (
            <div>
              <button
                onClick={() => handleNotebookClick('claude')}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-orange-50 rounded transition text-left"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-orange-500" />
                  <span className="text-xs text-gray-700">Claude</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-orange-600">
                    {activity.notebooks.claude.count}
                  </span>
                  <ChevronRight 
                    size={12} 
                    className={`text-gray-400 transition-transform ${
                      expandedSection === 'notebook-claude' ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Expanded List */}
              {expandedSection === 'notebook-claude' && (
                <div className="ml-6 mt-1 space-y-1">
                  {activity.notebooks.claude.conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        onOpenConversation(conv.id);
                        onClose();
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded truncate"
                    >
                      {conv.title || `Conversation ${conv.id.slice(0, 8)}...`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ChatGPT */}
          {activity.notebooks.chatgpt.count > 0 && (
            <div>
              <button
                onClick={() => handleNotebookClick('chatgpt')}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded transition text-left"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-gray-700" />
                  <span className="text-xs text-gray-700">ChatGPT</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-600">
                    {activity.notebooks.chatgpt.count}
                  </span>
                  <ChevronRight 
                    size={12} 
                    className={`text-gray-400 transition-transform ${
                      expandedSection === 'notebook-chatgpt' ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

              {expandedSection === 'notebook-chatgpt' && (
                <div className="ml-6 mt-1 space-y-1">
                  {activity.notebooks.chatgpt.conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        onOpenConversation(conv.id);
                        onClose();
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded truncate"
                    >
                      {conv.title || `Conversation ${conv.id.slice(0, 8)}...`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {activity.notebooks.notes.count > 0 && (
            <div>
              <button
                onClick={() => handleNotebookClick('notes')}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-yellow-50 rounded transition text-left"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-yellow-600" />
                  <span className="text-xs text-gray-700">Notes</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-yellow-600">
                    {activity.notebooks.notes.count}
                  </span>
                  <ChevronRight 
                    size={12} 
                    className={`text-gray-400 transition-transform ${
                      expandedSection === 'notebook-notes' ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

              {expandedSection === 'notebook-notes' && (
                <div className="ml-6 mt-1 space-y-1">
                  {activity.notebooks.notes.note_ids.map((noteId) => (
                    <button
                      key={noteId}
                      onClick={() => {
                        onOpenNote(noteId);
                        onClose();
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded truncate"
                    >
                      Note {noteId.slice(0, 8)}...
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activity.notebooks.claude.count === 0 && 
           activity.notebooks.chatgpt.count === 0 && 
           activity.notebooks.notes.count === 0 && (
            <p className="text-xs text-gray-400 px-2 py-1">No notebook activity</p>
          )}
        </div>

        {/* Projects Section */}
        {activity.projects.length > 0 && (
          <div className="p-2 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2 px-2">
              Projects
            </h3>

            <div className="space-y-1">
              {activity.projects.map((project) => (
                <div key={project.project_id}>
                  <button
                    onClick={() => handleProjectClick(project.project_id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded transition text-left"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FolderKanban 
                        size={14} 
                        style={{ color: project.project_color }}
                      />
                      <span className="text-xs text-gray-700 truncate" title={project.project_name}>
                        {truncate(project.project_name, 12)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs font-medium" style={{ color: project.project_color }}>
                        {project.message_count}
                      </span>
                      <ChevronRight 
                        size={12} 
                        className={`text-gray-400 transition-transform ${
                          expandedSection === `project-${project.project_id}` ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Jump to first message */}
                  {expandedSection === `project-${project.project_id}` && (
                    <div className="ml-6 mt-1">
                      <button
                        onClick={() => {
                          // Get first message ID of the day
                          const firstMessageId = project.message_ids[0];
                          onOpenProject(project.project_id, firstMessageId);
                          onClose();
                        }}
                        className="w-full text-left px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                      >
                        → Jump to first message
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render using portal to escape parent overflow/positioning
  return ReactDOM.createPortal(popup, document.body);
}