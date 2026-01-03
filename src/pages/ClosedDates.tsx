import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarOff, Search, Filter, Edit, Trash2, Plus, CalendarIcon, Loader2, RefreshCw } from "lucide-react";
import { displayDate } from "@/lib/timezone";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useClosedDates, useInvalidateClosedDates, ClosedDate } from "@/hooks/useClosedDates";
import { ClosedDateModal } from "@/components/ClosedDateModal";
import { useToast } from "@/hooks/use-toast";
import { corsSafePost } from "@/lib/corsPostHandler";

const ClosedDates = () => {
  const { toast } = useToast();
  const { data: closedDates = [], isLoading, refetch, isFetching } = useClosedDates();
  const invalidateClosedDates = useInvalidateClosedDates();
  const userRole = sessionStorage.getItem("userRole");
  const isManagement = userRole === "management";
  const [isReloading, setIsReloading] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRangeStart, setDateRangeStart] = useState<Date | undefined>();
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>();

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<ClosedDate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClosedDate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Parse date from MM/DD/YYYY format
  function parseSheetDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split(/[-/]/);
    if (parts.length !== 3) return null;
    const [month, day, year] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Filtered data
  const filteredDates = useMemo(() => {
    return closedDates.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          item.id?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.createdBy?.toLowerCase().includes(query) ||
          item.customType?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }

      // Date range filter
      if (dateRangeStart || dateRangeEnd) {
        const itemStart = parseSheetDate(item.startDate);
        const itemEnd = parseSheetDate(item.endDate);
        
        if (!itemStart) return false;

        if (dateRangeStart && dateRangeEnd) {
          // Check if item's date range overlaps with filter range
          const filterStart = dateRangeStart;
          const filterEnd = dateRangeEnd;
          const itemEndDate = itemEnd || itemStart;
          
          const overlaps = itemStart <= filterEnd && itemEndDate >= filterStart;
          if (!overlaps) return false;
        } else if (dateRangeStart) {
          if (itemStart < dateRangeStart) return false;
        } else if (dateRangeEnd) {
          const itemEndDate = itemEnd || itemStart;
          if (itemEndDate > dateRangeEnd) return false;
        }
      }

      return true;
    });
  }, [closedDates, searchQuery, typeFilter, dateRangeStart, dateRangeEnd]);

  // Handle edit
  function handleEdit(item: ClosedDate) {
    setEditData(item);
    setModalOpen(true);
  }

  // Handle delete confirmation
  function handleDeleteClick(item: ClosedDate) {
    setDeleteTarget(item);
    setDeleteConfirmOpen(true);
  }

  // Handle actual delete
  async function handleDelete() {
    if (!deleteTarget) return;
    
    setIsDeleting(true);

    const formData = new FormData();
    formData.append("action", "deleteClosedDate");
    formData.append("rowIndex", String(deleteTarget.rowIndex));

    try {
      await corsSafePost(formData);
      
      // Treat as success - CORS issues often prevent reading the response
      toast({
        title: "Closed date deleted",
        description: "The closure has been removed successfully.",
      });
      await invalidateClosedDates();
    } catch (error) {
      console.error("Error deleting closed date:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  }

  // Handle add new
  function handleAddNew() {
    setEditData(null);
    setModalOpen(true);
  }

  // Handle manual reload
  async function handleReload() {
    setIsReloading(true);
    await refetch();
    setIsReloading(false);
    toast({
      title: "Data refreshed",
      description: "Closed dates have been reloaded.",
    });
  }

  // Clear filters
  function clearFilters() {
    setSearchQuery("");
    setTypeFilter("all");
    setDateRangeStart(undefined);
    setDateRangeEnd(undefined);
  }

  // Format display date
  function formatDisplayDate(startDate: string, endDate: string): string {
    const start = parseSheetDate(startDate);
    const end = parseSheetDate(endDate);
    
    if (!start) return "-";
    
    if (!end || start.getTime() === end.getTime()) {
      return format(start, "MMM d, yyyy");
    }
    
    return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
  }

  // Get badge variant based on type
  function getTypeBadgeVariant(type: string): "default" | "destructive" | "secondary" | "outline" {
    switch (type) {
      case "Emergency":
        return "destructive";
      case "Holiday":
        return "default";
      case "Operations":
        return "secondary";
      default:
        return "outline";
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <CalendarOff className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Closed Dates</h1>
              <p className="text-sm text-muted-foreground">
                {isManagement ? "Manage shop closure dates" : "View shop closure dates"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReload} disabled={isReloading || isFetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", (isReloading || isFetching) && "animate-spin")} />
              Reload
            </Button>
            {isManagement && (
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Add Closed Date
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ID, description, created by..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Holiday">Holiday</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range Start */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRangeStart && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeStart ? format(dateRangeStart, "PPP") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRangeStart}
                    onSelect={setDateRangeStart}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {/* Date Range End */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRangeEnd && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeEnd ? format(dateRangeEnd, "PPP") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRangeEnd}
                    onSelect={setDateRangeEnd}
                    disabled={(date) => dateRangeStart ? date < dateRangeStart : false}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Clear Filters */}
            {(searchQuery || typeFilter !== "all" || dateRangeStart || dateRangeEnd) && (
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredDates.length === 0 ? (
              <div className="text-center py-12">
                <CalendarOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">No closed dates found</h3>
                <p className="text-sm text-muted-foreground">
                  {closedDates.length === 0
                    ? "No closures have been scheduled yet."
                    : "No closures match your current filters."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Date(s)</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created At</TableHead>
                      {isManagement && <TableHead className="w-24">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDates.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDisplayDate(item.startDate, item.endDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(item.type)}>
                            {item.type === "Others" && item.customType
                              ? item.customType
                              : item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate" title={item.description}>
                          {item.description}
                        </TableCell>
                        <TableCell>{item.createdBy}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.createdAt ? displayDate(item.createdAt, "MMM d, yyyy") : "-"}
                        </TableCell>
                        {isManagement && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(item)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(item)}
                                title="Delete"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Modal */}
        <ClosedDateModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          editData={editData}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Closed Date</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this closure ({deleteTarget?.id})? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default ClosedDates;
