import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useServiceBreakdowns,
  useSaveServiceBreakdowns,
  type BreakdownInput,
} from "@/hooks/useServiceBreakdowns";
import { useTechnicians } from "@/hooks/useStaff";

interface Props {
  serviceId: string;
  totalCost: number;
  defaultTechnicians: string[];
}

export const ServiceBreakdownPanel = ({ serviceId, totalCost, defaultTechnicians }: Props) => {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useServiceBreakdowns(serviceId);
  const { data: technicians = [] } = useTechnicians();
  const save = useSaveServiceBreakdowns();
  const [draft, setDraft] = useState<BreakdownInput[]>([]);

  useEffect(() => {
    if (rows.length > 0) {
      setDraft(rows.map((r) => ({
        serviceName: r.serviceName,
        technicianId: r.technicianId,
        technicianName: r.technicianName,
        cost: r.cost,
      })));
    } else if (defaultTechnicians.length > 0) {
      setDraft(defaultTechnicians.map((name) => {
        const t = technicians.find((tech) => tech.name === name);
        return { serviceName: "", technicianId: t?.userId ?? null, technicianName: name, cost: 0 };
      }));
    } else {
      setDraft([{ serviceName: "", technicianId: null, technicianName: "", cost: 0 }]);
    }
  }, [rows, defaultTechnicians.join("|"), technicians.length]);

  const sum = draft.reduce((s, r) => s + (Number(r.cost) || 0), 0);

  const update = (i: number, patch: Partial<BreakdownInput>) =>
    setDraft((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="bg-muted/30 p-4 rounded-md border space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold">Total Service Cost:</span> ₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="ml-3 text-muted-foreground">Allocated: ₱{sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDraft((p) => [...p, { serviceName: "", technicianId: null, technicianName: "", cost: 0 }])}>
          <Plus className="h-4 w-4 mr-1" /> Add Line
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {draft.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-5"
                placeholder="Service performed"
                value={r.serviceName}
                onChange={(e) => update(i, { serviceName: e.target.value })}
              />
              <Select
                value={r.technicianId ?? ""}
                onValueChange={(val) => {
                  const t = technicians.find((tech) => tech.userId === val);
                  update(i, { technicianId: val, technicianName: t?.name ?? "" });
                }}
              >
                <SelectTrigger className="col-span-4">
                  <SelectValue placeholder={r.technicianName || "Technician"} />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.userId} value={t.userId ?? t.staffId}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="col-span-2 text-right"
                type="number"
                min="0"
                step="100"
                value={r.cost}
                onChange={(e) => update(i, { cost: parseFloat(e.target.value) || 0 })}
              />
              <Button
                size="icon"
                variant="ghost"
                className="col-span-1"
                onClick={() => setDraft((p) => p.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={async () => {
            try {
              await save.mutateAsync({
                serviceId,
                rows: draft.filter((r) => r.serviceName || r.technicianName || r.cost),
              });
              toast({ title: "Breakdown saved" });
            } catch (e: any) {
              toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
            }
          }}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Breakdown"}
        </Button>
      </div>
    </div>
  );
};
