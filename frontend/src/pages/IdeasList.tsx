import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  Plus,
  ArrowRight,
  Trash2,
  StickyNote,
  Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import type { Idea } from '../api/types';

export function IdeasList() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickIdea, setQuickIdea] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchIdeas = async () => {
    try {
      setLoading(true);
      const response = await api.getIdeas();
      setIdeas(response.ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ideas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, []);

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickIdea.trim()) return;

    try {
      setCreating(true);
      const response = await api.createIdea({ idea_seed: quickIdea.trim() });
      setQuickIdea('');
      navigate(`/ideas/${response.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create idea');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this idea?')) return;

    try {
      await api.deleteIdea(id);
      setIdeas(ideas.filter((idea) => idea.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete idea');
    }
  };

  const getStatusBadge = (status: Idea['status']) => {
    const styles = {
      draft: 'bg-slate-700 text-slate-300',
      processing: 'bg-yellow-600 text-yellow-100',
      converted: 'bg-green-600 text-green-100',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-8 h-8 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Ideas</h1>
        </div>
        <Link
          to="/ideas/new"
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Idea
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Quick Capture */}
      <form onSubmit={handleQuickCapture} className="flex gap-3">
        <input
          type="text"
          value={quickIdea}
          onChange={(e) => setQuickIdea(e.target.value)}
          placeholder="Quick capture: type an idea and press Enter..."
          className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={creating || !quickIdea.trim()}
          className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {creating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          Capture
        </button>
      </form>

      {/* Ideas List */}
      {ideas.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No ideas yet. Capture your first idea above!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {ideas.map((idea) => (
            <Link
              key={idea.id}
              to={idea.status === 'converted' && idea.project_id ? `/projects/${idea.project_id}` : `/ideas/${idea.id}`}
              className="block p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-amber-500 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {idea.title && (
                      <h3 className="font-semibold text-white truncate">
                        {idea.title}
                      </h3>
                    )}
                    {getStatusBadge(idea.status)}
                  </div>
                  <p className="text-slate-300 text-sm line-clamp-2">
                    {idea.idea_seed}
                  </p>
                  {idea.notes && (
                    <div className="flex items-center gap-1 mt-2 text-slate-400 text-xs">
                      <StickyNote className="w-3 h-3" />
                      <span className="truncate">{idea.notes}</span>
                    </div>
                  )}
                  <p className="text-slate-500 text-xs mt-2">
                    {new Date(idea.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {idea.status === 'converted' && idea.project_id ? (
                    <span className="text-green-400 text-sm flex items-center gap-1">
                      <ArrowRight className="w-4 h-4" />
                      View Project
                    </span>
                  ) : (
                    <button
                      onClick={(e) => handleDelete(idea.id, e)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
