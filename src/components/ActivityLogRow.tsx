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
    timestamp: string;
    technician: string;
    service: string;
    deviceType: string;
    brand: string;
    device: string;
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
    const status = service.status?.toLowerCase() || '';
    if (status.includes('completed')) return 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30';
    if (status.includes('ongoing')) return 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30';
    if (status.includes('on hold')) return 'bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-950/30';
    if (status.includes('cancelled') || status.includes('closed')) return 'bg-gray-100 dark:bg-gray-800/20 hover:bg-gray-200 dark:hover:bg-gray-800/30';
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
