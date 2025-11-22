import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { SessionProvider } from "./contexts/SessionProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import React from "react";
import { Loader2 } from "lucide-react";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Financial = lazy(() => import("./pages/Financial"));
const Students = lazy(() => import("./pages/Students"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
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
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="agenda" element={<Schedule />} />
              <Route path="financeiro" element={<Financial />} />
              <Route path="alunos" element={<Students />} />
              <Route path="alunos/:studentId" element={<StudentProfile />} />
            </Route>
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </SessionProvider>
  </Suspense>
);

export default App;