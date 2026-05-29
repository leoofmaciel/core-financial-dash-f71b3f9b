import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useFiscal } from "@/modules/fiscal/hooks/useFiscal";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Factory, Briefcase, Search, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fiscal/nova")({
  component: NovaNotaFiscalPage,
});

function NovaNotaFiscalPage() {
  const navigate = useNavigate();
  const { emitirNFe, emitirNFSe } = useFiscal();
  const [tipo, setTipo] = useState<"nfe" | "nfse">("nfe");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<{ clients: any[]; orders: any[] }>({ clients: [], orders: [] });
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState({
    cliente_nome: "",
    cpf_cnpj: "",
    endereco: "",
    valor: "",
    descricao: "",
  });

  // Busca clientes e pedidos no Supabase
  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(async () => {
      setSearching(true);
      const term = `%${searchTerm}%`;
      const [c, o] = await Promise.all([
        supabase.from("clients")
          .select("id, name, company, cnpj, address, email, phone")
          .or(`name.ilike.${term},company.ilike.${term},cnpj.ilike.${term}`)
          .limit(10),
        searchTerm
          ? supabase.from("orders")
              .select("id, number, total, client_id, clients(name, company, cnpj, address)")
              .ilike("number::text", term).limit(10)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      setResults({ clients: c.data || [], orders: (o as any).data || [] });
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [searchTerm, searchOpen]);

  const pickClient = (c: any) => {
    setForm(f => ({
      ...f,
      cliente_nome: c.company || c.name || "",
      cpf_cnpj: c.cnpj || "",
      endereco: c.address || "",
    }));
    setSearchOpen(false);
  };

  const pickOrder = (o: any) => {
    const c = o.clients || {};
    setForm(f => ({
      ...f,
      cliente_nome: c.company || c.name || "",
      cpf_cnpj: c.cnpj || "",
      endereco: c.address || "",
      valor: String(o.total || ""),
      descricao: f.descricao || `Pedido #${o.number}`,
    }));
    setSearchOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tipo === "nfe") {
      emitirNFe.mutate({
        natureza_operacao: "Venda de Mercadoria",
        cliente: { cpf_cnpj: form.cpf_cnpj, razao_social: form.cliente_nome, endereco: { logradouro: form.endereco, numero: "", bairro: "", municipio: "", uf: "", cep: "" } },
        itens: [{ codigo: "01", descricao: form.descricao, ncm: "00000000", cfop: "5102", quantidade: 1, valor_unitario: Number(form.valor), impostos: { icms: { cst: "00", aliquota: 0 }, pis: { cst: "01", aliquota: 0 }, cofins: { cst: "01", aliquota: 0 } } }]
      }, { onSuccess: () => navigate({ to: "/fiscal" }) });
    } else {
      emitirNFSe.mutate({
        servico: { codigo_tributacao_municipio: "14.01", discriminacao: form.descricao, codigo_municipio: "3550308", valor_servicos: Number(form.valor), iss_retido: false, aliquota: 2 },
        tomador: { cpf_cnpj: form.cpf_cnpj, razao_social: form.cliente_nome, endereco: { logradouro: form.endereco, numero: "", bairro: "", codigo_municipio: "", uf: "", cep: "" } }
      }, { onSuccess: () => navigate({ to: "/fiscal" }) });
    }
  };

  const loading = emitirNFe.isPending || emitirNFSe.isPending;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/fiscal">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Emitir Nota Fiscal</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados abaixo para gerar a NFe ou NFS-e via Notaas.</p>
        </div>
      </div>

      <Tabs value={tipo} onValueChange={(v: any) => setTipo(v)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="nfe" className="flex gap-2"><Factory className="h-4 w-4" /> NFe (Produto)</TabsTrigger>
          <TabsTrigger value="nfse" className="flex gap-2"><Briefcase className="h-4 w-4" /> NFS-e (Serviço)</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Dados do Destinatário</CardTitle>
              <CardDescription>Busque um cliente ou pedido cadastrado para auto-preencher.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="space-y-2">
                <Label>Buscar Cliente / Pedido</Label>
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start text-muted-foreground font-normal">
                      <Search className="h-4 w-4 mr-2" />
                      Digite o nome do cliente, CNPJ ou número do pedido...
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razão Social / Nome Completo</Label>
                  <Input value={form.cliente_nome} onChange={e => setForm({...form, cliente_nome: e.target.value})} required placeholder="Ex: Indústria Metalúrgica SA" />
                </div>
                <div className="space-y-2">
                  <Label>CPF / CNPJ</Label>
                  <Input value={form.cpf_cnpj} onChange={e => setForm({...form, cpf_cnpj: e.target.value})} required placeholder="00.000.000/0001-00" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} placeholder="Rua, número, bairro, cidade/UF" />
                </div>
              </div>

              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">
                  {tipo === "nfe" ? "Itens da Nota (Produtos)" : "Detalhes do Serviço"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Descrição</Label>
                    <Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required placeholder={tipo === "nfe" ? "Ex: Peça em aço carbono..." : "Ex: Serviço de soldagem..."} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor Total (R$)</Label>
                    <Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required placeholder="0.00" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Emitir {tipo === "nfe" ? "NFe" : "NFS-e"}
                </Button>
              </div>

            </CardContent>
          </form>
        </Card>
      </Tabs>
    </div>
  );
}
