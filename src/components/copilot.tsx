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
  | "FINISHED"
  | "CONFIRM_NEW_CLIENT"
  | "ASK_MORE_DATA"
  | "WAITING_NEW_CLIENT_PHONE"
  | "WAITING_NEW_CLIENT_EMAIL"
  | "WAITING_NEW_CLIENT_DOC"
  | "WAITING_TX_DESC"
  | "WAITING_TX_VALUE"
  | "SELECTING_TX_CATEGORY"
  | "WAITING_NEW_CATEGORY_NAME"
  | "WAITING_TX_DUE_DATE"
  | "WAITING_PAYMENT_SEARCH"
  | "SELECTING_PENDING_PAYMENT"
  | "SELECTING_PENDING_BUDGET"
  | "WAITING_REC_TYPE"
  | "WAITING_REC_NAME"
  | "WAITING_REC_VALUE"
  | "SELECTING_REC_CATEGORY"
  | "WAITING_REC_NEW_CATEGORY"
  | "WAITING_REC_FREQ"
  | "WAITING_REC_NEXT_RUN";

const initialMessage: Message = {
  id: "msg-1",
  sender: "bot",
  text: "Olá! Sou seu Assistente Financeiro. Escolha uma das tarefas abaixo ou digite o que precisa:",
  options: [
    { label: "Novo Pedido", action: "NEW_ORDER" },
    { label: "Nova Movimentação", action: "NEW_TRANSACTION" },
    { label: "Adicionar Recorrência", action: "NEW_RECURRENCE" },
    { label: "Aprovar Orçamento", action: "APPROVE_BUDGET" },
    { label: "Resumo do Mês", action: "MONTH_SUMMARY" }
  ]
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
  const [draftClientName, setDraftClientName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<Item>>({});
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  
  // Extra states
  const [draftTx, setDraftTx] = useState<{type?: string, name?: string, value?: number, category_id?: string, status?: string, due_date?: string}>({});

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
    setDraftClientName("");
    setItems([]);
    setCurrentItem({});
    setCreatedOrderId(null);
    setMessages([initialMessage]);
  };

  const updateClientDB = async (payload: any) => {
    if (!selectedClient) return;
    try {
      await supabase.from("clients").update(payload).eq("id", selectedClient.id);
      setSelectedClient((prev) => prev ? { ...prev, ...payload } : null);
    } catch (e) {}
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    addMsg("user", text.trim());
    
    // Check for cancel keywords
    const lowerText = text.trim().toLowerCase();
    const cancelWords = ["cancelar", "cancela", "sair", "sai", "parar", "para", "abortar", "aborta", "desistir", "desiste", "voltar", "volta", "inicio", "início", "menu"];
    if (cancelWords.includes(lowerText)) {
      addMsg("bot", "Operação cancelada! Voltando ao menu inicial. Como mais posso te ajudar?", initialMessage.options);
      setBotState("IDLE");
      setSelectedClient(null);
      setDraftClientName("");
      setDraftTx({});
      setItems([]);
      setCurrentItem({});
      setCreatedOrderId(null);
      return;
    }
    
    // Process input based on current state
    if (botState === "IDLE") {
      const lower = text.toLowerCase();
      if (lower.includes("pedido") || lower.includes("orçamento")) return processOption({ label: "Criar Pedido Novo", action: "NEW_ORDER" });
      if (lower.includes("despesa") || lower.includes("conta") || lower.includes("receita") || lower.includes("movimentação") || lower.includes("movimentacao")) return processOption({ label: "Nova Movimentação", action: "NEW_TRANSACTION" });
      if (lower.includes("recorrência") || lower.includes("recorrencia") || lower.includes("fixa")) return processOption({ label: "Adicionar Recorrência", action: "NEW_RECURRENCE" });
      if (lower.includes("aprovar") || lower.includes("orçamento")) return processOption({ label: "Aprovar Orçamento", action: "APPROVE_BUDGET" });
      if (lower.includes("resumo") || lower.includes("mês")) return processOption({ label: "Resumo do Mês", action: "MONTH_SUMMARY" });
      
      addMsg("bot", "Desculpe, não entendi bem. Por favor, escolha uma das opções abaixo.", initialMessage.options);
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
        setDraftClientName(text);
        addMsg("bot", `Não encontrei nenhum cliente com o nome "${text}". Gostaria de cadastrar como um novo cliente?`, [
          { label: "Sim, cadastrar novo", action: "CREATE_CLIENT_YES", primary: true },
          { label: "Não, buscar outro nome", action: "CREATE_CLIENT_NO" }
        ]);
        setBotState("CONFIRM_NEW_CLIENT");
      } else {
        setDraftClientName(text);
        const opts = data.map((c) => ({ label: c.name, action: "SELECT_CLIENT", data: c }));
        opts.push({ label: "Nenhum desses (Criar novo)", action: "CREATE_CLIENT_YES" });
        addMsg("bot", `Encontrei estes clientes. Qual deles é? (Selecione abaixo)`, opts);
        setBotState("SELECTING_CLIENT");
      }
      return;
    }

    if (botState === "WAITING_NEW_CLIENT_PHONE") {
      if (text.toLowerCase() !== "pular" && text.toLowerCase() !== "não" && text.toLowerCase() !== "nao") {
        await updateClientDB({ phone: text });
      }
      addMsg("bot", `E qual é o e-mail? (ou digite "pular")`);
      setBotState("WAITING_NEW_CLIENT_EMAIL");
      return;
    }

    if (botState === "WAITING_NEW_CLIENT_EMAIL") {
      if (text.toLowerCase() !== "pular" && text.toLowerCase() !== "não" && text.toLowerCase() !== "nao") {
        await updateClientDB({ email: text });
      }
      addMsg("bot", `Para finalizar os dados dele, qual é o CPF ou CNPJ? (ou digite "pular")`);
      setBotState("WAITING_NEW_CLIENT_DOC");
      return;
    }

    if (botState === "WAITING_NEW_CLIENT_DOC") {
      if (text.toLowerCase() !== "pular" && text.toLowerCase() !== "não" && text.toLowerCase() !== "nao") {
        await updateClientDB({ cnpj: text });
      }
      addMsg("bot", `Perfeito! Dados do cliente salvos.\n\nAgora sim: qual é o nome do item ou serviço que será feito no pedido?`);
      setBotState("WAITING_ITEM_DESC");
      return;
    }

    if (botState === "SELECTING_CLIENT" || botState === "CONFIRM_NEW_CLIENT" || botState === "ASK_MORE_DATA" || botState === "SELECTING_TX_CATEGORY" || botState === "SELECTING_PENDING_PAYMENT" || botState === "SELECTING_PENDING_BUDGET") {
      addMsg("bot", "Por favor, clique em um dos botões acima para continuar.");
      return;
    }

    if (botState === "SELECTING_TX_CATEGORY") {
      addMsg("bot", "Por favor, clique em uma das opções acima ou digite 'cancelar'.");
      return;
    }

    if (botState === "WAITING_REC_NAME") {
      const capText = text.trim().charAt(0).toUpperCase() + text.trim().slice(1);
      setDraftTx(prev => ({ ...prev, name: capText }));
      addMsg("bot", `Certo! Qual é o valor dessa recorrência ("${capText}")? (Apenas números, ex: 150.50)`);
      setBotState("WAITING_REC_VALUE");
      return;
    }

    if (botState === "WAITING_REC_VALUE") {
      const val = parseFloat(text.replace(",", "."));
      if (isNaN(val)) {
        addMsg("bot", "Valor inválido. Digite apenas números (ex: 150.50 ou 150,50):");
        return;
      }
      setDraftTx(prev => ({ ...prev, value: val }));
      
      setLoading(true);
      const currentType = draftTx.type || "saida";
      const { data } = await supabase.from("categories").select("*").eq("icon", currentType).order("name");
      setLoading(false);
      
      const opts = (data || []).map((c: any) => ({ label: c.name, action: "SELECT_REC_CATEGORY", data: c.id }));
      opts.push({ label: "➕ Criar Nova", action: "CREATE_NEW_REC_CATEGORY" });
      
      addMsg("bot", `Valor anotado: ${formatBRL(val)}. Agora, selecione a categoria dessa recorrência:`, opts);
      setBotState("SELECTING_REC_CATEGORY");
      return;
    }

    if (botState === "WAITING_REC_NEW_CATEGORY") {
      const capText = text.trim().charAt(0).toUpperCase() + text.trim().slice(1);
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sem usuário");
        const catType = draftTx.type || "saida";
        const catColor = catType === "entrada" ? "#22c55e" : "#ef4444";
        const { data: newCat, error } = await supabase.from("categories").insert({
          user_id: user.id, name: capText, color: catColor, icon: catType
        }).select().single();
        if (error) throw error;
        
        qc.invalidateQueries({ queryKey: ["categories"] });
        setDraftTx(prev => ({ ...prev, category_id: newCat.id }));
        addMsg("bot", `Categoria **${capText}** criada e selecionada!\n\nQual é a frequência de pagamento dessa recorrência?`, [
           { label: "Mensal", action: "SELECT_REC_FREQ", data: "mensal" },
           { label: "Semanal", action: "SELECT_REC_FREQ", data: "semanal" },
           { label: "Anual", action: "SELECT_REC_FREQ", data: "anual" }
        ]);
        setBotState("WAITING_REC_FREQ"); 
      } catch (e) {
        addMsg("bot", "Erro ao criar categoria. Tente outro nome.");
      } finally {
        setLoading(false);
      }
      return;
    }
    
    if (botState === "WAITING_REC_NEXT_RUN") {
      let dateStr = "";
      const lower = text.toLowerCase();
      const today = new Date();
      if (lower.includes("hoje")) {
        dateStr = today.toISOString().split("T")[0];
      } else if (lower.includes("amanhã") || lower.includes("amanha")) {
        const t = new Date(today); t.setDate(t.getDate() + 1);
        dateStr = t.toISOString().split("T")[0];
      } else {
        const parts = text.split("/");
        if (parts.length >= 2) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const y = parts[2] ? parseInt(parts[2], 10) : today.getFullYear();
          if (!isNaN(d) && !isNaN(m)) {
            const finalY = y < 100 ? 2000 + y : y;
            const t = new Date(finalY, m - 1, d);
            dateStr = t.toISOString().split("T")[0];
          }
        }
      }
      
      if (!dateStr) {
        addMsg("bot", "Data inválida. Tente 'hoje', 'amanhã' ou 'DD/MM':");
        return;
      }
      
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");
        const { error } = await supabase.from("recurrences").insert({
          user_id: user.id,
          type: draftTx.type as "entrada" | "saida",
          name: draftTx.name || "Recorrência",
          amount: draftTx.value || 0,
          category_id: draftTx.category_id || null,
          frequency: draftTx.status || "mensal", // We temporarily stored frequency in 'status'
          next_run: dateStr,
          active: true
        });
        if (error) throw error;
        
        qc.invalidateQueries({ queryKey: ["recurrences"] });
        addMsg("bot", `Recorrência **${draftTx.name}** registrada com sucesso para começar em ${dateStr}!`, [
           { label: "Voltar ao Menu Inicial", action: "BACK_TO_MENU" }
        ]);
        setBotState("FINISHED");
      } catch (err: any) {
        addMsg("bot", "Ocorreu um erro ao registrar a recorrência: " + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (botState === "WAITING_TX_DESC") {
      const capText = text.trim().charAt(0).toUpperCase() + text.trim().slice(1);
      setDraftTx(prev => ({ ...prev, name: capText }));
      addMsg("bot", `Certo! Qual é o valor dessa movimentação ("${capText}")? (Apenas números, ex: 150.50)`);
      setBotState("WAITING_TX_VALUE");
      return;
    }

    if (botState === "WAITING_TX_VALUE") {
      const valStr = text.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
      const val = parseFloat(valStr);
      if (isNaN(val) || val <= 0) return addMsg("bot", "Por favor, digite um valor numérico válido.");
      
      setDraftTx(prev => ({ ...prev, value: val }));
      
      setLoading(true);
      const currentType = draftTx.type || "saida";
      const { data } = await supabase.from("categories").select("*").eq("icon", currentType).order("name");
      setLoading(false);
      
      const opts = (data || []).map((c: any) => ({ label: c.name, action: "SELECT_TX_CATEGORY", data: c.id }));
      opts.push({ label: "➕ Criar Nova", action: "CREATE_NEW_CATEGORY" });
      opts.push({ label: "Sem categoria", action: "SELECT_TX_CATEGORY" });
      addMsg("bot", `Qual é a categoria? (Selecione abaixo)`, opts);
      setBotState("SELECTING_TX_CATEGORY");
      return;
    }

    if (botState === "WAITING_NEW_CATEGORY_NAME") {
      const capText = text.trim().charAt(0).toUpperCase() + text.trim().slice(1);
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sem usuário");
        const { data: newCat, error } = await supabase.from("categories").insert({
          user_id: user.id, name: capText, color: "#3b82f6", icon: draftTx.type || "saida"
        }).select().single();
        if (error) throw error;
        
        qc.invalidateQueries({ queryKey: ["categories"] });
        setDraftTx(prev => ({ ...prev, category_id: newCat.id }));
        addMsg("bot", `Categoria **${capText}** criada e selecionada!\n\nAgora, qual é o status atual dessa movimentação?`, [
           { label: "Já está Paga / Recebida", action: "SELECT_TX_STATUS", data: "pago", primary: true },
           { label: "Pendente (A vencer)", action: "SELECT_TX_STATUS", data: "pendente" }
        ]);
        setBotState("SELECTING_TX_CATEGORY"); // We reuse SELECTING_TX_CATEGORY to block text input, while waiting for SELECT_TX_STATUS click
      } catch (e) {
        addMsg("bot", "Erro ao criar categoria. Tente outro nome.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (botState === "WAITING_TX_DUE_DATE") {
      let dateIso = new Date().toISOString().split("T")[0];
      const lText = text.toLowerCase();
      if (lText.includes("amanhã") || lText.includes("amanha")) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateIso = tomorrow.toISOString().split("T")[0];
      } else if (text.includes("/")) {
        const parts = text.split("/");
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        let y = parts.length === 3 ? parseInt(parts[2]) : new Date().getFullYear();
        if (y < 100) y += 2000;
        if (!isNaN(d) && !isNaN(m)) {
           dateIso = new Date(y, m, d).toISOString().split("T")[0];
        }
      }

      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sem usuário");
        const { error } = await supabase.from("transactions").insert({
          user_id: user.id, name: draftTx.name!, type: draftTx.type || "saida",
          amount: draftTx.value!, category_id: draftTx.category_id || null,
          status: draftTx.status || "pendente", 
          transaction_date: draftTx.status === "pago" ? new Date().toISOString().split("T")[0] : null,
          due_date: dateIso
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        addMsg("bot", `Pronto! 🎉 A movimentação **${draftTx.name}** no valor de ${formatBRL(draftTx.value!)} foi salva no seu financeiro!`, [{ label: "Fazer mais alguma coisa", action: "RESET_FLOW", primary: true }]);
        setBotState("FINISHED");
      } catch (e) {
        addMsg("bot", "Erro ao salvar a movimentação. Tente novamente.");
        setBotState("FINISHED");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (botState === "WAITING_PAYMENT_SEARCH") {
      setLoading(true);
      const { data } = await supabase.from("transactions")
        .select("*")
        .eq("type", "entrada")
        .neq("status", "pago")
        .ilike("name", `%${text}%`)
        .order("created_at", { ascending: false })
        .limit(5);
      setLoading(false);

      if (!data || data.length === 0) {
        addMsg("bot", `Não encontrei nenhuma conta a receber pendente com o termo "${text}". Pode tentar outro nome de cliente ou número de pedido?`);
      } else {
        const opts = data.map((tx: any) => ({ 
          label: `${tx.name} - ${formatBRL(tx.amount)}`, 
          action: "CONFIRM_PAYMENT", 
          data: tx 
        }));
        addMsg("bot", `Encontrei estas contas pendentes. Qual delas o cliente pagou?`, opts);
        setBotState("SELECTING_PENDING_PAYMENT");
      }
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

    if (opt.action === "NEW_TRANSACTION") {
      addMsg("bot", "Vamos registrar uma nova movimentação. Ela é uma Entrada (recebimento) ou uma Saída (despesa)?", [
        { label: "Entrada (Receita)", action: "SELECT_TX_TYPE", data: "entrada", primary: true },
        { label: "Saída (Despesa)", action: "SELECT_TX_TYPE", data: "saida" }
      ]);
    }
    
    if (opt.action === "SELECT_TX_TYPE") {
      const txType = opt.data;
      setDraftTx({ type: txType });
      addMsg("bot", `Ok, será uma **${txType === 'entrada' ? 'Entrada' : 'Saída'}**.\nQual é a descrição ou nome dessa movimentação?`);
      setBotState("WAITING_TX_DESC");
    }

    if (opt.action === "SELECT_TX_CATEGORY") {
      setDraftTx(prev => ({ ...prev, category_id: opt.data }));
      addMsg("bot", "Qual é o status atual dessa movimentação?", [
         { label: "Já está Paga / Recebida", action: "SELECT_TX_STATUS", data: "pago", primary: true },
         { label: "Pendente (A vencer)", action: "SELECT_TX_STATUS", data: "pendente" }
      ]);
    }

    if (opt.action === "CREATE_NEW_CATEGORY") {
      addMsg("bot", "Certo, digite o nome para a nova categoria:");
      setBotState("WAITING_NEW_CATEGORY_NAME");
    }

    if (opt.action === "SELECT_TX_STATUS") {
      setDraftTx(prev => ({ ...prev, status: opt.data }));
      addMsg("bot", "Qual é a data de vencimento?\n*(Você pode digitar 'hoje', 'amanhã', ou uma data como '15/10')*");
      setBotState("WAITING_TX_DUE_DATE");
    }

    if (opt.action === "NEW_PAYMENT") {
      addMsg("bot", "Para registrar um recebimento, digite o nome do cliente ou o número do pedido que está pendente:");
      setBotState("WAITING_PAYMENT_SEARCH");
    }

    if (opt.action === "CONFIRM_PAYMENT") {
      setLoading(true);
      const tx = opt.data;
      try {
        const { error } = await supabase.from("transactions").update({
          status: "pago", transaction_date: new Date().toISOString().split("T")[0]
        }).eq("id", tx.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        addMsg("bot", `Sucesso! ✅ O pagamento de **${tx.name}** no valor de ${formatBRL(tx.amount)} foi registrado. O dinheiro já consta como recebido no seu caixa!`, [{ label: "Voltar ao Início", action: "RESET_FLOW", primary: true }]);
        setBotState("FINISHED");
      } catch (e) {
        addMsg("bot", "Erro ao registrar pagamento.");
      } finally {
        setLoading(false);
      }
    }

    if (opt.action === "APPROVE_BUDGET") {
      setLoading(true);
      try {
        const { data } = await supabase.from("orders")
          .select("*, clients(name)")
          .eq("status", "orcamento")
          .order("created_at", { ascending: false })
          .limit(5);
        if (!data || data.length === 0) {
           addMsg("bot", "Não encontrei nenhum orçamento aguardando aprovação no sistema.", [{ label: "Voltar ao Início", action: "RESET_FLOW", primary: true }]);
           setBotState("FINISHED");
        } else {
           const opts = data.map((o: any) => ({
             label: `Orçamento #${String(o.number).padStart(5,"0")} - ${o.clients?.name} (${formatBRL(o.total)})`,
             action: "CONFIRM_BUDGET_APPROVAL",
             data: o
           }));
           addMsg("bot", "Aqui estão os últimos orçamentos gerados. Qual deles o cliente aprovou?", opts);
           setBotState("SELECTING_PENDING_BUDGET");
        }
      } catch (e) {} finally {
        setLoading(false);
      }
    }

    if (opt.action === "CONFIRM_BUDGET_APPROVAL") {
      setLoading(true);
      const o = opt.data;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sem usuário");
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id: user.id, order_id: o.id, name: `Pedido #${String(o.number).padStart(5,"0")} - ${o.clients?.name}`,
          type: "entrada", amount: o.total, status: "pendente",
          transaction_date: new Date().toISOString().split("T")[0]
        });
        if (txErr) throw txErr;
        const { error: ordErr } = await supabase.from("orders").update({ status: "aprovado", approved_at: new Date().toISOString() }).eq("id", o.id);
        if (ordErr) throw ordErr;
        
        qc.invalidateQueries({ queryKey: ["orders"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
        
        addMsg("bot", `Show! 🎉 O Pedido #${String(o.number).padStart(5,"0")} foi APROVADO.\nA conta a receber no valor de ${formatBRL(o.total)} foi gerada automaticamente e está pendente no seu financeiro!`, [{ label: "Perfeito", action: "RESET_FLOW", primary: true }]);
        setBotState("FINISHED");
      } catch (e) {
        addMsg("bot", "Erro ao aprovar orçamento.");
      } finally {
        setLoading(false);
      }
    }

    if (opt.action === "MONTH_SUMMARY") {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sem usuário");
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];
        
        const { data: txs } = await supabase.from("transactions")
          .select("type, amount")
          .eq("user_id", user.id)
          .eq("status", "pago")
          .gte("transaction_date", firstDay)
          .lte("transaction_date", lastDay);
          
        let inc = 0, exp = 0;
        if (txs) {
          txs.forEach((t: any) => t.type === "entrada" ? inc += t.amount : exp += t.amount);
        }
        
        const { count: pendOrd } = await supabase.from("orders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "orcamento");
          
        const saldo = inc - exp;
        
        addMsg("bot", `📈 **Resumo Financeiro deste Mês:**\n\n🟢 Receitas (pagas): ${formatBRL(inc)}\n🔴 Despesas (pagas): ${formatBRL(exp)}\n💰 Saldo Livre: **${formatBRL(saldo)}**\n\n📌 Além disso, você tem **${pendOrd || 0}** orçamento(s) aguardando aprovação dos clientes!`, [{ label: "Excelente! Voltar", action: "RESET_FLOW", primary: true }]);
        setBotState("FINISHED");
      } catch (e) {
        addMsg("bot", "Erro ao calcular o resumo do mês.");
      } finally {
        setLoading(false);
      }
    }

    if (opt.action === "SELECT_CLIENT") {
      const c = opt.data as Client;
      setSelectedClient(c);
      addMsg("bot", `Cliente selecionado: **${c.name}**\n\nAgora, qual é o nome do item ou serviço que será feito?`);
      setBotState("WAITING_ITEM_DESC");
    }

    if (opt.action === "CREATE_CLIENT_NO") {
      addMsg("bot", "Certo, digite outro nome para buscarmos novamente.");
      setBotState("WAITING_CLIENT_SEARCH");
    }

    if (opt.action === "CREATE_CLIENT_YES") {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sem usuário");
        const { data: newC, error } = await supabase.from("clients").insert({
          user_id: user.id, name: draftClientName
        }).select().single();
        if (error) throw error;
        
        setSelectedClient(newC);
        addMsg("bot", `Cliente **${draftClientName}** cadastrado no sistema!\n\nVocê quer preencher outros dados dele agora (como telefone, e-mail, CPF/CNPJ) ou quer ir direto para o pedido?`, [
          { label: "Ir direto para o pedido", action: "SKIP_CLIENT_DATA", primary: true },
          { label: "Preencher mais dados", action: "FILL_CLIENT_DATA" }
        ]);
        setBotState("ASK_MORE_DATA");
      } catch (err) {
        addMsg("bot", "Erro ao criar cliente. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    if (opt.action === "SKIP_CLIENT_DATA") {
      addMsg("bot", `Certo!\n\nAgora, qual é o nome do item ou serviço que será feito no pedido?`);
      setBotState("WAITING_ITEM_DESC");
    }

    if (opt.action === "FILL_CLIENT_DATA") {
      addMsg("bot", `Qual é o telefone do cliente? (ou digite "pular" para não informar)`);
      setBotState("WAITING_NEW_CLIENT_PHONE");
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
        
        addMsg("bot", `Sucesso! 🎉 O pedido #${String(o.number).padStart(5, "0")} foi salvo no sistema.\nO valor total ficou em ${formatBRL(total)}.\n\nVocê gostaria de criar o Orçamento (em PDF) para esse pedido agora?`, [
          { label: "Sim, gerar Orçamento", action: "GENERATE_BUDGET", primary: true },
          { label: "Não, apenas salvar", action: "RESET_FLOW" }
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
                            <div 
                              key={i} 
                              className="py-2 px-3 text-sm w-full text-left font-medium whitespace-normal bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => processOption(opt)}
                            >
                              {opt.label}
                            </div>
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
                disabled={!input.trim() || loading || ["CONCLUDING", "SELECTING_CLIENT", "CONFIRM_NEW_CLIENT", "ASK_MORE_DATA", "SELECTING_TX_CATEGORY", "SELECTING_PENDING_PAYMENT", "SELECTING_PENDING_BUDGET"].includes(botState)}
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
