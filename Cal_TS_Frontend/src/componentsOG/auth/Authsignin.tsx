import { useState } from 'react';
import { LogIn, Loader } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Authsignin({ onAuthSuccess }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      // const formData = new FormData();
      // formData.append('username', email);
      // formData.append('password', password);

      const payload = {
      password: password,
      email: email
    };



      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',  // Important!
        },
        body: JSON.stringify(payload),
        credentials: 'include', // Important: Include cookies
      });

      if (res.ok) {
        setEmail('');
        setPassword('');
        onAuthSuccess();
      } else {
        // const data = await res.json();
        // setLoginError(data.detail || 'Login failed');
        const data = await res.json();
      
      // Handle FastAPI validation errors properly
      if (data.detail) {
        if (Array.isArray(data.detail)) {
          // Multiple validation errors
          const errorMessages = data.detail
            .map((err: any) => err.msg)
            .join(', ');
          setLoginError(errorMessages);
        } else {
          setLoginError(data.detail);
        }
      } else {
        setLoginError('Signup failed');
      }
    }
    } catch (err) {
      console.error('Signup error:', err);
      setLoginError('Network error occurredddd');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-10 shadow-xl border border-slate-200">
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full">
              <LogIn className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          <h1 className="text-3xl font-semibold text-slate-800 text-center mb-8">
            Sign In
          </h1>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" placeholder="your@email.com"/>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" placeholder="••••••••"/>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-600">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}