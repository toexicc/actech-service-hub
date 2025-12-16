import { createNotification } from './notifications';
import { GOOGLE_SHEETS_SCRIPT_URL } from './googleSheets';

interface ServiceInfo {
  serviceId: string;
  clientName: string;
  technician: string;
  deviceType?: string;
  device?: string;
}

interface StaffMember {
  staffId: string;
  name: string;
  role: string;
  username?: string;
}

// Fetch staff list to get IDs for notifications
const fetchStaffList = async (): Promise<StaffMember[]> => {
  try {
    const response = await fetch(`${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`);
    const data = await response.json();
    return data.staff || data.data || [];
  } catch (error) {
    console.error('Error fetching staff list:', error);
    return [];
  }
};

// Get staff member by name
const findStaffByName = (staffList: StaffMember[], name: string): StaffMember | undefined => {
  return staffList.find(s => s.name.toLowerCase() === name.toLowerCase());
};

// Get all management staff
const getManagementStaff = (staffList: StaffMember[]): StaffMember[] => {
  return staffList.filter(s => s.role?.toLowerCase() === 'management');
};

// Get all admin staff  
const getAdminStaff = (staffList: StaffMember[]): StaffMember[] => {
  return staffList.filter(s => s.role?.toLowerCase() === 'admin');
};

// Notify about service status change
export const notifyServiceStatusChange = async (
  service: ServiceInfo,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  changedByRole?: string
): Promise<void> => {
  try {
    const staffList = await fetchStaffList();
    const notifyUsers: Set<string> = new Set();
    
    // Always notify management
    const management = getManagementStaff(staffList);
    management.forEach(m => {
      if (m.staffId && m.name !== changedBy) {
        notifyUsers.add(m.staffId);
      }
    });
    
    // If changed by technician, also notify admins
    if (changedByRole?.toLowerCase() === 'technician') {
      const admins = getAdminStaff(staffList);
      admins.forEach(a => {
        if (a.staffId && a.name !== changedBy) {
          notifyUsers.add(a.staffId);
        }
      });
    }
    
    // Notify assigned technician (if not the one making the change)
    if (service.technician && service.technician !== changedBy) {
      // Handle multiple technicians
      const techNames = service.technician.split(',').map(t => t.trim());
      for (const techName of techNames) {
        const tech = findStaffByName(staffList, techName);
        if (tech?.staffId) {
          notifyUsers.add(tech.staffId);
        }
      }
    }
    
    // Create notifications for all relevant users
    const title = `Service ${service.serviceId} status updated`;
    const message = `${service.clientName}'s ${service.device || service.deviceType || 'device'} changed from "${oldStatus}" to "${newStatus}" by ${changedBy}`;
    
    for (const userId of notifyUsers) {
      await createNotification({
        userId,
        title,
        message,
        type: 'service_update',
        serviceId: service.serviceId,
      });
    }
  } catch (error) {
    console.error('Error sending service notifications:', error);
  }
};

// Notify about new service assignment
export const notifyNewServiceAssignment = async (
  service: ServiceInfo,
  assignedTo: string,
  assignedBy: string
): Promise<void> => {
  try {
    const staffList = await fetchStaffList();
    
    // Find the assigned technician
    const tech = findStaffByName(staffList, assignedTo);
    if (!tech?.staffId || assignedTo === assignedBy) return;
    
    await createNotification({
      userId: tech.staffId,
      title: `New service assigned: ${service.serviceId}`,
      message: `You have been assigned to ${service.clientName}'s ${service.device || service.deviceType || 'device'}`,
      type: 'service_update',
      serviceId: service.serviceId,
    });
  } catch (error) {
    console.error('Error sending assignment notification:', error);
  }
};

// Notify when service notes are updated
export const notifyServiceNotesUpdate = async (
  service: ServiceInfo,
  noteType: 'admin' | 'technician',
  updatedBy: string
): Promise<void> => {
  try {
    const staffList = await fetchStaffList();
    const notifyUsers: Set<string> = new Set();
    
    if (noteType === 'admin') {
      // Admin notes updated - notify technician
      const tech = findStaffByName(staffList, service.technician);
      if (tech?.staffId && tech.name !== updatedBy) {
        notifyUsers.add(tech.staffId);
      }
    } else {
      // Technician notes updated - notify management
      const management = getManagementStaff(staffList);
      management.forEach(m => {
        if (m.staffId && m.name !== updatedBy) {
          notifyUsers.add(m.staffId);
        }
      });
    }
    
    const title = `Notes updated for ${service.serviceId}`;
    const message = `${noteType === 'admin' ? 'Admin' : 'Technician'} notes were updated by ${updatedBy}`;
    
    for (const userId of notifyUsers) {
      await createNotification({
        userId,
        title,
        message,
        type: 'service_update',
        serviceId: service.serviceId,
      });
    }
  } catch (error) {
    console.error('Error sending notes notification:', error);
  }
};
