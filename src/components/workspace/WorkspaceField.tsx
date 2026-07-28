import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WorkspaceFieldProps {
  label: string;
  value?: ReactNode;
  icon?: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function WorkspaceField({
  label,
  value,
  icon,
  className,
  valueClassName,
}: WorkspaceFieldProps) {
  const isEmpty = value === undefined || value === null || value === "";
  return (
    <div className={cn("space-y-0.5 min-w-0", className)}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-medium text-foreground break-words",
          isEmpty && "text-muted-foreground italic font-normal",
          valueClassName,
        )}
      >
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}

export default WorkspaceField;
