// Sheets-Bridge Edge Function
// Mimics the legacy Google Apps Script API so the frontend (which still calls
// GOOGLE_SHEETS_SCRIPT_URL with action=...) keeps working unchanged while
// reading/writing all data from Lovable Cloud (Supabase) instead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ---------- Auth helpers ----------
// Actions safe to call without authentication (used by the public /track page)
const PUBLIC_ACTIONS = new Set<string>([
  "searchService",
  "searchClient",
  "getDeviceReportPhotos",
  "getServiceLogs",
  "getServicePayments",
]);

// Actions that require admin or management role on top of authentication
const ADMIN_ACTIONS = new Set<string>([
  "getSalaryLogs",
  "disburseSalary",
  "addTransaction",
  "editTransaction",
  "deleteTransaction",
  "deleteClosedDate",
]);

interface CallerContext {
  userId: string;
  isAdminOrManagement: boolean;
}

async function authenticateCaller(req: Request): Promise<CallerContext | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  const { data: roleRows } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const roles = (roleRows ?? []).map((r: any) => r.role);
  return {
    userId: data.user.id,
    isAdminOrManagement: roles.includes("admin") || roles.includes("management"),
  };
}

// Strip sensitive fields from a service record for unauthenticated public access.
const stripSensitiveServiceFields = (svc: any) => {
  const { internalAdminNotes, internalTechnicianNotes, adminNotesInternal,
    address, email, contactNumber, ...rest } = svc;
  return {
    ...rest,
    address: "",
    email: "",
    contactNumber: contactNumber ? contactNumber.replace(/.(?=.{4})/g, "*") : "",
    internalAdminNotes: "",
    internalTechnicianNotes: "",
    adminNotesInternal: "",
  };
};


// ---------- Helpers ----------
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (message: string, status = 400) =>
  json({ status: "error", result: "error", message }, status);

const splitList = (s: string | null | undefined): string[] =>
  String(s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const num = (v: any): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const genId = (prefix: string, len = 11) =>
  prefix + String(Math.floor(Math.random() * 10 ** len)).padStart(len, "0");

const mapServiceForLegacy = (r: any) => ({
  serviceId: r.service_id ?? "",
  clientId: r.client_id ?? "",
  clientName: r.client_name ?? "",
  contactNumber: r.contact_number ?? "",
  email: r.email ?? "",
  address: r.address ?? "",
  deviceType: r.device_type ?? "",
  brand: r.brand ?? "",
  device: [r.device_type, r.brand, r.model].filter(Boolean).join(" "),
  model: r.model ?? "",
  serialNumber: r.serial_number ?? "",
  service: r.service ?? "",
  chiefComplaint: r.issue_description ?? "",
  issueDescription: r.issue_description ?? "",
  diagnosis: r.diagnosis ?? "",
  technicianDiagnosis: r.diagnosis ?? "",
  aiDiagnosis: r.diagnosis ?? "",
  technicianReport: r.ai_report ?? "",
  aiReport: r.ai_report ?? "",
  status: r.status ?? "",
  technician: (r.technicians ?? []).join(", "),
  technicianAssigned: (r.technicians ?? []).join(", "),
  technicianDepartment: (r.technician_departments ?? []).join(", "),
  adminRep: (r.admin_reps ?? []).join(", "),
  adminRepresentative: (r.admin_reps ?? []).join(", "),
  receivingStaff: r.receiving_staff ?? "",
  dateReceived: r.date_received ?? "",
  targetDate: r.target_date ?? "",
  estimatedCompletion: r.estimated_completion ?? "",
  timeFrame: r.estimated_completion ?? "",
  dateCompleted: r.date_completed ?? "",
  partsUsed: (r.parts_used ?? []).join(", "),
  partsCost: "0",
  laborCost: String(r.labor_cost ?? 0),
  serviceCost: String(r.service_cost ?? 0),
  finalCost: String(r.total_cost ?? r.service_cost ?? 0),
  totalCost: String(r.total_cost ?? 0),
  discount: "0",
  initialPayment: String(r.initial_payment ?? 0),
  paymentStatus: r.payment_status ?? "",
  modeOfTransfer: r.mode_of_transfer ?? "",
  remarks: r.remarks ?? "",
  adminNotes: r.remarks ?? "",
  adminNotesInternal: r.internal_admin_notes ?? "",
  internalAdminNotes: r.internal_admin_notes ?? "",
  internalTechnicianNotes: r.internal_technician_notes ?? "",
  aiToggle: r.ai_toggle ?? "",
  preOrder: r.pre_order ?? "",
  partId: r.part_id ?? "",
  driveFolderUrl: r.drive_folder_url ?? "",
  clientFolderUrl: r.drive_folder_url ?? "",
  deviceReportFolderUrl: r.device_report_folder_url ?? "",
  quotationPdfUrl: "",
  clientType: r.priority === "Loyalty" ? "Returning Client" : "New Client",
  priority: r.priority ?? "",
  lastUpdated: r.last_updated ?? "",
});

// Convert a base64 string to Uint8Array
const b64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const uploadBase64 = async (
  bucket: string,
  path: string,
  base64: string,
  contentType: string,
): Promise<string | null> => {
  if (!base64) return null;
  const bytes = b64ToBytes(base64);
  const { error } = await sb.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.error("upload err", bucket, path, error.message);
    return null;
  }
  return path;
};

