import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileStickyActionsProps {
  children: ReactNode;
  className?: string;
}

export function MobileStickyActions({ children, className }: MobileStickyActionsProps) {
  return (
    <div className={cn("mobile-sticky-actions", className)}>
      {children}
    </div>
  );
}

export default MobileStickyActions;