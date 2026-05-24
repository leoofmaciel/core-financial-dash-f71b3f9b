import { useEffect, useRef, useState } from "react";
import { Search, FileText, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type Result =
  | { kind: "tx"; id: string; code: number; name: string; amount: number }
  | { kind: "budget"; id: string; number: number; client_name: string; total: number };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const [{ data: txs }, { data: budgets }] = await Promise.all([
        supabase.from("transactions").select("id, code, name, amount").ilike("name", `%${q}%`).limit(5),
        supabase.from("budgets").select("id, number, client_name, total").ilike("client_name", `%${q}%`).limit(5),
      ]);
      const out: Result[] = [
        ...(txs ?? []).map((t: any) => ({ kind: "tx" as const, ...t })),
        ...(budgets ?? []).map((b: any) => ({ kind: "budget" as const, ...b })),
      ];
      setResults(out);
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const goto = (r: Result) => {
    setOpen(false); setQ("");
    if (r.kind === "tx") navigate({ to: "/transactions" });
    else navigate({ to: "/budgets/$id", params: { id: r.id } });
  };

  return (
    <div ref={ref} className="relative flex-1 max-w-md">
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9 h-9"
        placeholder="Buscar movimentações ou orçamentos..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((r) => (
            <button
              key={`${r.kind}-${r.id}`}
              onClick={() => goto(r)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent text-left text-sm border-b last:border-b-0"
            >
              {r.kind === "tx" ? <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {r.kind === "tx" ? r.name : r.client_name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.kind === "tx" ? `Movimentação #${r.code}` : `Orçamento #${String(r.number).padStart(5, "0")}`}
                </div>
              </div>
              <span className="text-xs font-semibold">{formatBRL(r.kind === "tx" ? r.amount : r.total)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