// Parse body whether multipart/form-data or x-www-form-urlencoded
async function parseBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return await req.json();
  }
  // FormData covers both multipart and urlencoded in Deno
  const fd = await req.formData();
  const out: Record<string, any> = {};
  for (const [k, v] of fd.entries()) {
    out[k] = typeof v === "string" ? v : v; // keep File objects as-is
  }
  return out;
}

// ---------- Action handlers ----------
async function searchService(serviceId: string) {
  if (!serviceId) return err("serviceId required");
  const { data, error } = await sb
    .from("services")
    .select("*")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error) return err(error.message, 500);
  if (!data) return json({ status: "not_found" });
  return json({ status: "found", data: mapServiceForLegacy(data) });
}

async function searchClient(clientId: string) {
  if (!clientId) return err("clientId required");
  const { data: client } = await sb
    .from("clients")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client) return json({ status: "not_found", found: false });

  const { data: services } = await sb
    .from("services")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const customer = {
    clientName: client.name,
    username: "",
    contactNumber: client.contact_number,
    phone: client.contact_number,
    email: client.email,
    address: client.address,
  };

  return json({
    status: "success",
    found: true,
    customer,
    data: customer,
    services: (services ?? []).map(mapServiceForLegacy),
  });
}

async function getTransactions() {
  const { data, error } = await sb
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .limit(2000);
  if (error) return err(error.message, 500);
  const transactions = (data ?? []).map((t: any) => ({
    transactionId: t.transaction_id,
    serviceId: t.service_id ?? "",
    transactionType: t.type,
    modeOfPayment: t.payment_method ?? "",
    name: t.client_name ?? "",
    device: "",
    amount: String(t.amount),
    serviceCost: "0",
    partsCost: "0",
    finalCost: "0",
    remaining: "0",
    timestamp: t.transaction_date,
    attendant: t.created_by_name ?? "",
    remarks: t.description ?? "",
    fundSource: t.fund_name ?? "",
    category: t.category ?? "",
    status: t.status,
  }));
  return json({ status: "success", transactions });
}

async function getServicePayments(serviceId: string) {
  const { data } = await sb
    .from("transactions")
    .select("amount,type")
    .eq("service_id", serviceId);
  const totalPaid = (data ?? [])
    .filter((t: any) => t.type !== "Refund")
    .reduce((s: number, t: any) => s + num(t.amount), 0);
  return json({ status: "success", totalPaid });
}

