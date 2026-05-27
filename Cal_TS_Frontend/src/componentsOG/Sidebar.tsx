import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Lightbulb, Tag, FolderKanban, BookOpen,
  Plus, ChevronRight, ChevronDown, CalendarIcon,
} from 'lucide-react';
import type { LabelDisplay } from '../typesOG/note.types';
import type { ProjectDisplay } from '../typesOG/project.types';

interface SidebarPropsSchema {
  labels?: LabelDisplay[];
  selectedLabelId: string | null;
  onSelectLabel: (labelId: string | null) => void;
  onSelectNotes: () => void;
  projects?: ProjectDisplay[];
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  onCreateProject?: () => void;
  onSelectNotebook?: (source: 'claude' | 'chatgpt') => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  labels = [],
  selectedLabelId,
  onSelectLabel,
  onSelectNotes,
  projects = [],
  selectedProjectId = null,
  onSelectProject,
  onCreateProject,
  onSelectNotebook,
  isOpen = true,
  onClose,
}: SidebarPropsSchema) {
  const [notebooksExpanded, setNotebooksExpanded] = useState(false);
  const location = useLocation();
  const isCalendarPage = location.pathname === '/calendar' && selectedProjectId === null;
  const isNotesActive =
    location.pathname === '/note' &&
    selectedProjectId === null &&
    selectedLabelId === null;

  const navBtn = (active: boolean, onClick: () => void, children: React.ReactNode) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-2.5 rounded-r-full mr-3 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-10 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-16 left-0 bottom-0 z-20
          w-64 bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-700/60
          transform transition-transform duration-300 ease-in-out
          overflow-y-auto overflow-x-hidden custom-scrollbar
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="py-3">

          {/* ── Core nav ── */}

          {navBtn(isCalendarPage, () => { window.location.href = '/calendar'; },
            <>
              <CalendarIcon size={18} className={isCalendarPage ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} />
              Calendar
            </>
          )}

          {navBtn(isNotesActive, () => { onSelectNotes(); if (window.innerWidth < 1024) onClose?.(); },
            <>
              <Lightbulb size={18} className={isNotesActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} />
              Notes
            </>
          )}


          {/* Divider */}
          <div className="my-3 border-t border-gray-100 dark:border-gray-800" />

          {/* ── Projects ── */}
          <div className="px-3 mb-2">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Projects
              </span>
              {onCreateProject && (
                <button
                  onClick={onCreateProject}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="New project"
                >
                  <Plus size={13} className="text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>

            {projects.length > 0 ? (
              <div className="space-y-0.5">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onSelectProject?.(p.id); if (window.innerWidth < 1024) onClose?.(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedProjectId === p.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <FolderKanban size={15} style={{ color: p.color }} />
                    <span className="flex-1 text-left truncate">{p.title}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{p.message_count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1.5">No projects yet</p>
            )}
          </div>

          {/* ── Notebooks ── */}
          <div className="px-3 mb-2">
            <button
              onClick={() => setNotebooksExpanded(!notebooksExpanded)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Notebooks
              </span>
              {notebooksExpanded
                ? <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
                : <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
              }
            </button>

            {notebooksExpanded && (
              <div className="mt-0.5 space-y-0.5">
                {([
                  { src: 'claude' as const, label: 'Claude', color: 'text-orange-500' },
                  { src: 'chatgpt' as const, label: 'ChatGPT', color: 'text-emerald-600 dark:text-emerald-400' },
                ] as const).map(({ src, label, color }) => (
                  <button
                    key={src}
                    onClick={() => { onSelectNotebook?.(src); if (window.innerWidth < 1024) onClose?.(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <BookOpen size={15} className={color} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Labels ── */}
          <div className="px-3">
            <div className="px-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Labels
              </span>
            </div>

            {labels.length > 0 ? (
              <div className="space-y-0.5">
                {labels.map((lbl) => (
                  <button
                    key={lbl.id}
                    onClick={() => { onSelectLabel(lbl.id); if (window.innerWidth < 1024) onClose?.(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedLabelId === lbl.id
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Tag size={14} className={selectedLabelId === lbl.id ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'} />
                    <span className="flex-1 text-left truncate">{lbl.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1.5">No labels yet</p>
            )}
          </div>

        </div>
      </aside>
    </>
  );
}
