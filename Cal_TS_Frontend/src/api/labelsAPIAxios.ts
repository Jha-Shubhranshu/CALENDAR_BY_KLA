import axios from "axios";
import type { LabelDisplay, LabelToBe } from "../typesOG/note.types";


const BASE_URL_LABEL = "http://localhost:8004/api/v1/labels";




//-----------------------Label--------------------
export async function createLabel(NabkaLabel: LabelToBe) {
    console.log("creating Label in calendar:", NabkaLabel.name);
    
   try {
      const res = await axios.post(`${BASE_URL_LABEL}/label_create`, NabkaLabel, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      console.log("✅ convo created:", res.data);

      return res.data;
      
  } catch (error) {
      const err = error as any;
      console.error("❌ Label creation failed:", err?.response?.data || err?.message || err);
      throw error;
    }

   }

//   async getAllLabels(): Promise<LabelDisplay[]> {
//     // Simulate network delay
//     await new Promise(resolve => setTimeout(resolve, 100));
//     return [...this.notes];
//   }




export async function getAllLabels(): Promise<LabelDisplay[]> {
    
   try {
      const res = await axios.get(`${BASE_URL_LABEL}/label_get`, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });


      // Ensure we always return an array
      // Check if response has labels or notes property, or is already an array
      const labelsData = res.data?.labels || res.data?.notes || res.data || [];
      return Array.isArray(labelsData) ? labelsData : [];

      
  } catch (error) {
      const err = error as any;
      console.error("❌ label fetch failed:", err?.response?.data || err?.message || err);
       // Return empty array on error instead of throwing
      return [];
    }

   }


  

   export async function deleteLabel(id:string): Promise<unknown> {
    console.log("deleting the label from calendar:");
    
   try {
      const res = await axios.delete(`${BASE_URL_LABEL}/dellabel/${id}`, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      console.log("✅ Labels deleted:", res.data);

      return res.data;
      
  } catch (error) {
      const err = error as any;
      console.error("❌ label deletion failed:", err?.response?.data || err?.message || err);
      throw error;
    }

   }


export async function updateLabel(id: string, label_data: Partial<LabelToBe>): Promise<LabelDisplay> {
    console.log("updating the Label from calendar:");
    
    try {
        console.log(label_data);
        const res = await axios.patch(`${BASE_URL_LABEL}/update/${id}`, label_data, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });
        console.log("✅ Labels updated:", res.data);
        return (res.data?.label ?? res.data) as LabelDisplay;
        
    } catch (error) {
        const err = error as any;
        console.error("❌ label update failed:", err?.response?.data || err?.message || err);
        throw error;
    }
}




export async function addLabelToNote(noteId: string, labelId: string): Promise<unknown> {
    console.log("Adding label to note:", { noteId, labelId });
    
    try {
        const res = await axios.post(`${BASE_URL_LABEL}/note/${noteId}/label/${labelId}`, {}, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });
        console.log("✅ Label added to note:", res.data);
        return res.data;
    } catch (error) {
        const err = error as any;
        console.error("❌ Failed to add label to note:", err?.response?.data || err?.message || err);
        throw error;
    }
}

export async function removeLabelFromNote(noteId: string, labelId: string): Promise<unknown> {
    console.log("Removing label from note:", { noteId, labelId });
    
    try {
        const res = await axios.delete(`${BASE_URL_LABEL}/note/${noteId}/label/${labelId}`, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });
        console.log("✅ Label removed from note:", res.data);
        return res.data;
    } catch (error) {
        const err = error as any;
        console.error("❌ Failed to remove label from note:", err?.response?.data || err?.message || err);
        throw error;
    }
}



