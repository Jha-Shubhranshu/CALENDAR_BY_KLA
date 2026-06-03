import { useMemo, useState } from 'react';
import { Header } from '../componentsOG/Header';
import { NoteInput } from '../componentsOG/NoteInputOG';
import { NotesGrid } from '../componentsOG/NotesGrid';
import { useNotes } from '../hooksOG/useNotes';
import { useSearch } from '../hooksOG/useSearch';
import { NoteEditModal } from '../componentsOG/intelligentmodals/NoteEditModal';
import type { NoteCardDisplay } from '../typesOG/note.types';
import { Sidebar } from '../componentsOG/Sidebar';
import { useLabels } from '../hooksOG/useLabels';
import { addLabelToNote, removeLabelFromNote } from '../api/labelsAPIAxios';
import { useInfiniteScroll } from '../hooksOG/useInfiniteScroll';
import { Loader2 } from 'lucide-react';
import { useProjects } from '../hooksOG/useProjects';
import { ConversationsSidebar } from '../componentsOG/ConversationsSidebar';
import { ChatWindow } from '../componentsOG/ChatWindow';
import { ProjectSelectorModal } from '../componentsOG/modals/ProjectSelectorModal';
import { CreateProjectModal } from '../componentsOG/modals/CreateProjectModal';
import { TotalSearch } from '../componentsOG/TotalSearch';
import type { NotebookSource, ConversationWithMessages } from '../typesOG/conversation.types';
import type { ProjectWithMessages } from '../typesOG/project.types';
import { getConversation, deleteConversation } from '../api/conversationsAPIAxios';
import { getProject, addMessageToProject, removeMessageFromProject } from '../api/projectsAPIAxios';

