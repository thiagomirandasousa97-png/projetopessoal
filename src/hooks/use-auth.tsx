import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AuthRole = "admin" | "professional";

export type AuthUser = {
  id: string;
  email: string;
  role: AuthRole;
};

type LoginResult = { ok: boolean; error?: string };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeRole(value: unknown): AuthRole | null {
  if (value === "admin") return "admin";
  if (value === "employee" || value === "professional") return "professional";
  return null;
}

async function getRoleFromDatabase(userId: string): Promise<AuthRole | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return normalizeRole(data?.role);
}

async function buildAuthUser(sessionUser: { id: string; email?: string | null }): Promise<AuthUser | null> {
  if (!sessionUser?.id || !sessionUser?.email) return null;

  const dbRole = await getRoleFromDatabase(sessionUser.id);
  if (!dbRole) return null;

  return {
    id: sessionUser.id,
    email: sessionUser.email,
    role: dbRole,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;

      if (sessionUser) {
        try {
          const authUser = await buildAuthUser({ id: sessionUser.id, email: sessionUser.email });
          setUser(authUser);
        } catch (error) {
          console.error("Erro ao carregar role inicial:", error);
          setUser(null);
        }
      }

      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const authUser = session?.user;

        if (!authUser) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        try {
          const enriched = await buildAuthUser({ id: authUser.id, email: authUser.email });
          if (!enriched) {
            await supabase.auth.signOut();
            setUser(null);
            setIsLoading(false);
            return;
          }

          setUser(enriched);
        } catch (error) {
          console.error("Erro ao resolver role do usuário:", error);
          await supabase.auth.signOut();
          setUser(null);
        }

        setIsLoading(false);
      });

      setIsLoading(false);
      return () => authListener.subscription.unsubscribe();
    };

    let cleanup: void | (() => void | Promise<void>);
    void bootstrap().then((c) => {
      cleanup = c;
    });

    return () => {
      if (cleanup) void cleanup();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: async (email: string, password: string) => {
        if (!email || !password) {
          return { ok: false, error: "Informe e-mail e senha para continuar." };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error || !data.user?.id || !data.user.email) {
          return { ok: false, error: error?.message ?? "Falha ao autenticar." };
        }

        const dbRole = await getRoleFromDatabase(data.user.id);
        if (!dbRole) {
          await supabase.auth.signOut();
          return { ok: false, error: "Usuário sem role em user_roles. Solicite liberação ao administrador." };
        }

        setUser({
          id: data.user.id,
          email: data.user.email,
          role: dbRole,
        });

        return { ok: true };
      },
      logout: async () => {
        await supabase.auth.signOut();
        setUser(null);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
}