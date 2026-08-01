import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Copy, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const TRACK_BASE = "https://actechrepair-service.com/track";

interface TrackingShareActionsProps {
  serviceId: string;
}

export function TrackingShareActions({ serviceId }: TrackingShareActionsProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const shareUrl = `${TRACK_BASE}/${encodeURIComponent(serviceId)}`;

  useEffect(() => {
    if (!open || !serviceId) return;
    let active = true;
    QRCode.toDataURL(shareUrl, { width: 512, margin: 1 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [open, shareUrl, serviceId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Copied", description: "Tracking link copied to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `tracking-${serviceId}.png`;
    a.click();
  };

  const shareNative = async () => {
    try {
      await navigator.share({
        title: `Repair Ticket ${serviceId}`,
        text: "Track your repair status",
        url: shareUrl,
      });
    } catch {
      /* user cancelled or unsupported */
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1"
        onClick={copyLink}
      >
        <Copy className="h-3.5 w-3.5" />
        Copy
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs gap-1"
        onClick={() => setOpen(true)}
      >
        <QrCode className="h-3.5 w-3.5" />
        QR
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!flex !flex-col max-h-[95dvh] sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Share tracking link</DialogTitle>
            <DialogDescription>
              Scan or share this QR code to open the tracking page for ticket {serviceId}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="flex justify-center">
              <div className="rounded-2xl border border-border/60 bg-background p-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code linking to the tracking page for repair ticket ${serviceId}`}
                    className="h-56 w-56"
                  />
                ) : (
                  <div className="h-56 w-56 animate-pulse rounded-xl bg-muted" />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Tracking link
              </p>
              <p className="mt-1 break-all text-sm text-foreground">{shareUrl}</p>
            </div>
          </div>

          <div className="shrink-0 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="flex-1 gap-2" onClick={copyLink}>
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={downloadQr}
              disabled={!qrDataUrl}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button type="button" className="flex-1 gap-2" onClick={shareNative}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TrackingShareActions;
