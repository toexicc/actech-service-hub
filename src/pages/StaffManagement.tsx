import { useState, useEffect, useMemo } from "react";
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
import { Loader2, UserPlus, Trash2, Edit, Eye, EyeOff, RefreshCw } from "lucide-react";
import {
  addUser,
  updateUser,
  removeUser,
  UserCredential,
} from "@/lib/userCredentials";
import { DEPARTMENTS } from "@/lib/constants";
import DashboardLayout from "@/components/DashboardLayout";
import { useStaff, useInvalidateStaff } from "@/hooks/useStaff";
import { logStaffActivity } from "@/lib/activityLogger";

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

  // Use React Query for staff data
  const { data: staffData = [] } = useStaff();
  const invalidateStaff = useInvalidateStaff();
  
  // Transform staff data to match UserCredential interface
  const staffList = useMemo(() => {
    return staffData.map((staff) => ({
      staffId: staff.staffId,
      username: staff.username,
      password: staff.password,
      name: staff.name,
      role: staff.role?.toLowerCase() as "admin" | "technician" | "management",
      department: staff.department,
      status: staff.status?.toLowerCase() as "active" | "inactive",
      salary: staff.salary || "",
    }));
  }, [staffData]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<UserCredential | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false);
  const [isDeletingStaff, setIsDeletingStaff] = useState<string | null>(null);
  const itemsPerPage = 10;

  const [newStaff, setNewStaff] = useState({
    username: "",
    password: "",
    name: "",
    role: "" as "admin" | "technician" | "management",
    department: "",
    status: "active" as "active" | "inactive",
    salaryType: "service-based" as "fixed" | "service-based",
    salary: "",
  });

  const generateStaffId = () => {
    const timestamp = Date.now();
    return `ACTS${timestamp}`;
  };

  const loadStaffList = () => {
    invalidateStaff();
  };

  const handleAddStaff = async () => {
    if (isAddingStaff) return; // Prevent double-click
    
    if (!newStaff.username || !newStaff.password || !newStaff.name || !newStaff.role) {
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

    // Generate Staff ID when adding
    const staffId = generateStaffId();

    // Check if Staff ID already exists (very unlikely with timestamp but check anyway)
    const existingStaffId = staffList.find((s) => s.staffId === staffId);
    if (existingStaffId) {
      toast({
        title: "Error",
        description: "Generated Staff ID already exists. Please try again.",
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

    setIsAddingStaff(true);
    
    try {
      const success = await addUser({
        staffId: staffId,
        username: newStaff.username,
        password: newStaff.password,
        name: newStaff.name,
        role: newStaff.role,
        department: newStaff.role === "technician" ? newStaff.department : undefined,
        status: newStaff.status,
        salary: newStaff.salaryType === "fixed" ? newStaff.salary : "",
      });

      if (success) {
        logStaffActivity("Added new staff member", `${newStaff.name} (${newStaff.role})`);
        
        toast({
          title: "Success",
          description: "Staff member added successfully",
        });
        
        setNewStaff({
          username: "",
          password: "",
          name: "",
          role: "" as "admin" | "technician" | "management",
          department: "",
          status: "active",
          salaryType: "",
          salary: "",
        });
        
        loadStaffList();
      } else {
        toast({
          title: "Error",
          description: "Failed to add staff member",
          variant: "destructive",
        });
      }
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleRemoveStaff = async (username: string, staffName: string) => {
    if (isDeletingStaff) return; // Prevent double-click
    
    if (!confirm("Are you sure you want to remove this staff member?")) {
      return;
    }

    setIsDeletingStaff(username);
    try {
      const success = await removeUser(username);

      if (success) {
        logStaffActivity("Removed staff member", staffName);
        
        toast({
          title: "Success",
          description: "Staff member removed successfully",
        });
        loadStaffList();
      } else {
        toast({
          title: "Error",
          description: "Failed to remove staff member",
          variant: "destructive",
        });
      }
    } finally {
      setIsDeletingStaff(null);
    }
  };

  const handleEditStaff = (staff: UserCredential) => {
    setSelectedStaff({ ...staff });
    setEditDialogOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!selectedStaff || isUpdatingStaff) return;

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

    setIsUpdatingStaff(true);
    try {
      const success = await updateUser(selectedStaff.username, {
        name: selectedStaff.name,
        role: selectedStaff.role,
        department: selectedStaff.role === "technician" ? selectedStaff.department : undefined,
        status: selectedStaff.status,
        password: selectedStaff.password,
        salary: (selectedStaff as any).salary || "",
      });

      if (success) {
        logStaffActivity("Updated staff member", `${selectedStaff.name} (${selectedStaff.role})`);
        
        toast({
          title: "Success",
          description: "Staff member updated successfully",
        });
        setEditDialogOpen(false);
        setSelectedStaff(null);
        loadStaffList();
      } else {
        toast({
          title: "Error",
          description: "Failed to update staff member",
          variant: "destructive",
        });
      }
    } finally {
      setIsUpdatingStaff(false);
    }
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
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Staff Management</h1>
          <p className="text-muted-foreground">Manage staff and roles</p>
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
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <Label htmlFor="salaryType">Salary Type</Label>
                  <Select
                    value={newStaff.salaryType}
                    onValueChange={(value: "" | "fixed" | "service-based") =>
                      setNewStaff({ ...newStaff, salaryType: value, salary: value === "service-based" ? "" : newStaff.salary })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select salary type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service-based">Service Based</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newStaff.salaryType === "fixed" && (
                  <div>
                    <Label htmlFor="salary">Salary Amount</Label>
                    <Input
                      id="salary"
                      type="number"
                      step="0.01"
                      value={newStaff.salary}
                      onChange={(e) => setNewStaff({ ...newStaff, salary: e.target.value })}
                      placeholder="Enter salary amount"
                    />
                  </div>
                )}
                <div className="flex items-end">
                  <Button
                    onClick={handleAddStaff}
                    disabled={isAddingStaff}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isAddingStaff ? (
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
                {/* Reload Button */}
                <div className="flex items-end">
                  <Button variant="outline" size="icon" onClick={() => invalidateStaff()} title="Reload table">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
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
                        <TableHead>Salary</TableHead>
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
                              {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>{staff.department || "-"}</TableCell>
                          <TableCell>{(staff as any).salary ? `Php ${parseFloat((staff as any).salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "Service Based"}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                staff.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {staff.status.charAt(0).toUpperCase() + staff.status.slice(1)}
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
                                onClick={() => handleRemoveStaff(staff.username, staff.name)}
                                disabled={isDeletingStaff === staff.username}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {isDeletingStaff === staff.username ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
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
                <div>
                  <Label htmlFor="edit-salaryType">Salary Type</Label>
                  <Select
                    value={(selectedStaff as any).salary ? "fixed" : "service-based"}
                    onValueChange={(value) =>
                      setSelectedStaff({ ...selectedStaff, salary: value === "fixed" ? ((selectedStaff as any).salary || "") : "" } as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service-based">Service Based</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(selectedStaff as any).salary !== undefined && (selectedStaff as any).salary !== "" && (
                  <div>
                    <Label htmlFor="edit-salary">Salary Amount</Label>
                    <Input
                      id="edit-salary"
                      type="number"
                      step="0.01"
                      value={(selectedStaff as any).salary || ""}
                      onChange={(e) => setSelectedStaff({ ...selectedStaff, salary: e.target.value } as any)}
                      placeholder="Enter salary amount"
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedStaff(null);
                }}
                disabled={isUpdatingStaff}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStaff}
                disabled={isUpdatingStaff}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUpdatingStaff ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Staff"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="text-center mt-8 text-sm text-muted-foreground">
          Powered by Stack&Scale
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffManagement;
