import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, Upload, FileText, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/logs";

export function OrderAttachments({ orderId }: { orderId: string | null }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: list = [] } = useQuery({
    queryKey: ["order-attachments", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data } = await (supabase.from("order_attachments" as any)
        .select("*").eq("order_id", orderId).order("created_at", { ascending: false }));
      return (data ?? []) as any[];
    },
    enabled: !!orderId,
  });

  const upload = async (file: File) => {
    if (!orderId) return toast.error("Salve o pedido primeiro");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const path = `${user.id}/${orderId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("order-attachments").upload(path, file);
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const { error: dbErr } = await (supabase.from("order_attachments" as any).insert({
      order_id: orderId, user_id: user.id, file_path: path,
      name: file.name, size: file.size, mime: file.type,
    }));
    setBusy(false);
    if (dbErr) return toast.error(dbErr.message);
    await logActivity("attachment_added", "order", orderId, { name: file.name });
    qc.invalidateQueries({ queryKey: ["order-attachments", orderId] });
    qc.invalidateQueries({ queryKey: ["order-logs", orderId] });
    toast.success("Anexo enviado");
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) await upload(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const remove = async (a: any) => {
    if (!confirm(`Remover "${a.name}"?`)) return;
    await supabase.storage.from("order-attachments").remove([a.file_path]);
    await (supabase.from("order_attachments" as any).delete().eq("id", a.id));
    await logActivity("attachment_removed", "order", orderId!, { name: a.name });
    qc.invalidateQueries({ queryKey: ["order-attachments", orderId] });
    qc.invalidateQueries({ queryKey: ["order-logs", orderId] });
  };

  const download = async (a: any) => {
    const { data } = await supabase.storage.from("order-attachments").createSignedUrl(a.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <Paperclip className="h-3.5 w-3.5" /> Anexos ({list.length})
        </h3>
        <Button size="sm" variant="outline" disabled={!orderId || busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5 mr-1" /> Enviar</>}
        </Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={onPick} />
      </div>
      <div className="space-y-1">
        {list.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo.</p>}
        {list.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 text-xs border rounded p-2 bg-card">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate" title={a.name}>{a.name}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => download(a)}><Download className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(a)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
