import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { createNotification } from "@/lib/notifications";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import acTechLogo from "@/assets/S_S_Marketing-2.png";
import { DATA_BRIDGE_URL } from "@/lib/dataBridge";
import { Search, Loader2 } from "lucide-react";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { uploadServicePdf } from "@/lib/servicePdfStorage";
import { DEVICE_TYPES, DEVICE_TYPES_BY_DEPARTMENT } from "@/lib/constants";
import SignatureCanvasComponent, { type SignatureCanvasRef } from "@/components/SignatureCanvas";
import { DeviceAnnotationCanvas } from "@/components/DeviceAnnotationCanvas";
import { handleError, withErrorHandling } from "@/lib/errorHandling";
import QRCode from "qrcode";
import { sanitizeInput, phoneSchema, emailSchema, nameSchema, priceSchema } from "@/lib/validation";
import { MultiSelect } from "@/components/ui/multi-select";
import termsImage from "@/assets/terms-and-conditions.jpg";
import { notifyNewServiceAssignment } from "@/lib/serviceNotifications";
import { useStaffAvailability } from "@/hooks/useStaffAvailability";
import { useStaff } from "@/hooks/useStaff";
import { logActivity } from "@/lib/activityLogger";
import { preloadPdfAssets } from "@/lib/pdfAssets";
import { supabase } from "@/integrations/supabase/client";
import { ensureClient } from "@/hooks/useClients";
import { IntakeShareActions } from "@/components/IntakeShareActions";
import { useQueryClient } from "@tanstack/react-query";

const SPECIAL_CASE_TECHNICIAN = "John Paul Espedido";
const SPECIAL_CASE_DEPARTMENT = "Special Cases";

const buildFormSchema = (isPublic: boolean) => z.object({
  clientId: z.string().optional(),
  adminRep: isPublic ? z.string().optional() : z.string().min(1, "Admin Representative is required"),
  receivingStaff: isPublic ? z.string().optional() : z.string().min(1, "Receiving Staff is required"),
  technician: z.string().optional(),
  technicianDepartments: isPublic
    ? z.string().optional()
    : z.string().min(1, "Select at least one Technician Department"),
  clientType: isPublic ? z.string().optional() : z.string().min(1, "Client Type is required"),
  priority: isPublic ? z.string().optional() : z.string().min(1, "Priority is required"),
  clientName: z.string().min(1, "Client Name is required"),
  username: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().min(1, "Phone is required"),
  deviceType: z.string().min(1, "Device Type is required"),
  serial: isPublic ? z.string().optional() : z.string().min(1, "Serial is required"),
  brand: z.string().min(1, "Brand is required"),
  color: z.string().min(1, "Color is required"),
  model: z.string().min(1, "Model is required"),
  memory: z.string().min(1, "Storage is required"),
  chiefComplaint: z.string().min(1, "Chief Complaint is required"),
  devicePassword: z.string().min(1, "Device Password is required"),
  dents: z.boolean().default(false),
  scratches: z.boolean().default(false),
  missingParts: z.boolean().default(false),
  physicalDamage: z.boolean().default(false),
  importantFiles: z.boolean().default(false),
  noPower: z.boolean().default(false),
  repairHistory: z.boolean().default(false),
  physicalSignature: z.boolean().default(false),
  estimatedCost: z.number().optional(),
  timeFrame: isPublic ? z.string().optional() : z.string().min(1, "Estimated Time Frame is required"),
  ack1: z.boolean().refine((val) => val === true, "You must accept the terms and conditions"),
  ack2: z.boolean().refine((val) => val === true, "You must confirm the information is correct"),
  ack3: z.boolean().refine((val) => val === true, "You must agree to the service terms"),
  autoApproveDiagnosis: z.boolean().default(false),

  enablePhotoAnnotation: z.boolean().default(false),
  annotationDeviceType: z.string().optional(),
  annotationNotes: z.string().optional(),
});

const formSchema = buildFormSchema(false);

type FormValues = z.infer<typeof formSchema>;

export interface ServiceFormProps {
  /** When set, the form renders embedded (e.g. inside the Complete Intake modal). */
  embeddedQueueId?: string;
  /** Render without the dashboard chrome (used by the modal). */
  embedded?: boolean;
  /** Called after an embedded submission succeeds. */
  onCompleted?: (serviceId: string) => void;
}

