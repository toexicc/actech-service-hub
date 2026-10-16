import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Unlock } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  /** Cut-off already paid out — allocations are frozen. */
  locked?: boolean;
  lockNote?: string;
  /** Management may unlock a paid-out ticket after confirming. */
  canUnlock?: boolean;
}

const peso = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ServiceBreakdownPanel = ({
  serviceId,
  totalCost,
  defaultTechnicians,
  partsCost = 0,
  commissionRate = 0,
  locked = false,
  lockNote,
  canUnlock = false,
}: Props) => {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useServiceBreakdowns(serviceId);
  const { data: technicians = [] } = useTechnicians();
  const save = useSaveServiceBreakdowns();
  const qc = useQueryClient();
  const logCorrection = async (what: string, before: unknown, after: unknown) => {
    if (!unlocked) return;
    qc.invalidateQueries({ queryKey: ["disbursedPeriods"] });
    const { data: u } = await supabase.auth.getUser();
    const { data: name } = await supabase.rpc("get_my_name");
    await supabase.from("activity_logs").insert({
      actor_id: u.user?.id ?? null,
      actor_name: (name as string) || null,
      action: `Edited paid-out ${what} (unlocked correction)`,
      entity_type: "service",
      entity_id: serviceId,
      changes: { before, after, note: lockNote ?? null } as any,
    });
  };
  const savePartsCost = useSaveServicePartsCost();
  const [unlocked, setUnlocked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isLocked = locked && !unlocked;
  useEffect(() => setUnlocked(false), [serviceId]);
  const [draft, setDraft] = useState<BreakdownInput[]>([]);
  const [partsDraft, setPartsDraft] = useState<string>(partsCost ? String(partsCost) : "");

  useEffect(() => {
    setPartsDraft(partsCost ? String(partsCost) : "");
  }, [partsCost, serviceId]);

  useEffect(() => {
    // Never seed from an empty result while the query is still in flight — the
    // saved lines would look deleted until the data lands.
    if (isLoading) return;
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
  }, [isLoading, rows, defaultTechnicians.join("|"), technicians.length]);

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
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 sm:p-4">
      {locked && !unlocked && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-semibold">Paid out — locked.</span>{" "}
            {lockNote || "This cut-off has already been disbursed."}
          </div>
          {canUnlock && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setConfirmOpen(true)}>
              <Unlock className="mr-1 h-3.5 w-3.5" /> Unlock to edit
            </Button>
          )}
        </div>
      )}
      {locked && unlocked && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Unlocked for correction.</span> Changes stay in the same cut-off — re-disburse it on Salary Disbursement after saving.
        </div>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock a paid-out ticket?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>{lockNote || "This ticket is already on a disbursed payslip."}</p>
                <p><b>Why it's locked:</b> that payout already went out. Editing here changes what that cut-off should have paid.</p>
                <p><b>Typical case:</b> a shared service where the second technician still needs their share.</p>
                <p><b>After you save:</b> the correction stays in the same cut-off. Salary Disbursement will flag the affected staff as "Needs re-disburse" — re-disbursing updates the existing salary transaction, it is never posted twice.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setUnlocked(true)}>I understand, unlock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Parts cost + payout math */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        <div className="space-y-1 sm:w-auto">
          <Label className="text-xs">Parts Cost (actual)</Label>
          <div className="relative w-full sm:w-40">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₱</span>
            <Input
              className="pl-5 text-right"
              inputMode="decimal"
              placeholder="0.00"
              value={partsDraft}
              disabled={isLocked}
              onChange={(e) => setPartsDraft(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={isLocked || !partsDirty || savePartsCost.isPending}
          onClick={async () => {
            try {
              await savePartsCost.mutateAsync({ serviceId, partsCost: partsValue });
              await logCorrection("parts cost", partsCost, partsValue);
              toast({ title: "Parts cost saved" });
            } catch (e: any) {
              toast({ title: "Failed to save parts cost", description: e?.message, variant: "destructive" });
            }
          }}
        >
          {savePartsCost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Parts Cost"}
        </Button>
      </div>

      <div className="grid gap-2 rounded-md border bg-background/60 p-3 text-sm min-[360px]:grid-cols-2 sm:grid-cols-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Total Service Cost</p>
          <p className="break-words font-semibold">{peso(totalCost)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Less Parts Cost</p>
          <p className="break-words font-semibold">- {peso(partsValue)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Gross Profit</p>
          <p className={cn("break-words font-semibold", grossProfit < 0 && "text-destructive")}>{peso(grossProfit)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Commission Pool ({commissionRate || 0}%)</p>
          <p className="break-words font-semibold text-orange-600">{peso(pool)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="break-words text-sm">
          <span className="text-muted-foreground">Allocated:</span>{" "}
          <span className={cn("font-semibold", overAllocated && "text-destructive")}>{peso(sum)}</span>
          <span className="text-muted-foreground"> of {peso(pool)} pool</span>
        </div>
        <Button className="w-full sm:w-auto" size="sm" variant="outline" disabled={isLocked} onClick={() => setDraft((p) => [...p, { serviceName: "", technicianId: null, technicianName: "", cost: 0 }])}>
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
            <div key={i} className="grid grid-cols-2 items-center gap-2 rounded-lg bg-background/70 p-2 sm:grid-cols-12 sm:bg-transparent sm:p-0">
              <Textarea
                className="col-span-2 min-h-20 resize-none text-base sm:col-span-5 sm:min-h-10 sm:py-2 sm:text-sm"
                placeholder="Service performed"
                disabled={isLocked}
                value={r.serviceName}
                onChange={(e) => update(i, { serviceName: e.target.value })}
              />
              <Select
                disabled={isLocked}
                value={r.technicianId ?? ""}
                onValueChange={(val) => {
                  const t = technicians.find((tech) => tech.userId === val);
                  update(i, { technicianId: val, technicianName: t?.name ?? "" });
                }}
              >
                <SelectTrigger className="col-span-2 sm:col-span-4">
                  <SelectValue placeholder={r.technicianName || "Technician"} />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.userId} value={t.userId ?? t.staffId}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative col-span-1 sm:col-span-2">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₱</span>
                <Input
                  className="pl-5 text-right"
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={isLocked}
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
                className="col-span-1 h-10 w-full sm:h-9 sm:w-9"
                disabled={isLocked}
                onClick={() => setDraft((p) => p.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col justify-end gap-2 sm:flex-row">
        {rows.length > 0 && !isLocked && (
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={save.isPending}
            onClick={async () => {
              try {
                await save.mutateAsync({ serviceId, rows: [] });
                setDraft([{ serviceName: "", technicianId: null, technicianName: "", cost: 0 }]);
                toast({ title: "Allocations cleared", description: "Commission now follows the rate." });
              } catch (e: any) {
                toast({ title: "Failed to clear", description: e?.message, variant: "destructive" });
              }
            }}
          >
            Clear Allocations
          </Button>
        )}

        <Button
          size="sm"
          className="w-full sm:w-auto"
          disabled={isLocked || save.isPending || !isDirty}
          onClick={async () => {
            try {
              await save.mutateAsync({
                serviceId,
                rows: draft.filter((r) => r.serviceName || r.technicianName || r.cost),
              });
              await logCorrection("service breakdown", rows, draft);
              toast({ title: "Breakdown saved", description: unlocked ? "Re-disburse this cut-off on Salary Disbursement." : undefined });
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
