import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useServiceBreakdowns,
  useSaveServiceBreakdowns,
  useSaveServicePartsCost,
  type BreakdownInput,
} from "@/hooks/useServiceBreakdowns";
import { useTechnicians } from "@/hooks/useStaff";

interface Props {
  serviceId: string;
  totalCost: number;
  defaultTechnicians: string[];
  /** Actual parts cost saved on the ticket. */
  partsCost?: number;
  /** Commission rate (% of profit) currently selected in the filters. */
  commissionRate?: number;
}

const peso = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ServiceBreakdownPanel = ({
  serviceId,
  totalCost,
  defaultTechnicians,
  partsCost = 0,
  commissionRate = 0,
}: Props) => {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useServiceBreakdowns(serviceId);
  const { data: technicians = [] } = useTechnicians();
  const save = useSaveServiceBreakdowns();
  const savePartsCost = useSaveServicePartsCost();
  const [draft, setDraft] = useState<BreakdownInput[]>([]);
  const [partsDraft, setPartsDraft] = useState<string>(partsCost ? String(partsCost) : "");

  useEffect(() => {
    setPartsDraft(partsCost ? String(partsCost) : "");
  }, [partsCost, serviceId]);

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
  const partsValue = parseFloat(partsDraft.replace(/[^0-9.]/g, "")) || 0;
  const grossProfit = totalCost - partsValue;
  const pool = Math.max(0, (grossProfit * (commissionRate || 0)) / 100);
  const overAllocated = sum > pool + 0.005;
  const partsDirty = partsValue !== (Number(partsCost) || 0);

  // Dirty check against the persisted rows so Save only activates on real changes.
  const serialize = (list: { serviceName: string; technicianName: string; cost: number }[]) =>
    JSON.stringify(
      list
        .filter((r) => r.serviceName || r.technicianName || Number(r.cost))
        .map((r) => [r.serviceName?.trim() ?? "", r.technicianName?.trim() ?? "", Number(r.cost) || 0]),
    );
  const isDirty = serialize(draft as any) !== serialize(rows as any);

  const update = (i: number, patch: Partial<BreakdownInput>) =>
    setDraft((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));


  return (
    <div className="bg-muted/30 p-4 rounded-md border space-y-3">
      {/* Parts cost + payout math */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Parts Cost (actual)</Label>
          <div className="relative w-40">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₱</span>
            <Input
              className="pl-5 text-right"
              inputMode="decimal"
              placeholder="0.00"
              value={partsDraft}
              onChange={(e) => setPartsDraft(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!partsDirty || savePartsCost.isPending}
          onClick={async () => {
            try {
              await savePartsCost.mutateAsync({ serviceId, partsCost: partsValue });
              toast({ title: "Parts cost saved" });
            } catch (e: any) {
              toast({ title: "Failed to save parts cost", description: e?.message, variant: "destructive" });
            }
          }}
        >
          {savePartsCost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Parts Cost"}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 text-sm rounded-md border bg-background/60 p-3">
        <div>
          <p className="text-xs text-muted-foreground">Total Service Cost</p>
          <p className="font-semibold">{peso(totalCost)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Less Parts Cost</p>
          <p className="font-semibold">- {peso(partsValue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Gross Profit</p>
          <p className={cn("font-semibold", grossProfit < 0 && "text-destructive")}>{peso(grossProfit)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Commission Pool ({commissionRate || 0}%)</p>
          <p className="font-semibold text-orange-600">{peso(pool)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Allocated:</span>{" "}
          <span className={cn("font-semibold", overAllocated && "text-destructive")}>{peso(sum)}</span>
          <span className="text-muted-foreground"> of {peso(pool)} pool</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDraft((p) => [...p, { serviceName: "", technicianId: null, technicianName: "", cost: 0 }])}>
          <Plus className="h-4 w-4 mr-1" /> Add Line
        </Button>
      </div>

      {overAllocated && (
        <p className="text-xs text-destructive">
          Allocations exceed the commission pool by {peso(sum - pool)}.
        </p>
      )}


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
              <div className="col-span-2 relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₱</span>
                <Input
                  className="pl-5 text-right"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={r.cost ? String(r.cost) : ""}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                    update(i, { cost: parseFloat(cleaned) || 0 });
                  }}
                />
              </div>

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
          disabled={save.isPending || !isDirty}
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
