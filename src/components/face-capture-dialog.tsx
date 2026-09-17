import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Camera, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface FaceCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  onCapture: (base64: string) => void | Promise<void>;
  busy?: boolean;
}

export function FaceCaptureDialog({
  open,
  onOpenChange,
  title = "Сабти рӯй",
  subtitle = "Рӯятонро дар доираи камера нигоҳ доред ва тугмаро пахш кунед",
  onCapture,
  busy = false,
}: FaceCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const startCamera = async () => {
    setStarting(true);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      toast.error("Камера дастрас нест: " + (e.message || "хато"));
    } finally {
      setStarting(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (open) {
      setPreview(null);
      startCamera();
    } else {
      stopCamera();
      setPreview(null);
    }
    return () => stopCamera();
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(base64);
  };

  const retake = () => {
    setPreview(null);
    startCamera();
  };

  const submit = async () => {
    if (!preview) return;
    await onCapture(preview);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black border border-border">
            {preview ? (
              <img src={preview} alt="face preview" className="w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            )}
            {!preview && starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {preview ? (
            <>
              <Button type="button" variant="outline" onClick={retake} disabled={busy || starting}>
                <RefreshCw className="mr-2 h-4 w-4" /> Аз нав
              </Button>
              <Button type="button" onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Тасдиқ кардан
              </Button>
            </>
          ) : (
            <Button type="button" onClick={capture} disabled={starting || busy} className="w-full">
              <Camera className="mr-2 h-4 w-4" /> Акс гирифтан
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
