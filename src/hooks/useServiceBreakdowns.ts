import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ServiceBreakdown {
  id: string;
  serviceId: string;
  serviceName: string;
  technicianId: string | null;
  technicianName: string;
  cost: number;
}

export const useServiceBreakdowns = (serviceId: string | undefined) =>
  useQuery({
    queryKey: ["serviceBreakdowns", serviceId],
    queryFn: async (): Promise<ServiceBreakdown[]> => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from("service_breakdowns")
        .select("*")
        .eq("service_id", serviceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        serviceId: r.service_id,
        serviceName: r.service_name ?? "",
        technicianId: r.technician_id ?? null,
        technicianName: r.technician_name ?? "",
        cost: Number(r.cost ?? 0),
      }));
    },
    enabled: !!serviceId,
    staleTime: 60 * 1000,
  });

export interface BreakdownInput {
  serviceName: string;
  technicianId?: string | null;
  technicianName: string;
  cost: number;
}

export const useSaveServiceBreakdowns = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceId, rows }: { serviceId: string; rows: BreakdownInput[] }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const createdBy = userRes?.user?.id ?? null;
      // Replace strategy: delete existing, insert all
      await supabase.from("service_breakdowns").delete().eq("service_id", serviceId);
      if (rows.length === 0) return;
      const payload = rows.map((r) => ({
        service_id: serviceId,
        service_name: r.serviceName,
        technician_id: r.technicianId ?? null,
        technician_name: r.technicianName,
        cost: r.cost,
        created_by: createdBy,
      }));
      const { error } = await supabase.from("service_breakdowns").insert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: ["serviceBreakdowns", vars.serviceId] }),
  });
};
