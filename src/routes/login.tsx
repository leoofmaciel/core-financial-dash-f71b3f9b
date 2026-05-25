import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate({ to: "/dashboard", replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message === "Invalid login credentials" ? "Credenciais inválidas" : error.message);
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
        <img src={logo} alt="RM Soluções" className="h-20 w-auto bg-white/95 rounded-xl p-3 self-start" />
        <div>
          <h1 className="text-4xl font-bold leading-tight">Gestão financeira<br />simples e profissional.</h1>
          <p className="mt-4 text-lg opacity-90 max-w-md">Controle suas entradas, saídas, orçamentos e relatórios em um único lugar.</p>
        </div>
        <p className="text-sm opacity-75">© {new Date().getFullYear()} RM Soluções em Usinagens</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <img src={logo} alt="RM" className="h-16 w-auto mx-auto mb-6 lg:hidden" />
          <h2 className="text-2xl font-bold">Entrar na sua conta</h2>
          <p className="text-sm text-muted-foreground mt-1">Bem-vindo de volta! Faça login para continuar.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueceu?</Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            Não tem conta?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
