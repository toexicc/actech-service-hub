import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

// Eagerly load login page for fast initial load
import Login from "./pages/Login";

// Lazy load all other pages for better initial bundle size
const Menu = lazy(() => import("./pages/Menu"));
const ServiceForm = lazy(() => import("./pages/ServiceForm"));
const ServiceTracking = lazy(() => import("./pages/ServiceTracking"));
const ManageClient = lazy(() => import("./pages/ManageClient"));
const ServiceUpdate = lazy(() => import("./pages/ServiceUpdate"));
const ServiceTracker = lazy(() => import("./pages/ServiceTracker"));
const InventoryManagement = lazy(() => import("./pages/InventoryManagement"));
const CustomerManagement = lazy(() => import("./pages/CustomerManagement"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const TransactionTracker = lazy(() => import("./pages/TransactionTracker"));
const OpenDashboard = lazy(() => import("./pages/OpenDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ClientInquiry = lazy(() => import("./pages/ClientInquiry"));
const RequestForParts = lazy(() => import("./pages/RequestForParts"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Configure QueryClient with optimal caching settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - cached data kept in memory
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      retry: 1, // Only retry failed requests once
      refetchOnMount: "always", // Always check for updates on mount
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.MODE === 'production' ? '/actech-service-hub' : ''}>
        <Suspense fallback={<PageLoader />}>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
