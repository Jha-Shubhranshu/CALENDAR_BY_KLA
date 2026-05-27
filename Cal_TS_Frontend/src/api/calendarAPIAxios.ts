import axios from 'axios';

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/v1/calendar`;

export interface NotebookActivity {
  claude: { count: number; conversations: { id: string; title: string }[] };
  chatgpt: { count: number; conversations: { id: string; title: string }[] };
  notes: { count: number; note_ids: string[] };
}

export interface ProjectActivity {
  project_id: string;
  project_name: string;
  project_color: string;
  message_count: number;
  message_ids: string[];
}

export interface DateActivity {
  date: string; // ISO format YYYY-MM-DD
  notebooks: NotebookActivity;
  projects: ProjectActivity[];
}

export interface CalendarData {
  start_date: string;
  end_date: string;
  days: DateActivity[];
}

export async function getCalendarActivity(
  startDate: Date,
  endDate: Date,
  projectIds?: string[]
): Promise<CalendarData> {
  try {
    // ✅ FIX: Format dates as YYYY-MM-DD strings (local time, not UTC)
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const params: any = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };
    
    if (projectIds && projectIds.length > 0) {
      // ✅ FIX: Send as repeated query params (FastAPI List[UUID] expects this)
      params.project_ids = projectIds;
    }

    console.log('📅 Calendar API request:', { 
      url: `${BASE_URL}/activity`, 
      params,
      startDate,
      endDate,
      projectIds 
    });
    
    const res = await axios.get(`${BASE_URL}/activity`, {
      params,
      paramsSerializer: {
        // ✅ Send array params correctly for FastAPI
        indexes: null // This makes axios send: ?project_ids=uuid1&project_ids=uuid2
      },
      withCredentials: true,
    });
    
    console.log('✅ Calendar data response:', {
      status: res.status,
      headers: res.headers,
      contentType: res.headers['content-type'],
      data: res.data
    });

    if (typeof res.data === 'string' && res.data.trim().startsWith('<!doctype html>')) {
      console.error('❌ RECEIVED HTML INSTEAD OF JSON. This usually means CloudFront/S3 misrouting.');
    }

    return res.data;
  } catch (error) {
    console.error('❌ Failed to fetch calendar activity:', error);
    throw error;
  }
}



// Add this new function
export async function getProjectActivity(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<CalendarData> {
  try {
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const params = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    };

    console.log('📅 Project Calendar API request:', { 
      url: `${BASE_URL}/${projectId}/activity`, 
      params,
      projectId 
    });
    
    const res = await axios.get(`${BASE_URL}/${projectId}/activity`, {
      params,
      withCredentials: true,
    });
    
    console.log('✅ Project calendar data received:', res.data);
    return res.data;
  } catch (error) {
    console.error('❌ Failed to fetch project activity:', error);
    throw error;
  }
}