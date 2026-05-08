import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import BrowserFlags from "@/components/BrowserFlags";

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
import CompletedTransactions from "./pages/CompletedTransactions";
import OpenDashboard from "./pages/OpenDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import RequestForParts from "./pages/RequestForParts";
import Install from "./pages/Install";
import PointOfSales from "./pages/PointOfSales";
import SalaryDisbursement from "./pages/SalaryDisbursement";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserFlags />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/pos" element={<PointOfSales />} />
          <Route path="/service-form" element={<ServiceForm />} />
          <Route path="/intake" element={<ServiceForm />} />
          <Route path="/track" element={<ServiceTracking />} />
          <Route path="/service-tracking" element={<ServiceTracker />} />
          <Route path="/manage-client" element={<ManageClient />} />
          <Route path="/service-update" element={<ServiceUpdate />} />
          <Route path="/service-tracker" element={<ServiceTracker />} />
          <Route path="/inventory-management" element={<InventoryManagement />} />
          <Route path="/customer-management" element={<CustomerManagement />} />
          <Route path="/staff-management" element={<StaffManagement />} />
          <Route path="/completed-transactions" element={<CompletedTransactions />} />
          <Route path="/transaction-tracker" element={<TransactionTracker />} />
          <Route path="/tech-dashboard" element={<OpenDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/request-for-parts" element={<RequestForParts />} />
          <Route path="/salary-disbursement" element={<SalaryDisbursement />} />
          <Route path="/install" element={<Install />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

