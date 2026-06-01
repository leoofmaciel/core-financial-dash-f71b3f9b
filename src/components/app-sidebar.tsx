import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ArrowRightLeft, Tags, FileText, BarChart3, Settings, Users, LogOut, History, Repeat, UserCircle, ClipboardList, Wallet, CheckSquare, HandCoins, PieChart, Target, BarChart2, Receipt } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useMyPermissions, type ModuleKey } from "@/hooks/use-my-permissions";

const mainItems: { title: string; url: string; icon: any; module: ModuleKey }[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { title: "Fiscal", url: "/fiscal", icon: Receipt, module: "fiscal" },
  { title: "Clientes", url: "/clients", icon: UserCircle, module: "clients" },
  { title: "Pedidos", url: "/orders", icon: ClipboardList, module: "orders" },
  { title: "Orçamentos", url: "/budgets", icon: FileText, module: "budgets" },
  { title: "Relatórios", url: "/reports", icon: BarChart2, module: "reports" },
  { title: "Movimentações", url: "/transactions", icon: ArrowRightLeft, module: "transactions" },
  { title: "Recorrências", url: "/recurrences", icon: Repeat, module: "recurrences" },
  { title: "Investimentos", url: "/investments", icon: Wallet, module: "investments" },
  { title: "Sócios", url: "/partners", icon: HandCoins, module: "partners" },
  { title: "Tarefas", url: "/tasks", icon: CheckSquare, module: "tasks" },
  { title: "Categorias", url: "/categories", icon: Tags, module: "categories" },
];

const settingsItems: { title: string; url: string; icon: any; module: ModuleKey; adminOnly?: boolean }[] = [
  { title: "Histórico", url: "/logs", icon: History, module: "settings" },
  { title: "Configurações", url: "/settings", icon: Settings, module: "settings" },
  { title: "Usuários", url: "/users", icon: Users, module: "users", adminOnly: true },
];


export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const company = useCompanySettings();
  const perms = useMyPermissions();
  const logoSrc = company?.logo_url || logo;

  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };


  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center shrink-0">
            <img src={logoSrc} alt="RM" className="h-8 w-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground">{company?.company_name || "RM Financeiro"}</span>
              <span className="text-[10px] text-sidebar-foreground/60">Gestão empresarial</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link to={item.url} onClick={closeOnMobile} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.filter((i) => !i.adminOnly || isAdmin).map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path.startsWith(item.url)}>
                    <Link to={item.url} onClick={closeOnMobile}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <Button variant="ghost" size="sm" onClick={logout} className="justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
