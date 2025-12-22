import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GOOGLE_SHEETS_SCRIPT_URL } from "@/lib/googleSheets";

interface DeviceReportViewerProps {
  folderUrl: string;
  serviceId?: string;
}

const getDisplayPhotoUrl = (url: string): string => {
  if (!url) return url;
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    const id = idMatch[1];
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  }
  return url;
};

const extractFolderIdFromUrl = (url: string): string | null => {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

export const DeviceReportViewer = ({ folderUrl, serviceId }: DeviceReportViewerProps) => {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadPhotos = async () => {
      if (!folderUrl) {
        setIsLoading(false);
        return;
      }

      try {
        const folderId = extractFolderIdFromUrl(folderUrl);
        if (!folderId) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(
          `${GOOGLE_SHEETS_SCRIPT_URL}?action=getDeviceReportPhotos&folderId=${folderId}`
        );
        const data = await response.json();

        if (data.status === "success" && data.photos && data.photos.length > 0) {
          setPhotoUrls(data.photos);
        }
      } catch (error) {
        // Silently fail - just show folder link
      } finally {
        setIsLoading(false);
      }
    };

    loadPhotos();
  }, [folderUrl]);

  return (
    <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          <Label className="text-lg font-semibold">Device Report - Proof</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.open(folderUrl, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Folder
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : photoUrls.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photoUrls.map((url, index) => (
            <div
              key={`photo-${index}`}
              className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer"
              onClick={() => setPreviewUrl(getDisplayPhotoUrl(url))}
            >
              <img
                src={getDisplayPhotoUrl(url)}
                alt={`Device report ${index + 1}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover hover:opacity-80 transition-opacity"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No photos found. Click "Open Folder" to view in Google Drive.
        </p>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Photo Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="max-w-full max-h-[70vh] object-contain mx-auto rounded-lg"
              referrerPolicy="no-referrer"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
