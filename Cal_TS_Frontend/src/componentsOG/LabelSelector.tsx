import React, { useState, useRef } from 'react';
import { X, Plus, Tag, FolderPlus } from 'lucide-react';
import type { LabelDisplay, LabelToBe } from '../typesOG/note.types';
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';

interface LabelSelectorProps {
    labels?: LabelDisplay[];  // Make optional
    selectedLabels?: LabelDisplay[];  // Make optional
    onAddLabel: (labelId: string) => void;
    onRemoveLabel: (labelId: string) => void;
    onCreateLabel: (label: LabelToBe) => Promise<void>;
    onAddToProject?: () => void; // New prop
}

export function LabelSelector({ 
    labels = [],  // Default to empty array
    selectedLabels = [],  // Default to empty array
    onAddLabel, 
    onRemoveLabel,
    onCreateLabel,
    onAddToProject
}: LabelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showCreateInput, setShowCreateInput] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useClickOutside(dropdownRef, () => {
        setIsOpen(false);
        setShowCreateInput(false);
        setNewLabelName('');
    });

    const handleCreateLabel = async () => {
        if (newLabelName.trim()) {
            await onCreateLabel({ name: newLabelName.trim(), color: '#fbbf24' });
            setNewLabelName('');
            setShowCreateInput(false);
        }
    };

    // Add safety check before filtering
    const availableLabels = (labels || []).filter(
        label => !(selectedLabels || []).some(selected => selected.id === label.id)
    );

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Display selected labels */}
            {selectedLabels && selectedLabels.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {selectedLabels.map((label) => (
                        <div key={label.id} className="flex items-center gap-1 px-2 py-1 bg-gray-200 rounded-full text-sm text-gray-700">
                            <span>{label.name}</span>
                            <button onClick={() => onRemoveLabel(label.id)} className="hover:bg-gray-300 rounded-full p-0.5" title="Remove label">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    {availableLabels.length > 0 ? (
                        availableLabels.map((label) => (
                            <button 
                                key={label.id} 
                                onClick={() => {
                                    onAddLabel(label.id);
                                    setIsOpen(false);
                                }} 
                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left"
                            >
                                <Tag size={16} className="text-gray-600" />
                                <span className="text-sm text-gray-700">{label.name}</span>
                            </button>
                        ))
                    ) : (
                        <div className="px-4 py-2 text-sm text-gray-400">No available labels</div>
                    )}
                    
                    {showCreateInput ? (
                        <div className="p-3 border-t border-gray-200">
                            <input 
                                type="text" 
                                value={newLabelName} 
                                onChange={(e) => setNewLabelName(e.target.value)} 
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleCreateLabel();
                                    } else if (e.key === 'Escape') {
                                        setShowCreateInput(false);
                                        setNewLabelName('');
                                    }
                                }} 
                                placeholder="Create new label" 
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400" 
                                autoFocus
                            />
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleCreateLabel} className="px-3 py-1 bg-yellow-400 text-white rounded text-sm hover:bg-yellow-500">
                                    Create
                                </button>
                                <button onClick={() => {
                                    setShowCreateInput(false);
                                    setNewLabelName('');
                                }} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setShowCreateInput(true)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left border-t border-gray-200">
                            <Plus size={16} className="text-gray-600" />
                            <span className="text-sm text-gray-700">Create new label</span>
                        </button>
                    )}
                </div>
            )}

            {/* Toggle button */}
            <div className="flex flex-col items-start gap-2">
                <button onClick={() => setIsOpen(!isOpen)} className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1">
                    <Tag size={14} />
                    <span>Add label</span>
                </button>

                {onAddToProject && (
                    <button 
                        onClick={() => {
                            setIsOpen(false);
                            onAddToProject();
                        }} 
                        className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                    >
                        <FolderPlus size={14} />
                        <span>Add to project</span>
                    </button>
                )}
            </div>
        </div>
    );
}