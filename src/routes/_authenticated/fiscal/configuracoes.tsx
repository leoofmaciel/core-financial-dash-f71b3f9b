import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Save, Settings as SettingsIcon, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fiscal/configuracoes")({
  component: FiscalSettingsPage,
});

type Settings = {
  cnpj_emissor: string;
  razao_social: string;
  inscricao_municipal: string;
  codigo_municipio: string;
  uf: string;
  ncm_padrao: string;
  cfop_padrao: string;
  codigo_tributacao_municipio: string;
  aliquota_iss: number | string;
  iss_retido: boolean;
  natureza_operacao: string;
  webhook_secret: string;
};

const empty: Settings = {
  cnpj_emissor: "", razao_social: "", inscricao_municipal: "",
  codigo_municipio: "3550308", uf: "SP",
  ncm_padrao: "00000000", cfop_padrao: "5102",
  codigo_tributacao_municipio: "14.01", aliquota_iss: 5,
  iss_retido: false, natureza_operacao: "Venda",
  webhook_secret: "",
};

function FiscalSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(empty);

  const { data, isLoading } = useQuery({
    queryKey: ["fiscal_settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("fiscal_settings")
        .select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) setForm({ ...empty, ...(data as any) });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const payload = {
        ...form,
        user_id: user.id,
        aliquota_iss: Number(form.aliquota_iss) || 0,
      };
      const { error } = await supabase.from("fiscal_settings")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações fiscais salvas!");
      qc.invalidateQueries({ queryKey: ["fiscal_settings"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/notaas-webhook`
    : "/api/public/notaas-webhook";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/fiscal"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-blue-600" /> Configurações Fiscais
          </h1>
          <p className="text-sm text-muted-foreground">
            Dados padrão usados ao emitir NFe e NFS-e. O certificado A1 e os dados completos do emissor são cadastrados no painel da Notaas.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emissor</CardTitle>
          <CardDescription>Identificação básica usada nas notas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>CNPJ do Emissor</Label>
            <Input value={form.cnpj_emissor} onChange={e => set("cnpj_emissor", e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-1">
            <Label>Razão Social</Label>
            <Input value={form.razao_social} onChange={e => set("razao_social", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Inscrição Municipal</Label>
            <Input value={form.inscricao_municipal} onChange={e => set("inscricao_municipal", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>UF</Label>
            <Input value={form.uf} onChange={e => set("uf", e.target.value.toUpperCase())} maxLength={2} />
          </div>
          <div className="space-y-1">
            <Label>Código do Município (IBGE)</Label>
            <Input value={form.codigo_municipio} onChange={e => set("codigo_municipio", e.target.value)} placeholder="3550308 (São Paulo)" />
          </div>
          <div className="space-y-1">
            <Label>Natureza da Operação</Label>
            <Input value={form.natureza_operacao} onChange={e => set("natureza_operacao", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Padrões Tributários</CardTitle>
          <CardDescription>Valores aplicados quando você não informar manualmente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>NCM padrão (NFe)</Label>
            <Input value={form.ncm_padrao} onChange={e => set("ncm_padrao", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CFOP padrão (NFe)</Label>
            <Input value={form.cfop_padrao} onChange={e => set("cfop_padrao", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cód. Tributação Municipal (NFS-e)</Label>
            <Input value={form.codigo_tributacao_municipio} onChange={e => set("codigo_tributacao_municipio", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Alíquota ISS (%)</Label>
            <Input type="number" step="0.01" value={form.aliquota_iss} onChange={e => set("aliquota_iss", e.target.value)} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.iss_retido} onCheckedChange={v => set("iss_retido", v)} />
            <Label>ISS retido na fonte</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook de Status</CardTitle>
          <CardDescription>
            Configure esta URL no painel da Notaas (Configurações → Webhooks) para que o status das notas seja atualizado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                toast.success("URL copiada!");
              }}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <Separator />
          <div className="space-y-1">
            <Label>Webhook Secret (opcional)</Label>
            <Input value={form.webhook_secret} onChange={e => set("webhook_secret", e.target.value)} placeholder="Deixe vazio para aceitar sem validação" />
            <p className="text-xs text-muted-foreground">
              Se preenchido, o webhook só aceita requisições com o header <code className="font-mono">X-Webhook-Secret</code> igual a este valor.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
          <Save className="h-4 w-4 mr-1" />
          {save.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
