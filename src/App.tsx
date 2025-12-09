import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import AdminPortal from "./pages/AdminPortal";
import ServiceForm from "./pages/ServiceForm";
import ServiceTracking from "./pages/ServiceTracking";
import ManageClient from "./pages/ManageClient";
import ServiceUpdate from "./pages/ServiceUpdate";
import TechnicianPortal from "./pages/TechnicianPortal";
import ServiceTracker from "./pages/ServiceTracker";
import InventoryManagement from "./pages/InventoryManagement";
import CustomerManagement from "./pages/CustomerManagement";
import StaffManagement from "./pages/StaffManagement";
import TransactionTracker from "./pages/TransactionTracker";
import OpenDashboard from "./pages/OpenDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ClientInquiry from "./pages/ClientInquiry";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.MODE === 'production' ? '/actech-service-hub' : ''}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/admin-portal" element={<AdminPortal />} />
          <Route path="/client-inquiry" element={<ClientInquiry />} />
          <Route path="/service-form" element={<ServiceForm />} />
          <Route path="/track" element={<ServiceTracking />} />
          <Route path="/service-tracking" element={<ServiceTracker />} />
          <Route path="/manage-client" element={<ManageClient />} />
          <Route path="/technician-portal" element={<TechnicianPortal />} />
          <Route path="/service-update" element={<ServiceUpdate />} />
          <Route path="/service-tracker" element={<ServiceTracker />} />
          <Route path="/inventory-management" element={<InventoryManagement />} />
          <Route path="/customer-management" element={<CustomerManagement />} />
          <Route path="/staff-management" element={<StaffManagement />} />
          <Route path="/transaction-tracker" element={<TransactionTracker />} />
          <Route path="/tech-dashboard" element={<OpenDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
