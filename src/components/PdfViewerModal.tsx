import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { loadInlinePdf } from "@/lib/pdfViewer";

interface PdfViewerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string | null;
  title?: string;
  filename?: string;
}

/**
 * Inline PDF viewer modal with Print + Download actions.
 * The incoming URL is always downloaded and rendered as a local object URL, so
 * the document displays inside the modal and the browser is never navigated to
 * an external page. Remote URLs are never framed directly (Chrome blocks
 * framing storage responses); if the bytes can't be loaded we show an explicit
 * open/download fallback instead of a blocked frame.
 */
export const PdfViewerModal = ({ open, onOpenChange, url, title = "Document", filename }: PdfViewerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setResolvedUrl(null);
    setFailed(false);
    if (!open || !url) return;
    (async () => {
      const res = await loadInlinePdf(url);
      if (cancelled) return;
      setResolvedUrl(res.url);
      setFailed(!res.ok);
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
      /* printing blocked — user can download instead */
    }
  };

  const src = resolvedUrl ? `${resolvedUrl}#toolbar=1&navpanes=0&view=FitH` : null;

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
              <Button size="sm" variant="default" asChild disabled={!resolvedUrl}>
                <a href={resolvedUrl ?? "#"} download={filename ?? "document.pdf"}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="relative flex-1 min-h-0 bg-muted">
          {!loaded && !failed && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading PDF...
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-md">
                This document couldn't be loaded for inline preview. You can still open it in a
                new tab.
              </p>
              {url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in new tab
                  </a>
                </Button>
              )}
            </div>
          )}
          {src && (
            <iframe
              ref={iframeRef}
              key={src}
              src={src}
              title={title}
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
