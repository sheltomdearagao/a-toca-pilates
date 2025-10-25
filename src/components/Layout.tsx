import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";
import { useSession } from "@/contexts/SessionProvider";
import { cn } from "@/lib/utils";
import { useState } from "react";
import DataExporterDialog from "./DataExporterDialog"; // Importar o novo diálogo

const Layout = () => {
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';
  const [isExporterOpen, setIsExporterOpen] = useState(false); // Novo estado

  return (
    <div className={cn("flex min-h-screen", isAdmin ? "theme-admin" : "")}>
      <Sidebar onOpenExporter={() => setIsExporterOpen(true)} />
      <main className="flex-1 p-8 bg-background">
        <Outlet />
      </main>
      
      {/* Diálogo de Exportação */}
      <DataExporterDialog 
        isOpen={isExporterOpen} 
        onOpenChange={setIsExporterOpen} 
      />
    </div>
  );
};

export default Layout;