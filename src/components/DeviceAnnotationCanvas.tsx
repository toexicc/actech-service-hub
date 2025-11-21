import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, PencilBrush, FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, RotateCcw, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import laptopTemplate from "@/assets/laptop-template.png";
import iphoneTemplate from "@/assets/iphone-template.png";
import ipadTemplate from "@/assets/ipad-template.png";
import watchTemplate from "@/assets/watch-template.png";
import imacTemplate from "@/assets/imac-template.png";

interface DeviceAnnotationCanvasProps {
  deviceType: string;
  onSave: (imageDataUrl: string) => void;
}

const DEVICE_TEMPLATES: Record<string, string> = {
  "Laptop/Macbook": laptopTemplate,
  "IPad/Tablet": ipadTemplate,
  "IPhone/Mobile": iphoneTemplate,
  "Apple Watch": watchTemplate,
  "Computer/IMac": imacTemplate,
};

export const DeviceAnnotationCanvas = ({ deviceType, onSave }: DeviceAnnotationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<"draw" | "erase">("draw");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: "#ffffff",
    });

    // Load device template image
    const templateUrl = DEVICE_TEMPLATES[deviceType];
    if (templateUrl) {
      FabricImage.fromURL(templateUrl, {
        crossOrigin: 'anonymous',
      }).then((img) => {
        const scaleX = canvas.width! / (img.width || 1);
        const scaleY = canvas.height! / (img.height || 1);
        img.set({
          scaleX,
          scaleY,
          selectable: false,
          evented: false,
        });
        canvas.backgroundImage = img;
        canvas.renderAll();
        setIsLoading(false);
      }).catch(() => {
        toast({
          title: "Error",
          description: "Failed to load device template",
          variant: "destructive",
        });
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }

    // Initialize drawing brush
    canvas.isDrawingMode = true;
    const brush = new PencilBrush(canvas);
    brush.color = "#ff0000";
    brush.width = 3;
    canvas.freeDrawingBrush = brush;

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [deviceType]);

  useEffect(() => {
    if (!fabricCanvas) return;

    if (activeTool === "draw") {
      fabricCanvas.isDrawingMode = true;
      const brush = new PencilBrush(fabricCanvas);
      brush.color = "#ff0000";
      brush.width = 3;
      fabricCanvas.freeDrawingBrush = brush;
    } else if (activeTool === "erase") {
      fabricCanvas.isDrawingMode = true;
      const brush = new PencilBrush(fabricCanvas);
      brush.color = "#ffffff";
      brush.width = 20;
      fabricCanvas.freeDrawingBrush = brush;
    }
  }, [activeTool, fabricCanvas]);

  const handleClear = () => {
    if (!fabricCanvas) return;
    
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj) => {
      fabricCanvas.remove(obj);
    });
    fabricCanvas.renderAll();
    
    toast({
      title: "Canvas Cleared",
      description: "All annotations have been removed",
    });
  };

  const handleSave = async () => {
    if (!fabricCanvas) return;

    setIsSaving(true);
    try {
      const dataUrl = fabricCanvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1,
      });
      
      onSave(dataUrl);
      
      toast({
        title: "Success",
        description: "Device annotation saved successfully",
      });
    } catch (error) {
      console.error("Error saving annotation:", error);
      toast({
        title: "Error",
        description: "Failed to save annotation",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          variant={activeTool === "draw" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTool("draw")}
        >
          <Pen className="h-4 w-4 mr-2" />
          Draw
        </Button>
        <Button
          type="button"
          variant={activeTool === "erase" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTool("erase")}
        >
          <Eraser className="h-4 w-4 mr-2" />
          Erase
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear All
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Annotation
            </>
          )}
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <canvas ref={canvasRef} className="max-w-full" />
      </div>

      <p className="text-sm text-muted-foreground">
        Use the drawing tools to mark any damages or issues on the device template. Red marks will indicate problem areas.
      </p>
    </div>
  );
};
