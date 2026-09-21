/**
 * Single source of truth for how a service status is classified.
 *
 * - "closed"    → Cancelled / RTO / On Hold. These tickets must ONLY ever
 *                 appear in the "All" and "Cancelled / RTO / On Hold" views.
 * - "completed" → Completed tickets.
 * - "active"    → Everything else (still in the workflow).
 */
export type ServiceClass = "active" | "completed" | "closed";

export const isClosedStatus = (status?: string): boolean => {
  const s = (status || "").trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes("cancel") ||
    s === "rto" ||
    s.includes("rto") ||
    s.includes("on hold") ||
    s.includes("on-hold") ||
    s.includes("onhold")
  );
};

export const isCompletedStatus = (status?: string): boolean =>
  (status || "").trim().toLowerCase().includes("completed");

export const classifyStatus = (status?: string): ServiceClass => {
  if (isClosedStatus(status)) return "closed";
  if (isCompletedStatus(status)) return "completed";
  return "active";
};

/** Active = still being worked on (not completed, not cancelled/RTO/on hold). */
export const isActiveStatus = (status?: string): boolean =>
  classifyStatus(status) === "active";

/** The happy-path workflow order (off-path statuses are not included). */
export const STATUS_FLOW = [
  "Pending Diagnosis",
  "Confirmed Diagnosis",
  "Waiting to Proceed",
  "Proceed Repair",
  "Ongoing Service",
  "Done Repair - Under Observation",
  "Done Repair - For Release",
  "Done Repair - Advise Client",
  "Completed",
] as const;

/** Position of a status inside STATUS_FLOW; -1 for off-path statuses. */
export const statusRank = (status?: string): number => {
  const s = (status || "").trim();
  if (s === "Done Repair - Observation") return STATUS_FLOW.indexOf("Done Repair - Under Observation");
  return STATUS_FLOW.indexOf(s as (typeof STATUS_FLOW)[number]);
};

/**
 * Statuses a TECHNICIAN may move a ticket to from its current status.
 * Technicians can only step forward one stage (plus one allowed revert) so they
 * can't skip stages of the workflow.
 */
export const TECHNICIAN_TRANSITIONS: Record<string, string[]> = {
  "Pending Diagnosis": ["Confirmed Diagnosis"],
  "Confirmed Diagnosis": ["Pending Diagnosis"],
  "Waiting to Proceed": [],
  "Proceed Repair": ["Ongoing Service"],
  "Ongoing Service": ["Done Repair - Under Observation"],
  "Done Repair - Under Observation": ["Done Repair - For Release"],
  "Done Repair - Observation": ["Done Repair - For Release"],
  "Done Repair - For Release": [],
};

/** Technicians may always flag a ticket as RTO - ACTech, from any status. */
export const ALWAYS_ALLOWED_TECHNICIAN_STATUS = "RTO - ACTech";

export const technicianAllowedNextStatuses = (current?: string): string[] => {
  const base = TECHNICIAN_TRANSITIONS[(current || "").trim()] ?? [];
  if ((current || "").trim() === ALWAYS_ALLOWED_TECHNICIAN_STATUS) return base;
  return base.includes(ALWAYS_ALLOWED_TECHNICIAN_STATUS)
    ? base
    : [...base, ALWAYS_ALLOWED_TECHNICIAN_STATUS];
};

/**
 * Label shown to the CLIENT on the public /track page.
 * Internal statuses stay as-is everywhere else.
 */
const CLIENT_STATUS_LABELS: Record<string, string> = {
  "Confirmed Diagnosis": "Finalizing Diagnosis",
  "Proceed Repair": "Under Repair",
  "Ongoing Service": "Under Repair",
  "Done Repair - Under Observation": "Under Repair",
  "Done Repair - Observation": "Under Repair",
  "Done Repair - For Release": "Under Observation",
  "Done Repair - Advise Client": "For Release",
  RTO: "Return to Owner",
  "RTO - ACTech": "Return to Owner",
  "RTO - Client": "Return to Owner",

};

export const clientStatusLabel = (status?: string): string => {
  const s = (status || "").trim();
  return CLIENT_STATUS_LABELS[s] ?? s;
};


/**
 * Statuses at which the overdue flag and the "In service" day counter STOP.
 * The repair is finished (or the ticket is closed), so any further waiting is
 * on the client, not on the shop.
 */
export const isTimeTrackedStatus = (status?: string): boolean => {
  const s = (status || "").trim().toLowerCase();
  if (!s) return true;
  if (classifyStatus(s) !== "active") return false;
  if (s === "done repair - for release") return false;
  if (s === "done repair - advise client") return false;
  return true;
};

/**
 * Whether a ticket is currently eligible to be marked overdue. Approval and
 * parts delays pause the overdue flag without changing the ticket's status.
 */
export const isOverdueEligible = (service: {
  status?: string;
  waitingForParts?: boolean;
  partsOrdered?: boolean;
  hasPreOrder?: boolean;
}): boolean => {
  const status = (service.status || "").trim().toLowerCase();
  if (!isTimeTrackedStatus(status)) return false;
  if (status === "waiting to proceed") return false;
  if (isPartsPaused(service) || service.hasPreOrder) return false;
  return true;
};

/**
 * Waiting for Parts and Ordered are two halves of the same pause: the parts are
 * still being procured while either flag is on, so the repair only resumes (and
 * the client-facing parts notice only disappears) once both are off.
 */
export const isPartsPaused = (service: {
  waitingForParts?: boolean;
  partsOrdered?: boolean;
}): boolean => !!service.waitingForParts || !!service.partsOrdered;
