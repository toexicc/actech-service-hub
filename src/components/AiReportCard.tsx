import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AiReportCardProps {
  report: string;
  title?: string;
}

/**
 * Read-only AI service report card. Shown beneath the device-report photos when
 * a service reaches "Done Repair - Advise Client" so admins/techs can review the
 * generated message that was sent to the client.
 */
export function AiReportCard({ report, title = "AI Service Report" }: AiReportCardProps) {
  if (!report?.trim()) return null;
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {title}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(report);
              toast({ title: "Copied to clipboard" });
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed">
          {report}
        </pre>
      </CardContent>
    </Card>
  );
}
