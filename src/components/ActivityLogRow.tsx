import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getServiceLogs } from "@/lib/activityLogger";

interface ActivityLogRowProps {
  service: {
    serviceId: string;
    timestamp?: string;
    technician: string;
    service?: string;
    deviceType: string;
    brand?: string;
    device?: string;
    targetDate: string;
    status: string;
    clientName: string;
  };
  overdueStatus: boolean;
  inServiceDays: number;
  children: React.ReactNode;
}

const ActivityLogRow = ({ service, overdueStatus, inServiceDays, children }: ActivityLogRowProps) => {
  const [expanded, setExpanded] = useState(false);
  
  const { data: logs, isLoading } = useQuery({
    queryKey: ["service-logs", service.serviceId],
    queryFn: () => getServiceLogs(service.serviceId, 10),
    enabled: expanded,
  });

  // Status-based row colors
  const getStatusColor = () => {
    const status = service.status || '';
    
    // Exact status matches
    if (status === 'Pending Diagnosis') return 'hover:bg-muted/50';
    if (status === 'Confirmed Diagnosis') return 'bg-yellow-100 dark:bg-yellow-950/30 hover:bg-yellow-200 dark:hover:bg-yellow-950/40';
    if (status === 'Waiting to Proceed') return 'bg-orange-100 dark:bg-orange-950/30 hover:bg-orange-200 dark:hover:bg-orange-950/40';
    if (status === 'Proceed Repair') return 'bg-orange-200 dark:bg-orange-900/40 hover:bg-orange-300 dark:hover:bg-orange-900/50';
    if (status === 'Ongoing Service') return 'bg-blue-100 dark:bg-blue-950/30 hover:bg-blue-200 dark:hover:bg-blue-950/40';
    if (status === 'For Pickup') return 'bg-green-100 dark:bg-green-950/30 hover:bg-green-200 dark:hover:bg-green-950/40';
    if (status === 'Completed') return 'bg-green-300 dark:bg-green-700/50 hover:bg-green-400 dark:hover:bg-green-700/60';
    if (status === 'Backjob') return 'bg-gray-200 dark:bg-gray-800/40 hover:bg-gray-300 dark:hover:bg-gray-800/50';
    if (status === 'RTO') return 'bg-purple-200 dark:bg-purple-950/40 hover:bg-purple-300 dark:hover:bg-purple-950/50';
    if (status === 'On Hold') return 'bg-gray-200 dark:bg-gray-800/40 hover:bg-gray-300 dark:hover:bg-gray-800/50';
    if (status === 'Cancelled') return 'bg-gray-200 dark:bg-gray-800/40 hover:bg-gray-300 dark:hover:bg-gray-800/50';
    
    return 'hover:bg-muted/50';
  };

  return (
    <>
      <TableRow
        className={cn(
          getStatusColor(),
          overdueStatus && !service.status?.toLowerCase().includes("completed") && "border-l-4 border-l-destructive bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30",
          "cursor-pointer transition-colors"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {children}
      </TableRow>
      
      {expanded && (
        <TableRow>
          <TableCell colSpan={11} className="bg-muted/30 p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Activity className="h-4 w-4" />
                Recent Activity Logs (Last 10)
              </div>
              
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading logs...</p>
              ) : !logs || logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity logs found</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.logId} className="bg-background rounded-md p-3 text-sm border">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{log.username}</span>
                        <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                      </div>
                      <div className="text-muted-foreground text-xs mb-1">Role: {log.role}</div>
                      <div className="text-foreground">{log.activity}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default ActivityLogRow;
