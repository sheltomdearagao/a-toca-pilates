import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { SessionProvider } from "./contexts/SessionProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout"; // Layout é importado diretamente pois é um componente de estrutura
import React from "react"; // manter para TSX
import { Loader2 } from "lucide-react"; // spinner

// Lazy load dos componentes de página
const Login = lazy(() => import("./pages/Login"));
const Schedule = lazy(() => import("./pages/Schedule")); // fix: Schedule.tsx now has default export
const Financial = lazy(() => import("./pages/Financial"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }
  >
  <SessionProvider>
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ProtectedRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  </SessionProvider>
  </Suspense>
);

function ProtectedRoutes() {
  return (
    <ProtectedRoute path="/" element={<Layout />} >
      <Route path="/" element={<Schedule />} />
    </ProtectedRoute>
  );
}

export default App;