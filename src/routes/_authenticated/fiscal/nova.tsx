import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useFiscal } from "@/modules/fiscal/hooks/useFiscal";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Factory, Briefcase, Search, Loader2, AlertTriangle, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fiscal/nova")({
  component: NovaNotaFiscalPage,
});

function NovaNotaFiscalPage() {
  const navigate = useNavigate();
  const { emitirNFe, emitirNFSe } = useFiscal();
  const [tipo, setTipo] = useState<"nfe" | "nfse">("nfse");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<{ clients: any[]; orders: any[] }>({ clients: [], orders: [] });
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const [form, setForm] = useState({
    cliente_nome: "",
    cpf_cnpj: "",
    email: "",
    valor: "",
    descricao: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cep: "",
    municipio: "",
    codigo_municipio: "",
    uf: "",
    inscricao_municipal: "",
    // NFS-e específicos
    item_lista_servico: "",
    codigo_tributacao_municipio: "",
    aliquota: "",
    iss_retido: false,
  });

  // Carrega configurações fiscais salvas
  const { data: settings } = useQuery({
    queryKey: ["fiscal_settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("fiscal_settings").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  // Aplica padrões da config fiscal
  useEffect(() => {
    if (!settings) return;
    setForm(f => ({
      ...f,
      item_lista_servico: f.item_lista_servico || (settings as any).item_lista_servico || (settings as any).codigo_tributacao_municipio || "14.01",
      codigo_tributacao_municipio: f.codigo_tributacao_municipio || (settings as any).codigo_tributacao_municipio || "",
      aliquota: f.aliquota || String((settings as any).aliquota_iss ?? 5),
      iss_retido: (settings as any).iss_retido ?? false,
    }));
  }, [settings]);

  const settingsMissing: string[] = [];
  if (settings) {
    const s: any = settings;
    if (!s.cnpj_emissor) settingsMissing.push("CNPJ");
    if (!s.razao_social) settingsMissing.push("Razão social");
    if (!s.inscricao_municipal) settingsMissing.push("Inscrição municipal");
    if (!s.cnae) settingsMissing.push("CNAE");
    if (!s.endereco_logradouro || !s.endereco_cep) settingsMissing.push("Endereço");
  }

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(async () => {
      setSearching(true);
      const term = `%${searchTerm}%`;
      const [c, o] = await Promise.all([
        supabase.from("clients")
          .select("*")
          .or(`name.ilike.${term},company.ilike.${term},cnpj.ilike.${term}`)
          .limit(10),
        searchTerm
          ? supabase.from("orders")
              .select("id, number, total, client_id, clients(*)")
              .ilike("number::text", term).limit(10)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      setResults({ clients: c.data || [], orders: (o as any).data || [] });
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [searchTerm, searchOpen]);

  const applyClient = (c: any) => {
    setSelectedClient(c);
    setForm(f => ({
      ...f,
      cliente_nome: c.company || c.name || "",
      cpf_cnpj: c.cnpj || c.cpf || "",
      email: c.email || "",
      logradouro: c.endereco_logradouro || c.address || "",
      numero: c.endereco_numero || "",
      complemento: c.endereco_complemento || "",
      bairro: c.endereco_bairro || "",
      cep: c.endereco_cep || "",
      municipio: c.endereco_municipio || "",
      codigo_municipio: c.codigo_municipio_ibge || (settings as any)?.codigo_municipio || "",
      uf: c.endereco_uf || (settings as any)?.uf || "",
      inscricao_municipal: c.inscricao_municipal || "",
    }));
  };

  const pickClient = (c: any) => { applyClient(c); setSearchOpen(false); };
  const pickOrder = (o: any) => {
    if (o.clients) applyClient(o.clients);
    setForm(f => ({
      ...f,
      valor: String(o.total || ""),
      descricao: f.descricao || `Pedido #${o.number}`,
    }));
    setSearchOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s: any = settings || {};
    if (tipo === "nfe") {
      emitirNFe.mutate({
        natureza_operacao: s.natureza_operacao || "Venda",
        cliente: {
          cpf_cnpj: form.cpf_cnpj,
          razao_social: form.cliente_nome,
          endereco: {
            logradouro: form.logradouro, numero: form.numero || "S/N",
            bairro: form.bairro, municipio: form.municipio,
            uf: form.uf, cep: form.cep,
          },
        },
        itens: [{
          codigo: "01", descricao: form.descricao,
          ncm: s.ncm_padrao || "00000000",
          cfop: s.cfop_padrao || "5102",
          quantidade: 1, valor_unitario: Number(form.valor),
          impostos: {
            icms: { cst: "00", aliquota: 0 },
            pis: { cst: "01", aliquota: 0 },
            cofins: { cst: "01", aliquota: 0 },
          },
        }],
      } as any, { onSuccess: () => navigate({ to: "/fiscal" }) });
    } else {
      emitirNFSe.mutate({
        prestador: {
          cnpj: s.cnpj_emissor,
          inscricao_municipal: s.inscricao_municipal,
        },
        servico: {
          codigo_tributacao_municipio: form.codigo_tributacao_municipio || form.item_lista_servico,
          item_lista_servico: form.item_lista_servico,
          codigo_cnae: s.cnae,
          discriminacao: form.descricao,
          codigo_municipio: form.codigo_municipio || s.codigo_municipio,
          valor_servicos: Number(form.valor),
          iss_retido: form.iss_retido,
          aliquota: Number(form.aliquota) / 100,
          natureza_operacao: s.natureza_operacao || "Tributação no município",
          regime_especial_tributacao: s.regime_especial_tributacao || undefined,
          optante_simples_nacional: s.optante_simples_nacional ?? true,
          incentivador_cultural: s.incentivador_cultural ?? false,
        },
        tomador: {
          cpf_cnpj: form.cpf_cnpj,
          razao_social: form.cliente_nome,
          email: form.email || undefined,
          inscricao_municipal: form.inscricao_municipal || undefined,
          endereco: {
            logradouro: form.logradouro,
            numero: form.numero || "S/N",
            complemento: form.complemento || undefined,
            bairro: form.bairro,
            codigo_municipio: form.codigo_municipio || s.codigo_municipio,
            uf: form.uf || s.uf,
            cep: form.cep,
          },
        },
      } as any, { onSuccess: () => navigate({ to: "/fiscal" }) });
    }
  };

  const loading = emitirNFe.isPending || emitirNFSe.isPending;

  const camposObrigatoriosFaltando: string[] = [];
  if (!form.cliente_nome) camposObrigatoriosFaltando.push("Nome/Razão");
  if (!form.cpf_cnpj) camposObrigatoriosFaltando.push("CPF/CNPJ");
  if (!form.valor) camposObrigatoriosFaltando.push("Valor");
  if (!form.descricao) camposObrigatoriosFaltando.push("Descrição");
  if (tipo === "nfse") {
    if (!form.cep) camposObrigatoriosFaltando.push("CEP do tomador");
    if (!form.logradouro) camposObrigatoriosFaltando.push("Endereço do tomador");
    if (!form.item_lista_servico) camposObrigatoriosFaltando.push("Item lista serviço");
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/fiscal">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Emitir Nota Fiscal</h1>
          <p className="text-sm text-muted-foreground">Dados do emissor vêm das configurações fiscais.</p>
        </div>
        <Link to="/fiscal/configuracoes"><Button variant="outline" size="sm"><SettingsIcon className="h-4 w-4 mr-1" /> Config</Button></Link>
      </div>

      {settingsMissing.length > 0 && (
        <div className="rounded-md border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Configurações fiscais incompletas:</strong> {settingsMissing.join(", ")}.{" "}
            <Link to="/fiscal/configuracoes" className="underline font-semibold">Completar agora →</Link>
          </div>
        </div>
      )}

      <Tabs value={tipo} onValueChange={(v: any) => setTipo(v)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="nfse" className="flex gap-2"><Briefcase className="h-4 w-4" /> NFS-e (Serviço)</TabsTrigger>
          <TabsTrigger value="nfe" className="flex gap-2"><Factory className="h-4 w-4" /> NFe (Produto)</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Dados do Tomador</CardTitle>
              <CardDescription>Busque um cliente ou pedido cadastrado para auto-preencher tudo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="space-y-2">
                <Label>Buscar Cliente / Pedido</Label>
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start text-muted-foreground font-normal">
                      <Search className="h-4 w-4 mr-2" />
                      Nome, CNPJ ou número do pedido...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[480px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Buscar..." value={searchTerm} onValueChange={setSearchTerm} />
                      <CommandList>
                        {searching && <div className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</div>}
                        {!searching && !results.clients.length && !results.orders.length && (
                          <CommandEmpty>Nenhum resultado.</CommandEmpty>
                        )}
                        {results.clients.length > 0 && (
                          <CommandGroup heading="Clientes">
                            {results.clients.map((c) => (
                              <CommandItem key={c.id} onSelect={() => pickClient(c)} className="cursor-pointer">
                                <div className="flex flex-col">
                                  <span className="font-medium">{c.company || c.name}</span>
                                  <span className="text-xs text-muted-foreground">{c.cnpj || "Sem CNPJ"}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {results.orders.length > 0 && (
                          <CommandGroup heading="Pedidos">
                            {results.orders.map((o: any) => (
                              <CommandItem key={o.id} onSelect={() => pickOrder(o)} className="cursor-pointer">
                                <div className="flex flex-col">
                                  <span className="font-medium">Pedido #{o.number} — {o.clients?.company || o.clients?.name || "—"}</span>
                                  <span className="text-xs text-muted-foreground">R$ {Number(o.total).toFixed(2)}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedClient && (
                  <p className="text-xs text-green-700">✓ {selectedClient.company || selectedClient.name} carregado</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Razão Social / Nome Completo *</Label>
                  <Input value={form.cliente_nome} onChange={e => setForm({...form, cliente_nome: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>CPF / CNPJ *</Label>
                  <Input value={form.cpf_cnpj} onChange={e => setForm({...form, cpf_cnpj: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>E-mail (recebe a nota)</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Inscrição Municipal (se PJ)</Label>
                  <Input value={form.inscricao_municipal} onChange={e => setForm({...form, inscricao_municipal: e.target.value})} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Endereço do Tomador</h3>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div className="space-y-1 md:col-span-4">
                    <Label>Logradouro *</Label>
                    <Input value={form.logradouro} onChange={e => setForm({...form, logradouro: e.target.value})} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Número *</Label>
                    <Input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Complemento</Label>
                    <Input value={form.complemento} onChange={e => setForm({...form, complemento: e.target.value})} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Bairro *</Label>
                    <Input value={form.bairro} onChange={e => setForm({...form, bairro: e.target.value})} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>CEP *</Label>
                    <Input value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} placeholder="00000-000" />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <Label>Município</Label>
                    <Input value={form.municipio} onChange={e => setForm({...form, municipio: e.target.value})} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Cód. IBGE *</Label>
                    <Input value={form.codigo_municipio} onChange={e => setForm({...form, codigo_municipio: e.target.value})} placeholder="3550308" />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label>UF *</Label>
                    <Input value={form.uf} onChange={e => setForm({...form, uf: e.target.value.toUpperCase()})} maxLength={2} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">{tipo === "nfse" ? "Detalhes do Serviço" : "Itens (Produto)"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1 md:col-span-3">
                    <Label>Descrição / Discriminação *</Label>
                    <Textarea rows={3} value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required placeholder={tipo === "nfse" ? "Detalhe o serviço prestado..." : "Descrição do produto..."} />
                  </div>
                  <div className="space-y-1">
                    <Label>Valor (R$) *</Label>
                    <Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required />
                  </div>
                  {tipo === "nfse" && (
                    <>
                      <div className="space-y-1">
                        <Label>Item Lista Serviço *</Label>
                        <Input value={form.item_lista_servico} onChange={e => setForm({...form, item_lista_servico: e.target.value})} required placeholder="14.01" />
                      </div>
                      <div className="space-y-1">
                        <Label>Alíquota ISS (%) *</Label>
                        <Input type="number" step="0.01" value={form.aliquota} onChange={e => setForm({...form, aliquota: e.target.value})} required />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {camposObrigatoriosFaltando.length > 0 && (
                <p className="text-xs text-amber-700">⚠ Faltando: {camposObrigatoriosFaltando.join(", ")}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" disabled={loading || settingsMissing.length > 0 || camposObrigatoriosFaltando.length > 0} size="lg">
                  {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Emitir {tipo === "nfse" ? "NFS-e" : "NFe"}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </Tabs>
    </div>
  );
}
