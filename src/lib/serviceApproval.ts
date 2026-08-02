/**
 * Shared helpers for the client diagnosis-approval flow.
 * Used by the public /track page, /manage-client, /service-update and the
 * submit-client-approval edge function (parser mirrored there).
 */

/** Pull the "Service Breakdown" item names out of an AI diagnosis. */
export const parseServiceBreakdownItems = (diagnosis: string): string[] => {
  if (!diagnosis) return [];
  const lines = String(diagnosis).split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /service\s*breakdown\s*:?/i.test(l.replace(/[*_#>`]/g, "")));
  if (startIdx === -1) return [];
  const out: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i].replace(/[*_#>`]/g, "").trim();
    if (!raw) {
      if (out.length) break;
      continue;
    }
    if (/^(to proceed|summary|recommendations?|findings?|cause|warranty|writing rules)/i.test(raw)) break;
    const cleaned = raw.replace(/^[-*•\d.\s]+/, "");
    const name = cleaned.split(/\s[-—]\s/)[0].trim();
    if (name && !/^php\b/i.test(name)) out.push(name);
  }
  return out;
};

export interface ApprovalRemark {
  decision: "Approved" | "Declined";
  by: string;
  at: string;
  approved: string[];
  pending: string[];
  reason: string;
  text: string;
}

const splitList = (s: string): string[] =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** Build the remark line stored on the ticket's admin notes. */
export const buildApprovalRemark = (args: {
  name: string;
  at: string;
  approved: string[];
  pending?: string[];
}): string => {
  const approved = args.approved.filter(Boolean);
  const pending = (args.pending ?? []).filter(Boolean);
  const base = `${args.name} approved services : ${approved.join(", ")} on ${args.at}`;
  return pending.length ? `${base}. Pending Approval on ${pending.join(", ")}` : base;
};

/**
 * Parse the newest approval/decline remark out of the internal admin notes.
 * Supports the new "…approved services : …" format and the legacy
 * "Approved by <name> on <date>" format.
 */
export const parseApprovalRemark = (notes: string | null | undefined): ApprovalRemark | null => {
  const lines = String(notes ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    const newFmt = line.match(
      /^(.+?) approved services : (.+?) on (.+?)(?:\.\s*Pending Approval on (.+))?$/i,
    );
    if (newFmt) {
      return {
        decision: "Approved",
        by: newFmt[1].trim(),
        at: newFmt[3].trim(),
        approved: splitList(newFmt[2]),
        pending: newFmt[4] ? splitList(newFmt[4]) : [],
        reason: "",
        text: line,
      };
    }

    const legacy = line.match(/^(Approved|Declined) by (.+?) on (.+)$/i);
    if (legacy) {
      let at = legacy[3].trim();
      let reason = "";
      if (/declined/i.test(legacy[1])) {
        const idx = at.lastIndexOf(":");
        if (idx > -1) {
          reason = at.slice(idx + 1).trim();
          at = at.slice(0, idx).trim();
        }
      }
      return {
        decision: /declined/i.test(legacy[1]) ? "Declined" : "Approved",
        by: legacy[2].trim(),
        at,
        approved: [],
        pending: [],
        reason,
        text: line,
      };
    }
  }
  return null;
};

/** Human-readable one-liner for the staff-facing Approval Remark block. */
export const approvalRemarkText = (r: ApprovalRemark): string => {
  if (r.decision === "Declined") {
    return `Declined by ${r.by} on ${r.at}${r.reason ? ` — ${r.reason}` : ""}`;
  }
  if (r.approved.length) {
    return buildApprovalRemark({ name: r.by, at: r.at, approved: r.approved, pending: r.pending });
  }
  return `Approved by ${r.by} on ${r.at}`;
};
