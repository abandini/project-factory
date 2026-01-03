import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  Sparkles,
  Beaker,
  Package,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

const providers = [
  { id: 'workers_ai', name: 'Workers AI', color: 'bg-orange-500' },
  { id: 'anthropic', name: 'Anthropic', color: 'bg-purple-500' },
  { id: 'openai', name: 'OpenAI', color: 'bg-green-500' },
  { id: 'gemini', name: 'Gemini', color: 'bg-blue-500' },
  { id: 'grok', name: 'Grok', color: 'bg-red-500' },
];

type Step = 'input' | 'brainstorm' | 'synthesize' | 'bootstrap' | 'complete';

export function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('input');
  const [ideaSeed, setIdeaSeed] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(
    providers.map((p) => p.id)
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brainstormResults, setBrainstormResults] = useState<number>(0);

  function toggleProvider(id: string) {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function runBrainstorm() {
    if (!ideaSeed.trim() || !projectName.trim()) return;

    setLoading(true);
    setError(null);
    setStep('brainstorm');

    try {
      const response = await api.brainstorm({
        idea_seed: ideaSeed,
        project_name: projectName,
        providers: selectedProviders,
      });
      setProjectId(response.project_id);
      setBrainstormResults(response.results.length);
      setStep('synthesize');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Brainstorm failed');
      setStep('input');
    } finally {
      setLoading(false);
    }
  }

  async function runSynthesize() {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      await api.synthesize(projectId);
      setStep('bootstrap');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed');
    } finally {
      setLoading(false);
    }
  }

  async function runBootstrap() {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      await api.bootstrap(projectId);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bootstrap failed');
    } finally {
      setLoading(false);
    }
  }

  function viewProject() {
    if (projectId) {
      navigate(`/projects/${projectId}`);
    }
  }

  const steps = [
    { id: 'brainstorm', label: 'Brainstorm', icon: Sparkles },
    { id: 'synthesize', label: 'Synthesize', icon: Beaker },
    { id: 'bootstrap', label: 'Bootstrap', icon: Package },
  ];

  const stepIndex =
    step === 'input'
      ? -1
      : step === 'brainstorm'
      ? 0
      : step === 'synthesize'
      ? 1
      : step === 'bootstrap'
      ? 2
      : 3;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">New Project</h1>
      <p className="text-slate-400 mb-8">
        Turn your idea into a structured project with AI-powered analysis
      </p>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 bg-slate-800 rounded-xl p-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isComplete = stepIndex > i;
          const isCurrent = stepIndex === i;

          return (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  isComplete
                    ? 'bg-green-600 text-white'
                    : isCurrent
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isComplete ? (
                  <CheckCircle className="w-5 h-5" />
                ) : isCurrent && loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
                <span className="font-medium">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="w-5 h-5 text-slate-600 mx-2" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-300">{error}</span>
        </div>
      )}

      {/* Input Step */}
      {step === 'input' && (
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-awesome-project"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Idea Seed
            </label>
            <textarea
              value={ideaSeed}
              onChange={(e) => setIdeaSeed(e.target.value)}
              placeholder="Describe your project idea in detail..."
              rows={4}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              AI Providers
            </label>
            <div className="flex flex-wrap gap-2">
              {providers.map((provider) => {
                const isSelected = selectedProviders.includes(provider.id);
                return (
                  <button
                    key={provider.id}
                    onClick={() => toggleProvider(provider.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? `${provider.color} text-white`
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {provider.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={runBrainstorm}
            disabled={!ideaSeed.trim() || !projectName.trim() || selectedProviders.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Start Brainstorming
          </button>
        </div>
      )}

      {/* Synthesize Step */}
      {step === 'synthesize' && !loading && (
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Brainstorm Complete!
          </h2>
          <p className="text-slate-400 mb-6">
            {brainstormResults} AI providers contributed ideas. Ready to synthesize.
          </p>
          <button
            onClick={runSynthesize}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <Beaker className="w-5 h-5" />
            Run Synthesis
          </button>
        </div>
      )}

      {/* Bootstrap Step */}
      {step === 'bootstrap' && !loading && (
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Synthesis Complete!
          </h2>
          <p className="text-slate-400 mb-6">
            Project thesis, architecture, and tasks have been created. Ready to bootstrap.
          </p>
          <button
            onClick={runBootstrap}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <Package className="w-5 h-5" />
            Bootstrap Repo
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            {step === 'brainstorm' && 'Brainstorming with AI...'}
            {step === 'synthesize' && 'Synthesizing ideas...'}
            {step === 'bootstrap' && 'Bootstrapping repo...'}
          </h2>
          <p className="text-slate-400">This may take a minute</p>
        </div>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Project Ready!</h2>
          <p className="text-slate-400 mb-6">
            Your project has been created with all documentation.
          </p>
          <button
            onClick={viewProject}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            View Project
          </button>
        </div>
      )}
    </div>
  );
}