async function getServiceLogs(serviceId: string, limit = 50) {
  const { data } = await sb
    .from("activity_logs")
    .select("*")
    .or(`entity_id.eq.${serviceId},action.ilike.%${serviceId}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  const logs = (data ?? []).map((l: any) => ({
    logId: l.id,
    serviceId: l.entity_id ?? "",
    timestamp: l.created_at,
    username: l.actor_name ?? "",
    role: "",
    activity: l.action,
  }));
  return json({ status: "success", logs });
}

async function getDeviceReportPhotos(folderId: string) {
  // folderId historically was a Drive folder ID; now we treat it as a service_id
  const sid = folderId;
  const { data } = await sb
    .from("service_files")
    .select("*")
    .eq("service_id", sid)
    .eq("kind", "device_report")
    .order("uploaded_at", { ascending: true });
  const photos = await Promise.all(
    (data ?? []).map(async (f: any) => {
      const { data: signed } = await sb.storage
        .from(f.bucket)
        .createSignedUrl(f.storage_path, 60 * 60);
      return {
        id: f.id,
        name: f.filename ?? "photo",
        url: signed?.signedUrl ?? "",
        thumbnailUrl: signed?.signedUrl ?? "",
      };
    }),
  );
  return json({ status: "success", photos });
}

async function getClientInquiries() {
  const { data } = await sb
    .from("client_inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  const arr = (data ?? []).map((i: any, idx: number) => ({
    rowIndex: idx,
    id: i.id,
    clientId: "",
    serviceId: i.service_id ?? "",
    timestamp: i.created_at,
    name: i.client_name,
    address: "",
    contactNumber: i.contact_number ?? "",
    modeOfTransfer: i.mode_of_transfer ?? "",
    device: [i.device_type, i.brand, i.model].filter(Boolean).join(" "),
    initialDiagnosis: i.issue_description ?? "",
    quotation: "",
    pickUpDate: "",
    directChatLink: "",
    aiStatus: i.ai_toggle ?? "",
    preOrder: i.pre_order ?? "",
    initialPayment: String(i.initial_payment ?? 0),
    partId: i.part_id ?? "",
  }));
  return json({ status: "success", data: arr });
}

async function getSalaryLogs() {
  const { data } = await sb
    .from("salary_disbursements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  const logs = (data ?? []).map((l: any) => ({
    id: l.id,
    timestamp: l.created_at,
    staffId: l.staff_id,
    staffName: l.staff_name,
    salaryAmount: String(l.net_pay ?? l.gross_pay ?? 0),
    status: l.status,
    disbursedBy: "",
    fundSource: "",
    period: l.period_label,
  }));
  return json({ status: "success", logs });
}

async function getAllOngoingServices() {
  const { data } = await sb
    .from("services")
    .select("*")
    .neq("status", "Completed")
    .order("created_at", { ascending: false })
    .limit(2000);
  return json({
    status: "success",
    services: (data ?? []).map(mapServiceForLegacy),
  });
}

async function getApiKey() {
  // Don't expose secrets; just return a placeholder so callers can succeed
  return json({ status: "success", apiKey: "" });
}

// AI formatting via Lovable AI Gateway
async function callLovableAI(messages: any[], temperature = 0.2) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", temperature, messages }),
  });
  if (r.status === 429) throw new Error("rate limit exceeded");
  if (r.status === 402)
    throw new Error("AI credits exhausted - please contact admin");
  if (!r.ok) throw new Error(`AI error ${r.status}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const stripMarkdown = (s: string): string =>
  String(s ?? "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[“”]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

async function formatDiagnosis(p: URLSearchParams) {
  const raw = p.get("rawDiagnosis") ?? "";
  if (!raw) return err("rawDiagnosis required");
  const customerName = p.get("customerName") ?? "";
  const deviceType = p.get("deviceType") ?? "";
  const model = p.get("model") ?? "";
  const serviceId = p.get("serviceId") ?? "";
  const systemPrompt = `You are a professional technical diagnostician for AC Tech Repair PH.

You will reformat raw technician notes into a customer-friendly diagnosis report.

You MUST output the report using EXACTLY the template below, in the same order, with the same labels, and with the same blank lines between sections. Do NOT add any greeting, sign-off, headers, sections, or commentary that are not in the template. Do NOT change the wording of any label.

EXACT OUTPUT TEMPLATE (replace bracketed values, keep everything else verbatim):

Customer Name: <customerName>
Device Type: <deviceType>
Model: <model>
Service ID: <serviceId>

AC TECH DEVICE DIAGNOSIS

Findings:
<clear explanation of what was found during inspection>

Cause of Issue:
<simple explanation of the root cause>

Suggested Solution:
<specific repair actions needed>

Recommendations:
<professional advice for the customer>

Service Breakdown:
<Service Item 1> - Php <Amount>
<Service Item 2> - Php <Amount>

To proceed with the service, PROCEED or APPROVE to confirm your approval and kindly review our Terms and Conditions: bit.ly/actech-termsnconditions

SUMMARY: <one-line summary of the repair needed>

WRITING RULES:
Friendly, professional, and customer-oriented.
Straight to the point.
Use simple and easy-to-understand language.
Formal quotation style.
Plain text only.
No markdown formatting at all. Never output **, __, ##, backticks, asterisks, or any markdown.
No bullet points or numbered lists.
No em dashes. Use regular hyphens only.
No quotation marks unless necessary.
Always price as: Php <amount> (example: Php 1500). Use a plain number, no currency symbol other than "Php".
List every Service Breakdown item on its own line in the format "<Service Name> - Php <Amount>".
Use the exact section labels and order shown in the template. Do not add or remove sections.`;
  const userPrompt = `customerName: ${customerName}
deviceType: ${deviceType}
model: ${model}
serviceId: ${serviceId}

Raw technician notes:
${raw}

Produce the report now using the EXACT template. Do not include this instruction in your output.`;
  try {
    const content = await callLovableAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    return json({ status: "success", formattedDiagnosis: stripMarkdown(content) });
  } catch (e: any) {
    return json({ error: e.message }, 200);
  }
}

async function formatReport(p: URLSearchParams) {
  const raw = p.get("technicianReport") ?? "";
  if (!raw) return err("technicianReport required");
  const customerName = p.get("customerName") ?? "";
  const deviceType = p.get("deviceType") ?? "";
  const model = p.get("model") ?? "";
  const serviceId = p.get("serviceId") ?? "";
  const finalCost = p.get("finalCost") ?? "0";
  const systemPrompt = `You are a professional service report writer for AC Tech Repair PH.

You will reformat the technician's raw report notes into a customer-friendly service report.

You MUST output the report using EXACTLY the template below, in the same order, with the same labels, and with the same blank lines between sections. Do NOT add any greeting, sign-off, headers, sections, or commentary that are not in the template. Do NOT change the wording of any label.

EXACT OUTPUT TEMPLATE (replace bracketed values, keep everything else verbatim):

Customer Name: <customerName>
Device Type: <deviceType>
Model: <model>
Service ID: <serviceId>

AC TECH SERVICE REPORT

Work Performed:
<clear explanation of the work performed on the device>

Technical Findings:
<observations made during the service>

Final Status:
<final condition of the device>

Recommendations:
<professional advice for device maintenance and care>

Service Cost: Php <serviceCost>

WRITING RULES:
Friendly, professional, and customer-oriented.
Straight to the point.
Use simple and easy-to-understand language.
Formal service report style.
Plain text only.
No markdown formatting at all. Never output **, __, ##, backticks, asterisks, or any markdown.
No bullet points or numbered lists.
No em dashes. Use regular hyphens or commas instead.
No quotation marks unless necessary.
Use clear section labels exactly as shown in the template.`;
  const userPrompt = `customerName: ${customerName}
deviceType: ${deviceType}
model: ${model}
serviceId: ${serviceId}
serviceCost: ${finalCost}

Raw technician report:
${raw}

Produce the report now using the EXACT template. Do not include this instruction in your output.`;
  try {
    const content = await callLovableAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    return json({ status: "success", formattedReport: stripMarkdown(content) });
  } catch (e: any) {
    return json({ error: e.message }, 200);
  }
}

// ---------- WRITE handlers ----------
async function createIntake(b: Record<string, any>) {
  const serviceId = b["Service ID"] || genId("AC");
  const clientId = b["Client ID"] || `CL${Date.now()}`;
  const clientName = b["Client Name"] || "";
  const technicians = splitList(b["Technician"]);
  const techDepts = splitList(b["Technician Department"]);
  const adminReps = splitList(b["Admin Representative"]);

  // Upsert client
  if (clientName) {
    await sb
      .from("clients")
      .upsert(
        {
          client_id: clientId,
          name: clientName,
          email: b["Email"] || null,
          contact_number: b["Phone"] || null,
        },
        { onConflict: "client_id" },
      );
  }

  // Upload PDF / signature / annotation if provided as base64
  const pdfPath = await uploadBase64(
    "intake-forms",
    `${serviceId}/${b["PDF_FileName"] || `${serviceId}.pdf`}`,
    b["PDF_Base64"] ?? "",
    b["PDF_MimeType"] ?? "application/pdf",
  );
  const sigPath = await uploadBase64(
    "signatures",
    `${serviceId}/${b["Signature_FileName"] || `${serviceId}_sig.png`}`,
    b["Signature_Base64"] ?? "",
    b["Signature_MimeType"] ?? "image/png",
  );
  const annPath = await uploadBase64(
    "annotations",
    `${serviceId}/${b["DeviceAnnotation_FileName"] || `${serviceId}_ann.png`}`,
    b["DeviceAnnotation_Base64"] ?? "",
    b["DeviceAnnotation_MimeType"] ?? "image/png",
  );

  const { error } = await sb.from("services").insert({
    service_id: serviceId,
    client_id: clientId,
    client_name: clientName,
    contact_number: b["Phone"] || "",
    email: b["Email"] || "",
    device_type: b["Device Type"] || "",
    brand: b["Brand"] || "",
    model: b["Model"] || "",
    serial_number: b["Serial"] || "",
    issue_description: b["Chief Complaint"] || "",
    technicians,
    technician_departments: techDepts,
    admin_reps: adminReps,
    receiving_staff: b["Receiving Staff"] || null,
    estimated_completion: b["Time Frame"] || "",
    service_cost: num(b["Estimated Cost"]),
    priority: b["Priority"] || "",
    remarks: b["AnnotationNotes"] || null,
    status: "Pending Diagnosis",
  });
  if (error) return err(error.message, 500);

  // Track files
  const files: any[] = [];
  if (pdfPath)
    files.push({
      service_id: serviceId,
      bucket: "intake-forms",
      storage_path: pdfPath,
      filename: b["PDF_FileName"] || `${serviceId}.pdf`,
      kind: "intake_form",
      mime_type: "application/pdf",
    });
  if (sigPath)
    files.push({
      service_id: serviceId,
      bucket: "signatures",
      storage_path: sigPath,
      filename: b["Signature_FileName"] || `${serviceId}_sig.png`,
      kind: "signature",
      mime_type: "image/png",
    });
  if (annPath)
    files.push({
      service_id: serviceId,
      bucket: "annotations",
      storage_path: annPath,
      filename: b["DeviceAnnotation_FileName"] || `${serviceId}_ann.png`,
      kind: "annotation",
      mime_type: "image/png",
    });
  if (files.length) await sb.from("service_files").insert(files);

  return json({ status: "success", result: "success", serviceId });
}

async function updateService(b: Record<string, any>) {
  const sid = b.serviceId || b["Service ID"];
  if (!sid) return err("serviceId required");

  const patch: Record<string, any> = { last_updated: new Date().toISOString() };
  if (b.status) patch.status = b.status;
  if (b.deviceType !== undefined) patch.device_type = b.deviceType;
  if ("adminRep" in b)
    patch.admin_reps = splitList(b.adminRep);
  if ("technician" in b) {
    patch.technicians = splitList(b.technician);
    if (b.technicianDepartment || b.department || b["Technician Department"]) {
      patch.technician_departments = splitList(
        b.technicianDepartment || b.department || b["Technician Department"],
      );
    }
  }
  if ("priority" in b) patch.priority = b.priority;
  if ("aiDiagnosis" in b) patch.diagnosis = b.aiDiagnosis;
  if ("aiReport" in b) patch.ai_report = b.aiReport;
  if ("services" in b) patch.service = b.services;
  if ("serviceCost" in b) patch.service_cost = num(b.serviceCost);
  if ("finalCost" in b) patch.total_cost = num(b.finalCost);
  if ("targetDate" in b && b.targetDate) {
    // Convert MM-dd-yyyy to ISO date
    const m = String(b.targetDate).match(/(\d{2})-(\d{2})-(\d{4})/);
    if (m) patch.target_date = `${m[3]}-${m[1]}-${m[2]}`;
  }
  if ("adminNotes" in b) patch.remarks = b.adminNotes;
  if ("adminNotesInternal" in b)
    patch.internal_admin_notes = b.adminNotesInternal;
  if ("technicianDiagnosis" in b) patch.diagnosis = b.technicianDiagnosis;
  if ("internalTechnicianNotes" in b)
    patch.internal_technician_notes = b.internalTechnicianNotes;
  if ("partsUsed" in b) patch.parts_used = splitList(b.partsUsed);
  if ("aiToggle" in b) patch.ai_toggle = b.aiToggle;
  if ("preOrder" in b) patch.pre_order = b.preOrder;
  if ("partId" in b) patch.part_id = b.partId;
  if (b.status === "Completed" && !b.dateCompleted)
    patch.date_completed = new Date().toISOString();

  const { error } = await sb
    .from("services")
    .update(patch)
    .eq("service_id", sid);
  if (error) return err(error.message, 500);

  // Optional device-report photo uploads (DeviceReportPhoto1, DeviceReportPhoto2, ...)
  const photos: any[] = [];
  for (let i = 1; i <= 50; i++) {
    const base64 = b[`DeviceReportPhoto${i}`];
    if (!base64) break;
    const name = b[`DeviceReportPhoto${i}_Name`] || `${sid}_photo_${i}.png`;
    const path = await uploadBase64(
      "device-reports",
      `${sid}/${Date.now()}_${name}`,
      base64,
      "image/png",
    );
    if (path)
      photos.push({
        service_id: sid,
        bucket: "device-reports",
        storage_path: path,
        filename: name,
        kind: "device_report",
        mime_type: "image/png",
      });
  }
  if (photos.length) await sb.from("service_files").insert(photos);

  return json({ status: "success", result: "success" });
}

async function updateServicePDF(b: Record<string, any>) {
  const sid = b.serviceId;
  if (!sid) return err("serviceId required");
  const path = await uploadBase64(
    "intake-forms",
    `${sid}/${b.PDF_FileName || `${sid}.pdf`}`,
    b.PDF_Base64 ?? "",
    b.PDF_MimeType ?? "application/pdf",
  );
  if (path) {
    await sb.from("service_files").insert({
      service_id: sid,
      bucket: "intake-forms",
      storage_path: path,
      filename: b.PDF_FileName,
      kind: "intake_form",
      mime_type: "application/pdf",
    });
  }
  return json({ status: "success", result: "success" });
}

async function updateQuotationPDF(b: Record<string, any>) {
  const sid = b.serviceId;
  if (!sid) return err("serviceId required");
  const path = await uploadBase64(
    "quotation-forms",
    `${sid}/${b.QuotationPDF_FileName || `${sid}_quote.pdf`}`,
    b.QuotationPDF_Base64 ?? "",
    b.QuotationPDF_MimeType ?? "application/pdf",
  );
  if (path) {
    await sb.from("service_files").insert({
      service_id: sid,
      bucket: "quotation-forms",
      storage_path: path,
      filename: b.QuotationPDF_FileName,
      kind: "quotation",
      mime_type: "application/pdf",
    });
  }
  return json({ status: "success", result: "success" });
}

async function deleteDeviceReportPhoto(b: Record<string, any>) {
  const sid = b.serviceId;
  const fileId = b.fileId;
  if (!sid || !fileId) return err("serviceId/fileId required");
  // fileId may be Supabase file uuid or legacy drive id
  const { data } = await sb
    .from("service_files")
    .select("*")
    .eq("service_id", sid)
    .eq("kind", "device_report");
  const target = (data ?? []).find(
    (f: any) => f.id === fileId || f.storage_path.includes(fileId),
  );
  if (target) {
    await sb.storage.from(target.bucket).remove([target.storage_path]);
    await sb.from("service_files").delete().eq("id", target.id);
  }
  return json({ status: "success", result: "success" });
}

async function updateClientInquiry(b: Record<string, any>) {
  const id = b.id || b.rowIndex;
  if (!id) return err("id required");
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if ("name" in b) patch.client_name = b.name;
  if ("contactNumber" in b) patch.contact_number = b.contactNumber;
  if ("modeOfTransfer" in b) patch.mode_of_transfer = b.modeOfTransfer;
  if ("device" in b) {
    const parts = String(b.device).split(" ");
    patch.device_type = parts[0] || null;
    patch.brand = parts[1] || null;
    patch.model = parts.slice(2).join(" ") || null;
  }
  if ("initialDiagnosis" in b) patch.issue_description = b.initialDiagnosis;
  if ("preOrder" in b) patch.pre_order = b.preOrder;
  if ("initialPayment" in b) patch.initial_payment = num(b.initialPayment);
  if ("partId" in b) patch.part_id = b.partId;
  if ("serviceId" in b) patch.service_id = b.serviceId;
  if ("aiStatus" in b || "aiToggle" in b)
    patch.ai_toggle = b.aiStatus || b.aiToggle;

  const q = sb.from("client_inquiries").update(patch);
  const { error } =
    typeof id === "string" && id.length > 20
      ? await q.eq("id", id)
      : await q.eq("id", String(id));
  if (error) return err(error.message, 500);
  return json({ status: "success", result: "success", updated: true });
}

async function updateInquiryPartIdByServiceId(b: Record<string, any>) {
  const sid = b.serviceId;
  const partId = b.partId;
  if (!sid || !partId) return err("serviceId/partId required");
  const { error, count } = await sb
    .from("client_inquiries")
    .update({ part_id: partId, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("service_id", sid);
  if (error) return err(error.message, 500);
  return json({ status: "success", updated: (count ?? 0) > 0 });
}

// ---- Inventory ----
async function addInventoryItem(b: Record<string, any>) {
  const partId = genId("PRT", 8);
  const { error } = await sb.from("inventory_parts").insert({
    part_id: partId,
    part_name: b.partName,
    category: b.deviceType,
    brand: b.brand,
    device_model: b.model,
    part_type: b.partType,
    quantity: parseInt(b.quantity || "0"),
    cost_price: num(b.costPerUnit),
    supplier: b.supplier || null,
    notes: b.remarks || null,
    status: b.status || "In Stock",
  });
  if (error) return err(error.message, 500);
  await sb.from("part_logs").insert({
    part_id: partId,
    action: "ADD",
    quantity: parseInt(b.quantity || "0"),
    performed_by_name: b.addedBy || "System",
    notes: `Added: ${b.partName}`,
  });
  return json({ status: "success", result: "success", partId });
}

async function updateInventoryItem(b: Record<string, any>) {
  if (!b.partId) return err("partId required");
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if ("partName" in b) patch.part_name = b.partName;
  if ("deviceType" in b) patch.category = b.deviceType;
  if ("brand" in b) patch.brand = b.brand;
  if ("model" in b) patch.device_model = b.model;
  if ("partType" in b) patch.part_type = b.partType;
  if ("quantity" in b) patch.quantity = parseInt(b.quantity);
  if ("costPerUnit" in b) patch.cost_price = num(b.costPerUnit);
  if ("supplier" in b) patch.supplier = b.supplier;
  if ("remarks" in b) patch.notes = b.remarks;
  if ("status" in b) patch.status = b.status;
  const { error } = await sb
    .from("inventory_parts")
    .update(patch)
    .eq("part_id", b.partId);
  if (error) return err(error.message, 500);
  await sb.from("part_logs").insert({
    part_id: b.partId,
    action: "EDIT",
    performed_by_name: b.updatedBy || "System",
    notes: "Item edited",
  });
  return json({ status: "success", result: "success" });
}

async function deleteInventoryItem(b: Record<string, any>) {
  if (!b.partId) return err("partId required");
  await sb.from("inventory_parts").delete().eq("part_id", b.partId);
  await sb.from("part_logs").insert({
    part_id: b.partId,
    action: "DELETE",
    performed_by_name: b.deletedBy || "System",
    notes: "Item deleted",
  });
  return json({ status: "success", result: "success" });
}

async function adjustStock(b: Record<string, any>) {
  if (!b.partId) return err("partId required");
  const { data: item } = await sb
    .from("inventory_parts")
    .select("quantity,part_name")
    .eq("part_id", b.partId)
    .maybeSingle();
  if (!item) return err("not found", 404);
  const adj = parseInt(b.quantity || "0");
  const next =
    b.adjustmentType === "subtract"
      ? Math.max(0, (item.quantity ?? 0) - adj)
      : (item.quantity ?? 0) + adj;
  await sb
    .from("inventory_parts")
    .update({ quantity: next, updated_at: new Date().toISOString() })
    .eq("part_id", b.partId);
  await sb.from("part_logs").insert({
    part_id: b.partId,
    action: b.adjustmentType === "subtract" ? "OUT" : "IN",
    quantity: adj,
    performed_by_name: b.adjustedBy || "System",
    notes: b.remarks || "",
  });
  return json({ status: "success", result: "success" });
}

async function placeOrder(b: Record<string, any>) {
  // Mark inventory item as On Order; record qty
  if (!b.partId) return err("partId required");
  await sb
    .from("inventory_parts")
    .update({ status: "On Order", updated_at: new Date().toISOString() })
    .eq("part_id", b.partId);
  await sb.from("part_logs").insert({
    part_id: b.partId,
    action: "ORDER",
    quantity: parseInt(b.quantity || "0"),
    performed_by_name: b.adjustedBy || b.addedBy || "System",
    notes: b.remarks || "Order placed",
  });
  return json({ status: "success", result: "success" });
}

async function receiveOrder(b: Record<string, any>) {
  if (!b.partId) return err("partId required");
  const { data: item } = await sb
    .from("inventory_parts")
    .select("quantity")
    .eq("part_id", b.partId)
    .maybeSingle();
  if (!item) return err("not found", 404);
  await sb
    .from("inventory_parts")
    .update({ status: "In Stock", updated_at: new Date().toISOString() })
    .eq("part_id", b.partId);
  await sb.from("part_logs").insert({
    part_id: b.partId,
    action: "RECEIVE",
    performed_by_name: b.receivedBy || "System",
    notes: b.remarks || "Order received",
  });
  return json({ status: "success", result: "success" });
}

// ---- Fast moving / Part Requests ----
async function addFastMovingPart(b: Record<string, any>) {
  const reqId = genId("REQ", 8);
  const partId = genId("FMP", 8);
  const { error } = await sb.from("part_requests").insert({
    request_id: reqId,
    part_id: partId,
    part_name: b.partName,
    brand: b.brand,
    device_model: b.model,
    quantity: parseInt(b.quantity || "1"),
    service_id: b.serviceId || null,
    requested_by_name: b.requestedBy || "Unknown",
    notes: b.remarks || null,
    status: b.status || "For Ordering",
  });
  if (error) return err(error.message, 500);
  return json({
    status: "success",
    result: "success",
    partId,
    requestId: reqId,
  });
}

async function updateFastMovingPart(b: Record<string, any>) {
  if (!b.partId) return err("partId required");
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if ("partName" in b) patch.part_name = b.partName;
  if ("brand" in b) patch.brand = b.brand;
  if ("model" in b) patch.device_model = b.model;
  if ("quantity" in b) patch.quantity = parseInt(b.quantity);
  if ("remarks" in b) patch.notes = b.remarks;
  const { error } = await sb
    .from("part_requests")
    .update(patch)
    .eq("part_id", b.partId);
  if (error) return err(error.message, 500);
  return json({ status: "success", result: "success" });
}

async function updateFastMovingPartOrder(b: Record<string, any>) {
  if (!b.partId) return err("partId required");
  const { error } = await sb
    .from("part_requests")
    .update({
      status: b.status || "Ordered",
      notes: b.remarks || null,
      updated_at: new Date().toISOString(),
    })
    .eq("part_id", b.partId);
  if (error) return err(error.message, 500);
  return json({ status: "success", result: "success" });
}

async function receiveFastMovingPart(b: Record<string, any>) {
  if (!b.partId) return err("partId required");
  const { error } = await sb
    .from("part_requests")
    .update({ status: "Received", updated_at: new Date().toISOString() })
    .eq("part_id", b.partId);
  if (error) return err(error.message, 500);

  // Append to service.parts_used (Column AU — store Part ID)
  if (b.serviceId && b.partName) {
    const { data: svc } = await sb
      .from("services")
      .select("parts_used")
      .eq("service_id", b.serviceId)
      .maybeSingle();
    const arr = svc?.parts_used ?? [];
    if (!arr.includes(b.partName)) arr.push(b.partName);
    await sb
      .from("services")
      .update({ parts_used: arr, last_updated: new Date().toISOString() })
      .eq("service_id", b.serviceId);
  }
  return json({ status: "success", result: "success" });
}

async function cancelFastMovingPart(b: Record<string, any>) {
  if (!b.partId) return err("partId required");
  const { error } = await sb
    .from("part_requests")
    .update({
      status: "Cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: b.cancelRemark || null,
      updated_at: new Date().toISOString(),
    })
    .eq("part_id", b.partId);
  if (error) return err(error.message, 500);
  return json({ status: "success", result: "success" });
}

// ---- Salary ----
async function disburseSalary(b: Record<string, any>) {
  if (!b.staffId) return err("staffId required");
  let staffUuid: string | null = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.staffId) ? b.staffId : null;
  if (!staffUuid) {
    // Lookup by staff_id text or by name
    const { data: prof } = await sb
      .from("profiles")
      .select("id")
      .or(`staff_id.eq.${b.staffId},name.eq.${b.staffName || ""}`)
      .maybeSingle();
    if (prof?.id) staffUuid = prof.id;
  }
  if (!staffUuid) return err("Could not resolve staff to a user account", 400);
  const amount = num(b.salaryAmount);
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await sb.from("salary_disbursements").insert({
    staff_id: staffUuid,
    staff_name: b.staffName || "",
    period_label: b.periodLabel || b.period || "Manual",
    period_start: today,
    period_end: today,
    monthly_salary: num(b.monthlySalary) || amount,
    workdays_in_period: Math.round(num(b.workdaysInPeriod)),
    days_present: num(b.daysPresent),
    daily_rate: num(b.dailyRate),
    contribution_pagibig: num(b.contributionPagibig),
    contribution_sss: num(b.contributionSss),
    contribution_philhealth: num(b.contributionPhilhealth),
    other_deductions: num(b.otherDeductions),
    gross_pay: num(b.grossPay) || amount,
    total_deductions: num(b.totalDeductions),
    net_pay: num(b.netPay) || amount,
    status: b.status || "Disbursed",
    disbursed_at: new Date().toISOString(),
  });
  if (error) return err(error.message, 500);
  return json({ status: "success", result: "success" });
}

// ---- Transactions ----
async function addTransaction(b: Record<string, any>) {
  const txnId = b.transactionId || genId("TXN", 11);
  const { error } = await sb.from("transactions").insert({
    transaction_id: txnId,
    type: b.transactionType || "Other",
    amount: num(b.amount),
    payment_method: b.modeOfPayment || b.mop || null,
    client_name: b.name || null,
    description: b.remarks || b.description || null,
    service_id: b.serviceId || null,
    fund_name: b.fundSource || null,
    category: b.category || null,
    created_by_name: b.attendant || null,
  });
  if (error) return err(error.message, 500);
  return json({ status: "success", result: "success", transactionId: txnId });
}

async function editTransaction(b: Record<string, any>) {
  if (!b.transactionId) return err("transactionId required");
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if ("transactionType" in b) patch.type = b.transactionType;
  if ("amount" in b) patch.amount = num(b.amount);
  if ("modeOfPayment" in b) patch.payment_method = b.modeOfPayment;
  if ("name" in b) patch.client_name = b.name;
  if ("remarks" in b) patch.description = b.remarks;
  if ("serviceId" in b) patch.service_id = b.serviceId || null;
  if ("fundSource" in b) patch.fund_name = b.fundSource;
  const { error } = await sb
    .from("transactions")
    .update(patch)
    .eq("transaction_id", b.transactionId);
  if (error) return err(error.message, 500);
  return json({ status: "success", result: "success" });
}

async function deleteTransaction(b: Record<string, any>) {
  if (!b.transactionId) return err("transactionId required");
  await sb.from("transactions").delete().eq("transaction_id", b.transactionId);
  return json({ status: "success", result: "success" });
}

async function deleteClosedDate(b: Record<string, any>) {
  const dateStr = b.date || b.closedDate;
  if (!dateStr) return err("date required");
  await sb.from("closed_dates").delete().eq("closed_date", dateStr);
  return json({ status: "success", result: "success" });
}

// ---------- Router ----------
serve();

async function serve() {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS")
      return new Response(null, { headers: corsHeaders });
    try {
      const url = new URL(req.url);
      const params = url.searchParams;
      let action = params.get("action") ?? "";
      let body: Record<string, any> = {};
      if (req.method === "POST") {
        body = await parseBody(req);
        action = action || (body.action as string) || "";
        // Legacy intake form posts FormData with no explicit action — detect it.
        if (!action && (body["Service ID"] || body["Client Name"] || body["Chief Complaint"])) {
          action = "Add Mode";
        }
      }

      // Authenticate the caller. Public-tracking actions can run unauthenticated
      // but their responses are filtered to remove sensitive fields. Everything
      // else requires a valid JWT, and a few actions also require an admin or
      // management role.
      const caller = await authenticateCaller(req);
      const isPublicAction = PUBLIC_ACTIONS.has(action);
      if (!caller && !isPublicAction) {
        return err("Unauthorized", 401);
      }
      if (caller && ADMIN_ACTIONS.has(action) && !caller.isAdminOrManagement) {
        return err("Forbidden", 403);
      }
      if (!caller && ADMIN_ACTIONS.has(action)) {
        return err("Unauthorized", 401);
      }

      switch (action) {
        // GET (read)
        case "searchService": {
          const resp = await searchService(params.get("serviceId") ?? "");
          if (caller) return resp;
          // Public: strip sensitive fields from the JSON body
          const payload = await resp.json();
          if (payload?.data) payload.data = stripSensitiveServiceFields(payload.data);
          return json(payload);
        }
        case "searchClient": {
          const resp = await searchClient(params.get("clientId") ?? "");
          if (caller) return resp;
          const payload = await resp.json();
          if (payload?.customer) {
            payload.customer = { ...payload.customer, address: "", email: "" };
            payload.data = payload.customer;
          }
          if (Array.isArray(payload?.services)) {
            payload.services = payload.services.map(stripSensitiveServiceFields);
          }
          return json(payload);
        }
        case "getTransactions":
          return await getTransactions();
        case "getServicePayments":
          return await getServicePayments(params.get("serviceId") ?? "");
        case "getServiceLogs":
          return await getServiceLogs(
            params.get("serviceId") ?? "",
            parseInt(params.get("limit") ?? "50"),
          );
        case "getDeviceReportPhotos":
          return await getDeviceReportPhotos(params.get("folderId") ?? "");
        case "getClientInquiries":
          return await getClientInquiries();
        case "getSalaryLogs":
          return await getSalaryLogs();
        case "getAllOngoingServices":
          return await getAllOngoingServices();
        case "getApiKey":
          return await getApiKey();
        case "formatDiagnosis":
          return await formatDiagnosis(params);
        case "formatReport":
          return await formatReport(params);


        // POST (write)
        case "create":
        case "Add Mode":
          return await createIntake(body);
        case "update":
        case "updateService":
        case "updateTechnicianService":
          return await updateService(body);
        case "updateServicePDF":
          return await updateServicePDF(body);
        case "updateQuotationPDF":
          return await updateQuotationPDF(body);
        case "deleteDeviceReportPhoto":
          return await deleteDeviceReportPhoto(body);
        case "updateClientInquiry":
          return await updateClientInquiry(body);
        case "updateInquiryPartIdByServiceId":
          return await updateInquiryPartIdByServiceId(body);
        case "addInventoryItem":
          return await addInventoryItem(body);
        case "updateInventoryItem":
          return await updateInventoryItem(body);
        case "deleteInventoryItem":
          return await deleteInventoryItem(body);
        case "adjustStock":
          return await adjustStock(body);
        case "placeOrder":
          return await placeOrder(body);
        case "receiveOrder":
          return await receiveOrder(body);
        case "addFastMovingPart":
          return await addFastMovingPart(body);
        case "updateFastMovingPart":
          return await updateFastMovingPart(body);
        case "updateFastMovingPartOrder":
          return await updateFastMovingPartOrder(body);
        case "receiveFastMovingPart":
          return await receiveFastMovingPart(body);
        case "cancelFastMovingPart":
          return await cancelFastMovingPart(body);
        case "disburseSalary":
          return await disburseSalary(body);
        case "addTransaction":
          return await addTransaction(body);
        case "editTransaction":
          return await editTransaction(body);
        case "deleteTransaction":
          return await deleteTransaction(body);
        case "deleteClosedDate":
          return await deleteClosedDate(body);

        default:
          return err(`Unknown action: ${action}`, 400);
      }
    } catch (e: any) {
      console.error("bridge error", e?.message ?? e);
      return err(e?.message ?? "Internal error", 500);
    }
  });
}
