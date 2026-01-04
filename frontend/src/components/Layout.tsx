import { Link, useLocation } from 'react-router-dom';
import { Factory, FolderOpen, Plus, Sparkles, Lightbulb } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { to: '/ideas', icon: Lightbulb, label: 'Ideas', color: 'text-amber-400' },
    { to: '/', icon: FolderOpen, label: 'Projects', color: '' },
    { to: '/new', icon: Plus, label: 'New Project', color: '' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <Factory className="w-6 h-6 text-indigo-400" />
            <span>Project Factory</span>
          </Link>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map(({ to, icon: Icon, label, color }) => {
              const isActive = location.pathname === to ||
                (to === '/ideas' && location.pathname.startsWith('/ideas'));
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${!isActive && color ? color : ''}`} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Sparkles className="w-4 h-4" />
            <span>Powered by AI</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-950 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
