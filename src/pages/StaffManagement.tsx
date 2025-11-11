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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import acTechLogo from "@/assets/ac-tech-logo.jpg";
import { Loader2, UserPlus, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import {
  getAllUsers,
  addUser,
  updateUser,
  removeUser,
  UserCredential,
} from "@/lib/userCredentials";
import { DEPARTMENTS } from "@/lib/constants";

const StaffManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = sessionStorage.getItem("userRole");

  useEffect(() => {
    if (!sessionStorage.getItem("authenticated")) {
      navigate("/");
    }
    if (userRole !== "management") {
      navigate("/admin-portal");
    }
  }, [navigate, userRole]);

  const [staffList, setStaffList] = useState<UserCredential[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<UserCredential | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const itemsPerPage = 10;

  const [newStaff, setNewStaff] = useState({
    staffId: "",
    username: "",
    password: "",
    name: "",
    role: "" as "admin" | "technician" | "management",
    department: "",
    status: "active" as "active" | "inactive",
  });

  useEffect(() => {
    loadStaffList();
  }, []);

  const loadStaffList = async () => {
    const users = await getAllUsers();
    setStaffList(users);
  };

  const handleAddStaff = async () => {
    if (!newStaff.staffId || !newStaff.username || !newStaff.password || !newStaff.name || !newStaff.role) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (newStaff.role === "technician" && !newStaff.department) {
      toast({
        title: "Missing Department",
        description: "Please select a department for technician role",
        variant: "destructive",
      });
      return;
    }

    // Check if Staff ID already exists
    const existingStaffId = staffList.find((s) => s.staffId === newStaff.staffId);
    if (existingStaffId) {
      toast({
        title: "Staff ID Exists",
        description: "This Staff ID is already taken",
        variant: "destructive",
      });
      return;
    }

    // Check if username already exists
    const existingUser = staffList.find((s) => s.username === newStaff.username);
    if (existingUser) {
      toast({
        title: "Username Exists",
        description: "This username is already taken",
        variant: "destructive",
      });
      return;
    }

    const success = await addUser({
      staffId: newStaff.staffId,
      username: newStaff.username,
      password: newStaff.password,
      name: newStaff.name,
      role: newStaff.role,
      department: newStaff.role === "technician" ? newStaff.department : undefined,
      status: newStaff.status,
    });

    if (success) {
      toast({
        title: "Success",
        description: "Staff member added successfully",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to add staff member",
        variant: "destructive",
      });
      return;
    }

    setNewStaff({
      staffId: "",
      username: "",
      password: "",
      name: "",
      role: "" as "admin" | "technician" | "management",
      department: "",
      status: "active",
    });

    loadStaffList();
  };

  const handleRemoveStaff = async (username: string) => {
    if (!confirm("Are you sure you want to remove this staff member?")) {
      return;
    }

    const success = await removeUser(username);

    if (success) {
      toast({
        title: "Success",
        description: "Staff member removed successfully",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to remove staff member",
        variant: "destructive",
      });
      return;
    }

    loadStaffList();
  };

  const handleEditStaff = (staff: UserCredential) => {
    setSelectedStaff({ ...staff });
    setEditDialogOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!selectedStaff) return;

    if (!selectedStaff.name || !selectedStaff.role) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (selectedStaff.role === "technician" && !selectedStaff.department) {
      toast({
        title: "Missing Department",
        description: "Please select a department for technician role",
        variant: "destructive",
      });
      return;
    }

    const success = await updateUser(selectedStaff.username, {
      name: selectedStaff.name,
      role: selectedStaff.role,
      department: selectedStaff.role === "technician" ? selectedStaff.department : undefined,
      status: selectedStaff.status,
      password: selectedStaff.password,
    });

    if (success) {
      toast({
        title: "Success",
        description: "Staff member updated successfully",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to update staff member",
        variant: "destructive",
      });
      return;
    }

    setEditDialogOpen(false);
    setSelectedStaff(null);
    loadStaffList();
  };

  const filteredStaff = staffList.filter((staff) => {
    const roleMatch = roleFilter === "all" || staff.role === roleFilter;
    const statusMatch = statusFilter === "all" || staff.status === statusFilter;
    return roleMatch && statusMatch;
  });

  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStaff = filteredStaff.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto p-6 max-w-7xl flex-grow">
        <div className="flex items-center justify-center mb-8">
          <img src={acTechLogo} alt="AC Tech Repair PH" className="h-16 mr-4" />
          <div>
            <h1 className="text-3xl font-bold">AC Tech Repair PH</h1>
            <p className="text-muted-foreground">Staff Management</p>
          </div>
        </div>

        <div className="mb-6">
          <Button onClick={() => navigate("/admin-portal")} variant="outline">
            Back to Admin Portal
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New Staff Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="staffId">Staff ID *</Label>
                  <Input
                    id="staffId"
                    value={newStaff.staffId}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, staffId: e.target.value })
                    }
                    placeholder="Enter Staff ID"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={newStaff.username}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, username: e.target.value })
                    }
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={newStaff.password}
                      onChange={(e) =>
                        setNewStaff({ ...newStaff, password: e.target.value })
                      }
                      placeholder="Enter password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={newStaff.name}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, name: e.target.value })
                    }
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={newStaff.role}
                    onValueChange={(value: "admin" | "technician" | "management") =>
                      setNewStaff({ ...newStaff, role: value, department: value !== "technician" ? "" : newStaff.department })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newStaff.role === "technician" && (
                  <div>
                    <Label htmlFor="department">Department *</Label>
                    <Select
                      value={newStaff.department}
                      onValueChange={(value) =>
                        setNewStaff({ ...newStaff, department: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newStaff.status}
                    onValueChange={(value: "active" | "inactive") =>
                      setNewStaff({ ...newStaff, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddStaff}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Add Staff
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Staff Members</CardTitle>
              <div className="flex gap-4 mt-4">
                <div className="flex-1">
                  <Label htmlFor="roleFilter">Filter by Role</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="statusFilter">Filter by Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredStaff.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No staff members found
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff ID</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedStaff.map((staff) => (
                        <TableRow key={staff.username}>
                          <TableCell className="font-medium">
                            {staff.staffId}
                          </TableCell>
                          <TableCell className="font-medium">
                            {staff.username}
                          </TableCell>
                          <TableCell>{staff.name}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                staff.role === "admin"
                                  ? "bg-purple-100 text-purple-800"
                                  : staff.role === "technician"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {staff.role}
                            </span>
                          </TableCell>
                          <TableCell>{staff.department || "-"}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                staff.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {staff.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditStaff(staff)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveStaff(staff.username)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {filteredStaff.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-
                    {Math.min(endIndex, filteredStaff.length)} of{" "}
                    {filteredStaff.length} staff members
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={currentPage === page ? "bg-blue-600 hover:bg-blue-700" : ""}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Edit Staff Member</DialogTitle>
              <DialogDescription>
                Update staff member information and password
              </DialogDescription>
            </DialogHeader>
            {selectedStaff && (
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="edit-staffId">Staff ID</Label>
                  <Input
                    id="edit-staffId"
                    value={selectedStaff.staffId}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-username">Username</Label>
                  <Input
                    id="edit-username"
                    value={selectedStaff.username}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-password">New Password (optional)</Label>
                  <div className="relative">
                    <Input
                      id="edit-password"
                      type={showEditPassword ? "text" : "password"}
                      value={selectedStaff.password}
                      onChange={(e) =>
                        setSelectedStaff({ ...selectedStaff, password: e.target.value })
                      }
                      placeholder="Enter new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                    >
                      {showEditPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={selectedStaff.name}
                    onChange={(e) =>
                      setSelectedStaff({ ...selectedStaff, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    value={selectedStaff.role}
                    onValueChange={(value: "admin" | "technician" | "management") =>
                      setSelectedStaff({ ...selectedStaff, role: value, department: value !== "technician" ? "" : selectedStaff.department })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="management">Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedStaff.role === "technician" && (
                  <div>
                    <Label htmlFor="edit-department">Department</Label>
                    <Select
                      value={selectedStaff.department || ""}
                      onValueChange={(value) =>
                        setSelectedStaff({ ...selectedStaff, department: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={selectedStaff.status}
                    onValueChange={(value: "active" | "inactive") =>
                      setSelectedStaff({ ...selectedStaff, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedStaff(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStaff}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Update Staff
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <footer className="text-center text-sm text-muted-foreground mt-8 pb-6">
        Powered by Stack&Scale
      </footer>
    </div>
  );
};

export default StaffManagement;
