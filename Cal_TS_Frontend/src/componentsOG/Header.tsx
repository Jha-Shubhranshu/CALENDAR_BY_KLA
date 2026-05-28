import { Menu, Moon, Sun, Search, Settings, RefreshCw, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useUserContext } from '../context/AuthContext';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
}

export function Header({ searchQuery, onSearchChange, onToggleSidebar }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useUserContext();

  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700/60 shadow-sm">
      <div className="flex items-center justify-between h-full px-3 gap-3">

        {/* Left: hamburger + brand */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} className="text-gray-500 dark:text-gray-400" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white text-xs font-bold select-none">K</span>
            </div>
            <span className="hidden sm:block text-[15px] font-semibold tracking-tight text-gray-800 dark:text-gray-100">
              Calendar by Kla
            </span>
          </div>
        </div>

        {/* Center: search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 border border-transparent dark:border-gray-700/50 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white dark:focus:bg-gray-750 transition-all"
            />
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={18} className="text-gray-500 dark:text-gray-400" />
          </button>

          <button
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={18} className="text-gray-500 dark:text-gray-400" />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle dark mode"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark'
              ? <Sun size={18} className="text-amber-400" />
              : <Moon size={18} className="text-gray-500" />
            }
          </button>

          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 transition-all group shadow-sm"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="text-xs font-semibold tracking-wide uppercase">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
