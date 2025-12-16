import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
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
import acTechLogo from "@/assets/ac-tech-logo.jpg";
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

const formSchema = z.object({
  clientId: z.string().optional(),
  adminRep: z.string().min(1, "Admin Representative is required"),
  technician: z.string().min(1, "Technician is required"),
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
  estimatedCost: z.number().min(1, "Estimated Cost is required"),
  timeFrame: z.string().min(1, "Time Frame is required"),
  ack1: z.boolean().refine((val) => val === true, "You must accept the terms and conditions"),
  ack2: z.boolean().refine((val) => val === true, "You must confirm the information is correct"),
  ack3: z.boolean().refine((val) => val === true, "You must agree to the service terms"),
  enablePhotoAnnotation: z.boolean().default(false),
  annotationDeviceType: z.string().optional(),
  annotationNotes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const ServiceForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [termsRead, setTermsRead] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchServiceId, setSearchServiceId] = useState("");
  const [showOtherDeviceInput, setShowOtherDeviceInput] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [searchClientId, setSearchClientId] = useState("");
  const [adminList, setAdminList] = useState<string[]>([]);
  const [technicianList, setTechnicianList] = useState<Array<{name: string, department: string}>>([]);
  const [signatureUrl, setSignatureUrl] = useState("");
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const [annotationImageUrl, setAnnotationImageUrl] = useState("");


  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    } else {
      fetchStaffLists();
    }
  }, [navigate]);

  const fetchStaffLists = async () => {
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`
      );
      const data = await response.json();
      
      if (data.status === "success") {
        const admins = data.data
          .filter((staff: any) => staff.role === "Admin" && staff.status !== "Inactive")
          .map((staff: any) => staff.name);
        const technicians = data.data
          .filter((staff: any) => staff.role === "Technician" && staff.status !== "Inactive")
          .map((staff: any) => ({
            name: staff.name,
            department: staff.department || ""
          }));
        
        setAdminList(admins);
        setTechnicianList(technicians);
      }
    } catch (error) {
      console.error("Error fetching staff lists:", error);
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: "",
      adminRep: "",
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
    } catch (error) {
      console.error("Error searching client ID:", error);
      toast({
        title: "Error",
        description: "Failed to search client ID. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingClient(false);
    }
  };

  const handleSearchServiceId = async () => {
    if (!searchServiceId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Service ID to search",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=search&serviceId=${encodeURIComponent(searchServiceId)}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.found) {
        setServiceId(searchServiceId);
        form.setValue("clientName", result.data.name || "");
        form.setValue("phone", result.data.contactNumber || "");
        form.setValue("model", result.data.device || "");
        form.setValue("chiefComplaint", result.data.initialDiagnosis || "");
        form.setValue("estimatedCost", parseFloat(result.data.estimatedCost) || 0);
        toast({
          title: "Success",
          description: "Service information loaded successfully!",
        });
      } else {
        toast({
          title: "Not Found",
          description: "Service ID not found in database",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error searching service ID:", error);
      toast({
        title: "Error",
        description: "Failed to search service ID. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

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

      // Generate PDF
      console.log("Generating PDF...");
      const pdfBlob = await generateServicePDF({
        serviceId: finalServiceId,
        timestamp,
        adminRep: data.adminRep,
        technician: data.technician,
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
        estimatedCost: data.estimatedCost,
        timeFrame: data.timeFrame,
        signatureUrl: signatureUrl || undefined,
        annotationImageUrl: annotationImageUrl || undefined,
        annotationNotes: data.annotationNotes || undefined,
      });
      console.log("PDF generated successfully:", pdfBlob);

      // Fallback: also send base64 for Apps Script environments where e.files is unavailable
      const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const pdfBase64 = await blobToBase64(pdfBlob);

      const formData = new FormData();
      formData.append("Service ID", finalServiceId);
      formData.append("Client ID", data.clientId || "");
      formData.append("Timestamp", timestamp);
      formData.append("Admin Representative", data.adminRep);
      formData.append("Technician", data.technician);
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
      const techNames = data.technician.split(", ").filter(Boolean);
      const allDepartments = techNames
        .map(name => technicianList.find(t => t.name === name)?.department)
        .filter(Boolean);
      const uniqueDepartments = [...new Set(allDepartments)]; // Remove duplicates
      formData.append("Technician Department", uniqueDepartments.join(", ") || "");
      
      formData.append("Time Frame", data.timeFrame);
      formData.append("Estimated Cost", data.estimatedCost.toString());
      formData.append("Acknowledgement 1", data.ack1 ? "Yes" : "No");
      formData.append("Acknowledgement 2", data.ack2 ? "Yes" : "No");
      formData.append("Acknowledgement 3", data.ack3 ? "Yes" : "No");
      
      // Append PDF file with Service ID in filename
      const sanitizeFileName = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');
      const pdfFileName = `${finalServiceId}_${sanitizeFileName(data.clientName)}_${sanitizeFileName(data.deviceType)}.pdf`;
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });
      console.log("Appending PDF with filename:", pdfFileName);
      formData.append("PDF", pdfFile);
      // Base64 fallback for Apps Script if e.files is not populated
      formData.append("PDF_Base64", pdfBase64);
      formData.append("PDF_FileName", pdfFileName);
      formData.append("PDF_MimeType", "application/pdf");

      // Handle signature if provided
      if (data.physicalSignature && signatureUrl) {
        // Convert base64 to blob
        const signatureBase64 = signatureUrl.split(',')[1];
        const byteCharacters = atob(signatureBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
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

      if (response.ok) {
        // Notify assigned technician(s)
        const techNames = data.technician.split(", ").filter(Boolean);
        const adminName = sessionStorage.getItem("userFullName") || data.adminRep;
        for (const techName of techNames) {
          await notifyNewServiceAssignment(
            {
              serviceId: finalServiceId,
              clientName: data.clientName,
              technician: techName,
              deviceType: data.deviceType,
              device: data.model,
            },
            techName,
            adminName
          );
        }

        toast({
          title: "Success",
          description: `Service form submitted successfully! Service ID: ${finalServiceId}`,
        });
        form.reset();
        setServiceId("");
        setSearchServiceId("");
        setTermsRead(false);
        setSignatureUrl("");
        setAnnotationImageUrl("");
        if (signatureRef.current) {
          signatureRef.current.clear();
        }
      } else {
        throw new Error("Failed to submit form");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
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
      <div className="p-4 md:p-8 animate-fade-in">
        <div className="max-w-4xl mx-auto bg-card rounded-lg shadow-xl p-6 md:p-8 border border-border/50">
        
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

        {/* Service ID Search */}
        <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-600 mb-3">Service ID Search</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Enter Service ID to load existing data"
              value={searchServiceId}
              onChange={(e) => setSearchServiceId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchServiceId()}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleSearchServiceId}
              disabled={isSearching}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Search className="mr-2 h-4 w-4" />
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>
          {serviceId && <p className="mt-2 text-sm text-green-600 font-medium">Loaded Service ID: {serviceId}</p>}
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
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
