import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DoneService {
  serviceId: string;
  timestamp: string;
  technician: string;
  technicianList: string[];
  department: string;
  departmentList: string[];
  clientName: string;
  service: string;
  quotedPrice: number;
  discount: number;
  partsCost: number;
}

const fetchDoneServices = async (): Promise<DoneService[]> => {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("status", "Completed")
    .order("date_completed", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const technicianList: string[] = Array.isArray(r.technicians)
      ? r.technicians.map((t: any) => String(t ?? "").trim()).filter(Boolean)
      : [];
    const departmentList: string[] = Array.isArray(r.technician_departments)
      ? r.technician_departments.map((d: any) => String(d ?? "").trim()).filter(Boolean)
      : [];
    return {
      serviceId: r.service_id ?? "",
      timestamp: r.date_completed ?? r.last_updated ?? "",
      technician: technicianList.join(", "),
      technicianList,
      department: departmentList.join(", "),
      departmentList,
      clientName: r.client_name ?? "",
      service: r.service ?? "",
      quotedPrice: Number(r.service_cost ?? 0),
      discount: Number(r.discount ?? 0),
      partsCost: Number(r.parts_cost ?? 0),
    };
  });
};

export const useDoneServices = () => useQuery({
  queryKey: ["doneServices"],
  queryFn: fetchDoneServices,
  staleTime: 2 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
});

export const useInvalidateDoneServices = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["doneServices"] });
};
