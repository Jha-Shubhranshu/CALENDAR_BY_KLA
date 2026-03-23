import { useState } from "react";
import { ColourPicker } from "./ColorPicker";
import { Palette } from "lucide-react";
import { useEffect,useRef } from 'react';
import { useClickOutsideinputbox } from "../hooksOG/Intelligenceeffects/useClickOutsideinputbox";
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';
import type { Note } from "../typesOG/note.types";

export interface newNoteSchema {title:string , content: string}

interface NoteInputPropsSchema {
    onCreateNote: (NabkaNote: Note ) => Promise<unknown> | unknown;
}


export function NoteInput({onCreateNote}: NoteInputPropsSchema) {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [newNote, setNewNote] = useState({title: '', content: '', background_color: ''});
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentColor, setCurrentColor] = useState("")

    const colorPickerRef = useRef<HTMLDivElement>(null);
    const noteinputRef = useRef<HTMLDivElement>(null);
    
    useClickOutsideinputbox(noteinputRef, ()=> setIsExpanded(false))
    useClickOutside(colorPickerRef, ()=> setShowColorPicker(false))

    const textareaRef = useRef<HTMLTextAreaElement>(null);



    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleSubmit = async () => {

        if (newNote.title.trim() || newNote.content.trim()) {
            await onCreateNote(newNote);
            setNewNote({ title: '', content: '', background_color: ''});
            setIsExpanded(false);
            setCurrentColor('');
        }
    }

    useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      
      // Escape to close
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
        setNewNote({ title: '', content: '', background_color:''});
        textareaRef.current?.blur();
      }
    };

    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isExpanded, newNote, currentColor, handleSubmit]);



    

    return (
        <div ref={noteinputRef} className="border rounded-lg shadow-md max-w-2xl mx-auto mb-8 relative" style={{backgroundColor: currentColor}}>

            {
                isExpanded&& (<input type="text" placeholder="Title" className="w-full px-4 pt-4 pb-2 outline-none bg-transparent" value={newNote.title} onChange={(e) => setNewNote({...newNote, title: e.target.value})} />)
            }

            <textarea placeholder="Take a Note..." className="w-full px-4 py-3 outline-none resize-none bg-transparent" rows={isExpanded?3:1} value={newNote.content} onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}  onFocus={() => setIsExpanded(true)} />

            {isExpanded && (
                    <div ref={colorPickerRef} className="relative">
                        <button className="p-2 hover:bg-gray-300 rounded-full" title="Background options" onClick={() => setShowColorPicker(!showColorPicker)}>
                        <Palette size={16} className="text-gray-700" />
                        </button>
                        {showColorPicker && (
                        <ColourPicker 
                          onSelectColor={(color: string) => {
                            setCurrentColor(color);
                            setNewNote(prev => ({ ...prev, background_color: color }));
                          }} 
                          onClose={() => setShowColorPicker(false)} 
                        />
                        )}
                        <button onClick={handleSubmit} className="px-6 py-2 hover:bg-gray-200 rounded">Save</button>
                    </div>
            )
        }


            {/* <div className="flex flex-col gap-4">
            <div className="flex flex-col">
                <label>title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col">
                <label>content</label>
            <input value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <button onClick={handleSubmit}>Add</button>
            </div> */}
        </div>
    )
}