import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Download, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import {
  getServicePdfSignedUrl,
  servicePdfDownloadName,
  type ServicePdfKind,
} from "@/lib/servicePdfStorage";
import { downloadPdfFromUrl, printPdfFromUrl } from "@/lib/pdfActions";
import { regenerateTicketDocuments } from "@/lib/posDocuments";

const POS_DOCS: { kind: Extract<ServicePdfKind, "receipt" | "warranty">; title: string; hint: string }[] = [
  { kind: "receipt", title: "Service Invoice - Receipt", hint: "Approved services and payments" },
  { kind: "warranty", title: "Warranty Card", hint: "Coverage per approved service" },
];

interface FormDoc {
  kind: Extract<ServicePdfKind, "intake" | "quotation">;
  title: string;
  hint: string;
  /** Generates or updates the form document. */
  onGenerate?: () => void | Promise<void>;
  generating?: boolean;
}

interface Props {
  serviceId?: string;
  clientName?: string;
  serviceDate?: string | null;
  /** Bump to re-check which documents exist (e.g. after recording a payment). */
  refreshKey?: number;
  /** Optional intake / quotation rows shown above the POS documents. */
  formDocs?: FormDoc[];
}

/**
 * View / print / download the documents of a ticket. Used on the POS page,
 * inside the in-page payment window and on the manage-client page.
 */
export const PosDocumentActions = ({
  serviceId,
  clientName,
  serviceDate,
  refreshKey = 0,
  formDocs = [],
}: Props) => {

  const { toast } = useToast();
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("Document");
  const [viewerName, setViewerName] = useState("document.pdf");
  const [viewerOpen, setViewerOpen] = useState(false);

  const checkAvailability = useCallback(
    async (repair: boolean) => {
      if (!serviceId || serviceId === "MANUAL") return null;
      const found: Record<string, boolean> = {};
      const kinds: ServicePdfKind[] = [...formDocs.map((f) => f.kind), ...POS_DOCS.map((d) => d.kind)];
      for (const kind of kinds) {
        const url = await getServicePdfSignedUrl(serviceId, kind);
        found[kind] = !!url;
      }
      // Older fully-paid tickets may have completed before warranty generation
      // was available or may have missed a transient upload. Repair that state
      // once when the document panel is opened.
      if (repair && found.receipt && !found.warranty) {
        const regenerated = await regenerateTicketDocuments({
          serviceId,
          actorName:
            sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Management",
          createWarranty: true,
        });
        if (regenerated.warranty) found.warranty = true;
      }
      return found;
    },
    // formDocs is a literal array from the parent; only its kinds matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceId, formDocs.map((f) => f.kind).join(",")],
  );

  useEffect(() => {
    if (!serviceId || serviceId === "MANUAL") {
      setAvailable({});
      return;
    }
    let alive = true;
    setChecking(true);
    (async () => {
      const found = await checkAvailability(true);
      if (alive && found) {
        setAvailable(found);
        setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [serviceId, refreshKey, checkAvailability]);

  const nameFor = (kind: ServicePdfKind) =>
    servicePdfDownloadName(kind, { serviceDate, clientName, serviceId });

  const run = async (
    kind: ServicePdfKind,
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

  /** Generate or refresh the POS documents of this ticket. */
  const regeneratePos = async (kind: "receipt" | "warranty", title: string) => {
    if (!serviceId) return;
    setBusy(`${kind}-generate`);
    try {
      const result = await regenerateTicketDocuments({
        serviceId,
        actorName:
          sessionStorage.getItem("userFullName") || sessionStorage.getItem("username") || "Management",
        createWarranty: true,
      });
      const found = await checkAvailability(false);
      if (found) setAvailable(found);
      const ok = kind === "receipt" ? !!result.receipt : !!result.warranty;
      toast({
        title: ok ? `${title} updated` : `${title} not created`,
        description: ok
          ? "The latest ticket details are now on the document."
          : (kind === "receipt" ? result.receiptSkipped : result.warrantySkipped) ||
            "This ticket must be fully paid before the document is created.",
        variant: ok ? "default" : "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  type Row = {
    kind: ServicePdfKind;
    title: string;
    hint: string;
    onGenerate: () => void | Promise<void>;
    generating: boolean;
  };

  const rows: Row[] = [
    ...formDocs
      .filter((f) => !!f.onGenerate)
      .map((f) => ({
        kind: f.kind,
        title: f.title,
        hint: f.hint,
        onGenerate: () => f.onGenerate?.(),
        generating: !!f.generating,
      })),
    ...POS_DOCS.map((d) => ({
      kind: d.kind as ServicePdfKind,
      title: d.title,
      hint: d.hint,
      onGenerate: () => regeneratePos(d.kind, d.title),
      generating: busy === `${d.kind}-generate`,
    })),
  ];

  if (!serviceId || serviceId === "MANUAL") return null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ticket documents
      </p>
      {rows.map((d) => {
        const ready = !!available[d.kind];
        return (
          <div
            key={d.kind}
            className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 p-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{d.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ready ? d.hint : checking ? "Checking availability..." : "Not available yet"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={d.generating}
                aria-label={`${ready ? "Update" : "Generate"} ${d.title}`}
                title={`${ready ? "Update" : "Generate"} ${d.title}`}
                onClick={() => d.onGenerate()}
              >
                {d.generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!ready}
                aria-label={`View ${d.title}`}
                onClick={() => run(d.kind, "view", d.title)}
              >
                {busy === `${d.kind}-view` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!ready}
                aria-label={`Print ${d.title}`}
                onClick={() => run(d.kind, "print", d.title)}
              >
                {busy === `${d.kind}-print` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!ready}
                aria-label={`Download ${d.title}`}
                onClick={() => run(d.kind, "download", d.title)}
              >
                {busy === `${d.kind}-download` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        );
      })}

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
