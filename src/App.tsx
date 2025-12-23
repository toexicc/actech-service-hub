import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

// Eagerly load login page for fast initial load
import Login from "./pages/Login";

// Lazy load all other pages with retry logic for better reliability
const lazyWithRetry = (importFn: () => Promise<any>) => {
  return lazy(() => 
    importFn().catch(() => {
      // Retry once on failure
      return new Promise(resolve => setTimeout(resolve, 100)).then(importFn);
    })
  );
};

const Menu = lazyWithRetry(() => import("./pages/Menu"));
const ServiceForm = lazyWithRetry(() => import("./pages/ServiceForm"));
const ServiceTracking = lazyWithRetry(() => import("./pages/ServiceTracking"));
const ManageClient = lazyWithRetry(() => import("./pages/ManageClient"));
const ServiceUpdate = lazyWithRetry(() => import("./pages/ServiceUpdate"));
const ServiceTracker = lazyWithRetry(() => import("./pages/ServiceTracker"));
const InventoryManagement = lazyWithRetry(() => import("./pages/InventoryManagement"));
const CustomerManagement = lazyWithRetry(() => import("./pages/CustomerManagement"));
const StaffManagement = lazyWithRetry(() => import("./pages/StaffManagement"));
const TransactionTracker = lazyWithRetry(() => import("./pages/TransactionTracker"));
const OpenDashboard = lazyWithRetry(() => import("./pages/OpenDashboard"));
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"));
const ClientInquiry = lazyWithRetry(() => import("./pages/ClientInquiry"));
const RequestForParts = lazyWithRetry(() => import("./pages/RequestForParts"));
const Install = lazyWithRetry(() => import("./pages/Install"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

// Configure QueryClient with optimal caching settings for fast navigation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000, // 3 minutes - data stays fresh longer
      gcTime: 15 * 60 * 1000, // 15 minutes - cached data kept in memory
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      retry: 1, // Only retry failed requests once
      refetchOnMount: false, // Use cached data on mount if available
      refetchOnReconnect: false, // Don't auto-refetch on reconnect
    },
  },
});

// Loading fallback component with minimum display time to prevent flicker
const PageLoader = () => {
  const [showLoader, setShowLoader] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  if (!showLoader) return null;
  
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
