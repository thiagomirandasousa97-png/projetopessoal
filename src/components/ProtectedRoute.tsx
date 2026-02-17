import { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export default function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando sessão...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
