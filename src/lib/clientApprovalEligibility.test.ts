import { describe, expect, it } from "vitest";
import { canRespondToQuote } from "./clientApprovalEligibility";

const reopened = {
  isWaitingToProceed: true,
  approvalLocked: false,
  previousDecision: "Declined" as const,
  hasPendingLines: true,
};

describe("client quote response eligibility", () => {
  it("allows a previously declined quote reopened to Waiting to Proceed", () => {
    expect(canRespondToQuote(reopened)).toBe(true);
  });
  it("keeps the approval lock authoritative after a decline", () => {
    expect(canRespondToQuote({ ...reopened, approvalLocked: true })).toBe(false);
  });
  it("does not reopen responses outside Waiting to Proceed", () => {
    expect(canRespondToQuote({ ...reopened, isWaitingToProceed: false })).toBe(false);
  });
  it("keeps fully approved quotes closed", () => {
    expect(canRespondToQuote({ ...reopened, previousDecision: "Approved", hasPendingLines: false })).toBe(false);
  });
  it("allows approval of remaining unapproved lines", () => {
    expect(canRespondToQuote({ ...reopened, previousDecision: "Approved" })).toBe(true);
  });
  it("allows the first response", () => {
    expect(canRespondToQuote({ ...reopened, previousDecision: undefined })).toBe(true);
  });
});