import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import logo from "@/assets/ac-tech-logo.jpg";

const ServiceTracking = () => {
  const [serviceId, setServiceId] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [serviceData, setServiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
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
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=search&serviceId=${serviceId}&deviceType=${deviceType}`
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

        {/* Search Form */}
        <Card className="mb-8">
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
                <Select value={deviceType} onValueChange={setDeviceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mobile (iOS)">Mobile (iOS)</SelectItem>
                    <SelectItem value="Laptop (Mac)">Laptop (Mac)</SelectItem>
                    <SelectItem value="iPad">iPad</SelectItem>
                    <SelectItem value="Apple Watch">Apple Watch</SelectItem>
                    <SelectItem value="Mobile (Android)">Mobile (Android)</SelectItem>
                    <SelectItem value="Tablet (Android)">Tablet (Android)</SelectItem>
                    <SelectItem value="Laptop (Windows)">Laptop (Windows)</SelectItem>
                    <SelectItem value="Computer (iMac)">Computer (iMac)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full mt-6"
            >
              {isLoading ? "Searching..." : "Track Service"}
            </Button>
          </CardContent>
        </Card>

        {/* Service Details */}
        {serviceData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Service Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                  Status:
                </h3>
                <p className="text-lg font-bold text-primary">
                  {serviceData.status || "PENDING - APPROVAL"}
                </p>
              </div>

              <Separator />

              {/* Client and Device Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Client Name:
                  </h3>
                  <p className="text-lg">{serviceData.clientName}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Device:
                  </h3>
                  <p className="text-lg">{serviceData.device}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Serial Number:
                  </h3>
                  <p className="text-lg">{serviceData.serialNumber}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Color & Memory:
                  </h3>
                  <p className="text-lg">{serviceData.colorMemory}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Service Date:
                  </h3>
                  <p className="text-lg">{serviceData.timestamp}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Time Frame:
                  </h3>
                  <p className="text-lg">{serviceData.timeFrame}</p>
                </div>
              </div>

              <Separator />

              {/* Service Details */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                  Service/s:
                </h3>
                <p className="text-lg">{serviceData.service}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                  Service Cost:
                </h3>
                <p className="text-lg font-semibold">
                  Php {serviceData.serviceCost}
                </p>
              </div>

              {serviceData.technician && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Technician:
                  </h3>
                  <p className="text-lg">{serviceData.technician}</p>
                </div>
              )}

              {serviceData.techNotes && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Tech Notes (C):
                  </h3>
                  <p className="text-lg">{serviceData.techNotes}</p>
                </div>
              )}

              {serviceData.finalCost && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                    Final Cost to be Updated:
                  </h3>
                  <p className="text-lg">{serviceData.finalCost}</p>
                </div>
              )}

              {serviceData.serviceReport && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                    Service Report:
                  </h3>
                  <Button variant="outline" asChild>
                    <a href={serviceData.serviceReport} target="_blank" rel="noopener noreferrer">
                      Download Report Here
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          powered by techbros
        </div>
      </div>
    </div>
  );
};

export default ServiceTracking;
