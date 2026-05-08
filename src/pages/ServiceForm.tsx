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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import acTechLogo from "@/assets/S_S_Marketing-2.png";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { Search, Loader2 } from "lucide-react";
import { generateServicePDF } from "@/lib/pdfGenerator";
import { DEVICE_TYPES, DEVICE_TYPES_BY_DEPARTMENT } from "@/lib/constants";
import SignatureCanvasComponent, { type SignatureCanvasRef } from "@/components/SignatureCanvas";
import { DeviceAnnotationCanvas } from "@/components/DeviceAnnotationCanvas";
import { handleError, withErrorHandling } from "@/lib/errorHandling";
import { sanitizeInput, phoneSchema, emailSchema, nameSchema, priceSchema } from "@/lib/validation";
import { MultiSelect } from "@/components/ui/multi-select";
import termsImage from "@/assets/terms-and-conditions.jpg";
import { notifyNewServiceAssignment } from "@/lib/serviceNotifications";
import { useStaff } from "@/hooks/useStaff";
import { logActivity } from "@/lib/activityLogger";
import { preloadPdfAssets } from "@/lib/pdfAssets";

const buildFormSchema = (isPublic: boolean) => z.object({
  clientId: z.string().optional(),
  adminRep: isPublic ? z.string().optional() : z.string().min(1, "Admin Representative is required"),
  receivingStaff: isPublic ? z.string().optional() : z.string().min(1, "Receiving Staff is required"),
  technician: isPublic ? z.string().optional() : z.string().min(1, "Technician is required"),
  clientType: z.string().min(1, "Client Type is required"),
  priority: z.string().min(1, "Priority is required"),
  clientName: z.string().min(1, "Client Name is required"),
  username: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().min(1, "Phone is required"),
  deviceType: z.string().min(1, "Device Type is required"),
  serial: z.string().min(1, "Serial is required"),
  brand: z.string().min(1, "Brand is required"),
  color: z.string().min(1, "Color is required"),
  model: z.string().min(1, "Model is required"),
  memory: z.string().min(1, "Memory is required"),
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
  estimatedCost: isPublic ? z.number().optional() : z.number().min(1, "Estimated Cost is required"),
  timeFrame: isPublic ? z.string().optional() : z.string().min(1, "Time Frame is required"),
  ack1: z.boolean().refine((val) => val === true, "You must accept the terms and conditions"),
  ack2: z.boolean().refine((val) => val === true, "You must confirm the information is correct"),
  ack3: z.boolean().refine((val) => val === true, "You must agree to the service terms"),
  enablePhotoAnnotation: z.boolean().default(false),
  annotationDeviceType: z.string().optional(),
  annotationNotes: z.string().optional(),
});

const formSchema = buildFormSchema(false);

type FormValues = z.infer<typeof formSchema>;

const ServiceForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPublic = location.pathname === "/intake";
  const activeSchema = useMemo(() => buildFormSchema(isPublic), [isPublic]);
  const { toast } = useToast();
  const [termsRead, setTermsRead] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [showOtherDeviceInput, setShowOtherDeviceInput] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [searchClientId, setSearchClientId] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const [annotationImageUrl, setAnnotationImageUrl] = useState("");

  // Use React Query for staff data
  const { data: staffData = [] } = useStaff();
  
  // Admin Rep + Receiving Staff: include both admin and management roles
  const adminList = staffData
    .filter((staff) => {
      const role = staff.role?.toLowerCase();
      return (role === "admin" || role === "management") && staff.status?.toLowerCase() !== "inactive";
    })
    .map((staff) => staff.name);

  const receivingStaffList = adminList;

  const technicianList = staffData
    .filter((staff) => staff.role?.toLowerCase() === "technician" && staff.status?.toLowerCase() !== "inactive")
    .map((staff) => ({
      name: staff.name,
      department: staff.department || ""
    }));

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

  const generateServiceId = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear()).slice(-2);
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const milliseconds = String(now.getMilliseconds()).charAt(0);
    return `AC${day}${month}${year}${seconds}${milliseconds}`;
  };

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
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchClient&clientId=${encodeURIComponent(searchClientId)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      // Support both legacy and new response shapes
      let found = false;
      let customer: { clientName?: string; username?: string; phone?: string; email?: string } = {};

      if (result && result.found && result.data) {
        found = true;
        customer = {
          clientName: result.data.clientName,
          username: result.data.username,
          phone: result.data.contactNumber, // legacy key
          email: result.data.email,
        };
      } else if (result && result.status === "success" && result.customer) {
        found = true;
        customer = {
          clientName: result.customer.clientName,
          username: result.customer.username,
          phone: result.customer.phone, // new key
          email: result.customer.email,
        };
      }

      if (found) {
        form.setValue("clientId", searchClientId);
        form.setValue("clientName", customer.clientName || "");
        form.setValue("username", customer.username || "");
        form.setValue("phone", customer.phone || "");
        form.setValue("email", customer.email || "");
        form.setValue("clientType", "Returning Client");
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

    try {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const timestamp = `${month}-${day}-${year}, ${hours}:${minutes}`;
      const finalServiceId = serviceId || generateServiceId();

      // Generate PDF (assets are preloaded, so this is fast)
      const pdfBlob = await generateServicePDF({
        serviceId: finalServiceId,
        timestamp,
        adminRep: data.adminRep || "",
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

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      // CORS can block reading response even on success
      const isResponseOk = response.ok;

      if (isResponseOk) {
        // Show success immediately - don't wait for notifications/logging
        toast({
          title: "Success",
          description: `Service form submitted successfully! Service ID: ${finalServiceId}`,
        });
        form.reset();
        setServiceId("");
        setTermsRead(false);
        setSignatureUrl("");
        setAnnotationImageUrl("");
        if (signatureRef.current) {
          signatureRef.current.clear();
        }

        // Fire-and-forget: notifications and logging (don't block UI)
        const adminName = sessionStorage.getItem("userFullName") || data.adminRep;
        const username = sessionStorage.getItem("username") || data.adminRep;
        const role = sessionStorage.getItem("userRole") || "admin";
        
        // Run all notifications in parallel, non-blocking
        Promise.allSettled([
          ...techNames.map(techName => 
            notifyNewServiceAssignment(
              {
                serviceId: finalServiceId,
                clientName: data.clientName,
                technician: techName,
                adminRep: data.adminRep,
                deviceType: data.deviceType,
                device: data.model,
              },
              techName,
              adminName
            )
          ),
          logActivity({
            serviceId: finalServiceId,
            username,
            role,
            activity: `New service created - Client: ${data.clientName}, Device: ${data.deviceType} ${data.brand} ${data.model}, Technician: ${data.technician}, Priority: ${data.priority}`,
          }),
        ]).catch(() => {});
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
        setServiceId("");
        
        setTermsRead(false);
        setSignatureUrl("");
        setAnnotationImageUrl("");
        if (signatureRef.current) {
          signatureRef.current.clear();
        }
        return;
      }

      // Error submitting form
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 animate-fade-in pb-8">
        <div className="max-w-4xl mx-auto bg-card rounded-lg shadow-xl p-6 md:p-8 border border-border/50 mb-0">
        
        <div className="text-center mb-8">
          <img src={acTechLogo} alt="AC Tech Repair" className="mx-auto h-16 mb-4 object-contain" />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Initial Diagnosis Form</h1>
          <p className="text-muted-foreground">Client Initial Diagnosis Form</p>
        </div>

        {/* Client ID Search */}
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




        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Admin Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="adminRep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Rep:</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Admin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {adminList.length > 0 ? (
                          adminList.map((admin) => (
                            <SelectItem key={admin} value={admin}>
                              {admin}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="No Admins" disabled>
                            No Admins Available
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
                        {receivingStaffList.length > 0 ? (
                          receivingStaffList.map((staff) => (
                            <SelectItem key={staff} value={staff}>
                              {staff}
                            </SelectItem>
                          ))
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
                name="technician"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician:</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={technicianList.map(tech => ({
                          label: tech.name,
                          value: tech.name,
                          group: tech.department
                        }))}
                        selected={field.value ? field.value.split(", ") : []}
                        onChange={(values) => field.onChange(values.join(", "))}
                        placeholder="Select Technicians"
                        grouped
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Information */}
            <div>
              <h2 className="text-xl font-semibold text-blue-600 mb-4">Contact Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
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
                          <SelectItem value="New Client">New Client</SelectItem>
                          <SelectItem value="Returning Client">Returning Client</SelectItem>
                          <SelectItem value="Backjob">Backjob</SelectItem>
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
                          <SelectItem value="Rush (with 10% Rush Fee)">Rush (with 10% Rush Fee)</SelectItem>
                          <SelectItem value="Loyalty">Loyalty</SelectItem>
                          <SelectItem value="Normal">Normal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                      <FormLabel>Username:</FormLabel>
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
                        <Input type="email" {...field} />
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
                    // Get selected technicians' departments
                    const selectedTechNames = form.watch("technician")?.split(", ").filter(Boolean) || [];
                    const selectedTechDepartments = selectedTechNames
                      .map(name => technicianList.find(t => t.name === name)?.department)
                      .filter(Boolean) as string[];
                    
                    // Get available device types based on selected departments
                    const availableDeviceTypes = selectedTechDepartments.length > 0
                      ? Array.from(new Set(
                          selectedTechDepartments.flatMap(dept => 
                            DEVICE_TYPES_BY_DEPARTMENT[dept] || []
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
                      <FormLabel>Memory:</FormLabel>
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
                  <FormLabel>Chief Complaint:</FormLabel>
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
              </div>

              {form.watch("enablePhotoAnnotation") && (
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

            {/* Cost and Time */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimatedCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Cost:</FormLabel>
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
                    <FormLabel>Time Frame:</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Time Frame" />
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
              </div>

              {form.watch("physicalSignature") && (
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
              <Button type="button" variant="outline" onClick={() => navigate("/admin-portal")}>
                Cancel
              </Button>
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
    </DashboardLayout>
  );
};

export default ServiceForm;
