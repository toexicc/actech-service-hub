import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";

interface PdfViewerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string | null;
  title?: string;
  filename?: string;
}

/**
 * Inline PDF viewer modal with Print + Download actions.
 * Renders a Loader while the iframe URL is empty; honors signed URLs that
 * expire (caller is responsible for fetching a fresh one each time it opens).
 */
export const PdfViewerModal = ({ open, onOpenChange, url, title = "Document", filename }: PdfViewerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) setLoaded(false);
  }, [open]);

  const handlePrint = () => {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      if (url) window.open(url, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] !flex-col p-0 h-[95dvh] max-h-[95dvh] gap-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <div className="flex gap-2 mr-6">
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={!url}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button size="sm" variant="default" asChild disabled={!url}>
                <a href={url ?? "#"} download={filename ?? "document.pdf"} target="_blank" rel="noreferrer">
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
          {url && (
            <iframe
              ref={iframeRef}
              src={`${url}${url.includes("#") ? "&" : "#"}toolbar=1&navpanes=0&view=FitH`}
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
