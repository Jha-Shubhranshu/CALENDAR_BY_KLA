// // import React from 'react';
// // import { Lightbulb, Bell, Tag } from 'lucide-react';
// // import type { LabelDisplay } from '../typesOG/note.types';

// // interface SidebarPropsSchema {
// //     labels?: LabelDisplay[];
// //     selectedLabelId: string | null;
// //     onSelectLabel: (labelId: string | null) => void;
// //     onSelectNotes: () => void;
// // }

// // export function Sidebar({ labels = [], selectedLabelId, onSelectLabel, onSelectNotes }: SidebarPropsSchema) {
// //     return (
// //         <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
// //             {/* Header */}
// //             <div className="p-4 flex items-center gap-3 border-b border-gray-200">
// //                 <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
// //                     <Lightbulb size={24} className="text-white fill-white" />
// //                 </div>
// //                 <h1 className="text-xl font-medium text-gray-700">Keep</h1>
// //             </div>

// //             {/* Navigation */}
// //             <div className="flex-1 overflow-y-auto py-2">
// //                 {/* Notes */}
// //                 <button onClick={onSelectNotes} className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 transition-colors ${selectedLabelId === null ? 'bg-yellow-50 border-r-4 border-yellow-400' : ''}`}>
// //                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedLabelId === null ? 'bg-yellow-400' : 'bg-gray-200'}`}>
// //                         <Lightbulb size={20} className={selectedLabelId === null ? 'text-white fill-white' : 'text-gray-600'} />
// //                     </div>
// //                     <span className="text-sm font-medium text-gray-700">Notes</span>
// //                 </button>

// //                 {/* Reminders */}
// //                 <button className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 transition-colors">
// //                     <Bell size={20} className="text-gray-600" />
// //                     <span className="text-sm font-medium text-gray-700">Reminders</span>
// //                 </button>

// //                 {/* Labels Section */}
// //                 <div className="mt-4 px-4">
// //                     <h2 className="text-xs font-medium text-gray-500 uppercase mb-2">Labels</h2>
// //                     {labels && labels.length > 0 
// //                     ?(labels.map((label) => (
// //                         <button key={label.id} onClick={() => onSelectLabel(label.id)} className={`w-full flex items-center gap-4 px-4 py-2 hover:bg-gray-100 transition-colors rounded ${ selectedLabelId === label.id ? 'bg-yellow-50' : ''}`}>
// //                             <Tag size={16} className="text-gray-600" />
// //                             <span className="text-sm text-gray-700 flex-1 text-left">{label.name}</span>
// //                         </button>
// //                     ))

// //                 ):(<p className="text-xs text-gray-400 px-4 py-2">No labels yet</p>)
// //                     }
// //                 </div>
// //             </div>
// //         </div>
// //     );
// // }


// import React, { useState } from 'react';
// import { Lightbulb, Bell, Tag, FolderKanban, BookOpen, Plus, ChevronRight, ChevronDown, X } from 'lucide-react';
// import type { LabelDisplay } from '../typesOG/note.types';
// import type { ProjectDisplay } from '../typesOG/project.types';

// interface SidebarPropsSchema {
//     labels?: LabelDisplay[];
//     selectedLabelId: string | null;
//     onSelectLabel: (labelId: string | null) => void;
//     onSelectNotes: () => void;
//     projects?: ProjectDisplay[];
//     selectedProjectId?: string | null;
//     onSelectProject?: (projectId: string) => void;
//     onCreateProject?: () => void;
//     onSelectNotebook?: (source: 'claude' | 'chatgpt') => void;
//     isOpen?: boolean;
//     onClose?: () => void;
// }

// export function Sidebar({ 
//     labels = [], 
//     selectedLabelId, 
//     onSelectLabel, 
//     onSelectNotes,
//     projects = [],
//     selectedProjectId = null,
//     onSelectProject,
//     onCreateProject,
//     onSelectNotebook,
//     isOpen = true,
//     onClose
// }: SidebarPropsSchema) {
//     const [notebooksExpanded, setNotebooksExpanded] = useState(false);


// //     return (
// //         <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
// //             {/* Header */}
// //             <div className="p-4 flex items-center gap-3 border-b border-gray-200">
// //                 <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
// //                     <Lightbulb size={24} className="text-white fill-white" />
// //                 </div>
// //                 <h1 className="text-xl font-medium text-gray-700">Keep</h1>
// //             </div>

