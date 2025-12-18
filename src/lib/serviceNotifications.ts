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

// Get notification message based on new status
const getStatusNotificationMessages = (
  newStatus: string,
  service: ServiceInfo,
  changedBy: string
): { adminMessage: string; technicianMessage: string } => {
  const deviceInfo = service.device || service.deviceType || 'device';
  
  switch (newStatus) {
    case 'Pending Diagnosis':
      return {
        adminMessage: '',
        technicianMessage: `You have a device that has pending diagnosis (${service.serviceId} - ${service.clientName}'s ${deviceInfo}). When done, update status to Confirmed Diagnosis.`
      };
    
    case 'Confirmed Diagnosis':
      return {
        adminMessage: `Technician already has a diagnosis for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please review and generate a service quotation form and update status to Waiting to Proceed.`,
        technicianMessage: ''
      };
    
    case 'Waiting to Proceed':
      return {
        adminMessage: `Diagnosis sent to client for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for approval.`,
        technicianMessage: ''
      };
    
    case 'Proceed Repair':
      return {
        adminMessage: `Client approved diagnosis for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Service will proceed to repair.`,
        technicianMessage: `Client approved diagnosis for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Service will proceed to repair. Update status to Ongoing Service once you start working on the device.`
      };
    
    case 'Ongoing Service':
      return {
        adminMessage: `Technician is starting the repair for ${service.serviceId} (${service.clientName}'s ${deviceInfo}).`,
        technicianMessage: `After the repair of ${service.serviceId} (${service.clientName}'s ${deviceInfo}), make sure to draft a report, upload checklist and photos, and update status to Done Repair - Observation.`
      };
    
    case 'Done Repair - Observation':
      return {
        adminMessage: `Technician is done with the repair for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Kindly review the report and update status to Done Repair - Advise Client.`,
        technicianMessage: ''
      };
    
    case 'Done Repair - Advise Client':
      return {
        adminMessage: `Report sent to client for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for feedback and update status to For Payment once okay.`,
        technicianMessage: ''
      };
    
    case 'For Payment':
      return {
        adminMessage: `Please process payment with client for ${service.serviceId} (${service.clientName}'s ${deviceInfo}) and update status to For Pickup once okay.`,
        technicianMessage: ''
      };
    
    case 'For Pickup':
      return {
        adminMessage: `Please process pickup details with client for ${service.serviceId} (${service.clientName}'s ${deviceInfo}) and update status to Completed once okay.`,
        technicianMessage: ''
      };
    
    case 'Completed':
      return {
        adminMessage: `Hooray! Service ${service.serviceId} (${service.clientName}'s ${deviceInfo}) is completed!`,
        technicianMessage: `Hooray! Service ${service.serviceId} (${service.clientName}'s ${deviceInfo}) is completed!`
      };
    
    case 'Backjob':
      return {
        adminMessage: `Service ${service.serviceId} (${service.clientName}'s ${deviceInfo}) is tagged as backjob. Please communicate as soon as possible.`,
        technicianMessage: `Service ${service.serviceId} (${service.clientName}'s ${deviceInfo}) is tagged as backjob. Please communicate as soon as possible.`
      };
    
    case 'RTO':
      return {
        adminMessage: `Client didn't want to proceed with service ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please process the return of the unit to the client.`,
        technicianMessage: `Client didn't want to proceed with service ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please process the return of the unit to the client.`
      };
    
    case 'On Hold':
      return {
        adminMessage: `Client is not sure yet with service ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for feedback.`,
        technicianMessage: `Client is not sure yet with service ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for feedback.`
      };
    
    case 'Cancelled':
      return {
        adminMessage: `Client didn't push through with service ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Update status to RTO to process return if unit is on hand.`,
        technicianMessage: `Client didn't push through with service ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Update status to RTO to process return if unit is on hand.`
      };
    
    default:
      return {
        adminMessage: `Service ${service.serviceId} status changed to "${newStatus}" by ${changedBy}.`,
        technicianMessage: `Service ${service.serviceId} status changed to "${newStatus}" by ${changedBy}.`
      };
  }
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
    const messages = getStatusNotificationMessages(newStatus, service, changedBy);
    
    // Notify admins
    if (messages.adminMessage) {
      const admins = getAdminStaff(staffList);
      const management = getManagementStaff(staffList);
      const adminUsers = [...admins, ...management];
      
      for (const admin of adminUsers) {
        if (admin.staffId && admin.name !== changedBy) {
          await createNotification({
            userId: admin.staffId,
            title: `Service ${service.serviceId}: ${newStatus}`,
            message: messages.adminMessage,
            type: 'service_update',
            serviceId: service.serviceId,
          });
        }
      }
    }
    
    // Notify assigned technicians
    if (messages.technicianMessage && service.technician) {
      const techNames = service.technician.split(',').map(t => t.trim());
      for (const techName of techNames) {
        const tech = findStaffByName(staffList, techName);
        if (tech?.staffId && tech.name !== changedBy) {
          await createNotification({
            userId: tech.staffId,
            title: `Service ${service.serviceId}: ${newStatus}`,
            message: messages.technicianMessage,
            type: 'service_update',
            serviceId: service.serviceId,
          });
        }
      }
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
