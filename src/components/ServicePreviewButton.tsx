import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useServicePreview } from "@/components/ServicePreviewProvider";
import { cn } from "@/lib/utils";

/**
 * Small icon button that opens the read-only ticket preview slide-over.
 * Drop next to any ticket ID; the click never propagates so it is safe inside
 * clickable rows.
 */
export function ServicePreviewButton({
  serviceId,
  className,
}: {
  serviceId?: string | null;
  className?: string;
}) {
  const { openPreview } = useServicePreview();
  if (!serviceId) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={`Preview ticket ${serviceId}`}
      aria-label={`Preview ticket ${serviceId}`}
      className={cn("h-6 w-6 text-primary hover:text-primary hover:bg-primary/10", className)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        openPreview(serviceId);
      }}
    >
      <Eye className="h-3.5 w-3.5" />
    </Button>
  );
}

export default ServicePreviewButton;
