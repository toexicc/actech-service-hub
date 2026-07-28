import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({ title, description, actions, icon, children, className, contentClassName }: SectionCardProps) {
  return (
    <section className={cn("card-elevated overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-border/50">
          <div className="flex items-start gap-3 min-w-0">
            {icon && <div className="mt-0.5 text-primary shrink-0">{icon}</div>}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>}
              {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5 sm:p-6", contentClassName)}>{children}</div>
    </section>
  );
}

export default SectionCard;
