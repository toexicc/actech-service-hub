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

/** One selectable variant of a service line (e.g. OEM vs Original battery). */
export interface QuotedOption {
  label: string;
  cost: number;
}

/** A finalized quotation line the client sees (and can tick) on /track. */
export interface QuotedLine {
  name: string;
  cost: number;
  selected: boolean;
  required: boolean;
  /** Optional variants; when present the line's cost comes from the chosen one. */
  options?: QuotedOption[];
  /** Label of the chosen option (empty when nothing is chosen yet). */
  selectedOption?: string;
}

const toNumber = (raw: string): number => {
  const cleaned = String(raw ?? "").replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

/** Strip a trailing "Php 1,200" / ":" tail off a parsed service name. */
const cleanName = (raw: string): string =>
  String(raw ?? "")
    .replace(/[:\-–—]?\s*php\s*[0-9{][^)]*$/i, "")
    .replace(/[\s:–—-]+$/, "")
    .trim();

/** Amount on a line, ignoring `{Enter Amount}` style placeholders. */
const amountOf = (text: string): number => {
  const m = String(text ?? "").match(/php\s*([0-9][0-9,.]*)/i);
  return m ? toNumber(m[1]) : 0;
};

const OPTION_RE = /^option\s*([A-Za-z0-9]+)?\s*[-–—:]\s*([\s\S]+)$/i;

/**
 * Parse the "Service Breakdown" block of an AI diagnosis into quotation lines,
 * keeping any amount found on the line (placeholders resolve to 0). Indented
 * "Option A - OEM: Php 1,200" rows attach to the service above them.
 */
export const parseQuotedBreakdown = (diagnosis: string): QuotedLine[] => {
  if (!diagnosis) return [];
  const lines = String(diagnosis).split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /service\s*breakdown\s*:?/i.test(l.replace(/[*_#>`]/g, "")));
  if (startIdx === -1) return [];
  const out: QuotedLine[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i].replace(/[*_#>`]/g, "").trim();
    if (!raw) {
      if (out.length) break;
      continue;
    }
    if (/^(to proceed|summary|recommendations?|findings?|cause|warranty|writing rules)/i.test(raw)) break;
    const cleaned = raw.replace(/^[-*•\d.\s]+/, "");

    const opt = cleaned.match(OPTION_RE);
    if (opt && out.length) {
      const label = cleanName(opt[2]) || `Option ${opt[1] ?? out[out.length - 1].options?.length ?? ""}`.trim();
      const line = out[out.length - 1];
      line.options = [...(line.options ?? []), { label, cost: amountOf(cleaned) }];
      continue;
    }

    const name = cleanName(cleaned.split(/\s[-—]\s/)[0]);
    if (!name || /^php\b/i.test(name)) continue;
    out.push({ name, cost: amountOf(cleaned), selected: true, required: false });
  }
  // A line with options takes its cost from the first (default) option.
  return out.map((l) =>
    l.options?.length
      ? { ...l, selectedOption: l.selectedOption || "", cost: l.cost || 0 }
      : l,
  );
};

const normalizeOptions = (raw: unknown): QuotedOption[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map((o: any) => ({
      label: String(o?.label ?? "").trim(),
      cost: typeof o?.cost === "number" ? o.cost : toNumber(String(o?.cost ?? "0")),
    }))
    .filter((o) => o.label);
  return out.length ? out : undefined;
};

/** Coerce whatever is stored in services.quoted_breakdown into QuotedLine[]. */
export const normalizeQuotedBreakdown = (raw: unknown): QuotedLine[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      const options = normalizeOptions(r?.options);
      return {
        name: String(r?.name ?? "").trim(),
        cost: typeof r?.cost === "number" ? r.cost : toNumber(String(r?.cost ?? "0")),
        selected: r?.selected === undefined ? true : !!r.selected,
        required: !!r?.required,
        ...(options ? { options } : {}),
        selectedOption: String(r?.selectedOption ?? "").trim(),
      } as QuotedLine;
    })
    .filter((r) => r.name || r.cost);
};

/** Amount that actually applies to a line (chosen option wins when present). */
export const lineEffectiveCost = (line: QuotedLine): number => {
  if (line.options?.length) {
    const chosen = line.options.find((o) => o.label === line.selectedOption);
    return Number(chosen?.cost ?? 0) || 0;
  }
  return Number(line.cost ?? 0) || 0;
};

/** Name shown in remarks / Service-s, including the chosen option. */
export const lineDisplayName = (line: QuotedLine): string =>
  line.options?.length && line.selectedOption ? `${line.name} (${line.selectedOption})` : line.name;

/** Total of the ticked lines, using each line's effective cost. */
export const quotedSelectedTotal = (lines: QuotedLine[]): number =>
  lines.reduce((sum, l) => sum + (l.selected ? lineEffectiveCost(l) : 0), 0);

export interface QuotedValidation {
  ok: boolean;
  /** Index -> problem, for inline highlighting. */
  problems: Record<number, string>;
  message: string;
  /** True when the shop has not locked (required) any service line. */
  lockMissing?: boolean;
}

/**
 * Shared rule set: at least one ticked line, every ticked line must resolve to
 * an amount greater than zero, and option lines must have a chosen option.
 * `requireLock` additionally demands at least one locked (required) line.
 */
export const validateQuotedLines = (
  lines: QuotedLine[],
  opts?: { requireOne?: boolean; requireLock?: boolean },
): QuotedValidation => {
  const problems: Record<number, string> = {};
  lines.forEach((l, i) => {
    if (!l.selected) return;
    if (l.options?.length && !l.selectedOption) {
      problems[i] = "Choose an option";
      return;
    }
    if (lineEffectiveCost(l) <= 0) problems[i] = "Enter an amount greater than 0";
  });
  const anySelected = lines.some((l) => l.selected);
  const needsOne = opts?.requireOne !== false;
  const lockMissing = !!opts?.requireLock && lines.length > 0 && !lines.some((l) => l.required);
  const ok = Object.keys(problems).length === 0 && (!needsOne || anySelected) && !lockMissing;
  const message = !anySelected && needsOne
    ? "Please select at least one service."
    : lockMissing
    ? "Lock at least one required service — the client's approval of the required service(s) is what moves the ticket to Proceed Repair."
    : Object.keys(problems).length
    ? "Please fix the highlighted service lines."
    : "";
  return { ok, problems, message, lockMissing };
};

/** Lines the shop marked as required (locked). */
export const requiredLines = (lines: QuotedLine[]): QuotedLine[] => lines.filter((l) => l.required);

/**
 * True when every required line is ticked and (when it has variants) has an
 * option chosen. Tickets advance to Proceed Repair on this condition alone.
 */
export const requiredLinesSatisfied = (lines: QuotedLine[]): boolean =>
  requiredLines(lines).every((l) => l.selected && (!l.options?.length || !!l.selectedOption));

/** Philippine VAT rate applied when the client requests an invoice. */
export const VAT_RATE = 0.12;

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Net (VAT-exclusive) amount after discount. */
export const netAfterDiscount = (serviceCost: number, discount: number) =>
  Math.max(0, round2((Number(serviceCost) || 0) - (Number(discount) || 0)));

/** 12% VAT on the discounted amount, or 0 when no invoice is requested. */
export const vatAmount = (serviceCost: number, discount: number, vatRequested: boolean) =>
  vatRequested ? round2(netAfterDiscount(serviceCost, discount) * VAT_RATE) : 0;

/** Final (payable) cost: net after discount, plus VAT when requested. */
export const computeFinalCost = (serviceCost: number, discount: number, vatRequested: boolean) =>
  round2(netAfterDiscount(serviceCost, discount) + vatAmount(serviceCost, discount, vatRequested));





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
