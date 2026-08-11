/**
 * The AI diagnosis is stored as separate fields instead of one text blob:
 *
 *  - diagnosis  : header + AC TECH DEVICE DIAGNOSIS + Findings / Cause /
 *                 Suggested Solution / Recommendations
 *  - breakdown  : structured quotation lines (services.quoted_breakdown)
 *  - warranty   : "Service: {duration}" lines
 *  - otherNotes : manual free text (never written by the AI)
 *  - summary    : one-line summary of the repair needed
 *
 * The disclaimer below is fixed and never stored.
 */

export const APPROVAL_DISCLAIMER =
  "To proceed with the service, please review the diagnosis and click APPROVE to confirm your acceptance. Kindly ensure that you have also reviewed our Terms and Conditions before submitting your approval.";

export const VAT_DISCLAIMER = "Note: The quoted price is exclusive of 12% VAT.";

export interface DiagnosisSections {
  /** Header + findings / cause / solution / recommendations. */
  diagnosis: string;
  /** Warranty lines, one per service. */
  warranty: string;
  /** One-line summary. */
  summary: string;
  /** Raw "Service Breakdown" block, kept so callers can parse it into lines. */
  breakdownText: string;
}

const strip = (s: string) => String(s ?? "").replace(/[*_#>`]/g, "").trim();

const BREAKDOWN_RE = /^service\s*breakdown\s*:?/i;
const WARRANTY_RE = /^warranty\s*:?/i;
const SUMMARY_RE = /^summary\s*:?/i;
const PROCEED_RE = /^(to proceed|note\s*:\s*the quoted price)/i;

/**
 * Split a legacy single-block AI diagnosis into its parts. Safe on text that
 * is already section-only (returns it unchanged as `diagnosis`).
 */
export const splitDiagnosisText = (raw?: string | null): DiagnosisSections => {
  const lines = String(raw ?? "").split(/\r?\n/);
  const diagnosis: string[] = [];
  const breakdown: string[] = [];
  const warranty: string[] = [];
  const summary: string[] = [];

  type Section = "diagnosis" | "breakdown" | "warranty" | "summary" | "skip";
  let section: Section = "diagnosis";

  for (const line of lines) {
    const bare = strip(line);

    if (BREAKDOWN_RE.test(bare)) {
      section = "breakdown";
      const inline = bare.replace(BREAKDOWN_RE, "").trim();
      if (inline) breakdown.push(inline);
      continue;
    }
    if (WARRANTY_RE.test(bare)) {
      section = "warranty";
      const inline = bare.replace(WARRANTY_RE, "").trim();
      if (inline) warranty.push(inline);
      continue;
    }
    if (SUMMARY_RE.test(bare)) {
      section = "summary";
      const inline = bare.replace(SUMMARY_RE, "").trim();
      if (inline) summary.push(inline);
      continue;
    }
    if (PROCEED_RE.test(bare)) {
      section = "skip";
      continue;
    }

    if (section === "diagnosis") diagnosis.push(line);
    else if (section === "breakdown") breakdown.push(line);
    else if (section === "warranty") {
      // A blank line ends the (usually short) warranty block.
      if (!bare) section = "skip";
      else warranty.push(line);
    } else if (section === "summary") {
      if (!bare) section = "skip";
      else summary.push(line);
    }
  }

  const tidy = (arr: string[]) => arr.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    diagnosis: tidy(diagnosis),
    breakdownText: tidy(breakdown),
    warranty: tidy(warranty),
    summary: tidy(summary).replace(/\n+/g, " ").trim(),
  };
};

/** True when the text still carries breakdown / warranty / summary sections. */
export const isLegacyDiagnosisBlob = (raw?: string | null): boolean => {
  const text = String(raw ?? "");
  if (!text.trim()) return false;
  return /service\s*breakdown\s*:/i.test(text) || /^\s*warranty\s*:/im.test(text) || /^\s*summary\s*:/im.test(text);
};

export interface DiagnosisFieldValues {
  diagnosis?: string | null;
  warranty?: string | null;
  otherNotes?: string | null;
  summary?: string | null;
}

/**
 * Read the segmented fields off a ticket, falling back to splitting the legacy
 * one-block diagnosis when the new fields are still empty.
 */
export const diagnosisFieldsFromRecord = (record: any): Required<DiagnosisFieldValues> => {
  const stored = {
    diagnosis: String(record?.aiDiagnosis ?? record?.diagnosis ?? "").trim(),
    warranty: String(record?.diagnosisWarranty ?? "").trim(),
    otherNotes: String(record?.diagnosisOtherNotes ?? "").trim(),
    summary: String(record?.diagnosisSummary ?? "").trim(),
  };
  if (stored.warranty || stored.summary || !isLegacyDiagnosisBlob(stored.diagnosis)) {
    return stored;
  }
  const split = splitDiagnosisText(stored.diagnosis);
  return {
    diagnosis: split.diagnosis,
    warranty: split.warranty,
    otherNotes: stored.otherNotes,
    summary: split.summary,
  };
};

/**
 * The client-facing diagnosis text (quotation PDF panel and /track card):
 * diagnosis + warranty + other notes + fixed disclaimer. The summary and the
 * service breakdown are rendered separately, so they are excluded here.
 */
export const composeClientDiagnosis = (v: DiagnosisFieldValues): string => {
  const parts: string[] = [];
  const diagnosis = String(v.diagnosis ?? "").trim();
  const warranty = String(v.warranty ?? "").trim();
  const otherNotes = String(v.otherNotes ?? "").trim();

  if (diagnosis) parts.push(diagnosis);
  if (warranty) parts.push(`Warranty:\n${warranty}`);
  if (otherNotes) parts.push(`Other Notes:\n${otherNotes}`);
  parts.push(`${APPROVAL_DISCLAIMER}\n${VAT_DISCLAIMER}`);

  return parts.join("\n\n");
};
