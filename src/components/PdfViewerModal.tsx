import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
import { toInlinePdfUrl, isInlineViewerUrl } from "@/lib/pdfViewer";

interface PdfViewerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string | null;
  title?: string;
  filename?: string;
}

/**
 * Inline PDF viewer modal with Print + Download actions.
 * The incoming URL is always converted to a local object URL before being
 * rendered, so the document displays inside the modal and never navigates
 * the browser to an external page. The iframe is sandboxed without
 * `allow-top-navigation` so embedded viewers can't redirect the app either.
 */
export const PdfViewerModal = ({ open, onOpenChange, url, title = "Document", filename }: PdfViewerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!open || !url) {
      setLoaded(false);
      setResolvedUrl(null);
      return;
    }
    setLoaded(false);
    setResolvedUrl(null);
    (async () => {
      const inline = await toInlinePdfUrl(url);
      if (!cancelled) setResolvedUrl(inline);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  const handlePrint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      /* printing blocked for cross-origin embeds — ignore, user can download */
    }
  };

  const src = resolvedUrl
    ? isInlineViewerUrl(resolvedUrl)
      ? `${resolvedUrl}#toolbar=1&navpanes=0&view=FitH`
      : resolvedUrl
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] !flex-col p-0 h-[95dvh] max-h-[95dvh] gap-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <div className="flex gap-2 mr-6">
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={!src}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button size="sm" variant="default" asChild disabled={!src}>
                <a href={src ?? "#"} download={filename ?? "document.pdf"}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="relative flex-1 min-h-0 bg-muted">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading PDF...
            </div>
          )}
          {src && (
            <iframe
              ref={iframeRef}
              key={src}
              src={src}
              title={title}
              sandbox="allow-same-origin allow-scripts allow-popups allow-downloads allow-forms"
              className="absolute inset-0 w-full h-full border-0"
              onLoad={() => setLoaded(true)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfViewerModal;
