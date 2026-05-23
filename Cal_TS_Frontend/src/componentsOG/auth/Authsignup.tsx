import { Loader2, Eye, EyeOff, Check, CalendarDays, ShieldCheck, Sparkles } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'

interface AuthProps {
  onAuthSuccess: () => void;
}

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

const Authsignup = ({ onAuthSuccess }: AuthProps) => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstFieldRef.current?.focus(); }, []);

  const passwordStrength: PasswordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

    const map: Record<number, PasswordStrength> = {
      0: { score: 0, label: 'Too weak', color: 'bg-red-400' },
      1: { score: 1, label: 'Weak', color: 'bg-red-400' },
      2: { score: 2, label: 'Fair', color: 'bg-amber-400' },
      3: { score: 3, label: 'Good', color: 'bg-blue-400' },
      4: { score: 4, label: 'Strong', color: 'bg-emerald-500' },
    };
    return map[score];
  }, [password]);

  const isFormValid = email && username && firstName && lastName && password.length >= 8;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSigningUp) return;

    setIsSigningUp(true);
    setSignupError('');

    try {
      const payload = {
        username,
        password,
        first_name: firstName,
        last_name: lastName,
        email,
      };

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (res.ok) {
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setUsername('');
        onAuthSuccess();
      } else {
        const data = await res.json();
        if (data.detail) {
          if (Array.isArray(data.detail)) {
            const errorMessages = data.detail.map((err: any) => err.msg).join(', ');
            setSignupError(errorMessages);
          } else {
            setSignupError(data.detail);
          }
        } else {
          setSignupError('Signup failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Signup error:', err);
      setSignupError('Network error — please check your connection.');
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-blue-100/40 overflow-hidden grid lg:grid-cols-5">
        
        {/* Decorative panel — hidden on mobile, 2/5 width on desktop */}
        <div className="hidden lg:flex lg:col-span-2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-12 flex-col justify-between relative overflow-hidden">
          {/* Soft background shapes */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />

          <div className="relative z-10 flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg tracking-tight">CalendarByKla</span>
          </div>

          <div className="relative z-10 text-white space-y-6">
            <h1 className="text-3xl font-bold leading-tight">
              Stay on top of every day,<br />beautifully.
            </h1>
            <p className="text-blue-100/90 text-sm leading-relaxed">
              Plan, capture, and review your work with a calendar that connects everything.
            </p>
            <ul className="space-y-3 pt-2">
              {[
                { icon: Sparkles, text: 'Notes that link to your schedule' },
                { icon: ShieldCheck, text: 'Encrypted and private by default' },
                { icon: CalendarDays, text: 'One place for plans and reflections' },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-blue-50">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 text-blue-200/80 text-xs">
            © {new Date().getFullYear()} CalendarByKla
          </div>
        </div>

        {/* Form panel */}
        <div className="lg:col-span-3 p-8 sm:p-10 lg:p-12">
          <div className="max-w-md mx-auto">
            <div className="lg:hidden flex items-center gap-2 mb-8 text-blue-600">
              <CalendarDays className="w-5 h-5" />
              <span className="font-semibold">CalendarByKla</span>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Create your account
              </h2>
              <p className="text-slate-500 mt-2 text-sm">
                Get started in less than a minute. No credit card required.
              </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4" noValidate>
              {/* Name fields side-by-side */}
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="First name"
                  inputRef={firstFieldRef}
                  type="text"
                  value={firstName}
                  onChange={setFirstName}
                  placeholder="Shubham"
                  disabled={isSigningUp}
                  autoComplete="given-name"
                />
                <Field
                  label="Last name"
                  type="text"
                  value={lastName}
                  onChange={setLastName}
                  placeholder="Kumar"
                  disabled={isSigningUp}
                  autoComplete="family-name"
                />
              </div>

              <Field
                label="Username"
                type="text"
                value={username}
                onChange={setUsername}
                placeholder="shubhamk"
                disabled={isSigningUp}
                autoComplete="username"
              />

              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                disabled={isSigningUp}
                autoComplete="email"
              />

              {/* Password — needs custom rendering for toggle + strength */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSigningUp}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="w-full pl-4 pr-11 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            passwordStrength.score >= i ? passwordStrength.color : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500 w-14 text-right">
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {signupError && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-600 text-xs font-bold">!</span>
                  </div>
                  <p className="text-sm text-red-700">{signupError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!isFormValid || isSigningUp}
                className="w-full py-2.5 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-6"
              >
                {isSigningUp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-xs text-center text-slate-500 mt-6">
                By signing up, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:underline">Terms</a>
                {' '}and{' '}
                <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small reusable input component to keep the form readable
interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const Field = ({ label, type, value, onChange, placeholder, disabled, autoComplete, inputRef }: FieldProps) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      disabled={disabled}
      autoComplete={autoComplete}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
    />
  </div>
);

export default Authsignup;