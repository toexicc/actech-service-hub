import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

import Login from "./pages/Login";
import Menu from "./pages/Menu";
import ServiceForm from "./pages/ServiceForm";
import ServiceTracking from "./pages/ServiceTracking";
import ManageClient from "./pages/ManageClient";
import ServiceUpdate from "./pages/ServiceUpdate";
import ServiceTracker from "./pages/ServiceTracker";
import InventoryManagement from "./pages/InventoryManagement";
import CustomerManagement from "./pages/CustomerManagement";
import StaffManagement from "./pages/StaffManagement";
import TransactionTracker from "./pages/TransactionTracker";
import OpenDashboard from "./pages/OpenDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ClientInquiry from "./pages/ClientInquiry";
import RequestForParts from "./pages/RequestForParts";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

// Configure QueryClient with caching settings for fast navigation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});

// Lightweight route transition loader (only shown briefly on initial mount)
const AppLoader = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.MODE === "production" ? "/actech-service-hub" : ""}>
        {/* Keep a tiny loader for the very first render only */}
        <AppLoader />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/client-inquiry" element={<ClientInquiry />} />
          <Route path="/service-form" element={<ServiceForm />} />
          <Route path="/track" element={<ServiceTracking />} />
          <Route path="/service-tracking" element={<ServiceTracker />} />
          <Route path="/manage-client" element={<ManageClient />} />
          <Route path="/service-update" element={<ServiceUpdate />} />
          <Route path="/service-tracker" element={<ServiceTracker />} />
          <Route path="/inventory-management" element={<InventoryManagement />} />
          <Route path="/customer-management" element={<CustomerManagement />} />
          <Route path="/staff-management" element={<StaffManagement />} />
          <Route path="/transaction-tracker" element={<TransactionTracker />} />
          <Route path="/tech-dashboard" element={<OpenDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/request-for-parts" element={<RequestForParts />} />
          <Route path="/install" element={<Install />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

