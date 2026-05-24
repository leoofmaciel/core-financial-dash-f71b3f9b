import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";

type Item = {
  id: string;
  name: string;
  amount: number;
  due_date: string | null;
  status: "pendente" | "atrasado" | "pago";
  type: "entrada" | "saida";
};

export function NotificationsBell() {
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const in7 = new Date();
      in7.setDate(in7.getDate() + 7);
      const { data } = await supabase
        .from("transactions")
        .select("id,name,amount,due_date,status,type")
        .in("status", ["pendente", "atrasado"])
        .not("due_date", "is", null)
        .lte("due_date", in7.toISOString().slice(0, 10))
        .order("due_date", { ascending: true })
        .limit(20);
      return (data ?? []) as Item[];
    },
    refetchInterval: 60_000,
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdue = data.filter((d) => d.due_date && d.due_date < today);
  const count = data.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b">
          <p className="text-sm font-semibold">Notificações</p>
          <p className="text-xs text-muted-foreground">
            {overdue.length > 0 ? `${overdue.length} vencida(s) · ` : ""}
            {count - overdue.length} a vencer em 7 dias
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {data.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">Sem notificações.</p>
          )}
          {data.map((d) => {
            const isOverdue = d.due_date && d.due_date < today;
            return (
              <Link
                key={d.id}
                to="/transactions"
                className="flex items-center justify-between gap-2 p-3 hover:bg-muted/50 border-b last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Vence {formatDate(d.due_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${d.type === "entrada" ? "text-success" : "text-destructive"}`}>
                    {formatBRL(d.amount)}
                  </p>
                  <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px]">
                    {isOverdue ? "atrasado" : "pendente"}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
