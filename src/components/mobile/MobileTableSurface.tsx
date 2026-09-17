import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileTableSurfaceProps {
  children: ReactNode;
  className?: string;
  stickyFirstColumn?: boolean;
}

export function MobileTableSurface({ children, className, stickyFirstColumn = true }: MobileTableSurfaceProps) {
  return (
    <div
      className={cn(
        "mobile-table-surface rounded-lg border border-border/70 bg-card shadow-soft",
        stickyFirstColumn && "mobile-table-sticky-first",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default MobileTableSurface;