import { useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import { generateCompanyQuotationPdf } from "@/lib/companyQuotationPdf";
import type { QuotePayload } from "@/lib/companyQuotation";

export function QuotationPreviewButton({ quotationNo, payload, compact = false }: {
  quotationNo: string;
  payload: QuotePayload;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setBusy(true);
    generateCompanyQuotationPdf(quotationNo, payload).then((bytes) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      setUrl(objectUrl);
    }).catch(() => {
      if (cancelled) return;
      toast.error("Could not preview quotation. Please try again.");
      setOpen(false);
    }).finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [open, quotationNo, payload]);

  return (
    <div className="inline-flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpen(true)}
        aria-label={`Preview ${quotationNo}`} title={`Preview ${quotationNo}`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
        {compact ? quotationNo : "Preview"}
      </Button>
      <PdfViewerModal open={open && !!url} onOpenChange={setOpen} url={url}
        title={quotationNo} filename={`${quotationNo}.pdf`} />
    </div>
  );
}