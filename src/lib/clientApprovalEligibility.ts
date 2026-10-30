/** A declined response is superseded only when staff reopen and unlock the quote. */
export function canRespondToQuote({
  isWaitingToProceed,
  approvalLocked,
  previousDecision,
  hasPendingLines,
}: {
  isWaitingToProceed: boolean;
  approvalLocked: boolean;
  previousDecision?: "Approved" | "Declined";
  hasPendingLines: boolean;
}): boolean {
  return isWaitingToProceed && !approvalLocked && (
    !previousDecision || previousDecision === "Declined" || hasPendingLines
  );
}