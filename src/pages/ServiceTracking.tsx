import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { normalizeGoogleDrivePdfUrl } from "@/lib/utils";
import { Search, User, FileText } from "lucide-react";
import logo from "@/assets/ac-tech-logo.jpg";

interface CustomerData {
  clientId: string;
  clientName: string;
  username: string;
  phone: string;
  email: string;
  serviceIds: string[];
}

interface ServiceRecord {
  serviceId: string;
  status: string;
  service: string;
  targetDate: string;
  serviceCost: string;
  pdfUrl?: string;
}

const ServiceTracking = () => {
  const [serviceId, setServiceId] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [showOtherDeviceInput, setShowOtherDeviceInput] = useState(false);
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<"service" | "client">("service");
  
  // Client ID search states
  const [clientId, setClientId] = useState("");
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!serviceId || !deviceType) {
      toast({
        title: "Missing Information",
        description: "Please enter both Service ID and Device Type",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchService&serviceId=${serviceId}&deviceType=${deviceType}`,
      );
      const data = await response.json();

      if (data.status === "found") {
        setServiceData(data.data);
      } else {
        toast({
          title: "Not Found",
          description: "No service found with the provided details",
          variant: "destructive",
        });
        setServiceData(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch service data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientSearch = async () => {
    if (!clientId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a Client ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingClient(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=searchClient&clientId=${encodeURIComponent(clientId)}`
      );
      const data = await response.json();

      if (data.status === "success" && data.customer) {
        setCustomerData(data.customer);
        setServiceRecords(data.services || []);
        
        if (!data.services || data.services.length === 0) {
          toast({
            title: "Customer Found",
            description: "Customer found but no service records available",
          });
        }
      } else {
        toast({
          title: "Not Found",
          description: "No customer found with this Client ID",
          variant: "destructive",
        });
        setCustomerData(null);
        setServiceRecords([]);
      }
    } catch (error) {
      console.error("Error searching customer:", error);
      toast({
        title: "Error",
        description: "Failed to search for customer",
        variant: "destructive",
      });
      setCustomerData(null);
      setServiceRecords([]);
    } finally {
      setIsLoadingClient(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleClientSearch();
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("completed") || statusLower.includes("closed")) {
      return "bg-green-100 text-green-800";
    }
    if (statusLower.includes("ongoing") || statusLower.includes("progress")) {
      return "bg-blue-100 text-blue-800";
    }
    if (statusLower.includes("pending")) {
      return "bg-yellow-100 text-yellow-800";
    }
    if (statusLower.includes("cancelled") || statusLower.includes("hold")) {
      return "bg-red-100 text-red-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  const handleViewPDF = (pdfUrl: string) => {
    if (!pdfUrl) {
      toast({
        title: "No PDF Available",
        description: "PDF link not found for this service",
        variant: "destructive",
      });
      return;
    }
    const url = normalizeGoogleDrivePdfUrl(pdfUrl, "preview");
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <img src={logo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Service - Track your Device</p>
          </div>
        </div>

        {/* Tabs for Search Modes */}
        <Tabs 
          value={searchMode} 
          onValueChange={(value) => {
            setSearchMode(value as "service" | "client");
            // Clear results when switching modes
            if (value === "service") {
              setCustomerData(null);
              setServiceRecords([]);
            } else {
              setServiceData(null);
            }
          }} 
          className="mb-8"
        >
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="service">
              <Search className="h-4 w-4 mr-2" />
              Service ID
            </TabsTrigger>
            <TabsTrigger value="client">
              <User className="h-4 w-4 mr-2" />
              Client ID
            </TabsTrigger>
          </TabsList>

          {/* Service ID Search Tab */}
          <TabsContent value="service">
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="serviceId">Enter Service ID:</Label>
                    <Input
                      id="serviceId"
                      placeholder="Enter service ID"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deviceType">Select Device Type:</Label>
                    {!showOtherDeviceInput ? (
                      <Select
                        value={deviceType}
                        onValueChange={(value) => {
                          if (value === "Others") {
                            setShowOtherDeviceInput(true);
                            setDeviceType("");
                          } else {
                            setDeviceType(value);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select device type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mobile (iPhone)">Mobile (iPhone)</SelectItem>
                          <SelectItem value="Laptop (Mac)">Laptop (Mac)</SelectItem>
                          <SelectItem value="iPad">iPad</SelectItem>
                          <SelectItem value="Apple Watch">Apple Watch</SelectItem>
                          <SelectItem value="Mobile (Android)">Mobile (Android)</SelectItem>
                          <SelectItem value="Tablet (Android)">Tablet (Android)</SelectItem>
                          <SelectItem value="Laptop (Windows)">Laptop (Windows)</SelectItem>
                          <SelectItem value="Computer (iMac)">Computer (iMac)</SelectItem>
                          <SelectItem value="Desktop Computer (Windows)">Desktop Computer (Windows)</SelectItem>
                          <SelectItem value="Computer (Mac Mini)">Computer (Mac Mini)</SelectItem>
                          <SelectItem value="Drone">Drone</SelectItem>
                          <SelectItem value="Speakers">Speakers</SelectItem>
                          <SelectItem value="Gaming Consoles">Gaming Consoles</SelectItem>
                          <SelectItem value="Gaming Controllers">Gaming Controllers</SelectItem>
                          <SelectItem value="Headphones">Headphones</SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="deviceType"
                        placeholder="Enter device type"
                        value={deviceType}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDeviceType(value);
                          if (value === "") {
                            setShowOtherDeviceInput(false);
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <Button onClick={handleSearch} disabled={isLoading} className="w-full mt-6">
                  {isLoading ? "Searching..." : "Track Service"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client ID Search Tab */}
          <TabsContent value="client">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search by Client ID
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      placeholder="Enter Client ID (e.g., CL1234567890)"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      onKeyPress={handleKeyPress}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleClientSearch} disabled={isLoadingClient} className="bg-blue-600 hover:bg-blue-700">
                      <Search className="h-4 w-4 mr-2" />
                      {isLoadingClient ? "Searching..." : "Search"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Service Details */}
        {serviceData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Service Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Status:</h3>
                <p className="text-lg font-bold text-primary">{serviceData.status || "PENDING - APPROVAL"}</p>
              </div>

              <Separator />

              {/* Client and Device Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client Name:</h3>
                  <p className="text-lg">{serviceData.clientName}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Device:</h3>
                  <p className="text-lg">{serviceData.device}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Serial Number:</h3>
                  <p className="text-lg">
                    {serviceData.serialNumber ? 
                      serviceData.serialNumber.slice(0, -5) + "*****" : 
                      "N/A"
                    }
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Color & Memory:</h3>
                  <p className="text-lg">{serviceData.colorMemory}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Date:</h3>
                  <p className="text-lg">{serviceData.timestamp || "N/A"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Target Date:</h3>
                  <p className="text-lg">{serviceData.targetDate || "N/A"}</p>
                </div>
              </div>

              <Separator />

              {/* Service Details */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service/s:</h3>
                <p className="text-lg">{serviceData.service}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Service Cost:</h3>
                <p className="text-lg font-semibold">Php {serviceData.serviceCost}</p>
              </div>

              {serviceData.technician && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Technician:</h3>
                  <p className="text-lg">{serviceData.technician}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">Admin Notes:</h3>
                <p className="text-lg">{serviceData.adminNotes?.trim() ? serviceData.adminNotes : "N/A"}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer Information and Services (Client ID Search Results) */}
        {customerData && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Customer Information - 1/3 width */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client ID:</h3>
                  <p className="text-lg font-bold text-primary">{customerData.clientId}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Client Name:</h3>
                  <p className="text-lg">{customerData.clientName || "N/A"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Username:</h3>
                  <p className="text-lg">{customerData.username || "N/A"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Contact Number:</h3>
                  <p className="text-lg">{customerData.phone || "N/A"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Email:</h3>
                  <p className="text-lg break-words">{customerData.email || "N/A"}</p>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">Total Services:</h3>
                  <p className="text-2xl font-bold text-primary">{serviceRecords.length}</p>
                </div>
              </CardContent>
            </Card>

            {/* Services Table - 2/3 width */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Services</CardTitle>
              </CardHeader>
              <CardContent>
                {serviceRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No service records found for this customer
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Service/s</TableHead>
                          <TableHead>Expected Date</TableHead>
                          <TableHead>Service Cost</TableHead>
                          <TableHead>Client Form</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceRecords.map((service, index) => (
                          <TableRow key={service.serviceId || index}>
                            <TableCell className="font-medium">{service.serviceId}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(service.status)}`}>
                                {service.status}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              {service.service || "N/A"}
                            </TableCell>
                            <TableCell>{service.targetDate || "N/A"}</TableCell>
                            <TableCell className="font-semibold">
                              {service.serviceCost ? `Php ${service.serviceCost}` : "N/A"}
                            </TableCell>
                            <TableCell>
                              {service.pdfUrl ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewPDF(service.pdfUrl!)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <FileText className="h-4 w-4 mr-1" />
                                  View PDF
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-sm">N/A</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">powered by Stack&Scale</div>
      </div>
    </div>
  );
};

export default ServiceTracking;