// //             {/* Navigation */}
// //             <div className="flex-1 overflow-y-auto py-2">
// //                 {/* Notes */}
// //                 <button
// //                     onClick={onSelectNotes}
// //                     className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 transition-colors ${
// //                         selectedLabelId === null && selectedProjectId === null ? 'bg-yellow-50 border-r-4 border-yellow-400' : ''
// //                     }`}
// //                 >
// //                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
// //                         selectedLabelId === null && selectedProjectId === null ? 'bg-yellow-400' : 'bg-gray-200'
// //                     }`}>
// //                         <Lightbulb size={20} className={selectedLabelId === null && selectedProjectId === null ? 'text-white fill-white' : 'text-gray-600'} />
// //                     </div>
// //                     <span className="text-sm font-medium text-gray-700">Notes</span>
// //                 </button>

// //                 {/* Reminders */}
// //                 <button className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-100 transition-colors">
// //                     <Bell size={20} className="text-gray-600" />
// //                     <span className="text-sm font-medium text-gray-700">Reminders</span>
// //                 </button>

// //                 {/* ========== NEW: PROJECTS SECTION ========== */}
// //                 <div className="mt-4 px-4">
// //                     <div className="flex items-center justify-between mb-2">
// //                         <h2 className="text-xs font-medium text-gray-500 uppercase">Projects</h2>
// //                         {onCreateProject && (
// //                             <button
// //                                 onClick={onCreateProject}
// //                                 className="p-1 hover:bg-gray-200 rounded-full"
// //                                 title="Create project"
// //                             >
// //                                 <Plus size={16} className="text-gray-600" />
// //                             </button>
// //                         )}
// //                     </div>

// //                     {projects.length > 0 ? (
// //                         <div className="space-y-1">
// //                             {projects.map((project) => (
// //                                 <button
// //                                     key={project.id}
// //                                     onClick={() => onSelectProject?.(project.id)}
// //                                     className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 transition-colors rounded ${
// //                                         selectedProjectId === project.id ? 'bg-blue-50' : ''
// //                                     }`}
// //                                 >
// //                                     <FolderKanban 
// //                                         size={16} 
// //                                         style={{ color: project.color }}
// //                                     />
// //                                     <span className="text-sm text-gray-700 flex-1 text-left truncate">
// //                                         {project.title}
// //                                     </span>
// //                                     <span className="text-xs text-gray-400">
// //                                         {project.message_count}
// //                                     </span>
// //                                 </button>
// //                             ))}
// //                         </div>
// //                     ) : (
// //                         <p className="text-xs text-gray-400 px-4 py-2">No projects yet</p>
// //                     )}
// //                 </div>

// //                 {/* ========== NEW: NOTEBOOKS SECTION ========== */}
// //                 <div className="mt-4 px-4">
// //                     <button
// //                         onClick={() => setNotebooksExpanded(!notebooksExpanded)}
// //                         className="w-full flex items-center justify-between mb-2 hover:bg-gray-100 px-2 py-1 rounded"
// //                     >
// //                         <div className="flex items-center gap-2">
// //                             {notebooksExpanded ? (
// //                                 <ChevronDown size={16} className="text-gray-500" />
// //                             ) : (
// //                                 <ChevronRight size={16} className="text-gray-500" />
// //                             )}
// //                             <h2 className="text-xs font-medium text-gray-500 uppercase">Notebooks</h2>
// //                         </div>
// //                     </button>

// //                     {notebooksExpanded && (
// //                         <div className="space-y-1 ml-2">
// //                             <button
// //                                 onClick={() => onSelectNotebook?.('claude')}
// //                                 className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 transition-colors rounded"
// //                             >
// //                                 <BookOpen size={16} className="text-orange-500" />
// //                                 <span className="text-sm text-gray-700">Claude</span>
// //                             </button>
// //                             <button
// //                                 onClick={() => onSelectNotebook?.('chatgpt')}
// //                                 className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 transition-colors rounded"
// //                             >
// //                                 <BookOpen size={16} className="text-gray-700" />
// //                                 <span className="text-sm text-gray-700">ChatGPT</span>
// //                             </button>
// //                         </div>
// //                     )}
// //                 </div>

