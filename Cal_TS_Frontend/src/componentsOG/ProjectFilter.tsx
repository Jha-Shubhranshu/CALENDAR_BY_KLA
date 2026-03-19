import React, { useState, useRef } from 'react';
import { ChevronDown, FolderKanban, X, Check } from 'lucide-react';
import type { ProjectDisplay } from '../typesOG/project.types';
import { useClickOutside } from '../hooksOG/Intelligenceeffects/useClickOutside';
interface ProjectFilterProps {
  projects: ProjectDisplay[];
  selectedProjects: string[];
  onSelectionChange: (projectIds: string[]) => void;
}

export function ProjectFilter({
  projects,
  selectedProjects,
  onSelectionChange,
}: ProjectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const toggleProject = (projectId: string) => {
    if (selectedProjects.includes(projectId)) {
      onSelectionChange(selectedProjects.filter(id => id !== projectId));
    } else {
      onSelectionChange([...selectedProjects, projectId]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectAll = () => {
    onSelectionChange(projects.map(p => p.id));
  };

  const selectedCount = selectedProjects.length;
  const allSelected = selectedCount === projects.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full sm:w-auto flex items-center justify-between gap-2 px-4 py-2 
          border rounded-lg transition
          ${selectedCount > 0 
            ? 'border-blue-500 bg-blue-50 text-blue-700' 
            : 'border-gray-300 hover:bg-gray-50 text-gray-700'
          }
        `}
      >
        <div className="flex items-center gap-2">
          <FolderKanban size={16} />
          <span className="text-sm font-medium">
            Projects
            {selectedCount > 0 && (
              <span className="ml-1">({selectedCount})</span>
            )}
          </span>
        </div>
        <ChevronDown 
          size={16} 
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Selected Projects Pills */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {projects
            .filter(p => selectedProjects.includes(p.id))
            .map(project => (
              <div
                key={project.id}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                style={{ 
                  backgroundColor: `${project.color}20`,
                  borderLeft: `3px solid ${project.color}`
                }}
              >
                <span className="text-gray-700">{project.title}</span>
                <button
                  onClick={() => toggleProject(project.id)}
                  className="hover:bg-black hover:bg-opacity-10 rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          <button
            onClick={clearAll}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-700">
              Filter by Projects
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              {selectedCount > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-600 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Project List */}
          <div className="max-h-64 overflow-y-auto p-2">
            {projects.length > 0 ? (
              <div className="space-y-1">
                {projects.map(project => {
                  const isSelected = selectedProjects.includes(project.id);
                  
                  return (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-left
                        ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-100'}
                      `}
                    >
                      {/* Checkbox */}
                      <div 
                        className={`
                          w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                          ${isSelected ? 'bg-blue-500' : 'border-2 border-gray-300'}
                        `}
                      >
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>

                      {/* Project Info */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {project.title}
                          </p>
                          {project.description && (
                            <p className="text-xs text-gray-500 truncate">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {project.message_count}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FolderKanban size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No projects yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}