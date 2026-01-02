import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { corsSafePost } from "@/lib/corsPostHandler";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";
import { useInvalidateClosedDates, ClosedDate } from "@/hooks/useClosedDates";

interface ClosedDateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: ClosedDate | null;
}

type ClosureType = "Emergency" | "Holiday" | "Operations" | "Others";

export function ClosedDateModal({ open, onOpenChange, editData }: ClosedDateModalProps) {
  const { toast } = useToast();
  const invalidateClosedDates = useInvalidateClosedDates();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [closureType, setClosureType] = useState<ClosureType>("Emergency");
  const [customType, setCustomType] = useState("");
  const [description, setDescription] = useState("");

  const isEditing = !!editData;

  // Reset form when modal opens/closes or editData changes
  useEffect(() => {
    if (open && editData) {
      // Populate form with edit data
      const start = parseDate(editData.startDate);
      const end = parseDate(editData.endDate);
      
      setStartDate(start);
      setEndDate(end);
      setDateMode(start?.getTime() === end?.getTime() ? "single" : "range");
      setClosureType(editData.type);
      setCustomType(editData.customType || "");
      setDescription(editData.description);
    } else if (open) {
      // Reset to defaults for new entry
      setDateMode("single");
      setStartDate(undefined);
      setEndDate(undefined);
      setClosureType("Emergency");
      setCustomType("");
      setDescription("");
    }
  }, [open, editData]);

  function parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;
    const parts = dateStr.split(/[-/]/);
    if (parts.length !== 3) return undefined;
    const [month, day, year] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  function formatDateForSheet(date: Date): string {
    return format(date, "MM/dd/yyyy");
  }

  async function handleSubmit() {
    // Validation
    if (!startDate) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }
    if (dateMode === "range" && !endDate) {
      toast({ title: "Please select an end date", variant: "destructive" });
      return;
    }
    if (closureType === "Others" && !customType.trim()) {
      toast({ title: "Please specify the closure type", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Please enter a description", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("action", isEditing ? "updateClosedDate" : "addClosedDate");
    
    if (isEditing && editData) {
      formData.append("rowIndex", String(editData.rowIndex));
      formData.append("id", editData.id);
    }

    formData.append("startDate", formatDateForSheet(startDate));
    formData.append("endDate", formatDateForSheet(dateMode === "range" && endDate ? endDate : startDate));
    formData.append("type", closureType);
    formData.append("customType", closureType === "Others" ? customType.trim() : "");
    formData.append("description", description.trim());
    formData.append("createdBy", sessionStorage.getItem("userFullName") || "Unknown");

    try {
      const result = await corsSafePost(formData);
      
      if (result.success) {
        toast({
          title: isEditing ? "Closed date updated" : "Closed date added",
          description: isEditing ? "The closure has been updated successfully." : "The closure has been added successfully.",
        });
        invalidateClosedDates();
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save closed date",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Closed Date" : "Set Closed Date"}</DialogTitle>
          <DialogDescription>
            Mark a day or date range when the shop will be closed. This will be visible to all staff members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Mode Selection */}
          <div className="space-y-3">
            <Label>Date Type</Label>
            <RadioGroup
              value={dateMode}
              onValueChange={(v) => setDateMode(v as "single" | "range")}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single" className="font-normal cursor-pointer">Single Day</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="range" id="range" />
                <Label htmlFor="range" className="font-normal cursor-pointer">Date Range</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date Pickers */}
          <div className={cn("grid gap-4", dateMode === "range" ? "grid-cols-2" : "grid-cols-1")}>
            <div className="space-y-2">
              <Label>{dateMode === "range" ? "Start Date" : "Date"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {dateMode === "range" && (
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => startDate ? date < startDate : false}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Closure Type */}
          <div className="space-y-2">
            <Label>Closure Type</Label>
            <Select value={closureType} onValueChange={(v) => setClosureType(v as ClosureType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Emergency">Emergency</SelectItem>
                <SelectItem value="Holiday">Holiday</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Type (shown when Others is selected) */}
          {closureType === "Others" && (
            <div className="space-y-2">
              <Label>Specify Type</Label>
              <Input
                placeholder="Enter custom closure type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Enter reason for closure..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
