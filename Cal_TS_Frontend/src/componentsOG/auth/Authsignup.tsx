import { Loader } from 'lucide-react'
import React, { useState } from 'react'

interface AuthProps {
  onAuthSuccess: () => void;
}

const Authsignup = ({ onAuthSuccess }: AuthProps) => {

  const [email, setEmail] = useState('');
  const [firstname, setfirstname] = useState('');
  const [lastname, setlastname] = useState('');
  const [username, setusername] = useState('');
  const [password, setPassword] = useState('');
  const [signupError, setsignupError] = useState('');
  const [isSigningup, setIsSigningup] = useState(false);


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningup(true);
    setsignupError('');

    try {
    //   const formData = new FormData();
    //   formData.append('username', username);
    //   formData.append('password', password);
    //   formData.append('first_name', firstname);
    //   formData.append('last_name', lastname);
    //   formData.append('email', email);
    const payload = {
      username: username,
      password: password,
      first_name: firstname,
      last_name: lastname,
      email: email,
    };

      const res = await fetch('http://127.0.0.1:8004/api/v1/auth/signup', {
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
        setfirstname('');
        setlastname('');
        setusername('');
        onAuthSuccess();
      } else {const data = await res.json();
      
      // Handle FastAPI validation errors properly
      if (data.detail) {
        if (Array.isArray(data.detail)) {
          // Multiple validation errors
          const errorMessages = data.detail
            .map((err: any) => err.msg)
            .join(', ');
          setsignupError(errorMessages);
        } else {
          setsignupError(data.detail);
        }
      } else {
        setsignupError('Signup failed');
      }
    }
  } catch (err) {
    console.error('Signup error:', err);
    setsignupError('Network error occurred');
  } finally {
    setIsSigningup(false);
  }
  };


  return (
    <div>          
        <form onSubmit={handleSignup} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
                </label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" placeholder="your@email.com"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                username
                </label>
                    <input type="text" value={username} onChange={(e) => setusername(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" placeholder="your@email.com"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                firstName
                </label>
                    <input type="text" value={firstname} onChange={(e) => setfirstname(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" placeholder="your@email.com"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                LastName
                </label>
                    <input type="text" value={lastname} onChange={(e) => setlastname(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" placeholder="your@email.com"/>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all" placeholder="••••••••"/>
            </div>

            {signupError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-600">{signupError}</p>
              </div>
            )}

            <button type="submit" disabled={isSigningup} className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isSigningup ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Signing up...
                </>
              ) : (
                'Sign up'
              )}
            </button>
          </form>
          </div>
  )
}

export default Authsignup