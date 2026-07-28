import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WorkspacePanelProps {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "default" | "primary" | "muted";
}

export function WorkspacePanel({
  title,
  icon,
  action,
  children,
  className,
  bodyClassName,
  tone = "default",
}: WorkspacePanelProps) {
  const toneClass =
    tone === "primary"
      ? "border-primary/25 bg-primary/5"
      : tone === "muted"
      ? "border-border/50 bg-muted/30"
      : "border-border/60 bg-[hsl(var(--surface-glass))]";
  return (
    <div
      className={cn(
        "rounded-2xl border shadow-[var(--shadow-float)] backdrop-blur overflow-hidden",
        toneClass,
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-primary shrink-0">{icon}</span>}
            {title && (
              <h3 className="text-sm font-semibold text-foreground truncate">
                {title}
              </h3>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </div>
  );
}

export default WorkspacePanel;
