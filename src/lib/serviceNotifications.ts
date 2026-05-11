import { createNotification } from './notifications';
import { fetchStaffList, type StaffMember } from './staffList';

interface ServiceInfo {
  serviceId: string;
  clientName: string;
  technician: string;
  adminRep?: string;
  receivingStaff?: string;
  deviceType?: string;
  device?: string;
}

// Normalize staff names like "Kenn Perez - Laptop (Daily Repairs)" -> "Kenn Perez"
const normalizeStaffName = (name: string): string => {
  return name.split(' - ')[0].trim();
};

// Get staff member by name
const findStaffByName = (staffList: StaffMember[], name: string): StaffMember | undefined => {
  const needle = normalizeStaffName(name).toLowerCase();
  return staffList.find(s => normalizeStaffName(s.name).toLowerCase() === needle);
};

// Get all management staff
const getManagementStaff = (staffList: StaffMember[]): StaffMember[] => {
  return staffList.filter(s => s.role?.toLowerCase() === 'management');
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
        adminMessage: `Send the diagnosis to client for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for approval.`,
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
        technicianMessage: ''
      };
    
    case 'Done Repair - Under Observation':
    case 'Done Repair - Observation':
      return {
        adminMessage: '',
        technicianMessage: `After the repair of ${service.serviceId} (${service.clientName}'s ${deviceInfo}), make sure to draft a report, upload checklist and photos, and update status to Done Repair - Under Observation.`
      };
    
    case 'Done Repair - For Release':
      return {
        adminMessage: `Technician is done with the repair for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Kindly review the report and update status to Done Repair - Advise Client.`,
        technicianMessage: ''
      };

    // Some sheets use "Advice" instead of "Advise" — treat as the same status.
    case 'Done Repair - Advise Client':
    case 'Done Repair - Advice Client':
      return {
        adminMessage: `Send the report to client for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for feedback and update status to Completed once payment and pickup are settled.`,
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

// Public helper used by UI (StatusProgressBar) to show a role-aware "what to do next" message.
export const getStatusGuidance = (
  newStatus: string,
  service: ServiceInfo,
  role: 'admin' | 'management' | 'technician',
): string => {
  const messages = getStatusNotificationMessages(newStatus, service, '');
  if (role === 'technician') return messages.technicianMessage || messages.adminMessage || '';
  return messages.adminMessage || messages.technicianMessage || '';
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
    
    // Notify ALL ASSIGNED admins (from column C - adminRep, comma-separated)
    if (messages.adminMessage && service.adminRep) {
      const adminNames = service.adminRep.split(',').map(a => a.trim()).filter(Boolean);
      for (const adminName of adminNames) {
        const assignedAdmin = findStaffByName(staffList, adminName);
        if (assignedAdmin?.staffId) {
          await createNotification({
            userId: assignedAdmin.staffId,
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
      const techNames = service.technician.split(',').map(t => t.trim()).filter(Boolean);
      for (const techName of techNames) {
        const tech = findStaffByName(staffList, techName);
        if (tech?.staffId) {
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

    // Also notify the receiving staff (single name) on every status change
    // so the front desk that intook the device stays in the loop.
    if (service.receivingStaff) {
      const recv = findStaffByName(staffList, service.receivingStaff);
      const recvMsg = messages.adminMessage || messages.technicianMessage;
      if (recv?.staffId && recvMsg) {
        await createNotification({
          userId: recv.staffId,
          title: `Service ${service.serviceId}: ${newStatus}`,
          message: recvMsg,
          type: 'service_update',
          serviceId: service.serviceId,
        });
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
    if (!tech?.staffId || normalizeStaffName(assignedTo) === normalizeStaffName(assignedBy)) return;
    
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
      const techNames = service.technician.split(',').map(t => t.trim()).filter(Boolean);
      for (const techName of techNames) {
        const tech = findStaffByName(staffList, techName);
        if (tech?.staffId && normalizeStaffName(tech.name) !== normalizeStaffName(updatedBy)) {
          notifyUsers.add(tech.staffId);
        }
      }
    } else {
      // Technician notes updated - notify ALL assigned admins
      if (service.adminRep) {
        const adminNames = service.adminRep.split(',').map(a => a.trim()).filter(Boolean);
        for (const adminName of adminNames) {
          const assignedAdmin = findStaffByName(staffList, adminName);
          if (assignedAdmin?.staffId && normalizeStaffName(assignedAdmin.name) !== normalizeStaffName(updatedBy)) {
            notifyUsers.add(assignedAdmin.staffId);
          }
        }
      }
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
