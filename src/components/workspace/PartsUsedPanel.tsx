import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInventory } from "@/hooks/useInventory";
import { useFastMovingParts } from "@/hooks/useFastMovingParts";
import { applyPartsDelta } from "@/lib/inventoryDelta";
import { logTicketActivity } from "@/lib/activityLogger";

interface PartItem {
  id: string;
  name: string;
  deviceType?: string;
  model?: string;
  brand?: string;
  partType?: string;
  color?: string;
  supplier?: string;
  cost: number;
  quantity: number;
}

const matchesSearch = (item: PartItem, search: string) => {
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [item.id, item.name, item.brand, item.deviceType, item.model, item.partType, item.color, item.supplier]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every(t => haystack.includes(t));
};

const partLabel = (item: PartItem) =>
  [item.brand, item.deviceType, item.model, item.color, item.partType].filter(Boolean).join(" • ");

const parsePartsString = (raw: string): Record<string, number> => {
  const out: Record<string, number> = {};
  String(raw || "")
    .split(",")
    .forEach(seg => {
      const m = seg.trim().match(/^(.+?)\s*\((?:x\s*)?(\d+)\)$/i);
      if (!m) return;
      const qty = parseInt(m[2], 10) || 0;
      if (qty > 0) out[m[1].trim()] = qty;
    });
  return out;
};

interface Props {
  serviceId: string;
  partsUsed?: string;
  onSaved?: () => void;
}

/** Parts-used editor shared by the technician and admin/management workspaces. */
export const PartsUsedPanel = ({ serviceId, partsUsed, onSaved }: Props) => {
  const { toast } = useToast();
  const { data: inventoryData = [] } = useInventory();
  const { data: fastMovingData = [] } = useFastMovingParts();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [unmatched, setUnmatched] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const inventory = useMemo<PartItem[]>(() => {
    const regular: PartItem[] = (inventoryData as any[]).map(item => ({
      id: item.partId,
      name: item.partName,
      deviceType: item.deviceType || "",
      model: item.model || "",
      brand: item.brand || "",
      partType: item.partType || "",
      color: item.color || "",
      supplier: item.supplier || "",
      cost: typeof item.costPerUnit === "string" ? parseFloat(item.costPerUnit.replace(/[^0-9.]/g, "")) || 0 : 0,
      quantity: item.quantity || 0,
    }));
    const fast: PartItem[] = (fastMovingData as any[])
      .filter(part => part.status === "Received")
      .map(part => ({
        id: part.partId,
        name: part.partName,
        deviceType: part.deviceType || "",
        model: part.model || "",
        brand: part.brand || "",
        partType: part.partType || "",
        color: "",
        supplier: part.supplier || "",
        cost: parseFloat(String(part.cost || "0").replace(/[^0-9.]/g, "")) || 0,
        quantity: parseInt(String(part.quantity || "0").replace(/[^0-9]/g, "")) || 0,
      }));
    return [...regular, ...fast];
  }, [inventoryData, fastMovingData]);

  const filtered = useMemo(() => inventory.filter(i => matchesSearch(i, search)), [inventory, search]);

  useEffect(() => {
    const parsed = parsePartsString(partsUsed || "");
    const byId: Record<string, number> = {};
    const rest: Record<string, number> = {};
    Object.entries(parsed).forEach(([token, qty]) => {
      const found =
        inventory.find(i => i.id?.toLowerCase() === token.toLowerCase()) ||
        inventory.find(i => i.name?.toLowerCase() === token.toLowerCase());
      if (found) byId[found.id] = qty;
      else rest[token] = qty;
    });
    setSelected(byId);
    setUnmatched(rest);
  }, [partsUsed, inventory]);

  const actualCost = useMemo(
    () =>
      Object.entries(selected).reduce((total, [id, qty]) => {
        const item = inventory.find(i => i.id === id);
        return total + (item ? item.cost * qty : 0);
      }, 0),
    [selected, inventory],
  );

  const handleSave = async () => {
    if (isSaving || !serviceId) return;
    setIsSaving(true);
    try {
      const lines = [
        ...Object.entries(selected).filter(([, q]) => q > 0).map(([id, q]) => `${id} (${q})`),
        ...Object.entries(unmatched).filter(([, q]) => q > 0).map(([name, q]) => `${name} (${q})`),
      ];

      const { error } = await supabase
        .from("services")
        .update({
          parts_used: lines,
          parts_cost: actualCost,
          last_updated: new Date().toISOString(),
        } as any)
        .eq("service_id", serviceId);
      if (error) throw new Error(error.message);

      await applyPartsDelta({
        serviceId,
        prevPartsString: partsUsed || "",
        newParts: Object.entries(selected)
          .filter(([, q]) => q > 0)
          .map(([id, q]) => ({ id, name: inventory.find(i => i.id === id)?.name, quantity: q })),
        performerId: sessionStorage.getItem("authUserId"),
        performerName: sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Staff",
      });

      logTicketActivity(serviceId, "Parts used updated", {
        Parts: { from: partsUsed || "None", to: lines.join(", ") || "None" },
        "Parts cost": `₱${actualCost.toFixed(2)}`,
      });

      toast({ title: "Parts saved", description: "Parts used and inventory were updated." });
      onSaved?.();
    } catch (e) {
      toast({
        title: "Could not save parts",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedIds = Object.keys(selected).filter(id => selected[id] > 0);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-background/60 p-4">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Parts Used</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Add Part</Label>
        <Input
          value={search}
          placeholder="Search by ID, name, brand, model..."
          onChange={e => setSearch(e.target.value)}
        />
        <Select value="" onValueChange={partId => setSelected(prev => ({ ...prev, [partId]: prev[partId] || 1 }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select part to add..." />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {filtered.map(item => (
              <SelectItem key={item.id} value={item.id}>
                {item.id} - {item.name}
                {partLabel(item) ? ` [${partLabel(item)}]` : ""} (Stock: {item.quantity})
              </SelectItem>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-2 text-sm text-muted-foreground">No parts match the search</div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {selectedIds.map(id => {
          const item = inventory.find(i => i.id === id);
          return (
            <div key={id} className="flex items-center justify-between gap-2 rounded bg-muted/40 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item?.name || id}</p>
                <p className="text-xs text-muted-foreground">
                  {id}
                  {item && partLabel(item) ? ` • ${partLabel(item)}` : ""}
                </p>
              </div>
              <Input
                type="number"
                min="1"
                value={selected[id]}
                className="w-20"
                onChange={e =>
                  setSelected(prev => ({ ...prev, [id]: Math.max(1, parseInt(e.target.value) || 1) }))
                }
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSelected(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                  })
                }
              >
                Remove
              </Button>
            </div>
          );
        })}

        {Object.entries(unmatched).map(([name, qty]) => (
          <div key={name} className="flex items-center justify-between gap-2 rounded bg-muted/30 p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">Not found in current inventory</p>
            </div>
            <Input
              type="number"
              min="1"
              value={qty}
              className="w-20"
              onChange={e =>
                setUnmatched(prev => ({ ...prev, [name]: Math.max(1, parseInt(e.target.value) || 1) }))
              }
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setUnmatched(prev => {
                  const next = { ...prev };
                  delete next[name];
                  return next;
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}

        {selectedIds.length === 0 && Object.keys(unmatched).length === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">No parts selected yet</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Parts cost: <span className="font-semibold text-foreground">₱{actualCost.toFixed(2)}</span>
        </p>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save parts
        </Button>
      </div>
    </div>
  );
};
