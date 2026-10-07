import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const DEVICE_ACCESSORY_OPTIONS = [
  "Charger - Adaptor Only",
  "Charger - Adaptor and Cable",
  "Charger - ALL",
  "Case",
  "Sim",
] as const;

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Multi-select of accessories that came with the device, plus custom text entries. */
export function DeviceAccessoryPicker({ value, onChange, disabled }: Props) {
  const [custom, setCustom] = useState("");
  const list = value || [];
  const toggle = (item: string) =>
    onChange(list.includes(item) ? list.filter((v) => v !== item) : [...list, item]);
  const addCustom = () => {
    const t = custom.trim().slice(0, 100);
    if (t && !list.includes(t)) onChange([...list, t]);
    setCustom("");
  };
  const customs = list.filter((v) => !(DEVICE_ACCESSORY_OPTIONS as readonly string[]).includes(v));

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled} className="w-full justify-between font-normal">
            <span className="truncate">{list.length ? `${list.length} selected` : "Select accessories"}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-2 p-3" align="start">
          {DEVICE_ACCESSORY_OPTIONS.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox checked={list.includes(o)} onCheckedChange={() => toggle(o)} />
              {o}
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <Input
              value={custom}
              maxLength={100}
              placeholder="Custom accessory"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button type="button" size="icon" variant="outline" onClick={addCustom}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {customs.length > 0 && <p className="text-xs text-muted-foreground">Custom: {customs.join(", ")}</p>}
        </PopoverContent>
      </Popover>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
              {v}
              {!disabled && (
                <button type="button" onClick={() => toggle(v)} aria-label={`Remove ${v}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default DeviceAccessoryPicker;
