import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPage });

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de recuperação para seu e-mail.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md bg-card rounded-2xl p-8 border" style={{ boxShadow: "var(--shadow-elegant)" }}>
        <img src={logo} alt="RM" className="h-14 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-center">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">Informe seu e-mail e enviaremos um link.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>Enviar link</Button>
        </form>
        <p className="mt-6 text-sm text-center">
          <Link to="/login" className="text-primary hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}
