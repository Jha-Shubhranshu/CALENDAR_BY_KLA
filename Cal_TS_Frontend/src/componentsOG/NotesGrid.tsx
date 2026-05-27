import { Lightbulb } from 'lucide-react';
import type { NoteCardDisplay } from '../typesOG/note.types';
import { Notecard } from './Notecard';

interface NoteGridPropsSchema {
  pinnedNotes: NoteCardDisplay[];
  unpinnedNotes: NoteCardDisplay[];
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
  changeColor: (id: string, color: string) => void;
  hasNotes: boolean;
  onEditNote: (note: NoteCardDisplay, position: { top: number; left: number; width: number; height: number }) => void;
  onLabelClick?: (labelId: string) => void;
}

export function NotesGrid({
  pinnedNotes,
  unpinnedNotes,
  hasNotes,
  onDeleteNote,
  onTogglePin,
  onEditNote,
  changeColor,
  onLabelClick,
}: NoteGridPropsSchema) {
  const allCount = pinnedNotes.length + unpinnedNotes.length;

  if (!hasNotes && allCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Lightbulb size={96} className="text-gray-200 dark:text-gray-700 mb-4" />
        <p className="text-lg font-medium text-gray-400 dark:text-gray-500">Notes you add appear here</p>
        <p className="text-sm text-gray-300 dark:text-gray-600 mt-1">Click the box above to create your first note</p>
      </div>
    );
  }

  const grid = (notes: NoteCardDisplay[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {notes.map((note) => (
        <Notecard
          key={note.id}
          note={note}
          onDelete={onDeleteNote}
          onTogglePin={onTogglePin}
          onEdit={onEditNote}
          onChangeColor={changeColor}
          onLabelClick={onLabelClick}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {pinnedNotes.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 px-1">
            Pinned
          </h2>
          {grid(pinnedNotes)}
        </section>
      )}

      {unpinnedNotes.length > 0 && (
        <section>
          {pinnedNotes.length > 0 && (
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 px-1">
              Others
            </h2>
          )}
          {grid(unpinnedNotes)}
        </section>
      )}
    </div>
  );
}
