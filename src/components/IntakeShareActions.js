import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Copy, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
const INTAKE_URL = "https://actechrepair-service.com/intake";
export function IntakeShareActions() {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState("");
    useEffect(() => {
        if (!open)
            return;
        let active = true;
        QRCode.toDataURL(INTAKE_URL, { width: 512, margin: 1 })
            .then((url) => {
            if (active)
                setQrDataUrl(url);
        })
            .catch(() => {
            if (active)
                setQrDataUrl("");
        });
        return () => {
            active = false;
        };
    }, [open]);
    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(INTAKE_URL);
            toast({ title: "Copied", description: "Intake link copied to clipboard." });
        }
        catch {
            toast({
                title: "Copy failed",
                description: "Please copy the link manually.",
                variant: "destructive",
            });
        }
    };
    const downloadQr = () => {
        if (!qrDataUrl)
            return;
        const a = document.createElement("a");
        a.href = qrDataUrl;
        a.download = "actech-intake-link.png";
        a.click();
    };
    const shareNative = async () => {
        try {
            await navigator.share({
                title: "AC Tech Repair — Client Intake",
                text: "Submit your device for repair",
                url: INTAKE_URL,
            });
        }
        catch {
            /* user cancelled or unsupported */
        }
    };
    return (<>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <QrCode className="h-4 w-4"/>
        Share intake link
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!flex !flex-col max-h-[95dvh] sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Share intake link</DialogTitle>
            <DialogDescription>
              Scan or share this QR code to open the client intake form.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="flex justify-center">
              <div className="rounded-2xl border border-border/60 bg-background p-4">
                {qrDataUrl ? (<img src={qrDataUrl} alt="QR code linking to the AC Tech Repair client intake form" className="h-56 w-56"/>) : (<div className="h-56 w-56 animate-pulse rounded-xl bg-muted"/>)}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Intake link
              </p>
              <p className="mt-1 break-all text-sm text-foreground">{INTAKE_URL}</p>
            </div>
          </div>

          <div className="shrink-0 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="flex-1 gap-2" onClick={copyLink}>
              <Copy className="h-4 w-4"/>
              Copy link
            </Button>
            <Button type="button" variant="outline" className="flex-1 gap-2" onClick={downloadQr} disabled={!qrDataUrl}>
              <Download className="h-4 w-4"/>
              Download
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (<Button type="button" className="flex-1 gap-2" onClick={shareNative}>
                <Share2 className="h-4 w-4"/>
                Share
              </Button>)}
          </div>
        </DialogContent>
      </Dialog>
    </>);
}
export default IntakeShareActions;
