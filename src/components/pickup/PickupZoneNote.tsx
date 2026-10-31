import { Card, CardContent } from "@/components/ui/card";
import { NORTH, SOUTH, PickupZone } from "@/lib/pickupZones";
import { cn } from "@/lib/utils";

const ZONES = [
  ["north", "MWF (Mon/Wed/Fri) · North Side", NORTH],
  ["south", "TTHS (Tue/Thu/Sat) · South Side", SOUTH],
] as const;

export const PickupZoneNote = ({ highlight }: { highlight?: PickupZone | null }) => (
  <Card>
    <CardContent className="flex flex-col gap-2 text-xs sm:flex-row sm:gap-6">
      {ZONES.map(([z, label, list]) => (
        <div key={z} className={cn("min-w-0 flex-1 rounded-md border p-2", highlight === z && "border-primary bg-primary/5")}>
          <p className="font-semibold">{label}</p>
          <p className="mt-0.5 leading-relaxed text-muted-foreground">{list.map((c) => (c === "Pateros" ? "Pateros (Municipality)" : c)).join(", ")}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);
