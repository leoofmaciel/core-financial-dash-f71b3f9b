import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFiscal } from "@/modules/fiscal/hooks/useFiscal";
import { ArrowLeft, Send, Factory, Briefcase, Search, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fiscal/nova")({
  component: NovaNotaFiscalPage,
});

function NovaNotaFiscalPage() {
  const navigate = useNavigate();
  const { emitirNFe, emitirNFSe } = useFiscal();
  const [tipo, setTipo] = useState<"nfe" | "nfse">("nfe");

  // Formulário Dummy para a UI
  const [form, setForm] = useState({
    cliente_nome: "",
    cpf_cnpj: "",
    valor: "",
    descricao: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tipo === "nfe") {
      emitirNFe.mutate({
        natureza_operacao: "Venda de Mercadoria",
        cliente: { cpf_cnpj: form.cpf_cnpj, razao_social: form.cliente_nome, endereco: { logradouro: "", numero: "", bairro: "", municipio: "", uf: "", cep: "" } },
        itens: [{ codigo: "01", descricao: form.descricao, ncm: "00000000", cfop: "5102", quantidade: 1, valor_unitario: Number(form.valor), impostos: { icms: { cst: "00", aliquota: 0 }, pis: { cst: "01", aliquota: 0 }, cofins: { cst: "01", aliquota: 0 } } }]
      });
    } else {
      emitirNFSe.mutate({
        servico: { codigo_tributacao_municipio: "14.01", discriminacao: form.descricao, codigo_municipio: "3550308", valor_servicos: Number(form.valor), iss_retido: false, aliquota: 2 },
        tomador: { cpf_cnpj: form.cpf_cnpj, razao_social: form.cliente_nome, endereco: { logradouro: "", numero: "", bairro: "", codigo_municipio: "", uf: "", cep: "" } }
      });
    }
  };

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
              <CardDescription>Busque um cliente cadastrado ou preencha o CNPJ para auto-completar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="flex gap-2 items-end">
                <div className="space-y-2 flex-1">
                  <Label>Buscar Cliente / Pedido</Label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Digite o nome do cliente ou número do pedido para puxar os dados..." />
                  </div>
                </div>
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

              {tipo === "nfe" && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-4">
                  <h4 className="font-semibold text-sm text-slate-700">Tributação Padrão (Simples Nacional)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><span className="text-slate-500 block">CFOP</span><span className="font-medium">5102 - Venda interna</span></div>
                    <div><span className="text-slate-500 block">NCM</span><span className="font-medium">Pendente preenchimento</span></div>
                    <div><span className="text-slate-500 block">ICMS (CSOSN)</span><span className="font-medium">102 - Sem permissão de crédito</span></div>
                    <div><span className="text-slate-500 block">PIS/COFINS</span><span className="font-medium">49 - Outras operações</span></div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={emitirNFe.isPending || emitirNFSe.isPending} className="w-full sm:w-auto">
                  {(emitirNFe.isPending || emitirNFSe.isPending) ? (
                    "Processando envio..."
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Emitir {tipo === "nfe" ? "NFe" : "NFS-e"}</>
                  )}
                </Button>
              </div>

            </CardContent>
          </form>
        </Card>
      </Tabs>
    </div>
  );
}
