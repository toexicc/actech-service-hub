import { describe, expect, it } from "vitest";
import { rtoHoldUpdate } from "./rtoHold";
import { interimDeclineUpdate } from "../../supabase/functions/submit-client-approval/decline";

describe("declined interim and proposed returns", () => {
  it("declined interim stays Ongoing Service with On Hold on", () => {
    expect(interimDeclineUpdate("Too expensive")).toEqual({
      status: "Ongoing Service", interim_needed: false,
      is_on_hold: true, on_hold_reason: "Client declined interim work: Too expensive",
    });
  });
  it("putting a proposed RTO on hold does not change the ticket status", () => {
    const live = { status: "Ongoing Service", is_on_hold: false };
    expect({ ...live, ...rtoHoldUpdate(" Client follow-up ") }).toEqual({
      status: "Ongoing Service", is_on_hold: true, on_hold_reason: "Client follow-up",
    });
  });
});