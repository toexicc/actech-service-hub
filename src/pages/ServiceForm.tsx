import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import acTechLogo from "@/assets/ac-tech-logo.jpg";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { Search } from "lucide-react";

const formSchema = z.object({
  adminRep: z.string().min(1, "Admin Representative is required"),
  technician: z.string().min(1, "Technician is required"),
  clientType: z.string().min(1, "Client Type is required"),
  priority: z.string().min(1, "Priority is required"),
  clientName: z.string().min(1, "Client Name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone is required"),
  deviceType: z.string().min(1, "Device Type is required"),
  serial: z.string().min(1, "Serial is required"),
  brand: z.string().min(1, "Brand is required"),
  color: z.string().min(1, "Color is required"),
  model: z.string().min(1, "Model is required"),
  memory: z.string().min(1, "Memory is required"),
  chiefComplaint: z.string().min(1, "Chief Complaint is required"),
  dents: z.boolean().default(false),
  scratches: z.boolean().default(false),
  missingParts: z.boolean().default(false),
  physicalDamage: z.boolean().default(false),
  importantFiles: z.boolean().default(false),
  noPower: z.boolean().default(false),
  repairHistory: z.boolean().default(false),
  estimatedCost: z.string().min(1, "Estimated Cost is required"),
  timeFrame: z.string().min(1, "Time Frame is required"),
  ack1: z.boolean().refine((val) => val === true, "You must accept the terms and conditions"),
  ack2: z.boolean().refine((val) => val === true, "You must confirm the information is correct"),
  ack3: z.boolean().refine((val) => val === true, "You must agree to the service terms"),
});

type FormValues = z.infer<typeof formSchema>;

const ServiceForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [termsRead, setTermsRead] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchServiceId, setSearchServiceId] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
  }, [navigate]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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
      dents: false,
      scratches: false,
      missingParts: false,
      physicalDamage: false,
      importantFiles: false,
      noPower: false,
      repairHistory: false,
      estimatedCost: "",
      timeFrame: "",
      ack1: false,
      ack2: false,
      ack3: false,
    },
  });

  const generateServiceId = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear()).slice(-2);
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const milliseconds = String(now.getMilliseconds()).charAt(0);
    return `${day}${month}${year}${seconds}${milliseconds}`;
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

      if (response.ok) {
        const result = await response.json();
        if (result.found) {
          setServiceId(searchServiceId);
          form.setValue("clientName", result.data.name || "");
          form.setValue("phone", result.data.contactNumber || "");
          form.setValue("model", result.data.device || "");
          form.setValue("chiefComplaint", result.data.initialDiagnosis || "");
          form.setValue("estimatedCost", result.data.estimatedCost || "");
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

      const formData = new FormData();
      formData.append("Service ID", finalServiceId);
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
      formData.append("Time Frame", data.timeFrame);
      formData.append("Estimated Cost", data.estimatedCost);
      formData.append("Acknowledgement 1", data.ack1 ? "Yes" : "No");
      formData.append("Acknowledgement 2", data.ack2 ? "Yes" : "No");
      formData.append("Acknowledgement 3", data.ack3 ? "Yes" : "No");

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Service form submitted successfully! Service ID: ${finalServiceId}`,
        });
        form.reset();
        setServiceId("");
        setSearchServiceId("");
        setTermsRead(false);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6 md:p-8">
        <div className="text-center mb-8">
          <img src={acTechLogo} alt="AC Tech Repair" className="mx-auto h-16 mb-4 object-contain" />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Initial Diagnosis Form</h1>
          <p className="text-muted-foreground">Client Initial Diagnosis Form</p>
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
                        <SelectItem value="Admin 1">Admin 1</SelectItem>
                        <SelectItem value="Admin 2">Admin 2</SelectItem>
                        <SelectItem value="Admin 3">Admin 3</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Technician" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Tech 1">Tech 1</SelectItem>
                        <SelectItem value="Tech 2">Tech 2</SelectItem>
                        <SelectItem value="Tech 3">Tech 3</SelectItem>
                      </SelectContent>
                    </Select>
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
                          <SelectItem value="Rush">Rush</SelectItem>
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Device Type:</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Device" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Mobile (iPhone)">Mobile (iPhone)</SelectItem>
                          <SelectItem value="Laptop (Mac)">Laptop (Mac)</SelectItem>
                          <SelectItem value="iPad">iPad</SelectItem>
                          <SelectItem value="Apple Watch">Apple Watch</SelectItem>
                          <SelectItem value="Computer (iMac)">Computer (iMac)</SelectItem>
                          <SelectItem value="Computer (Mac Mini)">Computer (Mac Mini)</SelectItem>
                          <SelectItem value="Mobile (Android)">Mobile (Android)</SelectItem>
                          <SelectItem value="Tablet (Android)">Tablet (Android)</SelectItem>
                          <SelectItem value="Laptop (Windows)">Laptop (Windows)</SelectItem>
                          <SelectItem value="Desktop Computer (Windows)">Desktop Computer (Windows)</SelectItem>
                          <SelectItem value="Drone">Drone</SelectItem>
                          <SelectItem value="Speakers">Speakers</SelectItem>
                          <SelectItem value="Gaming Consoles">Gaming Consoles</SelectItem>
                          <SelectItem value="Gaming Controllers">Gaming Controllers</SelectItem>
                          <SelectItem value="Headphones ">Headphones </SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
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
              </div>
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
                      <Input {...field} placeholder="PHP" />
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
                        <SelectItem value="Same Day">Same Day</SelectItem>
                        <SelectItem value="Next Business Day">Next Business Day</SelectItem>
                        <SelectItem value="1-2 Days">1-2 Days</SelectItem>
                        <SelectItem value="2-3 Days">2-3 Days</SelectItem>
                        <SelectItem value="5-7 Days">5-7 Days</SelectItem>
                        <SelectItem value="1-2 Weeks">1-2 Weeks</SelectItem>
                        <SelectItem value="2-5 Weeks">2-5 Weeks</SelectItem>
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
                          <a
                            href="https://bit.ly/actech-termsnconditions"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline hover:text-blue-800"
                            onClick={() => setTermsRead(true)}
                          >
                            Terms and Conditions
                          </a>{" "}
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
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/admin-portal")}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ServiceForm;
