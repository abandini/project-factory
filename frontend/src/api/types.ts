export interface Project {
  id: string;
  name: string;
  idea_seed: string;
  status: 'created' | 'brainstormed' | 'synthesized' | 'bootstrapped';
  created_at: string;
  updated_at: string;
}

export interface ProjectsResponse {
  ok: boolean;
  projects: Project[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface BrainstormResult {
  provider: string;
  text: string;
  json: unknown;
}

export interface BrainstormResponse {
  ok: boolean;
  project_id: string;
  results: BrainstormResult[];
}

export interface SynthesizeResponse {
  ok: boolean;
  project_id: string;
  synthesized: {
    thesis: string;
    architecture: string;
    go_no_go: string;
    tasks: string;
  };
  provider: string;
}

export interface BootstrapResponse {
  ok: boolean;
  project_id: string;
  stored: Array<{ path: string; r2_key: string; bytes: number }>;
  provider: string;
}

export interface ApiError {
  ok: false;
  error: string;
}

// Ideas (lightweight capture)
export interface Idea {
  id: string;
  user_id: string;
  title: string | null;
  idea_seed: string;
  notes: string | null;
  status: 'draft' | 'processing' | 'converted';
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdeaContext {
  id: string;
  kind: 'link' | 'note' | 'file' | 'screenshot';
  content: string;
  metadata_json: string | null;
  created_at: string;
}

export interface IdeasResponse {
  ok: boolean;
  ideas: Idea[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface IdeaDetailResponse {
  ok: boolean;
  idea: Idea;
  context: IdeaContext[];
}

export interface CreateIdeaResponse {
  ok: boolean;
  id: string;
  status: string;
}

export interface ProcessIdeaResponse {
  ok: boolean;
  idea_id: string;
  project_id: string;
  status: string;
  message: string;
}
