import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ServicePreviewSheet } from "@/components/ServicePreviewSheet";

/**
 * Global read-only ticket preview. Any page under DashboardLayout can call
 * `useServicePreview().openPreview(serviceId)` to open the slide-over without
 * owning any of its state.
 */

interface ServicePreviewContextValue {
  openPreview: (serviceId: string) => void;
}

const ServicePreviewContext = createContext<ServicePreviewContextValue>({
  openPreview: () => undefined,
});

export const useServicePreview = () => useContext(ServicePreviewContext);

export function ServicePreviewProvider({ children }: { children: ReactNode }) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const openPreview = useCallback((id: string) => {
    if (!id) return;
    setServiceId(id);
    setOpen(true);
  }, []);

  return (
    <ServicePreviewContext.Provider value={{ openPreview }}>
      {children}
      <ServicePreviewSheet serviceId={serviceId} open={open} onOpenChange={setOpen} />
    </ServicePreviewContext.Provider>
  );
}

export default ServicePreviewProvider;
