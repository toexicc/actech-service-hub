import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { loadPdfBytes, renderPdfToImages, type RenderedPage } from "@/lib/pdfViewer";

interface PdfViewerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string | null;
  title?: string;
  filename?: string;
}

/**
 * PDF viewer modal that renders the document's pages as images (pdfjs) instead
 * of framing the PDF, so the form always displays inside the modal regardless
 * of the browser's inline-PDF support. Download always saves the real PDF
 * bytes; Print prints the rendered pages.
 */
export const PdfViewerModal = ({ open, onOpenChange, url, title = "Document", filename }: PdfViewerModalProps) => {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const signal = { cancelled: false };
    setPages([]);
    setTotal(0);
    setFailed(false);
    setDownloadUrl(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (!open || !url) return;

    setBusy(true);
    (async () => {
      const bytes = await loadPdfBytes(url);
      if (signal.cancelled) return;
      if (!bytes) {
        setBusy(false);
        setFailed(true);
        return;
      }
      const objUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      objectUrlRef.current = objUrl;
      setDownloadUrl(objUrl);
      try {
        await renderPdfToImages(
          bytes,
          (page, _i, count) => {
            if (signal.cancelled) return;
            setTotal(count);
            setPages((prev) => [...prev, page]);
          },
          { signal },
        );
      } catch {
        if (!signal.cancelled) setFailed(true);
      } finally {
        if (!signal.cancelled) setBusy(false);
      }
    })();

    return () => {
      signal.cancelled = true;
    };
  }, [open, url]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const handlePrint = () => {
    if (!pages.length) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const imgs = pages
      .map((p) => `<img src="${p.src}" style="width:100%;display:block;page-break-after:always" />`)
      .join("");
    w.document.write(
      `<html><head><title>${title}</title><style>@page{margin:0}body{margin:0}</style></head><body>${imgs}<script>window.onload=function(){window.focus();window.print();}</script></body></html>`,
    );
    w.document.close();
  };

  const loadingFirst = busy && pages.length === 0 && !failed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] !flex-col p-0 h-[95dvh] max-h-[95dvh] gap-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">
              {title}
              {total > 1 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {pages.length}/{total} pages
                </span>
              )}
            </DialogTitle>
            <div className="flex gap-2 mr-6">
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={!pages.length}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button size="sm" variant="default" asChild disabled={!downloadUrl}>
                <a href={downloadUrl ?? "#"} download={filename ?? "document.pdf"}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain bg-muted">
          {loadingFirst && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {failed && pages.length === 0 && (
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
          {pages.length > 0 && (
            <div className="flex flex-col items-center gap-4 p-4">
              {pages.map((p, i) => (
                <img
                  key={i}
                  src={p.src}
                  alt={`${title} — page ${i + 1}`}
                  className="w-full max-w-4xl rounded-lg border bg-background shadow-sm"
                />
              ))}
              {busy && (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rendering remaining pages...
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfViewerModal;
