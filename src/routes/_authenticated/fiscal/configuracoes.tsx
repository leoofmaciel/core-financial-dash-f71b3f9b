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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Settings as SettingsIcon, Copy, ShieldCheck, Upload, Loader2, CheckCircle2, AlertTriangle as AlertIcon } from "lucide-react";
import { callNotaas } from "@/lib/notaas.functions";

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
  cnae: string;
  item_lista_servico: string;
  regime_tributario: string;
  optante_simples_nacional: boolean;
  incentivador_cultural: boolean;
  regime_especial_tributacao: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cep: string;
  endereco_municipio: string;
  telefone: string;
  email: string;
};

const empty: Settings = {
  cnpj_emissor: "", razao_social: "", inscricao_municipal: "",
  codigo_municipio: "3550308", uf: "SP",
  ncm_padrao: "00000000", cfop_padrao: "5102",
  codigo_tributacao_municipio: "14.01", aliquota_iss: 5,
  iss_retido: false, natureza_operacao: "Venda",
  webhook_secret: "",
  cnae: "", item_lista_servico: "14.01",
  regime_tributario: "simples_nacional",
  optante_simples_nacional: true,
  incentivador_cultural: false,
  regime_especial_tributacao: "",
  endereco_logradouro: "", endereco_numero: "", endereco_complemento: "",
  endereco_bairro: "", endereco_cep: "", endereco_municipio: "",
  telefone: "", email: "",
};

function FiscalSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings>(empty);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPass, setCertPass] = useState("");
  const [certUploading, setCertUploading] = useState(false);
  const [certMeta, setCertMeta] = useState<{ path?: string | null; nome?: string | null; validade?: string | null; uploaded_at?: string | null; notaas_id?: string | null }>({});

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
    if (data) {
      setForm({ ...empty, ...(data as any) });
      const d: any = data;
      setCertMeta({
        path: d.certificado_path,
        nome: d.certificado_nome,
        validade: d.certificado_validade,
        uploaded_at: d.certificado_uploaded_at,
        notaas_id: d.certificado_notaas_id,
      });
    }
  }, [data]);

  const uploadCert = async () => {
    if (!certFile) return toast.error("Selecione o arquivo .pfx ou .p12");
    if (!certPass) return toast.error("Informe a senha do certificado");
    setCertUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = certFile.name.toLowerCase().endsWith(".p12") ? "p12" : "pfx";
      const path = `${user.id}/certificado.${ext}`;
      const up = await supabase.storage.from("certificates").upload(path, certFile, {
        upsert: true, contentType: "application/x-pkcs12",
      });
      if (up.error) throw up.error;
      // Save path + senha (RLS-protected) right away
      await supabase.from("fiscal_settings").upsert({
        user_id: user.id,
        certificado_path: path,
        certificado_nome: certFile.name,
        certificado_senha: certPass,
        certificado_uploaded_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
      // Send to Notaas
      const res: any = await callNotaas({ data: { action: "UPLOAD_CERTIFICADO", payload: { path, senha: certPass, cnpj: form.cnpj_emissor } } });
      toast.success("Certificado enviado à Notaas com sucesso!");
      setCertFile(null);
      setCertPass("");
      qc.invalidateQueries({ queryKey: ["fiscal_settings"] });
      if (res?.notaas?.validade) setCertMeta((m) => ({ ...m, validade: res.notaas.validade }));
    } catch (err: any) {
      toast.error(err.message || "Falha ao enviar certificado");
    } finally {
      setCertUploading(false);
    }
  };


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

  const missing: string[] = [];
  if (!form.cnpj_emissor) missing.push("CNPJ");
  if (!form.razao_social) missing.push("Razão social");
  if (!form.inscricao_municipal) missing.push("Inscrição municipal");
  if (!form.cnae) missing.push("CNAE");
  if (!form.item_lista_servico) missing.push("Item lista serviço");
  if (!form.endereco_logradouro || !form.endereco_numero || !form.endereco_bairro || !form.endereco_cep) missing.push("Endereço completo");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/fiscal"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-blue-600" /> Configurações Fiscais
          </h1>
          <p className="text-sm text-muted-foreground">
            Dados padrão usados ao emitir NFe e NFS-e. O certificado A1 é cadastrado no painel da Notaas.
          </p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="rounded-md border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Falta preencher:</strong> {missing.join(", ")}. Sem esses campos a emissão da NFS-e será rejeitada.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Emissor / Prestador</CardTitle>
          <CardDescription>Identificação da sua empresa nas notas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>CNPJ do Emissor *</Label>
            <Input value={form.cnpj_emissor} onChange={e => set("cnpj_emissor", e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-1">
            <Label>Razão Social *</Label>
            <Input value={form.razao_social} onChange={e => set("razao_social", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Inscrição Municipal *</Label>
            <Input value={form.inscricao_municipal} onChange={e => set("inscricao_municipal", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CNAE *</Label>
            <Input value={form.cnae} onChange={e => set("cnae", e.target.value)} placeholder="Ex: 6201501" />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endereço do Prestador</CardTitle>
          <CardDescription>Endereço completo usado nas notas emitidas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1 sm:col-span-4">
            <Label>Logradouro *</Label>
            <Input value={form.endereco_logradouro} onChange={e => set("endereco_logradouro", e.target.value)} placeholder="Rua, Av..." />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Número *</Label>
            <Input value={form.endereco_numero} onChange={e => set("endereco_numero", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Complemento</Label>
            <Input value={form.endereco_complemento} onChange={e => set("endereco_complemento", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Bairro *</Label>
            <Input value={form.endereco_bairro} onChange={e => set("endereco_bairro", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>CEP *</Label>
            <Input value={form.endereco_cep} onChange={e => set("endereco_cep", e.target.value)} placeholder="00000-000" />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label>Município</Label>
            <Input value={form.endereco_municipio} onChange={e => set("endereco_municipio", e.target.value)} placeholder="São Paulo" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Código IBGE Município *</Label>
            <Input value={form.codigo_municipio} onChange={e => set("codigo_municipio", e.target.value)} placeholder="3550308" />
          </div>
          <div className="space-y-1 sm:col-span-1">
            <Label>UF *</Label>
            <Input value={form.uf} onChange={e => set("uf", e.target.value.toUpperCase())} maxLength={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regime Tributário (NFS-e)</CardTitle>
          <CardDescription>Como sua empresa é tributada — usado em toda nota emitida.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Regime Tributário</Label>
            <Select value={form.regime_tributario} onValueChange={(v) => set("regime_tributario", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="simples_excesso">Simples – Excesso de Sublimite</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
                <SelectItem value="mei">MEI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Regime Especial Tributação</Label>
            <Select value={form.regime_especial_tributacao || "nenhum"} onValueChange={(v) => set("regime_especial_tributacao", v === "nenhum" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                <SelectItem value="microempresa_municipal">Microempresa Municipal</SelectItem>
                <SelectItem value="estimativa">Estimativa</SelectItem>
                <SelectItem value="sociedade_profissionais">Sociedade de Profissionais</SelectItem>
                <SelectItem value="cooperativa">Cooperativa</SelectItem>
                <SelectItem value="mei">MEI</SelectItem>
                <SelectItem value="me_epp">ME ou EPP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.optante_simples_nacional} onCheckedChange={v => set("optante_simples_nacional", v)} />
            <Label>Optante do Simples Nacional</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.incentivador_cultural} onCheckedChange={v => set("incentivador_cultural", v)} />
            <Label>Incentivador Cultural</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Padrões da NFS-e</CardTitle>
          <CardDescription>Valores aplicados automaticamente nas notas de serviço.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Item Lista Serviço (LC 116) *</Label>
            <Input value={form.item_lista_servico} onChange={e => set("item_lista_servico", e.target.value)} placeholder="Ex: 14.01" />
          </div>
          <div className="space-y-1">
            <Label>Cód. Tributação Municipal</Label>
            <Input value={form.codigo_tributacao_municipio} onChange={e => set("codigo_tributacao_municipio", e.target.value)} placeholder="Mesmo do item, se não houver outro" />
          </div>
          <div className="space-y-1">
            <Label>Alíquota ISS (%)</Label>
            <Input type="number" step="0.01" value={form.aliquota_iss} onChange={e => set("aliquota_iss", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Natureza da Operação</Label>
            <Input value={form.natureza_operacao} onChange={e => set("natureza_operacao", e.target.value)} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.iss_retido} onCheckedChange={v => set("iss_retido", v)} />
            <Label>ISS retido na fonte</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Padrões NFe (Produtos)</CardTitle>
          <CardDescription>Usado apenas se você emitir NFe de mercadoria.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>NCM padrão</Label>
            <Input value={form.ncm_padrao} onChange={e => set("ncm_padrao", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>CFOP padrão</Label>
            <Input value={form.cfop_padrao} onChange={e => set("cfop_padrao", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook de Status</CardTitle>
          <CardDescription>
            Configure esta URL no painel da Notaas para receber atualizações de status automaticamente.
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

      <div className="flex justify-end gap-2 sticky bottom-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading} size="lg" className="shadow-lg">
          <Save className="h-4 w-4 mr-1" />
          {save.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
