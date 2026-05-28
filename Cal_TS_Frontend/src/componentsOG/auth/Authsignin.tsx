import { useState } from 'react';
import { LogIn, Loader, CalendarDays } from 'lucide-react';
import { useUserContext } from '../../context/AuthContext';

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Authsignin({ onAuthSuccess }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { checkAuthUser } = useUserContext();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, email }),
        credentials: 'include',
      });

      if (res.ok) {
        setEmail('');
        setPassword('');
        await checkAuthUser();
        onAuthSuccess();
      } else {
        const data = await res.json();
        if (data.detail) {
          setLoginError(
            Array.isArray(data.detail)
              ? data.detail.map((e: any) => e.msg).join(', ')
              : data.detail
          );
        } else {
          setLoginError('Login failed');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Network error — please check your connection.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Brand mark */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
            Calendar by Kla
          </span>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl shadow-blue-900/5 dark:shadow-black/30 border border-gray-100 dark:border-gray-800">
          <div className="flex justify-center mb-6">
            <div className="p-3.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">
              <LogIn className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 text-center mb-6">
            Welcome back
          </h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
              />
            </div>

            {loginError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3.5">
                <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-6 mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-6">
            Don't have an account?{' '}
            <a href="/sign-up" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
