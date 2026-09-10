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

/**
 * Calls an AI edge function with an explicitly attached access token. A stale
 * or nearly expired login is the usual reason these calls fail, so the token is
 * refreshed and the call retried once before giving up.
 */
export const invokeAiFunction = async <T>(name: string, body: unknown): Promise<T> => {
  const attempt = async (token?: string) => {
    const { data, error } = await supabase.functions.invoke(name, {
      body,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
    if (error) throw error;
    return data as T;
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  try {
    return await attempt(token);
  } catch (first) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const freshToken = refreshed?.session?.access_token;
    if (!freshToken) throw new Error(AI_ERROR_MESSAGE);
    try {
      return await attempt(freshToken);
    } catch {
      throw new Error(AI_ERROR_MESSAGE);
    }
  }
};

/** Format raw technician notes into the customer-facing diagnosis report. */
export const formatDiagnosisWithAI = async (args: DiagnosisArgs): Promise<string> => {
  const data = await invokeAiFunction<any>("format-diagnosis", args);
  const text = data?.formattedDiagnosis;
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

