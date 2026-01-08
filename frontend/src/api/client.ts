import type {
  Project,
  ProjectsResponse,
  BrainstormResponse,
  SynthesizeResponse,
  BootstrapResponse,
  Idea,
  IdeasResponse,
  IdeaDetailResponse,
  CreateIdeaResponse,
  ProcessIdeaResponse,
} from './types';

const API_BASE = 'https://project-factory.bill-burkey.workers.dev';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'API request failed');
  }

  return data as T;
}

export interface ProjectDetailResponse {
  ok: boolean;
  project: Project;
  docs: Record<string, string>;
}

export const api = {
  // Get single project with docs
  async getProject(project_id: string): Promise<ProjectDetailResponse> {
    return fetchApi<ProjectDetailResponse>(`/projects/${project_id}`);
  },

  // List projects
  async getProjects(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<ProjectsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return fetchApi<ProjectsResponse>(`/projects${query ? `?${query}` : ''}`);
  },

  // Brainstorm
  async brainstorm(data: {
    idea_seed: string;
    project_name: string;
    providers?: string[];
    project_id?: string;
  }): Promise<BrainstormResponse> {
    return fetchApi<BrainstormResponse>('/brainstorm', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        providers: data.providers || ['workers_ai', 'anthropic', 'openai', 'gemini', 'grok'],
      }),
    });
  },

  // Synthesize
  async synthesize(project_id: string): Promise<SynthesizeResponse> {
    return fetchApi<SynthesizeResponse>('/synthesize', {
      method: 'POST',
      body: JSON.stringify({ project_id }),
    });
  },

  // Bootstrap
  async bootstrap(project_id: string): Promise<BootstrapResponse> {
    return fetchApi<BootstrapResponse>('/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ project_id }),
    });
  },

  // Download tar.gz
  async download(project_id: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id }),
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return response.blob();
  },

  // Update project name
  async updateProject(
    project_id: string,
    data: { name: string }
  ): Promise<{ ok: boolean }> {
    return fetchApi<{ ok: boolean }>(`/projects/${project_id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Delete project
  async deleteProject(project_id: string): Promise<{ ok: boolean }> {
    return fetchApi<{ ok: boolean }>(`/projects/${project_id}`, {
      method: 'DELETE',
    });
  },

  // ============ Ideas (lightweight capture) ============

  // List ideas
  async getIdeas(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<IdeasResponse> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return fetchApi<IdeasResponse>(`/ideas${query ? `?${query}` : ''}`);
  },

  // Get single idea with context
  async getIdea(idea_id: string): Promise<IdeaDetailResponse> {
    return fetchApi<IdeaDetailResponse>(`/ideas/${idea_id}`);
  },

  // Create new idea (quick capture)
  async createIdea(data: {
    idea_seed: string;
    title?: string;
    notes?: string;
  }): Promise<CreateIdeaResponse> {
    return fetchApi<CreateIdeaResponse>('/ideas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Add context to an idea
  async addIdeaContext(
    idea_id: string,
    data: {
      kind: 'link' | 'note' | 'file' | 'screenshot';
      content: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ ok: boolean; id: string; kind: string }> {
    return fetchApi(`/ideas/${idea_id}/context`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Process idea into full project
  async processIdea(
    idea_id: string,
    data?: { providers?: string[]; constraints?: Record<string, unknown> }
  ): Promise<ProcessIdeaResponse> {
    return fetchApi<ProcessIdeaResponse>(`/ideas/${idea_id}/process`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  // Update idea
  async updateIdea(
    idea_id: string,
    data: { title?: string; idea_seed?: string; notes?: string }
  ): Promise<{ ok: boolean }> {
    return fetchApi<{ ok: boolean }>(`/ideas/${idea_id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Delete idea
  async deleteIdea(idea_id: string): Promise<{ ok: boolean }> {
    return fetchApi<{ ok: boolean }>(`/ideas/${idea_id}`, {
      method: 'DELETE',
    });
  },

  // ============ Project Implementor Integration ============

  // Build project - imports to project-implementor and starts first task
  async buildProject(project_id: string): Promise<{
    ok: boolean;
    project_id: string;
    name: string;
    task_id?: string;
    task_title?: string;
    session_id?: string;
    status: string;
    message?: string;
  }> {
    const IMPLEMENTOR_BASE = 'https://project-implementor.bill-burkey.workers.dev';
    const response = await fetch(`${IMPLEMENTOR_BASE}/build/${project_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || 'Build failed');
    }
    return data;
  },
};

export type { Project, Idea };
