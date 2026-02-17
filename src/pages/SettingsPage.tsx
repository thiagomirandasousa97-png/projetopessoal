import { ChangeEvent, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_CONFIG, useAppConfig } from "@/lib/app-config";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsPage() {
  const { config, setConfig, reset } = useAppConfig();
  const { user } = useAuth();

  const [salonName, setSalonName] = useState(config.salonName);
  const [showSalonName, setShowSalonName] = useState(config.showSalonName);
  const [logoText, setLogoText] = useState(config.logoText);
  const [logoImageDataUrl, setLogoImageDataUrl] = useState(config.logoImageDataUrl);
  const [logoSizePx, setLogoSizePx] = useState(String(config.logoSizePx));
  const [textColor, setTextColor] = useState(config.textColor);
  const [backgroundColor, setBackgroundColor] = useState(config.backgroundColor);
  const [buttonColor, setButtonColor] = useState(config.buttonColor);
  const [isResetting, setIsResetting] = useState(false);

  const [resetAppointments, setResetAppointments] = useState(true);
  const [resetClients, setResetClients] = useState(true);
  const [resetServices, setResetServices] = useState(true);
  const [resetProfessionals, setResetProfessionals] = useState(true);
  const [resetFinance, setResetFinance] = useState(true);
  const [resetLocal, setResetLocal] = useState(true);

  const canResetRemote = useMemo(() => user?.role === "admin", [user?.role]);

  const onLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isAllowed = ["image/png", "image/jpeg"].includes(file.type);
    if (!isAllowed) {
      toast.error("Arquivo inválido. Use PNG ou JPG.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setLogoImageDataUrl(result);
        toast.success("Logo carregada com sucesso.");
      }
    };
    reader.readAsDataURL(file);
  };

  const saveBranding = () => {
    setConfig({
      salonName: salonName.trim(),
      showSalonName,
      logoText: logoText.trim().slice(0, 3) || "SD",
      logoImageDataUrl,
      logoSizePx: Math.max(28, Math.min(140, Number(logoSizePx) || 56)),
      textColor: textColor || DEFAULT_CONFIG.textColor,
      backgroundColor: backgroundColor || DEFAULT_CONFIG.backgroundColor,
      buttonColor: buttonColor || DEFAULT_CONFIG.buttonColor,
    });
    toast.success("Configurações visuais salvas.");
  };

  const redefineData = async () => {
    if (!user) return;

    if (!window.confirm("Tem certeza que deseja REDEFINIR os itens selecionados?")) return;
    if (!window.confirm("Última confirmação: deseja realmente continuar com a redefinição?")) return;

    setIsResetting(true);
    try {
      if (resetLocal) {
        await db.clearUserData(user.id);
      }

      if (canResetRemote) {
        const dummy = "00000000-0000-0000-0000-000000000000";
        if (resetAppointments) {
          const { error } = await supabase.from("appointments").delete().neq("id", dummy);
          if (error) throw error;
        }
        if (resetClients) {
          const { error } = await supabase.from("clients").delete().neq("id", dummy);
          if (error) throw error;
        }
        if (resetServices) {
          const { error } = await supabase.from("services").delete().neq("id", dummy);
          if (error) throw error;
        }
        if (resetProfessionals) {
          const { error } = await supabase.from("professionals").delete().neq("id", dummy);
          if (error) throw error;
        }
        if (resetFinance) {
          const { error: e1 } = await supabase.from("financial_receivables").delete().neq("id", dummy);
          if (e1) throw e1;
          const { error: e2 } = await supabase.from("financial_payables").delete().neq("id", dummy);
          if (e2) throw e2;
        }
      }

      if (resetProfessionals) {
        localStorage.removeItem("local-professionals");
      }

      toast.success("Redefinição concluída com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error("Falha ao redefinir dados.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Personalize layout, identidade visual e manutenção de dados." />

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display">Layout elegante (logo, nome e cores)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox id="show-name" checked={showSalonName} onCheckedChange={(value) => setShowSalonName(Boolean(value))} />
            <Label htmlFor="show-name">Mostrar nome no layout</Label>
          </div>

          <div>
            <Label htmlFor="salon-name">Nome do salão (pode deixar vazio para usar só a logo)</Label>
            <Input id="salon-name" placeholder="Ex: Salão Danny Miranda" value={salonName} onChange={(e) => setSalonName(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="logo-upload">Imagem da logo (PNG/JPG)</Label>
            <Input id="logo-upload" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={onLogoUpload} />
            <p className="text-xs text-muted-foreground mt-1">Obs: formatos aceitos: PNG/JPG. Tamanho recomendado: 512x512 px (mínimo 256x256 px), imagem quadrada.</p>
          </div>

          <div>
            <Label htmlFor="logo-size">Tamanho da logo no layout (px)</Label>
            <Input id="logo-size" type="number" min={28} max={140} value={logoSizePx} onChange={(e) => setLogoSizePx(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="logo-text">Fallback do logo (se não houver imagem)</Label>
            <Input id="logo-text" maxLength={3} value={logoText} onChange={(e) => setLogoText(e.target.value.toUpperCase())} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label htmlFor="text-color">Cor do texto</Label><Input id="text-color" type="color" className="h-10 p-1" value={textColor} onChange={(e) => setTextColor(e.target.value)} /></div>
            <div><Label htmlFor="bg-color">Cor de fundo</Label><Input id="bg-color" type="color" className="h-10 p-1" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} /></div>
            <div><Label htmlFor="btn-color">Cor dos botões</Label><Input id="btn-color" type="color" className="h-10 p-1" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} /></div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveBranding}>Salvar visual</Button>
            <Button variant="outline" onClick={() => {
              reset();
              setSalonName(DEFAULT_CONFIG.salonName);
              setShowSalonName(DEFAULT_CONFIG.showSalonName);
              setLogoText(DEFAULT_CONFIG.logoText);
              setLogoImageDataUrl(DEFAULT_CONFIG.logoImageDataUrl);
              setLogoSizePx(String(DEFAULT_CONFIG.logoSizePx));
              setTextColor(DEFAULT_CONFIG.textColor);
              setBackgroundColor(DEFAULT_CONFIG.backgroundColor);
              setButtonColor(DEFAULT_CONFIG.buttonColor);
            }}>Restaurar padrão</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display">Redefinir dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Escolha abaixo o que deseja redefinir. Ao confirmar, haverá 2 etapas de confirmação.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={resetAppointments} onCheckedChange={(v) => setResetAppointments(Boolean(v))} />Agendamentos</label>
            <label className="flex items-center gap-2"><Checkbox checked={resetClients} onCheckedChange={(v) => setResetClients(Boolean(v))} />Clientes</label>
            <label className="flex items-center gap-2"><Checkbox checked={resetServices} onCheckedChange={(v) => setResetServices(Boolean(v))} />Serviços</label>
            <label className="flex items-center gap-2"><Checkbox checked={resetProfessionals} onCheckedChange={(v) => setResetProfessionals(Boolean(v))} />Profissionais</label>
            <label className="flex items-center gap-2"><Checkbox checked={resetFinance} onCheckedChange={(v) => setResetFinance(Boolean(v))} />Financeiro</label>
            <label className="flex items-center gap-2"><Checkbox checked={resetLocal} onCheckedChange={(v) => setResetLocal(Boolean(v))} />Dados locais (IndexedDB)</label>
          </div>

          {!canResetRemote ? <p className="text-xs text-warning">Como profissional, a redefinição remota no Supabase é restrita. Só dados locais serão redefinidos.</p> : null}

          <Button variant="destructive" onClick={() => void redefineData()} disabled={isResetting}>{isResetting ? "Redefinindo..." : "Redefinir"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}