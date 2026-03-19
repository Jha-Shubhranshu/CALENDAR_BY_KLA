import { useEffect, useState } from "react";
import type { LabelToBe, LabelDisplay } from "../typesOG/note.types";

import { createLabel, getAllLabels, deleteLabel, updateLabel } from "../api/labelsAPIAxios";

export function useLabels() {
    const [labels, setLabels] = useState<LabelDisplay[]>([]);
    const [loadinglabels, setLoading] = useState(true);

    const loadLabels = async () => {
        try {
            const data = await getAllLabels();
            // Ensure data is always an array
            setLabels(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading labels:', error);
            setLabels([]);
        } finally {
            setLoading(false);
        }
    }

    const changeLabelName = async (id: string, newname: string) => {
        const currentLabel = labels.find(n => n.id === id);

        if (currentLabel) {
            const updatedLabel = { ...currentLabel, name: newname };
            setLabels(prev => Array.isArray(prev) ? prev.map(n => (n.id === id ? updatedLabel : n)) : []);
            const updated = await updateLabel(id, updatedLabel);
            return updated;
        }
    };

    useEffect(() => {
        loadLabels();
    }, []);

    const createLabelhook = async (data: LabelToBe) => {
        try {
            const newLabel = await createLabel(data);
            // Add to local state so UI updates immediately
            // Ensure prev is always an array before spreading
            setLabels(prev => Array.isArray(prev) ? [newLabel as LabelDisplay, ...prev] : [newLabel as LabelDisplay]);
            return newLabel;
        } catch (error) {
            console.error('Error creating label:', error);
            throw error;
        }
    }

    const deleteLabelhook = async (id: string) => {
        await deleteLabel(id);
        setLabels(prev => Array.isArray(prev) ? prev.filter(n => n.id !== id) : []);
    }

    const updateLabelhook = async (id: string, updates: Partial<LabelToBe>) => {
        try {
            const updated = await updateLabel(id, updates);
            if (updated) {
                setLabels(prev => Array.isArray(prev) ? prev.map(n => n.id === id ? updated : n) : []);
                return updated;
            }
        } catch (error) {
            console.error('Error updating label:', error);
            throw error;
        }
    };

    return { labels, loadinglabels, loadLabels, changeLabelName, createLabelhook, deleteLabelhook, updateLabelhook };
}