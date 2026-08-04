import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLogger";
import { DEVICE_TYPES, PRIORITY_OPTIONS, TIME_FRAME_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const CLIENT_TYPE_OPTIONS = [
  "New Client - Walk In",
  "New Client - Pickup",
  "Returning Client - Walk In",
  "Returning Client - Pickup",
];

const CONDITION_FIELDS: { key: string; label: string }[] = [
  { key: "dents", label: "Dents" },
  { key: "scratches", label: "Scratches" },
  { key: "missingParts", label: "Missing Parts" },
  { key: "physicalDamage", label: "Physical Damage" },
  { key: "importantFiles", label: "Important Files" },
  { key: "noPower", label: "No Power" },
  { key: "repairHistory", label: "Repair History" },
];

const isYes = (value: any) => {
  if (value === true || value === 1) return true;
  const v = typeof value === "string" ? value.trim().toLowerCase() : value;
  return v === "yes" || v === "true" || v === "y" || v === "✓" || v === "checked";
};

const parseDateInput = (value: any): Date | undefined => {
  if (!value) return undefined;
  const raw = String(value).trim();
  const mmdd = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let d: Date | undefined;
  if (mmdd) d = new Date(Number(mmdd[3]), Number(mmdd[1]) - 1, Number(mmdd[2]));
  else if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (!d || isNaN(d.getTime())) return undefined;
  return d;
};

const MAX_TEXT = 300;
const MAX_LONG_TEXT = 2000;

interface Props {
  serviceData: any;
  onSaved: () => void;
  onCancel: () => void;
}

export const ServiceDetailsEditor = ({ serviceData, onSaved, onCancel }: Props) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const initial = useMemo(() => {
    const conditions = serviceData?.conditions || {};
    return {
      clientName: serviceData?.clientName || "",
      username: serviceData?.username || "",
      contactNumber: serviceData?.contactNumber || serviceData?.phone || "",
      email: serviceData?.email || "",
      address: serviceData?.address || "",
      deviceType: serviceData?.deviceType || "",
      brand: serviceData?.brand || "",
      model: serviceData?.device || serviceData?.model || "",
      serialNumber: serviceData?.serialNumber || "",
      memory: serviceData?.memory || "",
      color: serviceData?.color || "",
      devicePassword: serviceData?.devicePassword || "",
      clientType: serviceData?.clientType || "",
      priority: serviceData?.priority || "",
      service: serviceData?.service || "",
      timeFrame: serviceData?.timeFrame || serviceData?.estimatedCompletion || "",
      targetDate: parseDateInput(serviceData?.targetDate),
      deviceNotes: serviceData?.deviceNotes || "",
      conditions: CONDITION_FIELDS.reduce<Record<string, boolean>>((acc, f) => {
        acc[f.key] = isYes(conditions[f.key] ?? serviceData?.[f.key]);
        return acc;
      }, {}),
    };
  }, [serviceData]);

  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const set = (key: string, value: any) => setDraft(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (isSaving) return;

    const clientName = draft.clientName.trim();
    if (!clientName) {
      toast({ title: "Client name required", description: "Please enter the client name.", variant: "destructive" });
      return;
    }
    const email = draft.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    const trim = (v: string, max = MAX_TEXT) => v.trim().slice(0, max);

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        client_name: trim(clientName),
        username: trim(draft.username) || null,
        contact_number: trim(draft.contactNumber) || null,
        email: email || null,
        address: trim(draft.address, MAX_LONG_TEXT) || null,
        device_type: trim(draft.deviceType),
        brand: trim(draft.brand) || null,
        model: trim(draft.model) || null,
        serial_number: trim(draft.serialNumber) || null,
        memory: trim(draft.memory) || null,
        color: trim(draft.color) || null,
        device_password: trim(draft.devicePassword) || null,
        client_type: trim(draft.clientType) || null,
        priority: trim(draft.priority) || null,
        service: trim(draft.service, MAX_LONG_TEXT) || null,
        estimated_completion: trim(draft.timeFrame) || null,
        target_date: draft.targetDate ? format(draft.targetDate, "yyyy-MM-dd") : null,
        device_notes: trim(draft.deviceNotes, MAX_LONG_TEXT) || null,
        conditions: draft.conditions,
        last_updated: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("services")
        .update(payload as any)
        .eq("service_id", serviceData.serviceId);

      if (error) throw new Error(error.message);

      const changed: string[] = [];
      const compare: [string, any, any][] = [
        ["Client name", initial.clientName, clientName],
        ["Facebook/Instagram name", initial.username, draft.username],
        ["Contact number", initial.contactNumber, draft.contactNumber],
        ["Email", initial.email, email],
        ["Address", initial.address, draft.address],
        ["Device type", initial.deviceType, draft.deviceType],
        ["Brand", initial.brand, draft.brand],
        ["Model", initial.model, draft.model],
        ["Serial number", initial.serialNumber, draft.serialNumber],
        ["Storage", initial.memory, draft.memory],
        ["Color", initial.color, draft.color],
        ["Device password", initial.devicePassword ? "•••" : "", draft.devicePassword ? "•••" : ""],
        ["Client type", initial.clientType, draft.clientType],
        ["Priority", initial.priority, draft.priority],
        ["Service/s", initial.service, draft.service],
        ["Time frame", initial.timeFrame, draft.timeFrame],
        [
          "Target date",
          initial.targetDate ? format(initial.targetDate, "MM/dd/yyyy") : "",
          draft.targetDate ? format(draft.targetDate, "MM/dd/yyyy") : "",
        ],
        ["Device notes", initial.deviceNotes, draft.deviceNotes],
      ];
      compare.forEach(([label, before, after]) => {
        if (String(before || "").trim() !== String(after || "").trim()) changed.push(label);
      });
      const conditionsChanged = CONDITION_FIELDS.some(f => !!initial.conditions[f.key] !== !!draft.conditions[f.key]);
      if (conditionsChanged) changed.push("Device conditions");

      if (changed.length > 0) {
        await logActivity({
          serviceId: serviceData.serviceId,
          username: sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Admin",
          role: sessionStorage.getItem("userRole") || "admin",
          activity: `Service details updated: ${changed.join(", ")}`,
        });
      }

      toast({ title: "Details saved", description: "Service details updated successfully." });
      onSaved();
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Could not save service details.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deviceTypeOptions = useMemo(() => {
    const list = [...(DEVICE_TYPES as readonly string[])];
    if (draft.deviceType && !list.includes(draft.deviceType)) list.unshift(draft.deviceType);
    return list;
  }, [draft.deviceType]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Client Name</Label>
          <Input value={draft.clientName} maxLength={MAX_TEXT} onChange={e => set("clientName", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Facebook Name/Instagram Username</Label>
          <Input value={draft.username} maxLength={MAX_TEXT} onChange={e => set("username", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Contact Number</Label>
          <Input value={draft.contactNumber} maxLength={50} onChange={e => set("contactNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={draft.email} maxLength={255} onChange={e => set("email", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Address</Label>
          <Input value={draft.address} maxLength={MAX_LONG_TEXT} onChange={e => set("address", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Client Type</Label>
          <Select value={draft.clientType} onValueChange={v => set("clientType", v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {CLIENT_TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={draft.priority} onValueChange={v => set("priority", v)}>
            <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Device Type</Label>
          <Select value={draft.deviceType} onValueChange={v => set("deviceType", v)}>
            <SelectTrigger><SelectValue placeholder="Select device type" /></SelectTrigger>
            <SelectContent>
              {deviceTypeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Brand</Label>
          <Input value={draft.brand} maxLength={MAX_TEXT} onChange={e => set("brand", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Device Model</Label>
          <Input value={draft.model} maxLength={MAX_TEXT} onChange={e => set("model", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Serial Number</Label>
          <Input value={draft.serialNumber} maxLength={MAX_TEXT} onChange={e => set("serialNumber", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Storage</Label>
          <Input value={draft.memory} maxLength={MAX_TEXT} onChange={e => set("memory", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Input value={draft.color} maxLength={MAX_TEXT} onChange={e => set("color", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Device Password</Label>
          <Input value={draft.devicePassword} maxLength={MAX_TEXT} onChange={e => set("devicePassword", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Estimated Time Frame</Label>
          <Select value={draft.timeFrame} onValueChange={v => set("timeFrame", v)}>
            <SelectTrigger><SelectValue placeholder="Select time frame" /></SelectTrigger>
            <SelectContent>
              {TIME_FRAME_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estimated Target Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !draft.targetDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {draft.targetDate ? format(draft.targetDate, "MM/dd/yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={draft.targetDate}
                onSelect={d => set("targetDate", d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Service/s</Label>
          <Textarea value={draft.service} maxLength={MAX_LONG_TEXT} rows={3} onChange={e => set("service", e.target.value)} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Device Conditions</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CONDITION_FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!draft.conditions[f.key]}
                  onCheckedChange={checked =>
                    set("conditions", { ...draft.conditions, [f.key]: checked === true })
                  }
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Device Notes</Label>
          <Textarea value={draft.deviceNotes} maxLength={MAX_LONG_TEXT} rows={3} onChange={e => set("deviceNotes", e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save details
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
      </div>
    </div>
  );
};
