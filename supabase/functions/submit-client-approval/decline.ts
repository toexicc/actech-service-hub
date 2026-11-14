/** Interim declines pause active repair, never advance it to observation. */
export const interimDeclineUpdate = (reason: string) => ({
  status: "Ongoing Service" as const,
  interim_needed: false,
  is_on_hold: true,
  on_hold_reason: `Client declined interim work: ${reason}`,
});