import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import {
  getServicePdfSignedUrl,
  servicePdfDownloadName,
  type ServicePdfKind,
} from "@/lib/servicePdfStorage";
import { downloadPdfFromUrl, printPdfFromUrl } from "@/lib/pdfActions";

const DOCS: { kind: Extract<ServicePdfKind, "receipt" | "warranty">; title: string; hint: string }[] = [
  { kind: "receipt", title: "Service Invoice - Receipt", hint: "Approved services and payments" },
  { kind: "warranty", title: "Warranty Card", hint: "Coverage per approved service" },
];

interface Props {
  serviceId?: string;
  clientName?: string;
  serviceDate?: string | null;
  /** Bump to re-check which documents exist (e.g. after recording a payment). */
  refreshKey?: number;
}

/**
 * View / print / download the POS documents of a ticket. Used on the POS page
 * and inside the in-page payment window.
 */
export const PosDocumentActions = ({ serviceId, clientName, serviceDate, refreshKey = 0 }: Props) => {
  const { toast } = useToast();
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("Document");
  const [viewerName, setViewerName] = useState("document.pdf");
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (!serviceId || serviceId === "MANUAL") {
      setAvailable({});
      return;
    }
    let alive = true;
    (async () => {
      const found: Record<string, boolean> = {};
      for (const d of DOCS) {
        const url = await getServicePdfSignedUrl(serviceId, d.kind);
        found[d.kind] = !!url;
      }
      if (alive) setAvailable(found);
    })();
    return () => {
      alive = false;
    };
  }, [serviceId, refreshKey]);

  const nameFor = (kind: ServicePdfKind) =>
    servicePdfDownloadName(kind, { serviceDate, clientName, serviceId });

  const run = async (
    kind: Extract<ServicePdfKind, "receipt" | "warranty">,
    action: "view" | "print" | "download",
    title: string,
  ) => {
    if (!serviceId) return;
    setBusy(`${kind}-${action}`);
    try {
      const url = await getServicePdfSignedUrl(serviceId, kind);
      if (!url) {
        toast({ title: "Document not found", description: `No ${title} stored for ${serviceId} yet.`, variant: "destructive" });
        return;
      }
      if (action === "view") {
        setViewerUrl(url);
        setViewerTitle(title);
        setViewerName(nameFor(kind));
        setViewerOpen(true);
        return;
      }
      const ok =
        action === "print"
          ? await printPdfFromUrl(url, title)
          : await downloadPdfFromUrl(url, nameFor(kind));
      if (!ok) {
        toast({ title: `Could not ${action} the document`, description: "Please try again.", variant: "destructive" });
      }
    } finally {
      setBusy(null);
    }
  };

  const rows = DOCS.filter((d) => available[d.kind]);
  if (!serviceId || serviceId === "MANUAL" || !rows.length) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ticket documents
      </p>
      {rows.map((d) => (
        <div
          key={d.kind}
          className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 p-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{d.title}</p>
            <p className="truncate text-xs text-muted-foreground">{d.hint}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="outline" onClick={() => run(d.kind, "view", d.title)}>
              {busy === `${d.kind}-view` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" aria-label={`Print ${d.title}`} onClick={() => run(d.kind, "print", d.title)}>
              {busy === `${d.kind}-print` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" aria-label={`Download ${d.title}`} onClick={() => run(d.kind, "download", d.title)}>
              {busy === `${d.kind}-download` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ))}
      <PdfViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        url={viewerUrl}
        title={viewerTitle}
        filename={viewerName}
      />
    </div>
  );
};

export default PosDocumentActions;