// //                 {/* Labels Section */}
// //                 <div className="mt-4 px-4">
// //                     <h2 className="text-xs font-medium text-gray-500 uppercase mb-2">Labels</h2>
// //                     {labels && labels.length > 0 ? (
// //                         labels.map((label) => (
// //                             <button
// //                                 key={label.id}
// //                                 onClick={() => onSelectLabel(label.id)}
// //                                 className={`w-full flex items-center gap-4 px-4 py-2 hover:bg-gray-100 transition-colors rounded ${
// //                                     selectedLabelId === label.id ? 'bg-yellow-50' : ''
// //                                 }`}
// //                             >
// //                                 <Tag size={16} className="text-gray-600" />
// //                                 <span className="text-sm text-gray-700 flex-1 text-left">{label.name}</span>
// //                             </button>
// //                         ))
// //                     ) : (
// //                         <p className="text-xs text-gray-400 px-4 py-2">No labels yet</p>
// //                     )}
// //                 </div>
// //             </div>
// //         </div>
// //     );
// // }

// return (
//         <>
//             {/* Backdrop for mobile */}
//             {isOpen && (
//                 <div 
//                     className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
//                     onClick={onClose}
//                 />
//             )}
            
//             {/* Sidebar - positioned below header */}
//             <aside className={`
//                 fixed lg:static top-[65px] left-0 bottom-0 z-50
//                 w-64 bg-white border-r border-gray-200 flex flex-col
//                 transform transition-transform duration-300 ease-in-out
//                 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
//                 lg:translate-x-0
//             `}>
//                 {/* Navigation */}
//                 <div className="flex-1 overflow-y-auto py-2">
//                     {/* Notes */}
//                     <button
//                         onClick={() => {
//                             onSelectNotes();
//                             if (window.innerWidth < 1024) onClose?.();
//                         }}
//                         className={`w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-100 transition-colors rounded-r-full mr-2 ${
//                             selectedLabelId === null && selectedProjectId === null ? 'bg-yellow-50' : ''
//                         }`}
//                     >
//                         <Lightbulb 
//                             size={20} 
//                             className={selectedLabelId === null && selectedProjectId === null ? 'text-gray-900' : 'text-gray-600'} 
//                         />
//                         <span className="text-sm font-medium text-gray-900">Notes</span>
//                     </button>

//                     {/* Reminders */}
//                     <button className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-100 transition-colors rounded-r-full mr-2">
//                         <Bell size={20} className="text-gray-600" />
//                         <span className="text-sm font-medium text-gray-900">Reminders</span>
//                     </button>

//                     {/* Divider */}
//                     <div className="border-t border-gray-200 my-2"></div>

//                     {/* Projects Section */}
//                     <div className="px-4">
//                         <div className="flex items-center justify-between mb-2 px-2">
//                             <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projects</h2>
//                             {onCreateProject && (
//                                 <button
//                                     onClick={onCreateProject}
//                                     className="p-1 hover:bg-gray-200 rounded-full"
//                                     title="Create project"
//                                 >
//                                     <Plus size={14} className="text-gray-600" />
//                                 </button>
//                             )}
//                         </div>
//                         {projects.length > 0 ? (
//                             <div className="space-y-0.5">
//                                 {projects.map((project) => (
//                                     <button
//                                         key={project.id}
//                                         onClick={() => {
//                                             onSelectProject?.(project.id);
//                                             if (window.innerWidth < 1024) onClose?.();
//                                         }}
//                                         className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors rounded-r-full mr-2 ${
//                                             selectedProjectId === project.id ? 'bg-blue-50' : ''
//                                         }`}
//                                     >
//                                         <FolderKanban 
//                                             size={16} 
//                                             style={{ color: project.color }}
//                                         />
//                                         <span className="text-sm text-gray-900 flex-1 text-left truncate">
//                                             {project.title}
//                                         </span>
//                                         <span className="text-xs text-gray-400">
//                                             {project.message_count}
//                                         </span>
//                                     </button>
//                                 ))}
//                             </div>
//                         ) : (
//                             <p className="text-xs text-gray-400 px-4 py-2">No projects yet</p>
//                         )}
//                     </div>