export function NotesPage() {
  const { notes, loadingnotes, createNoteHook, deleteNote, togglePin, changeColor, updateNote, loadNotes, setNotes, hasMore, loadMoreNotes} = useNotes();
  const { labels, loadinglabels, createLabelhook } = useLabels();
  const [sidebarOpen, setSidebarOpen] = useState(true); // ✅ Default to true for desktop
  const { projects, createProject, deleteProject, loadProjects } = useProjects();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedNotebookSource, setSelectedNotebookSource] = useState<NotebookSource | null>(null);
  const [showTotalSearch, setShowTotalSearch] = useState(false);
  
  const [openChatWindow, setOpenChatWindow] = useState<{
    type: 'conversation' | 'project';
    data: ConversationWithMessages | ProjectWithMessages;
    scrollToMessageId?: string;
  } | null>(null);
  const [loadingChatWindow, setLoadingChatWindow] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);

  
  
  
  const handleSelectProject = async (projectId: string) => {
    try {
      setLoadingChatWindow(true);
      setSelectedProjectId(projectId);
      setSelectedLabelId(null);
      setSelectedNotebookSource(null);
      const projectData = await getProject(projectId);    setOpenChatWindow({ type: 'project', data: projectData });
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoadingChatWindow(false);
    }
  };

  const handleCreateProject = async (data: {
    title: string;
    description?: string;
    color: string;
  }) => {
    try {
      await createProject(data);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleSelectNotebook = (source: NotebookSource) => {
    setSelectedNotebookSource(source);
    setSelectedProjectId(null);
    setSelectedLabelId(null);
    setOpenChatWindow(null);
  };
  const handleSelectConversation = async (conversationId: string) => {
    try {
      setLoadingChatWindow(true);
      const conversationData = await getConversation(conversationId);
      setOpenChatWindow({ type: 'conversation', data: conversationData });
      setSelectedNotebookSource(null);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoadingChatWindow(false);
    }
  };

  const handleCloseConversationsSidebar = () => {
    setSelectedNotebookSource(null);
  };

  const handleCloseChatWindow = () => {
    setOpenChatWindow(null);
    setSelectedProjectId(null);
  };

  const handleAddToProject = (messageId: string) => {
    setShowProjectSelector(messageId);
  };

  const handleConfirmAddToProject = async (projectId: string) => {
    if (!showProjectSelector) return;
    try {
      await addMessageToProject(projectId, showProjectSelector);
      await loadProjects();
      if (selectedProjectId === projectId) {
        const updated = await getProject(projectId);
        setOpenChatWindow({ type: 'project', data: updated });
      }
      console.log('✅ Message added to project');
    } catch (error) {
      console.error('Error adding message to project:', error);
    }
  };

  const handleRemoveFromProject = async (messageId: string) => {
    if (openChatWindow?.type !== 'project') return;

    try {
      const projectId = openChatWindow.data.id;
      await removeMessageFromProject(projectId, messageId);
      
      await loadProjects();
      
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

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      await loadProjects();
      setOpenChatWindow(null);
      setSelectedProjectId(null); // Also clear selected project in sidebar if any
      console.log('✅ Project deleted');
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId);
      setOpenChatWindow(null);
      // We don't need to manually refresh the sidebar here because the 
      // ConversationsSidebar handles its own state, and it will refresh 
      // when reopened or we could add a way to trigger a refresh if needed.
      // But usually closing the chat window is enough for now.
      console.log('✅ Conversation deleted');
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleNavigateToOriginal = async (conversationId: string, messageId: string) => {
    try {
      setLoadingChatWindow(true);
      
      const conversationData = await getConversation(conversationId);
      setOpenChatWindow({ 
        type: 'conversation', 
        data: conversationData,
        scrollToMessageId: messageId
      });
      setSelectedNotebookSource(null);
    } catch (error) {
      console.error('Error loading original conversation:', error);
    } finally {
      setLoadingChatWindow(false);
    }
  };

  const handleSelectNotes = () => {
    setSelectedLabelId(null);
    setSelectedProjectId(null);
    setSelectedNotebookSource(null);
    setOpenChatWindow(null);
    setShowTotalSearch(false);
  };

  const handleNavigateToNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      handleEditNote(note, { top: 100, left: 100, width: 600, height: 400 }); // Approximate center
      setShowTotalSearch(false);
    }
  };

  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: () => {
      loadMoreNotes();
    },
    hasMore,
    isLoading: loadingnotes,
    threshold: 500
  });




  const displayedNotes = useMemo(() => {
    return selectedLabelId 
      ? notes.filter(note => note.labels?.some(label => label.id === selectedLabelId))
      : notes;
  }, [notes, selectedLabelId]);

  const { searchQuery, setSearchQuery, pinnedNotes: searchPinnedNotes, unpinnedNotes: searchUnpinnedNotes, hasNote } = useSearch(displayedNotes);




  const { pinnedNotes: filteredPinnedNotes, unpinnedNotes: filteredUnpinnedNotes } = useMemo(() => {
    const pinned = displayedNotes.filter(n => n.is_pinned);
    const unpinned = displayedNotes.filter(n => !n.is_pinned);
    return { pinnedNotes: pinned, unpinnedNotes: unpinned };
  }, [displayedNotes]);






  const [editingNote, setEditingNote] = useState<{
    note: NoteCardDisplay;
    position: { top: number; left: number; width: number; height: number };
  } | null>(null);




  const currentEditingNote = useMemo(() => {
    if (!editingNote) return null;
    const latestNote = notes.find(n => n.id === editingNote.note.id);
    return latestNote ? {
      note: latestNote,
      position: editingNote.position
    } : editingNote;
  }, [editingNote, notes]);






  const handleAddLabelToNote = async (noteId: string, labelId: string) => {
    try {
      const labelToAdd = labels.find(l => l.id === labelId);
      if (labelToAdd) {
        setNotes(prevNotes => 
          prevNotes.map(note => {
            if (note.id === noteId) {
              return {
                ...note,
                labels: [...(note.labels || []), labelToAdd]
              };
            }
            return note;
          })
        );
      }
      await addLabelToNote(noteId, labelId);
    } catch (error) {
      console.error('Error adding label to note:', error);
      await loadNotes();
    }
  };

  const handleRemoveLabelFromNote = async (noteId: string, labelId: string) => {
    try {
      setNotes(prevNotes => 
        prevNotes.map(note => {
          if (note.id === noteId) {
            return {
              ...note,
              labels: (note.labels || []).filter(l => l.id !== labelId)
            };
          }
          return note;
        })
      );
      await removeLabelFromNote(noteId, labelId);
    } catch (error) {
      console.error('Error removing label from note:', error);
      await loadNotes();
    }
  };

  const handleLabelClick = (labelId: string | null) => {
    if (labelId === null) return;
    setSelectedLabelId(labelId);
    setSearchQuery('');
    setSelectedProjectId(null);
    setSelectedNotebookSource(null);
    setOpenChatWindow(null);
  };

  const handleEditNote = (
    note: NoteCardDisplay, 
    position: { top: number; left: number; width: number; height: number }
  ) => {
    setEditingNote({ note, position });
  };

  const handleCloseModal = () => {
    setEditingNote(null);
  };






  

  const chronologicalNotes = useMemo(() => {
    return [...notes].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [notes]);

  const getCurrentNoteIndex = () => {
    if (!editingNote) return -1;
    return chronologicalNotes.findIndex(n => n.id === editingNote.note.id);
  };

  const canNavigateLeft = () => {
    const currentIndex = getCurrentNoteIndex();
    return currentIndex > 0;
  };

  const canNavigateRight = () => {
    const currentIndex = getCurrentNoteIndex();
    return currentIndex < chronologicalNotes.length - 1;
  };

  const navigateToNote = (direction: 'left' | 'right') => {
    if (!editingNote) return;
    const currentIndex = getCurrentNoteIndex();
    let newIndex: number;
    if (direction === 'left') {
      newIndex = currentIndex - 1;
    } else {
      newIndex = currentIndex + 1;
    }
    if (newIndex < 0 || newIndex >= chronologicalNotes.length) {
      return;
    }
    const nextNote = chronologicalNotes[newIndex];
    setEditingNote({
      note: nextNote,
      position: editingNote.position,
    });
  };

  if (loadingnotes || loadinglabels) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading your notes…</p>
        </div>
      </div>
    );
  }

  const pinnedToShow = searchQuery ? searchPinnedNotes : filteredPinnedNotes;
  const unpinnedToShow = searchQuery ? searchUnpinnedNotes : filteredUnpinnedNotes;

  return (
    <div className="h-screen overflow-hidden bg-white dark:bg-gray-950 transition-colors duration-200">
      {/* Header - fixed at top, full width */}
      <Header 
        searchQuery={searchQuery} 
        onSearchChange={setSearchQuery} 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
      />

      {/* Main layout - below header */}
      <div className="flex pt-16 h-full">
        {/* Sidebar - independent scroll */}
        <Sidebar  
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            labels={labels}  
            selectedLabelId={selectedLabelId}  
            onSelectLabel={handleLabelClick}  
            onSelectNotes={handleSelectNotes}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
            onCreateProject={() => setShowCreateProject(true)}
            onSelectNotebook={handleSelectNotebook}
            onToggleSearch={() => setShowTotalSearch(!showTotalSearch)}
            isSearchActive={showTotalSearch}
          />

          {/* Total Search Sidebar */}
          {showTotalSearch && (
            <div className={`fixed top-16 bottom-0 z-30 transition-all duration-300 ${
              sidebarOpen ? 'left-64' : 'left-0'
            }`}>
              <TotalSearch
                onClose={() => setShowTotalSearch(false)}
                onNavigateToMessage={(convId, msgId) => {
                  handleNavigateToOriginal(convId, msgId);
                  setShowTotalSearch(false);
                }}
                onNavigateToNote={handleNavigateToNote}
              />
            </div>
          )}

          {/* Secondary Conversations Sidebar */}
        {selectedNotebookSource && (
          <div className={`fixed top-16 bottom-0 z-30 transition-all duration-300 ${
            sidebarOpen ? 'left-64' : 'left-0'
          }`}>
            <ConversationsSidebar
              source={selectedNotebookSource}
              onClose={handleCloseConversationsSidebar}
              onSelectConversation={handleSelectConversation}
            />
          </div>
        )}

        {/* Main Content - takes remaining space */}
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
              onDeleteConversation={openChatWindow.type === 'conversation' ? () => handleDeleteConversation(openChatWindow.data.id) : undefined}
              loading={loadingChatWindow}
              isProject={openChatWindow.type === 'project'}
              scrollToMessageId={openChatWindow.scrollToMessageId}
            />
          ) : (
            <main className="flex-1 flex flex-col overflow-hidden">
              {/* Note Input - fixed at top, not scrollable */}
              <div className="flex-none p-4 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
                <div className="max-w-2xl mx-auto">
                  <NoteInput onCreateNote={createNoteHook} />
                </div>
              </div>
              
              {/* Notes Grid - scrollable content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-950">
                <div className="max-w-7xl mx-auto px-4 py-4">
                  <NotesGrid  
                    pinnedNotes={pinnedToShow}  
                    unpinnedNotes={unpinnedToShow}  
                    onEditNote={handleEditNote}  
                    hasNotes={hasNote}  
                    onDeleteNote={deleteNote}  
                    onTogglePin={togglePin}  
                    changeColor={changeColor} 
                    onLabelClick={handleLabelClick}
                  />

                  {/* Infinite scroll sentinel */}
                  <div ref={sentinelRef} className="py-8">
                    {loadingnotes && notes.length > 0 && (
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" size={22} />
                        <p className="text-sm text-gray-400 dark:text-gray-500">Loading more…</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </main>
          )}
        </div>
      </div>

      {/* MODALS */}
      {currentEditingNote && (
        <NoteEditModal  
          note={currentEditingNote.note}  
          initialPosition={currentEditingNote.position}  
          onClose={handleCloseModal}  
          onUpdate={updateNote}  
          onDelete={deleteNote}  
          onTogglePin={togglePin}  
          labels={labels}  
          onAddLabelToNote={handleAddLabelToNote}  
          onRemoveLabelFromNote={handleRemoveLabelFromNote}  
          onCreateLabel={createLabelhook} 
          canNavigateLeft={canNavigateLeft()}    
          canNavigateRight={canNavigateRight()}  
          onNavigateLeft={() => navigateToNote('left')}   
          onNavigateRight={() => navigateToNote('right')}
          onAddToProject={handleAddToProject} 
        />
      )}

      {showProjectSelector && (
        <ProjectSelectorModal
          projects={projects}
          currentProjectId={undefined}
          onSelectProject={handleConfirmAddToProject}
          onCreateProject={() => {
            setShowProjectSelector(null);
            setShowCreateProject(true);
          }}
          onClose={() => setShowProjectSelector(null)}
        />
      )}

      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreate={handleCreateProject}
        />
      )}
    </div>
  );
}