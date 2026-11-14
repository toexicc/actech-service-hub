/** Putting a proposed return on hold must preserve the live repair stage. */
export const DEFAULT_RTO_ON_HOLD = true;
export const holdAlertNames = (assigned: string) =>
  [...new Set([...assigned.split(",").map((name) => name.trim()).filter(Boolean), "Romar Badilles"])];

export const rtoHoldUpdate = (reason: string) => ({
  is_on_hold: true,
  on_hold_reason: reason.trim(),
});