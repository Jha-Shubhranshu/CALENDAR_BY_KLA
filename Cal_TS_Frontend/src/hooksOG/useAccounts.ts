import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface UserAccount {
  id: string;
  email_address: string;
  label: string | null;
  created_at: string;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounts`, {
        credentials: 'include',
      });
      if (res.ok) {
        setAccounts(await res.json());
      }
    } catch {
      // silent — accounts list is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const addAccount = useCallback(
    async (email: string, label?: string): Promise<UserAccount | null> => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/accounts`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_address: email, label: label || null }),
        });
        if (res.status === 409) return null; // duplicate
        if (!res.ok) return null;
        const created: UserAccount = await res.json();
        setAccounts((prev) => [...prev, created]);
        return created;
      } catch {
        return null;
      }
    },
    [],
  );

  const removeAccount = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/accounts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok || res.status === 204) {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // silent
    }
  }, []);

  return { accounts, loading, addAccount, removeAccount, refetch: fetchAccounts };
}