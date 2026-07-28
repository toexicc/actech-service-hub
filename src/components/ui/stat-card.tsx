import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "destructive" | "info";
  onClick?: () => void;
  className?: string;
}

const toneMap: Record<string, string> = {
  default: "bg-muted/70 text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

export function StatCard({ label, value, hint, icon, tone = "primary", onClick, className }: StatCardProps) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "stat-card group text-left w-full",
        onClick && "cursor-pointer hover:border-primary/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", toneMap[tone])}>
            {icon}
          </div>
        )}
      </div>
    </Comp>
  );
}

export default StatCard;
