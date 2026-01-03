import type {
  Project,
  ProjectsResponse,
  BrainstormResponse,
  SynthesizeResponse,
  BootstrapResponse,
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

export const api = {
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
};

export type { Project };
