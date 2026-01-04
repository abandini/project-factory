import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Lightbulb,
  ArrowLeft,
  Plus,
  Link as LinkIcon,
  StickyNote,
  Trash2,
  Play,
  Loader2,
  Edit3,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import type { Idea, IdeaContext } from '../api/types';

export function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [idea, setIdea] = useState<Idea | null>(null);
  const [context, setContext] = useState<IdeaContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showAddContext, setShowAddContext] = useState(false);
  const [contextKind, setContextKind] = useState<'link' | 'note'>('note');
  const [contextContent, setContextContent] = useState('');
  const [addingContext, setAddingContext] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Processing
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchIdea();
    }
  }, [id]);

  const fetchIdea = async () => {
    try {
      setLoading(true);
      const response = await api.getIdea(id!);
      setIdea(response.idea);
      setContext(response.context);
      setEditTitle(response.idea.title || '');
      setEditNotes(response.idea.notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load idea');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contextContent.trim()) return;

    try {
      setAddingContext(true);
      await api.addIdeaContext(id!, {
        kind: contextKind,
        content: contextContent.trim(),
      });
      setContextContent('');
      setShowAddContext(false);
      fetchIdea();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add context');
    } finally {
      setAddingContext(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateIdea(id!, {
        title: editTitle.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      setEditing(false);
      fetchIdea();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async () => {
    if (!confirm('Convert this idea to a full project and run brainstorming? This cannot be undone.')) {
      return;
    }

    try {
      setProcessing(true);
      const response = await api.processIdea(id!);
      navigate(`/projects/${response.project_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process idea');
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this idea and all its context?')) return;

    try {
      await api.deleteIdea(id!);
      navigate('/ideas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Idea not found</p>
        <Link to="/ideas" className="text-amber-400 hover:underline mt-2 inline-block">
          Back to Ideas
        </Link>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/ideas"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <Lightbulb className="w-6 h-6 text-amber-400" />
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Add a title..."
                className="text-xl font-bold bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            ) : (
              <h1 className="text-xl font-bold text-white">
                {idea.title || 'Untitled Idea'}
              </h1>
            )}
            {getStatusBadge(idea.status)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {idea.status === 'draft' && (
            <>
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-2 text-green-400 hover:bg-slate-800 rounded-lg"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleDelete}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Idea Content */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-sm font-medium text-slate-400 mb-2">Idea</h2>
        <p className="text-white text-lg">{idea.idea_seed}</p>

        {editing ? (
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-400">Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        ) : idea.notes ? (
          <div className="mt-4 p-3 bg-slate-900 rounded-lg">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <StickyNote className="w-4 h-4" />
              Notes
            </div>
            <p className="text-slate-300">{idea.notes}</p>
          </div>
        ) : null}

        <p className="text-slate-500 text-sm mt-4">
          Created: {new Date(idea.created_at).toLocaleString()}
        </p>
      </div>

      {/* Context Section */}
      {idea.status === 'draft' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Context & Resources</h2>
            <button
              onClick={() => setShowAddContext(!showAddContext)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {showAddContext && (
            <form onSubmit={handleAddContext} className="mb-4 p-4 bg-slate-900 rounded-lg">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setContextKind('note')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                    contextKind === 'note'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  <StickyNote className="w-4 h-4" />
                  Note
                </button>
                <button
                  type="button"
                  onClick={() => setContextKind('link')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                    contextKind === 'link'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  Link
                </button>
              </div>
              <textarea
                value={contextContent}
                onChange={(e) => setContextContent(e.target.value)}
                placeholder={contextKind === 'link' ? 'https://...' : 'Add a note...'}
                rows={2}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddContext(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingContext || !contextContent.trim()}
                  className="px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50"
                >
                  {addingContext ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                </button>
              </div>
            </form>
          )}

          {context.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No context added yet. Add links, notes, or resources to enrich your idea.
            </p>
          ) : (
            <div className="space-y-2">
              {context.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg"
                >
                  {item.kind === 'link' ? (
                    <LinkIcon className="w-4 h-4 text-blue-400 mt-0.5" />
                  ) : (
                    <StickyNote className="w-4 h-4 text-amber-400 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    {item.kind === 'link' ? (
                      <a
                        href={item.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {item.content}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <p className="text-slate-300">{item.content}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {idea.status === 'draft' && (
        <div className="flex justify-center">
          <button
            onClick={handleProcess}
            disabled={processing}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all shadow-lg disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Play className="w-6 h-6" />
            )}
            <span className="text-lg font-semibold">
              {processing ? 'Processing...' : 'Process into Project'}
            </span>
          </button>
        </div>
      )}

      {idea.status === 'converted' && idea.project_id && (
        <div className="text-center">
          <p className="text-slate-400 mb-4">This idea has been converted to a project.</p>
          <Link
            to={`/projects/${idea.project_id}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
          >
            View Project
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </Link>
        </div>
      )}
    </div>
  );
}
