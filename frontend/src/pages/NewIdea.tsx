import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Loader2 } from 'lucide-react';
import { api } from '../api/client';

export function NewIdea() {
  const navigate = useNavigate();
  const [ideaSeed, setIdeaSeed] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaSeed.trim()) return;

    try {
      setCreating(true);
      setError(null);
      const response = await api.createIdea({
        idea_seed: ideaSeed.trim(),
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      navigate(`/ideas/${response.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create idea');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/ideas"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <Lightbulb className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Capture New Idea</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your idea a name..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Idea <span className="text-red-400">*</span>
          </label>
          <textarea
            value={ideaSeed}
            onChange={(e) => setIdeaSeed(e.target.value)}
            placeholder="Describe your idea... What problem does it solve? Who is it for?"
            rows={4}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Initial Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context, constraints, or thoughts..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="flex justify-end gap-4">
          <Link
            to="/ideas"
            className="px-6 py-3 text-slate-300 hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={creating || !ideaSeed.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Lightbulb className="w-5 h-5" />
            )}
            Capture Idea
          </button>
        </div>
      </form>

      <div className="mt-8 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <h3 className="text-sm font-medium text-slate-300 mb-2">What happens next?</h3>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>1. Your idea is saved instantly</li>
          <li>2. Add links, notes, and resources over time</li>
          <li>3. When ready, process it into a full project with AI brainstorming</li>
        </ul>
      </div>
    </div>
  );
}