//                     {/* Notebooks Section */}
//                     <div className="mt-3 px-4">
//                         <button
//                             onClick={() => setNotebooksExpanded(!notebooksExpanded)}
//                             className="w-full flex items-center justify-between mb-1 hover:bg-gray-100 px-2 py-1.5 rounded"
//                         >
//                             <div className="flex items-center gap-2">
//                                 <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notebooks</h2>
//                             </div>
//                             {notebooksExpanded ? (
//                                 <ChevronDown size={16} className="text-gray-500" />
//                             ) : (
//                                 <ChevronRight size={16} className="text-gray-500" />
//                             )}
//                         </button>
//                         {notebooksExpanded && (
//                             <div className="space-y-0.5">
//                                 <button
//                                     onClick={() => {
//                                         onSelectNotebook?.('claude');
//                                         if (window.innerWidth < 1024) onClose?.();
//                                     }}
//                                     className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors rounded-r-full mr-2"
//                                 >
//                                     <BookOpen size={16} className="text-orange-500" />
//                                     <span className="text-sm text-gray-900">Claude</span>
//                                 </button>
//                                 <button
//                                     onClick={() => {
//                                         onSelectNotebook?.('chatgpt');
//                                         if (window.innerWidth < 1024) onClose?.();
//                                     }}
//                                     className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors rounded-r-full mr-2"
//                                 >
//                                     <BookOpen size={16} className="text-gray-700" />
//                                     <span className="text-sm text-gray-900">ChatGPT</span>
//                                 </button>
//                             </div>
//                         )}
//                     </div>

//                     {/* Labels Section */}
//                     <div className="mt-3 px-4">
//                         <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-2">Labels</h2>
//                         {labels && labels.length > 0 ? (
//                             <div className="space-y-0.5">
//                                 {labels.map((label) => (
//                                     <button
//                                         key={label.id}
//                                         onClick={() => {
//                                             onSelectLabel(label.id);
//                                             if (window.innerWidth < 1024) onClose?.();
//                                         }}
//                                         className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors rounded-r-full mr-2 ${
//                                             selectedLabelId === label.id ? 'bg-yellow-50' : ''
//                                         }`}
//                                     >
//                                         <Tag size={16} className="text-gray-600" />
//                                         <span className="text-sm text-gray-900 flex-1 text-left">{label.name}</span>
//                                     </button>
//                                 ))}
//                             </div>
//                         ) : (
//                             <p className="text-xs text-gray-400 px-4 py-2">No labels yet</p>
//                         )}
//                     </div>
//                 </div>
//             </aside>
//         </>
//     );
// }


import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Lightbulb, Bell, Tag, FolderKanban, BookOpen, Plus, ChevronRight, ChevronDown, CalendarIcon } from 'lucide-react';
import type { LabelDisplay } from '../typesOG/note.types';
import type { ProjectDisplay } from '../typesOG/project.types';

