import { useMemo, useState } from "react";
import type { NoteCardDisplay } from "../typesOG/note.types";

export function useSearch(notes: NoteCardDisplay[]){
    const [searchQuery, setSearchQuery] = useState('');

    const filteredNotes = useMemo(()=>{
        if (!searchQuery) return notes;



        let result = notes;
  
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(n => {
              const content = (n.content ?? "").toLowerCase();
              const title   = (n.title ?? "").toLowerCase();
              return content.includes(query) || title.includes(query);
            });
          }

          return result;
        }, [notes, searchQuery]);

        const pinnedNotes = useMemo(
          () => filteredNotes.filter(n => n.is_pinned),
          [filteredNotes]
        );

        const unpinnedNotes = useMemo(
          () => filteredNotes.filter(n => !n.is_pinned),
          [filteredNotes]
        );

        const hasNote = useMemo(()=>{
          
        if (!searchQuery) return false;

        let result = notes;
  
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(n => 
              {
                const content = (n.content ?? "").toLowerCase();
                const title   = (n.title ?? "").toLowerCase();
                return content.includes(query) || title.includes(query);
              }
            );
          }

            return result.length > 0;

        }, [notes, searchQuery]);

        // const hasNote = useMemo(() => {
        //   return notes.length > 0;
        // }, [notes]);
      


    return {searchQuery, setSearchQuery, filteredNotes, pinnedNotes, unpinnedNotes, hasNote}
}