import { useMemo, useState } from "react";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logInventoryActivity } from "@/lib/activityLogger";
import {
  buildImportPlan,
  toInsertRecord,
  toUpdatePatch,
  type ExistingPart,
  type ImportMode,
  type ImportPlan,
} from "@/lib/inventoryImport";

interface InventoryLike {
  partId: string;
  partName: string;
  deviceType: string;
  brand: string;
  model: string;
  partType?: string;
  color?: string;
  quantity: number;
  reorderLevel?: number;
  costPerUnit?: string;
  sellingPrice?: number;
  supplier?: string;
  remarks?: string;
  storedStatus?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: InventoryLike[];
  onImported?: () => void;
}

const LIST_LIMIT = 100;
const INSERT_CHUNK = 100;
const LOG_CHUNK = 200;
const UPDATE_CONCURRENCY = 5;

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Import parts from a CSV: the old inventory Google Sheet's "Inventory Dashboard" tab
 * (File → Download → CSV) or this page's own CSV download. Matched by SKU / Part ID.
 * Shows a preview first; never deletes parts. Inventory staff and management only, so the
 * stock movements it creates are auto-approved instead of waiting for review.
 */
export function InventoryImportDialog({ open, onOpenChange, inventory, onImported }: Props) {
  const { toast } = useToast();
  const { hasInventoryAccess } = useAuth();
  const [mode, setMode] = useState<ImportMode>("details");
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [readError, setReadError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const existing = useMemo<ExistingPart[]>(
    () =>
      inventory.map((i) => ({
        partId: i.partId,
        partName: i.partName,
        deviceType: i.deviceType,
        brand: i.brand,
        model: i.model,
        partType: i.partType,
        color: i.color,
        quantity: i.quantity,
        reorderLevel: i.reorderLevel ?? 0,
        costPerUnit: i.costPerUnit,
        sellingPrice: i.sellingPrice ?? 0,
        supplier: i.supplier,
        remarks: i.remarks,
        storedStatus: i.storedStatus,
      })),
    [inventory],
  );

  const { plan, planError } = useMemo<{ plan: ImportPlan | null; planError: string }>(() => {
    if (!fileText) return { plan: null, planError: "" };
    try {
      return { plan: buildImportPlan(fileText, existing, mode), planError: "" };
    } catch (e) {
      return { plan: null, planError: e instanceof Error ? e.message : "Could not read this file." };
    }
  }, [fileText, existing, mode]);

  const stockChanges = plan?.updates.filter((u) => u.quantityTo !== undefined) ?? [];
  const detailChanges = plan?.updates.filter((u) => u.changes.length > 0) ?? [];
  const changeCount = (plan?.creates.length ?? 0) + (plan?.updates.length ?? 0);

  const reset = () => {
    setFileName("");
    setFileText("");
    setReadError("");
    setProgress({ done: 0, total: 0 });
  };

  const handleOpenChange = (next: boolean) => {
    if (isImporting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      setReadError("This is a spreadsheet file. In Google Sheets, open the Inventory Dashboard tab and use File → Download → Comma-separated values (.csv), then upload that file.");
      return;
    }
    try {
      setFileText(await file.text());
    } catch {
      setReadError("Could not read this file.");
    }
  };

  const handleImport = async () => {
    if (!plan || changeCount === 0 || isImporting) return;
    setIsImporting(true);
    const performedBy = sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Staff";
    const performerId = sessionStorage.getItem("authUserId") || null;
    const total = changeCount;
    let done = 0;
    let created = 0;
    let updated = 0;
    const logs: Record<string, unknown>[] = [];
    setProgress({ done, total });

    try {
      for (const rows of chunk(plan.creates, INSERT_CHUNK)) {
        const { error } = await supabase.from("inventory_parts").insert(rows.map(toInsertRecord) as any);
        if (error) throw new Error(`Adding new parts stopped after ${created}: ${error.message}`);
        created += rows.length;
        done += rows.length;
        setProgress({ done, total });
        rows.forEach((r) =>
          logs.push({
            part_id: r.partId,
            action: "ADD",
            quantity: r.quantity ?? 0,
            performed_by: performerId,
            performed_by_name: performedBy,
            notes: `Imported from ${fileName}`,
          }),
        );
      }

      for (const batch of chunk(plan.updates, UPDATE_CONCURRENCY)) {
        const results = await Promise.all(
          batch.map((u) => supabase.from("inventory_parts").update(toUpdatePatch(u) as any).eq("part_id", u.existing.partId)),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw new Error(`Updating parts stopped after ${updated}: ${failed.error.message}`);
        updated += batch.length;
        done += batch.length;
        setProgress({ done, total });
        batch.forEach((u) => {
          const notes: string[] = [];
          if (u.quantityTo !== undefined) notes.push(`stock count ${u.quantityFrom} → ${u.quantityTo}`);
          if (u.changes.length) notes.push(u.changes.map((c) => c.label).join(", "));
          logs.push({
            part_id: u.existing.partId,
            action: "EDIT",
            quantity: u.quantityTo !== undefined ? u.quantityTo - (u.quantityFrom ?? 0) : 0,
            performed_by: performerId,
            performed_by_name: performedBy,
            notes: `Updated from ${fileName}: ${notes.join("; ")}`,
          });
        });
      }

      // History in Inventory Logs; stock movements are recorded by the database on their own.
      for (const rows of chunk(logs, LOG_CHUNK)) {
        await supabase.from("part_logs").insert(rows as any);
      }
      logInventoryActivity("IMPORT", `Imported ${fileName}: ${created} new, ${updated} updated (${mode === "stock" ? "stock count" : "details only"})`);
      toast({ title: "Import finished", description: `${created} new part(s) added, ${updated} updated.` });
      onImported?.();
      setIsImporting(false);
      reset();
      onOpenChange(false);
    } catch (e) {
      logInventoryActivity("IMPORT", `Import of ${fileName} stopped: ${created} new, ${updated} updated before the error`);
      onImported?.();
      toast({
        title: "Import stopped",
        description: `${e instanceof Error ? e.message : "Something went wrong."} What was saved before the error stays saved; upload the same file again to finish.`,
        variant: "destructive",
      });
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] !flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Import parts from CSV</DialogTitle>
          <DialogDescription>
            Upload your Google Sheet's Inventory Dashboard tab (File → Download → Comma-separated values) or this page's CSV download.
            Parts are matched by SKU / Part ID. Nothing is saved until you press Import, and no part is ever deleted.
          </DialogDescription>
        </DialogHeader>

        {!hasInventoryAccess ? (
          <p className="text-sm text-muted-foreground">Only inventory staff and management can import parts.</p>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>What should the import change?</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as ImportMode)} className="gap-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2">
                  <RadioGroupItem value="details" id="import-details" className="mt-0.5" />
                  <span className="text-sm">
                    <span className="font-medium">Update details only</span>
                    <span className="block text-xs text-muted-foreground">
                      Adds new parts with their quantity. For parts already here, updates names, prices, re-order levels and other details — stock stays as it is.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2">
                  <RadioGroupItem value="stock" id="import-stock" className="mt-0.5" />
                  <span className="text-sm">
                    <span className="font-medium">Stock count</span>
                    <span className="block text-xs text-muted-foreground">
                      Same as above, and also sets each part's quantity to the number in the file. Use after a physical count.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventory-import-file">CSV file</Label>
              <Input
                id="inventory-import-file"
                type="file"
                accept=".csv,text/csv"
                disabled={isImporting}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>

            {(readError || planError) && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{readError || planError}</span>
              </div>
            )}

            {plan && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <div className="rounded-md border p-2">
                    <div className="text-xl font-semibold">{plan.creates.length}</div>
                    <div className="text-xs text-muted-foreground">New parts</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xl font-semibold">{plan.updates.length}</div>
                    <div className="text-xs text-muted-foreground">Will change</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xl font-semibold">{plan.unchanged}</div>
                    <div className="text-xs text-muted-foreground">Unchanged</div>
                  </div>
                  <div className={`rounded-md border p-2 ${plan.errors.length ? "border-destructive/50 text-destructive" : ""}`}>
                    <div className="text-xl font-semibold">{plan.errors.length}</div>
                    <div className="text-xs">Rows with errors</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Read {plan.rowsRead} rows from {fileName} (header on row {plan.headerRowNumber},{" "}
                  {plan.layout === "sheet" ? "inventory sheet layout" : "app CSV layout"}).
                </p>

                {plan.errors.length > 0 && (
                  <section className="space-y-1">
                    <h4 className="text-sm font-semibold text-destructive">Rows with errors — these are skipped</h4>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                      {plan.errors.slice(0, LIST_LIMIT).map((e, i) => (
                        <div key={`${e.rowNumber}-${i}`}>
                          Row {e.rowNumber} · <span className="font-mono">{e.partId}</span> · {e.message}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {stockChanges.length > 0 && (
                  <section className="space-y-1">
                    <h4 className="text-sm font-semibold">Stock changes ({stockChanges.length})</h4>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                      {stockChanges.slice(0, LIST_LIMIT).map((u) => (
                        <div key={u.existing.partId} className="flex justify-between gap-2">
                          <span className="truncate">
                            <span className="font-mono">{u.existing.partId}</span> · {u.row.partName}
                          </span>
                          <span className="shrink-0 font-mono">
                            {u.quantityFrom} → <span className="font-semibold">{u.quantityTo}</span>
                          </span>
                        </div>
                      ))}
                      {stockChanges.length > LIST_LIMIT && <div className="text-muted-foreground">…and {stockChanges.length - LIST_LIMIT} more</div>}
                    </div>
                  </section>
                )}

                {detailChanges.length > 0 && (
                  <section className="space-y-1">
                    <h4 className="text-sm font-semibold">Detail changes ({detailChanges.length})</h4>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                      {detailChanges.slice(0, LIST_LIMIT).map((u) => (
                        <div key={u.existing.partId}>
                          <span className="font-mono">{u.existing.partId}</span>:{" "}
                          {u.changes.map((c) => `${c.label} "${c.from || "—"}" → "${c.to}"`).join(" · ")}
                        </div>
                      ))}
                      {detailChanges.length > LIST_LIMIT && <div className="text-muted-foreground">…and {detailChanges.length - LIST_LIMIT} more</div>}
                    </div>
                  </section>
                )}

                {plan.creates.length > 0 && (
                  <section className="space-y-1">
                    <h4 className="text-sm font-semibold">New parts ({plan.creates.length})</h4>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                      {plan.creates.slice(0, LIST_LIMIT).map((c) => (
                        <div key={c.partId} className="flex justify-between gap-2">
                          <span className="truncate">
                            <span className="font-mono">{c.partId}</span> · {c.partName}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {c.deviceType} · qty {c.quantity ?? 0}
                          </span>
                        </div>
                      ))}
                      {plan.creates.length > LIST_LIMIT && <div className="text-muted-foreground">…and {plan.creates.length - LIST_LIMIT} more</div>}
                    </div>
                  </section>
                )}

                {changeCount === 0 && plan.errors.length === 0 && (
                  <p className="text-sm text-muted-foreground">Everything in this file already matches the inventory.</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          {hasInventoryAccess && (
            <Button onClick={handleImport} disabled={!plan || changeCount === 0 || isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing {progress.done} of {progress.total}…
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Import {changeCount} change{changeCount === 1 ? "" : "s"}
                  {plan && plan.errors.length > 0 ? ` (skip ${plan.errors.length})` : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
