import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";
import { useSession } from "@/contexts/SessionProvider";
import { cn } from "@/lib/utils";

const Layout = () => {
  const { profile } = useSession();
  const isAdmin = profile?.role === 'admin';

  return (
    <div className={cn("flex min-h-screen", isAdmin ? "theme-admin" : "")}>
      <Sidebar />
      <main className="flex-1 p-8 bg-background">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;