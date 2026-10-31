import { Card, CardContent } from "@/components/ui/card";
import { NORTH, SOUTH, PickupZone } from "@/lib/pickupZones";
import { cn } from "@/lib/utils";

export const PickupZoneNote = ({ highlight }: { highlight?: PickupZone | null }) => (
  <Card>
    <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
      {([["north", "Monday / Wednesday / Friday (MWF)", "North Side Cities of Metro Manila", NORTH],
         ["south", "Tuesday / Thursday / Saturday (TTHS)", "South Side Cities of Metro Manila", SOUTH]] as const).map(([z, days, side, list]) => (
        <div key={z} className={cn("rounded-md border p-3", highlight === z && "border-primary bg-primary/5")}>
          <p className="font-semibold">{days}</p>
          <p className="text-muted-foreground mb-1">{side}</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {list.map((c) => <li key={c}>{c === "Pateros" ? "Pateros (Municipality)" : c}</li>)}
          </ul>
        </div>
      ))}
    </CardContent>
  </Card>
);
