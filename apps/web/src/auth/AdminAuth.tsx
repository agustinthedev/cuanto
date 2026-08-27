import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AdminAuthContextValue {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;

    let active = true;
    const resolveAdmin = async (nextSession: Session | null) => {
      if (!nextSession) {
        if (active) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await client.rpc("is_admin");
      if (active) {
        setIsAdmin(!error && data === true);
        setLoading(false);
      }
    };

    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void resolveAdmin(data.session);
    });

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      window.setTimeout(() => void resolveAdmin(nextSession), 0);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error("La conexión con Supabase todavía no está configurada.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error("El email o la contraseña no son válidos.");

    const { data: admin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError || admin !== true) {
      await supabase.auth.signOut();
      throw new Error("Este usuario no tiene acceso al panel de administración.");
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  return <AdminAuthContext.Provider value={{ session, loading, isAdmin, signIn, signOut }}>{children}</AdminAuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth debe usarse dentro de AdminAuthProvider");
  return context;
}
