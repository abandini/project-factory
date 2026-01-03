import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Project } from '../api/types';
import {
  Folder,
  ChevronRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Beaker,
  Package,
  Filter,
} from 'lucide-react';

const statusConfig = {
  created: { label: 'Created', color: 'bg-slate-600', icon: Folder },
  brainstormed: { label: 'Brainstormed', color: 'bg-amber-600', icon: Sparkles },
  synthesized: { label: 'Synthesized', color: 'bg-blue-600', icon: Beaker },
  bootstrapped: { label: 'Bootstrapped', color: 'bg-green-600', icon: Package },
};

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadProjects();
  }, [statusFilter]);

  async function loadProjects() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getProjects({
        status: statusFilter || undefined,
        limit: 50,
      });
      setProjects(response.projects);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <p className="text-slate-400 mt-1">{total} project{total !== 1 ? 's' : ''} total</p>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="created">Created</option>
            <option value="brainstormed">Brainstormed</option>
            <option value="synthesized">Synthesized</option>
            <option value="bootstrapped">Bootstrapped</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-300">{error}</span>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="text-center py-12">
          <Folder className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No projects yet</h2>
          <p className="text-slate-400 mb-6">Create your first project to get started</p>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            New Project
          </Link>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="grid gap-4">
          {projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.created;
            const StatusIcon = status.icon;

            return (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500 rounded-xl p-5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {project.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${status.color}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm line-clamp-2 mb-2">
                      {project.idea_seed}
                    </p>
                    <p className="text-slate-500 text-xs">
                      Created {formatDate(project.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors flex-shrink-0 ml-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
