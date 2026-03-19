import { useEffect, useState, useCallback } from "react";
import type { Note, NoteCardDisplay } from "../typesOG/note.types";
import { createNote, deleteNote as apiDeleteNote, getAllNotes, update } from "../api/notesAPIAxios";

const NOTES_PER_PAGE = 12000; // Match backend default

export function useNotes() {
  const [notes, setNotes] = useState<NoteCardDisplay[]>([]);
  const [loadingnotes, setLoadingNotes] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  //   const loadNotes = async () => {
  //   const data = await getAllNotes();
  //   setNotes(data);
  //   setLoading(false);
  // };

  const loadNotes = useCallback(async (reset: boolean = false) => {
    try {
      setLoadingNotes(true);
      
      // Use current state values directly
      const offset = reset ? 0 : currentOffset;
      
      // console.log('🔄 loadNotes called:', { reset, offset, currentOffset });
      
      const { notes: newNotes, hasMore: moreAvailable } = await getAllNotes(
        NOTES_PER_PAGE,
        offset
      );

      if (reset) {
        // Replace all notes (used after create/delete)
        setNotes(newNotes);
        setCurrentOffset(newNotes.length);
        console.log('🔄 Reset notes:', { count: newNotes.length });
      } else {
        // Append notes (infinite scroll)
        setNotes(prev => {
          const combined = [...prev, ...newNotes];
          console.log('📝 Appended notes:', { 
            previous: prev.length, 
            new: newNotes.length, 
            total: combined.length 
          });
          return combined;
        });
        setCurrentOffset(prev => prev + newNotes.length);
      }
      
      setHasMore(moreAvailable);
      // console.log('✅ loadNotes completed:', { hasMore: moreAvailable });
    } catch (error) {
      console.error('❌ Error loading notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  }, []); // Keep empty dependencies







  const loadMoreNotes = useCallback(async () => {
    if (!hasMore || loadingnotes) {
      console.log('🚫 Load more blocked:', { hasMore, loadingnotes });
      return;
    }

    // console.log('📄 Loading more notes...', { currentOffset, hasMore });

    try {
      setLoadingNotes(true);
      
      const { notes: newNotes, hasMore: moreAvailable } = await getAllNotes(
        NOTES_PER_PAGE,
        currentOffset
      );

      // console.log('✅ Loaded more notes:', { 
      //   newCount: newNotes.length, 
      //   hasMore: moreAvailable,
      //   currentOffset,
      //   totalAfterLoad: currentOffset + newNotes.length 
      // });
      
      if (newNotes.length > 0) {
        setNotes(prev => [...prev, ...newNotes]);
        setCurrentOffset(prev => prev + newNotes.length);
      }
      
      setHasMore(moreAvailable);
    } catch (error) {
      console.error('❌ Error loading more notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  }, [currentOffset, hasMore, loadingnotes]); // eslint-disable-line react-hooks/exhaustive-deps






  // Initial load on mount
  useEffect(() => {
    loadNotes(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeColor = async (id: string, color123: string) => {
      const currentNote = notes.find(n => n.id === id);
  
      if (currentNote) {
          const updatedNote = { ...currentNote, background_color: color123};
          setNotes(prev => prev.map(n => (n.id === id ? updatedNote : n)));
          console.log(updatedNote)
          const updated = await update(id, updatedNote);
        return updated;
      }
    };


    const createNoteHook = async (data: Note) => {
    try {
      const newNote = await createNote(data);
      // Add to local state so UI updates immediately
      setNotes(prev => [newNote as NoteCardDisplay, ...prev]);
      
      await loadNotes(true); // Refresh from start
      return newNote;
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  };


    const deleteNote = async (id:string) => {
    await apiDeleteNote(id);
    await loadNotes(true); // Refresh from start
    setNotes(prev => prev.filter(n => n.id !== id));
  }
  
// const togglePin = async (id: string, is_pinned: boolean) => {
//     const currentNote = notes.find(n => n.id === id);
    
//     if (currentNote) {
//         const updatedNote = { ...currentNote, is_pinned: !is_pinned };
        
//         setNotes(prev => prev.map(n => (n.id === id ? updatedNote : n)));
        
//         console.log("the note pin after update is:");
//         console.log(updatedNote.is_pinned);
        
//         const updated = await update(id, updatedNote);
//         return updated;
//     }
// };

const togglePin = async (id: string) => {
    const currentNote = notes.find(n => n.id === id);
    
    if (currentNote) {
        const updatedNote = { ...currentNote, is_pinned: !currentNote.is_pinned };
        
        setNotes(prev => prev.map(n => (n.id === id ? updatedNote : n)));
        
        console.log("the note pin after update is:");
        console.log(updatedNote.is_pinned);
        
        const updated = await update(id, updatedNote);
        return updated;
    }
};

const updateNote = async (id: string, updates: Partial<Note>) => {
  try {
    const updated = await update(id, updates);
    if (updated) {
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      return updated;
    }
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
};



  return { notes, loadingnotes, createNoteHook, deleteNote, togglePin, changeColor, loadNotes, updateNote, loadMoreNotes, setNotes, hasMore};


}