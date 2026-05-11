import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Allowlist of host suffixes the webhook may forward notifications to.
// This prevents SSRF against arbitrary internal/external URLs.
const ALLOWED_NOTIFICATION_HOSTS = [
  'script.google.com',
  'googleusercontent.com',
];

const isAllowedNotificationsUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    return ALLOWED_NOTIFICATION_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith('.' + h),
    );
  } catch {
    return false;
  }
};


interface StatusChangePayload {
  serviceId: string;
  oldStatus: string;
  newStatus: string;
  clientName: string;
  technician: string;
  adminRep: string;
  deviceType: string;
  device: string;
  changedBy: string;
  timestamp: string;
  staffList?: Array<{
    staffId: string;
    name: string;
    role: string;
    username?: string;
  }>;
  notificationsUrl: string;
}

// Normalize staff name (e.g., "Kenn Perez - Laptop (Daily Repairs)" -> "Kenn Perez")
const normalizeStaffName = (name: string): string => {
  return name.split(' - ')[0].trim();
};

// Find staff by name
const findStaffByName = (staffList: any[], name: string) => {
  if (!name || !staffList?.length) return undefined;
  const needle = normalizeStaffName(name).toLowerCase();
  return staffList.find(s => normalizeStaffName(s.name || '').toLowerCase() === needle);
};

