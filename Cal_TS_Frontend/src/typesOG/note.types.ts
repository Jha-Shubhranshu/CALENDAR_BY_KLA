export interface Note {
  title?: string;
  content: string;
  labels?: LabelDisplay[];
  is_pinned?: boolean;
  background_color?: string;
  project_id?: string;
  is_archived?: boolean;
  is_categorized?: boolean;
}

export interface NoteCardDisplay {
  id: string;
  title: string;
  content: string;
  labels?: LabelDisplay[];
  timestamp: Date
  createdAt: number;
  updated_at: Date;
  is_pinned?: boolean;
  background_color?: string;
  user_id?: string;
  role: string;
  conversation_id?: string;
  project_id?: string;
  content_type: 'text';
  is_archived?: boolean;
  is_categorized?: boolean;
  parent_message_id?: string;
  metadata: Record<string, any>;
}


export interface NoteCreate {
  id: string;
  title: string;
  content: string;
  timestamp:Date;
  
}


export interface DateFilter {
  field: 'created_at' | 'updated_at' | 'timestamp';
  before?: Date;
  after?: Date;
}


//---------------------------Label----------------------



export interface LabelToBe {
  name: string;
  background_color: string;
}
export interface LabelDisplay {
  id: string;
  name: string;
  background_color: string;
  createdAt: number;
  updated_at: number;
  user_id?: string;
  note_count?: number;

}






//---------------------------- context----------------



export type INavLink = {
  route: string;
  label: string;
};

export type IUpdateUser = {
  uId: string;
  first_name: string;
  last_name: string; 
};

export type IUser = {
  id: string;
  first_name: string;
  last_name: string;  
  username: string;
  email: string;
  is_verified: boolean;
};

export type INewUser = {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
};


export const INITIAL_USER = {
  id: "", // Changed from id to uid to match your backend
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  is_verified: false,
};




export const INITIAL_STATE = {
  user: INITIAL_USER,
  isLoading: false,
  isAuthenticated: false,
  setUser: () => {},
  setIsAuthenticated: () => {},
  checkAuthUser: async () => false as boolean,
  logout: () => {},
};


export type IContextType = {
  user: IUser;                          //this block of code is used for maintaining authentication status across the project, but IUser here is the schema for the term user in context, Why isn't it a type?
  isLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<IUser>>;
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  checkAuthUser: () => Promise<boolean>;
  logout: () => void;
};