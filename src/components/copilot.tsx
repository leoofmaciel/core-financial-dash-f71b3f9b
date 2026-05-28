import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Bot, User, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { generateBudgetPDF } from "@/lib/pdf";
import { logActivity } from "@/lib/logs";
import { cn } from "@/lib/utils";

type Client = { id: string; name: string; company: string | null; cnpj: string | null; email: string | null; phone: string | null };
type Item = { description: string; quantity: number; unit_price: number; total: number };

type Option = { label: string; action: string; data?: any; primary?: boolean };
type Message = {
  id: string;
  sender: "bot" | "user";
  text: string;
  options?: Option[];
};

type BotState = 
  | "IDLE"
  | "WAITING_CLIENT_SEARCH"
  | "SELECTING_CLIENT"
  | "WAITING_ITEM_DESC"
  | "WAITING_ITEM_PRICE"
  | "WAITING_ITEM_QTD"
  | "WAITING_MORE"
  | "CONCLUDING"
  | "FINISHED";

const initialMessage: Message = {
  id: "msg-1",
  sender: "bot",
  text: "Olá! Sou seu assistente de vendas. Como posso te ajudar hoje?",
  options: [{ label: "Criar Pedido Novo", action: "NEW_ORDER", primary: true }]
};

export function Copilot() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // State Machine Variables
  const [botState, setBotState] = useState<BotState>("IDLE");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<Item>>({});
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  const addMsg = (sender: "bot" | "user", text: string, options?: Option[]) => {
    setMessages((prev) => [...prev, { id: Math.random().toString(), sender, text, options }]);
  };

  const resetFlow = () => {
    setBotState("IDLE");
    setSelectedClient(null);
    setItems([]);
    setCurrentItem({});
    setCreatedOrderId(null);
    setMessages([initialMessage]);
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    addMsg("user", text.trim());
    
    // Process input based on current state
    if (botState === "IDLE") {
      if (text.toLowerCase().includes("pedido")) {
        return processOption({ label: "Criar Pedido Novo", action: "NEW_ORDER" });
      }
      addMsg("bot", "Desculpe, ainda estou aprendendo. Por favor, escolha uma das opções abaixo.", [{ label: "Criar Pedido Novo", action: "NEW_ORDER", primary: true }]);
      return;
    }

    if (botState === "WAITING_CLIENT_SEARCH") {
      setLoading(true);
      const { data } = await supabase
        .from("clients")
        .select("id, name, company, email, phone")
        .ilike("name", `%${text}%`)
        .limit(5);
      
      setLoading(false);
      if (!data || data.length === 0) {
        addMsg("bot", `Não encontrei nenhum cliente parecido com "${text}". Pode tentar outro nome?`);
      } else {
        const opts = data.map((c) => ({ label: c.name, action: "SELECT_CLIENT", data: c }));
        addMsg("bot", `Encontrei estes clientes. Qual deles é? (Selecione abaixo)`, opts);
        setBotState("SELECTING_CLIENT");
      }
      return;
    }

    if (botState === "SELECTING_CLIENT") {
      addMsg("bot", "Por favor, clique em um dos botões acima para selecionar o cliente.");
      return;
    }

    if (botState === "WAITING_ITEM_DESC") {
      setCurrentItem({ description: text.trim() });
      addMsg("bot", `Certo! Qual é o preço unitário de "${text.trim()}"? (Apenas números, ex: 150.50)`);
      setBotState("WAITING_ITEM_PRICE");
      return;
    }

    if (botState === "WAITING_ITEM_PRICE") {
      const priceStr = text.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
      const price = parseFloat(priceStr);
      if (isNaN(price)) {
        addMsg("bot", "Por favor, digite um preço válido (ex: 50.00 ou 150).");
        return;
      }
      setCurrentItem((prev) => ({ ...prev, unit_price: price }));
      addMsg("bot", `Qual é a quantidade?`);
      setBotState("WAITING_ITEM_QTD");
      return;
    }

    if (botState === "WAITING_ITEM_QTD") {
      const qtd = parseFloat(text.replace(",", "."));
      if (isNaN(qtd) || qtd <= 0) {
        addMsg("bot", "Por favor, digite uma quantidade válida maior que zero.");
        return;
      }
      const totalItem = (currentItem.unit_price || 0) * qtd;
      const newItem = { ...currentItem, quantity: qtd, total: totalItem } as Item;
      
      const nextItems = [...items, newItem];
      setItems(nextItems);
      setCurrentItem({});
      
      const totalGeral = nextItems.reduce((acc, curr) => acc + curr.total, 0);
      
      addMsg("bot", `Item adicionado! O total do pedido até agora é ${formatBRL(totalGeral)}.\n\nQuer adicionar mais algum item ou podemos concluir o pedido?`, [
        { label: "Adicionar mais um item", action: "ADD_MORE_ITEMS" },
        { label: "Concluir pedido", action: "CONCLUDE_ORDER", primary: true }
      ]);
      setBotState("WAITING_MORE");
      return;
    }

    if (botState === "WAITING_MORE") {
      if (text.toLowerCase().includes("mais") || text.toLowerCase().includes("sim")) {
        return processOption({ label: "Adicionar mais", action: "ADD_MORE_ITEMS" });
      }
      if (text.toLowerCase().includes("concluir") || text.toLowerCase().includes("não") || text.toLowerCase().includes("nao")) {
        return processOption({ label: "Concluir", action: "CONCLUDE_ORDER" });
      }
      addMsg("bot", "Escolha uma das opções clicando no botão abaixo.", [
        { label: "Adicionar mais um item", action: "ADD_MORE_ITEMS" },
        { label: "Concluir pedido", action: "CONCLUDE_ORDER", primary: true }
      ]);
      return;
    }
  };

  const processOption = async (opt: Option) => {
    // Hide buttons from previous messages visually
    setMessages(prev => prev.map(m => ({ ...m, options: undefined })));
    addMsg("user", opt.label);

    if (opt.action === "NEW_ORDER") {
      addMsg("bot", "Perfeito! Vamos criar um novo pedido.\nPrimeiro, qual é o nome do cliente?");
      setBotState("WAITING_CLIENT_SEARCH");
    }

    if (opt.action === "SELECT_CLIENT") {
      const c = opt.data as Client;
      setSelectedClient(c);
      addMsg("bot", `Cliente selecionado: **${c.name}**\n\nAgora, qual é o nome do item ou serviço que será feito?`);
      setBotState("WAITING_ITEM_DESC");
    }

    if (opt.action === "ADD_MORE_ITEMS") {
      addMsg("bot", `Qual é o nome do próximo item ou serviço?`);
      setBotState("WAITING_ITEM_DESC");
    }

    if (opt.action === "CONCLUDE_ORDER") {
      setBotState("CONCLUDING");
      addMsg("bot", "Entendido! Estou salvando o pedido no sistema, só um segundo...");
      setLoading(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não logado");
        
        const total = items.reduce((acc, curr) => acc + curr.total, 0);
        
        // 1. Create order
        const { data: o, error } = await supabase.from("orders").insert({
          user_id: user.id, client_id: selectedClient!.id, status: "rascunho", total,
        }).select().single();
        if (error) throw error;
        
        // 2. Create items
        const rows = items.map((i, idx) => ({
          order_id: o.id, description: i.description, quantity: i.quantity,
          unit_price: i.unit_price, total: i.total, position: idx,
        }));
        await supabase.from("order_items").insert(rows);
        
        await logActivity("create", "order", o.id, { total });
        qc.invalidateQueries({ queryKey: ["orders"] });
        
        setCreatedOrderId(o.id);
        
        addMsg("bot", `Sucesso! 🎉 O pedido #${String(o.number).padStart(5, "0")} foi salvo.\nO valor total ficou em ${formatBRL(total)}.\n\nO que você quer fazer agora?`, [
          { label: "Gerar PDF do Orçamento", action: "GENERATE_BUDGET", primary: true },
          { label: "Iniciar outro pedido", action: "RESET_FLOW" }
        ]);
        setBotState("FINISHED");
      } catch (err: any) {
        toast.error("Erro ao salvar: " + err.message);
        addMsg("bot", "Ops, ocorreu um erro ao salvar o pedido. Tente novamente.");
        setBotState("WAITING_MORE");
      } finally {
        setLoading(false);
      }
    }

    if (opt.action === "GENERATE_BUDGET") {
      if (!createdOrderId || !selectedClient) return;
      addMsg("bot", "Gerando o arquivo PDF, aguarde um instante...");
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não logado");
        
        const total = items.reduce((acc, curr) => acc + curr.total, 0);
        
        // Save as budget
        const { data: b, error } = await supabase.from("budgets").insert({
          user_id: user.id, order_id: createdOrderId,
          client_name: selectedClient.name, client_company: selectedClient.company, 
          client_phone: selectedClient.phone, client_email: selectedClient.email,
          total,
        }).select().single();
        if (error) throw error;
        
        const bi = items.map((i, idx) => ({
          budget_id: b.id, description: i.description, quantity: i.quantity,
          unit_price: i.unit_price, total: i.total, position: idx,
        }));
        await supabase.from("budget_items").insert(bi);
        await supabase.from("orders").update({ status: "orcamento" }).eq("id", createdOrderId);
        
        const { data: company } = await supabase.from("company_settings").select("*").eq("user_id", user.id).maybeSingle();
        await generateBudgetPDF({ ...b, items: bi } as any, company ?? {});
        await logActivity("generate_budget", "order", createdOrderId, { budget_id: b.id });
        
        addMsg("bot", "Orçamento PDF gerado e baixado no seu computador! 📄✅\nVocê pode ir até a aba Pedidos para enviar pelo WhatsApp.", [
          { label: "Novo Pedido", action: "RESET_FLOW", primary: true }
        ]);
      } catch (err: any) {
        toast.error("Erro ao gerar PDF: " + err.message);
        addMsg("bot", "Ops, ocorreu um erro ao gerar o PDF. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    if (opt.action === "RESET_FLOW") {
      resetFlow();
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); if (botState === "FINISHED") resetFlow(); }}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 transition-transform flex items-center justify-center group"
        aria-label="Abrir assistente"
      >
        <Sparkles className="h-6 w-6" />
        <span className="absolute right-full mr-3 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Assistente Virtual
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 border-l">
          <SheetHeader className="p-4 border-b bg-card shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col text-left">
                <SheetTitle className="text-base font-semibold">Assistente Financeiro</SheetTitle>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Online
                </span>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
            <div className="flex flex-col gap-4 pb-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex w-full", msg.sender === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("flex gap-2 max-w-[85%]", msg.sender === "user" ? "flex-row-reverse" : "flex-row")}>
                    
                    {/* Avatar */}
                    <div className="shrink-0 mt-auto">
                      {msg.sender === "bot" ? (
                        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                          <Bot className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Bubble */}
                    <div className="flex flex-col gap-1.5">
                      <div className={cn(
                        "px-3.5 py-2.5 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed",
                        msg.sender === "user" 
                          ? "bg-primary text-primary-foreground rounded-br-sm" 
                          : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-bl-sm"
                      )}>
                        {msg.text.split("**").map((part, i) => i % 2 !== 0 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>)}
                      </div>
                      
                      {/* Options */}
                      {msg.options && msg.options.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1">
                          {msg.options.map((opt, i) => (
                            <Button 
                              key={i} 
                              variant={opt.primary ? "default" : "outline"} 
                              className={cn("h-auto py-2 px-3 text-xs w-full justify-start text-left font-medium whitespace-normal border-primary/20", opt.primary ? "" : "bg-white dark:bg-slate-900 hover:bg-primary/5")}
                              onClick={() => processOption(opt)}
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex w-full justify-start">
                  <div className="flex gap-2 max-w-[85%]">
                    <div className="shrink-0 mt-auto">
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                        <Bot className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl rounded-bl-sm flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-3 bg-card border-t shrink-0">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
              className="flex gap-2 items-center"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 rounded-full px-4 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-visible:ring-primary/30"
                disabled={loading || botState === "CONCLUDING" || botState === "SELECTING_CLIENT"}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="rounded-full h-10 w-10 shrink-0 shadow-sm"
                disabled={!input.trim() || loading || botState === "CONCLUDING" || botState === "SELECTING_CLIENT"}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
