import { useRef, forwardRef, useImperativeHandle } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Download } from "lucide-react";

interface SignatureCanvasComponentProps {
  onSave?: (dataUrl: string) => void;
}

export interface SignatureCanvasRef {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

const SignatureCanvasComponent = forwardRef<SignatureCanvasRef, SignatureCanvasComponentProps>(
  ({ onSave }, ref) => {
    const sigCanvas = useRef<SignatureCanvas>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        sigCanvas.current?.clear();
      },
      isEmpty: () => {
        return sigCanvas.current?.isEmpty() ?? true;
      },
      toDataURL: () => {
        return sigCanvas.current?.toDataURL() ?? "";
      },
    }));

    const handleClear = () => {
      sigCanvas.current?.clear();
    };

    const handleSave = () => {
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        const dataUrl = sigCanvas.current.toDataURL();
        onSave?.(dataUrl);
      }
    };

    return (
      <div className="space-y-2">
        <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-background">
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{
              className: "w-full h-40 cursor-crosshair",
              style: { touchAction: "none" },
            }}
            backgroundColor="rgb(255, 255, 255)"
            penColor="rgb(0, 0, 0)"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleClear} className="flex-1">
            <Eraser className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button type="button" variant="outline" onClick={handleSave} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Save Signature
          </Button>
        </div>
      </div>
    );
  }
);

SignatureCanvasComponent.displayName = "SignatureCanvasComponent";

export default SignatureCanvasComponent;
