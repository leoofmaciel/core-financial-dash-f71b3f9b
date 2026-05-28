import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Mail } from "lucide-react";
import { useGoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

function GoogleConnectButton({ onConnect, onDisconnect, connected }: { onConnect: (token: string) => void, onDisconnect: () => void, connected: boolean }) {
  const loginWithGoogle = useGoogleLogin({
    onSuccess: (tokenResponse) => onConnect(tokenResponse.access_token),
    onError: (error) => toast.error("Erro ao conectar ao Google: " + error),
    scope: "https://www.googleapis.com/auth/gmail.send",
  });

  if (connected) {
    return (
      <>
        <div className="flex items-center text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
          <Mail className="h-4 w-4 mr-2" /> Gmail Conectado
        </div>
        <Button variant="outline" size="sm" onClick={onDisconnect}>Desconectar</Button>
      </>
    );
  }

  return (
    <Button variant="outline" onClick={() => loginWithGoogle()}>
      <Mail className="h-4 w-4 mr-2" /> Conectar Gmail
    </Button>
  );
}

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const [form, setForm] = useState<any>({ company_name: "", cnpj: "", address: "", phone: "", email: "", logo_url: "" });
  const [uploading, setUploading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("google_client_id") || "" : "");
  const [gmailToken, setGmailToken] = useState(() => typeof window !== "undefined" ? localStorage.getItem("gmail_access_token") || "" : "");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setForm(data);
    })();
  }, []);

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { ...form, user_id: user.id };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    const { error } = await supabase.from("company_settings").upsert(payload, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    
    const currentClientId = localStorage.getItem("google_client_id") || "";
    if (googleClientId !== currentClientId) {
      localStorage.setItem("google_client_id", googleClientId);
      toast.success("Configurações salvas! Client ID atualizado.");
      return;
    }
    
    toast.success("Configurações salvas");
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
    const newForm = { ...form, logo_url: publicUrl };
    setForm(newForm);
    // Auto-save logo_url immediately so sidebar reflects it
    const payload = { ...newForm, user_id: user.id };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    await supabase.from("company_settings").upsert(payload, { onConflict: "user_id" });
    setUploading(false);
    toast.success("Logo atualizado com sucesso!");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da empresa que aparecem nos PDFs.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2 flex items-center gap-4">
            {form.logo_url && <img src={form.logo_url} alt="logo" className="h-20 w-20 object-contain rounded-lg border bg-white p-2" />}
            <div>
              <Label className="block mb-2">Logo</Label>
              <Button asChild variant="outline" disabled={uploading}>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : "Enviar logo"}
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                </label>
              </Button>
            </div>
          </div>
          <div className="space-y-2"><Label>Nome da empresa</Label><Input value={form.company_name || ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj || ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Integração com Gmail</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para enviar e-mails diretamente do sistema, você precisa criar um projeto no Google Cloud e gerar um <strong>Client ID</strong> com acesso à API do Gmail.
          </p>
          <div className="space-y-2">
            <Label>Google Client ID</Label>
            <Input 
              placeholder="Ex: 123456789-abcdef.apps.googleusercontent.com" 
              value={googleClientId} 
              onChange={(e) => setGoogleClientId(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Salve as configurações da página antes de conectar.</p>
          </div>
          
          {googleClientId && (
            <div className="pt-2 flex items-center gap-3">
              <GoogleOAuthProvider clientId={googleClientId.trim()}>
                <GoogleConnectButton 
                  connected={!!gmailToken}
                  onConnect={(token) => {
                    localStorage.setItem("gmail_access_token", token);
                    setGmailToken(token);
                    toast.success("Conectado ao Gmail com sucesso!");
                  }}
                  onDisconnect={() => {
                    localStorage.removeItem("gmail_access_token");
                    setGmailToken("");
                    toast.success("Desconectado do Gmail");
                  }}
                />
              </GoogleOAuthProvider>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Salvar configurações</Button>
      </div>
    </div>
  );
}
