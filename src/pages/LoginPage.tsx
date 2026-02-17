import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Scissors } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const result = await login(email, password);
    if (!result.ok) {
      setError(result.error ?? "Falha no login.");
      setIsSubmitting(false);
      return;
    }

    setError("");
    setIsSubmitting(false);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(20 20% 12%), hsl(346 30% 18%), hsl(20 20% 10%))" }}>
      {/* Decorative circles */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, hsl(346 60% 55%), transparent)" }} />
      <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, hsl(38 70% 55%), transparent)" }} />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <Card className="w-full max-w-md border-border/30 bg-card/90 backdrop-blur-md shadow-2xl">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-lg">
              <Scissors className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="font-display text-2xl">Salão Danny Miranda</CardTitle>
            <p className="text-sm text-muted-foreground">Faça login para acessar o painel</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button className="w-full gradient-primary text-primary-foreground text-base py-5" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}