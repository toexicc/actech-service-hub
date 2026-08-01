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
