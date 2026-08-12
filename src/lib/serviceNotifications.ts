import { createNotification } from './notifications';
import { fetchStaffList, type StaffMember } from './staffList';
import { supabase } from '@/integrations/supabase/client';
import { logSystemTicketActivity } from './activityLogger';

/** One audit entry per ticket for the alerts that were just dispatched. */
const logDispatch = (
  recipients: { userId: string; title: string; message: string; serviceId?: string }[],
  pushFailed: boolean,
) => {
  const byService = new Map<string, typeof recipients>();
  recipients.forEach((r) => {
    if (!r.serviceId) return;
    const list = byService.get(r.serviceId) ?? [];
    list.push(r);
    byService.set(r.serviceId, list);
  });
  byService.forEach((list, serviceId) => {
    logSystemTicketActivity(
      serviceId,
      `Notification sent: ${list[0].title}${pushFailed ? ' (push delivery failed, in-app alert saved)' : ''}`,
      {
        Recipients: String(list.length),
        Message: list[0].message,
      },
      'System (Notifications)',
    );
  });
};

// Sends notifications via the service-role edge function so they reliably
// land for offline recipients and even when the caller is unauthenticated.
const sendViaEdge = async (
  recipients: { userId: string; title: string; message: string; serviceId?: string }[],
) => {
  if (!recipients.length) return;
  let delivered = false;
  try {
    const { error } = await supabase.functions.invoke('notify-service-event', { body: { recipients } });
    delivered = !error;
  } catch {
    delivered = false;
  }
  if (delivered) {
    logDispatch(recipients, false);
    return;
  }
  // Fall back to direct inserts so the alert still lands.
  for (const r of recipients) {
    await createNotification({
      userId: r.userId,
      title: r.title,
      message: r.message,
      type: 'service_update',
      serviceId: r.serviceId,
    });
  }
  logDispatch(recipients, true);
};


interface ServiceInfo {
  serviceId: string;
  clientName: string;
  technician: string;
  adminRep?: string;
  receivingStaff?: string;
  deviceType?: string;
  device?: string;
}

/**
 * Notify only the staff member who ran the AI formatter. Works for any role
 * (admin, management, technician) by resolving the current authenticated user.
 */
export const notifyAiOutputGenerated = async (
  service: ServiceInfo,
  kind: 'diagnosis' | 'report' = 'diagnosis',
): Promise<void> => {
  const title = kind === 'report' ? 'AI Report Generated' : 'AI Diagnosis Generated';
  const label = kind === 'report' ? 'service report' : 'diagnosis';
  const message = `⚠️ Please double-check and proofread the AI-generated ${label} for ${service.serviceId} before approving.`;
  try {
    const { data } = await supabase.auth.getUser();
    const actorId = data?.user?.id;
    if (!actorId) return;
    await sendViaEdge([{ userId: actorId, title, message, serviceId: service.serviceId }]);
  } catch {
    // Formatting must remain available even if alert delivery is unavailable.
  }
};


/** Backwards-compatible alias for the diagnosis formatter. */
export const notifyAiDiagnosisGenerated = (service: ServiceInfo): Promise<void> =>
  notifyAiOutputGenerated(service, 'diagnosis');


// Normalize staff labels like "Kenn Perez - Laptop (Daily Repairs)" -> "Kenn Perez"
// and "Special Cases - John Paul Espedido" -> "John Paul Espedido".
const normalizeStaffName = (name: string): string => {
  const parts = (name || '').split(' - ').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (/^special cases$/i.test(parts[0]) && parts[1]) return parts[1];
  return parts[0];
};


