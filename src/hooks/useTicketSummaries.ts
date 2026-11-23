import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TicketSummary {
  service_id: string;
  client_name: string | null;
  brand: string | null;
  model: string | null;
  device_type: string | null;
  technicians: string[] | null;
  status: string | null;
}

/** "Apple iPhone 13" from brand and model, else the device type. */
export const ticketDevice = (t?: Pick<TicketSummary, "brand" | "model" | "device_type"> | null): string =>
  t ? [t.brand, t.model].filter(Boolean).join(" ") || t.device_type || "" : "";

/**
 * Client, device, technician and status for a set of ticket numbers (e.g. the tickets that stock movements
 * or part requests point at). Technicians only get the tickets they're assigned to.
 */
export const useTicketSummaries = (ids: string[]) =>
  useQuery({
    queryKey: ["ticket-summaries", ids],
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Record<string, TicketSummary>> => {
      const out: Record<string, TicketSummary> = {};
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await (supabase as any)
          .from("services")
          .select("service_id, client_name, brand, model, device_type, technicians, status")
          .in("service_id", ids.slice(i, i + 150));
        if (error) throw error;
        (data ?? []).forEach((t: TicketSummary) => (out[t.service_id] = t));
      }
      return out;
    },
  });
