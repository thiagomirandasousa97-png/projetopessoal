import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type AuthRole = "admin" | "professional";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
};

type AuthResult = { ok: boolean; error?: string };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): AuthUser | null {
  if (!sessionUser.id || !sessionUser.email) return null;

  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: String(sessionUser.user_metadata?.name ?? sessionUser.email.split("@")[0]),
    role: "admin",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;
      setUser(
        sessionUser
          ? toAuthUser({
              id: sessionUser.id,
              email: sessionUser.email,
              user_metadata: sessionUser.user_metadata,
            })
          : null,
      );
      setIsLoading(false);
    };

    void bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user;
      setUser(
        authUser
          ? toAuthUser({
              id: authUser.id,
              email: authUser.email,
              user_metadata: authUser.user_metadata,
            })
          : null,
      );
      setIsLoading(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: async (email: string, password: string) => {
        if (!email || !password) {
          return { ok: false, error: "Informe e-mail e senha para continuar." };
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },
      register: async (name: string, email: string, password: string) => {
        if (!name.trim() || !email.trim() || !password) {
          return { ok: false, error: "Preencha nome, e-mail e senha para criar a conta." };
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
          },
        });

        if (error) return { ok: false, error: error.message };
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
