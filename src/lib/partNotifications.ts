import { GOOGLE_SHEETS_SCRIPT_URL } from './googleSheets';
import { createNotification } from './notifications';

type StaffRole = string;

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  username?: string;
}

type RawStaffMember = {
  staffId?: string;
  id?: string;
  name?: string;
  role?: string;
  username?: string;
};

const normalizeRole = (role?: string) => (role ?? '').toLowerCase().trim();

const normalizeStaff = (raw: RawStaffMember): StaffMember | null => {
  const id = raw.staffId ?? raw.id;
  const name = raw.name;
  if (!id || !name) return null;
  return {
    id,
    name,
    role: raw.role ?? '',
    username: raw.username,
  };
};

// Fetch staff list from Google Sheets
const fetchStaffList = async (): Promise<StaffMember[]> => {
  try {
    const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
    const data = await response.json();

    // Script currently returns: { status: 'success', data: [...] }
    const rawList: RawStaffMember[] = data?.data || data?.staffList || [];

    return rawList.map(normalizeStaff).filter(Boolean) as StaffMember[];
  } catch (error) {
    console.error('Error fetching staff list:', error);
    return [];
  }
};

// Get management staff (case-insensitive)
const getManagementStaff = (staffList: StaffMember[]): StaffMember[] => {
  return staffList.filter((staff) => normalizeRole(staff.role) === 'management');
};

// Find staff by name (case-insensitive)
const findStaffByName = (staffList: StaffMember[], name: string): StaffMember | undefined => {
  const normalizedName = name.toLowerCase().trim();
  return staffList.find((staff) => staff.name.toLowerCase().trim() === normalizedName);
};

// Fetch service info to get assigned technician/admin
const fetchServiceInfo = async (serviceId: string): Promise<{ technician?: string; adminRep?: string } | null> => {
  try {
    const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getServiceById&serviceId=${encodeURIComponent(serviceId)}`);
    const data = await response.json();
    if (data.status === 'success' && data.service) {
      return {
        technician: data.service.technician,
        adminRep: data.service.adminRep,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching service info:', error);
    return null;
  }
};

/**
 * Notify all management staff when someone requests a part
 */
export const notifyPartRequest = async (
  requesterName: string,
  serviceId: string,
  partName: string
): Promise<void> => {
  try {
    const staffList = await fetchStaffList();
    const managementStaff = getManagementStaff(staffList);

      for (const staff of managementStaff) {
        await createNotification({
          userId: staff.id,
          title: 'New Part Request',
          message: `${requesterName} requested a part for Service ID ${serviceId}. Please check as soon as possible.\n\nPart: ${partName}`,
          type: 'others',
          serviceId: serviceId,
        });
      }
  } catch (error) {
    console.error('Error notifying part request:', error);
  }
};

/**
 * Notify the requester when part status changes to "Ordered"
 */
export const notifyPartOrdered = async (
  requesterName: string,
  serviceId: string,
  partName: string,
  supplier: string
): Promise<void> => {
  try {
    const staffList = await fetchStaffList();
    const requester = findStaffByName(staffList, requesterName);

    if (requester) {
      await createNotification({
        userId: requester.id,
        title: 'Part Ordered',
        message: `Your requested part "${partName}" for Service ID ${serviceId} has been ordered from ${supplier}. Waiting to be received.`,
        type: 'others',
        serviceId: serviceId,
      });
    }
  } catch (error) {
    console.error('Error notifying part ordered:', error);
  }
};

/**
 * Notify assigned admin and technician when part status changes to "Received"
 */
export const notifyPartReceived = async (
  serviceId: string,
  partName: string
): Promise<void> => {
  try {
    const [staffList, serviceInfo] = await Promise.all([
      fetchStaffList(),
      fetchServiceInfo(serviceId),
    ]);

    if (!serviceInfo) {
      console.warn('Service not found for notification:', serviceId);
      return;
    }

    const notifiedIds = new Set<string>();

    // Notify assigned technician
    if (serviceInfo.technician) {
      const technician = findStaffByName(staffList, serviceInfo.technician);
      if (technician && !notifiedIds.has(technician.id)) {
        notifiedIds.add(technician.id);
        await createNotification({
          userId: technician.id,
          title: 'Part Received',
          message: `The part "${partName}" for Service ID ${serviceId} has been received and is ready for use.`,
          type: 'others',
          serviceId: serviceId,
        });
      }
    }

    // Notify assigned admin representative
    if (serviceInfo.adminRep) {
      const admin = findStaffByName(staffList, serviceInfo.adminRep);
      if (admin && !notifiedIds.has(admin.id)) {
        notifiedIds.add(admin.id);
        await createNotification({
          userId: admin.id,
          title: 'Part Received',
          message: `The part "${partName}" for Service ID ${serviceId} has been received and is ready for use.`,
          type: 'others',
          serviceId: serviceId,
        });
      }
    }
  } catch (error) {
    console.error('Error notifying part received:', error);
  }
};
