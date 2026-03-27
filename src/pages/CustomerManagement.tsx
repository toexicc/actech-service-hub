import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { displayDate } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { normalizeGoogleDrivePdfUrl } from "@/lib/utils";
import { Search, User, FileText, Loader2, ChevronDown, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients } from "@/hooks/useClients";
import logo from "@/assets/S_S_Marketing-2.png";

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

const CustomerManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: clientsList = [], isLoading: isClientsLoading } = useClients();

  const filteredClients = useMemo(() => {
    if (!customerSearch) return clientsList;
    const q = customerSearch.toLowerCase();
    return clientsList.filter(
      (c: any) =>
        c.clientId?.toLowerCase().includes(q) ||
        c.clientName?.toLowerCase().includes(q) ||
        c.contactNumber?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [clientsList, customerSearch]);

  const handleSearch = async () => {
    if (!clientId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a Client ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
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
      // Error searching customer
      toast({
        title: "Error",
        description: "Failed to search for customer",
        variant: "destructive",
      });
      setCustomerData(null);
      setServiceRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
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
    <DashboardLayout>
      <div className="p-4 sm:p-6 animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Customer Management</h1>
          <p className="text-muted-foreground">View customer service history</p>
        </div>

        {/* Customer List - Collapsible */}
        <Card className="mb-6">
          <Collapsible open={customerListOpen} onOpenChange={setCustomerListOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Customer List ({filteredClients.length})
                  </span>
                  <ChevronDown className={`h-5 w-5 transition-transform ${customerListOpen ? "rotate-180" : ""}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <Input
                  placeholder="Search customers by name, ID, contact, or email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="mb-4"
                />
                {isClientsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : filteredClients.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">No customers found</p>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClients.map((client: any) => (
                          <TableRow key={client.clientId}>
                            <TableCell className="font-medium">{client.clientId}</TableCell>
                            <TableCell>{client.clientName || "N/A"}</TableCell>
                            <TableCell>{client.contactNumber || "N/A"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{client.email || "N/A"}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setClientId(client.clientId);
                                  handleSearch();
                                }}
                              >
                                <Search className="h-3 w-3 mr-1" /> View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Customer by Client ID
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
                <Button onClick={handleSearch} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information and Services */}
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
                            <TableCell>{service.targetDate ? displayDate(service.targetDate, "MMM dd, yyyy") : "N/A"}</TableCell>
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
        <div className="text-center mt-8 text-sm text-muted-foreground">
          powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CustomerManagement;
