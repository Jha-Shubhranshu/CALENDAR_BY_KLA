import { Lightbulb } from "lucide-react";
import type { NoteCardDisplay } from "../typesOG/note.types";
import { Notecard } from "./Notecard";


interface NoteGridPropsSchema {
    pinnedNotes: NoteCardDisplay[];
    unpinnedNotes: NoteCardDisplay[];
    onDeleteNote: (id: string) => void;
    onTogglePin: (id: string) => void;
    changeColor: (id: string, color:string)=> void;
    hasNotes: boolean;
    onEditNote: (note: NoteCardDisplay, position: { top: number; left: number; width: number; height: number }) => void;  // ← NEW
    onLabelClick?: (labelId: string) => void;  // NEW
}


export function NotesGrid ({pinnedNotes,unpinnedNotes, hasNotes, onDeleteNote, onTogglePin, onEditNote, changeColor, onLabelClick}: NoteGridPropsSchema){


    

    const allNotesCount= pinnedNotes.length+unpinnedNotes.length
    console.log(allNotesCount)
    

    if (hasNotes===false && allNotesCount === 0) {

    return (
      <div className="text-center py-20">
        <Lightbulb size={120} className="text-gray-300 mx-auto mb-4" />
        <p className="text-xl text-gray-400">Notes you add appear here</p>
      </div>
    );
  }

//   else if (hasNotes()===false && allNotesCount > 0) {
//     return (
//       <div className="text-center py-20">
//         <p className="text-xl text-gray-400">No notes found</p>
//       </div>
//     );
//   }



    return(
    <div>
        {pinnedNotes.length>0 && (
            <section>
                <h2 className="text-xs text-gray-600 uppercase mb-2">Pinned</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {pinnedNotes.map(note=> (
                        <Notecard key={note.id} note={note} onDelete={onDeleteNote} onTogglePin={onTogglePin} onEdit={onEditNote} onChangeColor={changeColor} onLabelClick={onLabelClick}/>
                    ))}
                </div>
            </section>
        )}

        {unpinnedNotes.length>0 && (
            <section>
                <h2 className="text-xs text-gray-600 uppercase mb-2">others</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {unpinnedNotes.map(note=> (
                        <Notecard key={note.id} note={note} onDelete={onDeleteNote} onTogglePin={onTogglePin} onEdit={onEditNote} onChangeColor={changeColor} onLabelClick={onLabelClick}/>
                    ))}
                </div>
            </section>
        )}

    </div>
    )
}