const ServiceForm = ({ embeddedQueueId, embedded, onCompleted }: ServiceFormProps = {}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isPublic = !embedded && location.pathname === "/intake";
  const searchQueueId = useMemo(
    () => new URLSearchParams(location.search).get("queueId"),
    [location.search],
  );
  const queueId = embeddedQueueId ?? searchQueueId;
  const activeSchema = useMemo(() => buildFormSchema(isPublic), [isPublic]);
  const { toast } = useToast();
  const [termsRead, setTermsRead] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOtherDeviceInput, setShowOtherDeviceInput] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [searchClientId, setSearchClientId] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const [annotationImageUrl, setAnnotationImageUrl] = useState("");
  const [isFormattingComplaint, setIsFormattingComplaint] = useState(false);
  // Kiosk confirmation overlay (public /intake only)
  const [kioskCode, setKioskCode] = useState<string | null>(null);
  const [kioskCountdown, setKioskCountdown] = useState(10);
  const [kioskQr, setKioskQr] = useState<string | null>(null);


  // Use React Query for staff data
  const { data: staffData = [] } = useStaff();
  
  // Admin Rep + Receiving Staff: include both admin and management roles
  const adminStaffOptions = useMemo(() => staffData
    .filter((staff) => {
      const role = staff.role?.trim().toLowerCase();
      return (role === "admin" || role === "management") && staff.status?.toLowerCase() !== "inactive";
    })
    .sort((a, b) => {
      const rank = (role?: string) => role?.trim().toLowerCase() === "admin" ? 0 : 1;
      const roleDiff = rank(a.role) - rank(b.role);
      return roleDiff || a.name.localeCompare(b.name);
    })
    .map((staff) => ({
      label: staff.name,
      value: staff.name,
      group: staff.role?.trim().toLowerCase() === "management" ? "Management" : "Admin",
    })), [staffData]);

  const adminList = useMemo(() => adminStaffOptions.map((staff) => staff.value), [adminStaffOptions]);
  const receivingStaffOptions = adminStaffOptions;

  const { data: availability } = useStaffAvailability();
  const [showUnavailableTechs, setShowUnavailableTechs] = useState(false);
  const technicianList = [
    { name: SPECIAL_CASE_TECHNICIAN, department: SPECIAL_CASE_DEPARTMENT },
    ...staffData
      .filter((staff) =>
        staff.role?.toLowerCase() === "technician" &&
        staff.status?.toLowerCase() !== "inactive" &&
        staff.name !== SPECIAL_CASE_TECHNICIAN &&
        // Hide absent / on-leave technicians from assignment.
        (showUnavailableTechs ||
          !availability ||
          (!availability.isOnLeave(staff.name) &&
            (!availability.hasAttendanceToday || availability.isAvailable(staff.name))))
      )
      .map((staff) => ({
        name: staff.name,
        department: staff.department || ""
      })),
  ];


  // Get logged-in user's full name for admin auto-select
  const loggedInUserFullName = sessionStorage.getItem("userFullName") || sessionStorage.getItem("fullName") || "";
  const loggedInUserRole = sessionStorage.getItem("userRole") || "";

  useEffect(() => {
    if (!isPublic && !sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    // Preload PDF assets for faster generation
    preloadPdfAssets();
  }, [navigate]);

  const form = useForm<FormValues>({
    resolver: zodResolver(activeSchema as typeof formSchema),
    defaultValues: {
      clientId: "",
      adminRep: "",
      receivingStaff: "",
      technician: "",
      technicianDepartments: "",
      clientType: "",
      priority: "",
      clientName: "",
      username: "",
      email: "",
      phone: "",
      deviceType: "",
      serial: "",
      brand: "",
      color: "",
      model: "",
      memory: "",
      chiefComplaint: "",
      devicePassword: "",
      dents: false,
      scratches: false,
      missingParts: false,
      physicalDamage: false,
      importantFiles: false,
      noPower: false,
      repairHistory: false,
      estimatedCost: 0,
      timeFrame: "",
      ack1: false,
      ack2: false,
      ack3: false,
      autoApproveDiagnosis: false,

      physicalSignature: false,
      enablePhotoAnnotation: false,
      annotationDeviceType: "",
      annotationNotes: "",
    },
  });

  // Auto-select logged in admin on form load
  useEffect(() => {
    if (loggedInUserRole === "admin" && loggedInUserFullName && adminList.length > 0) {
      // Check if the logged in user is in the admin list
      const matchingAdmin = adminList.find(admin => 
        admin.toLowerCase() === loggedInUserFullName.toLowerCase()
      );
      if (matchingAdmin && !form.getValues("adminRep")) {
        form.setValue("adminRep", matchingAdmin);
      }
    }
  }, [loggedInUserRole, loggedInUserFullName, adminList, form]);

  // Prefill from a queue entry when admin completes a public intake into a real service.
  const [prefilledQueueId, setPrefilledQueueId] = useState<string | null>(null);
  useEffect(() => {
    if (!queueId || isPublic || prefilledQueueId === queueId) return;
    (async () => {
      const { data: entry } = await supabase
        .from("queue_entries")
        .select("*")
        .eq("id", queueId)
        .maybeSingle();
      if (!entry) return;
      const payload = (entry.form_payload || {}) as Record<string, any>;
      // Restore EVERY known form field from the payload (booleans included).
      const fields: (keyof FormValues)[] = [
        "clientId", "clientName", "phone", "email", "username", "deviceType", "brand", "model",
        "color", "memory", "serial", "chiefComplaint", "devicePassword", "timeFrame",
        "dents", "scratches", "missingParts", "physicalDamage", "importantFiles",
        "noPower", "repairHistory", "physicalSignature",
        "ack1", "ack2", "ack3",
        "enablePhotoAnnotation", "annotationDeviceType", "annotationNotes",
      ];
      fields.forEach((k) => {
        const v = payload[k as string];
        if (v === undefined || v === null) return;
        if (typeof v === "boolean") form.setValue(k as any, v);
        else if (v !== "") form.setValue(k as any, v);
      });
      if (payload.ack1 && payload.ack2 && payload.ack3) setTermsRead(true);
      // Rehydrate captured images (stored as data URLs in the queue payload).
      if (payload.annotationImageUrl) setAnnotationImageUrl(payload.annotationImageUrl);
      if (payload.signatureUrl) {
        setSignatureUrl(payload.signatureUrl);
        form.setValue("physicalSignature", true);
      }

      // Prefer the direct columns as source of truth when available.
      if (entry.client_name) form.setValue("clientName", entry.client_name);
      if (entry.contact_number) form.setValue("phone", entry.contact_number);
      if (entry.device_type) form.setValue("deviceType", entry.device_type);
      if (entry.brand) form.setValue("brand", entry.brand);
      if (entry.model) form.setValue("model", entry.model);
      if (entry.chief_complaint) form.setValue("chiefComplaint", entry.chief_complaint);
      setPrefilledQueueId(queueId);
      toast({
        title: `Completing ${entry.display_code}`,
        description: "Customer's details are pre-filled. Add staff, priority, and diagnostic info.",
      });
    })();
  }, [queueId, isPublic, prefilledQueueId, form, toast]);

  // Kiosk confirmation countdown — returns the station to a blank /intake form.
  useEffect(() => {
    if (!kioskCode) {
      setKioskQr(null);
      return;
    }
    QRCode.toDataURL(
      `https://actechrepair-service.com/queue?entry=${encodeURIComponent(kioskCode)}`,
      { width: 420, margin: 1 },
    )
      .then(setKioskQr)
      .catch(() => setKioskQr(null));
    const tick = setInterval(() => setKioskCountdown((c) => c - 1), 1000);
    const done = setTimeout(() => setKioskCode(null), 10000);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [kioskCode]);


  const handleSearchClientId = async () => {
    if (!searchClientId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Client ID to search",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingClient(true);
    try {
      const term = searchClientId.trim();
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("client_id", term)
        .maybeSingle();

      let customer: { clientId?: string; clientName?: string; username?: string; phone?: string; email?: string; address?: string } | null = null;

      if (client) {
        customer = {
          clientId: client.client_id,
          clientName: client.name ?? "",
          username: (client as any).username ?? "",
          phone: client.contact_number ?? "",
          email: client.email ?? "",
          address: (client as any).address ?? "",
        };
      } else {
        // Fallback: resolve from an existing service ticket carrying this client id
        const { data: svc } = await supabase
          .from("services")
          .select("client_id, client_name, username, contact_number, email, address")
          .eq("client_id", term)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (svc) {
          customer = {
            clientId: svc.client_id ?? term,
            clientName: svc.client_name ?? "",
            username: (svc as any).username ?? "",
            phone: svc.contact_number ?? "",
            email: svc.email ?? "",
            address: (svc as any).address ?? "",
          };
        }
      }

      if (customer) {
        form.setValue("clientId", customer.clientId || term);
        form.setValue("clientName", customer.clientName || "");
        form.setValue("username", customer.username || "");
        form.setValue("phone", customer.phone || "");
        form.setValue("email", customer.email || "");
        if (customer.address) form.setValue("address" as any, customer.address);
        form.setValue("clientType", "Returning Client - Walk In");
        form.setValue("priority", "Loyalty");
        toast({
          title: "Success",
          description: "Client information loaded successfully!",
        });
      } else {
        toast({
          title: "Not Found",
          description: "Client ID not found in database",
          variant: "destructive",
        });
      }

    } catch {
      // Error searching client ID
      toast({
        title: "Error",
        description: "Failed to search client ID. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingClient(false);
    }
  };


  // Helper to convert blob to base64 (defined outside for reuse)
  const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const onSubmit = async (data: FormValues) => {
    // Public /intake path: submit into the queue instead of creating a full service.
    // Front-desk staff will complete it into a real service from /queueing.
    if (isPublic) {
      setIsSubmitting(true);
      try {
        const payload: Record<string, any> = {
          ...(data as unknown as Record<string, any>),
          // Public users can't write to storage, so images ride along as data URLs.
          annotationImageUrl: annotationImageUrl || undefined,
          physicalSignature: false,
          signatureUrl: undefined,
        };
        const { data: inserted, error } = await supabase
          .from("queue_entries")
          .insert({
            client_name: data.clientName,
            contact_number: data.phone,
            device_type: data.deviceType,
            brand: data.brand,
            model: data.model,
            chief_complaint: data.chiefComplaint,
            form_payload: payload,
          })
          .select()
          .single();
        if (error) throw error;
        form.reset();
        setTermsRead(false);
        setSignatureUrl("");
        setAnnotationImageUrl("");
        signatureRef.current?.clear();
        // Kiosk mode: show only the queue number for a few seconds, then reset.
        setKioskCountdown(10);
        setKioskCode(inserted.display_code);

      } catch (e) {
        toast({
          title: "Submission failed",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Validate signature if required
    if (data.physicalSignature && (!signatureUrl || (signatureRef.current?.isEmpty() ?? true))) {
      toast({
        title: "Signature Required",
        description: "Please draw and save your signature before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Auto-assign technicians (internal form only) via round-robin across
    // the technicians of each selected department. Fair rotation is achieved
    // by picking the technician with the fewest active services (excluding
    // Completed / Cancelled / RTO), tie-breaking alphabetically for determinism.
    if (!isPublic) {
      const depts = (data.technicianDepartments || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (depts.length > 0) {
        try {
          const { data: rows } = await supabase
            .from("services")
            .select("technicians,status")
            .not("status", "in", "(Completed,Cancelled,RTO)");
          const loadCount = new Map<string, number>();
          (rows ?? []).forEach((r: any) => {
            (r.technicians ?? []).forEach((t: string) => {
              const key = String(t).trim();
              if (!key) return;
              loadCount.set(key, (loadCount.get(key) ?? 0) + 1);
            });
          });
          const assigned: string[] = [];
          for (const dept of depts) {
            const pool = technicianList.filter((t) => t.department === dept);
            if (pool.length === 0) continue;
            const sorted = [...pool].sort((a, b) => {
              const la = loadCount.get(a.name) ?? 0;
              const lb = loadCount.get(b.name) ?? 0;
              if (la !== lb) return la - lb;
              return a.name.localeCompare(b.name);
            });
            const pick = sorted[0].name;
            if (!assigned.includes(pick)) assigned.push(pick);
            // Optimistically bump their load so a second dept doesn't pick the same tech.
            loadCount.set(pick, (loadCount.get(pick) ?? 0) + 1);
          }
          if (assigned.length === 0) {
            toast({
              title: "No technicians available",
              description: "None of the selected departments have active technicians.",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
          data.technician = assigned.join(", ");
        } catch (e) {
          toast({
            title: "Auto-assign failed",
            description: e instanceof Error ? e.message : "Could not assign a technician.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }
    }


    try {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const timestamp = `${month}-${day}-${year}, ${hours}:${minutes}`;
      const techNamesArr = (data.technician || "").split(",").map(s => s.trim()).filter(Boolean);
      const adminRepsArr = (data.adminRep || "").split(",").map(s => s.trim()).filter(Boolean);
      const techDepartmentsArr = [...new Set(
        techNamesArr.map(n => technicianList.find(t => t.name === n)?.department).filter(Boolean) as string[]
      )];
      const resolvedClientId = await ensureClient({
        clientId: data.clientId || null,
        name: data.clientName,
        username: data.username || null,
        contactNumber: data.phone,
        email: data.email,
        address: (data as any).address || null,
      }).catch(() => data.clientId || null);

      const servicePayload = {
        client_id: resolvedClientId || null,
        client_name: data.clientName,
        contact_number: data.phone,
        email: data.email || null,
        address: (data as any).address || null,
        username: data.username || null,
        device_type: data.deviceType,
        brand: data.brand,
        model: data.model,
        color: data.color,
        memory: data.memory,
        serial_number: data.serial,
        device_password: data.devicePassword || null,
        chief_complaint: data.chiefComplaint,
        issue_description: data.chiefComplaint,
        device_notes: data.annotationNotes || null,
        estimated_cost: data.estimatedCost ?? 0,
        estimated_completion: data.timeFrame || null,
        client_type: data.clientType,
        priority: data.priority,
        receiving_staff: data.receivingStaff || null,
        technicians: techNamesArr,
        admin_reps: adminRepsArr,
        technician_departments: techDepartmentsArr,
        source: "Staff Intake",
        conditions: {
          dents: data.dents, scratches: data.scratches, missingParts: data.missingParts,
          physicalDamage: data.physicalDamage, importantFiles: data.importantFiles,
          noPower: data.noPower, repairHistory: data.repairHistory,
        },
        acknowledgements: { ack1: data.ack1, ack2: data.ack2, ack3: data.ack3 },
        auto_approve_diagnosis: !!data.autoApproveDiagnosis,
      };

      const { data: createdServiceId, error: createError } = await supabase.rpc("create_service_atomic", {
        _payload: servicePayload,
        _queue_id: queueId || undefined,
      });
      if (createError || !createdServiceId) {
        throw new Error(createError?.message || "Could not create the service ticket.");
      }
      const finalServiceId = createdServiceId;

      // Generate PDF (assets are preloaded, so this is fast)
      const pdfBlob = await generateServicePDF({
        serviceId: finalServiceId,
        timestamp,
        adminRep: data.adminRep || "",
        receivingStaff: data.receivingStaff || "",
        technician: data.technician || "",
        clientType: data.clientType,
        priority: data.priority,
        clientName: data.clientName,
        username: data.username,
        phone: data.phone,
        email: data.email,
        deviceType: data.deviceType,
        serial: data.serial,
        brand: data.brand,
        color: data.color,
        model: data.model,
        memory: data.memory,
        chiefComplaint: data.chiefComplaint,
        dents: data.dents,
        scratches: data.scratches,
        missingParts: data.missingParts,
        physicalDamage: data.physicalDamage,
        importantFiles: data.importantFiles,
        noPower: data.noPower,
        repairHistory: data.repairHistory,
        estimatedCost: data.estimatedCost ?? 0,
        timeFrame: data.timeFrame || "",
        signatureUrl: signatureUrl || undefined,
        annotationImageUrl: annotationImageUrl || undefined,
        annotationNotes: data.annotationNotes || undefined,
      });

      // Build FormData and convert PDF to base64 in parallel
      const pdfBase64Promise = blobToBase64(pdfBlob);
      
      const formData = new FormData();
      formData.append("Service ID", finalServiceId);
      formData.append("Client ID", data.clientId || "");
      formData.append("Timestamp", timestamp);
      formData.append("Admin Representative", data.adminRep || "");
      formData.append("Receiving Staff", data.receivingStaff || "");
      formData.append("Technician", data.technician || "");
      if (isPublic) formData.append("Source", "Public Intake");
      formData.append("Priority", data.priority);
      formData.append("Client Type", data.clientType);
      formData.append("Client Name", data.clientName);
      formData.append("Username", data.username);
      formData.append("Email", data.email);
      formData.append("Phone", data.phone);
      formData.append("Device Type", data.deviceType);
      formData.append("Serial", data.serial);
      formData.append("Brand", data.brand);
      formData.append("Color", data.color);
      formData.append("Model", data.model);
      formData.append("Memory", data.memory);
      formData.append("Chief Complaint", data.chiefComplaint);
      formData.append("Dents", data.dents ? "Yes" : "No");
      formData.append("Scratches", data.scratches ? "Yes" : "No");
      formData.append("Missing Parts", data.missingParts ? "Yes" : "No");
      formData.append("Physical Damage", data.physicalDamage ? "Yes" : "No");
      formData.append("Important Files", data.importantFiles ? "Yes" : "No");
      formData.append("No Power", data.noPower ? "Yes" : "No");
      formData.append("Repair History", data.repairHistory ? "Yes" : "No");
      formData.append("Has Password", "Yes");
      formData.append("Device Password", data.devicePassword || "");
      
      // Get ALL technicians' departments (comma-separated if multiple)
      const techNames = (data.technician || "").split(", ").filter(Boolean);
      const allDepartments = techNames
        .map(name => technicianList.find(t => t.name === name)?.department)
        .filter(Boolean);
      const uniqueDepartments = [...new Set(allDepartments)];
      formData.append("Technician Department", uniqueDepartments.join(", ") || "");
      
      formData.append("Time Frame", data.timeFrame || "");
      formData.append("Estimated Cost", (data.estimatedCost ?? 0).toString());
      formData.append("Acknowledgement 1", data.ack1 ? "Yes" : "No");
      formData.append("Acknowledgement 2", data.ack2 ? "Yes" : "No");
      formData.append("Acknowledgement 3", data.ack3 ? "Yes" : "No");
      
      // Wait for base64 conversion
      const pdfBase64 = await pdfBase64Promise;
      
      // Append PDF file with Service ID in filename
      const sanitizeFileName = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
      const pdfFileName = `${finalServiceId}_${sanitizeFileName(data.clientName)}_${sanitizeFileName(data.deviceType)}.pdf`;
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });
      formData.append("PDF", pdfFile);
      formData.append("PDF_Base64", pdfBase64);
      formData.append("PDF_FileName", pdfFileName);
      formData.append("PDF_MimeType", "application/pdf");

      // Handle signature if provided (prepare in parallel)
      if (data.physicalSignature && signatureUrl) {
        const signatureBase64 = signatureUrl.split(',')[1];
        const byteCharacters = atob(signatureBase64);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const signatureBlob = new Blob([byteArray], { type: 'image/png' });
        const signatureFileName = `${finalServiceId}_signature.png`;
        const signatureFile = new File([signatureBlob], signatureFileName, { type: 'image/png' });
        
        formData.append("Signature", signatureFile);
        formData.append("Signature_Base64", signatureBase64);
        formData.append("Signature_MimeType", "image/png");
        formData.append("Signature_FileName", signatureFileName);
      }

      // Handle device annotation if provided (Column AW and AX)
      if (data.enablePhotoAnnotation && annotationImageUrl) {
        const annotationBase64 = annotationImageUrl.split(',')[1];
        const byteCharacters = atob(annotationBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const annotationBlob = new Blob([byteArray], { type: 'image/png' });
        const annotationFileName = `${finalServiceId}_device_annotation.png`;
        const annotationFile = new File([annotationBlob], annotationFileName, { type: 'image/png' });
        
        // Send as DeviceAnnotation for Column AW
        formData.append("DeviceAnnotation", annotationFile);
        formData.append("DeviceAnnotation_Base64", annotationBase64);
        formData.append("DeviceAnnotation_MimeType", "image/png");
        formData.append("DeviceAnnotation_FileName", annotationFileName);
      }

      // Always send annotation notes if provided (Column AX)
      if (data.annotationNotes) {
        formData.append("AnnotationNotes", data.annotationNotes);
      }

      // Upload the generated PDF to Supabase Storage so the
      // "View PDF" buttons can resolve a signed URL.
      uploadServicePdf({
        serviceId: finalServiceId,
        clientName: data.clientName,
        kind: "intake",
        blob: pdfBlob,
      }).catch(() => {});

      // Upload signature & device annotation if present
      if (data.physicalSignature && signatureUrl) {
        const sigBlob = await (await fetch(signatureUrl)).blob();
        supabase.storage.from("signatures").upload(`${finalServiceId}/${finalServiceId}_sig.png`, sigBlob, {
          upsert: true, contentType: "image/png",
        }).catch(() => {});
      }
      if (data.enablePhotoAnnotation && annotationImageUrl) {
        const annBlob = await (await fetch(annotationImageUrl)).blob();
        supabase.storage.from("annotations").upload(`${finalServiceId}/${finalServiceId}_ann.png`, annBlob, {
          upsert: true, contentType: "image/png",
        }).catch(() => {});
      }

      const isResponseOk = true;

      if (isResponseOk) {
        // Make the new ticket appear everywhere immediately (tracker, dashboards).
        queryClient.invalidateQueries({ queryKey: ["services"] });
        queryClient.invalidateQueries({ queryKey: ["techServices"] });
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        // Show success immediately - don't wait for notifications/logging
        toast({
          title: "Success",
          description: `Service form submitted successfully! Service ID: ${finalServiceId}`,
        });

        form.reset();
        setTermsRead(false);
        setSignatureUrl("");
        setAnnotationImageUrl("");
        if (signatureRef.current) {
          signatureRef.current.clear();
        }

        // Fire-and-forget: notifications and logging (don't block UI)
        const adminName = sessionStorage.getItem("userFullName") || (data.adminRep || "").split(", ")[0] || "Client";
        const username = (sessionStorage.getItem("userFullName") || sessionStorage.getItem("username")) || (data.adminRep || "").split(", ")[0] || "client-intake";
        const role = sessionStorage.getItem("userRole") || (isPublic ? "client" : "admin");

        // All assigned admins (multi-select supported) — recipient_id MUST be the auth uuid
        const adminNames = (data.adminRep || "").split(", ").map((s) => s.trim()).filter(Boolean);
        const assignedAdminNotifications = adminNames
          .map((name) => staffData.find((s) => s.name?.toLowerCase() === name.toLowerCase()))
          .filter((s): s is NonNullable<typeof s> => Boolean(s?.userId))
          .map((mgr) =>
            createNotification({
              userId: mgr.userId as string,
              title: "New Service Assigned",
              message: `You have been assigned as Admin Rep for ${data.clientName}'s ${data.deviceType} ${data.brand} ${data.model} (Service ID: ${finalServiceId}).`,
              type: "service_update",
              serviceId: finalServiceId,
            })
          );

        // Notify management when public client intake is submitted (missing fields need filling)
        const managementNotifications = isPublic
          ? staffData
              .filter((s) => {
                const r = s.role?.toLowerCase();
                return (r === "management" || r === "admin") && s.status?.toLowerCase() !== "inactive" && Boolean(s.userId);
              })
              .map((mgr) =>
                createNotification({
                  userId: mgr.userId as string,
                  title: "New Client Intake — Action Required",
                  message: `${data.clientName} submitted a public intake for ${data.deviceType} ${data.brand} ${data.model}. Assign Admin Rep, Receiving Staff, Technician, Estimated Cost & Time Frame on the Service Tracker.`,
                  type: "new_inquiry",
                  serviceId: finalServiceId,
                })
              )
          : [];

        // Run all notifications in parallel, non-blocking
        Promise.allSettled([
          ...techNames.map(techName =>
            notifyNewServiceAssignment(
              {
                serviceId: finalServiceId,
                clientName: data.clientName,
                technician: techName,
                adminRep: data.adminRep || "",
                deviceType: data.deviceType,
                device: data.model,
              },
              techName,
              adminName
            )
          ),
          ...assignedAdminNotifications,
          ...managementNotifications,
          logActivity({
            serviceId: finalServiceId,
            username,
            role,
            activity: `${isPublic ? "Public client intake submitted" : "New service created"} - Client: ${data.clientName}, Device: ${data.deviceType} ${data.brand} ${data.model}, Technician: ${data.technician || "TBD"}, Priority: ${data.priority}`,
          }),
        ]).catch(() => {});

        onCompleted?.(finalServiceId);

      } else {
        throw new Error("Failed to submit form");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");

      if (isCorsFetchError) {
        // Service form fetch error (likely CORS after successful POST)
        toast({
          title: "Success",
          description: "Service form submitted successfully!",
        });
        form.reset();
        setTermsRead(false);
        setSignatureUrl("");
        setAnnotationImageUrl("");
        if (signatureRef.current) {
          signatureRef.current.clear();
        }
        return;
      }

      toast({
        title: "Error",
        description: `Failed to submit form: ${msg}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
      <div className="p-4 md:p-8 animate-fade-in pb-8">
        <div className="max-w-4xl mx-auto bg-card rounded-lg shadow-xl p-6 md:p-8 border border-border/50 mb-0">
        
        <div className="text-center mb-8">
          <img src={acTechLogo} alt="AC Tech Repair" className="mx-auto h-16 mb-4 object-contain" />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">{isPublic ? "Client Intake Form" : "Initial Diagnosis Form"}</h1>
          <p className="text-muted-foreground">{isPublic ? "Please fill out your details below. Our team will be in touch shortly." : "Client Initial Diagnosis Form"}</p>
          <div className="mt-4 flex justify-center">
            <IntakeShareActions />
          </div>
        </div>

        {!isPublic && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h2 className="text-lg font-semibold text-green-600 mb-3">Client ID Search</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Enter Client ID to load client information"
              value={searchClientId}
              onChange={(e) => setSearchClientId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchClientId()}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleSearchClientId}
              disabled={isSearchingClient}
              className="bg-green-600 hover:bg-green-700"
            >
              <Search className="mr-2 h-4 w-4" />
              {isSearchingClient ? "Searching..." : "Search"}
            </Button>
          </div>
          {form.watch("clientId") && (
            <p className="mt-2 text-sm text-green-600 font-medium">
              Loaded Client ID: {form.watch("clientId")}
            </p>
          )}
        </div>
        )}




        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {!isPublic && (
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="adminRep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Rep:</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={adminStaffOptions}
                        selected={field.value ? field.value.split(", ").filter(Boolean) : []}
                        onChange={(values) => field.onChange(values.join(", "))}
                        placeholder="Select Admin(s)"
                        grouped
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receivingStaff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receiving Staff:</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Receiving Staff" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {receivingStaffOptions.length > 0 ? (
                          ["Admin", "Management"].map((groupName, index) => {
                            const options = receivingStaffOptions.filter((staff) => staff.group === groupName);
                            if (options.length === 0) return null;
                            return (
                              <SelectGroup key={groupName}>
                                {index > 0 && <SelectSeparator />}
                                <SelectLabel>{groupName}</SelectLabel>
                                {options.map((staff) => (
                                  <SelectItem key={staff.value} value={staff.value}>
                                    {staff.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            );
                          })
                        ) : (
                          <SelectItem value="No Staff" disabled>
                            No Staff Available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="technicianDepartments"
                render={({ field }) => {
                  const selectedDepts = field.value ? field.value.split(", ").filter(Boolean) : [];
                  const deviceType = form.watch("deviceType");
                  // Only offer departments that handle the selected device type; if
                  // none is selected yet, offer all departments that have techs.
                  const deptOptions = Array.from(new Set(technicianList.map((t) => t.department).filter(Boolean)))
                    .filter((dept) => {
                      if (dept === SPECIAL_CASE_DEPARTMENT) return true;
                      if (!deviceType) return true;
                      const allowed = DEVICE_TYPES_BY_DEPARTMENT[dept] || [];
                      return allowed.includes(deviceType) || dept === "Others";
                    })
                    .map((dept) => ({ label: dept, value: dept }));

                  // Live preview of the tech that would be auto-assigned per department.
                  const preview = selectedDepts
                    .map((dept) => {
                      const pool = technicianList.filter((t) => t.department === dept);
                      if (pool.length === 0) return `${dept}: (no active technicians)`;
                      const pick = [...pool].sort((a, b) => a.name.localeCompare(b.name))[0].name;
                      return `${dept} → ${pick}`;
                    })
                    .join(" • ");

                  return (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>Technician Department:</FormLabel>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-primary"
                            checked={showUnavailableTechs}
                            onChange={(e) => setShowUnavailableTechs(e.target.checked)}
                          />
                          Show unavailable staff
                        </label>
                      </div>

                      <FormControl>
                        <MultiSelect
                          options={deptOptions}
                          selected={selectedDepts}
                          onChange={(values) => field.onChange(values.join(", "))}
                          placeholder="Select Departments (auto-assigns a technician)"
                        />
                      </FormControl>
                      {preview && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Will assign: {preview} (final tech picked by lowest active-service load)
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            )}

            {/* Contact Information */}
            <div>
              <h2 className="text-xl font-semibold text-blue-600 mb-4">Contact Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {!isPublic && (
                  <>
                    <FormField
                      control={form.control}
                      name="clientType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Type:</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="New Client - Walk In">New Client - Walk In</SelectItem>
                              <SelectItem value="New Client - Pickup">New Client - Pickup</SelectItem>
                              <SelectItem value="Returning Client - Walk In">Returning Client - Walk In</SelectItem>
                              <SelectItem value="Returning Client - Pickup">Returning Client - Pickup</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority:</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Within The Day">Within The Day</SelectItem>
                              <SelectItem value="Rush (with 10% Rush Fee)">Rush (with 10% Rush Fee)</SelectItem>
                              <SelectItem value="Loyalty">Loyalty</SelectItem>
                              <SelectItem value="Normal">Normal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name:</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facebook Name/Instagram Username:</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email:</FormLabel>
                      <FormControl>
                        <Input type="text" inputMode="email" maxLength={255} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone:</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Device Information */}
            <div>
              <h2 className="text-xl font-semibold text-blue-600 mb-4">Device Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="deviceType"
                  render={({ field }) => {
                    // Device types available are constrained by selected technician
                    // departments (internal form) — public intake keeps all types.
                    const selectedTechDepartments = (form.watch("technicianDepartments") || "")
                      .split(", ")
                      .filter(Boolean);

                    const availableDeviceTypes = selectedTechDepartments.length > 0
                      ? Array.from(new Set(
                          selectedTechDepartments.flatMap(dept =>
                            dept === SPECIAL_CASE_DEPARTMENT
                              ? [...DEVICE_TYPES]
                              : DEVICE_TYPES_BY_DEPARTMENT[dept] || []
                          )
                        ))
                      : DEVICE_TYPES;
                    

                    
                    return (
                      <FormItem>
                        <FormLabel>Device Type:</FormLabel>
                        {showOtherDeviceInput ? (
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Enter device type"
                              onBlur={() => {
                                if (!field.value) {
                                  setShowOtherDeviceInput(false);
                                }
                              }}
                            />
                          </FormControl>
                        ) : (
                          <Select 
                            onValueChange={(value) => {
                              if (value === "Others") {
                                setShowOtherDeviceInput(true);
                                field.onChange("");
                              } else {
                                field.onChange(value);
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Device" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableDeviceTypes.map((deviceType) => (
                                <SelectItem key={deviceType} value={deviceType}>
                                  {deviceType}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="serial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial:</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand:</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color:</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model:</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="memory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storage:</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Chief Complaint */}
            <FormField
              control={form.control}
              name="chiefComplaint"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Chief Complaint:</FormLabel>
                    {!isPublic && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isFormattingComplaint || !field.value?.trim()}
                      onClick={async () => {
                        const raw = field.value?.trim();
                        if (!raw) return;
                        setIsFormattingComplaint(true);
                        try {
                          const { data: resp, error } = await supabase.functions.invoke(
                            "format-complaint",
                            { body: { rawComplaint: raw, mode: isPublic ? "brief" : "detailed" } },
                          );
                          if (error) throw error;
                          const formatted = (resp as any)?.formattedComplaint;
                          if (formatted) {
                            form.setValue("chiefComplaint", formatted, { shouldDirty: true, shouldValidate: true });
                            toast({ title: "Formatted", description: "Chief complaint rewritten." });
                          } else {
                            throw new Error("No formatted text returned");
                          }
                        } catch (e) {
                          toast({
                            title: "Formatter failed",
                            description: e instanceof Error ? e.message : "Try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsFormattingComplaint(false);
                        }
                      }}
                    >
                      {isFormattingComplaint ? (
                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Formatting…</>
                      ) : (
                        "Format with AI"
                      )}
                    </Button>
                    )}
                  </div>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            {/* Device Password */}
            <FormField
              control={form.control}
              name="devicePassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Password:</FormLabel>
                  <FormControl>
                    <Input {...field} type="text" placeholder="Enter device password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Device Initial Condition */}
            <div>
              <h2 className="text-xl font-semibold text-blue-600 mb-4">Device Initial Condition</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="dents"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox 
                          checked={field.value} 
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (checked) {
                              form.setValue("enablePhotoAnnotation", true);
                            }
                          }} 
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Dents</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scratches"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox 
                          checked={field.value} 
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (checked) {
                              form.setValue("enablePhotoAnnotation", true);
                            }
                          }} 
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Scratches</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="missingParts"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Missing Parts</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="physicalDamage"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox 
                          checked={field.value} 
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (checked) {
                              form.setValue("enablePhotoAnnotation", true);
                            }
                          }} 
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Physical Damage</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="importantFiles"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Important Files</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="noPower"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">No Power</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="repairHistory"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">With Repair History</FormLabel>
                    </FormItem>
                  )}
                />

                {!isPublic && (
                <FormField
                  control={form.control}
                  name="enablePhotoAnnotation"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0">Device Annotation</FormLabel>
                    </FormItem>
                  )}
                />
                )}
              </div>

              {!isPublic && form.watch("enablePhotoAnnotation") && (
                <div className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="annotationDeviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Device Type for Annotation:</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Device Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Laptop/Macbook">Laptop/Macbook</SelectItem>
                            <SelectItem value="IPad/Tablet">IPad/Tablet</SelectItem>
                            <SelectItem value="IPhone/Mobile">IPhone/Mobile</SelectItem>
                            <SelectItem value="Apple Watch">Apple Watch</SelectItem>
                            <SelectItem value="Computer/IMac">Computer/IMac</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("annotationDeviceType") && (
                    <>
                      <div>
                        <DeviceAnnotationCanvas
                          deviceType={form.watch("annotationDeviceType") || ""}
                          onSave={(dataUrl) => {
                            setAnnotationImageUrl(dataUrl);
                          }}
                        />
                        {annotationImageUrl && (
                          <p className="text-sm text-green-600 mt-2">✓ Annotation saved</p>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name="annotationNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Additional Notes (Optional):</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Add any additional notes about the device condition or damages..."
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            {!isPublic && (
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Cost (optional):</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="PHP" 
                        value={field.value || ""} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeFrame"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Time Frame:</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Estimated Time Frame" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Same-Day">Same-Day</SelectItem>
                        <SelectItem value="Next Business Day">Next Business Day</SelectItem>
                        <SelectItem value="1-2 Days">1-2 Days</SelectItem>
                        <SelectItem value="3-5 Days">3-5 Days</SelectItem>
                        <SelectItem value="1-2 Weeks">1-2 Weeks</SelectItem>
                        <SelectItem value="2-4 Weeks">2-4 Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            )}

            {/* Client Acknowledgement */}
            <div>
              <h2 className="text-xl font-semibold text-blue-600 mb-4">Client Acknowledgement</h2>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="ack1"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!termsRead}
                          className={!termsRead ? "opacity-50" : ""}
                        />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel className="!mt-0 text-sm">
                          I have read and understood the{" "}
                          <button
                            type="button"
                            className="text-blue-600 underline hover:text-blue-800"
                            onClick={() => setTermsModalOpen(true)}
                          >
                            Terms and Conditions
                          </button>{" "}
                          of my Service to AC Tech Repair Ph.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ack2"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel className="!mt-0 text-sm">
                          I confirm that all inputs provided in this form are true and correct based on consultation.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ack3"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel className="!mt-0 text-sm">
                          I agree that my device will be serviced and cost will be finalized based on final diagnosis.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {!isPublic && (
                <FormField
                  control={form.control}
                  name="autoApproveDiagnosis"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-2 space-y-0 rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel className="!mt-0 text-sm">
                          Client pre-approves the diagnosis — proceed with the repair without a separate approval step.
                        </FormLabel>
                        <p className="text-xs text-muted-foreground mt-1">
                          When checked, this ticket skips the "Waiting to Proceed" status and moves straight to Proceed Repair.
                        </p>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                )}

                {!isPublic && (
                <FormField
                  control={form.control}
                  name="physicalSignature"
                  render={({ field }) => (
                    <FormItem className="flex items-start space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel className="!mt-0 text-sm">
                          Client Signature (Optional)
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                )}
              </div>

              {!isPublic && form.watch("physicalSignature") && (
                <div className="mt-4">
                  <FormLabel>Client Signature:</FormLabel>
                  <p className="text-sm text-muted-foreground mb-2">
                    Please draw your signature below
                  </p>
                  <SignatureCanvasComponent 
                    ref={signatureRef}
                    onSave={(dataUrl) => {
                      setSignatureUrl(dataUrl);
                      toast({
                        title: "Signature Saved",
                        description: "Signature will be uploaded with the form",
                      });
                    }}
                  />
                  {signatureUrl && (
                    <p className="text-sm text-green-600 mt-2">✓ Signature captured</p>
                  )}
                </div>
              )}

            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
              {!isPublic && (
                <Button type="button" variant="outline" onClick={() => navigate("/admin-portal")}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Form>

        {/* Terms and Conditions Modal */}
        <Dialog open={termsModalOpen} onOpenChange={setTermsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>I have read and understood the Terms and Conditions of my Service to AC Tech Repair Ph.</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-muted flex justify-center items-start p-4">
              <img
                src={termsImage}
                alt="AC Tech Repair Terms and Conditions"
                className="max-w-full h-auto rounded-md shadow-sm"
              />
            </div>
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  setTermsRead(true);
                  form.setValue("ack1", true);
                  setTermsModalOpen(false);
                  toast({
                    title: "Terms Accepted",
                    description: "You can now proceed with the acknowledgements.",
                  });
                }}
              >
                Accept
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
  );

  if (embedded) return <div className="animate-fade-in">{content}</div>;

  return isPublic ? (
    <div className="min-h-screen w-full bg-background">
      {kioskCode ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 text-center">
          <p className="text-lg font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Your queue number
          </p>
          <div className="mt-4 text-[7rem] font-black leading-none text-blue-600 md:text-[10rem]">
            {kioskCode}
          </div>
          <p className="mt-6 max-w-xl text-xl text-foreground/80">
            Please take a seat and watch the queue screen. Your number will be
            called shortly — approach the front desk when it appears.
          </p>
          {kioskQr && (
            <div className="mt-6 flex flex-col items-center">
              <img
                src={kioskQr}
                alt={`QR code to view the live queue for ${kioskCode}`}
                className="h-44 w-44 rounded-2xl border bg-white p-2 md:h-52 md:w-52"
              />
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                Scan to watch the live queue on your phone.
              </p>
            </div>
          )}
          <p className="mt-8 text-sm text-muted-foreground">
            Returning to the form in {Math.max(kioskCountdown, 0)}s
          </p>
          <Button className="mt-4" variant="outline" onClick={() => setKioskCode(null)}>
            Done
          </Button>
        </div>
      ) : (
        content
      )}
    </div>
  ) : (
    <DashboardLayout>{content}</DashboardLayout>
  );

};

export default ServiceForm;
