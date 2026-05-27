import axios from "axios";
import type {Note, NoteCardDisplay } from "../typesOG/note.types";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/v1/notes`;


export async function getCurrentUser(){
console.log("Asking for current user:");
    
   try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/me`, 
        {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      console.log("✅ User data response:", {
        status: res.status,
        contentType: res.headers['content-type'],
        data: res.data
      });

      if (typeof res.data === 'string' && res.data.trim().startsWith('<!doctype html>')) {
        console.error('❌ RECEIVED HTML INSTEAD OF JSON in getCurrentUser');
      }

      return res.data;

      
  } catch (err: any) {
      console.error("❌ fetching failed:", err.response?.data || err.message);
    }

   }


//------------------------------Notes---------------------------

export async function createNote(NabkaNote: Note) {
    console.log("creating Note in calendar:", NabkaNote.title);
    
   try {
      const res = await axios.post(`${BASE_URL}/note_create`, NabkaNote, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      console.log("✅ note created:", res.data);

      return res.data;
      
  } catch (error) {
      const err = error as any;
      console.error("❌ note creation failed:", err?.response?.data || err?.message || err);
      throw error;
    }

   }

//   async getAllNotes(): Promise<NoteCardDisplay[]> {
//     // Simulate network delay
//     await new Promise(resolve => setTimeout(resolve, 100));
//     return [...this.notes];
//   }




export async function getAllNotes(
  limit: number = 1000, // Match backend default
  offset: number = 0
): Promise<{ notes: NoteCardDisplay[], hasMore: boolean }> {
  // console.log('🔄 API Call:', { limit, offset });
  
  try {
    const res = await axios.get(`${BASE_URL}/note_get`, {
      params: { 
        skip: offset,
        limit: limit
      },
      withCredentials: true,
    });
    
    const notes = res.data.notes || [];
    const totalNotes = res.data.total || 0;
    const loadedSoFar = offset + notes.length;
    
    // More accurate hasMore calculation
    const hasMore = notes.length === limit && loadedSoFar < totalNotes;
    
    // console.log('📊 API Response:', { 
    //   notesReceived: notes.length, 
    //   totalNotes, 
    //   loadedSoFar, 
    //   hasMore,
    //   offset,
    //   limit
    // });
    
    return {
      notes,
      hasMore
    };
  } catch (error) {
    console.error('❌ Failed to fetch notes:', error);
    return {
      notes: [],
      hasMore: false
    };
  }
}


  

   export async function deleteNote(id:string): Promise<unknown> {
    console.log("deleting the note from calendar:");
    
   try {
      const res = await axios.delete(`${BASE_URL}/delnote/${id}`, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      console.log("✅ Notes deleted:", res.data);

      return res.data;
      
  } catch (error) {
      const err = error as any;
      console.error("❌ note deletion failed:", err?.response?.data || err?.message || err);
      throw error;
    }

   }


export async function update(id: string, note_data: Partial<Note>): Promise<NoteCardDisplay> {
    console.log("updating the Note from calendar:");
    
    try {
        console.log(note_data);
        const res = await axios.patch(`${BASE_URL}/update/${id}`, note_data, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });
        console.log("✅ Notes updated:", res.data);
        return (res.data?.note ?? res.data) as NoteCardDisplay;
        
    } catch (error) {
        const err = error as any;
        console.error("❌ note update failed:", err?.response?.data || err?.message || err);
        throw error;
    }
  }


