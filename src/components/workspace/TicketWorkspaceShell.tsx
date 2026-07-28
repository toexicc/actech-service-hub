import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TicketWorkspaceShellProps {
  hero?: ReactNode;
  leftRail?: ReactNode;
  main: ReactNode;
  rightRail?: ReactNode;
  className?: string;
}

/**
 * Fixy-inspired three-column ticket workspace layout.
 * Collapses to a single column below `lg`.
 */
export function TicketWorkspaceShell({
  hero,
  leftRail,
  main,
  rightRail,
  className,
}: TicketWorkspaceShellProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {hero}
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        {leftRail && <aside className="space-y-4 min-w-0">{leftRail}</aside>}
        <section className="space-y-6 min-w-0">{main}</section>
        {rightRail && <aside className="space-y-4 min-w-0">{rightRail}</aside>}
      </div>
    </div>
  );
}

export default TicketWorkspaceShell;
