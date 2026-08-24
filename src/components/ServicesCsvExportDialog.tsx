import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Exportable columns of the services table, in a sensible reading order. */
const EXPORT_COLUMNS: { key: string; label: string }[] = [
  { key: "service_id", label: "Service ID" },
  { key: "service_date", label: "Service Date" },
  { key: "date_received", label: "Date Received" },
  { key: "date_completed", label: "Date Completed" },
  { key: "target_date", label: "Target Date" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "client_id", label: "Client ID" },
  { key: "client_name", label: "Client Name" },
  { key: "client_type", label: "Client Type" },
  { key: "contact_number", label: "Contact Number" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "device_type", label: "Device Type" },
  { key: "brand", label: "Brand" },
  { key: "model", label: "Model" },
  { key: "color", label: "Color" },
  { key: "memory", label: "Storage" },
  { key: "serial_number", label: "Serial Number" },
  { key: "chief_complaint", label: "Chief Complaint" },
  { key: "issue_description", label: "Issue Description" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "technician_diagnosis", label: "Technician Diagnosis" },
  { key: "technician_report", label: "Technician Report" },
  { key: "service", label: "Service/s" },
  { key: "approved_services", label: "Approved Services" },
  { key: "pending_services", label: "Pending Services" },
  { key: "technicians", label: "Technicians" },
  { key: "technician_departments", label: "Technician Departments" },
  { key: "admin_reps", label: "Admin Reps" },
  { key: "receiving_staff", label: "Receiving Staff" },
  { key: "parts_used", label: "Parts Used" },
  { key: "parts_cost", label: "Parts Cost" },
  { key: "labor_cost", label: "Labor Cost" },
  { key: "service_cost", label: "Service Cost" },
  { key: "discount", label: "Discount" },
  { key: "vat_requested", label: "VAT Requested" },
  { key: "rush_fee", label: "Rush Fee" },
  { key: "final_cost", label: "Final Cost" },
  { key: "total_cost", label: "Total Cost" },
  { key: "initial_payment", label: "Initial Payment" },
  { key: "payment_status", label: "Payment Status" },
  { key: "mode_of_transfer", label: "Mode of Transfer" },
  { key: "waiting_for_parts", label: "Waiting for Parts" },
  { key: "waiting_parts_note", label: "Waiting for Parts Note" },
  { key: "is_backjob", label: "Backjob" },
  { key: "rto_reason", label: "RTO Reason" },
  { key: "repair_time_frame", label: "Repair Time Frame" },
  { key: "remarks", label: "Remarks" },
  { key: "internal_admin_notes", label: "Internal Admin Notes" },
  { key: "internal_technician_notes", label: "Internal Technician Notes" },
  { key: "source", label: "Source" },
  { key: "last_updated", label: "Last Updated" },
];

const DEFAULT_KEYS = [
  "service_id",
  "service_date",
  "status",
  "client_name",
  "contact_number",
  "device_type",
  "brand",
  "model",
  "service",
  "technicians",
  "service_cost",
  "discount",
  "final_cost",
  "payment_status",
];

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  let text: string;
  if (Array.isArray(value)) text = value.join(" | ");
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  text = text.replace(/\r?\n/g, " ");
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServicesCsvExportDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selected, setSelected] = useState<string[]>(DEFAULT_KEYS);
  const [exporting, setExporting] = useState(false);

  const allSelected = selected.length === EXPORT_COLUMNS.length;
  const columns = useMemo(
    () => EXPORT_COLUMNS.filter((c) => selected.includes(c.key)),
    [selected],
  );

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleExport = async () => {
    if (!columns.length) {
      toast({ title: "Pick at least one column", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const pageSize = 1000;
      const rows: any[] = [];
      for (let from = 0; ; from += pageSize) {
        let query = supabase
          .from("services")
          .select(columns.map((c) => c.key).join(","))
          .order("service_date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (startDate) query = query.gte("service_date", format(startDate, "yyyy-MM-dd"));
        if (endDate) query = query.lte("service_date", format(endDate, "yyyy-MM-dd"));
        const { data, error } = await query;
        if (error) throw error;
        const batch = (data ?? []) as any[];
        rows.push(...batch);
        if (batch.length < pageSize) break;
      }

      if (!rows.length) {
        toast({ title: "No tickets in that date range", variant: "destructive" });
        return;
      }

      const csv = [
        columns.map((c) => csvCell(c.label)).join(","),
        ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(",")),
      ].join("\n");

      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const range =
        startDate || endDate
          ? `_${startDate ? format(startDate, "yyyy-MM-dd") : "start"}_to_${endDate ? format(endDate, "yyyy-MM-dd") : "today"}`
          : "";
      a.href = url;
      a.download = `services${range}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Export ready", description: `${rows.length} ticket(s) exported.` });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const DatePickerField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value?: Date;
    onChange: (d?: Date) => void;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "MM/dd/yyyy") : "Any"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl !flex !flex-col max-h-[95dvh] p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 p-6 pb-4">
          <DialogTitle>Export services to CSV</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePickerField label="Service date from" value={startDate} onChange={setStartDate} />
            <DatePickerField label="Service date to" value={endDate} onChange={setEndDate} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Columns ({selected.length}/{EXPORT_COLUMNS.length})</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(allSelected ? [] : EXPORT_COLUMNS.map((c) => c.key))}
              >
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </div>
            <div className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.includes(c.key)} onCheckedChange={() => toggle(c.key)} />
                  <span className="truncate">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 p-6 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ServicesCsvExportDialog;
