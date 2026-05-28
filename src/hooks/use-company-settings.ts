import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type CompanySettings = {
  company_name?: string | null;
  logo_url?: string | null;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function useCompanySettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("company_settings")
        .select("company_name, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data) setSettings(data);
    })();
    return () => { cancelled = true; };
  }, []);

  return settings;
}