// Get staff member by name — exact match first, then tolerant partial matching so
// slightly different spellings/formats still resolve to a real recipient.
const findStaffByName = (staffList: StaffMember[], name: string): StaffMember | undefined => {
  const needle = normalizeStaffName(name).toLowerCase();
  if (!needle) return undefined;
  const exact = staffList.find(s => normalizeStaffName(s.name).toLowerCase() === needle);
  if (exact) return exact;
  const contains = staffList.find(s => {
    const n = normalizeStaffName(s.name).toLowerCase();
    return n.includes(needle) || needle.includes(n);
  });
  if (contains) return contains;
  // Last resort: first-name match
  const first = needle.split(/\s+/)[0];
  return staffList.find(s => normalizeStaffName(s.name).toLowerCase().split(/\s+/)[0] === first);
};


// Get all management staff
const getManagementStaff = (staffList: StaffMember[]): StaffMember[] => {
  return staffList.filter(s => s.role?.toLowerCase() === 'management');
};

// Get notification message based on new status
const getStatusNotificationMessages = (
  newStatus: string,
  service: ServiceInfo,
  changedBy: string,
  clientDeclined = false,
): { adminMessage: string; technicianMessage: string } => {
  const deviceInfo = service.device || service.deviceType || 'device';
  
  switch (newStatus) {
    case 'Pending Diagnosis':
      return {
        adminMessage: '',
        technicianMessage: `You have a device that has pending diagnosis (${service.serviceId} - ${service.clientName}'s ${deviceInfo}). For the assigned technician - when done, update status to Confirmed Diagnosis.`
      };
    
    case 'Confirmed Diagnosis':
      return {
        adminMessage: `Technician already has a diagnosis for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). For the assigned admin - please review and generate a service quotation form and update status to Waiting to Proceed.`,
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
        technicianMessage: `For the assigned technician, after the repair of ${service.serviceId} (${service.clientName}'s ${deviceInfo}), make sure to draft a report, upload checklist and photos, and update status to Done Repair - For Release.`
      };
    
    case 'Done Repair - For Release':
      return {
        adminMessage: `Technician is done with the repair for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). For the assigned admin, kindly review the report and update status to Done Repair - Advise Client.`,
        technicianMessage: ''
      };

    // Some sheets use "Advice" instead of "Advise" — treat as the same status.
    case 'Done Repair - Advise Client':
    case 'Done Repair - Advice Client':
      return {
        adminMessage: `For the assigned admin, send the report to client for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for feedback and update status to Completed once payment and pickup are settled.`,
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
    
    case 'On Hold': {
      if (clientDeclined) {
        const declined = `Client declined the service for ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please prepare the device for return to owner and update status to RTO once returned.`;
        return { adminMessage: declined, technicianMessage: declined };
      }
      return {
        adminMessage: `Client is not sure yet with service ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for feedback.`,
        technicianMessage: `Client is not sure yet with service ${service.serviceId} (${service.clientName}'s ${deviceInfo}). Please monitor for feedback.`
      };
    }
    
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
  clientDeclined = false,
): string => {
  const messages = getStatusNotificationMessages(newStatus, service, '', clientDeclined);
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
    const recipients: { userId: string; title: string; message: string; serviceId?: string }[] = [];
    const seen = new Set<string>();

    const push = (staff: StaffMember | undefined, msg: string) => {
      if (!staff?.staffId || !msg) return;
      const key = `${staff.staffId}::${msg}`;
      if (seen.has(key)) return;
      seen.add(key);
      recipients.push({
        userId: staff.staffId,
        title: `Service ${service.serviceId}: ${newStatus}`,
        message: msg,
        serviceId: service.serviceId,
      });
    };

    if (messages.adminMessage && service.adminRep) {
      const adminNames = service.adminRep.split(',').map(a => a.trim()).filter(Boolean);
      for (const adminName of adminNames) {
        push(findStaffByName(staffList, adminName), messages.adminMessage);
      }
    }

    if (messages.technicianMessage && service.technician) {
      const techNames = service.technician.split(',').map(t => t.trim()).filter(Boolean);
      for (const techName of techNames) {
        push(findStaffByName(staffList, techName), messages.technicianMessage);
      }
    }

    if (service.receivingStaff) {
      const recv = findStaffByName(staffList, service.receivingStaff);
      const recvMsg = messages.adminMessage || messages.technicianMessage;
      push(recv, recvMsg);
    }

    // Safety net: never let a status change go unannounced. If no assignee could
    // be resolved, notify management so someone always sees it.
    if (recipients.length === 0) {
      const fallbackMsg = messages.adminMessage || messages.technicianMessage ||
        `Service ${service.serviceId} status changed to "${newStatus}".`;
      for (const m of getManagementStaff(staffList)) push(m, fallbackMsg);
    }

    await sendViaEdge(recipients);
  } catch (error) {
    console.error('Error sending service notifications:', error);
  }
};

/**
 * A technician raises a concern about a ticket. Notifies every assigned admin
 * rep; falls back to management when no admin can be resolved.
 */
export const notifyTechnicianConcern = async (
  service: ServiceInfo,
  message: string,
  fromName: string,
): Promise<void> => {
  const body = (message || '').trim();
  if (!body) throw new Error('Message is required');

  const staffList = await fetchStaffList();
  const deviceInfo = service.device || service.deviceType || 'device';
  const title = `Concern raised: ${service.serviceId}`;
  const text = `${fromName || 'A technician'}: ${body} (${service.clientName}'s ${deviceInfo})`;

  const recipients: { userId: string; title: string; message: string; serviceId?: string }[] = [];
  const seen = new Set<string>();
  const push = (staff: StaffMember | undefined) => {
    if (!staff?.staffId || seen.has(staff.staffId)) return;
    seen.add(staff.staffId);
    recipients.push({ userId: staff.staffId, title, message: text, serviceId: service.serviceId });
  };

  if (service.adminRep) {
    for (const name of service.adminRep.split(',').map(a => a.trim()).filter(Boolean)) {
      push(findStaffByName(staffList, name));
    }
  }
  if (recipients.length === 0 && service.receivingStaff) {
    push(findStaffByName(staffList, service.receivingStaff));
  }
  if (recipients.length === 0) {
    for (const m of getManagementStaff(staffList)) push(m);
  }
  if (recipients.length === 0) throw new Error('No admin recipient could be resolved');

  await sendViaEdge(recipients);
};

/**
 * An admin/management raises a concern to the ticket's assigned technician(s).
 * Falls back to management when no technician can be resolved.
 */
export const notifyAdminConcern = async (
  service: ServiceInfo,
  message: string,
  fromName: string,
): Promise<void> => {
  const body = (message || '').trim();
  if (!body) throw new Error('Message is required');

  const staffList = await fetchStaffList();
  const deviceInfo = service.device || service.deviceType || 'device';
  const title = `Concern raised: ${service.serviceId}`;
  const text = `${fromName || 'An admin'}: ${body} (${service.clientName}'s ${deviceInfo})`;

  const recipients: { userId: string; title: string; message: string; serviceId?: string }[] = [];
  const seen = new Set<string>();
  const push = (staff: StaffMember | undefined) => {
    if (!staff?.staffId || seen.has(staff.staffId)) return;
    seen.add(staff.staffId);
    recipients.push({ userId: staff.staffId, title, message: text, serviceId: service.serviceId });
  };

  if (service.technician) {
    for (const name of service.technician.split(',').map(t => t.trim()).filter(Boolean)) {
      push(findStaffByName(staffList, name));
    }
  }
  if (recipients.length === 0) {
    for (const m of getManagementStaff(staffList)) push(m);
  }
  if (recipients.length === 0) throw new Error('No technician recipient could be resolved');

  await sendViaEdge(recipients);
};

/** Names of the admins that a concern would be sent to (for UI display). */
export const resolveConcernRecipientNames = async (service: ServiceInfo): Promise<string[]> => {
  try {
    const staffList = await fetchStaffList();
    const names: string[] = [];
    if (service.adminRep) {
      for (const name of service.adminRep.split(',').map(a => a.trim()).filter(Boolean)) {
        const s = findStaffByName(staffList, name);
        if (s?.name) names.push(normalizeStaffName(s.name));
      }
    }
    return names;
  } catch {
    return [];
  }
};

// Notify about new service assignment (handles comma-separated multi-technician strings)
export const notifyNewServiceAssignment = async (
  service: ServiceInfo,
  assignedTo: string,
  assignedBy: string,
): Promise<void> => {
  try {
    const staffList = await fetchStaffList();
    const techNames = (assignedTo || '').split(',').map(t => t.trim()).filter(Boolean);
    const recipients = techNames
      .map(name => ({ name, staff: findStaffByName(staffList, name) }))
      .filter(r => r.staff?.staffId && normalizeStaffName(r.name) !== normalizeStaffName(assignedBy))
      .map(r => ({
        userId: r.staff!.staffId,
        title: `New service assigned: ${service.serviceId}`,
        message: `You have been assigned to ${service.clientName}'s ${service.device || service.deviceType || 'device'}`,
        serviceId: service.serviceId,
      }));
    if (recipients.length) await sendViaEdge(recipients);
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

/** Purchasing/management staff who must know when a ticket starts waiting for parts. */
const PARTS_WATCHERS = ['Jane Espedido', 'Romar Badilles'];

/**
 * Waiting for Parts turned ON — alert the parts watchers (never the person who
 * toggled it) so procurement can start.
 */
export const notifyWaitingForPartsOn = async (
  service: ServiceInfo,
  byName: string,
  note?: string,
): Promise<void> => {
  try {
    const staffList = await fetchStaffList();
    const device = service.device || service.deviceType || 'device';
    const actor = normalizeStaffName(byName || '').toLowerCase();
    const seen = new Set<string>();
    const recipients = PARTS_WATCHERS
      .map((name) => findStaffByName(staffList, name))
      .filter((s): s is StaffMember => !!s?.staffId)
      .filter((s) => normalizeStaffName(s.name).toLowerCase() !== actor)
      .filter((s) => (seen.has(s.staffId) ? false : (seen.add(s.staffId), true)))
      .map((s) => ({
        userId: s.staffId,
        title: `Waiting for Parts: ${service.serviceId}`,
        message:
          `${service.clientName}'s ${device} is waiting for parts` +
          `${byName ? ` (flagged by ${byName})` : ''}.` +
          `${note ? ` Update: ${note}` : ' Please source the required parts/supplies.'}`,
        serviceId: service.serviceId,
      }));
    if (recipients.length) await sendViaEdge(recipients);
  } catch {
    // Toggling must not fail because an alert could not be delivered.
  }
};

/**
 * Waiting for Parts turned OFF — tell the assigned admin(s) and technician(s)
 * that parts are available and the repair can continue.
 */
export const notifyPartsAvailable = async (
  service: ServiceInfo,
  byName: string,
): Promise<void> => {
  try {
    const staffList = await fetchStaffList();
    const device = service.device || service.deviceType || 'device';
    const names = [
      ...(service.adminRep || '').split(','),
      ...(service.technician || '').split(','),
    ]
      .map((n) => n.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const recipients = names
      .map((n) => findStaffByName(staffList, n))
      .filter((s): s is StaffMember => !!s?.staffId)
      .filter((s) => (seen.has(s.staffId) ? false : (seen.add(s.staffId), true)))
      .map((s) => ({
        userId: s.staffId,
        title: `Parts available: ${service.serviceId}`,
        message: `Parts for ${service.clientName}'s ${device} are already available — please proceed to repair.${byName ? ` (Cleared by ${byName})` : ''}`,
        serviceId: service.serviceId,
      }));
    if (recipients.length) await sendViaEdge(recipients);
  } catch {
    // Non-blocking.
  }
};
