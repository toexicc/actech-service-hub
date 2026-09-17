import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatInterimSections } from "@/lib/aiFormatters";
import { AI_ERROR_MESSAGE } from "@/lib/aiFormatters";
import { DiagnosisPhotos } from "@/components/DiagnosisPhotos";
import { logAiFormatActivity } from "@/lib/activityLogger";

export interface InterimReportValues {
  findings: string;
  report: string;
  breakdown: string;
  warranty: string;
  summary: string;
}

interface InterimReportBlockProps {
  serviceId: string;
  clientName?: string;
  deviceType?: string;
  model?: string;
  /** The approved initial AI diagnosis — the AI uses it as reference. */
  initialDiagnosis?: string;
  values: InterimReportValues;
  onChange: (patch: Partial<InterimReportValues>) => void;
  /** "Needs interim report" toggle. */
  needed: boolean;
  onNeededChange?: (v: boolean) => void;
  /** Show the toggle (technician flow). When false the block is always open. */
  showToggle?: boolean;
  /** Text fields editable. */
  editable?: boolean;
  /** Photo panel accepts uploads. */
  photosEditable?: boolean;
  /** Admin-only: append the interim lines to the client-facing breakdown. */
  onApprove?: () => void;
  /** Extra controls under the block (e.g. hand back to Confirmed Diagnosis). */
  footer?: ReactNode;
  /** Where this ran from, for the activity log. */
  source?: string;
}

export const InterimReportBlock = ({
  serviceId,
  clientName,
  deviceType,
  model,
  initialDiagnosis,
  values,
  onChange,
  needed,
  onNeededChange,
  showToggle = false,
  editable = true,
  photosEditable = false,
  onApprove,
  footer,
  source = "/manage-client",
}: InterimReportBlockProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formatting, setFormatting] = useState(false);

  const hasContent = [values.report, values.findings, values.breakdown, values.summary].some(
    (v) => !!String(v ?? "").trim(),
  );

  const generate = async () => {
    if (!values.findings?.trim()) {
      toast({
        title: "No interim findings",
        description: "Write the new findings first, then create the interim report.",
        variant: "destructive",
      });
      return;
    }
    const ok = window.confirm(
      "AI Interim Report\n\nThis writes a client-facing interim report from the initial diagnosis plus your new findings. AI output may contain mistakes - review every section (especially the Service Breakdown amounts and warranty) before saving.\n\nProceed?",
    );
    if (!ok) return;
    setFormatting(true);
    try {
      const sections = await formatInterimSections({
        initialDiagnosis: initialDiagnosis || "",
        interimFindings: values.findings,
        customerName: clientName || "",
        deviceType: deviceType || "",
        model: model || "",
        serviceId,
      });
      if (!sections.diagnosis) throw new Error(AI_ERROR_MESSAGE);
      onChange({
        report: sections.diagnosis,
        breakdown: sections.breakdownText,
        warranty: sections.warranty,
        summary: sections.summary,
      });
      logAiFormatActivity(serviceId, "diagnosis", {
        source: `${source} (interim report)`,
        before: values.findings,
        after: sections.diagnosis,
      });
      toast({
        title: "Interim Report Created",
        description: "⚠️ Please double-check and proofread it before saving.",
      });
    } catch {
      toast({ title: "Error", description: AI_ERROR_MESSAGE, variant: "destructive" });
    } finally {
      setFormatting(false);
    }
  };

  const body = (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="interimFindings">Interim Findings (raw notes):</Label>
        <Textarea
          id="interimFindings"
          readOnly={!editable}
          placeholder="What was found while the repair was already ongoing"
          value={values.findings}
          onChange={(e) => onChange({ findings: e.target.value })}
          rows={4}
          className="min-h-[80px] resize-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={formatting || !editable} onClick={generate}>
            {formatting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Interim Report"
            )}
          </Button>
          {editable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!window.confirm("Clear all interim report fields?")) return;
                onChange({ report: "", breakdown: "", warranty: "", summary: "" });
                toast({ title: "Interim report fields cleared" });
              }}
            >
              Clear
            </Button>
          )}
          {onApprove && (
            <Button
              type="button"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={onApprove}
            >
              Approve (add to Service Breakdown)
            </Button>
          )}
        </div>
        <Label htmlFor="aiInterimReport">AI Interim Report:</Label>
        <Textarea
          id="aiInterimReport"
          readOnly={!editable}
          placeholder="Reference, Findings, Cause of Issue, Suggested Solution, Recommendations"
          value={values.report}
          onChange={(e) => onChange({ report: e.target.value })}
          className="min-h-[100px] resize-none"
          style={{
            minHeight: "100px",
            height: `${Math.max(100, ((values.report || "").split("\n").length + 1) * 24)}px`,
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="interimBreakdown">Additional Service Breakdown (draft):</Label>
        <Textarea
          id="interimBreakdown"
          readOnly={!editable}
          placeholder={"Additional service - Php {Enter Amount}"}
          value={values.breakdown}
          onChange={(e) => onChange({ breakdown: e.target.value })}
          rows={4}
          className="min-h-[90px] resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Approving adds these lines to the client-facing Service Breakdown. Existing lines are never
          changed or removed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="interimWarranty">Warranty:</Label>
          <Textarea
            id="interimWarranty"
            readOnly={!editable}
            placeholder={"Additional service - {Enter Warranty Duration}"}
            value={values.warranty}
            onChange={(e) => onChange({ warranty: e.target.value })}
            rows={3}
            className="min-h-[70px] resize-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interimSummary">Summary:</Label>
          <Textarea
            id="interimSummary"
            readOnly={!editable}
            placeholder="One-line summary of the additional repair needed"
            value={values.summary}
            onChange={(e) => onChange({ summary: e.target.value })}
            rows={3}
            className="min-h-[70px] resize-none"
          />
        </div>
      </div>

      {serviceId && (
        <DiagnosisPhotos
          serviceId={serviceId}
          kind="interim_photo"
          title="Interim Report - Photos"
          editable={photosEditable}
        />
      )}

      {footer}
    </div>
  );

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
      {showToggle && (
        <div className="flex items-center justify-between gap-3 pb-3">
          <div>
            <Label className="font-semibold">Needs interim report</Label>
            <p className="text-xs text-muted-foreground">
              Turn on when new findings during the repair need the client's approval.
            </p>
          </div>
          <Switch
            checked={needed}
            onCheckedChange={(v) => {
              onNeededChange?.(v);
              if (v) setOpen(true);
            }}
          />
        </div>
      )}

      {(!showToggle || needed) && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="font-semibold">AI Interim Report</span>
              <span className="text-xs">{open ? "▼" : "▶"}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>{body}</CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
