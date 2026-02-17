import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { resetSystemState } from "@/services/systemResetService";

export default function SettingsPage() {
  const { user } = useAuth();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!user) return;
    if (!window.confirm("Isso vai apagar seus dados do sistema e limpar o estado local deste navegador. Continuar?")) {
      return;
    }

    setIsResetting(true);
    try {
      await resetSystemState(user.id);
      toast.success("Sistema resetado. Faça login novamente.");
    } catch (error) {
      console.error(error);
      toast.error("Falha ao resetar o sistema.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerenciamento de segurança e reset completo do estado do sistema."
      />

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Reset Completo do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta ação remove dados de `records` do usuário logado, limpa `localStorage`, `sessionStorage`,
            IndexedDB, cache offline e encerra a sessão atual.
          </p>

          <Button variant="destructive" onClick={() => void handleReset()} disabled={isResetting}>
            {isResetting ? "Resetando..." : "Resetar sistema"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