interface SidebarPropsSchema {
    labels?: LabelDisplay[];
    selectedLabelId: string | null;
    onSelectLabel: (labelId: string | null) => void;
    onSelectNotes: () => void;
    projects?: ProjectDisplay[];
    selectedProjectId?: string | null;
    onSelectProject?: (projectId: string) => void;
    onCreateProject?: () => void;
    onSelectNotebook?: (source: 'claude' | 'chatgpt') => void;
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ 
    labels = [], 
    selectedLabelId, 
    onSelectLabel, 
    onSelectNotes,
    projects = [],
    selectedProjectId = null,
    onSelectProject,
    onCreateProject,
    onSelectNotebook,
    isOpen = true,
    onClose
}: SidebarPropsSchema) {
    const [notebooksExpanded, setNotebooksExpanded] = useState(false);
    const location = useLocation();
    const isCalendarPage = location.pathname === '/calendar' && selectedProjectId === null;
    const isNotesPage = location.pathname === '/note' && selectedProjectId === null && selectedLabelId === null;

    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
                    onClick={onClose}
                />
            )}
            
            {/* Sidebar - positioned below header */}
            <aside className={`
                fixed top-16 left-0 bottom-0 z-20
                w-64 bg-white border-r border-gray-200
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                overflow-y-auto overflow-x-hidden
            `}>
                {/* Navigation - no separate scroll, uses parent scroll */}
                <div className="py-2">
                    {/* Notes */}
                    <button
                        onClick={() => {
                            onSelectNotes();
                            if (window.innerWidth < 1024) onClose?.();
                        }}
                        className={`w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-100 transition-colors rounded-r-full mr-2 ${
                            isNotesPage && selectedLabelId === null && selectedProjectId === null ? 'bg-yellow-50' : ''
                        }`}
                    >
                        <Lightbulb 
                            size={20} 
                            className={isNotesPage && selectedLabelId === null && selectedProjectId === null ? 'text-gray-900' : 'text-gray-600'} 
                        />
                        <span className="text-sm font-medium text-gray-900">Notes</span>
                    </button>

                    <button 
                        onClick={() => window.location.href = '/calendar'} 
                        className={`w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-100 transition-colors rounded-r-full mr-2 ${
                            isCalendarPage ? 'bg-blue-50' : ''
                        }`}
                    >
                      <CalendarIcon size={20} className={isCalendarPage ? 'text-blue-600' : 'text-gray-600'} />
                      <span className={`text-sm font-medium ${isCalendarPage ? 'text-blue-600' : 'text-gray-900'}`}>Calendar</span>
                    </button>


                    {/* Reminders */}
                    <button className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-100 transition-colors rounded-r-full mr-2">
                        <Bell size={20} className="text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Reminders</span>
                    </button>

                    {/* Divider */}
                    <div className="border-t border-gray-200 my-2"></div>

                    {/* Projects Section */}
                    <div className="px-4">
                        <div className="flex items-center justify-between mb-2 px-2">
                            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Projects</h2>
                            {onCreateProject && (
                                <button
                                    onClick={onCreateProject}
                                    className="p-1 hover:bg-gray-200 rounded-full"
                                    title="Create project"
                                >
                                    <Plus size={14} className="text-gray-600" />
                                </button>
                            )}
                        </div>
                        {projects.length > 0 ? (
                            <div className="space-y-0.5">
                                {projects.map((project) => (
                                    <button
                                        key={project.id}
                                        onClick={() => {
                                            onSelectProject?.(project.id);
                                            if (window.innerWidth < 1024) onClose?.();
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors rounded-r-full mr-2 ${
                                            selectedProjectId === project.id ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <FolderKanban 
                                            size={16} 
                                            style={{ color: project.color }}
                                        />
                                        <span className="text-sm text-gray-900 flex-1 text-left truncate">
                                            {project.title}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {project.message_count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 px-4 py-2">No projects yet</p>
                        )}
                    </div>

                    {/* Notebooks Section */}
                    <div className="mt-3 px-4">
                        <button
                            onClick={() => setNotebooksExpanded(!notebooksExpanded)}
                            className="w-full flex items-center justify-between mb-1 hover:bg-gray-100 px-2 py-1.5 rounded"
                        >
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notebooks</h2>
                            </div>
                            {notebooksExpanded ? (
                                <ChevronDown size={16} className="text-gray-500" />
                            ) : (
                                <ChevronRight size={16} className="text-gray-500" />
                            )}
                        </button>
                        {notebooksExpanded && (
                            <div className="space-y-0.5">
                                <button
                                    onClick={() => {
                                        onSelectNotebook?.('claude');
                                        if (window.innerWidth < 1024) onClose?.();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors rounded-r-full mr-2"
                                >
                                    <BookOpen size={16} className="text-orange-500" />
                                    <span className="text-sm text-gray-900">Claude</span>
                                </button>
                                <button
                                    onClick={() => {
                                        onSelectNotebook?.('chatgpt');
                                        if (window.innerWidth < 1024) onClose?.();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors rounded-r-full mr-2"
                                >
                                    <BookOpen size={16} className="text-gray-700" />
                                    <span className="text-sm text-gray-900">ChatGPT</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Labels Section */}
                    <div className="mt-3 px-4">
                        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-2">Labels</h2>
                        {labels && labels.length > 0 ? (
                            <div className="space-y-0.5">
                                {labels.map((label) => (
                                    <button
                                        key={label.id}
                                        onClick={() => {
                                            onSelectLabel(label.id);
                                            if (window.innerWidth < 1024) onClose?.();
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 transition-colors rounded-r-full mr-2 ${
                                            selectedLabelId === label.id ? 'bg-yellow-50' : ''
                                        }`}
                                    >
                                        <Tag size={16} className="text-gray-600" />
                                        <span className="text-sm text-gray-900 flex-1 text-left">{label.name}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 px-4 py-2">No labels yet</p>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}