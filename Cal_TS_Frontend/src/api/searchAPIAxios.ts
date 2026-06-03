import axios from "axios";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/v1/search`;

export interface SearchRequest {
  query: string;
  match_case: boolean;
  match_whole_word: boolean;
  use_regexp: boolean;
}

export interface MessageSearchResult {
  id: string;
  content: string;
  timestamp: string;
  role: string;
}

export interface ConversationSearchResult {
  id: string;
  title: string;
  messages: MessageSearchResult[];
}

export interface NoteSearchResult {
  id: string;
  title?: string;
  content: string;
  timestamp: string;
}

export interface SearchResponse {
  conversations: ConversationSearchResult[];
  notes: NoteSearchResult[];
}

export async function totalSearch(searchData: SearchRequest): Promise<SearchResponse> {
  try {
    const res = await axios.post(`${BASE_URL}/search`, searchData, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
    });
    return res.data;
  } catch (error) {
    console.error("❌ Search failed:", error);
    return { conversations: [], notes: [] };
  }
}
