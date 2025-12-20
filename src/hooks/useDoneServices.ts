import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

interface DoneService {
  serviceId: string;
  timestamp: string;
  technician: string;
  department: string;
  clientName: string;
  service: string;
  quotedPrice: number;
  discount: number;
  partsCost: number;
}

const fetchDoneServices = async (): Promise<DoneService[]> => {
  const [doneRes, staffRes] = await Promise.all([
    fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getDoneServices`),
    fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`),
  ]);
  const [doneData, staffData] = await Promise.all([
    doneRes.json(),
    staffRes.json(),
  ]);

  if (doneData.status === "success" && doneData.services) {
    let servicesWithDept = doneData.services as DoneService[];

    // Enrich missing department from Staff Management
    if (staffData?.status === "success" && Array.isArray(staffData.data)) {
      const deptByTech = new Map<string, string>();
      for (const staff of staffData.data) {
        const role = (staff.role ?? staff["Role"] ?? "").toString().trim();
        if (role === "Technician") {
          const name = staff.name ?? staff["Name"] ?? "";
          const dept = staff.department ?? staff["Department"] ?? "";
          if (name) deptByTech.set(name, dept);
        }
      }
      servicesWithDept = servicesWithDept.map((s: any) => {
        const existing = (s.department || "").toString().trim();
        const isInvalid = !existing || existing === "N/A" || /^\d+$/.test(existing);
        const enriched = isInvalid ? deptByTech.get(s.technician) || existing : existing;
        return { ...s, department: enriched || "" } as DoneService;
      });
    }

    return servicesWithDept;
  }
  throw new Error("Failed to load done services");
};

export const useDoneServices = () => {
  return useQuery({
    queryKey: ["doneServices"],
    queryFn: fetchDoneServices,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useInvalidateDoneServices = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["doneServices"] });
};
