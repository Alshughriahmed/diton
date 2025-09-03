"use client";
import { useEffect, useState } from "react";
type User = { id?: string; email?: string; name?: string } & Record<string, any>;
export function useUser(): any {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/me").catch(() => null);
      const j: any = r && r.ok ? await r.json() : null;
      setUser(j?.user ?? j ?? null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refetch(); }, []);

  const signOut = async (..._a: any[]) => {};
  const signIn  = async (..._a: any[]) => {};

  const isLoggedIn = !!user;

  return { user, loading, error, isLoggedIn, refetch, signOut, signIn } as any;
}
export default useUser;
