import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCompanySettings() {
  const { data } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("company_settings")
        .select("company_name, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 0, // always re-fetch when component re-focuses
  });

  return data ?? null;
}
