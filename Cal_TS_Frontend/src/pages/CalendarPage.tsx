import React, { useState } from 'react';
import { Sidebar } from '../componentsOG/Sidebar';
import { Header } from '../componentsOG/Header';
import { Calendar } from '../componentsOG/Calendar';
import { useProjects } from '../hooksOG/useProjects';
import { useLabels } from '../hooksOG/useLabels';
import { useNotes } from '../hooksOG/useNotes';
import { NoteEditModal } from '../componentsOG/intelligentmodals/NoteEditModal';
import { ChatWindow } from '../componentsOG/ChatWindow';
import { ConversationsSidebar } from '../componentsOG/ConversationsSidebar';
import { ProjectSelectorModal } from '../componentsOG/modals/ProjectSelectorModal';
import { CreateProjectModal } from '../componentsOG/modals/CreateProjectModal';
import type { NoteCardDisplay } from '../typesOG/note.types';
import type { ConversationWithMessages, NotebookSource } from '../typesOG/conversation.types';
import type { ProjectWithMessages } from '../typesOG/project.types';
import { getConversation } from '../api/conversationsAPIAxios';
import { getProject, addMessageToProject, removeMessageFromProject, createProject, deleteProject } from '../api/projectsAPIAxios';

export function CalendarPage() {
  const { projects, loading: loadingProjects, loadProjects } = useProjects();
  const { labels } = useLabels();
  const { notes, updateNote, deleteNote, togglePin } = useNotes();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotebookSource, setSelectedNotebookSource] = useState<NotebookSource | null>(null);

  // Modal/Window states
  const [editingNote, setEditingNote] = useState<{
    note: NoteCardDisplay;
    startIndex: number; // For carousel
  } | null>(null);

  const [openChatWindow, setOpenChatWindow] = useState<{
    type: 'conversation' | 'project';
    data: ConversationWithMessages | ProjectWithMessages;
    scrollToMessageId?: string; // For jumping to specific message
  } | null>(null);
  const [loadingChatWindow, setLoadingChatWindow] = useState(false);

  const [showProjectSelector, setShowProjectSelector] = useState<string | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

  // ========== HANDLERS ==========

  const handleSelectNotebook = (source: NotebookSource) => {
    setSelectedNotebookSource(source);
    setOpenChatWindow(null);
  };

  const handleCloseConversationsSidebar = () => {
    setSelectedNotebookSource(null);
  };

  const handleOpenConversation = async (conversationId: string) => {
    try {
      setLoadingChatWindow(true);
      const conversation = await getConversation(conversationId);
      setOpenChatWindow({ type: 'conversation', data: conversation });
      setSelectedNotebookSource(null); // Optional: close secondary sidebar when chat opens, or keep it. NotesPage closes it.
    } catch (error) {
      console.error('Error opening conversation:', error);
    } finally {
      setLoadingChatWindow(false);
    }
  };

  const handleOpenNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    // Find index in chronological array for carousel
    const chronologicalNotes = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const startIndex = chronologicalNotes.findIndex(n => n.id === noteId);

    setEditingNote({ note, startIndex });
  };

  const handleOpenProject = async (projectId: string, messageId: string) => {
    try {
      const project = await getProject(projectId);
      setOpenChatWindow({ 
        type: 'project', 
        data: project,
        scrollToMessageId: messageId 
      });
    } catch (error) {
      console.error('Error opening project:', error);
    }
  };

  const handleCloseNoteModal = () => {
    setEditingNote(null);
  };

  const handleCloseChatWindow = () => {
    setOpenChatWindow(null);
  };

  const handleAddToProject = (messageId: string) => {
    setShowProjectSelector(messageId);
  };

  const handleConfirmAddToProject = async (projectId: string) => {
    if (!showProjectSelector) return;

    try {
      await addMessageToProject(projectId, showProjectSelector);
      
      // Refresh projects to update message counts
      await loadProjects();

      // If currently viewing this project, refresh it
      if (openChatWindow?.type === 'project' && openChatWindow.data.project_id === projectId) {
        const updated = await getProject(projectId);
        setOpenChatWindow({ 
          type: 'project', 
          data: updated,
          scrollToMessageId: openChatWindow.scrollToMessageId 
        });
      }

      console.log('✅ Message added to project');
      setShowProjectSelector(null); // Close modal on success
    } catch (error) {
      console.error('Error adding message to project:', error);
    }
  };

  const handleRemoveFromProject = async (messageId: string) => {
    if (openChatWindow?.type !== 'project') return;

    try {
      const projectId = openChatWindow.data.id;
      await removeMessageFromProject(projectId, messageId);

      // Refresh projects to update message counts
      await loadProjects();

      // Update local state
      setOpenChatWindow(prev => {
        if (!prev || prev.type !== 'project') return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            messages: prev.data.messages.filter(m => m.id !== messageId)
          }
        };
      });

      console.log('✅ Message removed from project');
    } catch (error) {
      console.error('Error removing message from project:', error);
    }
  };

  const handleCreateProject = async (data: { title: string; description?: string; color: string }) => {
    try {
      const newProject = await createProject(data);
      await loadProjects();
      setShowCreateProjectModal(false);
      
      // If we were selecting a project for a message, add it to the new project immediately?
      // Or just close everything? User said "work as it was earlier implemented".
      // Assuming just creating project for now.
      
      // If the user came from the "Add to Project" flow, it might be nice to re-open the selector or just add it.
      // But let's stick to simple creation first.
      
      console.log('✅ Project created');
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      await loadProjects();
      setOpenChatWindow(null);
      console.log('✅ Project deleted');
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleNavigateToOriginal = async (conversationId: string, messageId: string) => {
    try {
      setLoadingChatWindow(true);
      const conversation = await getConversation(conversationId);
      setOpenChatWindow({ 
        type: 'conversation', 
        data: conversation,
        scrollToMessageId: messageId 
      });
      setSelectedNotebookSource(null);
    } catch (error) {
      console.error('Error opening original conversation:', error);
    } finally {
      setLoadingChatWindow(false);
    }
  };


  // Carousel navigation for notes
  const chronologicalNotes = React.useMemo(() => {
    return [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes]);

  const canNavigateLeft = () => {
    if (!editingNote) return false;
    return editingNote.startIndex > 0;
  };

  const canNavigateRight = () => {
    if (!editingNote) return false;
    return editingNote.startIndex < chronologicalNotes.length - 1;
  };

  const navigateNote = (direction: 'left' | 'right') => {
    if (!editingNote) return;

    const newIndex = direction === 'left' 
      ? editingNote.startIndex - 1 
      : editingNote.startIndex + 1;

    if (newIndex < 0 || newIndex >= chronologicalNotes.length) return;

    const nextNote = chronologicalNotes[newIndex];
    setEditingNote({ note: nextNote, startIndex: newIndex });
  };

  // Loading state
  if (loadingProjects) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-white">
      <Header 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery} 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
      />

      <div className="flex pt-16 h-full">
        <Sidebar  
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          labels={labels}  
          selectedLabelId={null}  
          onSelectLabel={() => {}}  
          onSelectNotes={() => window.location.href = '/note'} // Navigate to notes
          projects={projects}
          selectedProjectId={null}
          onSelectProject={handleOpenProject}
          onCreateProject={() => {}} // Could open create modal
          onSelectNotebook={handleSelectNotebook}
        />

        {/* Secondary Conversations Sidebar */}
        {selectedNotebookSource && (
          <div className={`fixed top-16 bottom-0 z-30 transition-all duration-300 ${
            sidebarOpen ? 'left-64' : 'left-0'
          }`}>
            <ConversationsSidebar
              source={selectedNotebookSource}
              onClose={handleCloseConversationsSidebar}
              onSelectConversation={handleOpenConversation}
            />
          </div>
        )}

        {/* Main Content: Calendar OR Chat Window */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'ml-0'
        }`}>
          {openChatWindow ? (
            <ChatWindow
              title={openChatWindow.data.title}
              source={openChatWindow.type === 'conversation' 
                ? (openChatWindow.data as ConversationWithMessages).source 
                : 'manual'}
              messages={openChatWindow.data.messages}
              onClose={handleCloseChatWindow}
              onAddToProject={openChatWindow.type === 'conversation' ? handleAddToProject : undefined}
              onRemoveFromProject={openChatWindow.type === 'project' ? handleRemoveFromProject : undefined}
              onNavigateToOriginal={handleNavigateToOriginal}
              onDeleteProject={openChatWindow.type === 'project' ? () => handleDeleteProject(openChatWindow.data.id) : undefined}
              loading={loadingChatWindow}
              isProject={openChatWindow.type === 'project'}
              scrollToMessageId={openChatWindow.scrollToMessageId}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              <Calendar
                projects={projects}
                onOpenConversation={handleOpenConversation}
                onOpenNote={handleOpenNote}
                onOpenProject={handleOpenProject}
              />
            </div>
          )}
        </div>
      </div>

      {/* Note Edit Modal */}
      {editingNote && (
        <NoteEditModal  
          note={editingNote.note}  
          initialPosition={{ top: 0, left: 0, width: 0, height: 0 }} // No animation from calendar
          onClose={handleCloseNoteModal}  
          onUpdate={updateNote}  
          onDelete={deleteNote}  
          onTogglePin={togglePin}  
          labels={labels}  
          onAddLabelToNote={() => {}}  
          onRemoveLabelFromNote={() => {}}  
          onCreateLabel={() => {}} 
          canNavigateLeft={canNavigateLeft()}    
          canNavigateRight={canNavigateRight()}  
          onNavigateLeft={() => navigateNote('left')}   
          onNavigateRight={() => navigateNote('right')}
          onAddToProject={handleAddToProject} 
        />
      )}

      {/* Project Selector Modal */}
      {showProjectSelector && (
        <ProjectSelectorModal
          projects={projects}
          onSelectProject={handleConfirmAddToProject}
          onCreateProject={() => {
            setShowProjectSelector(null);
            setShowCreateProjectModal(true);
          }}
          onClose={() => setShowProjectSelector(null)}
        />
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <CreateProjectModal
          onClose={() => setShowCreateProjectModal(false)}
          onCreate={handleCreateProject}
        />
      )}
    </div>
  );
}