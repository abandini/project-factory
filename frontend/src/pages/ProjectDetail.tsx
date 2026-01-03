import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../api/client';
import type { Project } from '../api/types';
import {
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  FileText,
  ArrowLeft,
  Pencil,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

const tabs = [
  { id: 'thesis', label: 'Thesis', file: 'THESIS.md' },
  { id: 'architecture', label: 'Architecture', file: 'ARCHITECTURE.md' },
  { id: 'gonogo', label: 'Go/No-Go', file: 'GO_NO_GO.md' },
  { id: 'tasks', label: 'Tasks', file: 'TASKS.md' },
];

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('thesis');
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [rerunning, setRerunning] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      // Get project from list (we'll need a single project endpoint later)
      const response = await api.getProjects({ limit: 100 });
      const found = response.projects.find((p) => p.id === id);

      if (!found) {
        setError('Project not found');
        return;
      }

      setProject(found);
      setEditName(found.name);

      // Download and extract docs if bootstrapped
      if (found.status === 'bootstrapped') {
        await loadDocs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  async function loadDocs() {
    if (!id) return;

    try {
      const blob = await api.download(id);
      // For now, we'll show a placeholder - full extraction would need a tar library
      // In a real app, you'd have a GET endpoint that returns the docs directly
      setDocs({
        thesis: 'Loading documentation...',
        architecture: 'Loading documentation...',
        gonogo: 'Loading documentation...',
        tasks: 'Loading documentation...',
      });

      // Try to extract using the blob
      // This is a simplified version - real implementation would parse the tar.gz
      const text = await blob.text().catch(() => '');
      if (text.includes('THESIS')) {
        setDocs({
          thesis: '# Project Documentation\n\nDownload the tar.gz to view full documentation.',
          architecture: '# Architecture\n\nDownload the tar.gz to view full documentation.',
          gonogo: '# Go/No-Go\n\nDownload the tar.gz to view full documentation.',
          tasks: '# Tasks\n\nDownload the tar.gz to view full documentation.',
        });
      }
    } catch {
      // Docs not available yet
    }
  }

  async function handleDownload() {
    if (!id) return;

    setDownloading(true);
    try {
      const blob = await api.download(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'project'}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!id) return;

    setDeleting(true);
    try {
      await api.deleteProject(id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveName() {
    if (!id || !editName.trim()) return;

    try {
      await api.updateProject(id, { name: editName });
      setProject((p) => (p ? { ...p, name: editName } : null));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleRerun(step: 'brainstorm' | 'synthesize' | 'bootstrap') {
    if (!id) return;

    setRerunning(step);
    try {
      if (step === 'brainstorm') {
        await api.brainstorm({
          idea_seed: project?.idea_seed || '',
          project_name: project?.name || '',
          project_id: id,
        });
      } else if (step === 'synthesize') {
        await api.synthesize(id);
      } else {
        await api.bootstrap(id);
      }
      await loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${step} failed`);
    } finally {
      setRerunning(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Projects
        </button>
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-300">{error || 'Project not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Projects
      </button>

      {/* Header */}
      <div className="bg-slate-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSaveName}
                  className="p-2 bg-green-600 hover:bg-green-700 rounded-lg"
                >
                  <Check className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditName(project.name);
                  }}
                  className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                <button
                  onClick={() => setEditing(true)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-slate-400 mt-2">{project.idea_seed}</p>
          </div>

          <div className="flex items-center gap-2">
            {project.status === 'bootstrapped' && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {downloading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                Download
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Delete
            </button>
          </div>
        </div>

        {/* Re-run Pipeline */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
          <span className="text-sm text-slate-400 mr-2">Re-run:</span>
          {['brainstorm', 'synthesize', 'bootstrap'].map((step) => (
            <button
              key={step}
              onClick={() => handleRerun(step as 'brainstorm' | 'synthesize' | 'bootstrap')}
              disabled={rerunning !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm text-white rounded-lg transition-colors"
            >
              {rerunning === step ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {step.charAt(0).toUpperCase() + step.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md mx-4">
            <h2 className="text-xl font-bold text-white mb-2">Delete Project?</h2>
            <p className="text-slate-400 mb-6">
              This will permanently delete "{project.name}" and all associated data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Docs Tabs */}
      {project.status === 'bootstrapped' && (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <div className="flex border-b border-slate-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-700 text-white border-b-2 border-indigo-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-750'
                }`}
              >
                <FileText className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 prose prose-invert max-w-none">
            <ReactMarkdown>{docs[activeTab] || 'No documentation available'}</ReactMarkdown>
          </div>
        </div>
      )}

      {project.status !== 'bootstrapped' && (
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Documentation Not Ready
          </h2>
          <p className="text-slate-400">
            Run the full pipeline to generate project documentation.
          </p>
        </div>
      )}
    </div>
  );
}
