import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, DollarSign, Calendar, Dumbbell, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { useSession } from "@/contexts/SessionProvider";

const Sidebar = () => {
  const navigate = useNavigate();
  const { profile } = useSession();

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    }`;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError("Erro ao fazer logout: " + error.message);
    } else {
      navigate('/login');
    }
  };

  return (
    <aside className="w-64 h-screen p-4 border-r border-sidebar-border bg-sidebar flex flex-col"> {/* Usando border-sidebar-border */}
      <div className="flex items-center mb-8">
        <Dumbbell className="w-8 h-8 mr-2 text-primary" />
        <h1 className="text-xl font-bold text-foreground">A Toca</h1>
      </div>
      <nav className="flex flex-col space-y-2 flex-grow">
        <NavLink to="/" className={navLinkClasses} end>
          <LayoutDashboard className="w-5 h-5 mr-3" />
          Dashboard
        </NavLink>
        <NavLink to="/alunos" className={navLinkClasses}>
          <Users className="w-5 h-5 mr-3" />
          Alunos
        </NavLink>
        {profile?.role === 'admin' && (
          <NavLink to="/financeiro" className={navLinkClasses}>
            <DollarSign className="w-5 h-5 mr-3" />
            Financeiro
          </NavLink>
        )}
        <NavLink to="/agenda" className={navLinkClasses}>
          <Calendar className="w-5 h-5 mr-3" />
          Agenda
        </NavLink>
      </nav>
      <div className="mt-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;