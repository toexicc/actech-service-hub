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

const unwrap = async (error: any) => {
  const ctx = (error as any)?.context;
  if (ctx?.text) {
    try {
      const text = await ctx.text();
      const parsed = JSON.parse(text);
      return parsed?.error || text;
    } catch {
      /* fall through */
    }
  }
  return error?.message || "AI request failed";
};

/** Format raw technician notes into the customer-facing diagnosis report. */
export const formatDiagnosisWithAI = async (args: DiagnosisArgs): Promise<string> => {
  const { data, error } = await supabase.functions.invoke("format-diagnosis", { body: args });
  if (error) throw new Error(await unwrap(error));
  const text = (data as any)?.formattedDiagnosis;
  if (!text) throw new Error("No formatted diagnosis received from the AI service");
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
  if (error) throw new Error(await unwrap(error));
  const text = (data as any)?.formattedReport;
  if (!text) throw new Error("No formatted report received from the AI service");
  return text as string;
};
