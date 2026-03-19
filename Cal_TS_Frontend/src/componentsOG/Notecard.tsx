import { useState } from 'react';
import type { NoteCardDisplay } from '../typesOG/note.types';
import { Bell, User, Palette, Image, Trash2, MoreVertical, Pin } from 'lucide-react';
import { ColourPicker } from './ColorPicker';
import { useRef } from 'react';
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';

import { X } from 'lucide-react';
import type { LabelDisplay } from '../typesOG/note.types';

const formatTimestamp = (timestamp: Date | string): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} - ${hours}:${minutes}`;
};


interface NoteCardPropsSchema {
    note: NoteCardDisplay;
    onDelete: (id: string) => void;
    onTogglePin: (id: string) => void;
    onChangeColor: (id:string, color:string)=> void;
    onEdit: (note: NoteCardDisplay, position: { top: number; left: number; width: number; height: number }) => void;  // ← NEW
    onLabelClick?: (labelId: string) => void;  // NEW
    onRemoveLabel?: (noteId: string, labelId: string) => void;

}

export function Notecard ({note, onDelete, onTogglePin, onChangeColor, onEdit, onLabelClick,onRemoveLabel}: NoteCardPropsSchema){
  
  const [showActions, setShowActions] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLElement>(null);

  useClickOutside(colorPickerRef, () => setShowColorPicker(false));

    const cardRef = useRef<HTMLDivElement>(null);

    const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on action buttons
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('.color-picker')
    ) {
      return;
    }
    // Get card position
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      onEdit(note, {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  

    return(

        <div className='border rounded-lg p-4 relative hover:shadow-lg transition-shadow cursor-pointer' style={{backgroundColor: note.background_color}} onMouseEnter={()=> setShowActions(true)} onMouseLeave={() => {setShowActions(false); setShowColorPicker(false);}} ref={cardRef} onClick={handleCardClick}  >
                    <div className='group relative px-2 py-1 bg-gray-200 rounded-full text-xs text-gray-700 hover:bg-gray-300'>
              <span><p>{formatTimestamp(note.updated_at)}</p></span>
            </div>

        <div className="flex justify-between items-start mb-2">
        {note.title && <h3 className="font-medium text-base flex-1">{note.title}</h3>}
        
          <button className={`p-1 hover:bg-gray-300 rounded-full transition-opacity ${showActions || note.is_pinned ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => { e.stopPropagation(); onTogglePin(note.id)}}  title={note.is_pinned ? 'Unpin' : 'Pin'}>
          <Pin size={16} className={note.is_pinned ? 'fill-current' : ''} />
          </button>
          </div>

        
      <p className="text-sm whitespace-pre-wrap line-clamp-6 overflow-hidden">{note.content}</p>
      <div className={`flex items-center justify-end gap-1 mt-3 transition-opacity ${   showActions ? 'opacity-100' : 'opacity-0' }`}>
        
        <button onClick={(e) => e.stopPropagation()}  className="p-2 hover:bg-gray-300 rounded-full"   title="Add image">
          <Image size={16} className="text-gray-700" />
        </button>

        <button 
          onClick={(e) => e.stopPropagation()}  // ← Prevent card click
          className="p-2 hover:bg-gray-300 rounded-full" 
          title="Remind me"
        >
          <Bell size={16} className="text-gray-700" />
        </button>
        <button 
          onClick={(e) => e.stopPropagation()}
          className="p-2 hover:bg-gray-300 rounded-full" 
          title="Collaborator"
        >
          <User size={16} className="text-gray-700" />
        </button>

        {showActions && (
        <div className="flex gap-2 mt-2">

             {/* <button onClick={() => onTogglePin(note.id, !note.is_pinned)}>
           <Pin size={16} className={note.is_pinned ? 'fill-current' : ''} />
             </button> */}



          <div ref={colorPickerRef} className="relative">
            <button onClick={() => setShowColorPicker(!showColorPicker)}>
              <Palette size={16} />
            </button>
            
            {showColorPicker && (
              <ColourPicker
                onSelectColor={(color) => onChangeColor(note.id, color)}
                onClose={() => setShowColorPicker(false)}
              />
            )}
          </div>
          
        <button onClick={(e) => { e.stopPropagation(); onDelete(note.id);}} className="p-2 hover:bg-gray-300 rounded-full" title="Delete">
          <Trash2 size={16} className="text-gray-700" />
        </button>

        </div>
      )}

      </div>
        {/* Labels */}
            {note.labels && note.labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {note.labels.map((label) => (
                  <div
                    key={label.id}
                    className="group relative px-2 py-1 bg-gray-200 rounded-full text-xs text-gray-700 hover:bg-gray-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLabelClick?.(label.id);
                    }}
                  >
                    <span>{label.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveLabel?.(note.id, label.id); // NEW handler needed
                      }}
                      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className='group relative px-2 py-1 bg-gray-200 rounded-full text-xs text-gray-700 hover:bg-gray-300'>
              <span><p>{formatTimestamp(note.updated_at)}</p></span>
            </div>
        </div>
    



)
}