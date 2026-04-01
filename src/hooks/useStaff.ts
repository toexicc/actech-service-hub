import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

export interface StaffMember {
  staffId: string;
  username: string;
  password: string;
  name: string;
  role: string;
  department: string;
  status: string;
  salary: string;
}

const fetchStaffList = async (): Promise<StaffMember[]> => {
  const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
  const data = await response.json();
  if (data.status === "success" && data.data) {
    return data.data;
  }
  throw new Error("Failed to load staff list");
};

export const useStaff = () => {
  return useQuery({
    queryKey: ["staff"],
    queryFn: fetchStaffList,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useInvalidateStaff = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["staff"] });
};

// Helper to get technicians only
export const useTechnicians = () => {
  const { data: staff, ...rest } = useStaff();
  const technicians = staff?.filter(
    (s) => s.role?.toLowerCase() === "technician" && s.status?.toLowerCase() === "active"
  ) || [];
  return { data: technicians, ...rest };
};
