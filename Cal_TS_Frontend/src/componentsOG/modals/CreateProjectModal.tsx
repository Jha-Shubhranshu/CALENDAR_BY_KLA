import React, { useRef, useState } from 'react';
import { X, FolderKanban } from 'lucide-react';
import { useClickOutside } from '../../hooksOG/Intelligenceeffects/useClickOutside';
interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (data: { title: string; description?: string; color: string }) => void;
}

const PROJECT_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Green', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Indigo', value: '#6366F1' },
];

export function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0].value);

  useClickOutside(modalRef, onClose);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (title.trim()) {
      onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        color: selectedColor
      });
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        {/* Modal */}
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-2xl w-full max-w-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Create New Project</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Project Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Research Notes, Product Ideas..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this project about?"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Color
              </label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={`
                      w-10 h-10 rounded-lg transition-transform
                      ${selectedColor === color.value 
                        ? 'ring-4 ring-offset-2 ring-blue-500 scale-110' 
                        : 'hover:scale-105'
                      }
                    `}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Preview:</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedColor }}
                >
                  <FolderKanban size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">
                    {title || 'Project Title'}
                  </p>
                  {description && (
                    <p className="text-sm text-gray-600 truncate">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className={`
                  px-6 py-2 rounded-lg transition
                  ${title.trim()
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}