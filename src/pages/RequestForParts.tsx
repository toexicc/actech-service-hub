import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { DEVICE_TYPES } from "@/lib/constants";
import { Package, Plus, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/DashboardLayout";

const RequestForParts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");
  const userFullName = sessionStorage.getItem("userFullName") || "User";
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateNeeded, setDateNeeded] = useState<Date | undefined>(undefined);
  
  const [formData, setFormData] = useState({
    serviceId: "",
    partName: "",
    deviceType: "",
    brand: "",
    model: "",
    quantity: "",
    remarks: ""
  });

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    // Only admin and technician can access
    if (userRole !== "admin" && userRole !== "technician" && userRole !== "management") {
      navigate("/menu");
    }
  }, [navigate, userRole]);

  const handleSubmit = async () => {
    if (!formData.serviceId || !formData.partName || !formData.quantity || !dateNeeded) {
      toast({
        title: "Validation Error",
        description: "Service ID, Part Name, Quantity, and Date Needed are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("action", "addFastMovingPart");
      formDataToSend.append("requestedBy", userFullName);
      formDataToSend.append("serviceId", formData.serviceId);
      formDataToSend.append("partName", formData.partName);
      formDataToSend.append("deviceType", formData.deviceType);
      formDataToSend.append("brand", formData.brand);
      formDataToSend.append("model", formData.model);
      formDataToSend.append("quantity", formData.quantity);
      formDataToSend.append("dateNeeded", format(dateNeeded, "yyyy-MM-dd"));
      formDataToSend.append("status", "For Ordering");
      formDataToSend.append("remarks", formData.remarks);

      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        body: formDataToSend,
      });

      const result = await response.json();

      if (result.result === "success") {
        toast({
          title: "Success",
          description: "Part request submitted successfully",
        });
        setIsDialogOpen(false);
        setFormData({
          serviceId: "",
          partName: "",
          deviceType: "",
          brand: "",
          model: "",
          quantity: "",
          remarks: ""
        });
        setDateNeeded(undefined);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to submit request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Request for Parts</h1>
              <p className="text-muted-foreground">Submit parts requests for services</p>
            </div>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to Request Parts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Use this page to submit part requests for services you're working on. 
              Management will be notified and process your order.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary mb-2">1</div>
                <h3 className="font-semibold mb-1">Submit Request</h3>
                <p className="text-sm text-muted-foreground">
                  Click "New Request" and fill in the part details along with the Service ID.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary mb-2">2</div>
                <h3 className="font-semibold mb-1">Management Orders</h3>
                <p className="text-sm text-muted-foreground">
                  Management will review and place the order with the supplier.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary mb-2">3</div>
                <h3 className="font-semibold mb-1">Get Notified</h3>
                <p className="text-sm text-muted-foreground">
                  You'll be notified when the part is received and ready for use.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Request Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Part Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service ID *</Label>
                <Input
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  placeholder="Enter Service ID"
                />
              </div>

              <div className="space-y-2">
                <Label>Part Name *</Label>
                <Input
                  value={formData.partName}
                  onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                  placeholder="Enter Part Name"
                />
              </div>

              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select
                  value={formData.deviceType}
                  onValueChange={(value) => setFormData({ ...formData, deviceType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Device Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Enter Brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Enter Model"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="Enter Quantity"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date Needed *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateNeeded && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateNeeded ? format(dateNeeded, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateNeeded}
                        onSelect={setDateNeeded}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default RequestForParts;
