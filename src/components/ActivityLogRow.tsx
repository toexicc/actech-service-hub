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

  return (
    <>
      <TableRow
        className={cn(
          overdueStatus && !service.status?.toLowerCase().includes("completed") && "bg-destructive/10",
          "cursor-pointer hover:bg-muted/50"
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
