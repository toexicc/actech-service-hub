import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import acTechLogo from "@/assets/ac-tech-logo.jpg";
import { Loader2, UserPlus, Trash2 } from "lucide-react";

interface StaffMember {
  staffId: string;
  name: string;
  role: string;
  status: string;
}

const StaffManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "",
    role: "",
    status: "Full-Time",
  });

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    } else {
      fetchStaffList();
    }
  }, [navigate]);

  const fetchStaffList = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${GOOGLE_SHEETS_SCRIPT_URL}?action=getStaffList`
      );
      const data = await response.json();
      
      if (data.status === "success") {
        setStaffList(data.data);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch staff list",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast({
        title: "Error",
        description: "Failed to connect to Google Sheets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.role) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setAddingStaff(true);
    try {
      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "addStaff",
          name: newStaff.name,
          role: newStaff.role,
          status: newStaff.status,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Success",
          description: "Staff member added successfully",
        });
        setNewStaff({ name: "", role: "", status: "Full-Time" });
        fetchStaffList();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to add staff member",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding staff:", error);
      toast({
        title: "Error",
        description: "Failed to add staff member",
        variant: "destructive",
      });
    } finally {
      setAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) {
      return;
    }

    try {
      const response = await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "removeStaff",
          staffId: staffId,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        toast({
          title: "Success",
          description: "Staff member removed successfully",
        });
        fetchStaffList();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to remove staff member",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error removing staff:", error);
      toast({
        title: "Error",
        description: "Failed to remove staff member",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <img
            src={acTechLogo}
            alt="AC Tech Repair"
            className="mx-auto h-20 mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-blue-600 mb-2">
            Staff Management
          </h1>
          <Button onClick={() => navigate("/admin-portal")} variant="outline">
            Back to Admin Portal
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Add New Staff Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New Staff Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newStaff.name}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, name: e.target.value })
                    }
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={newStaff.role}
                    onValueChange={(value) =>
                      setNewStaff({ ...newStaff, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Technician">Technician</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newStaff.status}
                    onValueChange={(value) =>
                      setNewStaff({ ...newStaff, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-Time">Full-Time</SelectItem>
                      <SelectItem value="Part-Time">Part-Time</SelectItem>
                      <SelectItem value="Internship">Internship</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddStaff}
                    disabled={addingStaff}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {addingStaff ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Staff"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Staff List Table */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Members</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : staffList.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No staff members found
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffList.map((staff) => (
                        <TableRow key={staff.staffId}>
                          <TableCell className="font-medium">
                            {staff.staffId}
                          </TableCell>
                          <TableCell>{staff.name}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                staff.role === "Admin"
                                  ? "bg-purple-100 text-purple-800"
                                  : staff.role === "Technician"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {staff.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                staff.status === "Full-Time"
                                  ? "bg-green-100 text-green-800"
                                  : staff.status === "Part-Time"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : staff.status === "Internship"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {staff.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveStaff(staff.staffId)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
      </div>
    </div>
  );
};

export default StaffManagement;
