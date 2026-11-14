/** Putting a proposed return on hold must preserve the live repair stage. */
export const rtoHoldUpdate = (reason: string) => ({
  is_on_hold: true,
  on_hold_reason: reason.trim(),
});