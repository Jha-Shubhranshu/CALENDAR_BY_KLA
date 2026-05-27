import { useState, useRef, useEffect, useCallback } from 'react';
import { Palette } from 'lucide-react';
import { ColourPicker } from './ColorPicker';
import { useClickOutsideinputbox } from '../hooksOG/Intelligenceeffects/useClickOutsideinputbox';
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';
import type { Note } from '../typesOG/note.types';

interface NoteInputPropsSchema {
  onCreateNote: (note: Note) => Promise<unknown> | unknown;
}

export function NoteInput({ onCreateNote }: NoteInputPropsSchema) {
  const [newNote, setNewNote] = useState({ title: '', content: '', background_color: '' });
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentColor, setCurrentColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const noteinputRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useClickOutsideinputbox(noteinputRef, () => setIsExpanded(false));
  useClickOutside(colorPickerRef, () => setShowColorPicker(false));

  const handleSubmit = useCallback(async () => {
    if (newNote.title.trim() || newNote.content.trim()) {
      await onCreateNote(newNote);
      setNewNote({ title: '', content: '', background_color: '' });
      setIsExpanded(false);
      setCurrentColor('');
    }
  }, [newNote, onCreateNote]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        setIsExpanded(false);
        setNewNote({ title: '', content: '', background_color: '' });
        textareaRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, handleSubmit]);

  const hasCustomColor = currentColor && currentColor !== '#ffffff';
  const cardStyle = hasCustomColor ? { backgroundColor: currentColor } : {};

  return (
    <div
      ref={noteinputRef}
      style={cardStyle}
      className={`
        w-full rounded-xl border shadow-sm transition-all
        ${hasCustomColor
          ? 'border-black/10'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }
        ${isExpanded ? 'shadow-md' : ''}
      `}
    >
      {isExpanded && (
        <input
          type="text"
          placeholder="Title"
          value={newNote.title}
          onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
          className="w-full px-4 pt-4 pb-2 text-sm font-semibold bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
      )}

      <textarea
        ref={textareaRef}
        placeholder="Take a note…"
        value={newNote.content}
        rows={isExpanded ? 3 : 1}
        onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
        onFocus={() => setIsExpanded(true)}
        className="w-full px-4 py-3 text-sm bg-transparent outline-none resize-none text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
      />

      {isExpanded && (
        <div className="flex items-center justify-between px-3 pb-3">
          <div ref={colorPickerRef} className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Background color"
              className={`p-1.5 rounded-full transition-colors ${
                hasCustomColor ? 'hover:bg-black/10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Palette size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
            {showColorPicker && (
              <ColourPicker
                onSelectColor={(color) => {
                  setCurrentColor(color);
                  setNewNote(prev => ({ ...prev, background_color: color }));
                }}
                onClose={() => setShowColorPicker(false)}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsExpanded(false); setNewNote({ title: '', content: '', background_color: '' }); setCurrentColor(''); }}
              className="px-4 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 text-sm rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
