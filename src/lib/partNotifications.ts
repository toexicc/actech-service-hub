import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "./notifications";
import { fetchStaffList, type StaffMember } from "./staffList";

const normalizeRole = (role?: string) => (role ?? "").toLowerCase().trim();
const getManagementStaff = (staffList: StaffMember[]) =>
  staffList.filter((s) => normalizeRole(s.role) === "management" || normalizeRole(s.role) === "admin");

const findStaffByName = (staffList: StaffMember[], name: string) => {
  const n = name.toLowerCase().trim();
  return staffList.find((s) => s.name.toLowerCase().trim() === n);
};

const fetchServiceInfo = async (serviceId: string) => {
  const { data, error } = await supabase
    .from("services")
    .select("technicians, admin_reps")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    technician: Array.isArray(data.technicians) ? data.technicians.join(", ") : "",
    adminRep: Array.isArray(data.admin_reps) ? data.admin_reps.join(", ") : "",
  };
};

export const notifyPartRequest = async (
  requesterName: string,
  serviceId: string,
  partName: string
) => {
  const staffList = await fetchStaffList();
  for (const staff of getManagementStaff(staffList)) {
    await createNotification({
      userId: staff.id,
      title: "New Part Request",
      message: `${requesterName} requested a part for Service ID ${serviceId}. Please check as soon as possible.\n\nPart: ${partName}`,
      type: "others",
      serviceId,
    });
  }
};

export const notifyPartOrdered = async (
  requesterName: string,
  serviceId: string,
  partName: string,
  supplier: string
) => {
  const staffList = await fetchStaffList();
  const requester = findStaffByName(staffList, requesterName);
  if (requester) {
    await createNotification({
      userId: requester.id,
      title: "Part Ordered",
      message: `Your requested part "${partName}" for Service ID ${serviceId} has been ordered from ${supplier}. Waiting to be received.`,
      type: "others",
      serviceId,
    });
  }
};

export const notifyPartReceived = async (serviceId: string, partName: string) => {
  const [staffList, info] = await Promise.all([fetchStaffList(), fetchServiceInfo(serviceId)]);
  if (!info) return;
  const notified = new Set<string>();
  const handle = async (name?: string) => {
    if (!name) return;
    const s = findStaffByName(staffList, name);
    if (s && !notified.has(s.id)) {
      notified.add(s.id);
      await createNotification({
        userId: s.id,
        title: "Part Received",
        message: `The part "${partName}" for Service ID ${serviceId} has been received and is ready for use.`,
        type: "others",
        serviceId,
      });
    }
  };
  for (const t of (info.technician || "").split(",").map((x) => x.trim()).filter(Boolean)) await handle(t);
  for (const a of (info.adminRep || "").split(",").map((x) => x.trim()).filter(Boolean)) await handle(a);
};

export const notifyPartCancelled = async (
  requesterName: string,
  serviceId: string,
  partName: string,
  cancelledBy: string,
  remark?: string
) => {
  const staffList = await fetchStaffList();
  const requester = findStaffByName(staffList, requesterName);
  if (requester) {
    const remarkText = remark ? `\n\nRemark: ${remark}` : "";
    await createNotification({
      userId: requester.id,
      title: "Cancelled Request",
      message: `Your part request "${partName}" for Service ID ${serviceId} has been cancelled by ${cancelledBy}.${remarkText}`,
      type: "others",
      serviceId,
    });
  }
};
