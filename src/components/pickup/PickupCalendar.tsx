import { Calendar } from "@/components/ui/calendar";
import { parseISO } from "date-fns";
import type { PickupEntry } from "@/hooks/usePickupSchedules";

interface Props {
  selected: Date;
  onSelect: (d: Date) => void;
  month: Date;
  onMonthChange: (d: Date) => void;
  entries: PickupEntry[];
}

export const PickupCalendar = ({ selected, onSelect, month, onMonthChange, entries }: Props) => {
  const booked = entries.filter((e) => e.status !== "cancelled").map((e) => parseISO(e.schedule_date));
  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={(d) => d && onSelect(d)}
      month={month}
      onMonthChange={onMonthChange}
      modifiers={{ booked }}
      modifiersClassNames={{ booked: "font-bold underline decoration-primary decoration-2 underline-offset-4" }}
      className="p-3 pointer-events-auto mx-auto"
    />
  );
};
