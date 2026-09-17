import { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface MobileFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function MobileFilterSheet({ open, onOpenChange, title = "Filter & Sort", children, footer }: MobileFilterSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh] rounded-t-2xl border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="flex-row items-center justify-between px-4 pb-2 pt-3 text-left">
          <DrawerTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            {title}
          </DrawerTitle>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <div className="grid gap-4">{children}</div>
        </div>
        {footer && <div className="border-t border-border/70 p-4">{footer}</div>}
      </DrawerContent>
    </Drawer>
  );
}

interface MobileFilterChipsProps {
  children: ReactNode;
  className?: string;
}

export function MobileFilterChips({ children, className }: MobileFilterChipsProps) {
  return <div className={cn("mobile-filter-chips", className)}>{children}</div>;
}