import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, DollarSign, Calendar, LogOut, Database, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { useSession } from "@/contexts/SessionProvider";
import { cn } from "@/lib/utils";
import React from "react";

interface SidebarProps {
  onOpenExporter: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar = ({ onOpenExporter, collapsed, onToggleCollapse }: SidebarProps) => {
  const navigate = useNavigate();
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';

  const logoUrl = "https://nkwsvsmmzvukdghlyxpm.supabase.co/storage/v1/object/public/app-assets/atocalogo.png";

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ease-in-out group",
      isActive
        ? "bg-primary text-primary-foreground shadow-md shadow-subtle-glow"
        : "text-sidebar-foreground hover:bg-secondary hover:text-secondary-foreground"
    );

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError("Erro ao fazer logout: " + error.message);
    } else {
      navigate('/login');
    }
  };

  // Títulos ocultos quando collapsed; ícones sempre visíveis
  const textLabel = (text: string) => (
    <span className={collapsed ? "sr-only" : "ml-2"}>{text}</span>
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen border-r border-sidebar-border z-20 bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end overflow-y-auto",
        collapsed ? "w-16" : "w-64",
        "flex flex-col transition-width duration-200"
      )}
      aria-label="Menu principal"
    >
      <div className="flex items-center justify-between h-12 px-2 py-2">
        <div className="flex items-center">
          <img src={logoUrl} alt="A Toca Pilates Logo" className="w-6 h-6 object-contain" />
          {!collapsed && (
            <span className="ml-2 text-xl font-semibold text-foreground">A Toca</span>
          )}
        </div>
        <button
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-muted/20 focus:outline-none"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <nav className="flex flex-col space-y-2 flex-grow px-1">
        <NavLink to="/" className={navLinkClasses} end>
          <LayoutDashboard className="w-5 h-5" />
          {textLabel("Dashboard")}
        </NavLink>
        <NavLink to="/alunos" className={navLinkClasses}>
          <Users className="w-5 h-5" />
          {textLabel("Alunos")}
        </NavLink>
        {isAdmin && (
          <NavLink to="/financeiro" className={navLinkClasses}>
            <DollarSign className="w-5 h-5" />
            {textLabel("Financeiro")}
          </NavLink>
        )}
        <NavLink to="/agenda" className={navLinkClasses}>
          <Calendar className="w-5 h-5" />
          {textLabel("Agenda")}
        </NavLink>
      </nav>

      <div className="mt-4 px-1 pb-2 space-y-2">
        {isAdmin && (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-sidebar-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors duration-200",
              collapsed && "justify-center"
            )}
            onClick={onOpenExporter}
          >
            <Database className="w-5 h-5" />
            {textLabel("Backup de Dados")}
          </Button>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200",
            collapsed && "justify-center"
          )}
          onClick={handleLogout}
        >
          <span className="mr-1">
            <LogOut className="w-5 h-5" />
          </span>
          {textLabel("Sair")}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;