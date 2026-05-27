import { useState, useRef } from 'react';
import { Bell, Palette, Trash2, Pin, X } from 'lucide-react';
import type { NoteCardDisplay } from '../typesOG/note.types';
import { ColourPicker } from './ColorPicker';
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';

const formatTimestamp = (ts: Date | string): string => {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface NoteCardPropsSchema {
  note: NoteCardDisplay;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onEdit: (note: NoteCardDisplay, position: { top: number; left: number; width: number; height: number }) => void;
  onLabelClick?: (labelId: string) => void;
  onRemoveLabel?: (noteId: string, labelId: string) => void;
}

export function Notecard({ note, onDelete, onTogglePin, onChangeColor, onEdit, onLabelClick, onRemoveLabel }: NoteCardPropsSchema) {
  const [showActions, setShowActions] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useClickOutside(colorPickerRef, () => setShowColorPicker(false));

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.color-picker')) return;
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      onEdit(note, { top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }
  };

  // Only apply inline bg when there's a real custom color (not default white)
  const hasCustomColor = note.background_color && note.background_color !== '#ffffff';
  const cardStyle = hasCustomColor ? { backgroundColor: note.background_color } : {};

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowColorPicker(false); }}
      style={cardStyle}
      className={`
        relative rounded-xl border p-4 cursor-pointer
        transition-all duration-150 select-none
        ${hasCustomColor
          ? 'border-black/10'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }
        hover:shadow-md dark:hover:shadow-gray-900/60
      `}
    >
      {/* Title row + pin */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        {note.title && (
          <h3 className="font-semibold text-sm leading-snug text-gray-900 dark:text-gray-100 flex-1">
            {note.title}
          </h3>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(note.id); }}
          title={note.is_pinned ? 'Unpin' : 'Pin'}
          className={`p-1 rounded-full transition-all shrink-0 ${
            showActions || note.is_pinned ? 'opacity-100' : 'opacity-0'
          } ${hasCustomColor ? 'hover:bg-black/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Pin
            size={14}
            className={note.is_pinned
              ? 'fill-current text-gray-700 dark:text-gray-200'
              : 'text-gray-500 dark:text-gray-400'}
          />
        </button>
      </div>

      {/* Content */}
      {note.content && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-8 text-gray-700 dark:text-gray-300">
          {note.content}
        </p>
      )}

      {/* Labels */}
      {note.labels && note.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {note.labels.map((label) => (
            <div
              key={label.id}
              onClick={(e) => { e.stopPropagation(); onLabelClick?.(label.id); }}
              className={`group flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
                hasCustomColor
                  ? 'bg-black/10 text-gray-800 hover:bg-black/15'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span>{label.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveLabel?.(note.id, label.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity -mr-0.5"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Timestamp */}
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        {formatTimestamp(note.updated_at)}
      </p>

      {/* Action bar */}
      <div className={`flex items-center gap-0.5 mt-2 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={(e) => e.stopPropagation()}
          title="Remind me"
          className={`p-1.5 rounded-full transition-colors ${hasCustomColor ? 'hover:bg-black/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Bell size={15} className="text-gray-500 dark:text-gray-400" />
        </button>

        <div ref={colorPickerRef} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
            title="Background color"
            className={`p-1.5 rounded-full transition-colors ${hasCustomColor ? 'hover:bg-black/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <Palette size={15} className="text-gray-500 dark:text-gray-400" />
          </button>
          {showColorPicker && (
            <ColourPicker
              onSelectColor={(color) => onChangeColor(note.id, color)}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
          title="Delete"
          className={`p-1.5 rounded-full transition-colors ${hasCustomColor ? 'hover:bg-black/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Trash2 size={15} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>
    </div>
  );
}
