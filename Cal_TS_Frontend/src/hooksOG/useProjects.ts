import { useState, useEffect, useCallback } from 'react';
import type { ProjectDisplay, ProjectWithMessages } from '../typesOG/project.types';
import { getAllProjects, createProject, updateProject, deleteProject } from '../api/projectsAPIAxios';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const { projects: fetchedProjects } = await getAllProjects();
      setProjects(fetchedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProjectHook = useCallback(async (data: {
    title: string;
    description?: string;
    color?: string;
  }) => {
    try {
      const newProject = await createProject(data);
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }, []);

  const updateProjectHook = useCallback(async (
    id: string, 
    data: { title?: string; description?: string; color?: string }
  ) => {
    try {
      const updated = await updateProject(id, data);
      setProjects(prev => prev.map(p => p.id === id ? updated : p));
      return updated;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }, []);

  const deleteProjectHook = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }, []);

  return {
    projects,
    loading,
    loadProjects,
    createProject: createProjectHook,
    updateProject: updateProjectHook,
    deleteProject: deleteProjectHook,
  };
}