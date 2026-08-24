import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import BrowserFlags from "@/components/BrowserFlags";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { WorkbenchProvider } from "@/components/workbench/WorkbenchContext";
import { WorkbenchOutlet } from "@/components/workbench/WorkbenchOutlet";

import Login from "./pages/Login";
import ServiceTracking from "./pages/ServiceTracking";
import ServiceForm from "./pages/ServiceForm";
import Install from "./pages/Install";
import Attendance from "./pages/Attendance";
import KioskDevices from "./pages/KioskDevices";
import OpenDashboard from "./pages/OpenDashboard";

import NotFound from "./pages/NotFound";
import QueueDisplay from "./pages/QueueDisplay";
import PublicRelease from "./pages/PublicRelease";

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

// Workbench shell: single DashboardLayout instance wraps a keep-alive outlet
// that mounts each open workbench tab once and toggles visibility on switch.
const WorkbenchShell = () => (
  <DashboardLayout>
    <WorkbenchOutlet />
  </DashboardLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserFlags />
      <BrowserRouter>
        <AuthProvider>
          <WorkbenchProvider>
            <Routes>
              {/* Public / standalone routes stay outside the workbench shell */}
              <Route path="/" element={<Login />} />
              <Route path="/track" element={<ServiceTracking />} />
              <Route path="/track/:serviceId" element={<ServiceTracking />} />
              <Route path="/install" element={<Install />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route
                path="/kiosk-devices"
                element={
                  <ProtectedRoute roles={["management"]}>
                    <KioskDevices />
                  </ProtectedRoute>
                }
              />

              <Route path="/intake" element={<ServiceForm />} />
              <Route path="/queue" element={<QueueDisplay />} />
              <Route path="/release" element={<PublicRelease />} />

              {/* All authenticated workbench pages render through a single
                  keep-alive shell so switching tabs no longer remounts pages. */}
              <Route path="/menu" element={<WorkbenchShell />} />
              <Route path="/pos" element={<WorkbenchShell />} />
              <Route path="/service-form" element={<WorkbenchShell />} />
              <Route path="/service-tracking" element={<WorkbenchShell />} />
              <Route path="/manage-client" element={<WorkbenchShell />} />
              <Route path="/service-update" element={<WorkbenchShell />} />
              <Route path="/service-tracker" element={<WorkbenchShell />} />
              <Route path="/inventory-management" element={<WorkbenchShell />} />
              <Route path="/customer-management" element={<WorkbenchShell />} />
              <Route path="/staff-management" element={<WorkbenchShell />} />
              <Route path="/completed-transactions" element={<WorkbenchShell />} />
              <Route path="/transaction-tracker" element={<WorkbenchShell />} />
              <Route path="/tech-dashboard" element={<OpenDashboard />} />
              <Route path="/admin-dashboard" element={<WorkbenchShell />} />
              <Route path="/request-for-parts" element={<WorkbenchShell />} />
              <Route path="/salary-disbursement" element={<WorkbenchShell />} />
              <Route path="/attendance-overview" element={<WorkbenchShell />} />
              <Route path="/reports" element={<WorkbenchShell />} />
              <Route path="/queueing" element={<WorkbenchShell />} />
              {/* Legacy links from older portal pages should return to the
                  current dashboard instead of falling through to Not Found. */}
              <Route path="/admin-portal" element={<Navigate to="/menu" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkbenchProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
