import { useState, useRef, useEffect } from 'react';
import { X, Pin, Palette, Bell, User, Image, MoreVertical, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import {type NoteCardDisplay } from '../../typesOG/note.types';
import { ColourPicker } from '../ColorPicker';
import { useClickOutside } from '../../hooksOG/Intelligenceeffects/useClickOutside';
import { LabelSelector } from '../LabelSelector';
import type { LabelDisplay, LabelToBe } from '../../typesOG/note.types';
interface NoteEditModalPropsSchema {
  note: NoteCardDisplay;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<NoteCardDisplay>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  initialPosition?: { top: number; left: number; width: number; height: number };
  labels: LabelDisplay[];  // NEW
  onAddLabelToNote: (noteId: string, labelId: string) => Promise<void>;  // NEW
  onRemoveLabelFromNote: (noteId: string, labelId: string) => Promise<void>;  // NEW
  onCreateLabel: (label: LabelToBe) => Promise<void>;  // NEW
  canNavigateLeft?: boolean;   // ← NEW
  canNavigateRight?: boolean;  // ← NEW
  onNavigateLeft?: () => void; // ← NEW
  onNavigateRight?: () => void; // ← NEW
  onAddToProject?: (noteId: string) => void; // ← NEW
}
export function NoteEditModal({  note,  onClose,  onUpdate,  onDelete, onTogglePin, initialPosition, labels, onAddLabelToNote, onRemoveLabelFromNote, onCreateLabel , canNavigateLeft = false, canNavigateRight = false, onNavigateLeft, onNavigateRight, onAddToProject}: NoteEditModalPropsSchema) {
  const [editedNote, setEditedNote] = useState({ title: note.title, content: note.content, background_color: note.background_color,});
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);
    useClickOutside(moreMenuRef, () => setShowMoreMenu(false));
    const handleAddLabel = async (labelId: string) => {
        await onAddLabelToNote(note.id, labelId);
    };
    const handleRemoveLabel = async (labelId: string) => {
        await onRemoveLabelFromNote(note.id, labelId);
    };
  useEffect(() => {
    // Small delay to trigger animation
    const timer = setTimeout(() => setIsAnimating(false), 10);
    return () => clearTimeout(timer);
  }, []);
    useEffect(() => {
    setEditedNote({
      title: note.title,
      content: note.content,
      background_color: note.background_color,
    });
  }, [note.id]); // Re-run when switching to different note
  // ← UPDATED: Pass ignore classes to useClickOutside
  useClickOutside(modalRef, handleClose, ['note-nav-button', 'note-counter']);
    function handleClose() {
    setIsClosing(true);
    // Wait for animation to finish before calling onClose
    setTimeout(() => {
      handleSave();
    }, 300); // Match the CSS transition duration
  }
  // Save changes when clicking outside
  // useClickOutside(modalRef, handleSave);
  function handleSave() {
    // Only update if something changed
    if (
      editedNote.title !== note.title ||
      editedNote.content !== note.content ||
      editedNote.background_color !== note.background_color
    ) {
      onUpdate(note.id, editedNote);
    }
    onClose();
  }
  function handleDelete() {
    onDelete(note.id);
    onClose();
  }
    const getModalStyle = () => {
    if (!initialPosition) {
      return {
        backgroundColor: editedNote.background_color,
        top: '5vh',
        left: '50%',
        width: '100%',
        maxWidth: '600px',
        height: '90vh',
        transform: 'translateX(-50%)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    if (isAnimating || isClosing) {
      // Starting position (or closing position)
      return {
        backgroundColor: editedNote.background_color,
        top: `${initialPosition.top}px`,
        left: `${initialPosition.left}px`,
        width: `${initialPosition.width}px`,
        height: `${initialPosition.height}px`,
        transform: 'scale(1)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    // Final position (centered)
    return {
      backgroundColor: editedNote.background_color,
      top: '5vh',
      left: '50%',
      width: '100%',
      maxWidth: '600px',
      height: '90vh',
      transform: 'translateX(-50%)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  };
  const formatTimestamp = (timestamp: Date | string): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} - ${hours}:${minutes}`;
};
  return (
    <>
      {/* Overlay with fade-in */}
      <div className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${  isAnimating ? 'bg-opacity-0' : 'bg-opacity-5'} ${isClosing ? 'bg-opacity-0' : ''}`}/>
      {/* ← NEW: Left Navigation Button */}
      {canNavigateLeft && onNavigateLeft && (
        <button onClick={onNavigateLeft} className="note-nav-button fixed left-4 top-1/2 -translate-y-1/2 z-50 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-3 shadow-lg transition-all hover:scale-110" title="Newer note">
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
      )}
      {/* ← NEW: Right Navigation Button */}
      {canNavigateRight && onNavigateRight && (
        <button onClick={onNavigateRight} className="note-nav-button fixed right-4 top-1/2 -translate-y-1/2 z-50 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-3 shadow-lg transition-all hover:scale-110" title="Older note" >
          <ChevronRight size={24} className="text-gray-700" />
        </button>
      )}
      {/* Modal with flexbox layout */}
      <div ref={modalRef} className="fixed z-50 bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col" style={getModalStyle()}>
        {/* Top timestamp */}
        <div className='flex-shrink-0 px-2 py-1 bg-gray-200 rounded-full text-xs text-gray-700 hover:bg-gray-300'>
          <span><p>{formatTimestamp(note.updated_at)}</p></span>
        </div>
        
        {/* Header with title and pin button */}
        <div className="flex justify-between items-start p-4 pb-2 flex-shrink-0">
          <input type="text" placeholder="Title" value={editedNote.title} onChange={(e) => setEditedNote({ ...editedNote, title: e.target.value })} className="flex-1 text-xl font-medium outline-none bg-transparent"/>
          <button onClick={() => onTogglePin(note.id)} className="p-2 hover:bg-gray-300 rounded-full" title={note.is_pinned ? 'Unpin' : 'Pin'}>
            <Pin size={20} className={note.is_pinned ? 'fill-current' : ''} />
          </button>
        </div>

        {/* Scrollable content area that takes remaining space */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2 min-h-0 ">
          <textarea placeholder="Take a note..." value={editedNote.content} onChange={(e) => setEditedNote({ ...editedNote, content: e.target.value })} className="w-full h-full outline-none resize-none bg-transparent" autoFocus/>
        </div>

        {/* Footer with labels and toolbar - fixed at bottom */}
        <div className='shadow-[0_-8px_8px_-6px_rgba(0,0,0,0.35)] p-0.5 flex-shrink-0'>
          {/* Display labels above toolbar */}
          {note.labels && note.labels.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-2 pt-2">
              {note.labels.map((label) => (
                <div key={label.id} className="flex items-center gap-1 px-2 py-1 bg-gray-200 rounded-full text-sm text-gray-700">
                  <span>{label.name}</span>
                  <button onClick={() => handleRemoveLabel(label.id)} className="hover:bg-gray-300 rounded-full p-0.5" title="Remove label">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between px-4 pb-4 pt-2 relative">
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-gray-300 rounded-full" title="Remind me">
                <Bell size={18} />
              </button>
              <button className="p-2 hover:bg-gray-300 rounded-full" title="Collaborator">
                <User size={18} />
              </button>
              
              <div className="relative">
                <button className="p-2 hover:bg-gray-300 rounded-full" onClick={() => setShowColorPicker(!showColorPicker)} title="Background options">
                  <Palette size={18} />
                </button>
                {showColorPicker && (
                  <ColourPicker onSelectColor={(background_color) => {   setEditedNote({ ...editedNote, background_color });   setShowColorPicker(false); }} onClose={() => setShowColorPicker(false)}/>
                )}
              </div>
              <button className="p-2 hover:bg-gray-300 rounded-full" title="Add image">
                <Image size={18} />
              </button>
              
            {/* In the toolbar area, update the More button */}
            <div className="relative" ref={moreMenuRef}>
                <button 
                    className="p-2 hover:bg-gray-300 rounded-full" 
                    title="More"
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                >
                    <MoreVertical size={18} />
                </button>
                
                {showMoreMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <div className="border-t border-gray-200">
                            <LabelSelector
                                labels={labels}
                                selectedLabels={note.labels || []}
                                onAddLabel={handleAddLabel}
                                onRemoveLabel={handleRemoveLabel}
                                onCreateLabel={onCreateLabel}
                                onAddToProject={onAddToProject ? () => onAddToProject(note.id) : undefined}
                            />
                        </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} className="p-2 hover:bg-gray-300 rounded-full" title="Delete note">
                <Trash2 size={18} />
              </button>
              <button onClick={handleClose} className="px-6 py-2 text-sm font-medium hover:bg-gray-200 rounded">
                Close
              </button>
            </div>
          </div>
        </div>
        
        {/* Bottom timestamp */}
        <div className='flex-shrink-0 px-2 py-1 bg-gray-200 rounded-full text-xs text-gray-700 hover:bg-gray-300'>
          <span><p>{formatTimestamp(new Date(note.timestamp))}</p></span>
        </div>
      </div>
    </>
  );
}