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
