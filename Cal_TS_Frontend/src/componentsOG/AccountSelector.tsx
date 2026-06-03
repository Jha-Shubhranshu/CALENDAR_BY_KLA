import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, X, Mail, Loader2, Check, Trash2 } from 'lucide-react';
import type { UserAccount } from '../hooksOG/useAccounts';

interface AccountSelectorProps {
  accounts: UserAccount[];
  selectedAccount: string | null;
  onSelect: (email: string | null) => void;
  onAdd: (email: string, label?: string) => Promise<UserAccount | null>;
  onRemove: (id: string) => Promise<void>;
  loading?: boolean;
}

export function AccountSelector({
  accounts,
  selectedAccount,
  onSelect,
  onAdd,
  onRemove,
  loading = false,
}: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setError(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when adding mode activates
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleAdd = async () => {
    const email = newEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onAdd(email);
    setSaving(false);
    if (result) {
      onSelect(result.email_address);
      setNewEmail('');
      setAdding(false);
      setOpen(false);
    } else {
      setError('Already exists or could not save');
    }
  };

  const displayLabel =
    selectedAccount
      ? selectedAccount
      : 'Select account email…';

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all
          ${selectedAccount
            ? 'border-blue-300 bg-blue-50 text-blue-800'
            : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
          }
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">{loading ? 'Loading…' : displayLabel}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Existing accounts */}
          <div className="max-h-52 overflow-y-auto">
            {/* No-account option */}
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                !selectedAccount ? 'bg-slate-50 font-medium text-slate-800' : 'text-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                !selectedAccount ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
              }`}>
                {!selectedAccount && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className="italic">No account (use export default)</span>
            </button>

            {accounts.map((acct) => (
              <div
                key={acct.id}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors group ${
                  selectedAccount === acct.email_address ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  onClick={() => { onSelect(acct.email_address); setOpen(false); }}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    selectedAccount === acct.email_address
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-slate-300'
                  }`}>
                    {selectedAccount === acct.email_address && (
                      <Check className="h-2.5 w-2.5 text-white" />
                    )}
                  </div>
                  <span className="truncate text-slate-800">{acct.email_address}</span>
                  {acct.label && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">
                      {acct.label}
                    </span>
                  )}
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await onRemove(acct.id);
                    if (selectedAccount === acct.email_address) onSelect(null);
                  }}
                  className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Remove account"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {accounts.length === 0 && !loading && (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">
                No saved accounts yet
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Add new */}
          {adding ? (
            <div className="p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setError(null); } }}
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
                <button
                  onClick={handleAdd}
                  disabled={saving || !newEmail.trim()}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => { setAdding(false); setNewEmail(''); setError(null); }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {error && <p className="text-xs text-red-500 mt-1.5 px-1">{error}</p>}
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add new account
            </button>
          )}
        </div>
      )}
    </div>
  );
}