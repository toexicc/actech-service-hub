import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Phone, Users } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Duty = "Receiving" | "Releasing and Phone Call";

const DUTY_BY_DAY: Record<number, Record<string, Duty>> = {
  1: { "joddie dalicano": "Receiving", "bien manlise": "Receiving", "dennis adriano": "Releasing and Phone Call" },
  2: { "dennis adriano": "Receiving", "joddie dalicano": "Receiving", "bien manlise": "Releasing and Phone Call" },
  3: { "bien manlise": "Receiving", "dennis adriano": "Receiving", "joddie dalicano": "Releasing and Phone Call" },
  4: { "dennis adriano": "Receiving", "joddie dalicano": "Receiving", "bien manlise": "Releasing and Phone Call" },
  5: { "joddie dalicano": "Receiving", "bien manlise": "Receiving", "dennis adriano": "Releasing and Phone Call" },
  6: { "bien manlise": "Receiving", "dennis adriano": "Receiving", "joddie dalicano": "Releasing and Phone Call" },
};

const MANILA_DATE_TIME = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const getManilaDutyContext = () => {
  const parts = Object.fromEntries(
    MANILA_DATE_TIME.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  const dayIndex: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    displayDate: `${parts.month}/${parts.day}/${parts.year}`,
    dayName: parts.weekday,
    day: dayIndex[parts.weekday] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function DailyFrontDesignationDialog() {
  const { user, profile, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [context, setContext] = useState(getManilaDutyContext);

  const staffName = normalizeName(profile?.name ?? "");
  const duty = useMemo(() => DUTY_BY_DAY[context.day]?.[staffName], [context.day, staffName]);
  const acknowledgementId = `FRONT-DUTY-${context.dateKey}`;

  const checkAcknowledgement = useCallback(async () => {
    if (!user || !isAdmin || !duty || context.day === 0 || context.minutes < 600) {
      setOpen(false);
      return;
    }

    const { data, error } = await supabase
      .from("activity_logs")
      .select("id")
      .eq("actor_id", user.id)
      .eq("entity_type", "front_duty")
      .eq("entity_id", acknowledgementId)
      .limit(1);

    if (!error) setOpen((data ?? []).length === 0);
  }, [acknowledgementId, context.day, context.minutes, duty, isAdmin, user]);

  useEffect(() => {
    void checkAcknowledgement();
  }, [checkAcknowledgement]);

  useEffect(() => {
    const timer = window.setInterval(() => setContext(getManilaDutyContext()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const acknowledge = async () => {
    if (!user || !duty || saving) return;
    setSaving(true);
    const { error } = await supabase.from("activity_logs").insert({
      actor_id: user.id,
      actor_name: profile?.name ?? "Staff",
      action: `Acknowledged daily front designation: ${duty}`,
      entity_type: "front_duty",
      entity_id: acknowledgementId,
      changes: { date: context.dateKey, day: context.dayName, duty },
    });
    setSaving(false);
    if (!error) setOpen(false);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="!flex max-h-[95dvh] w-[calc(100%-2rem)] max-w-xl !flex-col overflow-hidden border-primary/30 p-0">
        <AlertDialogHeader className="shrink-0 border-b bg-primary/10 px-5 py-5 text-left sm:px-6">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            {duty === "Receiving" ? <Users className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
          </div>
          <AlertDialogTitle className="text-xl">Daily Front Designation</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-foreground/80">
            {context.dayName} · {context.displayDate}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-sm text-muted-foreground">Your assigned role today</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{duty}</p>

          <div className="mt-5 rounded-md border border-warning/40 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p className="text-sm font-medium leading-6 text-foreground">
                Answering the phone is everyone's duty at the front desk. The assigned staff for the day handles calls, but if they are busy with a client, the receiving staff must take over the call. Please don't let calls ring continuously.
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="shrink-0 border-t px-5 py-4 sm:px-6">
          <AlertDialogAction onClick={(event) => { event.preventDefault(); void acknowledge(); }} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving…" : "I understand"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}