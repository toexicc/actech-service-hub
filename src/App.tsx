import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import BrowserFlags from "@/components/BrowserFlags";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";

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
import Attendance from "./pages/Attendance";
import AttendanceOverview from "./pages/AttendanceOverview";
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
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/track" element={<ServiceTracking />} />
            <Route path="/track/:serviceId" element={<ServiceTracking />} />
            <Route path="/install" element={<Install />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/attendance-overview" element={<ProtectedRoute roles={["management"]}><AttendanceOverview /></ProtectedRoute>} />
            <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><PointOfSales /></ProtectedRoute>} />
            <Route path="/service-form" element={<ProtectedRoute><ServiceForm /></ProtectedRoute>} />
            <Route path="/intake" element={<ProtectedRoute><ServiceForm /></ProtectedRoute>} />
            <Route path="/service-tracking" element={<ProtectedRoute><ServiceTracker /></ProtectedRoute>} />
            <Route path="/manage-client" element={<ProtectedRoute><ManageClient /></ProtectedRoute>} />
            <Route path="/service-update" element={<ProtectedRoute><ServiceUpdate /></ProtectedRoute>} />
            <Route path="/service-tracker" element={<ProtectedRoute><ServiceTracker /></ProtectedRoute>} />
            <Route path="/inventory-management" element={<ProtectedRoute><InventoryManagement /></ProtectedRoute>} />
            <Route path="/customer-management" element={<ProtectedRoute><CustomerManagement /></ProtectedRoute>} />
            <Route path="/staff-management" element={<ProtectedRoute roles={["admin","management"]}><StaffManagement /></ProtectedRoute>} />
            <Route path="/completed-transactions" element={<ProtectedRoute><CompletedTransactions /></ProtectedRoute>} />
            <Route path="/transaction-tracker" element={<ProtectedRoute><TransactionTracker /></ProtectedRoute>} />
            <Route path="/tech-dashboard" element={<ProtectedRoute><OpenDashboard /></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<ProtectedRoute roles={["admin","management"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/request-for-parts" element={<ProtectedRoute><RequestForParts /></ProtectedRoute>} />
            <Route path="/salary-disbursement" element={<ProtectedRoute roles={["admin","management"]}><SalaryDisbursement /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

