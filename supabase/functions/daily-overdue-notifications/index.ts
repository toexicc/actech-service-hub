import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const GOOGLE_SHEETS_SCRIPT_URL = Deno.env.get("GOOGLE_SHEETS_SCRIPT_URL") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceRecord {
  serviceId: string;
  technician: string;
  adminRep: string;
  clientName: string;
  deviceType: string;
  device: string;
  targetDate: string;
  status: string;
}

interface StaffMember {
  staffId: string;
  name: string;
  role: string;
}

// Normalize staff names like "Kenn Perez - Laptop (Daily Repairs)" -> "Kenn Perez"
const normalizeStaffName = (name: string): string => {
  return name.split(" - ")[0].trim();
};

// Check if date is overdue
const isOverdue = (targetDate: string, status: string): boolean => {
  if (!targetDate) return false;
  const completedStatuses = ["completed", "cancelled", "rto"];
  if (completedStatuses.some(s => status.toLowerCase().includes(s))) return false;
  
  try {
    const parts = targetDate.split(/[-/]/);
    if (parts.length !== 3) return false;
    
    const [month, day, year] = parts;
    const target = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    target.setHours(23, 59, 59, 999);
    
    if (isNaN(target.getTime())) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return today > target;
  } catch {
    return false;
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Daily overdue notifications function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch all services
    console.log("Fetching services from Google Sheets...");
    const servicesResponse = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getServices`
    );
    const servicesData = await servicesResponse.json();
    const services: ServiceRecord[] = servicesData.data || servicesData.services || [];
    console.log(`Found ${services.length} total services`);

    // Fetch staff list
    console.log("Fetching staff list...");
    const staffResponse = await fetch(
      `${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`
    );
    const staffData = await staffResponse.json();
    const staffList: StaffMember[] = staffData.staff || staffData.data || [];
    console.log(`Found ${staffList.length} staff members`);

    // Filter overdue services (excluding completed/cancelled/rto)
    const overdueServices = services.filter(service => {
      const status = service.status?.toLowerCase() || "";
      const isComplete = status.includes("completed") || status.includes("cancelled") || status.includes("rto");
      return !isComplete && isOverdue(service.targetDate, service.status);
    });
    console.log(`Found ${overdueServices.length} overdue services`);

    if (overdueServices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No overdue services found", notificationsSent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Group overdue services by technician and admin
    const technicianOverdue: Map<string, ServiceRecord[]> = new Map();
    const adminOverdue: Map<string, ServiceRecord[]> = new Map();

    for (const service of overdueServices) {
      // Group by technician
      if (service.technician) {
        const techNames = service.technician.split(",").map(t => normalizeStaffName(t.trim())).filter(Boolean);
        for (const techName of techNames) {
          if (!technicianOverdue.has(techName)) {
            technicianOverdue.set(techName, []);
          }
          technicianOverdue.get(techName)!.push(service);
        }
      }

      // Group by admin
      if (service.adminRep) {
        const adminName = normalizeStaffName(service.adminRep);
        if (!adminOverdue.has(adminName)) {
          adminOverdue.set(adminName, []);
        }
        adminOverdue.get(adminName)!.push(service);
      }
    }

    let notificationsSent = 0;

    // Send notifications to technicians
    for (const [techName, services] of technicianOverdue) {
      const tech = staffList.find(s => 
        normalizeStaffName(s.name).toLowerCase() === techName.toLowerCase()
      );
      
      if (tech?.staffId) {
        const serviceIds = services.map(s => s.serviceId).join(", ");
        const message = services.length === 1
          ? `You have 1 overdue service: ${serviceIds}. Please check and update.`
          : `You have ${services.length} overdue services: ${serviceIds}. Please check and update.`;

        const notifResponse = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "createNotification",
            userId: tech.staffId,
            title: `Daily Reminder: ${services.length} Overdue Service${services.length > 1 ? 's' : ''}`,
            message,
            type: "service_update",
          }),
        });
        
        if (notifResponse.ok) {
          notificationsSent++;
          console.log(`Sent overdue notification to technician: ${techName}`);
        }
      }
    }

    // Send notifications to admins
    for (const [adminName, services] of adminOverdue) {
      const admin = staffList.find(s => 
        normalizeStaffName(s.name).toLowerCase() === adminName.toLowerCase()
      );
      
      if (admin?.staffId) {
        const serviceIds = services.map(s => s.serviceId).join(", ");
        const message = services.length === 1
          ? `You have 1 overdue service assigned to you: ${serviceIds}. Please follow up.`
          : `You have ${services.length} overdue services assigned to you: ${serviceIds}. Please follow up.`;

        const notifResponse = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "createNotification",
            userId: admin.staffId,
            title: `Daily Reminder: ${services.length} Overdue Service${services.length > 1 ? 's' : ''}`,
            message,
            type: "service_update",
          }),
        });
        
        if (notifResponse.ok) {
          notificationsSent++;
          console.log(`Sent overdue notification to admin: ${adminName}`);
        }
      }
    }

    console.log(`Total notifications sent: ${notificationsSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${notificationsSent} overdue notifications`,
        notificationsSent,
        overdueCount: overdueServices.length
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in daily-overdue-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
