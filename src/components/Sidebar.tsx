import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, DollarSign, Calendar, Dumbbell } from "lucide-react";

const Sidebar = () => {
  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  return (
    <aside className="w-64 h-screen p-4 border-r bg-background flex flex-col">
      <div className="flex items-center mb-8">
        <Dumbbell className="w-8 h-8 mr-2 text-primary" />
        <h1 className="text-xl font-bold">A Toca</h1>
      </div>
      <nav className="flex flex-col space-y-2">
        <NavLink to="/" className={navLinkClasses} end>
          <LayoutDashboard className="w-5 h-5 mr-3" />
          Dashboard
        </NavLink>
        <NavLink to="/alunos" className={navLinkClasses}>
          <Users className="w-5 h-5 mr-3" />
          Alunos
        </NavLink>
        <NavLink to="/financeiro" className={navLinkClasses}>
          <DollarSign className="w-5 h-5 mr-3" />
          Financeiro
        </NavLink>
        <NavLink to="/agenda" className={navLinkClasses}>
          <Calendar className="w-5 h-5 mr-3" />
          Agenda
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;