import { ReactNode } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

import Menu from "@/pages/Menu";
import PointOfSales from "@/pages/PointOfSales";
import ServiceForm from "@/pages/ServiceForm";
import ManageClient from "@/pages/ManageClient";
import ServiceUpdate from "@/pages/ServiceUpdate";
import ServiceTracker from "@/pages/ServiceTracker";
import InventoryManagement from "@/pages/InventoryManagement";
import CustomerManagement from "@/pages/CustomerManagement";
import StaffManagement from "@/pages/StaffManagement";
import CompletedTransactions from "@/pages/CompletedTransactions";
import TransactionTracker from "@/pages/TransactionTracker";
import OpenDashboard from "@/pages/OpenDashboard";
import RequestForParts from "@/pages/RequestForParts";
import SalaryDisbursement from "@/pages/SalaryDisbursement";
import AttendanceOverview from "@/pages/AttendanceOverview";
import QueueAdmin from "@/pages/QueueAdmin";
import Reports from "@/pages/Reports";

export interface WorkbenchRouteDef {
  path: string;
  element: ReactNode;
}

// Route table for pages that live inside the tabbed workbench shell.
// Order matters only for the fallback matcher below.
export const workbenchRoutes: WorkbenchRouteDef[] = [
  { path: "/menu", element: <ProtectedRoute><Menu /></ProtectedRoute> },
  { path: "/pos", element: <ProtectedRoute><PointOfSales /></ProtectedRoute> },
  { path: "/service-form", element: <ProtectedRoute><ServiceForm /></ProtectedRoute> },
  { path: "/service-tracking", element: <ProtectedRoute><ServiceTracker /></ProtectedRoute> },
  { path: "/manage-client", element: <ProtectedRoute><ManageClient /></ProtectedRoute> },
  { path: "/service-update", element: <ProtectedRoute><ServiceUpdate /></ProtectedRoute> },
  { path: "/service-tracker", element: <ProtectedRoute><ServiceTracker /></ProtectedRoute> },
  { path: "/inventory-management", element: <ProtectedRoute><InventoryManagement /></ProtectedRoute> },
  { path: "/customer-management", element: <ProtectedRoute><CustomerManagement /></ProtectedRoute> },
  { path: "/staff-management", element: <ProtectedRoute roles={["admin", "management"]}><StaffManagement /></ProtectedRoute> },
  { path: "/completed-transactions", element: <ProtectedRoute><CompletedTransactions /></ProtectedRoute> },
  { path: "/transaction-tracker", element: <ProtectedRoute><TransactionTracker /></ProtectedRoute> },
  { path: "/tech-dashboard", element: <ProtectedRoute><OpenDashboard /></ProtectedRoute> },
  { path: "/request-for-parts", element: <ProtectedRoute><RequestForParts /></ProtectedRoute> },
  { path: "/salary-disbursement", element: <ProtectedRoute roles={["admin", "management"]}><SalaryDisbursement /></ProtectedRoute> },
  { path: "/attendance-overview", element: <ProtectedRoute roles={["management"]}><AttendanceOverview /></ProtectedRoute> },
  { path: "/reports", element: <ProtectedRoute roles={["management"]}><Reports /></ProtectedRoute> },
  { path: "/queueing", element: <ProtectedRoute><QueueAdmin /></ProtectedRoute> },
];

export function findWorkbenchRoute(pathname: string): WorkbenchRouteDef | undefined {
  return workbenchRoutes.find((r) => r.path === pathname);
}

export function isWorkbenchPath(pathname: string): boolean {
  return !!findWorkbenchRoute(pathname);
}
