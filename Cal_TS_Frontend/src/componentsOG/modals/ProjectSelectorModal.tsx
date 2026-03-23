import { useRef, useState } from 'react';
import { X, FolderKanban, Plus, Check } from 'lucide-react';
import type { ProjectDisplay } from '../../typesOG/project.types';
import { useClickOutside } from '../../hooksOG/Intelligenceeffects/useClickOutside';


interface ProjectSelectorModalProps {
  projects: ProjectDisplay[];
  currentProjectId?: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onClose: () => void;
}

export function ProjectSelectorModal({
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
  onClose
}: ProjectSelectorModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useClickOutside(modalRef, onClose);

  const filteredProjects = projects.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        {/* Modal */}
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Add to Project</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Create New Project */}
          <button
            onClick={() => {
              onCreateProject();
              onClose();
            }}
            className="m-4 flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition border-2 border-dashed border-blue-300"
          >
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Plus size={20} className="text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium text-blue-700">Create New Project</p>
              <p className="text-xs text-blue-600">Start a new timeline</p>
            </div>
          </button>

          {/* Projects List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => {
                const isSelected = project.id === currentProjectId;
                
                return (
                  <button
                    key={project.id}
                    onClick={() => {
                      onSelectProject(project.id);
                      onClose();
                    }}
                    disabled={isSelected}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg transition
                      ${isSelected
                        ? 'bg-green-50 border-2 border-green-300 cursor-default'
                        : 'hover:bg-gray-100 border-2 border-transparent'
                      }
                    `}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: project.color }}
                    >
                      {isSelected ? (
                        <Check size={20} className="text-white" />
                      ) : (
                        <FolderKanban size={20} className="text-white" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-800">{project.title}</p>
                      {project.description && (
                        <p className="text-xs text-gray-500 truncate">
                          {project.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {project.message_count} message{project.message_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-medium text-green-600">
                        Already added
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FolderKanban size={48} className="mx-auto mb-2 opacity-50" />
                <p>No projects found</p>
                {searchQuery && (
                  <p className="text-xs mt-1">Try a different search</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}