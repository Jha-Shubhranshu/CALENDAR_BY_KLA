import axios from 'axios';
import type { ProjectDisplay, ProjectWithMessages } from '../typesOG/project.types';

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/v1/projects`;

export async function getAllProjects(
  limit: number = 50,
  offset: number = 0
): Promise<{ projects: ProjectDisplay[], total: number }> {
  try {
    const res = await axios.get(`${BASE_URL}`, {
      params: { skip: offset, limit },
      withCredentials: true,
    });
    
    return {
      projects: res.data.projects || [],
      total: res.data.total || 0
    };
  } catch (error) {
    console.error('❌ Failed to fetch projects:', error);
    throw error;
  }
}

export async function getProject(id: string): Promise<ProjectWithMessages> {
  try {
    const res = await axios.get(`${BASE_URL}/${id}`, {
      withCredentials: true,
    });
    
    return res.data;
  } catch (error) {
    console.error('❌ Failed to fetch project:', error);
    throw error;
  }
}

export async function createProject(data: {
  title: string;
  description?: string;
  color?: string;
}): Promise<ProjectDisplay> {
  try {
    const res = await axios.post(`${BASE_URL}`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
    });
    
    console.log("✅ Project created:", res.data);
    return res.data;
  } catch (error) {
    console.error("❌ Project creation failed:", error);
    throw error;
  }
}

export async function updateProject(
  id: string, 
  data: { title?: string; description?: string; color?: string }
): Promise<ProjectDisplay> {
  try {
    const res = await axios.patch(`${BASE_URL}/${id}`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
    });
    
    console.log("✅ Project updated:", res.data);
    return res.data;
  } catch (error) {
    console.error("❌ Project update failed:", error);
    throw error;
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await axios.delete(`${BASE_URL}/${id}`, {
      withCredentials: true,
    });
    
    console.log("✅ Project deleted");
  } catch (error) {
    console.error("❌ Project deletion failed:", error);
    throw error;
  }
}

export async function addMessageToProject(
  projectId: string, 
  noteId: string
): Promise<void> {
  try {
    await axios.post(`${BASE_URL}/${projectId}/messages/${noteId}`, {}, {
      withCredentials: true,
    });
    
    console.log("✅ Message added to project");
  } catch (error) {
    console.error("❌ Failed to add message to project:", error);
    throw error;
  }
}



export async function removeMessageFromProject(
  projectId: string, 
  noteId: string
): Promise<void> {
  try {
    await axios.delete(`${BASE_URL}/${projectId}/messages/${noteId}`, {
      withCredentials: true,
    });
    
    console.log("✅ Message removed from project");
  } catch (error) {
    console.error("❌ Failed to remove message from project:", error);
    throw error;
  }
}