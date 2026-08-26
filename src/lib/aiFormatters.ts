import { supabase } from "@/integrations/supabase/client";
import { splitDiagnosisText, type DiagnosisSections } from "@/lib/diagnosisSections";


interface DiagnosisArgs {
  rawDiagnosis: string;
  customerName?: string;
  deviceType?: string;
  model?: string;
  serviceId?: string;
}

interface ReportArgs {
  technicianReport: string;
  customerName?: string;
  deviceType?: string;
  model?: string;
  serviceId?: string;
  finalCost?: string | number;
  serviceCost?: string | number;
}

/**
 * Every AI failure (gateway error, exhausted credits, rate limit, timeout,
 * unauthorized, empty response) is surfaced to staff with one message. Real
 * details stay in the backend function logs.
 */
export const AI_ERROR_MESSAGE = "AI Network Error - Contact Administrator";

/** Format raw technician notes into the customer-facing diagnosis report. */
export const formatDiagnosisWithAI = async (args: DiagnosisArgs): Promise<string> => {
  const { data, error } = await supabase.functions.invoke("format-diagnosis", { body: args });
  if (error) throw new Error(AI_ERROR_MESSAGE);
  const text = (data as any)?.formattedDiagnosis;
  if (!text) throw new Error(AI_ERROR_MESSAGE);
  return text as string;
};

/**
 * Same call as above, but returned already split into the separate diagnosis
 * fields (diagnosis / service breakdown / warranty / summary).
 */
export const formatDiagnosisSections = async (args: DiagnosisArgs): Promise<DiagnosisSections> => {
  const text = await formatDiagnosisWithAI(args);
  return splitDiagnosisText(text);
};


/** Format the technician report into the customer-facing service report. */
export const formatReportWithAI = async (args: ReportArgs): Promise<string> => {
  const { data, error } = await supabase.functions.invoke("format-report", { body: args });
  if (error) throw new Error(AI_ERROR_MESSAGE);
  const text = (data as any)?.formattedReport;
  if (!text) throw new Error(AI_ERROR_MESSAGE);
  return text as string;
};

