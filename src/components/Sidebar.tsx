import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, DollarSign, Calendar, Dumbbell, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { useSession } from "@/contexts/SessionProvider";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const navigate = useNavigate();
  const { profile } = useSession();

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ease-in-out group",
      isActive
        ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg animate-pulse-glow"
        : "text-sidebar-foreground hover:bg-gradient-to-r hover:from-sidebar-accent/20 hover:to-sidebar-accent/10 hover:text-sidebar-accent-foreground hover:scale-105"
    );

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError("Erro ao fazer logout: " + error.message);
    } else {
      navigate('/login');
    }
  };

  return (
    <aside className="w-64 h-screen p-4 border-r border-sidebar-border flex flex-col bg-gradient-to-b from-sidebar-gradient-start to-sidebar-gradient-end">
      <div className="flex items-center mb-8 animate-slide-in">
        <div className="p-2 bg-gradient-to-r from-primary to-primary/80 rounded-xl mr-3 animate-float">
          <Dumbbell className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          A Toca
        </h1>
      </div>
      <nav className="flex flex-col space-y-2 flex-grow">
        <NavLink to="/" className={navLinkClasses} end>
          <LayoutDashboard className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
          <span className="group-hover:font-semibold">Dashboard</span>
        </NavLink>
        <NavLink to="/alunos" className={navLinkClasses}>
          <Users className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
          <span className="group-hover:font-semibold">Alunos</span>
        </NavLink>
        {profile?.role === 'admin' && (
          <NavLink to="/financeiro" className={navLinkClasses}>
            <DollarSign className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
            <span className="group-hover:font-semibold">Financeiro</span>
          </NavLink>
        )}
        <NavLink to="/agenda" className={navLinkClasses}>
          <Calendar className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
          <span className="group-hover:font-semibold">Agenda</span>
        </NavLink>
      </nav>
      <div className="mt-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-gradient-to-r hover:from-destructive/20 hover:to-destructive/10 hover:text-destructive-foreground hover:scale-105 transition-all duration-300"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          <span className="hover:font-semibold">Sair</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;