// Get notification messages based on status
const getStatusNotificationMessages = (
  newStatus: string,
  serviceId: string,
  clientName: string,
  deviceInfo: string
): { adminMessage: string; technicianMessage: string } => {
  switch (newStatus) {
    case 'Pending Diagnosis':
      return {
        adminMessage: '',
        technicianMessage: `You have a device that has pending diagnosis (${serviceId} - ${clientName}'s ${deviceInfo}). For the assigned technician - when done, update status to Confirmed Diagnosis.`
      };
    
    case 'Confirmed Diagnosis':
      return {
        adminMessage: `Technician already has a diagnosis for ${serviceId} (${clientName}'s ${deviceInfo}). For the assigned admin - please review and generate a service quotation form and update status to Waiting to Proceed.`,
        technicianMessage: ''
      };
    
    case 'Waiting to Proceed':
      return {
        adminMessage: `Send the diagnosis to client for ${serviceId} (${clientName}'s ${deviceInfo}). Please monitor for approval.`,
        technicianMessage: ''
      };
    
    case 'Proceed Repair':
      return {
        adminMessage: `Client approved diagnosis for ${serviceId} (${clientName}'s ${deviceInfo}). Service will proceed to repair.`,
        technicianMessage: `Client approved diagnosis for ${serviceId} (${clientName}'s ${deviceInfo}). Service will proceed to repair. Update status to Ongoing Service once you start working on the device.`
      };
    
    case 'Ongoing Service':
      return {
        adminMessage: `Technician is starting the repair for ${serviceId} (${clientName}'s ${deviceInfo}).`,
        technicianMessage: ''
      };
    
    case 'Done Repair - Under Observation':
    case 'Done Repair - Observation':
      return {
        adminMessage: '',
        technicianMessage: `For the assigned technician, after the repair of ${serviceId} (${clientName}'s ${deviceInfo}), make sure to draft a report, upload checklist and photos, and update status to Done Repair - For Release.`
      };
    
    case 'Done Repair - For Release':
      return {
        adminMessage: `Technician is done with the repair for ${serviceId} (${clientName}'s ${deviceInfo}). For the assigned admin, kindly review the report and update status to Done Repair - Advise Client.`,
        technicianMessage: ''
      };

    case 'Done Repair - Advise Client':
    case 'Done Repair - Advice Client':
      return {
        adminMessage: `For the assigned admin, send the report to client for ${serviceId} (${clientName}'s ${deviceInfo}). Please monitor for feedback and update status to Completed once payment and pickup are settled.`,
        technicianMessage: ''
      };
    
    case 'For Payment':
      return {
        adminMessage: `Please process payment with client for ${serviceId} (${clientName}'s ${deviceInfo}) and update status to For Pickup once okay.`,
        technicianMessage: ''
      };
    
    case 'For Pickup':
      return {
        adminMessage: `Please process pickup details with client for ${serviceId} (${clientName}'s ${deviceInfo}) and update status to Completed once okay.`,
        technicianMessage: ''
      };
    
    case 'Completed':
      return {
        adminMessage: `Hooray! Service ${serviceId} (${clientName}'s ${deviceInfo}) is completed!`,
        technicianMessage: `Hooray! Service ${serviceId} (${clientName}'s ${deviceInfo}) is completed!`
      };
    
    case 'Backjob':
      return {
        adminMessage: `Service ${serviceId} (${clientName}'s ${deviceInfo}) is tagged as backjob. Please communicate as soon as possible.`,
        technicianMessage: `Service ${serviceId} (${clientName}'s ${deviceInfo}) is tagged as backjob. Please communicate as soon as possible.`
      };
    
    case 'RTO':
      return {
        adminMessage: `Client didn't want to proceed with service ${serviceId} (${clientName}'s ${deviceInfo}). Please process the return of the unit to the client.`,
        technicianMessage: `Client didn't want to proceed with service ${serviceId} (${clientName}'s ${deviceInfo}). Please process the return of the unit to the client.`
      };
    
    case 'On Hold':
      return {
        adminMessage: `Client is not sure yet with service ${serviceId} (${clientName}'s ${deviceInfo}). Please monitor for feedback.`,
        technicianMessage: `Client is not sure yet with service ${serviceId} (${clientName}'s ${deviceInfo}). Please monitor for feedback.`
      };
    
    case 'Cancelled':
      return {
        adminMessage: `Client didn't push through with service ${serviceId} (${clientName}'s ${deviceInfo}). Update status to RTO to process return if unit is on hand.`,
        technicianMessage: `Client didn't push through with service ${serviceId} (${clientName}'s ${deviceInfo}). Update status to RTO to process return if unit is on hand.`
      };
    
    default:
      return {
        adminMessage: `Service ${serviceId} status changed to "${newStatus}".`,
        technicianMessage: `Service ${serviceId} status changed to "${newStatus}".`
      };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated caller
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: StatusChangePayload = await req.json();

    // SSRF guard: only allow notification forwarding to vetted hosts
    if (payload.notificationsUrl && !isAllowedNotificationsUrl(payload.notificationsUrl)) {
      return new Response(JSON.stringify({ error: 'notificationsUrl host not allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    
    console.log('[Webhook] Received status change:', {
      serviceId: payload.serviceId,
      oldStatus: payload.oldStatus,
      newStatus: payload.newStatus,
      changedBy: payload.changedBy,
    });

    // Skip if no status change or missing data
    if (!payload.serviceId || !payload.newStatus || payload.oldStatus === payload.newStatus) {
      return new Response(
        JSON.stringify({ success: true, message: 'No status change to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffList = payload.staffList || [];
    const deviceInfo = payload.device || payload.deviceType || 'device';
    const messages = getStatusNotificationMessages(
      payload.newStatus,
      payload.serviceId,
      payload.clientName,
      deviceInfo
    );

    const notificationsToSend: Array<{
      userId: string;
      title: string;
      message: string;
      type: string;
      serviceId: string;
    }> = [];

    // Notify assigned admin
    if (messages.adminMessage && payload.adminRep) {
      const admin = findStaffByName(staffList, payload.adminRep);
      if (admin?.staffId) {
        notificationsToSend.push({
          userId: admin.staffId,
          title: `Service ${payload.serviceId}: ${payload.newStatus}`,
          message: messages.adminMessage,
          type: 'service_update',
          serviceId: payload.serviceId,
        });
      }
    }

    // Notify assigned technicians
    if (messages.technicianMessage && payload.technician) {
      const techNames = payload.technician.split(',').map(t => t.trim()).filter(Boolean);
      for (const techName of techNames) {
        const tech = findStaffByName(staffList, techName);
        if (tech?.staffId) {
          notificationsToSend.push({
            userId: tech.staffId,
            title: `Service ${payload.serviceId}: ${payload.newStatus}`,
            message: messages.technicianMessage,
            type: 'service_update',
            serviceId: payload.serviceId,
          });
        }
      }
    }

    // Send notifications via Google Sheets Script
    const results = await Promise.allSettled(
      notificationsToSend.map(async (notification) => {
        const params = new URLSearchParams({
          action: 'createNotification',
          userId: notification.userId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          serviceId: notification.serviceId,
        });

        const response = await fetch(payload.notificationsUrl, {
          method: 'POST',
          body: params,
        });

        return response.ok;
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    console.log('[Webhook] Notifications sent:', {
      total: notificationsToSend.length,
      success: successCount,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed status change: ${payload.oldStatus} -> ${payload.newStatus}`,
        notificationsSent: successCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
